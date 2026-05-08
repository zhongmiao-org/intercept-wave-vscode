import { afterEach, beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigManager, MockConfig, MockServerManager, ProxyGroup } from '../../common';

describe('MockServerManager', () => {
    let mockServerManager: MockServerManager;
    let configManager: ConfigManager;
    let outputChannel: vscode.OutputChannel;
    let appendLineStub: sinon.SinonStub;
    let workspaceRoot: string;

    const defaultGroup: ProxyGroup = {
        id: 'test-group-id',
        name: 'Test Group',
        port: 9999,
        interceptPrefix: '/api',
        baseUrl: 'http://localhost:8080',
        stripPrefix: true,
        globalCookie: '',
        enabled: true,
        mockApis: [],
        protocol: 'HTTP',
        routes: [
            {
                id: 'route-1',
                name: 'API',
                pathPrefix: '/api',
                targetBaseUrl: 'http://localhost:8080',
                stripPrefix: true,
                enableMock: true,
                mockApis: [],
            },
        ],
        wsBaseUrl: null,
        wsInterceptPrefix: null,
        wsManualPush: true,
        wsPushRules: [],
        wssEnabled: false,
        wssKeystorePath: null,
        wssKeystorePassword: null,
    };

    const defaultConfig: MockConfig = {
        version: '4.0',
        proxyGroups: [defaultGroup],
    };

    beforeEach(() => {
        appendLineStub = sinon.stub();
        outputChannel = {
            appendLine: appendLineStub,
            show: sinon.stub(),
        } as any;
        workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'iw-static-'));

        configManager = {
            getConfig: sinon.stub().returns(structuredClone(defaultConfig)),
            getWorkspaceRoot: sinon.stub().returns(workspaceRoot),
        } as any;

        mockServerManager = new MockServerManager(configManager, outputChannel);
    });

    afterEach(async () => {
        sinon.restore();
        if (workspaceRoot && fs.existsSync(workspaceRoot)) {
            fs.rmSync(workspaceRoot, { recursive: true, force: true });
        }
    });

    function createResponse() {
        const res = new PassThrough() as any;
        const chunks: Buffer[] = [];
        res.headers = {};
        res.statusCodeValue = undefined;
        const findHeaderKey = (key: string) =>
            Object.keys(res.headers).find(existing => existing.toLowerCase() === key.toLowerCase());
        res.setHeader = sinon.stub().callsFake((key: string, value: any) => {
            const existing = findHeaderKey(key);
            if (existing && existing !== key) {
                delete res.headers[existing];
            }
            res.headers[key] = value;
        });
        res.getHeader = sinon.stub().callsFake((key: string) => {
            const existing = findHeaderKey(key);
            return existing ? res.headers[existing] : undefined;
        });
        res.removeHeader = sinon.stub().callsFake((key: string) => {
            const existing = findHeaderKey(key);
            if (existing) {
                delete res.headers[existing];
            }
        });
        res.writeHead = sinon.stub().callsFake((statusCode: number) => {
            res.statusCodeValue = statusCode;
            return res;
        });
        res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        const done = new Promise<void>(resolve => res.on('finish', resolve));
        return {
            res,
            done,
            body: () => Buffer.concat(chunks).toString('utf-8'),
        };
    }

    function writeStaticFixture() {
        const staticRoot = path.join(workspaceRoot, 'frontend', 'dist');
        fs.mkdirSync(path.join(staticRoot, 'assets'), { recursive: true });
        fs.mkdirSync(path.join(staticRoot, 'docs'), { recursive: true });
        fs.writeFileSync(path.join(staticRoot, 'index.html'), '<html>app</html>');
        fs.writeFileSync(path.join(staticRoot, 'docs', 'index.html'), '<html>docs</html>');
        fs.writeFileSync(path.join(staticRoot, 'assets', 'index.js'), 'console.log("app");');
        fs.writeFileSync(path.join(staticRoot, 'assets', 'style.css'), 'body { color: red; }');
        fs.writeFileSync(path.join(workspaceRoot, 'secret.txt'), 'secret');
        return staticRoot;
    }

    function createStaticRoute(overrides: any = {}) {
        return {
            id: 'static',
            name: 'Frontend Build',
            pathPrefix: '/',
            targetType: 'STATIC' as const,
            targetBaseUrl: 'http://localhost:8080',
            staticRoot: 'frontend/dist',
            stripPrefix: false,
            rewriteTargetPath: '',
            spaFallbackPath: '',
            spaFallback: false,
            enableMock: false,
            mockApis: [],
            ...overrides,
        };
    }

    async function expectRejected(promise: Promise<any>, message: string) {
        try {
            await promise;
            expect.fail(`Expected rejection: ${message}`);
        } catch (error: any) {
            expect(error.message).to.equal(message);
        }
    }

    it('creates an instance', () => {
        expect(mockServerManager).to.be.instanceOf(MockServerManager);
    });

    it('start throws when no enabled groups and when all are already running', async () => {
        (configManager.getConfig as sinon.SinonStub).returns({
            version: '4.0',
            proxyGroups: [{ ...defaultGroup, enabled: false }],
        });
        await expectRejected(mockServerManager.start(), 'No enabled proxy groups found');

        (configManager.getConfig as sinon.SinonStub).returns(defaultConfig);
        (mockServerManager as any).httpServers.set(defaultGroup.id, {});
        await expectRejected(mockServerManager.start(), 'All enabled servers are already running');
    });

    it('start aggregates successful and failed groups', async () => {
        const config: MockConfig = {
            version: '4.0',
            proxyGroups: [
                { ...defaultGroup, id: 'good', name: 'Good', port: 10001 },
                { ...defaultGroup, id: 'bad', name: 'Bad', port: 10002 },
            ],
        };
        (configManager.getConfig as sinon.SinonStub).returns(config);
        sinon.stub(mockServerManager as any, 'startGroup').callsFake(async (...args: any[]) => {
            const group = args[0] as ProxyGroup;
            if (group.id === 'bad') {
                throw new Error('bind failed');
            }
        });

        const url = await mockServerManager.start();

        expect(url).to.equal('http://localhost:10001 (Good)');
        expect(mockServerManager.getStatus()).to.equal(true);
        expect(appendLineStub.args.some(args => String(args[0]).includes('failed to start') && String(args[0]).includes('[Bad]'))).to.equal(true);
    });

    it('startGroupById validates missing, disabled and already running groups', async () => {
        (configManager.getConfig as sinon.SinonStub).returns({ version: '4.0', proxyGroups: [] });
        await expectRejected(mockServerManager.startGroupById('missing'), 'Group not found: missing');

        (configManager.getConfig as sinon.SinonStub).returns({ version: '4.0', proxyGroups: [{ ...defaultGroup, enabled: false, id: 'g1', name: 'G1' }] });
        await expectRejected(mockServerManager.startGroupById('g1'), 'Group is disabled: G1');

        (configManager.getConfig as sinon.SinonStub).returns({ version: '4.0', proxyGroups: [{ ...defaultGroup, id: 'g1', name: 'G1' }] });
        (mockServerManager as any).httpServers.set('g1', {});
        await expectRejected(mockServerManager.startGroupById('g1'), 'Server for group "G1" is already running');
    });

    it('startGroupById and stopGroupById use stubbed start/stop flow', async () => {
        (configManager.getConfig as sinon.SinonStub).returns({ version: '4.0', proxyGroups: [{ ...defaultGroup, id: 'g1', name: 'G1', port: 18888 }] });
        sinon.stub(mockServerManager as any, 'startGroup').resolves();

        const url = await mockServerManager.startGroupById('g1');
        expect(url).to.equal('http://localhost:18888 (G1)');

        const closeStub = sinon.stub().callsFake((cb: () => void) => cb());
        (mockServerManager as any).httpServers.set('g1', { close: closeStub });
        await mockServerManager.stopGroupById('g1');
        expect(closeStub.calledOnce).to.equal(true);
    });

    it('delegates ws manual push helpers with full rules list', async () => {
        const wsRule = { path: '/echo', enabled: true };
        (configManager.getConfig as sinon.SinonStub).returns({
            version: '4.0',
            proxyGroups: [{ ...defaultGroup, id: 'ws', protocol: 'WS', wsPushRules: [wsRule] }],
        });
        const wsManager = {
            manualPushByRule: sinon.stub().resolves(true),
            manualPushCustom: sinon.stub().resolves(true),
            getGroupStatus: sinon.stub().returns(false),
        };
        (mockServerManager as any).wsManager = wsManager;

        await mockServerManager.manualPushByRule('ws', wsRule as any, 'match' as any);
        await mockServerManager.manualPushCustom('ws', '{}', 'all' as any);

        expect(wsManager.manualPushByRule.calledWith('ws', wsRule, 'match', [wsRule])).to.equal(true);
        expect(wsManager.manualPushCustom.calledWith('ws', '{}', 'all', [wsRule])).to.equal(true);
    });

    it('returns legacy route fallback and strips query before matching mock apis', () => {
        const routes = (mockServerManager as any).getHttpRoutes({
            ...defaultGroup,
            routes: undefined,
            mockApis: [{ path: '/users', method: 'GET', enabled: true, mockData: '{}', statusCode: 200 }],
        });
        const mockApi = (mockServerManager as any).findMatchingMockApi('/users?page=1', 'GET', {
            ...routes[0],
            mockApis: [{ path: '/users', method: 'GET', enabled: true, mockData: '{}', statusCode: 200 }],
        });

        expect(routes).to.have.length(1);
        expect(routes[0].pathPrefix).to.equal('/api');
        expect(mockApi?.path).to.equal('/users');
    });

    it('handleMockResponse sets cors, cookies and status', async () => {
        const headers: Record<string, any> = {};
        const res = {
            setHeader: sinon.stub().callsFake((key: string, value: any) => {
                headers[key] = value;
            }),
            writeHead: sinon.stub(),
            end: sinon.stub(),
        } as any;

        await (mockServerManager as any).handleMockResponse(
            res,
            { path: '/x', method: 'GET', enabled: true, mockData: '{"ok":true}', statusCode: 201, delay: 0, useCookie: true },
            { ...defaultGroup, globalCookie: 'sid=1' },
            { ...defaultGroup.routes![0], responseHeaders: [] }
        );

        expect(headers['Set-Cookie']).to.equal('sid=1');
        expect(res.writeHead.calledWith(201)).to.equal(true);
        expect(res.end.calledWith('{"ok":true}')).to.equal(true);
    });

    it('applies response header overrides to mock responses after defaults', async () => {
        const response = createResponse();

        await (mockServerManager as any).handleMockResponse(
            response.res,
            { path: '/x', method: 'GET', enabled: true, mockData: '{"ok":true}', statusCode: 200, delay: 0 },
            defaultGroup,
            {
                ...defaultGroup.routes![0],
                responseHeaders: [
                    { name: 'Access-Control-Allow-Origin', value: 'http://app.local', operation: 'SET', enabled: true },
                    { name: 'Cache-Control', value: 'no-store', operation: 'SET', enabled: true },
                    { name: 'Content-Type', value: '', operation: 'REMOVE', enabled: true },
                    { name: 'Content-Length', value: '1', operation: 'SET', enabled: true },
                ],
            }
        );

        await response.done;
        expect(response.res.headers['Access-Control-Allow-Origin']).to.equal('http://app.local');
        expect(response.res.headers['Cache-Control']).to.equal('no-store');
        expect(response.res.headers['Content-Type']).to.equal(undefined);
        expect(response.res.headers['Content-Length']).to.equal(undefined);
    });

    it('applies request header overrides before forwarding and skips restricted request headers', () => {
        const req = {
            url: '/headers',
            method: 'GET',
            headers: {
                host: 'localhost:9999',
                'x-dev': 'original',
                'x-list': 'a',
                'remove-me': 'yes',
            },
            pipe: sinon.stub(),
        } as any;
        const res = { setHeader: sinon.stub(), writeHead: sinon.stub(), end: sinon.stub() } as any;
        const proxyReq = new EventEmitter() as any;
        proxyReq.on = proxyReq.addListener.bind(proxyReq);
        proxyReq.end = sinon.stub();
        const httpModule = require('http') as any;
        const originalRequest = httpModule.request;
        let forwardedHeaders: any;
        httpModule.request = ((options: any) => {
            forwardedHeaders = options.headers;
            return proxyReq;
        }) as any;

        (mockServerManager as any).forwardToOriginalServer(req, res, {
            ...defaultGroup.routes![0],
            pathPrefix: '/',
            stripPrefix: false,
            requestHeaders: [
                { name: 'X-Dev', value: 'set-value', operation: 'SET', enabled: true },
                { name: 'X-List', value: 'b', operation: 'ADD', enabled: true },
                { name: 'Remove-Me', value: '', operation: 'REMOVE', enabled: true },
                { name: 'Host', value: 'evil.example', operation: 'SET', enabled: true },
                { name: 'X-Off', value: 'nope', operation: 'SET', enabled: false },
            ],
        });

        expect(forwardedHeaders['X-Dev']).to.equal('set-value');
        expect(forwardedHeaders['X-List']).to.equal('a, b');
        expect(forwardedHeaders['Remove-Me']).to.equal(undefined);
        expect(forwardedHeaders.Host).to.equal(undefined);
        expect(forwardedHeaders['X-Off']).to.equal(undefined);
        expect(proxyReq.end.calledOnce).to.equal(true);
        httpModule.request = originalRequest;
    });

    it('forwardToOriginalServer handles invalid target url and proxy request errors', () => {
        const req = { url: '/users', method: 'GET', headers: {}, pipe: sinon.stub() } as any;
        const res = {
            setHeader: sinon.stub(),
            writeHead: sinon.stub(),
            end: sinon.stub(),
        } as any;

        (mockServerManager as any).forwardToOriginalServer(req, res, {
            id: 'route-1',
            name: 'API',
            pathPrefix: '/api',
            targetBaseUrl: 'http://:',
            stripPrefix: true,
            enableMock: true,
            mockApis: [],
        });
        expect(res.writeHead.calledWith(500)).to.equal(true);

        res.writeHead.resetHistory();
        const proxyReq = new EventEmitter() as any;
        proxyReq.on = proxyReq.addListener.bind(proxyReq);
        const httpModule = require('http') as any;
        const originalRequest = httpModule.request;
        httpModule.request = () => proxyReq;
        (mockServerManager as any).forwardToOriginalServer(req, res, {
            id: 'route-1',
            name: 'API',
            pathPrefix: '/api',
            targetBaseUrl: 'http://localhost:8080',
            stripPrefix: true,
            enableMock: true,
            mockApis: [],
        });
        proxyReq.emit('error', new Error('connect failed'));
        expect(res.writeHead.calledWith(502)).to.equal(true);
        httpModule.request = originalRequest;
    });

    it('forwardToOriginalServer copies filtered headers on successful proxy response', () => {
        const req = { url: '/users?x=1', method: 'GET', headers: { host: 'localhost' }, pipe: sinon.stub() } as any;
        const res = {
            setHeader: sinon.stub(),
            writeHead: sinon.stub(),
            end: sinon.stub(),
        } as any;
        const proxyReq = new EventEmitter() as any;
        proxyReq.on = proxyReq.addListener.bind(proxyReq);
        const httpModule = require('http') as any;
        const originalRequest = httpModule.request;
        let requestCalled = false;
        httpModule.request = ((...args: any[]) => {
            requestCalled = true;
            const cb = args.find(arg => typeof arg === 'function') as (proxyRes: any) => void;
            const proxyRes = {
                headers: {
                    'content-type': 'application/json',
                    'transfer-encoding': 'chunked',
                    'content-length': '100',
                },
                statusCode: 204,
                pipe: sinon.stub().callsFake((target: any) => target.end('ok')),
            };
            cb(proxyRes);
            return proxyReq;
        }) as any;

        (mockServerManager as any).forwardToOriginalServer(req, res, {
            id: 'route-1',
            name: 'API',
            pathPrefix: '/api',
            targetBaseUrl: 'http://localhost:8080',
            stripPrefix: true,
            enableMock: true,
            mockApis: [],
        });

        expect(requestCalled).to.equal(true);
        expect(res.setHeader.calledWith('content-type', 'application/json')).to.equal(true);
        expect(res.setHeader.calledWith('transfer-encoding', sinon.match.any)).to.equal(false);
        expect(res.writeHead.calledWith(204)).to.equal(true);
        httpModule.request = originalRequest;
    });

    it('applies response header overrides to proxied responses after upstream headers and CORS', async () => {
        const req = { url: '/users', method: 'GET', headers: {}, pipe: sinon.stub() } as any;
        const response = createResponse();
        const proxyReq = new EventEmitter() as any;
        proxyReq.on = proxyReq.addListener.bind(proxyReq);
        proxyReq.end = sinon.stub();
        const httpModule = require('http') as any;
        const originalRequest = httpModule.request;
        httpModule.request = ((...args: any[]) => {
            const cb = args.find(arg => typeof arg === 'function') as (proxyRes: any) => void;
            cb({
                headers: {
                    'content-type': 'text/plain',
                    'cache-control': 'max-age=60',
                    'content-length': '100',
                    connection: 'close',
                },
                statusCode: 200,
                pipe: sinon.stub().callsFake((target: any) => target.end('ok')),
            });
            return proxyReq;
        }) as any;

        (mockServerManager as any).forwardToOriginalServer(req, response.res, {
            ...defaultGroup.routes![0],
            pathPrefix: '/',
            stripPrefix: false,
            responseHeaders: [
                { name: 'Access-Control-Allow-Origin', value: 'http://app.local', operation: 'SET', enabled: true },
                { name: 'Cache-Control', value: 'no-store', operation: 'SET', enabled: true },
                { name: 'Cache-Control', value: 'must-revalidate', operation: 'ADD', enabled: true },
                { name: 'Content-Type', value: '', operation: 'REMOVE', enabled: true },
                { name: 'Connection', value: 'keep-alive', operation: 'SET', enabled: true },
            ],
        });

        await response.done;
        expect(response.res.headers['Access-Control-Allow-Origin']).to.equal('http://app.local');
        expect(response.res.headers['Cache-Control']).to.equal('no-store, must-revalidate');
        expect(response.res.headers['Content-Type']).to.equal(undefined);
        expect(response.res.headers.connection).to.equal(undefined);
        expect(response.res.headers['content-length']).to.equal(undefined);
        httpModule.request = originalRequest;
    });

    it('sends cors and error responses and detects ws activity', async () => {
        const res = {
            setHeader: sinon.stub(),
            writeHead: sinon.stub(),
            end: sinon.stub(),
        } as any;
        (mockServerManager as any).sendCorsHeaders(res);
        (mockServerManager as any).sendErrorResponse(res, 503, 'down');
        expect(res.setHeader.callCount).to.be.greaterThan(1);
        expect(res.writeHead.calledWith(503)).to.equal(true);

        (configManager.getConfig as sinon.SinonStub).returns({
            version: '4.0',
            proxyGroups: [{ ...defaultGroup, id: 'g1' }, { ...defaultGroup, id: 'g2' }],
        });
        (mockServerManager as any).wsManager = {
            getGroupStatus: sinon.stub().callsFake((id: string) => id === 'g2'),
            stopAll: sinon.stub().resolves(),
        };

        expect((mockServerManager as any).hasAnyWsServer()).to.equal(true);
        await mockServerManager.stop();
        expect(mockServerManager.getStatus()).to.equal(false);
    });

    it('handles welcome page and request dispatch branches without real servers', async () => {
        const baseRoute = defaultGroup.routes![0];
        const res = {
            setHeader: sinon.stub(),
            writeHead: sinon.stub(),
            end: sinon.stub(),
        } as any;
        (mockServerManager as any).handleWelcomePage(res, defaultGroup);
        expect(res.writeHead.calledWith(200)).to.equal(true);

        const handleWelcomeStub = sinon.stub(mockServerManager as any, 'handleWelcomePage');
        await (mockServerManager as any).handleRequest({ url: '/', method: 'GET' } as any, res, defaultGroup);
        expect(handleWelcomeStub.calledOnce).to.equal(true);
        handleWelcomeStub.restore();

        const forwardRootStub = sinon.stub(mockServerManager as any, 'forwardToOriginalServer');
        await (mockServerManager as any).handleRequest(
            { url: '/', method: 'GET', headers: {}, pipe: sinon.stub() } as any,
            res,
            {
                ...defaultGroup,
                routes: [
                    {
                        ...baseRoute,
                        id: 'frontend',
                        pathPrefix: '/',
                        targetBaseUrl: 'http://localhost:5173',
                        stripPrefix: false,
                        enableMock: false,
                    },
                ],
            }
        );
        expect(forwardRootStub.calledOnce).to.equal(true);
        forwardRootStub.restore();

        const sendErrorStub = sinon.stub(mockServerManager as any, 'sendErrorResponse');
        await (mockServerManager as any).handleRequest(
            { url: '/x', method: 'GET', headers: {}, pipe: sinon.stub() } as any,
            res,
            {
                ...defaultGroup,
                routes: [
                    { ...baseRoute, id: 'route-a', pathPrefix: '/api' },
                    { ...baseRoute, id: 'route-b', pathPrefix: '/other' },
                ],
            }
        );
        expect(sendErrorStub.called).to.equal(true);
    });

    it('handles OPTIONS, route welcome page and non-mock forwarding branches', async () => {
        const baseRoute = defaultGroup.routes![0];
        const res = {
            setHeader: sinon.stub(),
            writeHead: sinon.stub(),
            end: sinon.stub(),
        } as any;

        await (mockServerManager as any).handleRequest(
            { url: '/api/users', method: 'OPTIONS', headers: {}, pipe: sinon.stub() } as any,
            res,
            defaultGroup
        );
        expect(res.writeHead.calledWith(200)).to.equal(true);

        const welcomeStub = sinon.stub(mockServerManager as any, 'handleWelcomePage');
        await (mockServerManager as any).handleRequest(
            { url: '/api', method: 'GET', headers: {}, pipe: sinon.stub() } as any,
            res,
            defaultGroup
        );
        expect(welcomeStub.calledOnce).to.equal(true);
        welcomeStub.restore();

        const forwardStub = sinon.stub(mockServerManager as any, 'forwardToOriginalServer');
        await (mockServerManager as any).handleRequest(
            { url: '/api/users', method: 'GET', headers: {}, pipe: sinon.stub() } as any,
            res,
            {
                ...defaultGroup,
                routes: [
                    {
                        ...baseRoute,
                        enableMock: false,
                        mockApis: [{ path: '/users', method: 'GET', enabled: true, mockData: '{}', statusCode: 200 }],
                    },
                ],
            }
        );
        expect(forwardStub.calledOnce).to.equal(true);
    });

    it('applies route response header overrides to matched OPTIONS preflight responses', async () => {
        const response = createResponse();

        await (mockServerManager as any).handleRequest(
            { url: '/api/users', method: 'OPTIONS', headers: {}, pipe: sinon.stub() } as any,
            response.res,
            {
                ...defaultGroup,
                routes: [
                    {
                        ...defaultGroup.routes![0],
                        responseHeaders: [
                            { name: 'Access-Control-Allow-Origin', value: 'http://app.local', operation: 'SET', enabled: true },
                            { name: 'Access-Control-Allow-Methods', value: '', operation: 'REMOVE', enabled: true },
                        ],
                    },
                ],
            }
        );

        await response.done;
        expect(response.res.statusCodeValue).to.equal(200);
        expect(response.res.headers['Access-Control-Allow-Origin']).to.equal('http://app.local');
        expect(response.res.headers['Access-Control-Allow-Methods']).to.equal(undefined);
    });

    it('serves static js and css files with frontend MIME types', async () => {
        writeStaticFixture();

        const js = createResponse();
        (mockServerManager as any).handleStaticResponse(
            { url: '/assets/index.js?cache=1', method: 'GET', headers: {} } as any,
            js.res,
            createStaticRoute()
        );
        await js.done;
        expect(js.res.statusCodeValue).to.equal(200);
        expect(js.res.headers['Content-Type']).to.equal('application/javascript; charset=UTF-8');
        expect(js.body()).to.equal('console.log("app");');

        const css = createResponse();
        (mockServerManager as any).handleStaticResponse(
            { url: '/assets/style.css', method: 'GET', headers: {} } as any,
            css.res,
            createStaticRoute()
        );
        await css.done;
        expect(css.res.statusCodeValue).to.equal(200);
        expect(css.res.headers['Content-Type']).to.equal('text/css; charset=UTF-8');
        expect(css.body()).to.equal('body { color: red; }');
    });

    it('applies response header overrides to static responses and static errors', async () => {
        writeStaticFixture();

        const ok = createResponse();
        (mockServerManager as any).handleStaticResponse(
            { url: '/assets/style.css', method: 'GET', headers: {} } as any,
            ok.res,
            createStaticRoute({
                responseHeaders: [
                    { name: 'Content-Type', value: 'text/plain; charset=UTF-8', operation: 'SET', enabled: true },
                    { name: 'X-Static', value: 'yes', operation: 'SET', enabled: true },
                ],
            })
        );
        await ok.done;
        expect(ok.res.headers['Content-Type']).to.equal('text/plain; charset=UTF-8');
        expect(ok.res.headers['X-Static']).to.equal('yes');

        const missing = createResponse();
        (mockServerManager as any).handleStaticResponse(
            { url: '/missing.txt', method: 'GET', headers: {} } as any,
            missing.res,
            createStaticRoute({
                responseHeaders: [
                    { name: 'Content-Type', value: 'text/plain', operation: 'SET', enabled: true },
                ],
            })
        );
        await missing.done;
        expect(missing.res.statusCodeValue).to.equal(404);
        expect(missing.res.headers['Content-Type']).to.equal('text/plain');
    });

    it('serves index.html for static root and directory paths', async () => {
        writeStaticFixture();

        const root = createResponse();
        (mockServerManager as any).handleStaticResponse(
            { url: '/', method: 'GET', headers: { accept: 'text/html' } } as any,
            root.res,
            createStaticRoute()
        );
        await root.done;
        expect(root.res.statusCodeValue).to.equal(200);
        expect(root.body()).to.equal('<html>app</html>');

        const directory = createResponse();
        (mockServerManager as any).handleStaticResponse(
            { url: '/docs/', method: 'GET', headers: { accept: 'text/html' } } as any,
            directory.res,
            createStaticRoute()
        );
        await directory.done;
        expect(directory.res.statusCodeValue).to.equal(200);
        expect(directory.body()).to.equal('<html>docs</html>');
    });

    it('serves static route prefix roots instead of the gateway welcome page', async () => {
        writeStaticFixture();
        const response = createResponse();

        await (mockServerManager as any).handleRequest(
            { url: '/app', method: 'GET', headers: { accept: 'text/html' }, pipe: sinon.stub() } as any,
            response.res,
            {
                ...defaultGroup,
                routes: [createStaticRoute({ pathPrefix: '/app', stripPrefix: true })],
            }
        );

        await response.done;
        expect(response.res.statusCodeValue).to.equal(200);
        expect(response.body()).to.equal('<html>app</html>');
    });

    it('applies static SPA fallback only for missing browser navigation paths', async () => {
        writeStaticFixture();

        const fallback = createResponse();
        (mockServerManager as any).handleStaticResponse(
            { url: '/dashboard', method: 'GET', headers: { accept: 'text/html' } } as any,
            fallback.res,
            createStaticRoute({ spaFallback: true })
        );
        await fallback.done;
        expect(fallback.res.statusCodeValue).to.equal(200);
        expect(fallback.body()).to.equal('<html>app</html>');

        const disabled = createResponse();
        (mockServerManager as any).handleStaticResponse(
            { url: '/dashboard', method: 'GET', headers: { accept: 'text/html' } } as any,
            disabled.res,
            createStaticRoute({ spaFallback: false })
        );
        await disabled.done;
        expect(disabled.res.statusCodeValue).to.equal(404);
        expect(disabled.body()).to.contain('Static file not found');

        const assetLike = createResponse();
        (mockServerManager as any).handleStaticResponse(
            { url: '/assets/missing.js', method: 'GET', headers: { accept: 'text/html' } } as any,
            assetLike.res,
            createStaticRoute({ spaFallback: true })
        );
        await assetLike.done;
        expect(assetLike.res.statusCodeValue).to.equal(404);
    });

    it('rejects raw and encoded static traversal outside the configured root', async () => {
        writeStaticFixture();

        for (const url of ['/../secret.txt', '/%2e%2e/secret.txt', '/%2e%2e%2fsecret.txt']) {
            const attempt = createResponse();
            (mockServerManager as any).handleStaticResponse(
                { url, method: 'GET', headers: {} } as any,
                attempt.res,
                createStaticRoute()
            );
            await attempt.done;
            expect(attempt.res.statusCodeValue).to.equal(403);
            expect(attempt.body()).to.not.contain('secret');
        }
    });

    it('returns clear errors for missing static files and bad static roots', async () => {
        writeStaticFixture();

        const missing = createResponse();
        (mockServerManager as any).handleStaticResponse(
            { url: '/missing.txt', method: 'GET', headers: {} } as any,
            missing.res,
            createStaticRoute()
        );
        await missing.done;
        expect(missing.res.statusCodeValue).to.equal(404);
        expect(missing.body()).to.contain('Static file not found');

        const badRoot = createResponse();
        (mockServerManager as any).handleStaticResponse(
            { url: '/index.html', method: 'GET', headers: {} } as any,
            badRoot.res,
            createStaticRoute({ staticRoot: '' })
        );
        await badRoot.done;
        expect(badRoot.res.statusCodeValue).to.equal(502);
        expect(badRoot.body()).to.contain('Static root is not configured');
    });

    it('uses route path strip and rewrite semantics before static file resolution', async () => {
        writeStaticFixture();
        fs.mkdirSync(path.join(workspaceRoot, 'frontend', 'dist', 'v1'), { recursive: true });
        fs.writeFileSync(path.join(workspaceRoot, 'frontend', 'dist', 'v1', 'users.json'), '{"users":[]}');

        const response = createResponse();
        (mockServerManager as any).handleStaticResponse(
            { url: '/backend/users.json?active=true', method: 'GET', headers: {} } as any,
            response.res,
            createStaticRoute({ pathPrefix: '/backend', stripPrefix: true, rewriteTargetPath: '/v1' })
        );
        await response.done;
        expect(response.res.statusCodeValue).to.equal(200);
        expect(response.body()).to.equal('{"users":[]}');
    });

    it('prefers enabled mocks before serving static files', async () => {
        writeStaticFixture();
        const baseRoute = createStaticRoute({
            enableMock: true,
            mockApis: [{ path: '/assets/index.js', method: 'GET', enabled: true, mockData: '{"mock":true}', statusCode: 200 }],
        });
        const handleMockStub = sinon.stub(mockServerManager as any, 'handleMockResponse').resolves();
        const staticStub = sinon.stub(mockServerManager as any, 'handleStaticResponse');

        await (mockServerManager as any).handleRequest(
            { url: '/assets/index.js', method: 'GET', headers: {}, pipe: sinon.stub() } as any,
            createResponse().res,
            { ...defaultGroup, routes: [baseRoute] }
        );

        expect(handleMockStub.calledOnce).to.equal(true);
        expect(staticStub.called).to.equal(false);
    });

    it('retries SPA fallback navigation 404s against index.html while preserving query strings', () => {
        const req = {
            url: '/dashboard/settings?tab=profile',
            method: 'GET',
            headers: { accept: 'text/html' },
            pipe: sinon.stub(),
        } as any;
        const res = {
            setHeader: sinon.stub(),
            writeHead: sinon.stub(),
            end: sinon.stub(),
        } as any;
        const httpModule = require('http') as any;
        const originalRequest = httpModule.request;
        const requestedPaths: string[] = [];
        const endStubs: sinon.SinonStub[] = [];

        httpModule.request = ((options: any, cb: (proxyRes: any) => void) => {
            requestedPaths.push(options.path);
            const proxyReq = new EventEmitter() as any;
            proxyReq.on = proxyReq.addListener.bind(proxyReq);
            proxyReq.end = sinon.stub();
            endStubs.push(proxyReq.end);
            if (requestedPaths.length === 1) {
                cb({
                    headers: {},
                    statusCode: 404,
                    resume: sinon.stub(),
                    pipe: sinon.stub(),
                });
            } else {
                cb({
                    headers: { 'content-type': 'text/html' },
                    statusCode: 200,
                    pipe: sinon.stub().callsFake((target: any) => target.end('<html>app</html>')),
                });
            }
            return proxyReq;
        }) as any;

        (mockServerManager as any).forwardToOriginalServer(req, res, {
            id: 'frontend',
            name: 'Frontend',
            pathPrefix: '/',
            targetBaseUrl: 'http://localhost:5173',
            stripPrefix: false,
            spaFallbackPath: '/index.html',
            enableMock: false,
            mockApis: [],
        });

        expect(requestedPaths).to.deep.equal(['/dashboard/settings?tab=profile', '/index.html?tab=profile']);
        expect(endStubs.every(stub => stub.calledOnce)).to.equal(true);
        expect(res.writeHead.calledWith(200)).to.equal(true);
        expect(res.end.calledWith('<html>app</html>')).to.equal(true);
        httpModule.request = originalRequest;
    });
});
