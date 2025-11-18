import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as vscode from 'vscode';
import type { ProxyGroup, WsRule, WsManualTarget } from './types';

// Lazy require to avoid hard dependency at type-check time.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const wsLib: any = (() => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require('ws');
    } catch {
        return null;
    }
})();

type WebSocket = any;
type WebSocketServer = any;

interface WsConnectionContext {
    id: string;
    groupId: string;
    createdAt: number;
    lastActivityAt: number;
    socket: WebSocket;
    upstream?: WebSocket;
}

interface WsServerEntry {
    server: WebSocketServer;
    connections: Map<string, WsConnectionContext>;
}

export class WsServerManager {
    private readonly servers: Map<string, WsServerEntry> = new Map(); // groupId -> WS server

    constructor(private readonly outputChannel: vscode.OutputChannel) {}

    getGroupStatus(groupId: string): boolean {
        return this.servers.has(groupId);
    }

    async startGroup(group: ProxyGroup): Promise<void> {
        if (this.servers.has(group.id)) {
            return;
        }

        const isWss = !!group.wssEnabled;
        const port = group.port;
        const path = group.wsInterceptPrefix || '/';

        return new Promise((resolve, reject) => {
            try {
                if (!wsLib) {
                    this.outputChannel.appendLine(
                        `❌ [WS:${group.name}] ws library not available; WS server not started`
                    );
                    resolve();
                    return;
                }

                let server: WebSocketServer;
                if (isWss) {
                    const tlsOptions: https.ServerOptions = {};
                    // If keystore info is available, try to configure basic TLS.
                    // For now we keep it minimal and rely on Node key/cert files when present.
                    if (group.wssKeystorePath && fs.existsSync(group.wssKeystorePath)) {
                        try {
                            const pfx = fs.readFileSync(group.wssKeystorePath);
                            tlsOptions.pfx = pfx;
                            if (group.wssKeystorePassword) {
                                tlsOptions.passphrase = group.wssKeystorePassword;
                            }
                        } catch (e: any) {
                            this.outputChannel.appendLine(
                                `❌ [WS:${group.name}] Failed to load WSS keystore: ${e?.message ?? e}`
                            );
                        }
                    }
                    const httpsServer = https.createServer(tlsOptions);
                    server = new wsLib.WebSocketServer({ server: httpsServer, path });
                    httpsServer.listen(port, () => {
                        this.outputChannel.appendLine(
                            `✅ [WS:${group.name}] WSS server started on wss://localhost:${port}${path}`
                        );
                    });
                } else {
                    server = new wsLib.WebSocketServer({ port, path });
                    server.on('listening', () => {
                        this.outputChannel.appendLine(
                            `✅ [WS:${group.name}] WS server started on ws://localhost:${port}${path}`
                        );
                    });
                }

                const entry: WsServerEntry = {
                    server,
                    connections: new Map<string, WsConnectionContext>(),
                };

                server.on('connection', (socket, req) => {
                    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
                    const ctx: WsConnectionContext = {
                        id,
                        groupId: group.id,
                        createdAt: Date.now(),
                        lastActivityAt: Date.now(),
                        socket,
                    };
                    entry.connections.set(id, ctx);
                    this.outputChannel.appendLine(
                        `📡 [WS:${group.name}] CONNECT id=${id} path=${req.url}`
                    );

                    // Optional upstream connection if wsBaseUrl is configured
                    if (group.wsBaseUrl && wsLib) {
                        try {
                            const upstream = new wsLib.WebSocket(group.wsBaseUrl);
                            ctx.upstream = upstream;
                            upstream.on('open', () => {
                                this.outputChannel.appendLine(
                                    `🔗 [WS:${group.name}] Upstream connected for id=${id} -> ${group.wsBaseUrl}`
                                );
                            });
                            upstream.on('message', data => {
                                ctx.lastActivityAt = Date.now();
                                this.outputChannel.appendLine(
                                    `📥 [WS:${group.name}] INBOUND from upstream id=${id} bytes=${(data as Buffer).length ?? 0}`
                                );
                                if (socket.readyState === WebSocket.OPEN) {
                                    socket.send(data);
                                }
                            });
                            upstream.on('close', (code, reason) => {
                                this.outputChannel.appendLine(
                                    `🔌 [WS:${group.name}] Upstream closed for id=${id} code=${code} reason=${reason.toString()}`
                                );
                            });
                            upstream.on('error', err => {
                                this.outputChannel.appendLine(
                                    `❌ [WS:${group.name}] Upstream error for id=${id}: ${(err as any)?.message ?? err}`
                                );
                            });
                        } catch (e: any) {
                            this.outputChannel.appendLine(
                                `❌ [WS:${group.name}] Failed to connect upstream for id=${id}: ${e?.message ?? e}`
                            );
                        }
                    }

                    socket.on('message', data => {
                        ctx.lastActivityAt = Date.now();
                        const bytes = (data as Buffer).length ?? 0;
                        this.outputChannel.appendLine(
                            `📥 [WS:${group.name}] INBOUND id=${id} bytes=${bytes}`
                        );

                        // Basic forwarding when upstream exists and no rules intercept
                        if (ctx.upstream && ctx.upstream.readyState === WebSocket.OPEN) {
                            ctx.upstream.send(data);
                            this.outputChannel.appendLine(
                                `📤 [WS:${group.name}] FORWARD → upstream id=${id} bytes=${bytes}`
                            );
                        }
                    });

                    socket.on('close', (code, reason) => {
                        entry.connections.delete(id);
                        this.outputChannel.appendLine(
                            `🔌 [WS:${group.name}] CLOSE id=${id} code=${code} reason=${reason.toString()}`
                        );
                        if (ctx.upstream && ctx.upstream.readyState === WebSocket.OPEN) {
                            ctx.upstream.close();
                        }
                    });

                    socket.on('error', err => {
                        this.outputChannel.appendLine(
                            `❌ [WS:${group.name}] ERROR id=${id}: ${(err as any)?.message ?? err}`
                        );
                    });
                });

                server.on('error', error => {
                    this.outputChannel.appendLine(
                        `❌ [WS:${group.name}] Server error: ${(error as any)?.message ?? error}`
                    );
                    reject(error);
                });

                server.on('listening', () => {
                    this.servers.set(group.id, entry);
                    resolve();
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    async stopGroup(groupId: string): Promise<void> {
        const entry = this.servers.get(groupId);
        if (!entry) return;
        await new Promise<void>(resolve => {
            entry.server.close(() => {
                resolve();
            });
            entry.connections.forEach(conn => {
                try {
                    conn.socket.close();
                } catch {
                    // ignore
                }
                if (conn.upstream && conn.upstream.readyState === WebSocket.OPEN) {
                    try {
                        conn.upstream.close();
                    } catch {
                        // ignore
                    }
                }
            });
        });
        this.servers.delete(groupId);
    }

    async stopAll(): Promise<void> {
        const ids = Array.from(this.servers.keys());
        await Promise.all(ids.map(id => this.stopGroup(id)));
    }

    // Placeholder for future rule-driven push; will be wired in WS-05.
    // The exact WsRule shape will be aligned with the Kotlin project.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async manualPushByRule(groupId: string, rule: WsRule, target: WsManualTarget): Promise<void> {
        const entry = this.servers.get(groupId);
        if (!entry) return;
        const targets = Array.from(entry.connections.values());
        if (targets.length === 0) return;

        let selected: WsConnectionContext[];
        if (target === 'recent') {
            const latest = targets.reduce((acc, c) => (c.lastActivityAt > acc.lastActivityAt ? c : acc), targets[0]);
            selected = [latest];
        } else {
            selected = targets;
        }

        const payload = rule.message ?? '';
        for (const conn of selected) {
            if (conn.socket.readyState === WebSocket.OPEN) {
                conn.socket.send(payload);
                this.outputChannel.appendLine(
                    `📤 [WS:${groupId}] MANUAL PUSH path=${rule.path} conn=${conn.id} bytes=${payload.length}`
                );
            }
        }
    }

    async manualPushCustom(groupId: string, payload: string, target: WsManualTarget): Promise<void> {
        const entry = this.servers.get(groupId);
        if (!entry) return;
        const targets = Array.from(entry.connections.values());
        if (targets.length === 0) return;

        let selected: WsConnectionContext[];
        if (target === 'recent') {
            const latest = targets.reduce((acc, c) => (c.lastActivityAt > acc.lastActivityAt ? c : acc), targets[0]);
            selected = [latest];
        } else {
            // TODO: when we have richer connection metadata, implement real "match" filtering.
            selected = targets;
        }

        const bytes = payload.length;
        for (const conn of selected) {
            if (conn.socket.readyState === WebSocket.OPEN) {
                conn.socket.send(payload);
                this.outputChannel.appendLine(
                    `📤 [WS:${groupId}] MANUAL CUSTOM PUSH conn=${conn.id} bytes=${bytes}`
                );
            }
        }
    }
}
