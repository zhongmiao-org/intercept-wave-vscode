// Wildcard path matcher for mock API selection
// Supports:
// - *  : single-segment wildcard (matches exactly one path segment)
// - ** : multi-segment wildcard (matches one or more segments)
// Priority: exact > fewer wildcards > method-specific (!ALL) > longer pattern

export interface MatchResult {
    matched: boolean;
    exact: boolean; // no wildcards in pattern
    wildcardCount: number; // number of wildcard tokens (* or **)
    patternLength: number; // pattern string length for tie-breaker
}

export interface MinimalMockApi {
    path: string;
    method: string; // 'ALL' or HTTP verb
    enabled?: boolean;
}

function normalizePath(p: string): string {
    if (!p) return '/';
    // Ensure starts with '/'
    if (!p.startsWith('/')) p = '/' + p;
    // Remove query
    p = p.split('?')[0];
    // Collapse multiple slashes and remove trailing slash (except root)
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
                // Single segment wildcard: must consume exactly one segment
                pi += 1;
                ti += 1;
                continue;
            }
            if (ps === '**') {
                // Multi segment wildcard: must consume one or more segments
                // Try consuming k >= 1 segments and recurse
                const remainingPattern = pSegs.length - (pi + 1); // excluding this **
                for (let k = 1; ti + k <= tSegs.length - remainingPattern; k++) {
                    if (matchAt(pi + 1, ti + k)) return true;
                }
                return false;
            }
            // Literal segment
            if (ps !== ts) return false;
            pi += 1;
            ti += 1;
        }

        // If pattern remains
        if (pi < pSegs.length) {
            // Only acceptable remaining pattern is a single trailing '**' that must match >=1 seg
            if (pi === pSegs.length - 1 && pSegs[pi] === '**') {
                // Needs at least one remaining segment
                return ti < tSegs.length;
            }
            return false;
        }

        // Pattern consumed; path must also be fully consumed
        return ti === tSegs.length;
    }

    return {
        matched: matchAt(0, 0),
        exact,
        wildcardCount,
        patternLength,
    };
}

export function selectBestMockApiForRequest<T extends MinimalMockApi>(
    apis: T[],
    requestPath: string,
    method: string
): T | undefined {
    const reqPath = normalizePath(requestPath);
    const reqMethod = (method || 'GET').toUpperCase();

    type Candidate = T & MatchResult & { isMethodSpecific: boolean };
    const candidates: Candidate[] = [];

    for (const api of apis) {
        if (api.enabled === false) continue;
        const methodUpper = (api.method || 'ALL').toUpperCase();
        if (!(methodUpper === 'ALL' || methodUpper === reqMethod)) continue;

        const m = matchPathPattern(api.path, reqPath);
        if (!m.matched) continue;

        candidates.push({
            ...api,
            ...m,
            isMethodSpecific: methodUpper !== 'ALL' && methodUpper === reqMethod,
        });
    }

    if (candidates.length === 0) return undefined;

    candidates.sort((a, b) => {
        // 1) Exact match first
        if (a.exact !== b.exact) return a.exact ? -1 : 1;
        // 2) Fewer wildcards
        if (a.wildcardCount !== b.wildcardCount) return a.wildcardCount - b.wildcardCount;
        // 3) Method specificity (non-ALL first)
        if (a.isMethodSpecific !== b.isMethodSpecific)
            return a.isMethodSpecific ? -1 : 1;
        // 4) Longer pattern
        if (a.patternLength !== b.patternLength) return b.patternLength - a.patternLength;
        return 0;
    });

    return candidates[0];
}

