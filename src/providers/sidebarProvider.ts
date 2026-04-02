import * as vscode from 'vscode';
import { ConfigManager, HttpRoute, MockServerManager, ProxyGroup, buildReactWebviewHtml } from '../common';
import { PanelProvider } from './panelProvider';
import { v4 as uuidv4 } from 'uuid';

export class SidebarProvider implements vscode.WebviewViewProvider {
    private webviewView?: vscode.WebviewView;
    private activeGroupId?: string;
    private activeRouteId?: string;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly mockServerManager: MockServerManager,
        private readonly configManager: ConfigManager,
        private readonly panelProvider?: PanelProvider
    ) {}

    public async refreshExternal() {
        await this.refreshWebview();
    }

    public async syncSelection(groupId?: string, routeId?: string) {
        this.activeGroupId = groupId;
        this.activeRouteId = routeId;
        await this.refreshWebview();
    }

    private async notify(level: 'info' | 'warn' | 'error', text: string) {
        try {
            if (this.webviewView) {
                await this.webviewView.webview.postMessage({ type: 'notify', level, text });
            }
        } catch {
            // ignore
        }
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this.webviewView = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };
        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(async data => {
            await this.handleMessage(data);
        });
    }

    private async handleMessage(data: any) {
        try {
            switch (data.type) {
                case 'openPanel':
                    this.activeGroupId = data.action?.groupId || this.activeGroupId;
                    this.activeRouteId = data.action?.routeId || this.activeRouteId;
                    if (this.panelProvider) {
                        await this.panelProvider.focusWithAction(data.action);
                    } else {
                        await vscode.commands.executeCommand('interceptWave.openFullView');
                    }
                    break;
                case 'openConfig':
                    await vscode.commands.executeCommand('interceptWave.openConfig');
                    break;
                case 'webviewReady':
                    await this.refreshWebview();
                    break;
                case 'setActiveGroup':
                    this.activeGroupId = data.groupId;
                    if (data.routeId) {
                        this.activeRouteId = data.routeId;
                    }
                    break;
                case 'setActiveRoute':
                    this.activeRouteId = data.routeId;
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
        if (!group) {
            const msg = vscode.l10n.t('error.ws.groupNotFound');
            void vscode.window.showErrorMessage(msg);
            await this.notify('error', msg);
            return;
        }

        let nextRules = Array.isArray(group.wsPushRules) ? [...group.wsPushRules] : [];
        if (Array.isArray(rules)) {
            nextRules = rules as any[];
        } else if (typeof rulesIndexToDelete === 'number' && rulesIndexToDelete >= 0 && rulesIndexToDelete < nextRules.length) {
            nextRules.splice(rulesIndexToDelete, 1);
        }

        await this.configManager.updateProxyGroup(groupId, { wsPushRules: nextRules as any });
        await this.refreshWebview();
    }

    private async handleWsManualPushByRule(groupId: string, ruleIndex: number, target: 'match' | 'all' | 'recent') {
        const config = this.configManager.getConfig();
        const group = config.proxyGroups.find(g => g.id === groupId);
        if (!group) {
            const msg = vscode.l10n.t('error.ws.groupNotFound');
            void vscode.window.showErrorMessage(msg);
            await this.notify('error', msg);
            return;
        }
        const rule = (group.wsPushRules || [])[ruleIndex] as any;
        if (!rule) {
            const msg = vscode.l10n.t('error.ws.ruleNotFound');
            void vscode.window.showErrorMessage(msg);
            await this.notify('error', msg);
            return;
        }
        const ok = await this.mockServerManager.manualPushByRule(groupId, rule, target);
        if (!ok) {
            const msg = vscode.l10n.t('error.ws.noActiveConnection');
            void vscode.window.showErrorMessage(msg);
            await this.notify('error', msg);
            return;
        }
        const info = vscode.l10n.t('success.ws.manualPushed');
        void vscode.window.showInformationMessage(info);
        await this.notify('info', info);
    }

    private async handleWsManualPushCustom(groupId: string, target: 'match' | 'all' | 'recent', payload: string) {
        const ok = await this.mockServerManager.manualPushCustom(groupId, payload, target);
        if (!ok) {
            const msg = vscode.l10n.t('error.ws.noActiveConnection');
            void vscode.window.showErrorMessage(msg);
            await this.notify('error', msg);
            return;
        }
        const info = vscode.l10n.t('success.ws.manualPushed');
        void vscode.window.showInformationMessage(info);
        await this.notify('info', info);
    }

    private async handleStartServer() {
        try {
            const url = await this.mockServerManager.start();
            void vscode.window.showInformationMessage(vscode.l10n.t('success.serversStarted', url));
            await this.refreshWebview();
        } catch (error: any) {
            void vscode.window.showErrorMessage(vscode.l10n.t('error.failedToStart', error.message));
            await this.notify('error', vscode.l10n.t('error.failedToStart', error.message));
        }
    }

    private async handleStopServer() {
        try {
            await this.mockServerManager.stop();
            void vscode.window.showInformationMessage(vscode.l10n.t('success.serversStopped'));
            await this.refreshWebview();
        } catch (error: any) {
            void vscode.window.showErrorMessage(vscode.l10n.t('error.failedToStop', error.message));
            await this.notify('error', vscode.l10n.t('error.failedToStop', error.message));
            await this.refreshWebview();
        }
    }

    private async handleStartGroup(groupId: string) {
        try {
            const url = await this.mockServerManager.startGroupById(groupId);
            void vscode.window.showInformationMessage(vscode.l10n.t('success.serversStarted', url));
            await this.refreshWebview();
        } catch (error: any) {
            void vscode.window.showErrorMessage(vscode.l10n.t('error.failedToStart', error.message));
            await this.notify('error', vscode.l10n.t('error.failedToStart', error.message));
            await this.refreshWebview();
        }
    }

    private async handleStopGroup(groupId: string) {
        try {
            await this.mockServerManager.stopGroupById(groupId);
            void vscode.window.showInformationMessage(vscode.l10n.t('success.serversStopped'));
            await this.refreshWebview();
        } catch (error: any) {
            void vscode.window.showErrorMessage(vscode.l10n.t('error.failedToStop', error.message));
            await this.notify('error', vscode.l10n.t('error.failedToStop', error.message));
            await this.refreshWebview();
        }
    }

    private async handleAddGroup(data: any) {
        const validationError = this.validateGroupData(data);
        if (validationError) {
            void vscode.window.showErrorMessage(validationError);
            await this.notify('error', validationError);
            return;
        }

        const route = this.createDefaultRoute();
        const newGroup: ProxyGroup = {
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

        await this.configManager.addProxyGroup(newGroup);
        this.activeGroupId = newGroup.id;
        this.activeRouteId = route.id;
        await this.refreshWebview();
    }

    private async handleUpdateGroup(groupId: string, data: any) {
        const validationError = this.validateGroupData(data, groupId);
        if (validationError) {
            void vscode.window.showErrorMessage(validationError);
            await this.notify('error', validationError);
            return;
        }
        await this.configManager.updateProxyGroup(groupId, data);
        await this.refreshWebview();
    }

    private async handleDeleteGroup(groupId: string) {
        const config = this.configManager.getConfig();
        if (config.proxyGroups.length <= 1) {
            void vscode.window.showWarningMessage(vscode.l10n.t('error.cannotDeleteLastGroup'));
            return;
        }
        await this.configManager.removeProxyGroup(groupId);
        const updatedConfig = this.configManager.getConfig();
        this.activeGroupId = updatedConfig.proxyGroups[0]?.id;
        this.activeRouteId = updatedConfig.proxyGroups[0]?.routes?.[0]?.id;
        await this.refreshWebview();
    }

    private async handleAddRoute(groupId: string, data: any) {
        const error = this.validateRouteData(groupId, data);
        if (error) {
            void vscode.window.showErrorMessage(error);
            await this.notify('error', error);
            return;
        }
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
        await this.refreshWebview();
    }

    private async handleUpdateRoute(groupId: string, routeId: string, data: any) {
        const error = this.validateRouteData(groupId, data, routeId);
        if (error) {
            void vscode.window.showErrorMessage(error);
            await this.notify('error', error);
            return;
        }
        await this.configManager.updateRoute(groupId, routeId, data);
        await this.refreshWebview();
    }

    private async handleDeleteRoute(groupId: string, routeId: string) {
        const group = this.configManager.getConfig().proxyGroups.find(g => g.id === groupId);
        if (!group) return;
        if ((group.routes || []).length <= 1) {
            void vscode.window.showWarningMessage(vscode.l10n.t('error.routeRequired'));
            return;
        }
        await this.configManager.removeRoute(groupId, routeId);
        const updated = this.configManager.getConfig().proxyGroups.find(g => g.id === groupId);
        this.activeRouteId = updated?.routes?.[0]?.id;
        await this.refreshWebview();
    }

    private async handleAddMock(groupId: string, routeIdOrData: string | any, maybeData?: any) {
        const resolvedRouteId = typeof routeIdOrData === 'string' ? (routeIdOrData || this.resolveRouteId(groupId)) : this.resolveRouteId(groupId);
        const data = typeof routeIdOrData === 'string' ? maybeData : routeIdOrData;
        const error = this.validateMockData(groupId, resolvedRouteId, data);
        if (error) {
            void vscode.window.showErrorMessage(error);
            await this.notify('error', error);
            return;
        }
        await this.configManager.addMockApi(groupId, resolvedRouteId, data);
        await this.refreshWebview();
    }

    private async handleUpdateMock(groupId: string, routeIdOrIndex: string | number, indexOrData: number | any, maybeData?: any) {
        const resolvedRouteId = typeof routeIdOrIndex === 'string' ? (routeIdOrIndex || this.resolveRouteId(groupId)) : this.resolveRouteId(groupId);
        const index = typeof routeIdOrIndex === 'string' ? indexOrData as number : routeIdOrIndex;
        const data = typeof routeIdOrIndex === 'string' ? maybeData : indexOrData;
        const error = this.validateMockData(groupId, resolvedRouteId, data, index);
        if (error) {
            void vscode.window.showErrorMessage(error);
            await this.notify('error', error);
            return;
        }
        await this.configManager.updateMockApi(groupId, resolvedRouteId, index, data);
        await this.refreshWebview();
    }

    private async handleDeleteMock(groupId: string, routeIdOrIndex: string | number, maybeIndex?: number) {
        const resolvedRouteId = typeof routeIdOrIndex === 'string' ? (routeIdOrIndex || this.resolveRouteId(groupId)) : this.resolveRouteId(groupId);
        const index = typeof routeIdOrIndex === 'string' ? maybeIndex as number : routeIdOrIndex;
        await this.configManager.removeMockApi(groupId, resolvedRouteId, index);
        await this.refreshWebview();
    }

    private async handleToggleMock(groupId: string, routeIdOrIndex: string | number, maybeIndex?: number) {
        const config = this.configManager.getConfig();
        const resolvedRouteId = typeof routeIdOrIndex === 'string' ? (routeIdOrIndex || this.resolveRouteId(groupId)) : this.resolveRouteId(groupId);
        const index = typeof routeIdOrIndex === 'string' ? maybeIndex as number : routeIdOrIndex;
        const group = config.proxyGroups.find(g => g.id === groupId);
        const route = (group?.routes || []).find(r => r.id === resolvedRouteId);
        if (route && route.mockApis[index]) {
            route.mockApis[index].enabled = !route.mockApis[index].enabled;
            await this.configManager.saveConfig(config);
            await this.refreshWebview();
        } else if (group?.mockApis?.[index]) {
            group.mockApis[index].enabled = !group.mockApis[index].enabled;
            await this.configManager.saveConfig(config);
            await this.refreshWebview();
        }
    }

    private async refreshWebview() {
        if (!this.webviewView) return;
        const config = this.configManager.getConfig();
        const groupStatuses: { [groupId: string]: boolean } = {};
        config.proxyGroups.forEach(group => {
            groupStatuses[group.id] = this.mockServerManager.getGroupStatus(group.id);
        });
        await this.webviewView.webview.postMessage({
            type: 'configUpdated',
            config,
            activeGroupId: this.activeGroupId || config.proxyGroups[0]?.id,
            activeRouteId: this.activeRouteId || config.proxyGroups[0]?.routes?.[0]?.id,
            isRunning: this.mockServerManager.getStatus(),
            groupStatuses,
        });
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
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
            viewKind: 'sidebar' as const,
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

    private validateGroupData(data: any, editingGroupId?: string): string | null {
        if (!data.name || data.name.trim() === '') {
            return vscode.l10n.t('error.emptyGroupName');
        }
        const name = String(data.name).trim();
        const config = this.configManager.getConfig();
        const sameName = config.proxyGroups.find(g => g.name.trim() === name && g.id !== editingGroupId);
        if (sameName) {
            return vscode.l10n.t('error.duplicateGroupName', name);
        }
        const port = parseInt(data.port, 10);
        if (isNaN(port) || port < 1024 || port > 65535) {
            return vscode.l10n.t('error.invalidPort');
        }
        const conflict = config.proxyGroups.find(g => g.port === port && g.id !== editingGroupId);
        if (conflict) {
            return vscode.l10n.t('error.portInUse', port.toString(), conflict.name);
        }
        return null;
    }

    private validateRouteData(groupId: string, data: any, editingRouteId?: string): string | null {
        const group = this.configManager.getConfig().proxyGroups.find(g => g.id === groupId);
        if (!group) return vscode.l10n.t('error.groupNotFound');
        if (!data.name || String(data.name).trim() === '') return vscode.l10n.t('error.routeNameRequired');
        if (!data.pathPrefix || String(data.pathPrefix).trim() === '') return vscode.l10n.t('error.routePathPrefixRequired');
        if (!data.targetBaseUrl || String(data.targetBaseUrl).trim() === '') return vscode.l10n.t('error.routeTargetBaseUrlRequired');
        const pathPrefix = String(data.pathPrefix).trim();
        const exists = (group.routes || []).some(route => route.id !== editingRouteId && route.pathPrefix.trim() === pathPrefix);
        return exists ? vscode.l10n.t('error.routePathPrefixExists', pathPrefix) : null;
    }

    private validateMockData(groupId: string, routeId: string, data: any, editingIndex?: number): string | null {
        const route = (this.configManager.getConfig().proxyGroups.find(g => g.id === groupId)?.routes || []).find(r => r.id === routeId);
        if (!route) return vscode.l10n.t('error.routeNotFound');
        const newPath = String(data.path || '').trim();
        const newMethod = String(data.method || '').toUpperCase();
        const exists = (route.mockApis || []).some((api, index) =>
            index !== editingIndex && String(api.path || '').trim() === newPath && String(api.method || '').toUpperCase() === newMethod
        );
        return exists ? vscode.l10n.t('error.mockRouteExists', newMethod, newPath) : null;
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
