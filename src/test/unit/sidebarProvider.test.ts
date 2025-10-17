import { describe, it, beforeEach } from 'mocha';
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

    beforeEach(() => {
        // Create mock extension URI
        extensionUri = vscode.Uri.file('/fake/path');

        // Create mock config manager
        configManager = {
            getConfig: sinon.stub().returns({
                port: 8888,
                interceptPrefix: '/api',
                baseUrl: 'http://localhost:8080',
                stripPrefix: true,
                globalCookie: '',
                mockApis: []
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
            getStatus: sinon.stub().returns(false)
        } as any;

        sidebarProvider = new SidebarProvider(extensionUri, mockServerManager, configManager);
    });

    describe('constructor', () => {
        it('should create an instance', () => {
            expect(sidebarProvider).to.be.instanceOf(SidebarProvider);
        });
    });

    describe('renderMockList', () => {
        it('should render empty state when no mocks configured', () => {
            // Access private method through any to test
            const html = (sidebarProvider as any).renderMockList([]);
            expect(html).to.include('No mock APIs configured');
        });

        it('should render mock items with correct structure', () => {
            const mockApis = [
                {
                    path: '/test',
                    method: 'GET',
                    enabled: true,
                    mockData: '{}',
                    statusCode: 200
                }
            ];

            const html = (sidebarProvider as any).renderMockList(mockApis);
            expect(html).to.include('GET');
            expect(html).to.include('/test');
            expect(html).to.include('Disable');
        });

        it('should render disabled mock items differently', () => {
            const mockApis = [
                {
                    path: '/disabled',
                    method: 'POST',
                    enabled: false,
                    mockData: '{}',
                    statusCode: 200
                }
            ];

            const html = (sidebarProvider as any).renderMockList(mockApis);
            expect(html).to.include('POST');
            expect(html).to.include('/disabled');
            expect(html).to.include('Enable');
            expect(html).to.include('disabled');
        });

        it('should render multiple mock items', () => {
            const mockApis = [
                {
                    path: '/test1',
                    method: 'GET',
                    enabled: true,
                    mockData: '{}',
                    statusCode: 200
                },
                {
                    path: '/test2',
                    method: 'POST',
                    enabled: false,
                    mockData: '{}',
                    statusCode: 201
                }
            ];

            const html = (sidebarProvider as any).renderMockList(mockApis);
            expect(html).to.include('/test1');
            expect(html).to.include('/test2');
            expect(html).to.include('GET');
            expect(html).to.include('POST');
        });

        it('should apply correct CSS classes for different methods', () => {
            const mockApis = [
                { path: '/get', method: 'GET', enabled: true, mockData: '{}', statusCode: 200 },
                { path: '/post', method: 'POST', enabled: true, mockData: '{}', statusCode: 200 },
                { path: '/put', method: 'PUT', enabled: true, mockData: '{}', statusCode: 200 },
                { path: '/delete', method: 'DELETE', enabled: true, mockData: '{}', statusCode: 200 }
            ];

            const html = (sidebarProvider as any).renderMockList(mockApis);
            expect(html).to.include('mock-method get');
            expect(html).to.include('mock-method post');
            expect(html).to.include('mock-method put');
            expect(html).to.include('mock-method delete');
        });
    });

    describe('getHtmlForWebview', () => {
        it('should generate HTML with server stopped state', () => {
            (mockServerManager.getStatus as sinon.SinonStub).returns(false);

            const html = (sidebarProvider as any).getHtmlForWebview({} as vscode.Webview);
            expect(html).to.include('Intercept Wave');
            expect(html).to.include('stopped');
            expect(html).to.include('Start Server');
        });

        it('should generate HTML with server running state', () => {
            (mockServerManager.getStatus as sinon.SinonStub).returns(true);
            (configManager.getConfig as sinon.SinonStub).returns({
                port: 8888,
                interceptPrefix: '/api',
                baseUrl: 'http://localhost:8080',
                stripPrefix: true,
                globalCookie: '',
                mockApis: []
            });

            const html = (sidebarProvider as any).getHtmlForWebview({} as vscode.Webview);
            expect(html).to.include('running');
            expect(html).to.include('8888');
        });

        it('should include mock API count in HTML', () => {
            (configManager.getConfig as sinon.SinonStub).returns({
                port: 8888,
                interceptPrefix: '/api',
                baseUrl: 'http://localhost:8080',
                stripPrefix: true,
                globalCookie: '',
                mockApis: [
                    { path: '/test1', method: 'GET', enabled: true, mockData: '{}', statusCode: 200 },
                    { path: '/test2', method: 'POST', enabled: false, mockData: '{}', statusCode: 200 }
                ]
            });

            const html = (sidebarProvider as any).getHtmlForWebview({} as vscode.Webview);
            expect(html).to.include('1/2'); // 1 enabled out of 2 total
        });

        it('should return valid HTML string', () => {
            const html = (sidebarProvider as any).getHtmlForWebview({} as vscode.Webview);
            expect(html).to.be.a('string');
            expect(html).to.include('<!DOCTYPE html>');
            expect(html).to.include('</html>');
        });

        it('should include CORS-compatible scripts', () => {
            const html = (sidebarProvider as any).getHtmlForWebview({} as vscode.Webview);
            expect(html).to.include('acquireVsCodeApi');
            expect(html).to.include('postMessage');
        });
    });
});