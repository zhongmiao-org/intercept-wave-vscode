import { describe, it, beforeEach, before } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { SidebarProvider } from '../../sidebarProvider';
import { MockServerManager } from '../../mockServer';
import { ConfigManager } from '../../configManager';

describe('SidebarProvider', () => {
    let sidebarProvider: SidebarProvider;
    let mockServerManager: MockServerManager;
    let configManager: ConfigManager;
    let extensionUri: vscode.Uri;
    let mockWebview: any;

    before(() => {
        // Add vscode.Uri.joinPath if it doesn't exist (for testing environment)
        if (!(vscode.Uri as any).joinPath) {
            (vscode.Uri as any).joinPath = () => {
                return vscode.Uri.file('/fake/joined/path');
            };
        }
    });

    beforeEach(() => {
        // Create mock extension URI
        extensionUri = vscode.Uri.file('/fake/path');

        // Create mock webview with asWebviewUri method
        mockWebview = {
            asWebviewUri: (uri: vscode.Uri) => uri,
            options: {},
            postMessage: sinon.stub()
        };

        // Create mock config manager with v2.0 structure (proxyGroups)
        configManager = {
            getConfig: sinon.stub().returns({
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
            saveConfig: sinon.stub(),
            addMockApi: sinon.stub(),
            removeMockApi: sinon.stub(),
            updateMockApi: sinon.stub(),
            getConfigPath: sinon.stub()
        } as any;

        // Create mock server manager
        mockServerManager = {
            start: sinon.stub().resolves('http://localhost:8888'),
            stop: sinon.stub().resolves(),
            getStatus: sinon.stub().returns(false),
            getGroupStatus: sinon.stub().returns(false)
        } as any;

        sidebarProvider = new SidebarProvider(extensionUri, mockServerManager, configManager);
    });

    describe('constructor', () => {
        it('should create an instance', () => {
            expect(sidebarProvider).to.be.instanceOf(SidebarProvider);
        });
    });

    // Note: getHtmlForWebview tests require full VSCode API mocking
    // Skipping these tests in unit test environment
    describe.skip('getHtmlForWebview (requires full VSCode API)', () => {
        it('should generate HTML with server stopped state', () => {
            (mockServerManager.getStatus as sinon.SinonStub).returns(false);

            const html = (sidebarProvider as any).getHtmlForWebview(mockWebview);
            expect(html).to.be.a('string');
            expect(html).to.include('<!DOCTYPE html>');
        });

        it('should generate HTML with server running state', () => {
            (mockServerManager.getStatus as sinon.SinonStub).returns(true);
            (mockServerManager.getGroupStatus as sinon.SinonStub).returns(true);

            const html = (sidebarProvider as any).getHtmlForWebview(mockWebview);
            expect(html).to.be.a('string');
            expect(html).to.include('Test Group');
            expect(html).to.include('8888');
        });

        it('should include mock API count in HTML', () => {
            (configManager.getConfig as sinon.SinonStub).returns({
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
                    mockApis: [
                        { path: '/test1', method: 'GET', enabled: true, mockData: '{}', statusCode: 200 },
                        { path: '/test2', method: 'POST', enabled: false, mockData: '{}', statusCode: 200 }
                    ]
                }]
            });

            const html = (sidebarProvider as any).getHtmlForWebview(mockWebview);
            expect(html).to.include('Test Group');
        });

        it('should return valid HTML string', () => {
            const html = (sidebarProvider as any).getHtmlForWebview(mockWebview);
            expect(html).to.be.a('string');
            expect(html).to.include('<!DOCTYPE html>');
            expect(html).to.include('</html>');
        });

        it('should include CORS-compatible scripts', () => {
            const html = (sidebarProvider as any).getHtmlForWebview(mockWebview);
            expect(html).to.include('acquireVsCodeApi');
            expect(html).to.include('postMessage');
        });
    });
});