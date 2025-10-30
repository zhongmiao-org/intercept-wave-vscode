/**
 * Shared JSON utilities: tolerant parsing and compact/pretty stringifying.
 * Intended to be used by both Webview and extension host sides.
 */

export function stripComments(input: string): string {
    let out = '';
    let i = 0;
    let inSingle = false,
        inDouble = false,
        inTemplate = false,
        inLineComment = false,
        inBlockComment = false;
    while (i < input.length) {
        const ch = input[i];
        const next = input[i + 1];
        if (inLineComment) {
            if (ch === '\n') {
                inLineComment = false;
                out += ch;
            }
            i++;
            continue;
        }
        if (inBlockComment) {
            if (ch === '*' && next === '/') {
                inBlockComment = false;
                i += 2;
                continue;
            }
            i++;
            continue;
        }
        if (!inSingle && !inDouble && !inTemplate) {
            if (ch === '/' && next === '/') {
                inLineComment = true;
                i += 2;
                continue;
            }
            if (ch === '/' && next === '*') {
                inBlockComment = true;
                i += 2;
                continue;
            }
        }
        if (!inDouble && !inTemplate && ch === "'" && input[i - 1] !== '\\') {
            inSingle = !inSingle;
            out += ch;
            i++;
            continue;
        }
        if (!inSingle && !inTemplate && ch === '"' && input[i - 1] !== '\\') {
            inDouble = !inDouble;
            out += ch;
            i++;
            continue;
        }
        if (!inSingle && !inDouble && ch === '`' && input[i - 1] !== '\\') {
            inTemplate = !inTemplate;
            out += ch;
            i++;
            continue;
        }
        out += ch;
        i++;
    }
    return out;
}

export function removeTrailingCommas(input: string): string {
    return input.replace(/,\s*(?=[}\]])/g, '');
}

export function quoteUnquotedKeys(input: string): string {
    return input.replace(/([,{]\s*)([A-Za-z_$][\w$-]*)(\s*):/g, (m, p1, key, p3) => {
        if (key.startsWith('"') || key.startsWith("'")) return m;
        return `${p1}"${key}"${p3}:`;
    });
}

export function convertSingleQuotedStrings(input: string): string {
    return input.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_m, inner) => {
        let content = String(inner);
        content = content.replace(/\\'/g, "'");
        content = content.replace(/\\/g, '\\\\');
        content = content.replace(/"/g, '\\"');
        return `"${content}"`;
    });
}

export function tryParseStrict<T = any>(raw: string): T | undefined {
    try {
        return JSON.parse(raw) as T;
    } catch {
        return undefined;
    }
}

export function parseJsonTolerant<T = any>(raw: string): T {
    const text = (raw ?? '').trim();
    if (!text) throw new Error('Empty JSON');
    const strict = tryParseStrict<T>(text);
    if (strict !== undefined) return strict;
    let s = stripComments(text);
    s = convertSingleQuotedStrings(s);
    s = quoteUnquotedKeys(s);
    s = removeTrailingCommas(s);
    return JSON.parse(s) as T;
}

export function stringifyCompact(value: any): string {
    return JSON.stringify(value);
}

export function stringifyPretty(value: any, space = 2): string {
    return JSON.stringify(value, null, space);
}

