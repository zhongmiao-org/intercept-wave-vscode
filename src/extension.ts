import * as vscode from 'vscode';
import { MockServerManager, ConfigManager, buildReactWebviewHtml } from './common';
import { SidebarProvider } from './providers';
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
        outputChannel.appendLine(
            '⚠ No workspace folder found. Extension requires a workspace to activate.'
        );
        outputChannel.appendLine('=== Activation skipped ===');

        // Register a placeholder view provider that renders React UI with empty data
        const emptyProvider: vscode.WebviewViewProvider = {
            resolveWebviewView(webviewView: vscode.WebviewView) {
                outputChannel.appendLine('[EmptyProvider] resolveWebviewView called');

                webviewView.webview.options = { enableScripts: true, localResourceRoots: [context.extensionUri] };

                const codiconsFontUri = webviewView.webview.asWebviewUri(
                    vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview', 'codicon.ttf')
                );
                const reactAppUri = webviewView.webview.asWebviewUri(
                    vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview', 'app.js')
                );
                const nonce = getNonce();

                const i18n = {
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
                    addProxyGroup: vscode.l10n.t('ui.addProxyGroup'),
                    editProxyGroup: vscode.l10n.t('ui.editProxyGroup'),
                    addMockApi: vscode.l10n.t('ui.addMockApi'),
                    editMockApi: vscode.l10n.t('ui.editMockApi'),
                    running: vscode.l10n.t('ui.running'),
                    stopped: vscode.l10n.t('ui.stopped'),
                    mockApis: vscode.l10n.t('ui.mockApis'),
                    noMockApis: vscode.l10n.t('ui.noMockApis'),
                    clickAddToCreate: vscode.l10n.t('ui.clickAddToCreate'),
                    jsonFormatSuccess: vscode.l10n.t('ui.jsonFormatted'),
                    jsonValid: vscode.l10n.t('ui.jsonValid'),
                    invalidJson: vscode.l10n.t('ui.jsonInvalid'),
                    groupNamePlaceholder: vscode.l10n.t('ui.groupNamePlaceholder'),
                    baseUrlPlaceholder: vscode.l10n.t('ui.baseUrlPlaceholder'),
                    pathPlaceholder: vscode.l10n.t('ui.pathPlaceholder'),
                    responsePlaceholder: vscode.l10n.t('ui.responsePlaceholder'),
                    globalCookiePlaceholder: vscode.l10n.t('ui.globalCookiePlaceholder'),
                };

                const initialData = {
                    config: { version: '2.0', proxyGroups: [] },
                    activeGroupId: undefined,
                    isRunning: false,
                    groupStatuses: {},
                    i18n,
                };

                webviewView.webview.html = buildReactWebviewHtml({
                    nonce,
                    codiconsFontUri: codiconsFontUri.toString(),
                    appJsUri: reactAppUri.toString(),
                    initialDataJson: JSON.stringify(initialData),
                });
                
                outputChannel.appendLine('[EmptyProvider] HTML set successfully');
            },
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
        const sidebarProvider = new SidebarProvider(
            context.extensionUri,
            mockServerManager,
            configManager
        );
        outputChannel.appendLine('✓ SidebarProvider created');

        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider('interceptWaveView', sidebarProvider, {
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
            })
        );
        outputChannel.appendLine('✓ WebviewViewProvider registered for: interceptWaveView');

        // Register commands
        context.subscriptions.push(
            vscode.commands.registerCommand('interceptWave.startServer', async () => {
                try {
                    const url = await mockServerManager.start();
                    void vscode.window.showInformationMessage(
                        vscode.l10n.t('server.started', url)
                    );
                } catch (error: any) {
                    void vscode.window.showErrorMessage(
                        vscode.l10n.t('server.startFailed', error.message)
                    );
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('interceptWave.stopServer', async () => {
                try {
                    await mockServerManager.stop();
                    void vscode.window.showInformationMessage(
                        vscode.l10n.t('server.stopped')
                    );
                } catch (error: any) {
                    void vscode.window.showErrorMessage(
                        vscode.l10n.t('server.stopFailed', error.message)
                    );
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('interceptWave.openConfig', async () => {
                const configPath = configManager.getConfigPath();
                const doc = await vscode.workspace.openTextDocument(configPath);
                await vscode.window.showTextDocument(doc);
            })
        );

        outputChannel.appendLine('✓ Commands registered');
        outputChannel.appendLine('=== Activation completed successfully ===');
        outputChannel.show(true);
    } catch (error: any) {
        outputChannel.appendLine(`✗ Activation error: ${error.message}`);
        outputChannel.appendLine(`Stack: ${error.stack}`);
        outputChannel.show(true);
        void vscode.window.showErrorMessage(
            `Intercept Wave activation failed: ${error.message}`
        );
        throw error;
    }
}

export async function deactivate() {
    if (mockServerManager) {
        await mockServerManager.stop();
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
