import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import type { ProxyGroup } from '../interfaces';

export function getHttpGroupScheme(group: ProxyGroup): 'http' | 'https' {
    return group.httpsEnabled === true ? 'https' : 'http';
}

export function getHttpGroupUrl(group: ProxyGroup): string {
    return `${getHttpGroupScheme(group)}://localhost:${group.port}`;
}

export function resolveHttpsKeystorePath(value: string | undefined, workspaceRoot: string): string | undefined {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed) return undefined;
    return path.resolve(path.isAbsolute(trimmed) ? trimmed : path.join(workspaceRoot, trimmed));
}

export function createHttpsServerOptions(group: ProxyGroup, workspaceRoot: string): https.ServerOptions {
    const keystorePath = resolveHttpsKeystorePath(group.httpsKeystorePath, workspaceRoot);
    if (!keystorePath) {
        throw new Error('HTTPS keystore path is not configured');
    }
    if (!fs.existsSync(keystorePath) || !fs.statSync(keystorePath).isFile()) {
        throw new Error(`HTTPS keystore file does not exist: ${keystorePath}`);
    }
    if (!group.httpsKeystorePassword) {
        throw new Error('HTTPS keystore password is not configured');
    }

    try {
        return {
            pfx: fs.readFileSync(keystorePath),
            passphrase: group.httpsKeystorePassword,
        };
    } catch (error: any) {
        throw new Error(`Failed to load HTTPS PKCS#12 keystore: ${error?.message || error}`);
    }
}
