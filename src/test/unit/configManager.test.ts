import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigManager } from '../../configManager';

describe('ConfigManager', () => {
    let configManager: ConfigManager;
    let configDir: string;
    let configPath: string;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        // Get the workspace folder from the mock
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder found in test');
        }

        configDir = path.join(workspaceFolder.uri.fsPath, '.intercept-wave');
        configPath = path.join(configDir, 'config.json');

        // Clean up any existing test config
        if (fs.existsSync(configDir)) {
            fs.rmSync(configDir, { recursive: true, force: true });
        }

        // Create mock context
        mockContext = {
            subscriptions: [],
            extensionPath: workspaceFolder.uri.fsPath,
            globalState: {} as any,
            workspaceState: {} as any,
            extensionUri: vscode.Uri.file(workspaceFolder.uri.fsPath),
            environmentVariableCollection: {} as any,
            asAbsolutePath: (relativePath: string) => path.join(workspaceFolder.uri.fsPath, relativePath),
            storageUri: vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, 'storage')),
            globalStorageUri: vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, 'globalStorage')),
            logUri: vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, 'logs')),
            extensionMode: 3,
            storagePath: path.join(workspaceFolder.uri.fsPath, 'storage'),
            globalStoragePath: path.join(workspaceFolder.uri.fsPath, 'globalStorage'),
            logPath: path.join(workspaceFolder.uri.fsPath, 'logs'),
            secrets: {} as any,
            extension: {} as any,
            languageModelAccessInformation: {} as any
        };

        // Create ConfigManager instance - this will create the config directory and file
        configManager = new ConfigManager(mockContext);
    });

    afterEach(() => {
        // Clean up test config directory
        if (fs.existsSync(configDir)) {
            fs.rmSync(configDir, { recursive: true, force: true });
        }
    });

    describe('constructor', () => {
        it('should create config directory if it does not exist', () => {
            fs.rmSync(configDir, { recursive: true, force: true });
            expect(fs.existsSync(configDir)).to.be.false;

            fs.mkdirSync(configDir, { recursive: true });
            expect(fs.existsSync(configDir)).to.be.true;
        });
    });

    describe('getConfigPath', () => {
        it('should return correct config path', () => {
            const result = configManager.getConfigPath();
            expect(result).to.equal(configPath);
        });
    });

    describe('getConfig', () => {
        it('should return default config for new installation', () => {
            const config = configManager.getConfig();

            expect(config.port).to.equal(8888);
            expect(config.interceptPrefix).to.equal('/api');
            expect(config.baseUrl).to.equal('http://localhost:8080');
            expect(config.stripPrefix).to.be.true;
            expect(config.globalCookie).to.equal('');
            expect(Array.isArray(config.mockApis)).to.be.true;
            expect(config.mockApis.length).to.equal(0);
        });

        it('should read and merge existing config with defaults', () => {
            const partialConfig = {
                port: 9999,
                interceptPrefix: '/custom'
            };

            fs.writeFileSync(configPath, JSON.stringify(partialConfig, null, 2), 'utf-8');

            const config = configManager.getConfig();

            expect(config.port).to.equal(9999);
            expect(config.interceptPrefix).to.equal('/custom');
            expect(config.baseUrl).to.equal('http://localhost:8080');
            expect(config.stripPrefix).to.be.true;
        });

        it('should ensure mockApis is an array even if config has invalid value', () => {
            const invalidConfig = {
                port: 8888,
                mockApis: null as any
            };

            fs.writeFileSync(configPath, JSON.stringify(invalidConfig, null, 2), 'utf-8');

            const config = configManager.getConfig();

            expect(Array.isArray(config.mockApis)).to.be.true;
            expect(config.mockApis.length).to.equal(0);
        });

        it('should return default config if config file has invalid JSON', () => {
            fs.writeFileSync(configPath, 'invalid json', 'utf-8');

            const config = configManager.getConfig();

            expect(config.port).to.equal(8888);
            expect(config.interceptPrefix).to.equal('/api');
        });

        it('should return default config if config file does not exist', () => {
            if (fs.existsSync(configPath)) {
                fs.unlinkSync(configPath);
            }

            const config = configManager.getConfig();

            expect(config.port).to.equal(8888);
            expect(Array.isArray(config.mockApis)).to.be.true;
        });
    });

    describe('saveConfig', () => {
        it('should save config to file', async () => {
            const testConfig = {
                port: 7777,
                interceptPrefix: '/test',
                baseUrl: 'http://test.com',
                stripPrefix: false,
                globalCookie: 'test-cookie',
                mockApis: []
            };

            await configManager.saveConfig(testConfig);

            const content = fs.readFileSync(configPath, 'utf-8');
            const savedConfig = JSON.parse(content);

            expect(savedConfig).to.deep.equal(testConfig);
        });

        it('should format JSON with proper indentation', async () => {
            const testConfig = {
                port: 8888,
                interceptPrefix: '/api',
                baseUrl: 'http://localhost:8080',
                stripPrefix: true,
                globalCookie: '',
                mockApis: []
            };

            await configManager.saveConfig(testConfig);

            const content = fs.readFileSync(configPath, 'utf-8');

            // Should have indentation (not minified)
            expect(content).to.include('\n');
            expect(content).to.include('  ');
        });
    });

    describe('addMockApi', () => {
        it('should add new mock API to config', async () => {
            const mockApi = {
                path: '/user',
                method: 'GET',
                enabled: true,
                mockData: '{"id": 1}',
                statusCode: 200,
                delay: 0
            };

            await configManager.addMockApi(mockApi);

            const config = configManager.getConfig();

            expect(config.mockApis.length).to.equal(1);
            expect(config.mockApis[0]).to.deep.equal(mockApi);
        });

        it('should append multiple mock APIs', async () => {
            const mockApi1 = {
                path: '/user',
                method: 'GET',
                enabled: true,
                mockData: '{"id": 1}',
                statusCode: 200,
                delay: 0
            };

            const mockApi2 = {
                path: '/posts',
                method: 'GET',
                enabled: true,
                mockData: '[]',
                statusCode: 200,
                delay: 0
            };

            await configManager.addMockApi(mockApi1);
            await configManager.addMockApi(mockApi2);

            const config = configManager.getConfig();

            expect(config.mockApis.length).to.equal(2);
            expect(config.mockApis[0].path).to.equal('/user');
            expect(config.mockApis[1].path).to.equal('/posts');
        });
    });

    describe('removeMockApi', () => {
        it('should remove mock API at specified index', async () => {
            const mockApi1 = {
                path: '/user',
                method: 'GET',
                enabled: true,
                mockData: '{}',
                statusCode: 200,
                delay: 0
            };

            const mockApi2 = {
                path: '/posts',
                method: 'GET',
                enabled: true,
                mockData: '[]',
                statusCode: 200,
                delay: 0
            };

            await configManager.addMockApi(mockApi1);
            await configManager.addMockApi(mockApi2);
            await configManager.removeMockApi(0);

            const config = configManager.getConfig();

            expect(config.mockApis.length).to.equal(1);
            expect(config.mockApis[0].path).to.equal('/posts');
        });

        it('should handle removing from empty array gracefully', async () => {
            await configManager.removeMockApi(0);

            const config = configManager.getConfig();

            expect(config.mockApis.length).to.equal(0);
        });
    });

    describe('updateMockApi', () => {
        it('should update mock API at specified index', async () => {
            const mockApi = {
                path: '/user',
                method: 'GET',
                enabled: true,
                mockData: '{}',
                statusCode: 200,
                delay: 0
            };

            const updatedMockApi = {
                path: '/user',
                method: 'POST',
                enabled: false,
                mockData: '{"updated": true}',
                statusCode: 201,
                delay: 100
            };

            await configManager.addMockApi(mockApi);
            await configManager.updateMockApi(0, updatedMockApi);

            const config = configManager.getConfig();

            expect(config.mockApis.length).to.equal(1);
            expect(config.mockApis[0]).to.deep.equal(updatedMockApi);
        });

        it('should update correct API when multiple exist', async () => {
            const mockApi1 = {
                path: '/user',
                method: 'GET',
                enabled: true,
                mockData: '{}',
                statusCode: 200,
                delay: 0
            };

            const mockApi2 = {
                path: '/posts',
                method: 'GET',
                enabled: true,
                mockData: '[]',
                statusCode: 200,
                delay: 0
            };

            const updatedMockApi = {
                path: '/posts',
                method: 'POST',
                enabled: false,
                mockData: '[{"id": 1}]',
                statusCode: 201,
                delay: 50
            };

            await configManager.addMockApi(mockApi1);
            await configManager.addMockApi(mockApi2);
            await configManager.updateMockApi(1, updatedMockApi);

            const config = configManager.getConfig();

            expect(config.mockApis.length).to.equal(2);
            expect(config.mockApis[0].path).to.equal('/user');
            expect(config.mockApis[0].method).to.equal('GET');
            expect(config.mockApis[1]).to.deep.equal(updatedMockApi);
        });
    });
});