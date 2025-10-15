import * as vscode from 'vscode';
import { MockServerManager } from './mockServer';
import { ConfigManager } from './configManager';

export class SidebarProvider implements vscode.WebviewViewProvider {
    constructor(
        private readonly extensionUri: vscode.Uri,
        private mockServerManager: MockServerManager,
        private configManager: ConfigManager
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

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
            }
        });
    }

    private getHtmlForWebview(webview: vscode.Webview) {
        const config = this.configManager.getConfig();
        const isRunning = this.mockServerManager.getStatus();

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Intercept Wave</title>
                <style>
                    body {
                        padding: 10px;
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                    }
                    .header {
                        margin-bottom: 20px;
                    }
                    .status {
                        padding: 10px;
                        margin-bottom: 10px;
                        border-radius: 4px;
                        background: var(--vscode-editor-background);
                    }
                    .status.running {
                        color: #4caf50;
                    }
                    .status.stopped {
                        color: #9e9e9e;
                    }
                    button {
                        width: 100%;
                        padding: 10px;
                        margin-bottom: 10px;
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        cursor: pointer;
                        border-radius: 4px;
                    }
                    button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                    button:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }
                    .config-info {
                        margin-top: 20px;
                        padding: 10px;
                        background: var(--vscode-editor-background);
                        border-radius: 4px;
                        font-size: 12px;
                    }
                    .config-info p {
                        margin: 5px 0;
                    }
                    .url {
                        color: #2196F3;
                        word-break: break-all;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>Intercept Wave</h2>
                    <div class="status ${isRunning ? 'running' : 'stopped'}" id="status">
                        Status: ${isRunning ? 'Running' : 'Stopped'}
                    </div>
                    <div class="url" id="serverUrl" style="display: ${isRunning ? 'block' : 'none'}">
                        Access URL: http://localhost:${config.port}
                    </div>
                </div>

                <button id="startBtn" ${isRunning ? 'disabled' : ''}>Start Server</button>
                <button id="stopBtn" ${!isRunning ? 'disabled' : ''}>Stop Server</button>
                <button id="configBtn">Configure</button>

                <div class="config-info">
                    <h3>Current Configuration</h3>
                    <p><strong>Port:</strong> ${config.port}</p>
                    <p><strong>Intercept Prefix:</strong> ${config.interceptPrefix}</p>
                    <p><strong>Base URL:</strong> ${config.baseUrl}</p>
                    <p><strong>Strip Prefix:</strong> ${config.stripPrefix ? 'Yes' : 'No'}</p>
                    <p><strong>Mock APIs:</strong> ${config.mockApis.length} (${config.mockApis.filter((a: any) => a.enabled).length} enabled)</p>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();

                    document.getElementById('startBtn').addEventListener('click', () => {
                        vscode.postMessage({ type: 'startServer' });
                        updateButtonState(true);
                    });

                    document.getElementById('stopBtn').addEventListener('click', () => {
                        vscode.postMessage({ type: 'stopServer' });
                        updateButtonState(false);
                    });

                    document.getElementById('configBtn').addEventListener('click', () => {
                        vscode.postMessage({ type: 'openConfig' });
                    });

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'serverStarted':
                                updateButtonState(true);
                                document.getElementById('status').textContent = 'Status: Running';
                                document.getElementById('status').className = 'status running';
                                document.getElementById('serverUrl').style.display = 'block';
                                document.getElementById('serverUrl').textContent = 'Access URL: ' + message.url;
                                break;
                            case 'serverStopped':
                                updateButtonState(false);
                                document.getElementById('status').textContent = 'Status: Stopped';
                                document.getElementById('status').className = 'status stopped';
                                document.getElementById('serverUrl').style.display = 'none';
                                break;
                        }
                    });

                    function updateButtonState(running) {
                        document.getElementById('startBtn').disabled = running;
                        document.getElementById('stopBtn').disabled = !running;
                    }
                </script>
            </body>
            </html>
        `;
    }
}