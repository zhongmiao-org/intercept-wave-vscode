import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
import * as vscode from 'vscode';
import { ConfigManager } from '../config';
import { selectBestMockApiForRequest } from './pathMatcher';
import { HttpRoute, MockApiConfig, ProxyGroup, WsRule } from '../interfaces';
import { WsManualTarget } from '../types';
import { WsServerManager } from './wsServer';
import {
    computeHttpForwardPath,
    computeHttpSpaFallbackPath,
    computeHttpMatchPath,
    isRootHttpRoute,
    selectHttpRoute,
    shouldServeRouteWelcomePage,
} from './httpRouteUtils';
import { applyRequestHeaderOverrides, applyResponseHeaderOverrides } from './headerOverrideUtils';
import { createHttpsServerOptions, getHttpGroupUrl } from './httpTlsUtils';

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
                targetType: 'PROXY',
                targetBaseUrl: group.baseUrl || 'http://localhost:8080',
                staticRoot: '',
                stripPrefix: group.stripPrefix,
                rewriteTargetPath: '',
                spaFallbackPath: '',
                spaFallback: false,
                requestHeaders: [],
                responseHeaders: [],
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
                    const url = isWs ? `${g.wssEnabled ? 'wss' : 'ws'}://localhost:${g.port}` : getHttpGroupUrl(g);
                    return `${url} (${g.name})`;
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
            let server: http.Server | https.Server;
            try {
                const listener = (req: http.IncomingMessage, res: http.ServerResponse) => {
                    // Read config on each request to support dynamic updates
                    const currentConfig = this.configManager.getConfig();
                    const currentGroup = currentConfig.proxyGroups.find(g => g.id === group.id);
                    if (currentGroup && currentGroup.enabled) {
                        void this.handleRequest(req, res, currentGroup);
                    } else {
                        this.sendErrorResponse(res, 503, 'Proxy group is disabled');
                    }
                };
                server = group.httpsEnabled === true
                    ? https.createServer(createHttpsServerOptions(group, this.getWorkspaceRoot()), listener)
                    : http.createServer(listener);
            } catch (error: any) {
                const message = error?.message || String(error);
                this.outputChannel.appendLine(`❌ [${group.name}] HTTPS configuration error: ${message}`);
                reject(new Error(message));
                return;
            }

            server.listen(group.port, () => {
                this.httpServers.set(group.id, server);
                this.outputChannel.appendLine(
                    `✅ [${group.name}] started on ${getHttpGroupUrl(group)}`
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
        const url = `${isWs ? `${group.wssEnabled ? 'wss' : 'ws'}://localhost:${group.port}` : getHttpGroupUrl(group)} (${group.name})`;
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
        const requestUrl = req.url || '/';
        const queryIndex = requestUrl.indexOf('?');
        const requestPath = (queryIndex >= 0 ? requestUrl.slice(0, queryIndex) : requestUrl) || '/';
        const method = req.method || 'GET';

        this.outputChannel.appendLine(`📥 [${group.name}] ${method} ${requestUrl}`);

        const route = selectHttpRoute({ ...group, routes: this.getHttpRoutes(group) }, requestPath);
        if (method === 'OPTIONS') {
            this.sendCorsHeaders(res);
            if (route) {
                applyResponseHeaderOverrides(res, route.responseHeaders);
            }
            res.writeHead(200);
            res.end();
            this.outputChannel.appendLine(`   ✓ CORS preflight handled`);
            return;
        }

        if ((requestPath === '/' || requestPath === '') && (!route || !isRootHttpRoute(route))) {
            this.handleWelcomePage(res, group);
            return;
        }

        if (!route) {
            this.sendErrorResponse(res, 502, 'Bad Gateway: No matching route configured');
            return;
        }

        if (route.targetType !== 'STATIC' && shouldServeRouteWelcomePage(route, requestPath)) {
            this.handleWelcomePage(res, group);
            return;
        }

        const matchPath = computeHttpMatchPath(route, requestPath);
        this.outputChannel.appendLine(`   🎯 Match path: ${matchPath}`);

        const mockApi = this.findMatchingMockApi(matchPath, method, route);

        if (route.enableMock && mockApi && mockApi.enabled) {
            await this.handleMockResponse(res, mockApi, group, route);
        } else if (route.targetType === 'STATIC') {
            this.handleStaticResponse(req, res, route);
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
                targetType: route.targetType || 'PROXY',
                targetBaseUrl: route.targetBaseUrl,
                staticRoot: route.staticRoot || '',
                stripPrefix: route.stripPrefix,
                rewriteTargetPath: route.rewriteTargetPath || '',
                spaFallbackPath: route.spaFallbackPath || '',
                spaFallback: route.spaFallback === true,
                requestHeaders: route.requestHeaders || [],
                responseHeaders: route.responseHeaders || [],
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
                serverUrl: getHttpGroupUrl(group),
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
        group: ProxyGroup,
        route: HttpRoute
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
        applyResponseHeaderOverrides(res, route.responseHeaders);
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
        const queryIndex = requestUrl.indexOf('?');
        const requestPath = queryIndex >= 0 ? requestUrl.slice(0, queryIndex) : requestUrl;
        const queryString = queryIndex >= 0 ? requestUrl.slice(queryIndex + 1) : undefined;
        const targetUrl = this.buildTargetUrl(route, computeHttpForwardPath(route, requestPath || '/'), queryString);
        this.outputChannel.appendLine(`   ⏩ Forwarding to: ${targetUrl}`);

        this.proxyToTarget(req, res, route, targetUrl, requestPath || '/', queryString);
    }

    private buildTargetUrl(route: HttpRoute, forwardPath: string, queryString?: string): string {
        return `${route.targetBaseUrl.replace(/\/$/, '')}${forwardPath}${queryString !== undefined ? `?${queryString}` : ''}`;
    }

    private handleStaticResponse(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        route: HttpRoute
    ): void {
        const root = this.resolveStaticRoot(route.staticRoot);
        if (!root || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
            this.sendErrorResponse(res, 502, 'Bad Gateway: Static root is not configured or is not a directory', route);
            return;
        }

        const requestUrl = req.url || '/';
        const queryIndex = requestUrl.indexOf('?');
        const requestPath = queryIndex >= 0 ? requestUrl.slice(0, queryIndex) : requestUrl;
        const staticRoutePath = computeHttpForwardPath(route, requestPath || '/');
        const resolved = this.resolveStaticFile(root, staticRoutePath);
        if (!resolved) {
            this.sendErrorResponse(res, 403, 'Forbidden: static path escapes the configured root', route);
            return;
        }

        try {
            const directFile = this.selectStaticFile(resolved);
            if (directFile) {
                this.sendStaticFile(req, res, directFile, route);
                return;
            }

            if (this.shouldServeStaticSpaFallback(req, route, staticRoutePath)) {
                const fallbackFile = path.join(root, 'index.html');
                if (fs.existsSync(fallbackFile) && fs.statSync(fallbackFile).isFile()) {
                    this.sendStaticFile(req, res, fallbackFile, route);
                    return;
                }
            }

            this.sendErrorResponse(res, 404, 'Static file not found', route);
        } catch (error: any) {
            this.outputChannel.appendLine(`   ❌ Static file error: ${error.message || error}`);
            this.sendErrorResponse(res, 502, 'Bad Gateway: Unable to serve static file', route);
        }
    }

    private resolveStaticRoot(staticRoot?: string): string | undefined {
        const trimmed = typeof staticRoot === 'string' ? staticRoot.trim() : '';
        if (!trimmed) return undefined;
        if (path.isAbsolute(trimmed)) {
            return path.resolve(trimmed);
        }
        return path.resolve(this.getWorkspaceRoot(), trimmed);
    }

    private getWorkspaceRoot(): string {
        const manager = this.configManager as any;
        if (typeof manager.getWorkspaceRoot === 'function') {
            return manager.getWorkspaceRoot();
        }
        if (typeof manager.getConfigPath === 'function') {
            return path.resolve(path.dirname(manager.getConfigPath()), '..');
        }
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    }

    private resolveStaticFile(root: string, staticRoutePath: string): string | undefined {
        const decoded = this.decodeStaticPath(staticRoutePath);
        if (decoded === undefined) return undefined;

        const relativeText = decoded.replace(/\\/g, '/').replace(/^\/+/, '');
        const target = relativeText ? path.resolve(root, relativeText) : root;
        const relative = path.relative(root, target);
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
            return undefined;
        }
        return target;
    }

    private decodeStaticPath(staticRoutePath: string): string | undefined {
        try {
            return decodeURIComponent(staticRoutePath);
        } catch {
            return undefined;
        }
    }

    private selectStaticFile(resolved: string): string | undefined {
        if (!fs.existsSync(resolved)) return undefined;
        const stat = fs.statSync(resolved);
        if (stat.isFile()) return resolved;
        if (stat.isDirectory()) {
            const indexFile = path.join(resolved, 'index.html');
            if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) {
                return indexFile;
            }
        }
        return undefined;
    }

    private sendStaticFile(req: http.IncomingMessage, res: http.ServerResponse, filePath: string, route: HttpRoute): void {
        this.sendCorsHeaders(res);
        res.setHeader('Content-Type', this.getStaticContentType(filePath));
        applyResponseHeaderOverrides(res, route.responseHeaders);
        res.writeHead(200);
        if ((req.method || 'GET').toUpperCase() === 'HEAD') {
            res.end();
            return;
        }
        fs.createReadStream(filePath).pipe(res);
    }

    private getStaticContentType(filePath: string): string {
        const ext = path.extname(filePath).slice(1).toLowerCase();
        switch (ext) {
            case 'html':
            case 'htm':
                return 'text/html; charset=UTF-8';
            case 'js':
            case 'mjs':
                return 'application/javascript; charset=UTF-8';
            case 'css':
                return 'text/css; charset=UTF-8';
            case 'json':
            case 'map':
                return 'application/json; charset=UTF-8';
            case 'svg':
                return 'image/svg+xml';
            case 'png':
                return 'image/png';
            case 'jpg':
            case 'jpeg':
                return 'image/jpeg';
            case 'webp':
                return 'image/webp';
            case 'gif':
                return 'image/gif';
            case 'ico':
                return 'image/x-icon';
            case 'wasm':
                return 'application/wasm';
            case 'txt':
                return 'text/plain; charset=UTF-8';
            default:
                return 'application/octet-stream';
        }
    }

    private proxyToTarget(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        route: HttpRoute,
        targetUrl: string,
        originalRequestPath: string,
        queryString?: string,
        isSpaFallbackRetry: boolean = false
    ): void {
        let url: URL;
        try {
            url = new URL(targetUrl);
        } catch (error: any) {
            this.outputChannel.appendLine(`   ❌ URL parse error: ${error.message}`);
            this.sendErrorResponse(res, 500, `Internal Server Error: ${error.message}`, route);
            return;
        }

        if (!url.hostname) {
            this.outputChannel.appendLine('   ❌ URL parse error: Invalid target URL');
            this.sendErrorResponse(res, 500, 'Internal Server Error: Invalid target URL', route);
            return;
        }

        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;

        const headers = applyRequestHeaderOverrides(req.headers, route.requestHeaders);

        const options: https.RequestOptions = {
            method: req.method,
            headers: headers,
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
        };

        const proxyReq = httpModule.request(options, proxyRes => {
            if (this.shouldRetrySpaFallback(route, req, proxyRes, originalRequestPath, isSpaFallbackRetry)) {
                proxyRes.resume();
                const fallbackPath = computeHttpSpaFallbackPath(route);
                const fallbackTargetUrl = this.buildTargetUrl(route, fallbackPath, queryString);
                this.outputChannel.appendLine(`   ↩ SPA fallback retry: ${fallbackTargetUrl}`);
                this.proxyToTarget(req, res, route, fallbackTargetUrl, originalRequestPath, queryString, true);
                return;
            }

            // Copy response headers (excluding problematic ones)
            Object.keys(proxyRes.headers).forEach(key => {
                if (
                    key.toLowerCase() !== 'transfer-encoding' &&
                    key.toLowerCase() !== 'content-length' &&
                    key.toLowerCase() !== 'connection'
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
            applyResponseHeaderOverrides(res, route.responseHeaders);
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
            this.sendErrorResponse(res, 502, 'Bad Gateway: Unable to reach original server', route);
        });

        // Forward request body
        if (this.isBodylessMethod(req.method)) {
            if (typeof (proxyReq as any).end === 'function') {
                proxyReq.end();
            }
        } else {
            req.pipe(proxyReq);
        }
    }

    private shouldRetrySpaFallback(
        route: HttpRoute,
        req: http.IncomingMessage,
        proxyRes: http.IncomingMessage,
        originalRequestPath: string,
        isSpaFallbackRetry: boolean
    ): boolean {
        if (!route.spaFallbackPath || isSpaFallbackRetry || (proxyRes.statusCode || 0) !== 404) {
            return false;
        }
        if (!this.isBodylessMethod(req.method)) {
            return false;
        }
        const fallbackPath = computeHttpSpaFallbackPath(route);
        if (!fallbackPath || originalRequestPath === fallbackPath) {
            return false;
        }
        if (this.hasFileExtension(originalRequestPath)) {
            return false;
        }
        const accept = String(req.headers.accept || '').toLowerCase();
        return accept === '' || accept.includes('text/html') || accept.includes('application/xhtml+xml') || accept.includes('*/*');
    }

    private shouldServeStaticSpaFallback(req: http.IncomingMessage, route: HttpRoute, staticRoutePath: string): boolean {
        if (route.spaFallback !== true) {
            return false;
        }
        if (!this.isBodylessMethod(req.method)) {
            return false;
        }
        if (this.hasFileExtension(staticRoutePath)) {
            return false;
        }
        const accept = String(req.headers.accept || '').toLowerCase();
        return accept === '' || accept.includes('text/html') || accept.includes('application/xhtml+xml') || accept.includes('*/*');
    }

    private isBodylessMethod(method?: string): boolean {
        const normalized = (method || 'GET').toUpperCase();
        return normalized === 'GET' || normalized === 'HEAD';
    }

    private hasFileExtension(requestPath: string): boolean {
        const lastSegment = requestPath.split('/').pop() || '';
        return /\.[A-Za-z0-9]+$/.test(lastSegment);
    }

    private sendCorsHeaders(res: http.ServerResponse): void {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    private sendErrorResponse(res: http.ServerResponse, statusCode: number, message: string, route?: HttpRoute): void {
        const errorJson = JSON.stringify({ error: message });
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        if (route) {
            applyResponseHeaderOverrides(res, route.responseHeaders);
        }
        res.writeHead(statusCode);
        res.end(errorJson);
    }

    private hasAnyWsServer(): boolean {
        // WsServerManager does not expose all ids; we simply infer via getGroupStatus across config.
        const config = this.configManager.getConfig();
        return config.proxyGroups.some(g => this.wsManager.getGroupStatus(g.id));
    }
}
