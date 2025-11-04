import * as vscode from 'vscode';
import { MockServerManager, ProxyGroup, ConfigManager, buildReactWebviewHtml } from '../common';
import { v4 as uuidv4 } from 'uuid';

export class PanelProvider {
    private panel: vscode.WebviewPanel | undefined;
    private activeGroupId?: string;
    private ready: boolean = false;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly mockServerManager: MockServerManager,
        private readonly configManager: ConfigManager,
        private readonly outputChannel?: vscode.OutputChannel
    ) {}

    private async notify(level: 'info' | 'warn' | 'error', text: string) {
        try {
            if (this.panel) {
                await this.panel.webview.postMessage({ type: 'notify', level, text });
            }
        } catch {
            // ignore notify errors
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
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this.extensionUri],
            }
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
        this.createOrShow();
        if (!this.panel) return;
        // if panel not ready yet, post action after initial refresh
        const payload = { type: 'panelAction', action };
        if (this.ready) {
            await this.panel.webview.postMessage(payload);
        } else {
            // small delay to allow webview to boot; then send
            setTimeout(() => { this.panel?.webview.postMessage(payload) }, 50);
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
            }
        } catch (error: any) {
            void vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    }

    private async handleStartServer() {
        try {
            const url = await this.mockServerManager.start();
            this.outputChannel?.appendLine(`[Panel] startServer → ok: ${url}`);
            void vscode.window.showInformationMessage(vscode.l10n.t('success.serversStarted', url));
            await this.refresh();
        } catch (error: any) {
            this.outputChannel?.appendLine(`[Panel] startServer → error: ${error?.message}`);
            void vscode.window.showErrorMessage(vscode.l10n.t('error.failedToStart', error.message));
            await this.notify('error', vscode.l10n.t('error.failedToStart', error.message));
            await this.refresh();
        }
    }

    private async handleStopServer() {
        try {
            await this.mockServerManager.stop();
            this.outputChannel?.appendLine('[Panel] stopServer → ok');
            void vscode.window.showInformationMessage(vscode.l10n.t('success.serversStopped'));
            await this.refresh();
        } catch (error: any) {
            this.outputChannel?.appendLine(`[Panel] stopServer → error: ${error?.message}`);
            void vscode.window.showErrorMessage(vscode.l10n.t('error.failedToStop', error.message));
            await this.notify('error', vscode.l10n.t('error.failedToStop', error.message));
            await this.refresh();
        }
    }

    private async handleStartGroup(groupId: string) {
        try {
            const url = await this.mockServerManager.startGroupById(groupId);
            void vscode.window.showInformationMessage(vscode.l10n.t('success.serversStarted', url));
            await this.refresh();
        } catch (error: any) {
            void vscode.window.showErrorMessage(vscode.l10n.t('error.failedToStart', error.message));
            await this.notify('error', vscode.l10n.t('error.failedToStart', error.message));
        }
    }

    private async handleStopGroup(groupId: string) {
        try {
            const config = this.configManager.getConfig();
            const group = config.proxyGroups.find(g => g.id === groupId);
            await this.mockServerManager.stopGroupById(groupId);
            if (group) {
                const serverInfo = `${group.name}(:${group.port})`;
                void vscode.window.showInformationMessage(vscode.l10n.t('success.groupStopped', serverInfo));
            } else {
                void vscode.window.showInformationMessage(vscode.l10n.t('success.serversStopped'));
            }
            await this.refresh();
        } catch (error: any) {
            void vscode.window.showErrorMessage(vscode.l10n.t('error.failedToStop', error.message));
            await this.notify('error', vscode.l10n.t('error.failedToStop', error.message));
        }
    }

    private async handleAddGroup(data: any) {
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
        };
        await this.configManager.addProxyGroup(newGroup);
        this.activeGroupId = newGroup.id;
        await this.refresh();
        if (this.panel) {
            await this.panel.webview.postMessage({ type: 'closeGroupForm' });
        }
        void vscode.window.showInformationMessage(vscode.l10n.t('success.groupAdded', newGroup.name));
    }

    private async handleUpdateGroup(groupId: string, data: any) {
        const validationError = this.validateGroupData(data, groupId);
        if (validationError) {
            void vscode.window.showErrorMessage(validationError);
            await this.notify('error', validationError);
            return;
        }
        await this.configManager.updateProxyGroup(groupId, data);
        await this.refresh();
        if (this.panel) {
            await this.panel.webview.postMessage({ type: 'closeGroupForm' });
        }
        void vscode.window.showInformationMessage(vscode.l10n.t('success.groupUpdated'));
    }

    private async handleDeleteGroup(groupId: string) {
        const config = this.configManager.getConfig();
        if (config.proxyGroups.length <= 1) {
            void vscode.window.showWarningMessage(vscode.l10n.t('error.cannotDeleteLastGroup'));
            return;
        }
        const answer = await vscode.window.showWarningMessage(
            vscode.l10n.t('ui.deleteProxyGroup'),
            { modal: true },
            vscode.l10n.t('ui.confirm')
        );
        if (answer !== vscode.l10n.t('ui.confirm')) {
            return;
        }
        await this.configManager.removeProxyGroup(groupId);
        if (this.activeGroupId === groupId) {
            const updatedConfig = this.configManager.getConfig();
            this.activeGroupId = updatedConfig.proxyGroups[0].id;
        }
        await this.refresh();
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
        await this.refresh();
        if (this.panel) {
            await this.panel.webview.postMessage({ type: 'closeGroupForm' });
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
        await this.refresh();
        if (this.panel) {
            await this.panel.webview.postMessage({ type: 'closeGroupForm' });
        }
        void vscode.window.showInformationMessage(vscode.l10n.t('success.mockUpdated'));
    }

    private async handleDeleteMock(groupId: string, index: number) {
        const answer = await vscode.window.showWarningMessage(
            vscode.l10n.t('ui.deleteMockApi'),
            { modal: true },
            vscode.l10n.t('ui.confirm')
        );
        if (answer !== vscode.l10n.t('ui.confirm')) {
            return;
        }
        await this.configManager.removeMockApi(groupId, index);
        await this.refresh();
        void vscode.window.showInformationMessage(vscode.l10n.t('success.mockDeleted'));
    }

    private async handleToggleMock(groupId: string, index: number) {
        const config = this.configManager.getConfig();
        const group = config.proxyGroups.find(g => g.id === groupId);
        if (group && group.mockApis[index]) {
            group.mockApis[index].enabled = !group.mockApis[index].enabled;
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
        const payload = {
            type: 'configUpdated',
            config,
            activeGroupId: this.activeGroupId || config.proxyGroups[0]?.id,
            isRunning: this.mockServerManager.getStatus(),
            groupStatuses,
        };
        await this.panel.webview.postMessage(payload);
    }

    private getHtml(webview: vscode.Webview): string {
        const config = this.configManager.getConfig();
        const isRunning = this.mockServerManager.getStatus();
        if (!this.activeGroupId && config.proxyGroups.length > 0) {
            this.activeGroupId = config.proxyGroups[0].id;
        }
        const codiconsFontUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'codicon.ttf')
        );
        const codiconsCssUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'codicon.css')
        );
        const reactAppUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'app.js')
        );
        const nonce = this.getNonce();

        const i18nKeys = [
            'ui.startAll', 'ui.stopAll', 'ui.startServer', 'ui.stopServer', 'ui.settings',
            'ui.add', 'ui.edit', 'ui.delete', 'ui.enable', 'ui.disable', 'ui.save', 'ui.cancel',
            'ui.format', 'ui.validate',
            'ui.groupName', 'ui.enabled', 'ui.port', 'ui.interceptPrefix', 'ui.baseUrl', 'ui.stripPrefix',
            'ui.globalCookie', 'ui.method', 'ui.path', 'ui.statusCode', 'ui.responseBody', 'ui.delay',
            'ui.addProxyGroup', 'ui.editProxyGroup', 'ui.addMockApi', 'ui.editMockApi', 'ui.running', 'ui.stopped', 'ui.mockApis',
            'ui.noMockApis', 'ui.clickAddToCreate',
            'ui.deleteProxyGroup', 'ui.deleteMockApi',
            'ui.jsonFormatted', 'ui.jsonValid', 'ui.jsonInvalid',
            'ui.groupNamePlaceholder', 'ui.baseUrlPlaceholder', 'ui.pathPlaceholder', 'ui.responsePlaceholder', 'ui.globalCookiePlaceholder',
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

    private validateGroupData(data: any, editingGroupId?: string): string | null {
        if (!data.name || data.name.trim() === '') {
            return vscode.l10n.t('error.emptyGroupName');
        }
        // Unique group name
        const name = String(data.name).trim();
        const config = this.configManager.getConfig();
        const sameName = config.proxyGroups.find(g => g.name.trim() === name && g.id !== editingGroupId);
        if (sameName) {
            return vscode.l10n.t('error.duplicateGroupName', name);
        }
        const port = parseInt(data.port);
        if (isNaN(port) || port < 1024 || port > 65535) {
            return vscode.l10n.t('error.invalidPort');
        }
        const cfg = this.configManager.getConfig();
        const conflictingGroup = cfg.proxyGroups.find(
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
