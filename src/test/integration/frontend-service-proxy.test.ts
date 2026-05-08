import * as http from 'http';
import { afterEach, describe, it } from 'mocha';
import { expect } from 'chai';
import { MockServerManager } from '../../common';
import {
    createHttpGroup,
    createMockServerManager,
    createOutputChannel,
    getFreePort,
    httpRequest,
} from './helpers/upstream';

describe('Frontend Service Proxy Integration', function () {
    this.timeout(20000);

    let manager: MockServerManager | undefined;
    const upstreams: http.Server[] = [];

    afterEach(async () => {
        if (manager) {
            await manager.stop();
            manager = undefined;
        }
        await Promise.all(upstreams.splice(0).map(server => closeServer(server)));
    });

    it('routes API prefixes and frontend fallback paths to separate upstream services', async () => {
        const backendRequests: Array<{ url: string; method: string; headers: http.IncomingHttpHeaders; body: string }> = [];
        const frontendRequests: string[] = [];

        const backend = await startLocalServer(async (req, res) => {
            const body = await readBody(req);
            backendRequests.push({
                url: req.url || '/',
                method: req.method || 'GET',
                headers: req.headers,
                body,
            });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                service: 'backend',
                url: req.url,
                method: req.method,
                body,
                requestId: req.headers['x-request-id'],
            }));
        });
        const frontend = await startLocalServer(async (req, res) => {
            frontendRequests.push(req.url || '/');
            if (req.url === '/assets/app.js') {
                res.setHeader('Content-Type', 'application/javascript');
                res.end('window.appLoaded = true;');
                return;
            }
            if (req.url === '/' || req.url?.startsWith('/index.html')) {
                res.setHeader('Content-Type', 'text/html');
                res.end('<main id="app">SPA Shell</main>');
                return;
            }
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('not found');
        });
        upstreams.push(backend.server, frontend.server);

        const output = createOutputChannel();
        const port = await getFreePort();
        manager = createMockServerManager(
            [
                createHttpGroup({
                    id: 'frontend-gateway',
                    port,
                    interceptPrefix: '/api',
                    baseUrl: backend.baseUrl,
                    stripPrefix: true,
                    routes: [
                        {
                            id: 'api-route',
                            name: 'API',
                            pathPrefix: '/api',
                            targetBaseUrl: backend.baseUrl,
                            stripPrefix: true,
                            rewriteTargetPath: '',
                            spaFallbackPath: '',
                            enableMock: true,
                            mockApis: [],
                        },
                        {
                            id: 'frontend-route',
                            name: 'Frontend',
                            pathPrefix: '/',
                            targetBaseUrl: frontend.baseUrl,
                            stripPrefix: false,
                            rewriteTargetPath: '',
                            spaFallbackPath: '/index.html',
                            enableMock: false,
                            mockApis: [],
                        },
                    ],
                }),
            ],
            output
        );

        await manager.start();

        const apiResponse = await httpRequest({
            method: 'POST',
            url: `http://localhost:${port}/api/users?active=true`,
            headers: {
                'Content-Type': 'application/json',
                'X-Request-Id': 'frontend-gateway-test',
            },
            body: JSON.stringify({ name: 'Ada' }),
        });
        expect(apiResponse.statusCode).to.equal(200);
        const apiBody = JSON.parse(apiResponse.body);
        expect(apiBody.service).to.equal('backend');
        expect(apiBody.url).to.equal('/users?active=true');
        expect(apiBody.method).to.equal('POST');
        expect(apiBody.body).to.equal('{"name":"Ada"}');
        expect(apiBody.requestId).to.equal('frontend-gateway-test');

        const rootResponse = await httpRequest({ url: `http://localhost:${port}/` });
        expect(rootResponse.statusCode).to.equal(200);
        expect(rootResponse.body).to.contain('SPA Shell');

        const assetResponse = await httpRequest({ url: `http://localhost:${port}/assets/app.js` });
        expect(assetResponse.statusCode).to.equal(200);
        expect(assetResponse.body).to.contain('appLoaded');

        const deepLinkResponse = await httpRequest({
            url: `http://localhost:${port}/dashboard/settings?tab=profile`,
            headers: {
                Accept: 'text/html',
            },
        });
        expect(deepLinkResponse.statusCode).to.equal(200);
        expect(deepLinkResponse.body).to.contain('SPA Shell');

        expect(backendRequests.map(item => item.url)).to.deep.equal(['/users?active=true']);
        expect(frontendRequests).to.deep.equal([
            '/',
            '/assets/app.js',
            '/dashboard/settings?tab=profile',
            '/index.html?tab=profile',
        ]);
    });
});

async function startLocalServer(
    handler: (req: http.IncomingMessage, res: http.ServerResponse) => void | Promise<void>
): Promise<{ server: http.Server; baseUrl: string }> {
    const server = http.createServer((req, res) => {
        void Promise.resolve(handler(req, res)).catch(error => {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(error instanceof Error ? error.message : String(error));
        });
    });
    await new Promise<void>((resolve, reject) => {
        server.listen(0, '127.0.0.1', resolve);
        server.on('error', reject);
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Failed to allocate local upstream port');
    }
    return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function readBody(req: http.IncomingMessage): Promise<string> {
    return await new Promise((resolve, reject) => {
        let body = '';
        req.setEncoding('utf8');
        req.on('data', chunk => {
            body += chunk;
        });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

async function closeServer(server: http.Server): Promise<void> {
    await new Promise<void>(resolve => server.close(() => resolve()));
}
