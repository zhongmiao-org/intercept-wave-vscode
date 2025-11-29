import * as https from 'https';
import * as fs from 'fs';
import * as vscode from 'vscode';
import type { ProxyGroup, WsRule } from '../interfaces';
import type { WsManualTarget } from '../types';
import { matchPathPattern } from './pathMatcher';

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

// ReadyState constant for "OPEN" in ws library (1).
const WS_OPEN_STATE = 1;

interface WsMessageEvalResult {
    intercepted: boolean;
    matchedRules: WsRule[];
    interceptRules: WsRule[];
}

interface WsConnectionContext {
    id: string;
    groupId: string;
    path: string;
    createdAt: number;
    lastActivityAt: number;
    socket: WebSocket;
    upstream?: WebSocket;
    /**
     * Messages received from client while upstream is still connecting.
     * These will be flushed once the upstream WebSocket moves to OPEN.
     */
    pendingToUpstream?: string[];
    timers: NodeJS.Timeout[];
    lastInEvent?: { key: string; value: unknown };
    lastOutEvent?: { key: string; value: unknown };
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

        // WSS(TLS) 暂不支持，这里强制仅使用 WS。
        const isWss = false;
        const port = group.port;
        const path = this.normalizeWsPath(group.wsInterceptPrefix);

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

                            tlsOptions.pfx = fs.readFileSync(group.wssKeystorePath);
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
                    // Note: we no longer restrict by `path` at the ws library level,
                    // so that prefixes like `/ws` can still accept `/ws/echo` etc.
                    server = new wsLib.WebSocketServer({ server: httpsServer });
                    httpsServer.listen(port, () => {
                        this.outputChannel.appendLine(
                            `✅ [WS:${group.name}] WSS server started on wss://localhost:${port}${path}`
                        );
                    });
                } else {
                    // Do not pass `path` to allow all request paths on this port.
                    server = new wsLib.WebSocketServer({ port });
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
                    const url = req.url || '/';
                    const rawPath = url.split('?')[0] || '/';
                    // Apply WS 拦截前缀与 stripPrefix 语义，得到用于规则匹配的路径。
                    const effectivePath = this.getEffectiveWsPath(rawPath, group);
                    const ctx: WsConnectionContext = {
                        id,
                        groupId: group.id,
                        path: effectivePath,
                        createdAt: Date.now(),
                        lastActivityAt: Date.now(),
                        socket,
                        pendingToUpstream: [],
                        timers: [],
                    };
                    entry.connections.set(id, ctx);
                    this.outputChannel.appendLine(
                        `📡 [WS:${group.name}] CONNECT id=${id} path=${req.url}`
                    );

                    // Schedule initial rules for this connection (periodic/timeline/onOpenFire)
                    this.scheduleRulesForConnection(ctx, group);

                    // Optional upstream connection if wsBaseUrl is configured
                    if (group.wsBaseUrl && wsLib) {
                        try {
                            // Mirror HTTP behavior: forward to `${wsBaseUrl}${req.url}`
                            const targetUrl = `${group.wsBaseUrl}${url || '/'}`;
                            const upstream = new wsLib.WebSocket(targetUrl);
                            ctx.upstream = upstream;
                            upstream.on('open', () => {
                                this.outputChannel.appendLine(
                                    `🔗 [WS:${group.name}] Upstream connected for id=${id} -> ${targetUrl}`
                                );

                                // Flush any messages that were sent by the client while upstream was still connecting.
                                const queue = ctx.pendingToUpstream || [];
                                if (queue.length > 0) {
                                    for (const payload of queue) {
                                        if (upstream.readyState !== WS_OPEN_STATE) {
                                            break;
                                        }
                                        upstream.send(payload);
                                        const bytes = Buffer.byteLength(payload, 'utf-8');
                                        this.outputChannel.appendLine(
                                            `📤 [WS:${group.name}] FORWARD(queue) → upstream id=${id} bytes=${bytes}`
                                        );
                                    }
                                    ctx.pendingToUpstream = [];
                                }
                            });
                            upstream.on('message', data => {
                                ctx.lastActivityAt = Date.now();
                                // 上游返回也统一按 UTF-8 文本解析，便于规则匹配与日志。
                                const text = typeof data === 'string'
                                    ? data
                                    : this.safeBufferToString(data as Buffer);
                                const bytes = Buffer.byteLength(text, 'utf-8');

                                // 上游 → 客户端：方向语义与 Kotlin 版保持一致（direction='in'）。
                                const result = this.handleInboundOrOutboundMessage(
                                    group,
                                    ctx,
                                    'in',
                                    text,
                                    bytes,
                                    'upstream'
                                );

                                // 对前端统一发送文本帧，保持与直连一致。
                                if (!result.intercepted && socket.readyState === WS_OPEN_STATE) {
                                    socket.send(text);
                                    this.outputChannel.appendLine(
                                        `📤 [WS:${group.name}] FORWARD ← upstream id=${id} bytes=${bytes}`
                                    );
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
                        // 对 WS 组统一按 UTF-8 文本处理消息，保持与直连一致的行为。
                        const text = typeof data === 'string'
                            ? data
                            : this.safeBufferToString(data as Buffer);
                        const bytes = Buffer.byteLength(text, 'utf-8');

                        // 客户端 → 上游：direction='out'（与 Kotlin 版保持一致）。
                        const result = this.handleInboundOrOutboundMessage(
                            group,
                            ctx,
                            'out',
                            text,
                            bytes,
                            'client'
                        );

                        // 被拦截：不再转发到上游，并按兄弟项目行为立即推送匹配规则的 message（若非空）。
                        if (result.intercepted) {
                            const replyRule = result.interceptRules.find(
                                r => r.message.trim().length > 0
                            );
                            if (replyRule && socket.readyState === WS_OPEN_STATE) {
                                const payload = replyRule.message ?? '';
                                socket.send(payload);
                                const replyBytes = Buffer.byteLength(payload, 'utf-8');
                                this.trackOutboundEvent(ctx, replyRule, payload);
                                this.outputChannel.appendLine(
                                    `📤 [WS:${group.name}] AUTO intercept reply path=${replyRule.path} conn=${id} bytes=${replyBytes}`
                                );
                            }
                            return;
                        }

                        // 未命中拦截规则：对上游统一发送文本帧，适配 JSON/文本场景。
                        if (ctx.upstream) {
                            if (ctx.upstream.readyState === WS_OPEN_STATE) {
                                ctx.upstream.send(text);
                                this.outputChannel.appendLine(
                                    `📤 [WS:${group.name}] FORWARD → upstream id=${id} bytes=${bytes}`
                                );
                            } else {
                                // Upstream 还在 CONNECTING，先缓存在连接上下文中，待 open 后再发送。
                                if (!ctx.pendingToUpstream) {
                                    ctx.pendingToUpstream = [];
                                }
                                ctx.pendingToUpstream.push(text);
                                this.outputChannel.appendLine(
                                    `⏳ [WS:${group.name}] QUEUE → upstream id=${id} bytes=${bytes} (upstream not OPEN)`
                                );
                            }
                        }
                    });

                    socket.on('close', (code, reason) => {
                        entry.connections.delete(id);
                        this.clearConnectionTimers(ctx);
                        this.outputChannel.appendLine(
                            `🔌 [WS:${group.name}] CLOSE id=${id} code=${code} reason=${reason.toString()}`
                        );
                        if (ctx.upstream && ctx.upstream.readyState === WS_OPEN_STATE) {
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

    private normalizeWsPath(raw: string | null | undefined): string {
        if (!raw) {
            return '/';
        }
        let p = String(raw).trim();
        if (!p) return '/';
        if (!p.startsWith('/')) {
            p = '/' + p;
        }
        // collapse multiple slashes
        p = p.replace(/\/+/g, '/');
        return p;
    }

    /**
     * 根据 wsInterceptPrefix 与 stripPrefix 计算用于规则匹配的路径。
     *
     * - 先对原始路径做简单规范化（确保前导 /，去掉多余 / 与查询串）。
     * - 如果配置了 wsInterceptPrefix 且 stripPrefix=true，则在匹配到前缀时剥离前缀，
     *   使得规则可以使用相对路径（例如前缀 /ws + 真实路径 /ws/echo，对应规则 path=/echo）。
     */
    private getEffectiveWsPath(rawPath: string, group: ProxyGroup): string {
        const normalize = (p: string): string => {
            if (!p) return '/';
            let v = String(p).split('?')[0] || '/';
            if (!v.startsWith('/')) {
                v = '/' + v;
            }
            v = v.replace(/\/+/g, '/');
            // 保留末尾的 /，交由上游 matcher 处理；这里只做最小规范化。
            return v;
        };

        const path = normalize(rawPath);
        const prefixRaw = group.wsInterceptPrefix;
        if (!prefixRaw) {
            return path;
        }

        const prefix = normalize(prefixRaw).replace(/\/+$/, '') || '/';

        // 当 stripPrefix=true 且路径以 ws 前缀开头时，剥离该前缀用于规则匹配。
        if (group.stripPrefix && prefix !== '/' && path.startsWith(prefix)) {
            const rest = path.slice(prefix.length) || '/';
            return rest.startsWith('/') ? rest : '/' + rest;
        }

        return path;
    }

    async stopGroup(groupId: string): Promise<void> {
        const entry = this.servers.get(groupId);
        if (!entry) return;
        await new Promise<void>(resolve => {
            entry.server.close(() => {
                resolve();
            });
            entry.connections.forEach(conn => {
                this.clearConnectionTimers(conn);
                try {
                    conn.socket.close();
                } catch {
                    // ignore
                }
                if (conn.upstream && conn.upstream.readyState === WS_OPEN_STATE) {
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

    async manualPushByRule(
        groupId: string,
        rule: WsRule,
        target: WsManualTarget,
        allRules?: WsRule[]
    ): Promise<boolean> {
        const entry = this.servers.get(groupId);
        if (!entry) return false;
        const targets = Array.from(entry.connections.values());
        if (targets.length === 0) return false;

        // 对于 match 目标，仅按当前选中 rule 进行匹配；
        // 其它目标仍然可以基于完整规则集筛选连接。
        const rulesForSelection =
            target === 'match' && rule
                ? [rule]
                : allRules && allRules.length > 0
                ? allRules
                : rule
                ? [rule]
                : [];

        const selected = this.selectConnections(entry, target, rule, rulesForSelection);
        if (!selected.length) return false;

        const payload = rule.message ?? '';
        let sent = 0;
        for (const conn of selected) {
            this.resetAndRescheduleForConnection(conn, allRules);
            if (conn.socket.readyState === WS_OPEN_STATE) {
                conn.socket.send(payload);
                const bytes = payload.length;
                this.trackOutboundEvent(conn, rule, payload);
                this.outputChannel.appendLine(
                    `📤 [WS:${groupId}] MANUAL PUSH path=${rule.path} conn=${conn.id} bytes=${bytes}`
                );
                sent++;
            }
        }
        return sent > 0;
    }

    async manualPushCustom(
        groupId: string,
        payload: string,
        target: WsManualTarget,
        allRules?: WsRule[]
    ): Promise<boolean> {
        const entry = this.servers.get(groupId);
        if (!entry) return false;
        const targets = Array.from(entry.connections.values());
        if (targets.length === 0) return false;

        const selected = this.selectConnections(entry, target, undefined, allRules);
        if (!selected.length) return false;

        const bytes = payload.length;
        let sent = 0;
        for (const conn of selected) {
            this.resetAndRescheduleForConnection(conn, allRules);
            if (conn.socket.readyState === WS_OPEN_STATE) {
                conn.socket.send(payload);
                this.trackOutboundCustomEvent(conn, payload);
                this.outputChannel.appendLine(
                    `📤 [WS:${groupId}] MANUAL CUSTOM PUSH conn=${conn.id} bytes=${bytes}`
                );
                sent++;
            }
        }
        return sent > 0;
    }

    private safeBufferToString(buf: Buffer | undefined): string {
        if (!buf) return '';
        try {
            return buf.toString('utf-8');
        } catch {
            return '';
        }
    }

    private parseJson(text: string): any | undefined {
        if (!text) return undefined;
        try {
            return JSON.parse(text);
        } catch {
            return undefined;
        }
    }

    private handleInboundOrOutboundMessage(
        group: ProxyGroup,
        ctx: WsConnectionContext,
        direction: 'in' | 'out',
        text: string,
        bytes: number,
        source: 'client' | 'upstream'
    ): WsMessageEvalResult {
        const rules = group.wsPushRules || [];
        if (!rules.length) {
            this.outputChannel.appendLine(
                `📥 [WS:${group.name}] ${direction.toUpperCase()} id=${ctx.id} bytes=${bytes} (no rules)`
            );
            return { intercepted: false, matchedRules: [], interceptRules: [] };
        }

        const json = this.parseJson(text);
        const eventKeyCandidates: Array<{ key: string; value: unknown }> = [];
        if (json && typeof json === 'object') {
            for (const key of Object.keys(json)) {
                eventKeyCandidates.push({ key, value: (json as any)[key] });
            }
        }

        if (direction === 'in') {
            if (eventKeyCandidates.length > 0) {
                ctx.lastInEvent = eventKeyCandidates[0];
            }
        } else {
            if (eventKeyCandidates.length > 0) {
                ctx.lastOutEvent = eventKeyCandidates[0];
            }
        }

        const matchedRules = rules.filter(r =>
            this.matchesRuleForMessage(ctx, r, direction, eventKeyCandidates)
        );

        const interceptRules = matchedRules.filter(r => r.intercept);
        const hasIntercept = interceptRules.length > 0;

        this.outputChannel.appendLine(
            `📥 [WS:${group.name}] ${direction.toUpperCase()} id=${ctx.id} bytes=${bytes} matchedRules=${matchedRules.length} intercepted=${hasIntercept}`
        );

        // 命中拦截规则时，阻断该方向的真实流量转发。
        if (hasIntercept) {
            this.outputChannel.appendLine(
                `🛑 [WS:${group.name}] INTERCEPT(id=${ctx.id}, direction=${direction}, source=${source})`
            );
        }

        return { intercepted: hasIntercept, matchedRules, interceptRules };
    }

    private matchesRuleForMessage(
        ctx: WsConnectionContext,
        rule: WsRule,
        direction: 'in' | 'out',
        events: Array<{ key: string; value: unknown }>
    ): boolean {
        if (!rule || !rule.enabled) return false;
        if (!rule.path) return false;
        const m = matchPathPattern(rule.path, ctx.path || '/');
        if (!m.matched) return false;

        if (rule.direction === 'in' && direction === 'out') return false;
        if (rule.direction === 'out' && direction === 'in') return false;

        if (!rule.eventKey) {
            return true;
        }

        const candidate = events.find(e => e.key === rule.eventKey);
        if (!candidate) return false;
        if (rule.eventValue === undefined || rule.eventValue === null) {
            return true;
        }
        return String(candidate.value) === String(rule.eventValue);
    }

    private clearConnectionTimers(ctx: WsConnectionContext): void {
        if (!ctx.timers) return;
        for (const t of ctx.timers) {
            try {
                clearTimeout(t);
            } catch {
                // ignore
            }
        }
        ctx.timers = [];
    }

    private scheduleRulesForConnection(ctx: WsConnectionContext, group: ProxyGroup): void {
        const rules = group.wsPushRules || [];
        if (!rules.length) return;
        for (const rule of rules) {
            if (!rule.enabled || !rule.message) continue;
            if (rule.mode === 'periodic') {
                this.schedulePeriodic(ctx, rule, group);
            } else if (rule.mode === 'timeline') {
                this.scheduleTimeline(ctx, rule, group);
            }
        }
    }

    private schedulePeriodic(ctx: WsConnectionContext, rule: WsRule, group: ProxyGroup): void {
        const periodSec = rule.periodSec ?? 0;
        if (periodSec <= 0) {
            this.outputChannel.appendLine(
                `⚠️ [WS:${group.name}] periodic rule has invalid periodSec (${periodSec}); skip`
            );
            return;
        }
        const intervalMs = periodSec * 1000;

        const sendOnce = () => {
            if (ctx.socket.readyState !== WS_OPEN_STATE) return;
            const payload = rule.message ?? '';
            ctx.socket.send(payload);
            const bytes = payload.length;
            this.trackOutboundEvent(ctx, rule, payload);
            this.outputChannel.appendLine(
                `📤 [WS:${group.name}] AUTO periodic rule path=${rule.path} conn=${ctx.id} bytes=${bytes}`
            );
        };

        if (rule.onOpenFire) {
            sendOnce();
        }

        const timer = setInterval(() => {
            sendOnce();
        }, intervalMs);
        ctx.timers.push(timer);
    }

    private scheduleTimeline(ctx: WsConnectionContext, rule: WsRule, group: ProxyGroup): void {
        // Support both legacy numeric timeline (seconds) and new object-based timeline (milliseconds + message)
        const raw = rule.timeline;
        let items: Array<{ atMs: number; message: string }> = [];

        if (Array.isArray(raw) && raw.length > 0) {
            const first: any = raw[0] as any;
            if (typeof first === 'number') {
                // Legacy: number[] interpreted as seconds; use rule.message as payload
                const legacy = raw as unknown as number[];
                items = legacy
                    .filter(sec => sec >= 0)
                    .map(sec => ({ atMs: sec * 1000, message: rule.message ?? '' }));
            } else if (typeof first === 'object' && first && 'atMs' in first) {
                const asItems = raw as unknown as Array<{ atMs: unknown; message: unknown }>;
                items = asItems
                    .map(it => ({
                        atMs: typeof it.atMs === 'number' ? it.atMs : 0,
                        message: typeof it.message === 'string' ? it.message : (rule.message ?? ''),
                    }))
                    .filter(it => it.atMs >= 0);
            }
        }

        if (!items.length) return;

        // Sort by time ascending
        items.sort((a, b) => a.atMs - b.atMs);

        const scheduleSeries = () => {
            for (const item of items) {
                const delayMs = item.atMs;
                const timer = setTimeout(() => {
                    if (ctx.socket.readyState !== WS_OPEN_STATE) return;
                    const payload = item.message ?? rule.message ?? '';
                    if (!payload) return;
                    ctx.socket.send(payload);
                    const bytes = payload.length;
                    this.trackOutboundEvent(ctx, rule, payload);
                    this.outputChannel.appendLine(
                        `📤 [WS:${group.name}] AUTO timeline rule path=${rule.path} conn=${ctx.id} at=${delayMs}ms bytes=${bytes}`
                    );
                }, delayMs);
                ctx.timers.push(timer);
            }
        };

        if (rule.onOpenFire) {
            if (ctx.socket.readyState === WS_OPEN_STATE) {
                const payload = rule.message ?? '';
                if (payload) {
                    ctx.socket.send(payload);
                    const bytes = payload.length;
                    this.trackOutboundEvent(ctx, rule, payload);
                    this.outputChannel.appendLine(
                        `📤 [WS:${group.name}] AUTO timeline(onOpen) path=${rule.path} conn=${ctx.id} bytes=${bytes}`
                    );
                }
            }
        }

        scheduleSeries();

        if (rule.loop) {
            const totalMs = items[items.length - 1]?.atMs ?? 0;
            if (totalMs > 0) {
                const loopTimer = setInterval(() => {
                    scheduleSeries();
                }, totalMs);
                ctx.timers.push(loopTimer);
            }
        }
    }

    private selectConnections(
        entry: WsServerEntry,
        target: WsManualTarget,
        rule?: WsRule,
        allRules?: WsRule[]
    ): WsConnectionContext[] {
        const all = Array.from(entry.connections.values());
        if (!all.length) return [];

        if (target === 'recent') {
            const latest = all.reduce(
                (acc, c) => (c.lastActivityAt > acc.lastActivityAt ? c : acc),
                all[0]
            );
            return [latest];
        }

        if (target === 'all') {
            return all;
        }

        const rules = allRules || (rule ? [rule] : []);
        if (!rules.length) return all;

        return all.filter(conn =>
            rules.some(r => this.matchesRuleForConnection(conn, r))
        );
    }

    private matchesRuleForConnection(conn: WsConnectionContext, rule: WsRule): boolean {
        if (!rule || !rule.enabled) return false;
        if (!rule.path) return false;
        const m = matchPathPattern(rule.path, conn.path || '/');
        if (!m.matched) return false;

        if (!rule.eventKey) return true;

        const events: Array<{ key: string; value: unknown }> = [];
        if (conn.lastInEvent) events.push(conn.lastInEvent);
        if (conn.lastOutEvent) events.push(conn.lastOutEvent);

        const candidate = events.find(e => e.key === rule.eventKey);
        if (!candidate) return false;
        if (rule.eventValue === undefined || rule.eventValue === null) return true;
        return String(candidate.value) === String(rule.eventValue);
    }

    private resetAndRescheduleForConnection(
        conn: WsConnectionContext,
        allRules?: WsRule[]
    ): void {
        this.clearConnectionTimers(conn);
        if (!allRules || !allRules.length) return;
        const pseudoGroup: ProxyGroup = {
            id: conn.groupId,
            name: conn.groupId,
            port: 0,
            interceptPrefix: '',
            baseUrl: '',
            stripPrefix: true,
            globalCookie: '',
            enabled: true,
            mockApis: [],
            wsPushRules: allRules,
        };
        this.scheduleRulesForConnection(conn, pseudoGroup);
    }

    private trackOutboundEvent(conn: WsConnectionContext, rule: WsRule, payload: string): void {
        const json = this.parseJson(payload);
        if (!json || typeof json !== 'object') return;
        const key = rule.eventKey;
        if (!key) {
            const firstKey = Object.keys(json)[0];
            if (!firstKey) return;
            conn.lastOutEvent = { key: firstKey, value: (json as any)[firstKey] };
            return;
        }
        if (Object.prototype.hasOwnProperty.call(json, key)) {
            conn.lastOutEvent = { key, value: (json as any)[key] };
        }
    }

    private trackOutboundCustomEvent(conn: WsConnectionContext, payload: string): void {
        const json = this.parseJson(payload);
        if (!json || typeof json !== 'object') return;
        const firstKey = Object.keys(json)[0];
        if (!firstKey) return;
        conn.lastOutEvent = { key: firstKey, value: (json as any)[firstKey] };
    }
}
