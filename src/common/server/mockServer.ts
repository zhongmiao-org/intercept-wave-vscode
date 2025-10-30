import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import * as vscode from 'vscode';
import { ConfigManager } from '../config';
import { selectBestMockApiForRequest } from './pathMatcher';
import type { MockApiConfig, ProxyGroup } from './types';

export class MockServerManager {
    private readonly servers: Map<string, http.Server> = new Map(); // groupId -> server
    private isRunning: boolean = false;

    constructor(
        private readonly configManager: ConfigManager,
        private readonly outputChannel: vscode.OutputChannel
    ) {}

    async start(): Promise<string> {
        const config = this.configManager.getConfig();
        const enabledGroups = config.proxyGroups.filter(g => g.enabled);

        if (enabledGroups.length === 0) {
            throw new Error('No enabled proxy groups found');
        }

        // Filter out groups that are already running
        const groupsToStart = enabledGroups.filter(g => !this.servers.has(g.id));

        if (groupsToStart.length === 0) {
            throw new Error('All enabled servers are already running');
        }

        const startPromises = groupsToStart.map(group => this.startGroup(group));
        await Promise.all(startPromises);

        // Update isRunning flag
        this.isRunning = true;

        const urls = groupsToStart.map(g => `http://localhost:${g.port} (${g.name})`).join(', ');
        this.outputChannel.appendLine(`✅ Mock servers started: ${urls}`);
        this.outputChannel.show(true);

        return urls;
    }

    private async startGroup(group: ProxyGroup): Promise<void> {
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
                this.servers.set(group.id, server);
                this.outputChannel.appendLine(
                    `✅ [${group.name}] started on http://localhost:${group.port}`
                );
                this.outputChannel.appendLine(`   📋 Intercept Prefix: ${group.interceptPrefix}`);
                this.outputChannel.appendLine(`   🔗 Base URL: ${group.baseUrl}`);
                this.outputChannel.appendLine(
                    `   📊 Mock APIs: ${group.mockApis.filter(api => api.enabled).length}/${group.mockApis.length} enabled`
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
        if (this.servers.size === 0) {
            return;
        }

        // Get config to retrieve group names
        const config = this.configManager.getConfig();

        const stopPromises = Array.from(this.servers.entries()).map(
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
        this.servers.clear();
        this.isRunning = false;
        this.outputChannel.appendLine('🛑 All mock servers stopped');
    }

    getStatus(): boolean {
        return this.isRunning;
    }

    getGroupStatus(groupId: string): boolean {
        return this.servers.has(groupId);
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

        if (this.servers.has(groupId)) {
            throw new Error(`Server for group "${group.name}" is already running`);
        }

        await this.startGroup(group);

        // Update isRunning flag when any server is running
        this.isRunning = true;

        const url = `http://localhost:${group.port} (${group.name})`;
        this.outputChannel.appendLine(`✅ Mock server started: ${url}`);
        this.outputChannel.show(true);

        return url;
    }

    async stopGroupById(groupId: string): Promise<void> {
        const server = this.servers.get(groupId);
        if (!server) {
            return;
        }

        // Get config to retrieve group name
        const config = this.configManager.getConfig();
        const group = config.proxyGroups.find(g => g.id === groupId);

        await new Promise<void>(resolve => {
            server.close(() => {
                const groupInfo = group ? `${group.name}(:${group.port})` : groupId;
                this.outputChannel.appendLine(`🛑 Server stopped for group: ${groupInfo}`);
                resolve();
            });
        });

        this.servers.delete(groupId);

        // Update isRunning status
        if (this.servers.size === 0) {
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

        // Handle prefix welcome page when stripPrefix=true
        if (group.stripPrefix && group.interceptPrefix) {
            const prefix = group.interceptPrefix.endsWith('/')
                ? group.interceptPrefix.slice(0, -1)
                : group.interceptPrefix;
            if (requestPath === prefix || requestPath === prefix + '/') {
                this.handleWelcomePage(res, group);
                return;
            }
        }

        // Handle OPTIONS request (CORS preflight)
        if (method === 'OPTIONS') {
            this.sendCorsHeaders(res);
            res.writeHead(200);
            res.end();
            this.outputChannel.appendLine(`   ✓ CORS preflight handled`);
            return;
        }

        // Path matching logic
        const matchPath = this.getMatchPath(requestPath, group);
        this.outputChannel.appendLine(`   🎯 Match path: ${matchPath}`);

        // Find matching mock API
        const mockApi = this.findMatchingMockApi(matchPath, method, group);

        if (mockApi && mockApi.enabled) {
            // Use mock data
            await this.handleMockResponse(res, mockApi, group);
        } else {
            // Forward to original server
            this.forwardToOriginalServer(req, res, group);
        }
    }

    private getMatchPath(requestPath: string, group: ProxyGroup): string {
        if (group.stripPrefix && group.interceptPrefix) {
            if (requestPath.startsWith(group.interceptPrefix)) {
                const stripped = requestPath.substring(group.interceptPrefix.length);
                return stripped || '/';
            }
        }
        return requestPath;
    }

    private findMatchingMockApi(
        requestPath: string,
        method: string,
        group: ProxyGroup
    ): MockApiConfig | undefined {
        // Strip query parameters from request path for matching
        const pathWithoutQuery = requestPath.split('?')[0];

        // Use wildcard-aware matcher with prioritization
        return selectBestMockApiForRequest(group.mockApis, pathWithoutQuery, method);
    }

    private handleWelcomePage(res: http.ServerResponse, group: ProxyGroup): void {
        // Only list enabled mock APIs and attach example links
        const enabledApis = group.mockApis.filter(api => api.enabled);
        const normalizedPrefix = group.interceptPrefix.endsWith('/')
            ? group.interceptPrefix.slice(0, -1)
            : group.interceptPrefix;

        const apis = enabledApis.map(api => {
            const normalizedPath = api.path.startsWith('/') ? api.path : `/${api.path}`;
            const examplePath = `${normalizedPrefix}${normalizedPath}`;
            return {
                path: api.path,
                method: api.method,
                enabled: true,
                example: examplePath,
            };
        });

        const welcomeData = {
            status: 'running',
            message: 'Intercept Wave Mock Server is running',
            group: {
                name: group.name,
                port: group.port,
                baseUrl: group.baseUrl,
                interceptPrefix: group.interceptPrefix,
                serverUrl: `http://localhost:${group.port}`,
            },
            mockApis: {
                total: group.mockApis.length,
                enabled: enabledApis.length,
            },
            apis,
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
        group: ProxyGroup
    ): void {
        const targetUrl = group.baseUrl + req.url;
        this.outputChannel.appendLine(`   ⏩ Forwarding to: ${targetUrl}`);

        try {
            const url = new URL(targetUrl);
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
        } catch (error: any) {
            this.outputChannel.appendLine(`   ❌ URL parse error: ${error.message}`);
            this.sendErrorResponse(res, 500, `Internal Server Error: ${error.message}`);
        }
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
}
