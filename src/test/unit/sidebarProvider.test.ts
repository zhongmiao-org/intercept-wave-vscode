import { expect } from 'chai';
import { createSandbox, match, type SinonSandbox } from 'sinon';
import * as sinon from 'sinon';
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
        if (!(vscode.Uri as any).joinPath) {
            Object.defineProperty(vscode.Uri, 'joinPath', {
                value: (base: vscode.Uri, ...parts: string[]) =>
                    vscode.Uri.file([base.fsPath, ...parts].join('/')),
                configurable: true,
            });
        }

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

    it('validates group name uniqueness and port conflicts', async () => {
        expect((sidebarProvider as any).validateGroupData({ name: 'Test Group', port: 9999 })).to.be.a('string');
        expect((sidebarProvider as any).validateGroupData({ name: 'Another', port: 8888 })).to.be.a('string');
    });

    it('blocks deleting the last group and the last route', async () => {
        await (sidebarProvider as any).handleDeleteGroup('test-group-id');
        await (sidebarProvider as any).handleDeleteRoute('test-group-id', 'route-1');

        expect(configManager.removeProxyGroup.called).to.equal(false);
        expect(configManager.removeRoute.called).to.equal(false);
    });

    it('validates duplicate route prefix and duplicate mock route', async () => {
        const cfg = configManager.getConfig();
        cfg.proxyGroups[0].routes.push({
            id: 'route-2',
            name: 'API 2',
            pathPrefix: '/api2',
            targetBaseUrl: 'http://localhost:8081',
            stripPrefix: true,
            enableMock: true,
            mockApis: [{ path: '/dup', method: 'GET', enabled: true, mockData: '{}', statusCode: 200 }],
        });
        cfg.proxyGroups[0].routes[0].mockApis.push({
            path: '/dup',
            method: 'GET',
            enabled: true,
            mockData: '{}',
            statusCode: 200,
        });
        (configManager.getConfig as sinon.SinonStub).returns(cfg);

        expect((sidebarProvider as any).validateRouteData('test-group-id', {
            name: 'dup',
            pathPrefix: '/api2',
            targetBaseUrl: 'http://localhost:8082',
        })).to.be.a('string');
        expect((sidebarProvider as any).validateMockData('test-group-id', 'route-1', {
            path: '/dup',
            method: 'GET',
        })).to.be.a('string');
    });

    it('handles ws errors for missing group, missing rule and missing connections', async () => {
        const cfg = configManager.getConfig();
        cfg.proxyGroups[0].wsPushRules = [{ path: '/echo', enabled: true }];
        (configManager.getConfig as sinon.SinonStub).returns(cfg);
        mockServerManager.manualPushByRule.resolves(false);
        mockServerManager.manualPushCustom.resolves(false);

        await (sidebarProvider as any).handleWsManualPushByRule('missing-group', 0, 'match');
        await (sidebarProvider as any).handleWsManualPushByRule('test-group-id', 3, 'match');
        await (sidebarProvider as any).handleWsManualPushByRule('test-group-id', 0, 'match');
        await (sidebarProvider as any).handleWsManualPushCustom('test-group-id', 'all', '{}');

        expect(mockServerManager.manualPushByRule.calledOnce).to.equal(true);
        expect(mockServerManager.manualPushCustom.calledOnce).to.equal(true);
        expect(webviewViewStub.webview.postMessage.callCount).to.be.at.least(2);
    });

    it('builds webview html with default active ids', () => {
        const webview = {
            asWebviewUri: sandbox.stub().callsFake((uri: vscode.Uri) => uri),
            cspSource: 'vscode-webview://sidebar',
        } as any;

        const html = (sidebarProvider as any).getHtmlForWebview(webview);

        expect(html).to.include('Intercept Wave');
        expect(html).to.include('"activeGroupId":"test-group-id"');
    });

    it('dispatches open panel and open config messages', async () => {
        await (sidebarProvider as any).handleMessage({
            type: 'openPanel',
            action: { groupId: 'test-group-id', routeId: 'route-1' },
        });
        await (sidebarProvider as any).handleMessage({ type: 'openConfig' });

        expect(panelProvider.focusWithAction.calledOnce).to.equal(true);
    });

    it('handles start/stop server and group success and error branches', async () => {
        await (sidebarProvider as any).handleStartServer();
        await (sidebarProvider as any).handleStopServer();
        await (sidebarProvider as any).handleStartGroup('test-group-id');
        await (sidebarProvider as any).handleStopGroup('test-group-id');

        mockServerManager.start.rejects(new Error('boom'));
        mockServerManager.stop.rejects(new Error('boom'));
        mockServerManager.startGroupById.rejects(new Error('boom'));
        mockServerManager.stopGroupById.rejects(new Error('boom'));

        await (sidebarProvider as any).handleStartServer();
        await (sidebarProvider as any).handleStopServer();
        await (sidebarProvider as any).handleStartGroup('test-group-id');
        await (sidebarProvider as any).handleStopGroup('test-group-id');

        expect(webviewViewStub.webview.postMessage.callCount).to.be.greaterThan(0);
    });

    it('covers add/update group, route and mock handlers plus fallback mock toggle', async () => {
        const cfg = configManager.getConfig();
        cfg.proxyGroups[0].mockApis = [
            { path: '/legacy', method: 'GET', enabled: true, mockData: '{}', statusCode: 200 },
        ];
        (configManager.getConfig as sinon.SinonStub).returns(cfg);

        await (sidebarProvider as any).handleAddGroup({
            name: 'Another',
            protocol: 'HTTP',
            port: 9999,
            stripPrefix: true,
            globalCookie: '',
            enabled: true,
        });
        await (sidebarProvider as any).handleUpdateGroup('test-group-id', {
            name: 'Updated Group',
            port: 9999,
        });
        await (sidebarProvider as any).handleAddRoute('test-group-id', {
            name: 'API 2',
            pathPrefix: '/new',
            targetBaseUrl: 'http://localhost:9090',
            stripPrefix: true,
            enableMock: true,
        });
        await (sidebarProvider as any).handleUpdateRoute('test-group-id', 'route-1', {
            name: 'API update',
            pathPrefix: '/api',
            targetBaseUrl: 'http://localhost:9091',
            stripPrefix: true,
            enableMock: true,
        });
        await (sidebarProvider as any).handleAddMock('test-group-id', '', {
            path: '/free',
            method: 'PUT',
            enabled: true,
            mockData: '{}',
            statusCode: 200,
        });
        await (sidebarProvider as any).handleUpdateMock('test-group-id', '', 0, {
            path: '/legacy',
            method: 'POST',
            enabled: false,
            mockData: '{}',
            statusCode: 201,
        });
        await (sidebarProvider as any).handleDeleteMock('test-group-id', '', 0);
        await (sidebarProvider as any).handleToggleMock('test-group-id', 'missing-route', 0);

        expect(configManager.addProxyGroup.calledOnce).to.equal(true);
        expect(configManager.updateProxyGroup.called).to.equal(true);
        expect(configManager.addRoute.called).to.equal(true);
        expect(configManager.updateRoute.called).to.equal(true);
        expect(configManager.addMockApi.called).to.equal(true);
        expect(configManager.updateMockApi.called).to.equal(true);
        expect(configManager.removeMockApi.called).to.equal(true);
        expect(configManager.saveConfig.called).to.equal(true);
        expect(cfg.proxyGroups[0].mockApis[0].enabled).to.equal(false);
    });

    it('covers updateWsRules success paths and manual push success notification', async () => {
        const cfg = configManager.getConfig();
        cfg.proxyGroups[0].wsPushRules = [{ path: '/echo', enabled: true }, { path: '/echo2', enabled: true }];
        (configManager.getConfig as sinon.SinonStub).returns(cfg);

        await (sidebarProvider as any).handleUpdateWsRules('test-group-id', [{ path: '/x', enabled: true }], null);
        await (sidebarProvider as any).handleUpdateWsRules('test-group-id', undefined, 1);
        mockServerManager.manualPushByRule.resolves(true);
        mockServerManager.manualPushCustom.resolves(true);
        await (sidebarProvider as any).handleWsManualPushByRule('test-group-id', 0, 'match');
        await (sidebarProvider as any).handleWsManualPushCustom('test-group-id', 'all', '{}');

        expect(configManager.updateProxyGroup.callCount).to.be.at.least(2);
        expect(webviewViewStub.webview.postMessage.callCount).to.be.greaterThan(0);
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

    it('resolveWebviewView wires options, html and message handler', () => {
        const onDidReceiveMessage = sandbox.stub();
        const webview = {
            options: {},
            html: '',
            cspSource: 'vscode-webview://sidebar',
            asWebviewUri: sandbox.stub().callsFake((uri: vscode.Uri) => uri),
            onDidReceiveMessage,
        };
        const view = { webview } as any;

        sidebarProvider.resolveWebviewView(view, {} as any, {} as any);

        expect((webview.options as any).enableScripts).to.equal(true);
        expect(webview.html).to.include('Intercept Wave');
        expect(onDidReceiveMessage.calledOnce).to.equal(true);
    });

    it('handles message routing for selection and fallback command execution', async () => {
        sandbox.stub(vscode.commands, 'executeCommand').resolves(undefined);
        const providerWithoutPanel = new SidebarProvider(
            vscode.Uri.file('/test'),
            mockServerManager,
            configManager
        );
        (providerWithoutPanel as any).webviewView = webviewViewStub;

        await (providerWithoutPanel as any).handleMessage({
            type: 'openPanel',
            action: { groupId: 'test-group-id', routeId: 'route-1' },
        });
        await (providerWithoutPanel as any).handleMessage({ type: 'setActiveGroup', groupId: 'test-group-id', routeId: 'route-1' });
        await (providerWithoutPanel as any).handleMessage({ type: 'setActiveRoute', routeId: 'route-1' });
        await (providerWithoutPanel as any).handleMessage({ type: 'webviewReady' });

        expect((providerWithoutPanel as any).activeGroupId).to.equal('test-group-id');
        expect((providerWithoutPanel as any).activeRouteId).to.equal('route-1');
        expect(webviewViewStub.webview.postMessage.called).to.equal(true);
    });

    it('covers validation and no-op branches for missing entities', async () => {
        expect((sidebarProvider as any).validateGroupData({ name: '', port: 9999 })).to.be.a('string');
        expect((sidebarProvider as any).validateGroupData({ name: 'A', port: 10 })).to.be.a('string');
        expect((sidebarProvider as any).validateRouteData('missing', { name: 'A', pathPrefix: '/x', targetBaseUrl: 'http://x' })).to.be.a('string');
        expect((sidebarProvider as any).validateRouteData('test-group-id', { name: '', pathPrefix: '/x', targetBaseUrl: 'http://x' })).to.be.a('string');
        expect((sidebarProvider as any).validateRouteData('test-group-id', { name: 'A', pathPrefix: '', targetBaseUrl: 'http://x' })).to.be.a('string');
        expect((sidebarProvider as any).validateRouteData('test-group-id', { name: 'A', pathPrefix: '/x', targetBaseUrl: '' })).to.be.a('string');
        expect((sidebarProvider as any).validateMockData('test-group-id', 'missing-route', { path: '/x', method: 'GET' })).to.be.a('string');

        await (sidebarProvider as any).handleDeleteRoute('missing-group', 'route-1');
        await (sidebarProvider as any).handleUpdateWsRules('missing-group', undefined, 0);

        expect(configManager.removeRoute.called).to.equal(false);
        expect(configManager.updateProxyGroup.called).to.equal(false);
        expect(webviewViewStub.webview.postMessage.called).to.equal(true);
    });
});
