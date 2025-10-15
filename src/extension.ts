import * as vscode from 'vscode';
import { MockServerManager } from './mockServer';
import { ConfigManager } from './configManager';
import { SidebarProvider } from './sidebarProvider';
import { t } from './i18n';

let mockServerManager: MockServerManager;
let configManager: ConfigManager;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    // Create output channel for logging
    outputChannel = vscode.window.createOutputChannel('Intercept Wave');
    context.subscriptions.push(outputChannel);

    outputChannel.appendLine('Intercept Wave extension is now active');

    // Initialize managers
    configManager = new ConfigManager(context);
    mockServerManager = new MockServerManager(configManager, outputChannel);

    // Register sidebar provider
    const sidebarProvider = new SidebarProvider(context.extensionUri, mockServerManager, configManager);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('interceptWaveView', sidebarProvider)
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('interceptWave.startServer', async () => {
            try {
                const url = await mockServerManager.start();
                vscode.window.showInformationMessage(t('server.started', url));
            } catch (error: any) {
                vscode.window.showErrorMessage(t('server.startFailed', error.message));
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('interceptWave.stopServer', async () => {
            try {
                await mockServerManager.stop();
                vscode.window.showInformationMessage(t('server.stopped'));
            } catch (error: any) {
                vscode.window.showErrorMessage(t('server.stopFailed', error.message));
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('interceptWave.configure', async () => {
            const panel = vscode.window.createWebviewPanel(
                'interceptWaveConfig',
                t('config.title'),
                vscode.ViewColumn.One,
                {
                    enableScripts: true
                }
            );

            panel.webview.html = getConfigurationHtml(configManager.getConfig());

            panel.webview.onDidReceiveMessage(
                async message => {
                    switch (message.command) {
                        case 'save':
                            await configManager.saveConfig(message.config);
                            vscode.window.showInformationMessage(t('config.saved'));
                            panel.dispose();
                            break;
                    }
                },
                undefined,
                context.subscriptions
            );
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('interceptWave.openConfig', async () => {
            const configPath = configManager.getConfigPath();
            const doc = await vscode.workspace.openTextDocument(configPath);
            await vscode.window.showTextDocument(doc);
        })
    );
}

export function deactivate() {
    if (mockServerManager) {
        mockServerManager.stop();
    }
}

function getConfigurationHtml(config: any): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Configuration</title>
            <style>
                body {
                    padding: 20px;
                    font-family: var(--vscode-font-family);
                }
                .form-group {
                    margin-bottom: 15px;
                }
                label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: bold;
                }
                input[type="text"], input[type="number"] {
                    width: 100%;
                    padding: 8px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                }
                button {
                    padding: 10px 20px;
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    cursor: pointer;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                .mock-api {
                    border: 1px solid var(--vscode-panel-border);
                    padding: 15px;
                    margin-bottom: 10px;
                    border-radius: 4px;
                }
            </style>
        </head>
        <body>
            <h1>Intercept Wave Configuration</h1>

            <div class="form-group">
                <label for="port">Mock Port:</label>
                <input type="number" id="port" value="${config.port || 8888}">
            </div>

            <div class="form-group">
                <label for="interceptPrefix">Intercept Prefix:</label>
                <input type="text" id="interceptPrefix" value="${config.interceptPrefix || '/api'}">
            </div>

            <div class="form-group">
                <label for="baseUrl">Original Server Base URL:</label>
                <input type="text" id="baseUrl" value="${config.baseUrl || 'http://localhost:8080'}">
            </div>

            <div class="form-group">
                <label>
                    <input type="checkbox" id="stripPrefix" ${config.stripPrefix ? 'checked' : ''}>
                    Strip Prefix When Matching
                </label>
            </div>

            <div class="form-group">
                <label for="globalCookie">Global Cookie:</label>
                <input type="text" id="globalCookie" value="${config.globalCookie || ''}">
            </div>

            <button onclick="save()">Save Configuration</button>

            <script>
                const vscode = acquireVsCodeApi();

                function save() {
                    const config = {
                        port: parseInt(document.getElementById('port').value),
                        interceptPrefix: document.getElementById('interceptPrefix').value,
                        baseUrl: document.getElementById('baseUrl').value,
                        stripPrefix: document.getElementById('stripPrefix').checked,
                        globalCookie: document.getElementById('globalCookie').value,
                        mockApis: ${JSON.stringify(config.mockApis || [])}
                    };

                    vscode.postMessage({
                        command: 'save',
                        config: config
                    });
                }
            </script>
        </body>
        </html>
    `;
}