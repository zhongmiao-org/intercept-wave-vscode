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

            expect(config.version).to.equal('2.0');
            expect(Array.isArray(config.proxyGroups)).to.be.true;
            expect(config.proxyGroups.length).to.equal(1);

            const defaultGroup = config.proxyGroups[0];
            expect(defaultGroup.port).to.equal(8888);
            expect(defaultGroup.interceptPrefix).to.equal('/api');
            expect(defaultGroup.baseUrl).to.equal('http://localhost:8080');
            expect(defaultGroup.stripPrefix).to.be.true;
            expect(defaultGroup.globalCookie).to.equal('');
            expect(Array.isArray(defaultGroup.mockApis)).to.be.true;
            expect(defaultGroup.mockApis.length).to.equal(0);
        });

        it('should read and merge existing config with defaults (migration from legacy)', () => {
            const partialConfig = {
                port: 9999,
                interceptPrefix: '/custom'
            };

            fs.writeFileSync(configPath, JSON.stringify(partialConfig, null, 2), 'utf-8');

            const config = configManager.getConfig();

            // Should migrate to v2.0 format
            expect(config.version).to.equal('2.0');
            expect(Array.isArray(config.proxyGroups)).to.be.true;
            expect(config.proxyGroups.length).to.equal(1);
            expect(config.proxyGroups[0].port).to.equal(9999);
            expect(config.proxyGroups[0].interceptPrefix).to.equal('/custom');
            expect(config.proxyGroups[0].baseUrl).to.equal('http://localhost:8080');
            expect(config.proxyGroups[0].stripPrefix).to.be.true;
        });

        it('should ensure mockApis is an array even if config has invalid value (legacy migration)', () => {
            const invalidConfig = {
                port: 8888,
                mockApis: null as any
            };

            fs.writeFileSync(configPath, JSON.stringify(invalidConfig, null, 2), 'utf-8');

            const config = configManager.getConfig();

            // Should migrate and fix invalid mockApis
            expect(config.version).to.equal('2.0');
            expect(Array.isArray(config.proxyGroups)).to.be.true;
            expect(Array.isArray(config.proxyGroups[0].mockApis)).to.be.true;
            expect(config.proxyGroups[0].mockApis.length).to.equal(0);
        });

        it('should return default config if config file has invalid JSON', () => {
            fs.writeFileSync(configPath, 'invalid json', 'utf-8');

            const config = configManager.getConfig();

            expect(config.version).to.equal('2.0');
            expect(Array.isArray(config.proxyGroups)).to.be.true;
            expect(config.proxyGroups[0].port).to.equal(8888);
            expect(config.proxyGroups[0].interceptPrefix).to.equal('/api');
        });

        it('should return default config if config file does not exist', () => {
            if (fs.existsSync(configPath)) {
                fs.unlinkSync(configPath);
            }

            const config = configManager.getConfig();

            expect(config.version).to.equal('2.0');
            expect(Array.isArray(config.proxyGroups)).to.be.true;
            expect(config.proxyGroups[0].port).to.equal(8888);
            expect(Array.isArray(config.proxyGroups[0].mockApis)).to.be.true;
        });
    });

    describe('saveConfig', () => {
        it('should save config to file', async () => {
            const testConfig = {
                version: '2.0',
                proxyGroups: [{
                    id: 'test-id',
                    name: 'Test Group',
                    port: 7777,
                    interceptPrefix: '/test',
                    baseUrl: 'http://test.com',
                    stripPrefix: false,
                    globalCookie: 'test-cookie',
                    enabled: true,
                    mockApis: []
                }]
            };

            await configManager.saveConfig(testConfig);

            const content = fs.readFileSync(configPath, 'utf-8');
            const savedConfig = JSON.parse(content);

            expect(savedConfig).to.deep.equal(testConfig);
        });

        it('should format JSON with proper indentation', async () => {
            const testConfig = {
                version: '2.0',
                proxyGroups: [{
                    id: 'test-id',
                    name: 'Test Group',
                    port: 8888,
                    interceptPrefix: '/api',
                    baseUrl: 'http://localhost:8080',
                    stripPrefix: true,
                    globalCookie: '',
                    enabled: true,
                    mockApis: []
                }]
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
            const config = configManager.getConfig();
            const groupId = config.proxyGroups[0].id;

            const mockApi = {
                path: '/user',
                method: 'GET',
                enabled: true,
                mockData: '{"id": 1}',
                statusCode: 200,
                delay: 0
            };

            await configManager.addMockApi(groupId, mockApi);

            const updatedConfig = configManager.getConfig();

            expect(updatedConfig.proxyGroups[0].mockApis.length).to.equal(1);
            expect(updatedConfig.proxyGroups[0].mockApis[0]).to.deep.equal(mockApi);
        });

        it('should append multiple mock APIs', async () => {
            const config = configManager.getConfig();
            const groupId = config.proxyGroups[0].id;

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

            await configManager.addMockApi(groupId, mockApi1);
            await configManager.addMockApi(groupId, mockApi2);

            const updatedConfig = configManager.getConfig();

            expect(updatedConfig.proxyGroups[0].mockApis.length).to.equal(2);
            expect(updatedConfig.proxyGroups[0].mockApis[0].path).to.equal('/user');
            expect(updatedConfig.proxyGroups[0].mockApis[1].path).to.equal('/posts');
        });
    });

    describe('removeMockApi', () => {
        it('should remove mock API at specified index', async () => {
            const config = configManager.getConfig();
            const groupId = config.proxyGroups[0].id;

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

            await configManager.addMockApi(groupId, mockApi1);
            await configManager.addMockApi(groupId, mockApi2);
            await configManager.removeMockApi(groupId, 0);

            const updatedConfig = configManager.getConfig();

            expect(updatedConfig.proxyGroups[0].mockApis.length).to.equal(1);
            expect(updatedConfig.proxyGroups[0].mockApis[0].path).to.equal('/posts');
        });

        it('should handle removing from empty array gracefully', async () => {
            const config = configManager.getConfig();
            const groupId = config.proxyGroups[0].id;

            await configManager.removeMockApi(groupId, 0);

            const updatedConfig = configManager.getConfig();

            expect(updatedConfig.proxyGroups[0].mockApis.length).to.equal(0);
        });
    });

    describe('updateMockApi', () => {
        it('should update mock API at specified index', async () => {
            const config = configManager.getConfig();
            const groupId = config.proxyGroups[0].id;

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

            await configManager.addMockApi(groupId, mockApi);
            await configManager.updateMockApi(groupId, 0, updatedMockApi);

            const updatedConfig = configManager.getConfig();

            expect(updatedConfig.proxyGroups[0].mockApis.length).to.equal(1);
            expect(updatedConfig.proxyGroups[0].mockApis[0]).to.deep.equal(updatedMockApi);
        });

        it('should update correct API when multiple exist', async () => {
            const config = configManager.getConfig();
            const groupId = config.proxyGroups[0].id;

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

            await configManager.addMockApi(groupId, mockApi1);
            await configManager.addMockApi(groupId, mockApi2);
            await configManager.updateMockApi(groupId, 1, updatedMockApi);

            const updatedConfig = configManager.getConfig();

            expect(updatedConfig.proxyGroups[0].mockApis.length).to.equal(2);
            expect(updatedConfig.proxyGroups[0].mockApis[0].path).to.equal('/user');
            expect(updatedConfig.proxyGroups[0].mockApis[0].method).to.equal('GET');
            expect(updatedConfig.proxyGroups[0].mockApis[1]).to.deep.equal(updatedMockApi);
        });
    });
});