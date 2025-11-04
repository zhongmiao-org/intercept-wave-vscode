import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { MockServerManager, ConfigManager } from './common';
import { SidebarProvider, PanelProvider } from './providers';
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

        // Register a placeholder view provider that renders a no-workspace message
        const emptyProvider: vscode.WebviewViewProvider = {
            resolveWebviewView(webviewView: vscode.WebviewView) {
                outputChannel.appendLine('[EmptyProvider] resolveWebviewView called');

                webviewView.webview.options = { enableScripts: false, localResourceRoots: [context.extensionUri] };

                try {
                    const templatePath = path.join(context.extensionUri.fsPath, 'dist', 'templates', 'noWorkspaceView.html');
                    let html = fs.readFileSync(templatePath, 'utf-8');
                    html = html
                        .replace('{{TITLE}}', vscode.l10n.t('noWorkspace.title'))
                        .replace('{{MESSAGE}}', vscode.l10n.t('noWorkspace.message'));
                    webviewView.webview.html = html;
                    outputChannel.appendLine('[EmptyProvider] No-workspace HTML set successfully');
                } catch (err: any) {
                    outputChannel.appendLine(`[EmptyProvider] Failed to load template: ${err?.message || err}`);
                    webviewView.webview.html = `<html><body><h3>${vscode.l10n.t('noWorkspace.title')}</h3><p>${vscode.l10n.t('noWorkspace.message')}</p></body></html>`;
                }
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

        // Full view panel
        const panelProvider = new PanelProvider(
            context.extensionUri,
            mockServerManager,
            configManager,
            outputChannel
        );
        context.subscriptions.push(vscode.commands.registerCommand('interceptWave.openFullView', () => {
            panelProvider.createOrShow();
        }));
        outputChannel.appendLine('✓ PanelProvider ready');

        // Register sidebar provider
        const sidebarProvider = new SidebarProvider(
            context.extensionUri,
            mockServerManager,
            configManager,
            panelProvider
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
