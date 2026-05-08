import * as http from 'http';
import { HeaderOverrideRule } from '../interfaces';

export const RESTRICTED_REQUEST_HEADERS = new Set([
    'host',
    'connection',
    'content-length',
    'date',
    'expect',
    'upgrade',
    'trailer',
    'te',
]);

export const RESTRICTED_RESPONSE_HEADERS = new Set([
    'transfer-encoding',
    'content-length',
    'connection',
]);

type HeaderMap = Record<string, string>;

function normalizeName(name: string): string {
    return name.trim();
}

function normalizeKey(name: string): string {
    return normalizeName(name).toLowerCase();
}

function headerValueToString(value: string | string[] | number | undefined): string {
    if (Array.isArray(value)) return value.join(', ');
    return value === undefined ? '' : String(value);
}

export function applyRequestHeaderOverrides(
    headers: http.IncomingHttpHeaders,
    rules: HeaderOverrideRule[] = []
): HeaderMap {
    const result: HeaderMap = {};
    const displayNames: Record<string, string> = {};

    Object.entries(headers).forEach(([name, value]) => {
        const key = normalizeKey(name);
        if (!key || RESTRICTED_REQUEST_HEADERS.has(key) || value === undefined) return;
        displayNames[key] = name;
        result[key] = headerValueToString(value);
    });

    rules
        .filter(rule => rule.enabled && normalizeName(rule.name))
        .forEach(rule => {
            const name = normalizeName(rule.name);
            const key = normalizeKey(name);
            if (RESTRICTED_REQUEST_HEADERS.has(key)) return;
            displayNames[key] = name;
            switch (rule.operation) {
                case 'ADD':
                    result[key] = result[key] ? `${result[key]}, ${rule.value}` : rule.value;
                    break;
                case 'REMOVE':
                    delete result[key];
                    delete displayNames[key];
                    break;
                case 'SET':
                default:
                    result[key] = rule.value;
                    break;
            }
        });

    return Object.fromEntries(Object.entries(result).map(([key, value]) => [displayNames[key] || key, value]));
}

export function applyResponseHeaderOverrides(
    res: http.ServerResponse,
    rules: HeaderOverrideRule[] = []
): void {
    rules
        .filter(rule => rule.enabled && normalizeName(rule.name))
        .forEach(rule => {
            const name = normalizeName(rule.name);
            const key = normalizeKey(name);
            if (RESTRICTED_RESPONSE_HEADERS.has(key)) return;
            switch (rule.operation) {
                case 'ADD': {
                    const current = headerValueToString(res.getHeader(name) as string | string[] | number | undefined);
                    res.setHeader(name, current ? `${current}, ${rule.value}` : rule.value);
                    break;
                }
                case 'REMOVE':
                    res.removeHeader(name);
                    break;
                case 'SET':
                default:
                    res.setHeader(name, rule.value);
                    break;
            }
        });
}
