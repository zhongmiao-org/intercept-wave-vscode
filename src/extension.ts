import * as vscode from 'vscode';
import { MockServerManager } from './mockServer';
import { ConfigManager } from './configManager';
import { SidebarProvider } from './sidebarProvider';
import { t } from './i18n';
import { TemplateLoader } from './templateLoader';

let mockServerManager: MockServerManager;
let configManager: ConfigManager;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    // Create output channel for logging
    outputChannel = vscode.window.createOutputChannel('Intercept Wave');
    context.subscriptions.push(outputChannel);

    outputChannel.appendLine('=== Intercept Wave extension is activating ===');

    // Check if workspace folder exists
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        outputChannel.appendLine('⚠ No workspace folder found. Extension requires a workspace to activate.');
        outputChannel.appendLine('=== Activation skipped ===');

        // Register a placeholder view provider that shows a message
        const emptyProvider: vscode.WebviewViewProvider = {
            resolveWebviewView(webviewView: vscode.WebviewView) {
                outputChannel.appendLine('[EmptyProvider] resolveWebviewView called');

                const title = t('noWorkspace.title');
                const message = t('noWorkspace.message');

                webviewView.webview.options = {
                    enableScripts: true
                };

                const template = TemplateLoader.loadTemplate('noWorkspaceView');
                webviewView.webview.html = TemplateLoader.replacePlaceholders(template, {
                    'TITLE': title,
                    'MESSAGE': message
                });

                outputChannel.appendLine('[EmptyProvider] HTML set successfully');
            }
        };

        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider('interceptWaveView', emptyProvider)
        );
        outputChannel.appendLine('✓ Empty provider registered for interceptWaveView');
        outputChannel.show(true);
        return;
    }

    try {
        // Initialize managers
        configManager = new ConfigManager(context);
        outputChannel.appendLine('✓ ConfigManager initialized');

        mockServerManager = new MockServerManager(configManager, outputChannel);
        outputChannel.appendLine('✓ MockServerManager initialized');

        // Register sidebar provider
        const sidebarProvider = new SidebarProvider(context.extensionUri, mockServerManager, configManager);
        outputChannel.appendLine('✓ SidebarProvider created');

        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider('interceptWaveView', sidebarProvider, {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            })
        );
        outputChannel.appendLine('✓ WebviewViewProvider registered for: interceptWaveView');
        outputChannel.appendLine('=== Activation completed successfully ===');
        outputChannel.show(true);
    } catch (error: any) {
        outputChannel.appendLine(`✗ Activation error: ${error.message}`);
        outputChannel.appendLine(`Stack: ${error.stack}`);
        outputChannel.show(true);
        vscode.window.showErrorMessage(`Intercept Wave activation failed: ${error.message}`);
        throw error;
    }

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

export function getConfigurationHtml(config: any): string {
    const template = TemplateLoader.loadTemplate('configurationView');
    return TemplateLoader.replacePlaceholders(template, {
        'PORT': (config.port || 8888).toString(),
        'INTERCEPT_PREFIX': config.interceptPrefix || '/api',
        'BASE_URL': config.baseUrl || 'http://localhost:8080',
        'STRIP_PREFIX_CHECKED': config.stripPrefix ? 'checked' : '',
        'GLOBAL_COOKIE': config.globalCookie || '',
        'MOCK_APIS_JSON': JSON.stringify(config.mockApis || [])
    });
}