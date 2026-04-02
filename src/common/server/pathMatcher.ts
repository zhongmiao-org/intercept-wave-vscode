export interface MatchResult {
    matched: boolean;
    exact: boolean;
    wildcardCount: number;
    patternLength: number;
}

export interface MinimalMockApi {
    path: string;
    method: string;
    enabled?: boolean;
    queryParams?: string;
    requestBody?: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepPartialMatch(pattern: unknown, target: unknown): boolean {
    if (pattern === null || pattern === undefined) {
        return true;
    }

    if (isObject(pattern)) {
        if (!isObject(target)) {
            return false;
        }

        for (const key of Object.keys(pattern)) {
            const patternValue = pattern[key];
            const targetValue = target[key];

            if (!deepPartialMatch(patternValue, targetValue)) {
                return false;
            }
        }
        return true;
    }

    if (Array.isArray(pattern)) {
        if (!Array.isArray(target)) {
            return false;
        }
        if (pattern.length === 0) {
            return true;
        }
        if (pattern.length > target.length) {
            return false;
        }
        for (let i = 0; i < pattern.length; i++) {
            if (!deepPartialMatch(pattern[i], target[i])) {
                return false;
            }
        }
        return true;
    }

    return pattern === target;
}

function parsePatternInput(input: string): unknown {
    const trimmed = input.trim();
    if (!trimmed) {
        return null;
    }

    const cleaned = trimmed.replace(/,\s*([}\]])/g, '$1');
    try {
        return JSON.parse(cleaned);
    } catch {
        // Not JSON, try query string format
    }

    if (trimmed.includes('=') && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        try {
            const params: Record<string, unknown> = {};
            const searchParams = new URLSearchParams(trimmed);
            searchParams.forEach((value, key) => {
                params[key] = value;
            });
            return Object.keys(params).length > 0 ? params : null;
        } catch {
            return null;
        }
    }

    return null;
}

export function matchRequestBody(patternInput: string | undefined, targetBody: unknown): boolean {
    if (!patternInput || patternInput.trim() === '') {
        return true;
    }

    const pattern = parsePatternInput(patternInput);
    if (pattern === null) {
        return false;
    }

    return deepPartialMatch(pattern, targetBody);
}

function normalizePath(p: string): string {
    if (!p) return '/';
    if (!p.startsWith('/')) p = '/' + p;
    p = p.split('?')[0];
    p = p.replace(/\/+/g, '/');
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    return p;
}

function splitSegments(p: string): string[] {
    const norm = normalizePath(p);
    return norm === '/' ? [] : norm.slice(1).split('/');
}

function countWildcards(patternSegments: string[]): number {
    let count = 0;
    for (const seg of patternSegments) {
        if (seg === '*' || seg === '**') count += 1;
    }
    return count;
}

export function matchPathPattern(pattern: string, path: string): MatchResult {
    const pSegs = splitSegments(pattern);
    const tSegs = splitSegments(path);

    const wildcardCount = countWildcards(pSegs);
    const exact = wildcardCount === 0;
    const patternLength = normalizePath(pattern).length;

    function matchAt(pi: number, ti: number): boolean {
        while (pi < pSegs.length && ti < tSegs.length) {
            const ps = pSegs[pi];
            const ts = tSegs[ti];
            if (ps === '*') {
                pi += 1;
                ti += 1;
                continue;
            }
            if (ps === '**') {
                const remainingPattern = pSegs.length - (pi + 1);
                for (let k = 1; ti + k <= tSegs.length - remainingPattern; k++) {
                    if (matchAt(pi + 1, ti + k)) return true;
                }
                return false;
            }
            if (ps !== ts) return false;
            pi += 1;
            ti += 1;
        }

        if (pi < pSegs.length) {
            if (pi === pSegs.length - 1 && pSegs[pi] === '**') {
                return ti < tSegs.length;
            }
            return false;
        }

        return ti === tSegs.length;
    }

    return {
        matched: matchAt(0, 0),
        exact,
        wildcardCount,
        patternLength,
    };
}

function matchExactPathWithQuery(pattern: string, requestPath: string): boolean {
    const patternParts = pattern.split('?');
    const requestParts = requestPath.split('?');

    const patternPathOnly = normalizePath(patternParts[0]);
    const requestPathOnly = normalizePath(requestParts[0]);

    const pathMatch = matchPathPattern(patternPathOnly, requestPathOnly);
    if (!pathMatch.matched) return false;

    if (patternParts.length > 1 && requestParts.length > 1) {
        const patternQuery = new URLSearchParams(patternParts[1]);
        const requestQuery = new URLSearchParams(requestParts[1]);

        if (patternQuery.size !== requestQuery.size) {
            return false;
        }

        for (const [key, value] of patternQuery) {
            if (requestQuery.get(key) !== value) {
                return false;
            }
        }
        return true;
    }

    return patternParts.length === 1 && requestParts.length === 1;
}

export function selectBestMockApiForRequest<T extends MinimalMockApi>(
    apis: T[],
    requestPath: string,
    method: string,
    queryParams: unknown = null,
    requestBody: unknown = null
): T | undefined {
    const reqMethod = (method || 'GET').toUpperCase();

    type Candidate = T &
        MatchResult & {
            isMethodSpecific: boolean;
            hasQueryMatch: boolean;
            hasBodyMatch: boolean;
        };
    const candidates: Candidate[] = [];

    for (const api of apis) {
        if (api.enabled === false) continue;
        const methodUpper = (api.method || 'ALL').toUpperCase();
        if (!(methodUpper === 'ALL' || methodUpper === reqMethod)) continue;

        const hasQueryConfig = api.queryParams && api.queryParams.trim() !== '';

        let matchResult: MatchResult;

        if (hasQueryConfig) {
            const pathWithoutQuery = requestPath.split('?')[0];
            matchResult = matchPathPattern(api.path, normalizePath(pathWithoutQuery));
        } else {
            const exactMatch = matchExactPathWithQuery(api.path, requestPath);
            if (!exactMatch) continue;
            matchResult = {
                matched: true,
                exact: !api.path.includes('*') && !api.path.includes('**'),
                wildcardCount: (api.path.match(/[*]+/g) || []).length,
                patternLength: api.path.length,
            };
        }

        if (!matchResult.matched) continue;

        const hasQueryMatch = matchRequestBody(api.queryParams, queryParams);
        if (!hasQueryMatch) continue;

        const hasBodyMatch = matchRequestBody(api.requestBody, requestBody);
        if (!hasBodyMatch) continue;

        candidates.push({
            ...api,
            ...matchResult,
            isMethodSpecific: methodUpper !== 'ALL' && methodUpper === reqMethod,
            hasQueryMatch: hasQueryConfig ? true : false,
            hasBodyMatch: api.requestBody ? true : false,
        });
    }

    if (candidates.length === 0) return undefined;

    candidates.sort((a, b) => {
        const aScore = (a.hasQueryMatch ? 1 : 0) + (a.hasBodyMatch ? 1 : 0);
        const bScore = (b.hasQueryMatch ? 1 : 0) + (b.hasBodyMatch ? 1 : 0);
        if (aScore !== bScore) return bScore - aScore;
        if (a.exact !== b.exact) return a.exact ? -1 : 1;
        if (a.wildcardCount !== b.wildcardCount) return a.wildcardCount - b.wildcardCount;
        if (a.isMethodSpecific !== b.isMethodSpecific) return a.isMethodSpecific ? -1 : 1;
        if (a.patternLength !== b.patternLength) return b.patternLength - a.patternLength;
        return 0;
    });

    return candidates[0];
}
