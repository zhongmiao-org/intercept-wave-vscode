import * as vscode from 'vscode';
import { ConfigManager, HttpRoute, MockServerManager, ProxyGroup, buildReactWebviewHtml } from '../common';
import { v4 as uuidv4 } from 'uuid';

interface SidebarBridge {
    refreshExternal(): Promise<void>;
    syncSelection(groupId?: string, routeId?: string): Promise<void>;
}

export class PanelProvider {
    private panel: vscode.WebviewPanel | undefined;
    private activeGroupId?: string;
    private activeRouteId?: string;
    private ready = false;
    private sidebarBridge?: SidebarBridge;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly mockServerManager: MockServerManager,
        private readonly configManager: ConfigManager,
        private readonly outputChannel?: vscode.OutputChannel
    ) {}

    public attachSidebarBridge(bridge: SidebarBridge) {
        this.sidebarBridge = bridge;
    }

    private async notify(level: 'info' | 'warn' | 'error', text: string) {
        try {
            if (this.panel) {
                await this.panel.webview.postMessage({ type: 'notify', level, text });
            }
        } catch {
            // ignore
        }
    }

    public createOrShow() {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Active, false);
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'interceptWavePanel',
            'Intercept Wave',
            { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
            { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [this.extensionUri] }
        );

        this.panel.webview.html = this.getHtml(this.panel.webview);
        this.panel.onDidDispose(() => {
            this.panel = undefined;
            this.ready = false;
        });
        this.panel.webview.onDidReceiveMessage(async data => {
            await this.handleMessage(data);
        });
    }

    public async focusWithAction(action: any) {
        if (action?.groupId) {
            this.activeGroupId = action.groupId;
        }
        if (action?.routeId) {
            this.activeRouteId = action.routeId;
        } else if (action?.groupId) {
            const group = this.configManager.getConfig().proxyGroups.find(item => item.id === action.groupId);
            this.activeRouteId = group?.routes?.[0]?.id;
        }
        this.createOrShow();
        if (!this.panel) return;
        await this.syncSidebarSelection();
        await this.refresh();
        const payload = { type: 'panelAction', action };
        if (this.ready) {
            await this.panel.webview.postMessage(payload);
        } else {
            setTimeout(() => { this.panel?.webview.postMessage(payload); }, 50);
        }
    }

    private async handleMessage(data: any) {
        try {
            switch (data.type) {
                case 'webviewReady':
                    this.ready = true;
                    await this.refresh();
                    break;
                case 'setActiveGroup':
                    this.activeGroupId = data.groupId;
                    if (!data.routeId) {
                        const group = this.configManager.getConfig().proxyGroups.find(item => item.id === data.groupId);
                        this.activeRouteId = group?.routes?.[0]?.id;
                    }
                    await this.syncSidebarSelection();
                    break;
                case 'setActiveRoute':
                    this.activeRouteId = data.routeId;
                    await this.syncSidebarSelection();
                    break;
                case 'startServer':
                    await this.handleStartServer();
                    break;
                case 'stopServer':
                    await this.handleStopServer();
                    break;
                case 'startGroup':
                    await this.handleStartGroup(data.groupId);
                    break;
                case 'stopGroup':
                    await this.handleStopGroup(data.groupId);
                    break;
                case 'addGroup':
                    await this.handleAddGroup(data.data);
                    break;
                case 'updateGroup':
                    await this.handleUpdateGroup(data.groupId, data.data);
                    break;
                case 'deleteGroup':
                    await this.handleDeleteGroup(data.groupId);
                    break;
                case 'addRoute':
                    await this.handleAddRoute(data.groupId, data.data);
                    break;
                case 'updateRoute':
                    await this.handleUpdateRoute(data.groupId, data.routeId, data.data);
                    break;
                case 'deleteRoute':
                    await this.handleDeleteRoute(data.groupId, data.routeId);
                    break;
                case 'addMock':
                    await this.handleAddMock(data.groupId, data.routeId, data.data);
                    break;
                case 'updateMock':
                    await this.handleUpdateMock(data.groupId, data.routeId, data.index, data.data);
                    break;
                case 'deleteMock':
                    await this.handleDeleteMock(data.groupId, data.routeId, data.index);
                    break;
                case 'toggleMock':
                    await this.handleToggleMock(data.groupId, data.routeId, data.index);
                    break;
                case 'wsManualPushByRule':
                    await this.handleWsManualPushByRule(data.groupId, data.ruleIndex, data.target);
                    break;
                case 'wsManualPushCustom':
                    await this.handleWsManualPushCustom(data.groupId, data.target, data.payload);
                    break;
                case 'updateWsRules':
                    await this.handleUpdateWsRules(data.groupId, data.rules, data.rulesIndexToDelete);
                    break;
            }
        } catch (error: any) {
            void vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    }

    private async handleUpdateWsRules(groupId: string, rules?: any[], rulesIndexToDelete?: number | null) {
        const config = this.configManager.getConfig();
        const group = config.proxyGroups.find(g => g.id === groupId);
        if (!group) return;
        let nextRules = Array.isArray(group.wsPushRules) ? [...group.wsPushRules] : [];
        if (Array.isArray(rules)) {
            nextRules = rules as any[];
        } else if (typeof rulesIndexToDelete === 'number' && rulesIndexToDelete >= 0 && rulesIndexToDelete < nextRules.length) {
            nextRules.splice(rulesIndexToDelete, 1);
        }
        await this.configManager.updateProxyGroup(groupId, { wsPushRules: nextRules as any });
        await this.refresh();
    }

    private async handleWsManualPushByRule(groupId: string, ruleIndex: number, target: 'match' | 'all' | 'recent') {
        const config = this.configManager.getConfig();
        const group = config.proxyGroups.find(g => g.id === groupId);
        const rule = group?.wsPushRules?.[ruleIndex] as any;
        if (!rule) return;
        const ok = await this.mockServerManager.manualPushByRule(groupId, rule, target);
        if (!ok) {
            const msg = vscode.l10n.t('error.ws.noActiveConnection');
            void vscode.window.showErrorMessage(msg);
            await this.notify('error', msg);
        }
    }

    private async handleWsManualPushCustom(groupId: string, target: 'match' | 'all' | 'recent', payload: string) {
        const ok = await this.mockServerManager.manualPushCustom(groupId, payload, target);
        if (!ok) {
            const msg = vscode.l10n.t('error.ws.noActiveConnection');
            void vscode.window.showErrorMessage(msg);
            await this.notify('error', msg);
        }
    }

    private async handleStartServer() {
        try {
            const url = await this.mockServerManager.start();
            this.outputChannel?.appendLine(`[Panel] startServer -> ${url}`);
            await this.refresh();
        } catch (error: any) {
            this.outputChannel?.appendLine(`[Panel] startServer error -> ${error?.message}`);
            await this.notify('error', vscode.l10n.t('error.failedToStart', error.message));
        }
    }

    private async handleStopServer() {
        try {
            await this.mockServerManager.stop();
            await this.refresh();
        } catch (error: any) {
            await this.notify('error', vscode.l10n.t('error.failedToStop', error.message));
        }
    }

    private async handleStartGroup(groupId: string) {
        try {
            await this.mockServerManager.startGroupById(groupId);
            await this.refresh();
        } catch (error: any) {
            await this.notify('error', vscode.l10n.t('error.failedToStart', error.message));
        }
    }

    private async handleStopGroup(groupId: string) {
        try {
            await this.mockServerManager.stopGroupById(groupId);
            await this.refresh();
        } catch (error: any) {
            await this.notify('error', vscode.l10n.t('error.failedToStop', error.message));
        }
    }

    private async handleAddGroup(data: any) {
        const route = this.createDefaultRoute();
        const group: ProxyGroup = {
            id: uuidv4(),
            name: data.name,
            protocol: data.protocol ?? 'HTTP',
            port: data.port,
            routes: [route],
            stripPrefix: data.stripPrefix,
            globalCookie: data.globalCookie,
            enabled: data.enabled,
            interceptPrefix: route.pathPrefix,
            baseUrl: route.targetBaseUrl,
            mockApis: [],
            wsBaseUrl: data.wsBaseUrl ?? null,
            wsInterceptPrefix: data.wsInterceptPrefix ?? null,
            wsManualPush: data.wsManualPush ?? true,
            wsPushRules: [],
            wssEnabled: data.wssEnabled ?? false,
            wssKeystorePath: data.wssKeystorePath ?? null,
            wssKeystorePassword: data.wssKeystorePassword ?? null,
        };
        await this.configManager.addProxyGroup(group);
        this.activeGroupId = group.id;
        this.activeRouteId = route.id;
        await this.refresh();
    }

    private async handleUpdateGroup(groupId: string, data: any) {
        await this.configManager.updateProxyGroup(groupId, data);
        await this.refresh();
    }

    private async handleDeleteGroup(groupId: string) {
        await this.configManager.removeProxyGroup(groupId);
        const config = this.configManager.getConfig();
        this.activeGroupId = config.proxyGroups[0]?.id;
        this.activeRouteId = config.proxyGroups[0]?.routes?.[0]?.id;
        await this.refresh();
    }

    private async handleAddRoute(groupId: string, data: any) {
        const route: HttpRoute = {
            id: uuidv4(),
            name: data.name,
            pathPrefix: data.pathPrefix,
            targetBaseUrl: data.targetBaseUrl,
            stripPrefix: data.stripPrefix,
            enableMock: data.enableMock,
            mockApis: [],
        };
        await this.configManager.addRoute(groupId, route);
        this.activeRouteId = route.id;
        await this.refresh();
    }

    private async handleUpdateRoute(groupId: string, routeId: string, data: any) {
        await this.configManager.updateRoute(groupId, routeId, data);
        await this.refresh();
    }

    private async handleDeleteRoute(groupId: string, routeId: string) {
        await this.configManager.removeRoute(groupId, routeId);
        const group = this.configManager.getConfig().proxyGroups.find(g => g.id === groupId);
        this.activeRouteId = group?.routes?.[0]?.id;
        await this.refresh();
    }

    private async handleAddMock(groupId: string, routeIdOrData: string | any, maybeData?: any) {
        const routeId = typeof routeIdOrData === 'string' ? (routeIdOrData || this.resolveRouteId(groupId)) : this.resolveRouteId(groupId);
        const data = typeof routeIdOrData === 'string' ? maybeData : routeIdOrData;
        await this.configManager.addMockApi(groupId, routeId, data);
        await this.refresh();
    }

    private async handleUpdateMock(groupId: string, routeIdOrIndex: string | number, indexOrData: number | any, maybeData?: any) {
        const routeId = typeof routeIdOrIndex === 'string' ? (routeIdOrIndex || this.resolveRouteId(groupId)) : this.resolveRouteId(groupId);
        const index = typeof routeIdOrIndex === 'string' ? indexOrData as number : routeIdOrIndex;
        const data = typeof routeIdOrIndex === 'string' ? maybeData : indexOrData;
        await this.configManager.updateMockApi(groupId, routeId, index, data);
        await this.refresh();
    }

    private async handleDeleteMock(groupId: string, routeIdOrIndex: string | number, maybeIndex?: number) {
        const routeId = typeof routeIdOrIndex === 'string' ? (routeIdOrIndex || this.resolveRouteId(groupId)) : this.resolveRouteId(groupId);
        const index = typeof routeIdOrIndex === 'string' ? maybeIndex as number : routeIdOrIndex;
        await this.configManager.removeMockApi(groupId, routeId, index);
        await this.refresh();
    }

    private async handleToggleMock(groupId: string, routeIdOrIndex: string | number, maybeIndex?: number) {
        const config = this.configManager.getConfig();
        const routeId = typeof routeIdOrIndex === 'string' ? (routeIdOrIndex || this.resolveRouteId(groupId)) : this.resolveRouteId(groupId);
        const index = typeof routeIdOrIndex === 'string' ? maybeIndex as number : routeIdOrIndex;
        const route = (config.proxyGroups.find(g => g.id === groupId)?.routes || []).find(r => r.id === routeId);
        if (route?.mockApis[index]) {
            route.mockApis[index].enabled = !route.mockApis[index].enabled;
            await this.configManager.saveConfig(config);
            await this.refresh();
        }
    }

    private async refresh() {
        if (!this.panel) return;
        const config = this.configManager.getConfig();
        const groupStatuses: { [groupId: string]: boolean } = {};
        config.proxyGroups.forEach(group => {
            groupStatuses[group.id] = this.mockServerManager.getGroupStatus(group.id);
        });
        await this.panel.webview.postMessage({
            type: 'configUpdated',
            config,
            activeGroupId: this.activeGroupId || config.proxyGroups[0]?.id,
            activeRouteId: this.activeRouteId || config.proxyGroups[0]?.routes?.[0]?.id,
            isRunning: this.mockServerManager.getStatus(),
            groupStatuses,
        });
        await this.sidebarBridge?.refreshExternal();
    }

    private async syncSidebarSelection() {
        await this.sidebarBridge?.syncSelection(this.activeGroupId, this.activeRouteId);
    }

    private getHtml(webview: vscode.Webview): string {
        const config = this.configManager.getConfig();
        const isRunning = this.mockServerManager.getStatus();
        if (!this.activeGroupId && config.proxyGroups.length > 0) {
            this.activeGroupId = config.proxyGroups[0].id;
            this.activeRouteId = config.proxyGroups[0].routes?.[0]?.id;
        }

        const codiconsFontUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'codicon.ttf'));
        const codiconsCssUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'codicon.css'));
        const reactAppUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'app.js'));
        const nonce = this.getNonce();

        const i18nKeys = [
            'ui.startAll', 'ui.stopAll', 'ui.startServer', 'ui.stopServer', 'ui.settings',
            'ui.add', 'ui.edit', 'ui.delete', 'ui.enable', 'ui.disable', 'ui.save', 'ui.cancel',
            'ui.format', 'ui.validate', 'ui.groupName', 'ui.enabled', 'ui.port', 'ui.interceptPrefix', 'ui.baseUrl', 'ui.stripPrefix',
            'ui.globalCookie', 'ui.method', 'ui.path', 'ui.statusCode', 'ui.responseBody', 'ui.delay',
            'ui.protocol', 'ui.protocol.http', 'ui.protocol.ws', 'ui.wsBaseUrl', 'ui.wsInterceptPrefix', 'ui.wsManualPush',
            'ui.wssEnabled', 'ui.wssKeystorePath', 'ui.wssKeystorePassword', 'ui.section.group', 'ui.section.http', 'ui.section.ws',
            'ui.wsPanel.title', 'ui.wsPanel.rules', 'ui.wsPanel.sendSelected', 'ui.wsPanel.target.match', 'ui.wsPanel.target.all',
            'ui.wsPanel.target.recent', 'ui.wsPanel.customMessage', 'ui.wsPanel.send', 'ui.wsPanel.noRules', 'ui.addWsRule', 'ui.editWsRule',
            'ui.wsRule.mode', 'ui.wsRule.mode.off', 'ui.wsRule.mode.periodic', 'ui.wsRule.mode.timeline', 'ui.wsRule.event.key',
            'ui.wsRule.event.value', 'ui.wsRule.direction', 'ui.wsRule.direction.both', 'ui.wsRule.direction.in', 'ui.wsRule.direction.out',
            'ui.wsRule.onOpen', 'ui.wsRule.intercept', 'ui.wsRule.period.sec', 'ui.wsRule.timeline.secList', 'ui.wsRule.message',
            'ui.wsRule.section.basic', 'ui.wsRule.timeline.empty', 'ui.wsRule.timeline.add', 'ui.wsRule.timeline.edit',
            'ui.wsRule.timeline.delete', 'ui.wsRule.timeline.editor.addTitle', 'ui.wsRule.timeline.editor.editTitle',
            'ui.wsRule.timeline.editor.atMs', 'ui.wsRule.timeline.editor.message', 'ui.wsRule.timeline.editor.save',
            'ui.wsRule.timeline.editor.cancel', 'ui.yes', 'ui.no', 'ui.notSet', 'ui.addProxyGroup', 'ui.editProxyGroup',
            'ui.addMockApi', 'ui.editMockApi', 'ui.running', 'ui.stopped', 'ui.mockApis', 'ui.noMockApis', 'ui.clickAddToCreate',
            'ui.deleteProxyGroup', 'ui.deleteMockApi', 'ui.jsonFormatted', 'ui.jsonValid', 'ui.jsonInvalid',
            'ui.groupNamePlaceholder', 'ui.baseUrlPlaceholder', 'ui.pathPlaceholder', 'ui.responsePlaceholder', 'ui.globalCookiePlaceholder',
            'ui.proxyControl', 'ui.navigator', 'ui.navigatorHint', 'ui.openWorkspace', 'ui.proxyGroups', 'ui.expand', 'ui.collapse', 'ui.openInPanel', 'ui.schema', 'ui.routes', 'ui.route', 'ui.mocks',
            'ui.mockOn', 'ui.mockOff', 'ui.routeDetail', 'ui.noActiveGroup', 'ui.noRouteSelected', 'ui.noRoutesConfigured',
            'ui.routeSelectionHint', 'ui.listenerSharedHint', 'ui.routeMatchHint', 'ui.routePrefix', 'ui.targetBaseUrl', 'ui.enableMock',
            'ui.cookieUsed', 'ui.cookieUnused', 'ui.routeModalHint', 'ui.addRoute', 'ui.editRoute', 'ui.groupModalTitle', 'ui.groupModalHint', 'ui.listenerExtras',
            'ui.close', 'ui.mockModalTitle', 'ui.mockModalHint',
            'noWorkspace.title', 'noWorkspace.message',
        ];
        const i18n = Object.fromEntries(i18nKeys.map(k => [k, vscode.l10n.t(k as any)]));

        const groupStatuses: { [groupId: string]: boolean } = {};
        config.proxyGroups.forEach(group => {
            groupStatuses[group.id] = this.mockServerManager.getGroupStatus(group.id);
        });

        const initialData = {
            config,
            activeGroupId: this.activeGroupId || config.proxyGroups[0]?.id,
            activeRouteId: this.activeRouteId || config.proxyGroups[0]?.routes?.[0]?.id,
            isRunning,
            groupStatuses,
            i18n,
            viewKind: 'panel' as const,
            panelAction: null,
        };

        return buildReactWebviewHtml({
            nonce,
            codiconsFontUri: codiconsFontUri.toString(),
            codiconsCssUri: codiconsCssUri.toString(),
            appJsUri: reactAppUri.toString(),
            initialDataJson: JSON.stringify(initialData),
            cspSource: (webview as any).cspSource ?? undefined,
        });
    }

    private createDefaultRoute(): HttpRoute {
        return {
            id: uuidv4(),
            name: 'API',
            pathPrefix: '/api',
            targetBaseUrl: 'http://localhost:8080',
            stripPrefix: true,
            enableMock: true,
            mockApis: [],
        };
    }

    private resolveRouteId(groupId: string): string {
        return this.configManager.getConfig().proxyGroups.find(g => g.id === groupId)?.routes?.[0]?.id || '';
    }

    private getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
