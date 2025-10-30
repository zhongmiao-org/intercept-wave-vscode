import * as vscode from 'vscode';
import { MockServerManager, ProxyGroup, ConfigManager, buildReactWebviewHtml } from '../common';
import { v4 as uuidv4 } from 'uuid';

export class SidebarProvider implements vscode.WebviewViewProvider {
    private webviewView?: vscode.WebviewView;
    private activeGroupId?: string;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly mockServerManager: MockServerManager,
        private readonly configManager: ConfigManager
    ) {
        console.log('[SidebarProvider] Constructor called');
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        console.log('[SidebarProvider] resolveWebviewView called');
        this.webviewView = webviewView;

        try {
            webviewView.webview.options = {
                enableScripts: true,
                localResourceRoots: [this.extensionUri],
            };
            console.log('[SidebarProvider] Webview options set');

            webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
            console.log('[SidebarProvider] Webview HTML set');

            webviewView.webview.onDidReceiveMessage(async data => {
                await this.handleMessage(data, webviewView);
            });
        } catch (error: any) {
            console.error('[SidebarProvider] Error in resolveWebviewView:', error);
            void vscode.window.showErrorMessage(
                `Failed to load Intercept Wave view: ${error.message}`
            );
        }
    }

    private async handleMessage(data: any, webviewView: vscode.WebviewView) {
        try {
            switch (data.type) {
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
            }
        } catch (error: any) {
            void vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
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
        }
    }

    private async handleAddGroup(data: any) {
        // Validate group data
        const validationError = this.validateGroupData(data);
        if (validationError) {
            void vscode.window.showErrorMessage(validationError);
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
        await this.configManager.addMockApi(groupId, data);
        await this.refreshWebview();
        void vscode.window.showInformationMessage(vscode.l10n.t('success.mockAdded'));
    }

    private async handleUpdateMock(groupId: string, index: number, data: any) {
        await this.configManager.updateMockApi(groupId, index, data);
        await this.refreshWebview();
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

            await this.webviewView.webview.postMessage({
                type: 'configUpdated',
                config,
                activeGroupId: this.activeGroupId || config.proxyGroups[0]?.id,
                isRunning: this.mockServerManager.getStatus(),
                groupStatuses,
            });
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
        const reactAppUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'app.js')
        );

        // Generate nonce for CSP
        const nonce = this.getNonce();

        // i18n translations using vscode.l10n
        const i18n = {
            // Button texts
            startAll: vscode.l10n.t('ui.startAll'),
            stopAll: vscode.l10n.t('ui.stopAll'),
            startServer: vscode.l10n.t('ui.startServer'),
            stopServer: vscode.l10n.t('ui.stopServer'),
            settings: vscode.l10n.t('ui.settings'),
            add: vscode.l10n.t('ui.add'),
            edit: vscode.l10n.t('ui.edit'),
            delete: vscode.l10n.t('ui.delete'),
            enable: vscode.l10n.t('ui.enable'),
            disable: vscode.l10n.t('ui.disable'),
            save: vscode.l10n.t('ui.save'),
            cancel: vscode.l10n.t('ui.cancel'),
            format: vscode.l10n.t('ui.format'),
            validate: vscode.l10n.t('ui.validate'),

            // Form labels
            groupName: vscode.l10n.t('ui.groupName'),
            enabled: vscode.l10n.t('ui.enabled'),
            port: vscode.l10n.t('ui.port'),
            interceptPrefix: vscode.l10n.t('ui.interceptPrefix'),
            baseUrl: vscode.l10n.t('ui.baseUrl'),
            stripPrefix: vscode.l10n.t('ui.stripPrefix'),
            globalCookie: vscode.l10n.t('ui.globalCookie'),
            method: vscode.l10n.t('ui.method'),
            path: vscode.l10n.t('ui.path'),
            statusCode: vscode.l10n.t('ui.statusCode'),
            responseBody: vscode.l10n.t('ui.responseBody'),
            delay: vscode.l10n.t('ui.delay'),

            // Titles
            addProxyGroup: vscode.l10n.t('ui.addProxyGroup'),
            editProxyGroup: vscode.l10n.t('ui.editProxyGroup'),
            addMockApi: vscode.l10n.t('ui.addMockApi'),
            editMockApi: vscode.l10n.t('ui.editMockApi'),

            // Status messages
            running: vscode.l10n.t('ui.running'),
            stopped: vscode.l10n.t('ui.stopped'),
            mockApis: vscode.l10n.t('ui.mockApis'),

            // Empty state messages
            noMockApis: vscode.l10n.t('ui.noMockApis'),
            clickAddToCreate: vscode.l10n.t('ui.clickAddToCreate'),

            // Confirmation messages
            confirmDeleteGroup: vscode.l10n.t('ui.deleteProxyGroup'),
            confirmDeleteMock: vscode.l10n.t('ui.deleteMockApi'),

            // JSON validation messages
            jsonFormatSuccess: vscode.l10n.t('ui.jsonFormatted'),
            jsonValid: vscode.l10n.t('ui.jsonValid'),
            invalidJson: vscode.l10n.t('ui.jsonInvalid'),

            // Placeholders
            groupNamePlaceholder: vscode.l10n.t('ui.groupNamePlaceholder'),
            baseUrlPlaceholder: vscode.l10n.t('ui.baseUrlPlaceholder'),
            pathPlaceholder: vscode.l10n.t('ui.pathPlaceholder'),
            responsePlaceholder: vscode.l10n.t('ui.responsePlaceholder'),
            globalCookiePlaceholder: vscode.l10n.t('ui.globalCookiePlaceholder'),
        };

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
        };
        return buildReactWebviewHtml({
            nonce,
            codiconsFontUri: codiconsFontUri.toString(),
            appJsUri: reactAppUri.toString(),
            initialDataJson: JSON.stringify(initialData),
        });
    }

    private validateGroupData(data: any, editingGroupId?: string): string | null {
        // Validate name
        if (!data.name || data.name.trim() === '') {
            return vscode.l10n.t('error.emptyGroupName');
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
