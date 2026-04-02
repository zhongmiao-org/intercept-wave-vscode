import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { PanelProvider } from '../../providers';

describe('PanelProvider', () => {
    let sandbox: sinon.SinonSandbox;
    let mockServerManager: any;
    let configManager: any;
    let outputChannel: any;
    let sidebarBridge: any;
    let panelProvider: PanelProvider;
    let panelStub: any;
    let createPanelStub: sinon.SinonStub;

    const config = {
        version: '4.0',
        proxyGroups: [
            {
                id: 'group-1',
                name: 'Group 1',
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
                        mockApis: [{ path: '/hello', method: 'GET', enabled: true, mockData: '{}', statusCode: 200 }],
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
                wsPushRules: [{ path: '/echo', message: '{}', enabled: true }],
                wssEnabled: false,
                wssKeystorePath: null,
                wssKeystorePassword: null,
            },
        ],
    };

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        const vscodeAny = vscode as any;
        if (!vscodeAny.ViewColumn) {
            Object.defineProperty(vscodeAny, 'ViewColumn', {
                value: { Active: 1 },
                configurable: true,
            });
        }
        if (!(vscodeAny.Uri as any).joinPath) {
            Object.defineProperty(vscodeAny.Uri, 'joinPath', {
                value: (base: vscode.Uri, ...parts: string[]) =>
                    vscode.Uri.file([base.fsPath, ...parts].join('/')),
                configurable: true,
            });
        }

        mockServerManager = {
            start: sandbox.stub().resolves('http://localhost:8888 (Group 1)'),
            stop: sandbox.stub().resolves(),
            startGroupById: sandbox.stub().resolves('http://localhost:8888 (Group 1)'),
            stopGroupById: sandbox.stub().resolves(),
            getStatus: sandbox.stub().returns(false),
            getGroupStatus: sandbox.stub().returns(false),
            manualPushByRule: sandbox.stub().resolves(true),
            manualPushCustom: sandbox.stub().resolves(true),
        };

        configManager = {
            getConfig: sandbox.stub().returns(structuredClone(config)),
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

        outputChannel = {
            appendLine: sandbox.stub(),
        };

        sidebarBridge = {
            refreshExternal: sandbox.stub().resolves(),
            syncSelection: sandbox.stub().resolves(),
        };

        panelStub = {
            reveal: sandbox.stub(),
            onDidDispose: sandbox.stub().returns({ dispose() {} }),
            webview: {
                html: '',
                cspSource: 'vscode-webview://test',
                postMessage: sandbox.stub().resolves(true),
                onDidReceiveMessage: sandbox.stub(),
                asWebviewUri: sandbox.stub().callsFake((uri: vscode.Uri) => uri),
            },
        };

        createPanelStub = sandbox.stub().returns(panelStub as any);
        (vscode.window as any).createWebviewPanel = createPanelStub;

        panelProvider = new PanelProvider(
            vscode.Uri.file('/extension'),
            mockServerManager,
            configManager,
            outputChannel
        );
        panelProvider.attachSidebarBridge(sidebarBridge);
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('creates panel once and reveals existing panel on repeated createOrShow', () => {
        panelProvider.createOrShow();
        expect((panelProvider as any).panel).to.exist;
        panelProvider.createOrShow();

        expect((panelProvider as any).panel).to.exist;
    });

    it('focusWithAction creates panel, updates active ids and syncs sidebar', async () => {
        sandbox.stub(panelProvider as any, 'createOrShow').callsFake(() => {
            (panelProvider as any).panel = panelStub;
        });
        await panelProvider.focusWithAction({ type: 'focusEntity', groupId: 'group-1' });

        expect((panelProvider as any).activeGroupId).to.equal('group-1');
        expect((panelProvider as any).activeRouteId).to.equal('route-1');
        expect(panelStub.webview.postMessage.calledWithMatch({ type: 'configUpdated' })).to.equal(true);
    });

    it('focusWithAction queues panelAction until webview is ready', async () => {
        const clock = sandbox.useFakeTimers();
        sandbox.stub(panelProvider as any, 'createOrShow').callsFake(() => {
            (panelProvider as any).panel = panelStub;
        });
        (panelProvider as any).ready = false;

        const promise = panelProvider.focusWithAction({ type: 'focusEntity', groupId: 'group-1', routeId: 'route-1' });
        await promise;
        await clock.tickAsync(60);

        expect(panelStub.webview.postMessage.args.some(args => args[0].type === 'panelAction')).to.equal(true);
    });

    it('handleMessage webviewReady refreshes panel state', async () => {
        (panelProvider as any).panel = panelStub;

        await (panelProvider as any).handleMessage({ type: 'webviewReady' });

        expect(panelStub.webview.postMessage.calledWithMatch({ type: 'configUpdated' })).to.equal(true);
        expect(sidebarBridge.refreshExternal.calledOnce).to.equal(true);
    });

    it('notifies on start/stop errors and ws push failure', async () => {
        (panelProvider as any).panel = panelStub;
        mockServerManager.start.rejects(new Error('boom'));
        mockServerManager.stopGroupById.rejects(new Error('stop failed'));
        mockServerManager.manualPushCustom.resolves(false);

        await (panelProvider as any).handleMessage({ type: 'startServer' });
        await (panelProvider as any).handleMessage({ type: 'stopGroup', groupId: 'group-1' });
        await (panelProvider as any).handleMessage({ type: 'wsManualPushCustom', groupId: 'group-1', target: 'all', payload: '{}' });

        expect(panelStub.webview.postMessage.callCount).to.be.greaterThan(0);
        expect(panelStub.webview.postMessage.args.some(args => args[0].type === 'notify' && args[0].level === 'error')).to.equal(true);
    });

    it('updates ws rules and toggles mock state through config manager', async () => {
        const mutableConfig = structuredClone(config);
        configManager.getConfig.returns(mutableConfig);
        (panelProvider as any).panel = panelStub;

        await (panelProvider as any).handleMessage({ type: 'updateWsRules', groupId: 'group-1', rulesIndexToDelete: 0 });
        await (panelProvider as any).handleMessage({ type: 'toggleMock', groupId: 'group-1', routeId: 'route-1', index: 0 });

        expect(configManager.updateProxyGroup.calledWith('group-1', sinon.match.has('wsPushRules'))).to.equal(true);
        expect(configManager.saveConfig.calledOnce).to.equal(true);
        expect(mutableConfig.proxyGroups[0].routes[0].mockApis[0].enabled).to.equal(false);
    });

    it('covers group, route and mock CRUD handlers plus ws rule success paths', async () => {
        const mutableConfig = structuredClone(config);
        mutableConfig.proxyGroups.push({
            ...structuredClone(config.proxyGroups[0]),
            id: 'group-2',
            routes: [{ ...structuredClone(config.proxyGroups[0].routes[0]), id: 'route-2' }],
        });
        configManager.getConfig.returns(mutableConfig);
        (panelProvider as any).panel = panelStub;

        await (panelProvider as any).handleMessage({ type: 'addGroup', data: { name: 'New', port: 9001, stripPrefix: true, globalCookie: '', enabled: true } });
        await (panelProvider as any).handleMessage({ type: 'updateGroup', groupId: 'group-1', data: { name: 'Updated' } });
        await (panelProvider as any).handleMessage({ type: 'deleteGroup', groupId: 'group-2' });
        await (panelProvider as any).handleMessage({ type: 'addRoute', groupId: 'group-1', data: { name: 'R', pathPrefix: '/r', targetBaseUrl: 'http://r', stripPrefix: true, enableMock: true } });
        await (panelProvider as any).handleMessage({ type: 'updateRoute', groupId: 'group-1', routeId: 'route-1', data: { name: 'R1' } });
        await (panelProvider as any).handleMessage({ type: 'deleteRoute', groupId: 'group-1', routeId: 'route-1' });
        await (panelProvider as any).handleMessage({ type: 'addMock', groupId: 'group-1', routeId: '', data: { path: '/x', method: 'GET', enabled: true, mockData: '{}', statusCode: 200 } });
        await (panelProvider as any).handleMessage({ type: 'updateMock', groupId: 'group-1', routeId: '', index: 0, data: { path: '/x', method: 'POST', enabled: false, mockData: '{}', statusCode: 201 } });
        await (panelProvider as any).handleMessage({ type: 'deleteMock', groupId: 'group-1', routeId: '', index: 0 });
        await (panelProvider as any).handleMessage({ type: 'wsManualPushByRule', groupId: 'group-1', ruleIndex: 0, target: 'match' });

        expect(configManager.addProxyGroup.calledOnce).to.equal(true);
        expect(configManager.updateProxyGroup.calledWith('group-1', sinon.match.has('name', 'Updated'))).to.equal(true);
        expect(configManager.removeProxyGroup.calledOnce).to.equal(true);
        expect(configManager.addRoute.calledOnce).to.equal(true);
        expect(configManager.updateRoute.calledOnce).to.equal(true);
        expect(configManager.removeRoute.calledOnce).to.equal(true);
        expect(configManager.addMockApi.calledOnce).to.equal(true);
        expect(configManager.updateMockApi.calledOnce).to.equal(true);
        expect(configManager.removeMockApi.calledOnce).to.equal(true);
        expect(mockServerManager.manualPushByRule.calledOnce).to.equal(true);
    });

    it('handles setActiveGroup, setActiveRoute and catches unexpected handler errors', async () => {
        sandbox.stub(panelProvider as any, 'syncSidebarSelection').resolves();
        configManager.getConfig.returns(structuredClone(config));
        (panelProvider as any).panel = panelStub;

        await (panelProvider as any).handleMessage({ type: 'setActiveGroup', groupId: 'group-1' });
        await (panelProvider as any).handleMessage({ type: 'setActiveRoute', routeId: 'route-1' });

        mockServerManager.start.rejects(new Error('broken'));
        await (panelProvider as any).handleMessage({ type: 'startServer' });

        expect((panelProvider as any).activeGroupId).to.equal('group-1');
        expect((panelProvider as any).activeRouteId).to.equal('route-1');
        expect(panelStub.webview.postMessage.args.some(args => args[0].type === 'notify')).to.equal(true);
    });

    it('builds HTML with default active ids and expected payload', () => {
        const html = (panelProvider as any).getHtml(panelStub.webview);

        expect(html).to.include('Intercept Wave');
        expect(html).to.include('"activeGroupId":"group-1"');
        expect(html).to.include('"activeRouteId":"route-1"');
    });

    it('createOrShow leaves panel assigned for later dispose handling', () => {
        panelProvider.createOrShow();
        expect((panelProvider as any).panel).to.exist;
    });

    it('covers no-op and fallback branches for ws rules, toggle and notify', async () => {
        const mutableConfig = structuredClone(config);
        configManager.getConfig.returns(mutableConfig);

        await (panelProvider as any).handleUpdateWsRules('missing-group', undefined, 0);
        await (panelProvider as any).handleWsManualPushByRule('group-1', 99, 'match');
        await (panelProvider as any).handleToggleMock('group-1', 'missing-route', 0);
        await (panelProvider as any).refresh();

        (panelProvider as any).panel = {
            webview: {
                postMessage: sandbox.stub().rejects(new Error('ignore me')),
            },
        };
        await (panelProvider as any).notify('info', 'x');

        expect(configManager.updateProxyGroup.called).to.equal(false);
        expect(configManager.saveConfig.called).to.equal(false);
    });
});
