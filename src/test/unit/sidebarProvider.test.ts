import { describe, it, beforeEach, before, afterEach } from 'mocha';
import { expect, use } from 'chai';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as vscode from 'vscode';
import { SidebarProvider } from '../../providers';
import { MockServerManager, ConfigManager } from '../../common';

use(sinonChai);

describe('SidebarProvider', () => {
    let sidebarProvider: SidebarProvider;
    let mockServerManager: MockServerManager;
    let configManager: ConfigManager;
    let extensionUri: vscode.Uri;
    let sandbox: sinon.SinonSandbox;

    before(() => {
        // Mock vscode.Uri.joinPath for testing environment
        if (!(vscode.Uri as any).joinPath) {
            (vscode.Uri as any).joinPath = (..._: any[]) => {
                return vscode.Uri.file('/fake/joined/path');
            };
        }

        // Mock vscode.l10n for tests
        if (!vscode.l10n) {
            (vscode as any).l10n = {
                t: (key: string, ..._: any[]) => key,
            };
        } else if (!(vscode.l10n as any).t) {
            (vscode.l10n as any).t = (key: string, ..._: any[]) => key;
        }
    });

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        extensionUri = vscode.Uri.file('/fake/path');

        configManager = {
            getConfig: sandbox.stub().returns({
                version: '2.0',
                proxyGroups: [
                    {
                        id: 'test-group-id',
                        name: 'Test Group',
                        port: 8888,
                        interceptPrefix: '/api',
                        baseUrl: 'http://localhost:8080',
                        stripPrefix: true,
                        globalCookie: '',
                        enabled: true,
                        mockApis: [],
                    },
                ],
            }),
            saveConfig: sandbox.stub().resolves(),
            addMockApi: sandbox.stub().resolves(),
            removeMockApi: sandbox.stub().resolves(),
            updateMockApi: sandbox.stub().resolves(),
            addProxyGroup: sandbox.stub().resolves(),
            removeProxyGroup: sandbox.stub().resolves(),
            updateProxyGroup: sandbox.stub().resolves(),
            getConfigPath: sandbox.stub().returns('/fake/config/path'),
        } as any;

        mockServerManager = {
            start: sandbox.stub().resolves('http://localhost:8888 (Test Group)'),
            stop: sandbox.stub().resolves(),
            startGroupById: sandbox.stub().resolves('http://localhost:8888 (Test Group)'),
            stopGroupById: sandbox.stub().resolves(),
            getStatus: sandbox.stub().returns(false),
            getGroupStatus: sandbox.stub().returns(false),
        } as any;

        sidebarProvider = new SidebarProvider(extensionUri, mockServerManager, configManager);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('constructor', () => {
        it('should create an instance', () => {
            expect(sidebarProvider).to.be.instanceOf(SidebarProvider);
        });
    });

    describe('getNonce', () => {
        it('should generate a 32-character nonce', () => {
            const nonce = (sidebarProvider as any).getNonce();
            expect(nonce).to.be.a('string');
            expect(nonce.length).to.equal(32);
        });

        it('should generate different nonces on each call', () => {
            const nonce1 = (sidebarProvider as any).getNonce();
            const nonce2 = (sidebarProvider as any).getNonce();
            expect(nonce1).to.not.equal(nonce2);
        });

        it('should only contain alphanumeric characters', () => {
            const nonce = (sidebarProvider as any).getNonce();
            expect(nonce).to.match(/^[A-Za-z0-9]+$/);
        });
    });

    // Note: resolveWebviewView and message handler tests are in integration tests
    // because they require a real VS Code webview environment
});
