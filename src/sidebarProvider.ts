import * as vscode from 'vscode';
import { MockServerManager } from './mockServer';
import { ConfigManager } from './configManager';
import { TemplateLoader } from './templateLoader';

export class SidebarProvider implements vscode.WebviewViewProvider {
    constructor(
        private readonly extensionUri: vscode.Uri,
        private mockServerManager: MockServerManager,
        private configManager: ConfigManager
    ) {
        console.log('[SidebarProvider] Constructor called');
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        console.log('[SidebarProvider] resolveWebviewView called');

        try {
            webviewView.webview.options = {
                enableScripts: true,
                localResourceRoots: [this.extensionUri]
            };
            console.log('[SidebarProvider] Webview options set');

            webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
            console.log('[SidebarProvider] Webview HTML set');

            webviewView.webview.onDidReceiveMessage(async data => {
                switch (data.type) {
                    case 'startServer':
                        try {
                            const url = await this.mockServerManager.start();
                            vscode.window.showInformationMessage(`Server started: ${url}`);
                            webviewView.webview.postMessage({ type: 'serverStarted', url });
                        } catch (error: any) {
                            vscode.window.showErrorMessage(`Failed to start server: ${error.message}`);
                        }
                        break;
                    case 'stopServer':
                        try {
                            await this.mockServerManager.stop();
                            vscode.window.showInformationMessage('Server stopped');
                            webviewView.webview.postMessage({ type: 'serverStopped' });
                        } catch (error: any) {
                            vscode.window.showErrorMessage(`Failed to stop server: ${error.message}`);
                        }
                        break;
                    case 'openConfig':
                        vscode.commands.executeCommand('interceptWave.configure');
                        break;
                    case 'addMock':
                        try {
                            await this.configManager.addMockApi(data.data);
                            const config = this.configManager.getConfig();
                            webviewView.webview.postMessage({ type: 'mockListUpdated', mocks: config.mockApis });
                            vscode.window.showInformationMessage('Mock API added successfully');
                        } catch (error: any) {
                            vscode.window.showErrorMessage(`Failed to add mock API: ${error.message}`);
                        }
                        break;
                    case 'updateMock':
                        try {
                            await this.configManager.updateMockApi(data.index, data.data);
                            const config = this.configManager.getConfig();
                            webviewView.webview.postMessage({ type: 'mockListUpdated', mocks: config.mockApis });
                            vscode.window.showInformationMessage('Mock API updated successfully');
                        } catch (error: any) {
                            vscode.window.showErrorMessage(`Failed to update mock API: ${error.message}`);
                        }
                        break;
                    case 'deleteMock':
                        try {
                            await this.configManager.removeMockApi(data.index);
                            const config = this.configManager.getConfig();
                            webviewView.webview.postMessage({ type: 'mockListUpdated', mocks: config.mockApis });
                            vscode.window.showInformationMessage('Mock API deleted successfully');
                        } catch (error: any) {
                            vscode.window.showErrorMessage(`Failed to delete mock API: ${error.message}`);
                        }
                        break;
                    case 'toggleMock':
                        try {
                            const config = this.configManager.getConfig();
                            config.mockApis[data.index].enabled = !config.mockApis[data.index].enabled;
                            await this.configManager.saveConfig(config);
                            webviewView.webview.postMessage({ type: 'mockListUpdated', mocks: config.mockApis });
                        } catch (error: any) {
                            vscode.window.showErrorMessage(`Failed to toggle mock API: ${error.message}`);
                        }
                        break;
                    case 'getMock':
                        try {
                            const config = this.configManager.getConfig();
                            webviewView.webview.postMessage({ type: 'editMock', data: config.mockApis[data.index] });
                        } catch (error: any) {
                            vscode.window.showErrorMessage(`Failed to get mock API: ${error.message}`);
                        }
                        break;
                }
            });
        } catch (error: any) {
            console.error('[SidebarProvider] Error in resolveWebviewView:', error);
            vscode.window.showErrorMessage(`Failed to load Intercept Wave view: ${error.message}`);
        }
    }

    private getHtmlForWebview(_webview: vscode.Webview): string {
        const config = this.configManager.getConfig();
        const isRunning = this.mockServerManager.getStatus();

        const template = TemplateLoader.loadTemplate('sidebarView');
        const replacements = {
            'STATUS_CLASS': isRunning ? 'running' : 'stopped',
            'STATUS_TEXT': isRunning ? '● Running' : '○ Stopped',
            'SERVER_URL': isRunning ? `<div class="url" id="serverUrl">http://localhost:${config.port}</div>` : '',
            'START_DISABLED': isRunning ? 'disabled' : '',
            'STOP_DISABLED': !isRunning ? 'disabled' : '',
            'ENABLED_COUNT': config.mockApis.filter((a: any) => a.enabled).length.toString(),
            'TOTAL_COUNT': config.mockApis.length.toString(),
            'MOCK_LIST': this.renderMockList(config.mockApis)
        };

        return TemplateLoader.replacePlaceholders(template, replacements);
    }


    private renderMockList(mocks: any[]): string {
        if (!mocks || mocks.length === 0) {
            return '<div class="empty-state">No mock APIs configured.<br>Click "+ Add" to create one.</div>';
        }
        return mocks.map((mock, index) => `
            <div class="mock-item ${mock.enabled ? '' : 'disabled'}">
                <div class="mock-item-header">
                    <div>
                        <span class="mock-method ${mock.method.toLowerCase()}">${mock.method}</span>
                        <span class="mock-path">${mock.path}</span>
                    </div>
                    <div class="mock-actions">
                        <button onclick="toggleMock(${index})">${mock.enabled ? 'Disable' : 'Enable'}</button>
                        <button onclick="editMock(${index})">Edit</button>
                        <button onclick="deleteMock(${index})">Delete</button>
                    </div>
                </div>
            </div>
        `).join('');
    }
}