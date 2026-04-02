import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import * as vscode from 'vscode';
import { ConfigManager } from '../config';
import { selectBestMockApiForRequest } from './pathMatcher';
import { HttpRoute, MockApiConfig, ProxyGroup, WsRule } from '../interfaces';
import { WsManualTarget } from '../types';
import { WsServerManager } from './wsServer';
import {
    computeHttpForwardPath,
    computeHttpMatchPath,
    selectHttpRoute,
    shouldServeRouteWelcomePage,
} from './httpRouteUtils';

export class MockServerManager {
    private readonly httpServers: Map<string, http.Server> = new Map(); // groupId -> HTTP server
    private readonly wsManager: WsServerManager;
    private isRunning: boolean = false;

    constructor(
        private readonly configManager: ConfigManager,
        private readonly outputChannel: vscode.OutputChannel
    ) {
        this.wsManager = new WsServerManager(outputChannel);
    }

    private getHttpRoutes(group: ProxyGroup): HttpRoute[] {
        if (Array.isArray(group.routes) && group.routes.length > 0) {
            return group.routes;
        }
        return [
            {
                id: `${group.id}-legacy-route`,
                name: 'API',
                pathPrefix: group.interceptPrefix || '/api',
                targetBaseUrl: group.baseUrl || 'http://localhost:8080',
                stripPrefix: group.stripPrefix,
                enableMock: true,
                mockApis: group.mockApis || [],
            },
        ];
    }

    async start(): Promise<string> {
        const config = this.configManager.getConfig();
        const enabledGroups = config.proxyGroups.filter(g => g.enabled);

        if (enabledGroups.length === 0) {
            throw new Error('No enabled proxy groups found');
        }

        // Filter out groups that are already running
        const groupsToStart = enabledGroups.filter(
            g => !this.httpServers.has(g.id) && !this.wsManager.getGroupStatus(g.id)
        );

        if (groupsToStart.length === 0) {
            throw new Error('All enabled servers are already running');
        }

        const results = await Promise.allSettled(
            groupsToStart.map(group => this.startGroup(group))
        );
        const succeeded: ProxyGroup[] = [];
        const failed: { group: ProxyGroup; error: any }[] = [];
        results.forEach((r, i) => {
            if (r.status === 'fulfilled') {
                succeeded.push(groupsToStart[i]);
            } else {
                failed.push({ group: groupsToStart[i], error: r.reason });
            }
        });

        if (succeeded.length > 0) {
            this.isRunning = true;
            const urls = succeeded
                .map(g => {
                    const isWs = (g as ProxyGroup).protocol === 'WS';
                    const scheme = isWs ? (g.wssEnabled ? 'wss' : 'ws') : 'http';
                    return `${scheme}://localhost:${g.port} (${g.name})`;
                })
                .join(', ');
            this.outputChannel.appendLine(`✅ Mock servers started: ${urls}`);
            if (failed.length > 0) {
                failed.forEach(f => this.outputChannel.appendLine(`❌ [${f.group.name}] failed to start: ${f.error?.message || f.error}`));
            }
            this.outputChannel.show(true);
            return urls;
        }

        // none succeeded
        const errorMsg = failed.map(f => `${f.group.name}(:${f.group.port}) - ${f.error?.message || f.error}`).join('; ');
        throw new Error(`Failed to start any server: ${errorMsg}`);
    }

    private async startGroup(group: ProxyGroup): Promise<void> {
        if (group.protocol === 'WS') {
            // Start WebSocket server for this group
            await this.wsManager.startGroup(group);
            return;
        }

        // HTTP group (default)
        return new Promise((resolve, reject) => {
            const server = http.createServer((req, res) => {
                // Read config on each request to support dynamic updates
                const currentConfig = this.configManager.getConfig();
                const currentGroup = currentConfig.proxyGroups.find(g => g.id === group.id);
                if (currentGroup && currentGroup.enabled) {
                    void this.handleRequest(req, res, currentGroup);
                } else {
                    this.sendErrorResponse(res, 503, 'Proxy group is disabled');
                }
            });

            server.listen(group.port, () => {
                this.httpServers.set(group.id, server);
                this.outputChannel.appendLine(
                    `✅ [${group.name}] started on http://localhost:${group.port}`
                );
                const routes = this.getHttpRoutes(group);
                this.outputChannel.appendLine(`   🧭 Routes: ${routes.length}`);
                this.outputChannel.appendLine(
                    `   📊 Mock APIs: ${routes.reduce((acc, route) => acc + route.mockApis.filter(api => api.enabled).length, 0)}/${routes.reduce((acc, route) => acc + route.mockApis.length, 0)} enabled`
                );
                resolve();
            });

            server.on('error', (error: any) => {
                this.outputChannel.appendLine(`❌ [${group.name}] Server error: ${error.message}`);
                reject(error);
            });
        });
    }

    async stop(): Promise<void> {
        // Check if there are any servers running
        if (this.httpServers.size === 0 && !this.hasAnyWsServer()) {
            return;
        }

        // Get config to retrieve group names
        const config = this.configManager.getConfig();

        const stopPromises = Array.from(this.httpServers.entries()).map(
            ([groupId, server]) =>
                new Promise<void>(resolve => {
                    server.close(() => {
                        // Find group name for logging
                        const group = config.proxyGroups.find(g => g.id === groupId);
                        const groupInfo = group ? `${group.name}(:${group.port})` : groupId;
                        this.outputChannel.appendLine(`🛑 Server stopped for group: ${groupInfo}`);
                        resolve();
                    });
                })
        );

        await Promise.all(stopPromises);
        this.httpServers.clear();
        await this.wsManager.stopAll();
        this.isRunning = false;
        this.outputChannel.appendLine('🛑 All mock servers stopped');
    }

    getStatus(): boolean {
        return this.isRunning;
    }

    getGroupStatus(groupId: string): boolean {
        return this.httpServers.has(groupId) || this.wsManager.getGroupStatus(groupId);
    }

    async manualPushByRule(groupId: string, rule: WsRule, target: WsManualTarget): Promise<boolean> {
        const config = this.configManager.getConfig();
        const group = config.proxyGroups.find(g => g.id === groupId);
        const allRules = group?.wsPushRules || [];
        return this.wsManager.manualPushByRule(groupId, rule, target, allRules);
    }

    async manualPushCustom(groupId: string, payload: string, target: WsManualTarget): Promise<boolean> {
        const config = this.configManager.getConfig();
        const group = config.proxyGroups.find(g => g.id === groupId);
        const allRules = group?.wsPushRules || [];
        return this.wsManager.manualPushCustom(groupId, payload, target, allRules);
    }

    async startGroupById(groupId: string): Promise<string> {
        const config = this.configManager.getConfig();
        const group = config.proxyGroups.find(g => g.id === groupId);

        if (!group) {
            throw new Error(`Group not found: ${groupId}`);
        }

        if (!group.enabled) {
            throw new Error(`Group is disabled: ${group.name}`);
        }

        if (this.httpServers.has(groupId) || this.wsManager.getGroupStatus(groupId)) {
            throw new Error(`Server for group "${group.name}" is already running`);
        }

        await this.startGroup(group);

        // Update isRunning flag when any server is running
        this.isRunning = true;

        const isWs = group.protocol === 'WS';
        const scheme = isWs ? (group.wssEnabled ? 'wss' : 'ws') : 'http';
        const url = `${scheme}://localhost:${group.port} (${group.name})`;
        this.outputChannel.appendLine(`✅ Mock server started: ${url}`);
        this.outputChannel.show(true);

        return url;
    }

    async stopGroupById(groupId: string): Promise<void> {
        const httpServer = this.httpServers.get(groupId);
        const config = this.configManager.getConfig();
        const group = config.proxyGroups.find(g => g.id === groupId);

        if (httpServer) {
            await new Promise<void>(resolve => {
                httpServer.close(() => {
                    const groupInfo = group ? `${group.name}(:${group.port})` : groupId;
                    this.outputChannel.appendLine(`🛑 Server stopped for group: ${groupInfo}`);
                    resolve();
                });
            });
            this.httpServers.delete(groupId);
        }

        // Stop WS server if any
        if (this.wsManager.getGroupStatus(groupId)) {
            await this.wsManager.stopGroup(groupId);
            const groupInfo = group ? `${group.name}(:${group.port})` : groupId;
            this.outputChannel.appendLine(`🛑 WS server stopped for group: ${groupInfo}`);
        }

        // Update isRunning status
        if (this.httpServers.size === 0 && !this.hasAnyWsServer()) {
            this.isRunning = false;
        }
    }

    private async handleRequest(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        group: ProxyGroup
    ): Promise<void> {
        const requestPath = req.url || '/';
        const method = req.method || 'GET';

        this.outputChannel.appendLine(`📥 [${group.name}] ${method} ${requestPath}`);

        // Handle root path - welcome page
        if (requestPath === '/' || requestPath === '') {
            this.handleWelcomePage(res, group);
            return;
        }

        // Handle OPTIONS request (CORS preflight)
        if (method === 'OPTIONS') {
            this.sendCorsHeaders(res);
            res.writeHead(200);
            res.end();
            this.outputChannel.appendLine(`   ✓ CORS preflight handled`);
            return;
        }

        const route = selectHttpRoute({ ...group, routes: this.getHttpRoutes(group) }, requestPath);
        if (!route) {
            this.sendErrorResponse(res, 502, 'Bad Gateway: No matching route configured');
            return;
        }

        if (shouldServeRouteWelcomePage(route, requestPath)) {
            this.handleWelcomePage(res, group);
            return;
        }

        const matchPath = computeHttpMatchPath(route, requestPath);
        this.outputChannel.appendLine(`   🎯 Match path: ${matchPath}`);

        const mockApi = this.findMatchingMockApi(matchPath, method, route);

        if (route.enableMock && mockApi && mockApi.enabled) {
            await this.handleMockResponse(res, mockApi, group);
        } else {
            this.forwardToOriginalServer(req, res, route);
        }
    }

    private findMatchingMockApi(
        requestPath: string,
        method: string,
        route: HttpRoute
    ): MockApiConfig | undefined {
        const pathWithoutQuery = requestPath.split('?')[0];
        return selectBestMockApiForRequest(route.mockApis, pathWithoutQuery, method);
    }

    private handleWelcomePage(res: http.ServerResponse, group: ProxyGroup): void {
        const routes = this.getHttpRoutes(group).map(route => {
            const enabledApis = route.mockApis.filter(api => api.enabled);
            const prefix = route.pathPrefix === '/' ? '' : route.pathPrefix.replace(/\/$/, '');
            const apis = enabledApis.map(api => {
                const normalizedPath = api.path.startsWith('/') ? api.path : `/${api.path}`;
                return {
                    path: api.path,
                    method: api.method,
                    enabled: true,
                    example: `${prefix}${normalizedPath}` || '/',
                };
            });

            return {
                id: route.id,
                name: route.name,
                pathPrefix: route.pathPrefix,
                targetBaseUrl: route.targetBaseUrl,
                stripPrefix: route.stripPrefix,
                enableMock: route.enableMock,
                mockApis: {
                    total: route.mockApis.length,
                    enabled: enabledApis.length,
                },
                apis,
            };
        });

        const welcomeData = {
            status: 'running',
            message: 'Intercept Wave Mock Server is running',
            group: {
                name: group.name,
                port: group.port,
                serverUrl: `http://localhost:${group.port}`,
            },
            routes: {
                total: routes.length,
                enabledMock: routes.reduce((acc, route) => acc + route.mockApis.enabled, 0),
            },
            routeList: routes,
            mockApis: {
                total: routes.reduce((acc, route) => acc + route.mockApis.total, 0),
                enabled: routes.reduce((acc, route) => acc + route.mockApis.enabled, 0),
            },
            apis: routes.flatMap(route => route.apis),
        };

        this.sendCorsHeaders(res);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(welcomeData, null, 2));
    }

    private async handleMockResponse(
        res: http.ServerResponse,
        mockApi: MockApiConfig,
        group: ProxyGroup
    ): Promise<void> {
        this.outputChannel.appendLine(`   📝 Mock API found: ${JSON.stringify(mockApi)}`);

        // Simulate delay
        if (mockApi.delay && mockApi.delay > 0) {
            await new Promise(resolve => setTimeout(resolve, mockApi.delay));
        }

        // Set headers
        this.sendCorsHeaders(res);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        // Set cookie if enabled
        if (mockApi.useCookie && group.globalCookie) {
            res.setHeader('Set-Cookie', group.globalCookie);
        }

        // mockData is always a string (JetBrains plugin compatible format)
        const responseData = mockApi.mockData;
        this.outputChannel.appendLine(`   📤 Response data length: ${responseData.length}`);

        // Send response
        res.writeHead(mockApi.statusCode);
        res.end(responseData);

        this.outputChannel.appendLine(
            `   ✅ Mock response sent [${mockApi.statusCode}] ${mockApi.delay && mockApi.delay > 0 ? `(delayed ${mockApi.delay}ms)` : ''}`
        );
    }

    private forwardToOriginalServer(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        route: HttpRoute
    ): void {
        const requestUrl = req.url || '/';
        const [requestPath, queryString] = requestUrl.split('?', 2);
        const forwardPath = computeHttpForwardPath(route, requestPath || '/');
        const targetUrl = `${route.targetBaseUrl.replace(/\/$/, '')}${forwardPath}${queryString ? `?${queryString}` : ''}`;
        this.outputChannel.appendLine(`   ⏩ Forwarding to: ${targetUrl}`);

        let url: URL;
        try {
            url = new URL(targetUrl);
        } catch (error: any) {
            this.outputChannel.appendLine(`   ❌ URL parse error: ${error.message}`);
            this.sendErrorResponse(res, 500, `Internal Server Error: ${error.message}`);
            return;
        }

        if (!url.hostname) {
            this.outputChannel.appendLine('   ❌ URL parse error: Invalid target URL');
            this.sendErrorResponse(res, 500, 'Internal Server Error: Invalid target URL');
            return;
        }

        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;

        const headers = { ...req.headers };
        delete headers.host;

        const options: https.RequestOptions = {
            method: req.method,
            headers: headers,
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
        };

        const proxyReq = httpModule.request(options, proxyRes => {
            // Copy response headers (excluding problematic ones)
            Object.keys(proxyRes.headers).forEach(key => {
                if (
                    key.toLowerCase() !== 'transfer-encoding' &&
                    key.toLowerCase() !== 'content-length'
                ) {
                    const value = proxyRes.headers[key];
                    if (value) {
                        res.setHeader(key, value);
                    }
                }
            });

            // Add CORS headers
            this.sendCorsHeaders(res);

            // Send response
            res.writeHead(proxyRes.statusCode || 200);
            proxyRes.pipe(res);

            this.outputChannel.appendLine(`   ✅ Proxied response [${proxyRes.statusCode}]`);
        });

        proxyReq.on('error', error => {
            this.outputChannel.appendLine(
                `   ❌ Proxy error: ${error.message || error.toString()}`
            );
            this.outputChannel.appendLine(`   ❌ Error details: ${JSON.stringify(error)}`);
            this.outputChannel.appendLine(`   ❌ Target was: ${targetUrl}`);
            this.sendErrorResponse(res, 502, 'Bad Gateway: Unable to reach original server');
        });

        // Forward request body
        req.pipe(proxyReq);
    }

    private sendCorsHeaders(res: http.ServerResponse): void {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    private sendErrorResponse(res: http.ServerResponse, statusCode: number, message: string): void {
        const errorJson = JSON.stringify({ error: message });
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.writeHead(statusCode);
        res.end(errorJson);
    }

    private hasAnyWsServer(): boolean {
        // WsServerManager does not expose all ids; we simply infer via getGroupStatus across config.
        const config = this.configManager.getConfig();
        return config.proxyGroups.some(g => this.wsManager.getGroupStatus(g.id));
    }
}
