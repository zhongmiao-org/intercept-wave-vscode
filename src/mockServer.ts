import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { ConfigManager } from './configManager';

export interface MockApiConfig {
    path: string;
    enabled: boolean;
    mockData: string;
    method: string;
    statusCode: number;
    useCookie: boolean;
    delay: number;
}

export interface MockConfig {
    port: number;
    interceptPrefix: string;
    baseUrl: string;
    stripPrefix: boolean;
    globalCookie: string;
    mockApis: MockApiConfig[];
}

export class MockServerManager {
    private server: http.Server | null = null;
    private isRunning: boolean = false;

    constructor(private configManager: ConfigManager) {}

    async start(): Promise<string> {
        if (this.isRunning) {
            throw new Error('Mock server is already running');
        }

        const config = this.configManager.getConfig();

        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => {
                this.handleRequest(req, res, config);
            });

            this.server.listen(config.port, () => {
                this.isRunning = true;
                const url = `http://localhost:${config.port}`;
                console.log(`Mock server started on ${url}`);
                resolve(url);
            });

            this.server.on('error', (error) => {
                reject(error);
            });
        });
    }

    async stop(): Promise<void> {
        if (!this.isRunning || !this.server) {
            return;
        }

        return new Promise((resolve) => {
            this.server!.close(() => {
                this.isRunning = false;
                this.server = null;
                console.log('Mock server stopped');
                resolve();
            });
        });
    }

    getStatus(): boolean {
        return this.isRunning;
    }

    private handleRequest(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        config: MockConfig
    ): void {
        const requestPath = req.url || '/';
        const method = req.method || 'GET';

        console.log(`Received request: ${method} ${requestPath}`);

        // Handle root path - welcome page
        if (requestPath === '/' || requestPath === '') {
            this.handleWelcomePage(res, config);
            return;
        }

        // Handle OPTIONS request (CORS preflight)
        if (method === 'OPTIONS') {
            this.sendCorsHeaders(res);
            res.writeHead(200);
            res.end();
            return;
        }

        // Path matching logic
        const matchPath = this.getMatchPath(requestPath, config);
        console.log(`Match path: ${matchPath} (stripPrefix=${config.stripPrefix}, original=${requestPath})`);

        // Find matching mock API
        const mockApi = this.findMatchingMockApi(matchPath, method, config);

        if (mockApi && mockApi.enabled) {
            // Use mock data
            this.handleMockResponse(res, mockApi, config);
        } else {
            // Forward to original server
            this.forwardToOriginalServer(req, res, config);
        }
    }

    private getMatchPath(requestPath: string, config: MockConfig): string {
        if (config.stripPrefix && config.interceptPrefix) {
            if (requestPath.startsWith(config.interceptPrefix)) {
                const stripped = requestPath.substring(config.interceptPrefix.length);
                return stripped || '/';
            }
        }
        return requestPath;
    }

    private findMatchingMockApi(
        requestPath: string,
        method: string,
        config: MockConfig
    ): MockApiConfig | undefined {
        return config.mockApis.find(api => {
            return (
                api.enabled &&
                api.path === requestPath &&
                (api.method === 'ALL' || api.method.toUpperCase() === method.toUpperCase())
            );
        });
    }

    private handleWelcomePage(res: http.ServerResponse, config: MockConfig): void {
        const welcomeData = {
            status: 'running',
            message: 'Intercept Wave Mock Server is running',
            server: {
                port: config.port,
                baseUrl: config.baseUrl,
                interceptPrefix: config.interceptPrefix
            },
            mockApis: {
                total: config.mockApis.length,
                enabled: config.mockApis.filter(api => api.enabled).length
            },
            apis: config.mockApis.map(api => ({
                path: api.path,
                method: api.method,
                enabled: api.enabled
            }))
        };

        this.sendCorsHeaders(res);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(welcomeData, null, 2));
    }

    private async handleMockResponse(
        res: http.ServerResponse,
        mockApi: MockApiConfig,
        config: MockConfig
    ): Promise<void> {
        // Simulate delay
        if (mockApi.delay > 0) {
            await new Promise(resolve => setTimeout(resolve, mockApi.delay));
        }

        // Set headers
        this.sendCorsHeaders(res);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        // Set cookie if enabled
        if (mockApi.useCookie && config.globalCookie) {
            res.setHeader('Set-Cookie', config.globalCookie);
        }

        // Send response
        res.writeHead(mockApi.statusCode);
        res.end(mockApi.mockData);

        console.log(`Responded with mock data for: ${mockApi.path}`);
    }

    private forwardToOriginalServer(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        config: MockConfig
    ): void {
        const targetUrl = config.baseUrl + req.url;
        console.log(`Forwarding request to: ${targetUrl}`);

        try {
            const url = new URL(targetUrl);
            const isHttps = url.protocol === 'https:';
            const httpModule = isHttps ? https : http;

            const options: https.RequestOptions = {
                method: req.method,
                headers: { ...req.headers },
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search
            };

            // Remove Host header to avoid conflicts
            delete options.headers?.host;

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

                console.log(`Forwarded response from original server: ${proxyRes.statusCode}`);
            });

            proxyReq.on('error', error => {
                console.error('Error forwarding request:', error);
                this.sendErrorResponse(res, 502, 'Bad Gateway: Unable to reach original server');
            });

            // Forward request body
            req.pipe(proxyReq);
        } catch (error: any) {
            console.error('Error parsing target URL:', error);
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