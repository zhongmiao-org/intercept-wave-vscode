import * as vscode from 'vscode';
import { MockServerManager, ProxyGroup, ConfigManager, buildReactWebviewHtml } from '../common';
import { PanelProvider } from './panelProvider';
import { v4 as uuidv4 } from 'uuid';

export class SidebarProvider implements vscode.WebviewViewProvider {
    private webviewView?: vscode.WebviewView;
    private activeGroupId?: string;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly mockServerManager: MockServerManager,
        private readonly configManager: ConfigManager,
        private readonly panelProvider?: PanelProvider
    ) {}

    private async notify(level: 'info' | 'warn' | 'error', text: string) {
        try {
            if (this.webviewView) {
                await this.webviewView.webview.postMessage({ type: 'notify', level, text });
            }
        } catch {
            // ignore notify errors
        }
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this.webviewView = webviewView;

        try {
            webviewView.webview.options = {
                enableScripts: true,
                localResourceRoots: [this.extensionUri],
            };
            webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

            webviewView.webview.onDidReceiveMessage(async data => {
                await this.handleMessage(data, webviewView);
            });
        } catch (error: any) {
            void vscode.window.showErrorMessage(
                `Failed to load Intercept Wave view: ${error.message}`
            );
        }
    }

    private async handleMessage(data: any, webviewView: vscode.WebviewView) {
        try {
            switch (data.type) {
                case 'openPanel': {
                    const action = data.action;
                    if (this.panelProvider) {
                        await this.panelProvider.focusWithAction(action);
                    } else {
                        await vscode.commands.executeCommand('interceptWave.openFullView');
                    }
                    break;
                }
                case 'openConfig':
                    await vscode.commands.executeCommand('interceptWave.openConfig');
                    break;
                case 'webviewReady':
                    await this.refreshWebview();
                    break;
                case 'setActiveGroup':
                    this.activeGroupId = data.groupId;
                    break;
                case 'startServer':
                    await this.handleStartServer(webviewView);
                    break;
                case 'stopServer':
                    await this.handleStopServer(webviewView);
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
                case 'addMock':
                    await this.handleAddMock(data.groupId, data.data);
                    break;
                case 'updateMock':
                    await this.handleUpdateMock(data.groupId, data.index, data.data);
                    break;
                case 'deleteMock':
                    await this.handleDeleteMock(data.groupId, data.index);
                    break;
                case 'toggleMock':
                    await this.handleToggleMock(data.groupId, data.index);
                    break;
                case 'wsManualPushByRule':
                    await this.handleWsManualPushByRule(data.groupId, data.ruleIndex, data.target);
                    break;
                case 'wsManualPushCustom':
                    await this.handleWsManualPushCustom(data.groupId, data.target, data.payload);
                    break;
            }
        } catch (error: any) {
            void vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
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
        const rules = group.wsPushRules || [];
        const rule = rules[ruleIndex] as any;
        if (!rule) {
            const msg = vscode.l10n.t('error.ws.ruleNotFound');
            void vscode.window.showErrorMessage(msg);
            await this.notify('error', msg);
            return;
        }
        await this.mockServerManager.manualPushByRule(groupId, rule, target);
        const info = vscode.l10n.t('success.ws.manualPushed');
        void vscode.window.showInformationMessage(info);
        await this.notify('info', info);
    }

    private async handleWsManualPushCustom(groupId: string, target: 'match' | 'all' | 'recent', payload: string) {
        const config = this.configManager.getConfig();
        const group = config.proxyGroups.find(g => g.id === groupId);
        if (!group) {
            const msg = vscode.l10n.t('error.ws.groupNotFound');
            void vscode.window.showErrorMessage(msg);
            await this.notify('error', msg);
            return;
        }
        if (!payload || !payload.trim()) {
            const msg = vscode.l10n.t('error.ws.invalidMessage');
            void vscode.window.showErrorMessage(msg);
            await this.notify('error', msg);
            return;
        }
        await this.mockServerManager.manualPushCustom(groupId, payload, target);
        const info = vscode.l10n.t('success.ws.manualPushed');
        void vscode.window.showInformationMessage(info);
        await this.notify('info', info);
    }

    private async handleStartServer(_: vscode.WebviewView) {
        try {
            const url = await this.mockServerManager.start();
            void vscode.window.showInformationMessage(
                vscode.l10n.t('success.serversStarted', url)
            );
            await this.refreshWebview();
        } catch (error: any) {
            void vscode.window.showErrorMessage(
                vscode.l10n.t('error.failedToStart', error.message)
            );
            await this.notify('error', vscode.l10n.t('error.failedToStart', error.message));
        }
    }

    private async handleStopServer(_: vscode.WebviewView) {
        try {
            await this.mockServerManager.stop();
            void vscode.window.showInformationMessage(vscode.l10n.t('success.serversStopped'));
            await this.refreshWebview();
        } catch (error: any) {
            void vscode.window.showErrorMessage(
                vscode.l10n.t('error.failedToStop', error.message)
            );
            await this.notify('error', vscode.l10n.t('error.failedToStop', error.message));
            await this.refreshWebview();
        }
    }

    private async handleStartGroup(groupId: string) {
        try {
            const url = await this.mockServerManager.startGroupById(groupId);
            void vscode.window.showInformationMessage(
                vscode.l10n.t('success.serversStarted', url)
            );
            await this.refreshWebview();
        } catch (error: any) {
            void vscode.window.showErrorMessage(
                vscode.l10n.t('error.failedToStart', error.message)
            );
            await this.notify('error', vscode.l10n.t('error.failedToStart', error.message));
            await this.refreshWebview();
        }
    }

    private async handleStopGroup(groupId: string) {
        try {
            // Get group info before stopping
            const config = this.configManager.getConfig();
            const group = config.proxyGroups.find(g => g.id === groupId);

            await this.mockServerManager.stopGroupById(groupId);

            if (group) {
                const serverInfo = `${group.name}(:${group.port})`;
                void vscode.window.showInformationMessage(
                    vscode.l10n.t('success.groupStopped', serverInfo)
                );
            } else {
                void vscode.window.showInformationMessage(
                    vscode.l10n.t('success.serversStopped')
                );
            }
            await this.refreshWebview();
        } catch (error: any) {
            void vscode.window.showErrorMessage(
                vscode.l10n.t('error.failedToStop', error.message)
            );
            await this.notify('error', vscode.l10n.t('error.failedToStop', error.message));
            await this.refreshWebview();
        }
    }

    private async handleAddGroup(data: any) {
        // Validate group data
        const validationError = this.validateGroupData(data);
        if (validationError) {
            void vscode.window.showErrorMessage(validationError);
            await this.notify('error', validationError);
            return;
        }

        const newGroup: ProxyGroup = {
            id: uuidv4(),
            name: data.name,
            enabled: data.enabled,
            port: data.port,
            interceptPrefix: data.interceptPrefix,
            baseUrl: data.baseUrl,
            stripPrefix: data.stripPrefix,
            globalCookie: data.globalCookie,
            mockApis: [],
            protocol: data.protocol ?? 'HTTP',
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
        await this.refreshWebview();

        // Close form after success
        if (this.webviewView) {
            await this.webviewView.webview.postMessage({ type: 'closeGroupForm' });
        }

        void vscode.window.showInformationMessage(
            vscode.l10n.t('success.groupAdded', newGroup.name)
        );
    }

    private async handleUpdateGroup(groupId: string, data: any) {
        // Validate group data
        const validationError = this.validateGroupData(data, groupId);
        if (validationError) {
            void vscode.window.showErrorMessage(validationError);
            await this.notify('error', validationError);
            return;
        }

        await this.configManager.updateProxyGroup(groupId, data);
        await this.refreshWebview();

        // Close form after success
        if (this.webviewView) {
            await this.webviewView.webview.postMessage({ type: 'closeGroupForm' });
        }

        void vscode.window.showInformationMessage(vscode.l10n.t('success.groupUpdated'));
    }

    private async handleDeleteGroup(groupId: string) {
        const config = this.configManager.getConfig();
        if (config.proxyGroups.length <= 1) {
            void vscode.window.showWarningMessage(
                vscode.l10n.t('error.cannotDeleteLastGroup')
            );
            return;
        }

        // Show confirmation dialog
        const answer = await vscode.window.showWarningMessage(
            vscode.l10n.t('ui.deleteProxyGroup'),
            { modal: true },
            vscode.l10n.t('ui.confirm')
        );

        if (answer !== vscode.l10n.t('ui.confirm')) {
            return; // User canceled
        }

        await this.configManager.removeProxyGroup(groupId);

        // Switch to first group if deleted group was active
        if (this.activeGroupId === groupId) {
            const updatedConfig = this.configManager.getConfig();
            this.activeGroupId = updatedConfig.proxyGroups[0].id;
        }

        await this.refreshWebview();
        void vscode.window.showInformationMessage(vscode.l10n.t('success.groupDeleted'));
    }

    private async handleAddMock(groupId: string, data: any) {
        // Validate duplicate path within group
        const cfg = this.configManager.getConfig();
        const group = cfg.proxyGroups.find(g => g.id === groupId);
        if (group) {
            const newPath = String(data.path || '').trim();
            const newMethod = String(data.method || '').toUpperCase();
            const exists = (group.mockApis || []).some(m =>
                String(m.path || '').trim() === newPath && String((m as any).method || '').toUpperCase() === newMethod
            );
            if (exists) {
                const msg = vscode.l10n.t('error.mockRouteExists', newMethod, newPath);
                void vscode.window.showErrorMessage(msg);
                await this.notify('error', msg);
                return;
            }
        }
        await this.configManager.addMockApi(groupId, data);
        await this.refreshWebview();
        if (this.webviewView) {
            await this.webviewView.webview.postMessage({ type: 'closeGroupForm' });
        }
        void vscode.window.showInformationMessage(vscode.l10n.t('success.mockAdded'));
    }

    private async handleUpdateMock(groupId: string, index: number, data: any) {
        // Validate duplicate path within group (ignore current index)
        const cfg = this.configManager.getConfig();
        const group = cfg.proxyGroups.find(g => g.id === groupId);
        if (group) {
            const newPath = String(data.path || '').trim();
            const newMethod = String(data.method || '').toUpperCase();
            const exists = (group.mockApis || []).some((m, i) =>
                i !== index && String(m.path || '').trim() === newPath && String((m as any).method || '').toUpperCase() === newMethod
            );
            if (exists) {
                const msg = vscode.l10n.t('error.mockRouteExists', newMethod, newPath);
                void vscode.window.showErrorMessage(msg);
                await this.notify('error', msg);
                return;
            }
        }
        await this.configManager.updateMockApi(groupId, index, data);
        await this.refreshWebview();
        if (this.webviewView) {
            await this.webviewView.webview.postMessage({ type: 'closeGroupForm' });
        }
        void vscode.window.showInformationMessage(vscode.l10n.t('success.mockUpdated'));
    }

    private async handleDeleteMock(groupId: string, index: number) {
        // Show confirmation dialog
        const answer = await vscode.window.showWarningMessage(
            vscode.l10n.t('ui.deleteMockApi'),
            { modal: true },
            vscode.l10n.t('ui.confirm')
        );

        if (answer !== vscode.l10n.t('ui.confirm')) {
            return; // User canceled
        }

        await this.configManager.removeMockApi(groupId, index);
        await this.refreshWebview();
        void vscode.window.showInformationMessage(vscode.l10n.t('success.mockDeleted'));
    }

    private async handleToggleMock(groupId: string, index: number) {
        const config = this.configManager.getConfig();
        const group = config.proxyGroups.find(g => g.id === groupId);
        if (group && group.mockApis[index]) {
            group.mockApis[index].enabled = !group.mockApis[index].enabled;
            await this.configManager.saveConfig(config);
            await this.refreshWebview();
        }
    }

    private async refreshWebview() {
        if (this.webviewView) {
            const config = this.configManager.getConfig();
            // Get status for each group
            const groupStatuses: { [groupId: string]: boolean } = {};
            config.proxyGroups.forEach(group => {
                groupStatuses[group.id] = this.mockServerManager.getGroupStatus(group.id);
            });

            const payload = {
                type: 'configUpdated',
                config,
                activeGroupId: this.activeGroupId || config.proxyGroups[0]?.id,
                isRunning: this.mockServerManager.getStatus(),
                groupStatuses,
            };
            await this.webviewView.webview.postMessage(payload);
        }
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const config = this.configManager.getConfig();
        const isRunning = this.mockServerManager.getStatus();

        // Set active group ID to first group if not set
        if (!this.activeGroupId && config.proxyGroups.length > 0) {
            this.activeGroupId = config.proxyGroups[0].id;
        }

        // Get URI for vscode-elements (use dist/webview for bundled extension)
        const codiconsFontUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'codicon.ttf')
        );
        const codiconsCssUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'codicon.css')
        );
        const reactAppUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'app.js')
        );

        // Generate nonce for CSP
        const nonce = this.getNonce();

        // i18n translations using vscode.l10n
        // Build a map keyed by the full i18n keys (e.g. 'ui.startAll')
        const i18nKeys = [
            // Buttons
            'ui.startAll', 'ui.stopAll', 'ui.startServer', 'ui.stopServer', 'ui.settings',
            'ui.add', 'ui.edit', 'ui.delete', 'ui.enable', 'ui.disable', 'ui.save', 'ui.cancel',
            'ui.format', 'ui.validate',
            // Form labels
            'ui.groupName', 'ui.enabled', 'ui.port', 'ui.interceptPrefix', 'ui.baseUrl', 'ui.stripPrefix',
            'ui.globalCookie', 'ui.method', 'ui.path', 'ui.statusCode', 'ui.responseBody', 'ui.delay',
            'ui.protocol', 'ui.protocol.http', 'ui.protocol.ws',
            'ui.wsBaseUrl', 'ui.wsInterceptPrefix', 'ui.wsManualPush',
            'ui.wssEnabled', 'ui.wssKeystorePath', 'ui.wssKeystorePassword',
            'ui.wsPanel.title', 'ui.wsPanel.rules', 'ui.wsPanel.sendSelected',
            'ui.wsPanel.target.match', 'ui.wsPanel.target.all', 'ui.wsPanel.target.recent',
            'ui.wsPanel.customMessage', 'ui.wsPanel.send', 'ui.wsPanel.noRules',
            'ui.yes', 'ui.no', 'ui.notSet',
            // Titles and lists
            'ui.addProxyGroup', 'ui.editProxyGroup', 'ui.addMockApi', 'ui.editMockApi', 'ui.running', 'ui.stopped', 'ui.mockApis',
            // Empty state
            'ui.noMockApis', 'ui.clickAddToCreate',
            // Confirms
            'ui.deleteProxyGroup', 'ui.deleteMockApi',
            // JSON validation
            'ui.jsonFormatted', 'ui.jsonValid', 'ui.jsonInvalid',
            // Placeholders
            'ui.groupNamePlaceholder', 'ui.baseUrlPlaceholder', 'ui.pathPlaceholder', 'ui.responsePlaceholder', 'ui.globalCookiePlaceholder',
            // No workspace prompt (may be used by webview)
            'noWorkspace.title', 'noWorkspace.message',
        ];
        const i18n = Object.fromEntries(i18nKeys.map(k => [k, vscode.l10n.t(k as any)]));

        // Get status for each group
        const groupStatuses: { [groupId: string]: boolean } = {};
        config.proxyGroups.forEach(group => {
            groupStatuses[group.id] = this.mockServerManager.getGroupStatus(group.id);
        });

        const initialData = {
            config,
            activeGroupId: this.activeGroupId || config.proxyGroups[0]?.id,
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
        // Validate name
        if (!data.name || data.name.trim() === '') {
            return vscode.l10n.t('error.emptyGroupName');
        }
        // Unique group name
        const name = String(data.name).trim();
        const configForName = this.configManager.getConfig();
        const sameName = configForName.proxyGroups.find(g => g.name.trim() === name && g.id !== editingGroupId);
        if (sameName) {
            return vscode.l10n.t('error.duplicateGroupName', name);
        }

        // Validate port
        const port = parseInt(data.port);
        if (isNaN(port) || port < 1024 || port > 65535) {
            return vscode.l10n.t('error.invalidPort');
        }

        // Check for port conflicts
        const config = this.configManager.getConfig();
        const conflictingGroup = config.proxyGroups.find(
            g => g.port === port && g.id !== editingGroupId
        );

        if (conflictingGroup) {
            return vscode.l10n.t('error.portInUse', port.toString(), conflictingGroup.name);
        }

        return null;
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
