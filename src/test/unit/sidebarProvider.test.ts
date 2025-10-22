import { describe, it, beforeEach, before, afterEach } from 'mocha';
import { expect, use } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { SidebarProvider } from '../../sidebarProvider';
import { MockServerManager } from '../../mockServer';
import { ConfigManager } from '../../configManager';

const sinonChai = require('sinon-chai');
use(sinonChai);

describe('SidebarProvider', () => {
    let sidebarProvider: SidebarProvider;
    let mockServerManager: MockServerManager;
    let configManager: ConfigManager;
    let extensionUri: vscode.Uri;
    let mockWebview: any;
    let mockWebviewView: vscode.WebviewView;
    let sandbox: sinon.SinonSandbox;

    before(() => {
        // Add vscode.Uri.joinPath if it doesn't exist (for testing environment)
        if (!(vscode.Uri as any).joinPath) {
            (vscode.Uri as any).joinPath = () => {
                return vscode.Uri.file('/fake/joined/path');
            };
        }

        // Mock vscode.l10n for tests
        if (!vscode.l10n) {
            (vscode as any).l10n = {
                t: (key: string, ...args: any[]) => {
                    // Return a simple string for testing
                    return key;
                }
            };
        } else if (!(vscode.l10n as any).t) {
            (vscode.l10n as any).t = (key: string, ...args: any[]) => {
                return key;
            };
        }
    });

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // Create mock extension URI
        extensionUri = vscode.Uri.file('/fake/path');

        // Create mock webview with asWebviewUri method
        mockWebview = {
            asWebviewUri: (uri: vscode.Uri) => uri,
            options: {},
            html: '',
            postMessage: sandbox.stub(),
            onDidReceiveMessage: sandbox.stub().returns({ dispose: sandbox.stub() })
        };

        // Create mock webview view
        mockWebviewView = {
            webview: mockWebview,
            onDidDispose: sandbox.stub(),
            onDidChangeVisibility: sandbox.stub(),
            visible: true,
            show: sandbox.stub(),
            title: 'Test View'
        } as any;

        // Create mock config manager with v2.0 structure (proxyGroups)
        configManager = {
            getConfig: sandbox.stub().returns({
                version: '2.0',
                proxyGroups: [{
                    id: 'test-group-id',
                    name: 'Test Group',
                    port: 8888,
                    interceptPrefix: '/api',
                    baseUrl: 'http://localhost:8080',
                    stripPrefix: true,
                    globalCookie: '',
                    enabled: true,
                    mockApis: []
                }]
            }),
            saveConfig: sandbox.stub().resolves(),
            addMockApi: sandbox.stub().resolves(),
            removeMockApi: sandbox.stub().resolves(),
            updateMockApi: sandbox.stub().resolves(),
            addProxyGroup: sandbox.stub().resolves(),
            removeProxyGroup: sandbox.stub().resolves(),
            updateProxyGroup: sandbox.stub().resolves(),
            getConfigPath: sandbox.stub().returns('/fake/config/path')
        } as any;

        // Create mock server manager
        mockServerManager = {
            start: sandbox.stub().resolves('http://localhost:8888 (Test Group)'),
            stop: sandbox.stub().resolves(),
            startGroupById: sandbox.stub().resolves('http://localhost:8888 (Test Group)'),
            stopGroupById: sandbox.stub().resolves(),
            getStatus: sandbox.stub().returns(false),
            getGroupStatus: sandbox.stub().returns(false)
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

    describe('resolveWebviewView', () => {
        it('should set webview options', () => {
            sidebarProvider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
            expect(mockWebview.options.enableScripts).to.be.true;
            expect(mockWebview.options.localResourceRoots).to.deep.equal([extensionUri]);
        });

        it('should set webview HTML', () => {
            sidebarProvider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
            expect(mockWebview.html).to.be.a('string');
        });

        it('should register message handler', () => {
            sidebarProvider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
            expect(mockWebview.onDidReceiveMessage.called).to.be.true;
        });
    });

    describe('handleMessage - startServer', () => {
        beforeEach(() => {
            sidebarProvider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
        });

        it('should start server and show success message', async () => {
            const showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');
            const handler = mockWebview.onDidReceiveMessage.firstCall.args[0];

            await handler({ type: 'startServer' });

            expect(mockServerManager.start).to.have.been.calledOnce;
            expect(showInformationMessageStub).to.have.been.called;
        });

        it('should show error message on start failure', async () => {
            const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
            (mockServerManager.start as sinon.SinonStub).rejects(new Error('Start failed'));
            const handler = mockWebview.onDidReceiveMessage.firstCall.args[0];

            await handler({ type: 'startServer' });

            expect(showErrorMessageStub).to.have.been.called;
        });
    });

    describe('handleMessage - stopServer', () => {
        beforeEach(() => {
            sidebarProvider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
        });

        it('should stop server and show success message', async () => {
            const showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');
            const handler = mockWebview.onDidReceiveMessage.firstCall.args[0];

            await handler({ type: 'stopServer' });

            expect(mockServerManager.stop).to.have.been.calledOnce;
            expect(showInformationMessageStub).to.have.been.called;
        });

        it('should show error message on stop failure', async () => {
            const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
            (mockServerManager.stop as sinon.SinonStub).rejects(new Error('Stop failed'));
            const handler = mockWebview.onDidReceiveMessage.firstCall.args[0];

            await handler({ type: 'stopServer' });

            expect(showErrorMessageStub).to.have.been.called;
        });
    });

    describe('handleMessage - startGroup', () => {
        beforeEach(() => {
            sidebarProvider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
        });

        it('should start specific group', async () => {
            const showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');
            const handler = mockWebview.onDidReceiveMessage.firstCall.args[0];

            await handler({ type: 'startGroup', groupId: 'test-group-id' });

            expect(mockServerManager.startGroupById).to.have.been.calledWith('test-group-id');
            expect(showInformationMessageStub).to.have.been.called;
        });
    });

    describe('handleMessage - stopGroup', () => {
        beforeEach(() => {
            sidebarProvider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
        });

        it('should stop specific group', async () => {
            const showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');
            const handler = mockWebview.onDidReceiveMessage.firstCall.args[0];

            await handler({ type: 'stopGroup', groupId: 'test-group-id' });

            expect(mockServerManager.stopGroupById).to.have.been.calledWith('test-group-id');
            expect(showInformationMessageStub).to.have.been.called;
        });
    });

    describe('handleMessage - addGroup', () => {
        beforeEach(() => {
            sidebarProvider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
        });

        it('should add new proxy group with valid data', async () => {
            const showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');
            const handler = mockWebview.onDidReceiveMessage.firstCall.args[0];

            const newGroupData = {
                name: 'New Group',
                enabled: true,
                port: 9999,
                interceptPrefix: '/new-api',
                baseUrl: 'http://localhost:9000',
                stripPrefix: false,
                globalCookie: ''
            };

            await handler({ type: 'addGroup', data: newGroupData });

            expect(configManager.addProxyGroup).to.have.been.calledOnce;
            expect(showInformationMessageStub).to.have.been.called;
            expect(mockWebview.postMessage).to.have.been.calledWith({ type: 'closeGroupForm' });
        });

        it('should reject group with invalid port', async () => {
            const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
            const handler = mockWebview.onDidReceiveMessage.firstCall.args[0];

            const invalidData = {
                name: 'Invalid Group',
                enabled: true,
                port: 100, // Invalid port (< 1024)
                interceptPrefix: '/api',
                baseUrl: 'http://localhost:8080',
                stripPrefix: true,
                globalCookie: ''
            };

            await handler({ type: 'addGroup', data: invalidData });

            expect(configManager.addProxyGroup).to.not.have.been.called;
            expect(showErrorMessageStub).to.have.been.called;
        });

        it('should reject group with empty name', async () => {
            const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
            const handler = mockWebview.onDidReceiveMessage.firstCall.args[0];

            const invalidData = {
                name: '',
                enabled: true,
                port: 8888,
                interceptPrefix: '/api',
                baseUrl: 'http://localhost:8080',
                stripPrefix: true,
                globalCookie: ''
            };

            await handler({ type: 'addGroup', data: invalidData });

            expect(configManager.addProxyGroup).to.not.have.been.called;
            expect(showErrorMessageStub).to.have.been.called;
        });

        it('should reject group with duplicate port', async () => {
            const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
            const handler = mockWebview.onDidReceiveMessage.firstCall.args[0];

            const duplicateData = {
                name: 'Duplicate Port Group',
                enabled: true,
                port: 8888, // Same as existing test group
                interceptPrefix: '/api',
                baseUrl: 'http://localhost:8080',
                stripPrefix: true,
                globalCookie: ''
            };

            await handler({ type: 'addGroup', data: duplicateData });

            expect(configManager.addProxyGroup).to.not.have.been.called;
            expect(showErrorMessageStub).to.have.been.called;
        });
    });

    describe('handleMessage - updateGroup', () => {
        beforeEach(() => {
            sidebarProvider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
        });

        it('should update existing group', async () => {
            const showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');
            const handler = mockWebview.onDidReceiveMessage.firstCall.args[0];

            const updateData = {
                name: 'Updated Group',
                enabled: false,
                port: 8888,
                interceptPrefix: '/updated-api',
                baseUrl: 'http://localhost:9000',
                stripPrefix: false,
                globalCookie: 'test=value'
            };

            await handler({ type: 'updateGroup', groupId: 'test-group-id', data: updateData });

            expect(configManager.updateProxyGroup).to.have.been.calledWith('test-group-id', updateData);
            expect(showInformationMessageStub).to.have.been.called;
            expect(mockWebview.postMessage).to.have.been.calledWith({ type: 'closeGroupForm' });
        });
    });

    describe('handleMessage - deleteGroup', () => {
        beforeEach(() => {
            sidebarProvider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
        });

        it('should delete group after confirmation', async () => {
            const showWarningMessageStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves('确认' as any);
            const showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');
            (configManager.getConfig as sinon.SinonStub).returns({
                version: '2.0',
                proxyGroups: [
                    { id: 'test-group-id', name: 'Test Group', port: 8888, mockApis: [] },
                    { id: 'other-group-id', name: 'Other Group', port: 9999, mockApis: [] }
                ]
            });
            const handler = mockWebview.onDidReceiveMessage.firstCall.args[0];

            await handler({ type: 'deleteGroup', groupId: 'test-group-id' });

            expect(showWarningMessageStub).to.have.been.called;
            expect(configManager.removeProxyGroup).to.have.been.calledWith('test-group-id');
            expect(showInformationMessageStub).to.have.been.called;
        });

        it('should not delete last remaining group', async () => {
            const showWarningMessageStub = sandbox.stub(vscode.window, 'showWarningMessage');
            const handler = mockWebview.onDidReceiveMessage.firstCall.args[0];

            // Only one group in config
            (configManager.getConfig as sinon.SinonStub).returns({
                version: '2.0',
                proxyGroups: [
                    { id: 'test-group-id', name: 'Test Group', port: 8888, mockApis: [] }
                ]
            });

            await handler({ type: 'deleteGroup', groupId: 'test-group-id' });

            expect(showWarningMessageStub).to.have.been.called;
            expect(configManager.removeProxyGroup).to.not.have.been.called;
        });

        it('should cancel deletion if user does not confirm', async () => {
            const showWarningMessageStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined);
            (configManager.getConfig as sinon.SinonStub).returns({
                version: '2.0',
                proxyGroups: [
                    { id: 'test-group-id', name: 'Test Group', port: 8888, mockApis: [] },
                    { id: 'other-group-id', name: 'Other Group', port: 9999, mockApis: [] }
                ]
            });
            const handler = mockWebview.onDidReceiveMessage.firstCall.args[0];

            await handler({ type: 'deleteGroup', groupId: 'test-group-id' });

            expect(showWarningMessageStub).to.have.been.called;
            expect(configManager.removeProxyGroup).to.not.have.been.called;
        });
    });

    describe('handleMessage - addMock', () => {
        beforeEach(() => {
            sidebarProvider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
        });

        it('should add mock API to group', async () => {
            const showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');
            const handler = mockWebview.onDidReceiveMessage.firstCall.args[0];

            const mockData = {
                path: '/test',
                method: 'GET',
                statusCode: 200,
                mockData: '{"success": true}',
                enabled: true,
                delay: 0,
                useCookie: false
            };

            await handler({ type: 'addMock', groupId: 'test-group-id', data: mockData });

            expect(configManager.addMockApi).to.have.been.calledWith('test-group-id', mockData);
            expect(showInformationMessageStub).to.have.been.called;
        });
    });

    describe('handleMessage - updateMock', () => {
        beforeEach(() => {
            sidebarProvider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
        });

        it('should update existing mock API', async () => {
            const showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');
            const handler = mockWebview.onDidReceiveMessage.firstCall.args[0];

            const mockData = {
                path: '/updated',
                method: 'POST',
                statusCode: 201,
                mockData: '{"updated": true}',
                enabled: false,
                delay: 100,
                useCookie: true
            };

            await handler({ type: 'updateMock', groupId: 'test-group-id', index: 0, data: mockData });

            expect(configManager.updateMockApi).to.have.been.calledWith('test-group-id', 0, mockData);
            expect(showInformationMessageStub).to.have.been.called;
        });
    });

    describe('handleMessage - deleteMock', () => {
        beforeEach(() => {
            sidebarProvider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
        });

        it('should delete mock API after confirmation', async () => {
            const showWarningMessageStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves('确认' as any);
            const showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');
            const handler = mockWebview.onDidReceiveMessage.firstCall.args[0];

            await handler({ type: 'deleteMock', groupId: 'test-group-id', index: 0 });

            expect(showWarningMessageStub).to.have.been.called;
            expect(configManager.removeMockApi).to.have.been.calledWith('test-group-id', 0);
            expect(showInformationMessageStub).to.have.been.called;
        });

        it('should cancel deletion if user does not confirm', async () => {
            const showWarningMessageStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined);
            const handler = mockWebview.onDidReceiveMessage.firstCall.args[0];

            await handler({ type: 'deleteMock', groupId: 'test-group-id', index: 0 });

            expect(showWarningMessageStub).to.have.been.called;
            expect(configManager.removeMockApi).to.not.have.been.called;
        });
    });

    describe('handleMessage - toggleMock', () => {
        beforeEach(() => {
            sidebarProvider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
            (configManager.getConfig as sinon.SinonStub).returns({
                version: '2.0',
                proxyGroups: [{
                    id: 'test-group-id',
                    name: 'Test Group',
                    port: 8888,
                    mockApis: [
                        { path: '/test', method: 'GET', enabled: true, mockData: '{}', statusCode: 200 }
                    ]
                }]
            });
        });

        it('should toggle mock API enabled state', async () => {
            const handler = mockWebview.onDidReceiveMessage.firstCall.args[0];

            await handler({ type: 'toggleMock', groupId: 'test-group-id', index: 0 });

            expect(configManager.saveConfig).to.have.been.called;
            // Verify the mock was toggled (from true to false)
            const savedConfig = (configManager.saveConfig as sinon.SinonStub).firstCall.args[0];
            expect(savedConfig.proxyGroups[0].mockApis[0].enabled).to.be.false;
        });
    });

    describe('validateGroupData', () => {
        beforeEach(() => {
            sidebarProvider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
        });

        it('should accept valid group data', () => {
            const validData = {
                name: 'Valid Group',
                enabled: true,
                port: 9999,
                interceptPrefix: '/api',
                baseUrl: 'http://localhost:8080',
                stripPrefix: true,
                globalCookie: ''
            };

            const result = (sidebarProvider as any).validateGroupData(validData);
            expect(result).to.be.null;
        });

        it('should reject empty name', () => {
            const invalidData = {
                name: '',
                port: 8888
            };

            const result = (sidebarProvider as any).validateGroupData(invalidData);
            expect(result).to.be.a('string');
        });

        it('should reject invalid port number', () => {
            const invalidData = {
                name: 'Test',
                port: 'invalid'
            };

            const result = (sidebarProvider as any).validateGroupData(invalidData);
            expect(result).to.be.a('string');
        });

        it('should reject port below 1024', () => {
            const invalidData = {
                name: 'Test',
                port: 1000
            };

            const result = (sidebarProvider as any).validateGroupData(invalidData);
            expect(result).to.be.a('string');
        });

        it('should reject port above 65535', () => {
            const invalidData = {
                name: 'Test',
                port: 70000
            };

            const result = (sidebarProvider as any).validateGroupData(invalidData);
            expect(result).to.be.a('string');
        });

        it('should allow same port when editing same group', () => {
            const validData = {
                name: 'Test Group',
                port: 8888 // Same port as test-group-id
            };

            const result = (sidebarProvider as any).validateGroupData(validData, 'test-group-id');
            expect(result).to.be.null;
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
});