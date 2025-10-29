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
    let webviewViewStub: any;

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

        // Fake webviewView for refreshWebview
        const postMessage = sandbox.stub().resolves();
        webviewViewStub = {
            webview: {
                postMessage,
                asWebviewUri: (_u: any) => ({ toString: () => 'vscode-resource://dummy' }),
                options: {},
            },
        };
        (sidebarProvider as any).webviewView = webviewViewStub;
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
    describe('handlers', () => {
        it('handleStartServer/StopServer', async () => {
            await (sidebarProvider as any).handleStartServer(webviewViewStub);
            expect((mockServerManager.start as sinon.SinonStub)).to.have.been.calledOnce;
            await (sidebarProvider as any).handleStopServer(webviewViewStub);
            expect((mockServerManager.stop as sinon.SinonStub)).to.have.been.calledOnce;
        });

        it('handleStartGroup/StopGroup', async () => {
            await (sidebarProvider as any).handleStartGroup('test-group-id');
            expect((mockServerManager.startGroupById as sinon.SinonStub)).to.have.been
                .calledWith('test-group-id');
            await (sidebarProvider as any).handleStopGroup('test-group-id');
            expect((mockServerManager.stopGroupById as sinon.SinonStub)).to.have.been
                .calledWith('test-group-id');
        });

        it('handleAddGroup/UpdateGroup/DeleteGroup', async () => {
            // add
            await (sidebarProvider as any).handleAddGroup({
                id: 'g2',
                name: 'New Group',
                enabled: true,
                port: 9999,
                interceptPrefix: '/api',
                baseUrl: 'http://localhost:3000',
                stripPrefix: true,
                globalCookie: '',
            });
            expect((configManager.addProxyGroup as sinon.SinonStub)).to.have.been.called;

            // update
            await (sidebarProvider as any).handleUpdateGroup('test-group-id', {
                name: 'Updated',
                port: 8888,
                interceptPrefix: '/api',
                baseUrl: 'http://localhost:8080',
                stripPrefix: true,
                globalCookie: '',
                enabled: true,
            });
            expect((configManager.updateProxyGroup as sinon.SinonStub)).to.have.been.called;

            // delete (confirm)
            const l10nConfirm = (vscode as any).l10n.t('ui.confirm');
            const origWarn = vscode.window.showWarningMessage;
            (vscode.window as any).showWarningMessage = sandbox
                .stub()
                .resolves(l10nConfirm);
            // Ensure there are at least 2 groups to allow deletion
            const getConfigStub = configManager.getConfig as sinon.SinonStub;
            getConfigStub.returns({
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
                    {
                        id: 'another',
                        name: 'Another',
                        port: 9999,
                        interceptPrefix: '/api',
                        baseUrl: 'http://localhost:8081',
                        stripPrefix: true,
                        globalCookie: '',
                        enabled: true,
                        mockApis: [],
                    },
                ],
            });
            await (sidebarProvider as any).handleDeleteGroup('test-group-id');
            (vscode.window as any).showWarningMessage = origWarn;
        });

        it('handleAddMock/UpdateMock/DeleteMock/ToggleMock', async () => {
            await (sidebarProvider as any).handleAddMock('test-group-id', {
                path: '/x',
                method: 'GET',
                enabled: true,
                mockData: '{}',
                statusCode: 200,
                delay: 0,
            });
            expect((configManager.addMockApi as sinon.SinonStub)).to.have.been.called;

            await (sidebarProvider as any).handleUpdateMock('test-group-id', 0, {
                path: '/x',
                method: 'POST',
                enabled: false,
                mockData: '{}',
                statusCode: 201,
                delay: 10,
            });
            expect((configManager.updateMockApi as sinon.SinonStub)).to.have.been.called;

            const origWarn = vscode.window.showWarningMessage;
            (vscode.window as any).showWarningMessage = sandbox
                .stub()
                .resolves((vscode as any).l10n.t('ui.confirm'));
            await (sidebarProvider as any).handleDeleteMock('test-group-id', 0);
            (vscode.window as any).showWarningMessage = origWarn;

            // toggle: flip enabled and save
            const getConfigStub = configManager.getConfig as sinon.SinonStub;
            const cfg = {
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
                        mockApis: [
                            {
                                path: '/t',
                                method: 'GET',
                                enabled: true,
                                mockData: '{}',
                                statusCode: 200,
                            },
                        ],
                    },
                ],
            };
            getConfigStub.returns(cfg as any);
            await (sidebarProvider as any).handleToggleMock('test-group-id', 0);
            expect((configManager.saveConfig as sinon.SinonStub)).to.have.been.called;
        });

        it('refreshWebview posts message with statuses', async () => {
            // make group running
            (mockServerManager.getGroupStatus as sinon.SinonStub).returns(true);
            await (sidebarProvider as any).refreshWebview();
            expect(webviewViewStub.webview.postMessage).to.have.been.called;
            const arg = webviewViewStub.webview.postMessage.firstCall.args[0];
            expect(arg.type).to.equal('configUpdated');
            expect(arg.groupStatuses).to.be.an('object');
        });
    });
});
