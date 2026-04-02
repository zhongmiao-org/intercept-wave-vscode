import { afterEach, beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { ConfigManager, MockConfig, MockServerManager, ProxyGroup } from '../../common';

describe('MockServerManager', () => {
    let mockServerManager: MockServerManager;
    let configManager: ConfigManager;
    let outputChannel: vscode.OutputChannel;
    let appendLineStub: sinon.SinonStub;

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

        configManager = {
            getConfig: sinon.stub().returns(structuredClone(defaultConfig)),
        } as any;

        mockServerManager = new MockServerManager(configManager, outputChannel);
    });

    afterEach(async () => {
        sinon.restore();
    });

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
            { ...defaultGroup, globalCookie: 'sid=1' }
        );

        expect(headers['Set-Cookie']).to.equal('sid=1');
        expect(res.writeHead.calledWith(201)).to.equal(true);
        expect(res.end.calledWith('{"ok":true}')).to.equal(true);
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
});
