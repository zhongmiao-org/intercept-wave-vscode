import { expect } from 'chai';
import { createSandbox, match, type SinonSandbox } from 'sinon';
import * as vscode from 'vscode';
import { SidebarProvider } from '../../providers';

describe('SidebarProvider 4.0', () => {
    let sidebarProvider: SidebarProvider;
    let mockServerManager: any;
    let configManager: any;
    let panelProvider: any;
    let webviewViewStub: any;
    let sandbox: SinonSandbox;

    beforeEach(() => {
        sandbox = createSandbox();

        const config = {
            version: '4.0',
            proxyGroups: [
                {
                    id: 'test-group-id',
                    name: 'Test Group',
                    protocol: 'HTTP',
                    port: 8888,
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
                    stripPrefix: true,
                    globalCookie: '',
                    enabled: true,
                    interceptPrefix: '/api',
                    baseUrl: 'http://localhost:8080',
                    mockApis: [],
                    wsBaseUrl: null,
                    wsInterceptPrefix: null,
                    wsManualPush: true,
                    wsPushRules: [],
                    wssEnabled: false,
                    wssKeystorePath: null,
                    wssKeystorePassword: null,
                },
            ],
        };

        mockServerManager = {
            start: sandbox.stub().resolves('http://localhost:8888'),
            stop: sandbox.stub().resolves(),
            startGroupById: sandbox.stub().resolves('http://localhost:8888'),
            stopGroupById: sandbox.stub().resolves(),
            getStatus: sandbox.stub().returns(false),
            getGroupStatus: sandbox.stub().returns(false),
            manualPushByRule: sandbox.stub().resolves(true),
            manualPushCustom: sandbox.stub().resolves(true),
        };

        configManager = {
            getConfig: sandbox.stub().returns(config),
            addProxyGroup: sandbox.stub().resolves(),
            updateProxyGroup: sandbox.stub().resolves(),
            removeProxyGroup: sandbox.stub().resolves(),
            addRoute: sandbox.stub().resolves(),
            updateRoute: sandbox.stub().resolves(),
            removeRoute: sandbox.stub().resolves(),
            addMockApi: sandbox.stub().resolves(),
            updateMockApi: sandbox.stub().resolves(),
            removeMockApi: sandbox.stub().resolves(),
            saveConfig: sandbox.stub().resolves(),
        };

        panelProvider = {
            focusWithAction: sandbox.stub().resolves(),
        };

        webviewViewStub = {
            webview: {
                options: {},
                html: '',
                postMessage: sandbox.stub().resolves(),
                onDidReceiveMessage: sandbox.stub(),
            },
        };

        sidebarProvider = new SidebarProvider(
            vscode.Uri.file('/test'),
            mockServerManager,
            configManager,
            panelProvider
        );
        (sidebarProvider as any).webviewView = webviewViewStub;
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('adds a new route through ConfigManager', async () => {
        await (sidebarProvider as any).handleAddRoute('test-group-id', {
            name: 'API 2',
            pathPrefix: '/api2',
            targetBaseUrl: 'http://localhost:8081',
            stripPrefix: true,
            enableMock: false,
        });

        expect(configManager.addRoute.calledOnce).to.equal(true);
        const route = configManager.addRoute.firstCall.args[1];
        expect(route).to.include({
            name: 'API 2',
            pathPrefix: '/api2',
            targetBaseUrl: 'http://localhost:8081',
            stripPrefix: true,
            enableMock: false,
        });
    });

    it('updates and deletes routes through ConfigManager', async () => {
        const cfg = configManager.getConfig();
        cfg.proxyGroups[0].routes.push({
            id: 'route-2',
            name: 'API 2',
            pathPrefix: '/api2',
            targetBaseUrl: 'http://localhost:8081',
            stripPrefix: true,
            enableMock: true,
            mockApis: [],
        });
        (configManager.getConfig as sinon.SinonStub).returns(cfg);

        await (sidebarProvider as any).handleUpdateRoute('test-group-id', 'route-1', {
            name: 'API',
            pathPrefix: '/api',
            targetBaseUrl: 'http://localhost:9090',
            stripPrefix: true,
            enableMock: true,
        });
        await (sidebarProvider as any).handleDeleteRoute('test-group-id', 'route-2');

        expect(configManager.updateRoute.calledWith('test-group-id', 'route-1', match.has('targetBaseUrl', 'http://localhost:9090'))).to.equal(true);
        expect(configManager.removeRoute.calledWith('test-group-id', 'route-2')).to.equal(true);
    });

    it('routes mock CRUD to the selected route', async () => {
        await (sidebarProvider as any).handleAddMock('test-group-id', 'route-1', {
            path: '/x',
            method: 'GET',
            enabled: true,
            mockData: '{}',
            statusCode: 200,
            delay: 0,
        });

        await (sidebarProvider as any).handleUpdateMock('test-group-id', 'route-1', 0, {
            path: '/x',
            method: 'POST',
            enabled: false,
            mockData: '{}',
            statusCode: 201,
            delay: 10,
        });

        await (sidebarProvider as any).handleDeleteMock('test-group-id', 'route-1', 0);

        expect(configManager.addMockApi.calledWith('test-group-id', 'route-1', match.has('path', '/x'))).to.equal(true);
        expect(configManager.updateMockApi.calledWith('test-group-id', 'route-1', 0, match.has('method', 'POST'))).to.equal(true);
        expect(configManager.removeMockApi.calledWith('test-group-id', 'route-1', 0)).to.equal(true);
    });

    it('toggle mock updates the route-scoped mock entry and saves config', async () => {
        const cfg = configManager.getConfig();
        cfg.proxyGroups[0].routes[0].mockApis = [
            { path: '/x', method: 'GET', enabled: true, mockData: '{}', statusCode: 200 },
        ];
        (configManager.getConfig as sinon.SinonStub).returns(cfg);

        await (sidebarProvider as any).handleToggleMock('test-group-id', 'route-1', 0);

        expect(configManager.saveConfig.calledOnce).to.equal(true);
        expect(cfg.proxyGroups[0].routes[0].mockApis[0].enabled).to.equal(false);
    });

    it('refreshWebview posts active group, active route and statuses', async () => {
        (mockServerManager.getGroupStatus as sinon.SinonStub).returns(true);
        (sidebarProvider as any).activeGroupId = 'test-group-id';
        (sidebarProvider as any).activeRouteId = 'route-1';

        await (sidebarProvider as any).refreshWebview();

        expect(webviewViewStub.webview.postMessage.calledOnce).to.equal(true);
        const payload = webviewViewStub.webview.postMessage.firstCall.args[0];
        expect(payload.type).to.equal('configUpdated');
        expect(payload.activeGroupId).to.equal('test-group-id');
        expect(payload.activeRouteId).to.equal('route-1');
        expect(payload.groupStatuses['test-group-id']).to.equal(true);
    });

    it('delegates openPanel actions to the panel provider and keeps selection in sync', async () => {
        await (sidebarProvider as any).handleMessage({
            type: 'openPanel',
            action: { type: 'focusEntity', groupId: 'test-group-id', routeId: 'route-1' },
        });

        expect(panelProvider.focusWithAction.calledOnce).to.equal(true);
        expect(panelProvider.focusWithAction.firstCall.args[0]).to.deep.equal({
            type: 'focusEntity',
            groupId: 'test-group-id',
            routeId: 'route-1',
        });
        expect((sidebarProvider as any).activeGroupId).to.equal('test-group-id');
        expect((sidebarProvider as any).activeRouteId).to.equal('route-1');
    });

    it('syncSelection updates sidebar state and refreshes the webview', async () => {
        await sidebarProvider.syncSelection('test-group-id', 'route-1');

        expect(webviewViewStub.webview.postMessage.calledOnce).to.equal(true);
        const payload = webviewViewStub.webview.postMessage.firstCall.args[0];
        expect(payload.activeGroupId).to.equal('test-group-id');
        expect(payload.activeRouteId).to.equal('route-1');
    });
});
