import * as http from 'http';
import * as net from 'net';
import WebSocket from 'ws';
import type { MockConfig, ProxyGroup, WsRule } from '../../../common';
import { MockServerManager } from '../../../common';

const DEFAULT_HTTP_BASE = process.env.IW_UPSTREAM_HTTP || 'http://localhost:9000';
const DEFAULT_WS_BASE = process.env.IW_UPSTREAM_WS || 'ws://localhost:9003';
export const UPSTREAM_TOKEN = 'zhongmiao-org-token';

export interface TestOutputChannel {
    appendLine: (value: string) => void;
    show: (_preserveFocus?: boolean) => void;
    logs: string[];
}

export function createOutputChannel(): TestOutputChannel {
    const logs: string[] = [];
    return {
        logs,
        appendLine: (value: string) => {
            logs.push(value);
        },
        show: () => undefined,
    };
}

export function createHttpGroup(overrides: Partial<ProxyGroup> = {}): ProxyGroup {
    return {
        id: 'http-group',
        name: 'HTTP Integration Group',
        port: 0,
        interceptPrefix: '/api',
        baseUrl: DEFAULT_HTTP_BASE,
        stripPrefix: true,
        globalCookie: '',
        enabled: true,
        mockApis: [],
        ...overrides,
    };
}

export function createWsGroup(overrides: Partial<ProxyGroup> = {}): ProxyGroup {
    return {
        id: 'ws-group',
        name: 'WS Integration Group',
        port: 0,
        interceptPrefix: '/api',
        baseUrl: DEFAULT_HTTP_BASE,
        stripPrefix: true,
        globalCookie: '',
        enabled: true,
        mockApis: [],
        protocol: 'WS',
        wsBaseUrl: DEFAULT_WS_BASE,
        wsInterceptPrefix: '/bridge',
        wsManualPush: true,
        wsPushRules: [],
        wssEnabled: false,
        wssKeystorePath: null,
        wssKeystorePassword: null,
        ...overrides,
    };
}

export function createMockServerManager(
    groups: ProxyGroup[],
    outputChannel: TestOutputChannel
): MockServerManager {
    const config: MockConfig = {
        version: '2.0',
        proxyGroups: groups,
    };
    const configManager = {
        getConfig: () => config,
        saveConfig: () => undefined,
        addMockApi: () => undefined,
        removeMockApi: () => undefined,
        updateMockApi: () => undefined,
        getConfigPath: () => '',
    } as any;

    return new MockServerManager(configManager, outputChannel as any);
}

export function getUpstreamHttpBase(offset: number = 0): string {
    const url = new URL(DEFAULT_HTTP_BASE);
    const port = Number(url.port || 80) + offset;
    url.port = String(port);
    return url.toString().replace(/\/$/, '');
}

export function getUpstreamWsBase(offset: number = 0): string {
    const url = new URL(DEFAULT_WS_BASE);
    const port = Number(url.port || 80) + offset;
    url.port = String(port);
    return url.toString().replace(/\/$/, '');
}

export async function ensureHttpUpstreamAvailable(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const req = http.get(`${getUpstreamHttpBase()}/health`, res => {
            res.resume();
            if (res.statusCode === 200) {
                resolve();
                return;
            }
            reject(
                new Error(
                    `HTTP upstream health check failed with status ${res.statusCode}. Start it with: docker compose -f docker/docker-compose.upstream.yml up -d upstream`
                )
            );
        });
        req.on('error', error => {
            reject(
                new Error(
                    `HTTP upstream is unavailable (${error.message}). Start it with: docker compose -f docker/docker-compose.upstream.yml up -d upstream`
                )
            );
        });
    });
}

export async function ensureWsUpstreamAvailable(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`${getUpstreamWsBase()}/ws/echo?token=${UPSTREAM_TOKEN}`);
        const timer = setTimeout(() => {
            ws.terminate();
            reject(
                new Error(
                    'WS upstream probe timed out. Start it with: docker compose -f docker/docker-compose.upstream.yml up -d upstream'
                )
            );
        }, 3000);

        ws.once('open', () => {
            clearTimeout(timer);
            ws.close();
            resolve();
        });
        ws.once('error', error => {
            clearTimeout(timer);
            reject(
                new Error(
                    `WS upstream is unavailable (${error.message}). Start it with: docker compose -f docker/docker-compose.upstream.yml up -d upstream`
                )
            );
        });
    });
}

export async function getFreePort(): Promise<number> {
    return await new Promise<number>((resolve, reject) => {
        const server = net.createServer();
        server.listen(0, () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
                server.close(() => reject(new Error('Failed to allocate free port')));
                return;
            }
            const port = address.port;
            server.close(error => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(port);
            });
        });
        server.on('error', reject);
    });
}

export async function httpRequest(options: {
    method?: string;
    url: string;
    headers?: Record<string, string>;
    body?: string;
}): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
    return await new Promise((resolve, reject) => {
        const url = new URL(options.url);
        const req = http.request(
            {
                method: options.method || 'GET',
                hostname: url.hostname,
                port: url.port,
                path: `${url.pathname}${url.search}`,
                headers: options.headers,
            },
            res => {
                let body = '';
                res.setEncoding('utf8');
                res.on('data', chunk => {
                    body += chunk;
                });
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode || 0,
                        headers: res.headers,
                        body,
                    });
                });
            }
        );
        req.on('error', reject);
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

export async function openWebSocket(
    url: string
): Promise<{ ws: WebSocket; waitForMessage: (timeoutMs?: number) => Promise<string> }> {
    const ws = await new Promise<WebSocket>((resolve, reject) => {
        const client = new WebSocket(url);
        const timer = setTimeout(() => {
            client.terminate();
            reject(new Error(`Timed out connecting to ${url}`));
        }, 5000);

        client.once('open', () => {
            clearTimeout(timer);
            resolve(client);
        });
        client.once('error', error => {
            clearTimeout(timer);
            reject(error);
        });
    });

    const waitForMessage = async (timeoutMs: number = 5000): Promise<string> =>
        await new Promise<string>((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Timed out waiting for WebSocket message from ${url}`));
            }, timeoutMs);

            ws.once('message', data => {
                clearTimeout(timer);
                resolve(normalizeWsMessage(data));
            });
            ws.once('error', error => {
                clearTimeout(timer);
                reject(error);
            });
        });

    return { ws, waitForMessage };
}

function normalizeWsMessage(data: Buffer | ArrayBuffer | Buffer[]): string {
    if (Array.isArray(data)) {
        return Buffer.concat(data).toString('utf8');
    }
    if (data instanceof ArrayBuffer) {
        return Buffer.from(data).toString('utf8');
    }
    return data.toString('utf8');
}

export function createInterceptRule(overrides: Partial<WsRule> = {}): WsRule {
    return {
        enabled: true,
        path: '/ws/echo',
        eventKey: 'type',
        eventValue: 'ping',
        direction: 'out',
        intercept: true,
        mode: 'off',
        periodSec: 0,
        message: '{"type":"intercepted","source":"local-rule"}',
        timeline: [],
        loop: false,
        onOpenFire: false,
        ...overrides,
    };
}
