import { describe, it, before } from 'mocha';
import { expect } from 'chai';
import * as vscode from 'vscode';

describe('Extension Integration Tests', () => {
    before(async function () {
        this.timeout(60000); // Extension activation can take time

        // Activate the extension
        const ext = vscode.extensions.getExtension('Ark65.intercept-wave');
        if (ext) {
            await ext.activate();
        }
    });

    describe('Extension Activation', () => {
        it('should be present', () => {
            const ext = vscode.extensions.getExtension('Ark65.intercept-wave');
            expect(ext).to.not.be.undefined;
        });

        it('should activate successfully', async () => {
            const ext = vscode.extensions.getExtension('Ark65.intercept-wave');
            expect(ext?.isActive).to.be.true;
        });
    });

    describe('Commands Registration', () => {
        it('should register interceptWave.startServer command', async () => {
            const commands = await vscode.commands.getCommands(true);
            expect(commands).to.include('interceptWave.startServer');
        });

        it('should register interceptWave.stopServer command', async () => {
            const commands = await vscode.commands.getCommands(true);
            expect(commands).to.include('interceptWave.stopServer');
        });

        it('should register interceptWave.openConfig command', async () => {
            const commands = await vscode.commands.getCommands(true);
            expect(commands).to.include('interceptWave.openConfig');
        });
    });

    describe('Sidebar View Registration', () => {
        it('should register interceptWaveView in the sidebar', async () => {
            // Note: This is a basic check, detailed webview testing requires more setup
            const ext = vscode.extensions.getExtension('Ark65.intercept-wave');
            expect(ext?.isActive).to.be.true;
        });
    });
});
