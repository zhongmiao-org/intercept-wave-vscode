import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
    ConfigManager,
    HttpRoute,
    LOCAL_CERTIFICATE_PASSWORD,
    LOCAL_CERTIFICATE_RELATIVE_PATH,
    MockServerManager,
    ProxyGroup,
    buildReactWebviewHtml,
    generateLocalPkcs12Certificate,
    resolveLocalCertificatePath,
} from '../common';
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
                case 'chooseStaticRoot':
                    await this.handleChooseStaticRoot(data.current);
                    break;
                case 'chooseHttpsKeystore':
                    await this.handleChooseHttpsKeystore(data.current);
                    break;
                case 'generateLocalCertificate':
                    await this.handleGenerateLocalCertificate(data.path, data.password);
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
        const validationError = this.validateGroupData(data);
        if (validationError) {
            await this.notify('error', validationError);
            return;
        }
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
            httpsEnabled: data.httpsEnabled === true,
            httpsKeystorePath: typeof data.httpsKeystorePath === 'string' ? data.httpsKeystorePath.trim() : '',
            httpsKeystorePassword: typeof data.httpsKeystorePassword === 'string' ? data.httpsKeystorePassword : '',
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
        const existing = this.configManager.getConfig().proxyGroups.find(g => g.id === groupId);
        const validationError = this.validateGroupData({ ...existing, ...data }, groupId);
        if (validationError) {
            await this.notify('error', validationError);
            return;
        }
        await this.configManager.updateProxyGroup(groupId, data);
        await this.refresh();
    }

    private validateGroupData(data: any, editingGroupId?: string): string | null {
        if (!data.name || String(data.name).trim() === '') return vscode.l10n.t('error.emptyGroupName');
        const config = this.configManager.getConfig();
        const name = String(data.name).trim();
        const sameName = config.proxyGroups.find(g => g.name.trim() === name && g.id !== editingGroupId);
        if (sameName) return vscode.l10n.t('error.duplicateGroupName', name);
        const port = parseInt(data.port, 10);
        if (isNaN(port) || port < 1024 || port > 65535) return vscode.l10n.t('error.invalidPort');
        const conflict = config.proxyGroups.find(g => g.port === port && g.id !== editingGroupId);
        if (conflict) return vscode.l10n.t('error.portInUse', port.toString(), conflict.name);
        if (data.protocol !== 'WS' && data.httpsEnabled === true) {
            if (!String(data.httpsKeystorePath || '').trim()) return vscode.l10n.t('error.httpsKeystorePathRequired');
            if (!String(data.httpsKeystorePassword || '')) return vscode.l10n.t('error.httpsKeystorePasswordRequired');
        }
        return null;
    }

    private async handleDeleteGroup(groupId: string) {
        await this.configManager.removeProxyGroup(groupId);
        const config = this.configManager.getConfig();
        this.activeGroupId = config.proxyGroups[0]?.id;
        this.activeRouteId = config.proxyGroups[0]?.routes?.[0]?.id;
        await this.refresh();
    }

    private async handleAddRoute(groupId: string, data: any) {
        const error = this.validateRouteData(groupId, data);
        if (error) {
            await this.notify('error', error);
            return;
        }
        const route: HttpRoute = {
            id: uuidv4(),
            name: data.name,
            pathPrefix: data.pathPrefix,
            targetType: data.targetType === 'STATIC' ? 'STATIC' : 'PROXY',
            targetBaseUrl: data.targetBaseUrl,
            staticRoot: typeof data.staticRoot === 'string' ? data.staticRoot.trim() : '',
            stripPrefix: data.stripPrefix,
            rewriteTargetPath: typeof data.rewriteTargetPath === 'string' ? data.rewriteTargetPath.trim() : '',
            spaFallbackPath: this.normalizeSpaFallbackPath(data),
            spaFallback: data.targetType === 'STATIC' ? data.spaFallback === true : false,
            requestHeaders: Array.isArray(data.requestHeaders) ? data.requestHeaders : [],
            responseHeaders: Array.isArray(data.responseHeaders) ? data.responseHeaders : [],
            enableMock: data.enableMock,
            mockApis: [],
        };
        await this.configManager.addRoute(groupId, route);
        this.activeRouteId = route.id;
        await this.refresh();
    }

    private async handleUpdateRoute(groupId: string, routeId: string, data: any) {
        const existing = (this.configManager.getConfig().proxyGroups.find(g => g.id === groupId)?.routes || []).find(route => route.id === routeId);
        const nextData = { ...existing, ...data };
        const error = this.validateRouteData(groupId, nextData, routeId);
        if (error) {
            await this.notify('error', error);
            return;
        }
        await this.configManager.updateRoute(groupId, routeId, data);
        await this.refresh();
    }

    private normalizeSpaFallbackPath(data: any): string {
        if (typeof data?.spaFallbackPath === 'string') {
            const trimmed = data.spaFallbackPath.trim();
            if (!trimmed) return '';
            return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
        }
        return '';
    }

    private async handleChooseStaticRoot(current?: string) {
        const workspaceRoot = this.getWorkspaceRoot();
        const defaultUri = vscode.Uri.file(this.resolveStaticRootForUi(String(current || ''), workspaceRoot));
        const selected = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri,
            openLabel: vscode.l10n.t('ui.chooseFolder'),
        });
        const folder = selected?.[0]?.fsPath;
        if (!folder || !this.panel) return;
        await this.panel.webview.postMessage({
            type: 'staticRootSelected',
            staticRoot: this.toStoredStaticRoot(folder, workspaceRoot),
        });
    }

    private resolveStaticRootForUi(current: string, workspaceRoot: string): string {
        const trimmed = current.trim();
        if (!trimmed) return workspaceRoot;
        return path.isAbsolute(trimmed) ? trimmed : path.resolve(workspaceRoot, trimmed);
    }

    private toStoredStaticRoot(selectedPath: string, workspaceRoot: string): string {
        const relative = path.relative(workspaceRoot, selectedPath);
        if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
            return relative.split(path.sep).join('/');
        }
        if (relative === '') {
            return '.';
        }
        return selectedPath;
    }

    private async handleChooseHttpsKeystore(current?: string) {
        const workspaceRoot = this.getWorkspaceRoot();
        const defaultUri = vscode.Uri.file(this.resolveProjectPathForUi(String(current || ''), workspaceRoot));
        const selected = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            defaultUri,
            openLabel: vscode.l10n.t('ui.chooseFile'),
            filters: {
                'PKCS#12': ['p12', 'pfx'],
                'All Files': ['*'],
            },
        });
        const file = selected?.[0]?.fsPath;
        if (!file || !this.panel) return;
        await this.panel.webview.postMessage({
            type: 'httpsKeystoreSelected',
            httpsKeystorePath: this.toStoredProjectPath(file, workspaceRoot),
        });
    }

    private async handleGenerateLocalCertificate(rawPath?: string, rawPassword?: string) {
        const workspaceRoot = this.getWorkspaceRoot();
        const targetPath = resolveLocalCertificatePath(workspaceRoot, String(rawPath || LOCAL_CERTIFICATE_RELATIVE_PATH));
        const password = String(rawPassword || LOCAL_CERTIFICATE_PASSWORD);
        const overwrite = await this.confirmCertificateOverwrite(targetPath);
        if (overwrite === undefined) return;

        try {
            const result = generateLocalPkcs12Certificate(workspaceRoot, targetPath, password, overwrite);
            await this.panel?.webview.postMessage({
                type: 'httpsCertificateGenerated',
                httpsKeystorePath: result.relativePath,
                httpsKeystorePassword: result.password,
                httpsEnabled: true,
            });
            await this.notify('info', vscode.l10n.t('success.httpsCertificateGenerated', result.relativePath));
        } catch (error: any) {
            await this.notify('error', vscode.l10n.t('error.httpsCertificateGenerationFailed', error?.message || error));
        }
    }

    private async confirmCertificateOverwrite(targetPath: string): Promise<boolean | undefined> {
        if (!this.panel) return undefined;
        if (!path.basename(targetPath)) return undefined;
        if (!fs.existsSync(targetPath)) return false;
        const overwrite = vscode.l10n.t('ui.overwrite');
        const choice = await vscode.window.showWarningMessage(
            vscode.l10n.t('warning.httpsCertificateExists', targetPath),
            { modal: true },
            overwrite,
            vscode.l10n.t('ui.cancel')
        );
        return choice === overwrite ? true : undefined;
    }

    private resolveProjectPathForUi(current: string, workspaceRoot: string): string {
        const trimmed = current.trim();
        if (!trimmed) return workspaceRoot;
        return path.isAbsolute(trimmed) ? trimmed : path.resolve(workspaceRoot, trimmed);
    }

    private toStoredProjectPath(selectedPath: string, workspaceRoot: string): string {
        const relative = path.relative(workspaceRoot, selectedPath);
        if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
            return relative.split(path.sep).join('/');
        }
        if (relative === '') {
            return '.';
        }
        return selectedPath;
    }

    private getWorkspaceRoot(): string {
        const manager = this.configManager as any;
        if (typeof manager.getWorkspaceRoot === 'function') {
            return manager.getWorkspaceRoot();
        }
        if (typeof manager.getConfigPath === 'function') {
            return path.resolve(path.dirname(manager.getConfigPath()), '..');
        }
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    }

    private validateRouteData(groupId: string, data: any, editingRouteId?: string): string | null {
        const group = this.configManager.getConfig().proxyGroups.find(g => g.id === groupId);
        if (!group) return vscode.l10n.t('error.groupNotFound');
        if (!data.name || String(data.name).trim() === '') return vscode.l10n.t('error.routeNameRequired');
        if (!data.pathPrefix || String(data.pathPrefix).trim() === '') return vscode.l10n.t('error.routePathPrefixRequired');
        const targetType = data.targetType === 'STATIC' ? 'STATIC' : 'PROXY';
        if (targetType === 'STATIC') {
            if (!data.staticRoot || String(data.staticRoot).trim() === '') return vscode.l10n.t('error.routeStaticRootRequired');
        } else if (!data.targetBaseUrl || String(data.targetBaseUrl).trim() === '') {
            return vscode.l10n.t('error.routeTargetBaseUrlRequired');
        }
        const pathPrefix = String(data.pathPrefix).trim();
        const exists = (group.routes || []).some(route => route.id !== editingRouteId && route.pathPrefix.trim() === pathPrefix);
        if (exists) return vscode.l10n.t('error.routePathPrefixExists', pathPrefix);
        return this.validateHeaderOverrideRules(data);
    }

    private validateHeaderOverrideRules(data: any): string | null {
        const rules = [
            ...(Array.isArray(data.requestHeaders) ? data.requestHeaders : []),
            ...(Array.isArray(data.responseHeaders) ? data.responseHeaders : []),
        ];
        for (const rule of rules) {
            if (!rule) continue;
            const name = String(rule.name || '').trim();
            const operation = String(rule.operation || 'SET').trim().toUpperCase();
            const value = String(rule.value || '');
            if (!name) return vscode.l10n.t('error.headerRuleNameRequired');
            if ((operation === 'ADD' || operation === 'SET') && value.trim() === '') {
                return vscode.l10n.t('error.headerRuleValueRequired');
            }
        }
        return null;
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
            'ui.mockTemplate', 'ui.mockTemplateHint', 'ui.applyTemplate', 'ui.mockTemplate.success', 'ui.mockTemplate.pagination', 'ui.mockTemplate.empty', 'ui.mockTemplate.error', 'ui.mockTemplate.authExpired',
            'ui.protocol', 'ui.protocol.http', 'ui.protocol.ws', 'ui.wsBaseUrl', 'ui.wsInterceptPrefix', 'ui.wsManualPush',
            'ui.wssEnabled', 'ui.wssKeystorePath', 'ui.wssKeystorePassword', 'ui.section.group', 'ui.section.http', 'ui.section.ws',
            'ui.httpsEnabled', 'ui.httpsKeystorePath', 'ui.httpsKeystorePassword', 'ui.httpsSection', 'ui.httpsHint', 'ui.httpsExternalWarning', 'ui.generateLocalCertificate', 'ui.httpsLocalCertificateWarning', 'ui.chooseFile', 'ui.overwrite',
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
            'ui.targetType', 'ui.targetType.proxy', 'ui.targetType.static', 'ui.staticRoot', 'ui.staticRootHint', 'ui.staticRootExternalHint', 'ui.chooseFolder',
            'ui.rewriteTargetPath', 'ui.rewriteTargetPathHint', 'ui.spaFallbackPath', 'ui.spaFallbackPathHint', 'ui.spaFallback', 'ui.spaFallbackHint',
            'ui.headerOverrides', 'ui.requestHeaders', 'ui.responseHeaders', 'ui.headerRuleEnabled', 'ui.headerRuleOperation', 'ui.headerRuleName', 'ui.headerRuleValue',
            'ui.addHeaderRule', 'ui.removeHeaderRule', 'ui.headerOperation.add', 'ui.headerOperation.set', 'ui.headerOperation.remove', 'ui.restrictedRequestHeaderHint', 'ui.restrictedResponseHeaderHint', 'ui.headerRulesHint',
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
            targetType: 'PROXY',
            targetBaseUrl: 'http://localhost:8080',
            staticRoot: '',
            stripPrefix: true,
            rewriteTargetPath: '',
            spaFallbackPath: '',
            spaFallback: false,
            requestHeaders: [],
            responseHeaders: [],
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
