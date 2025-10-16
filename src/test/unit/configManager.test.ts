import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from '../../configManager';

describe('ConfigManager', () => {
    let sandbox: sinon.SinonSandbox;
    let mockContext: vscode.ExtensionContext;
    let mockWorkspaceFolder: vscode.WorkspaceFolder;
    let configManager: ConfigManager;
    let tempDir: string;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // Create a temporary directory for testing
        tempDir = path.join(__dirname, '.test-config');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Mock workspace folder
        mockWorkspaceFolder = {
            uri: vscode.Uri.file(tempDir),
            name: 'test-workspace',
            index: 0
        };

        // Stub vscode.workspace.workspaceFolders
        sandbox.stub(vscode.workspace, 'workspaceFolders').value([mockWorkspaceFolder]);

        // Mock extension context
        mockContext = {
            subscriptions: [],
            workspaceState: {
                get: sandbox.stub() as any,
                update: sandbox.stub().resolves() as any,
                keys: sandbox.stub().returns([]) as any
            },
            globalState: {
                get: sandbox.stub() as any,
                update: sandbox.stub().resolves() as any,
                setKeysForSync: sandbox.stub() as any,
                keys: sandbox.stub().returns([]) as any
            },
            extensionPath: tempDir,
            storagePath: tempDir,
            globalStoragePath: tempDir,
            logPath: tempDir,
            extensionUri: vscode.Uri.file(tempDir),
            environmentVariableCollection: {} as any,
            extensionMode: vscode.ExtensionMode.Test,
            storageUri: vscode.Uri.file(tempDir),
            globalStorageUri: vscode.Uri.file(tempDir),
            logUri: vscode.Uri.file(tempDir),
            secrets: {} as any,
            extension: {} as any,
            asAbsolutePath: (relativePath: string) => path.join(tempDir, relativePath),
            languageModelAccessInformation: {} as any
        };

        configManager = new ConfigManager(mockContext);
    });

    afterEach(() => {
        sandbox.restore();

        // Clean up temporary directory
        const configDir = path.join(tempDir, '.intercept-wave');
        if (fs.existsSync(configDir)) {
            fs.rmSync(configDir, { recursive: true, force: true });
        }
    });

    describe('constructor', () => {
        it('should create config directory if not exists', () => {
            const configDir = path.join(tempDir, '.intercept-wave');
            expect(fs.existsSync(configDir)).to.be.true;
        });

        it('should initialize config file with default values', () => {
            const configPath = configManager.getConfigPath();
            expect(fs.existsSync(configPath)).to.be.true;

            const config = configManager.getConfig();
            expect(config).to.deep.include({
                port: 8888,
                interceptPrefix: '/api',
                baseUrl: 'http://localhost:8080',
                stripPrefix: true,
                globalCookie: ''
            });
            expect(config.mockApis).to.be.an('array').that.is.empty;
        });

        it('should throw error if no workspace folder found', () => {
            sandbox.restore();
            sandbox.stub(vscode.workspace, 'workspaceFolders').value(undefined);

            expect(() => new ConfigManager(mockContext)).to.throw('No workspace folder found');
        });
    });

    describe('getConfig', () => {
        it('should return default config if file does not exist', () => {
            // Delete the config file
            const configPath = configManager.getConfigPath();
            if (fs.existsSync(configPath)) {
                fs.unlinkSync(configPath);
            }

            const config = configManager.getConfig();
            expect(config.port).to.equal(8888);
            expect(config.interceptPrefix).to.equal('/api');
        });

        it('should merge saved config with default config', () => {
            const customConfig = {
                port: 9999,
                mockApis: []
            };

            fs.writeFileSync(
                configManager.getConfigPath(),
                JSON.stringify(customConfig, null, 2),
                'utf-8'
            );

            const config = configManager.getConfig();
            expect(config.port).to.equal(9999);
            expect(config.interceptPrefix).to.equal('/api'); // from default
        });

        it('should handle invalid JSON gracefully', () => {
            fs.writeFileSync(
                configManager.getConfigPath(),
                'invalid json',
                'utf-8'
            );

            const config = configManager.getConfig();
            expect(config.port).to.equal(8888); // returns default config
        });

        it('should ensure mockApis is an array', () => {
            const invalidConfig = {
                port: 8888,
                mockApis: null
            };

            fs.writeFileSync(
                configManager.getConfigPath(),
                JSON.stringify(invalidConfig, null, 2),
                'utf-8'
            );

            const config = configManager.getConfig();
            expect(config.mockApis).to.be.an('array');
        });
    });

    describe('saveConfig', () => {
        it('should save config to file', async () => {
            const newConfig = {
                port: 7777,
                interceptPrefix: '/v1',
                baseUrl: 'http://example.com',
                stripPrefix: false,
                globalCookie: 'session=test',
                mockApis: []
            };

            await configManager.saveConfig(newConfig);

            const savedContent = fs.readFileSync(
                configManager.getConfigPath(),
                'utf-8'
            );
            const savedConfig = JSON.parse(savedContent);

            expect(savedConfig).to.deep.equal(newConfig);
        });

        it('should format JSON with indentation', async () => {
            const newConfig = {
                port: 8888,
                interceptPrefix: '/api',
                baseUrl: 'http://localhost:8080',
                stripPrefix: true,
                globalCookie: '',
                mockApis: []
            };

            await configManager.saveConfig(newConfig);

            const savedContent = fs.readFileSync(
                configManager.getConfigPath(),
                'utf-8'
            );

            expect(savedContent).to.include('\n  "port"');
        });
    });

    describe('addMockApi', () => {
        it('should add a new mock API to config', async () => {
            const mockApi = {
                path: '/users',
                method: 'GET',
                enabled: true,
                mockData: '{"users": []}',
                statusCode: 200,
                delay: 0,
                useCookie: false
            };

            await configManager.addMockApi(mockApi);

            const config = configManager.getConfig();
            expect(config.mockApis).to.have.lengthOf(1);
            expect(config.mockApis[0]).to.deep.equal(mockApi);
        });

        it('should append to existing mock APIs', async () => {
            const mockApi1 = {
                path: '/users',
                method: 'GET',
                enabled: true,
                mockData: '{}',
                statusCode: 200,
                delay: 0,
                useCookie: false
            };

            const mockApi2 = {
                path: '/posts',
                method: 'GET',
                enabled: true,
                mockData: '{}',
                statusCode: 200,
                delay: 0,
                useCookie: false
            };

            await configManager.addMockApi(mockApi1);
            await configManager.addMockApi(mockApi2);

            const config = configManager.getConfig();
            expect(config.mockApis).to.have.lengthOf(2);
        });
    });

    describe('removeMockApi', () => {
        it('should remove mock API at specified index', async () => {
            const mockApi1 = {
                path: '/users',
                method: 'GET',
                enabled: true,
                mockData: '{}',
                statusCode: 200,
                delay: 0,
                useCookie: false
            };

            const mockApi2 = {
                path: '/posts',
                method: 'GET',
                enabled: true,
                mockData: '{}',
                statusCode: 200,
                delay: 0,
                useCookie: false
            };

            await configManager.addMockApi(mockApi1);
            await configManager.addMockApi(mockApi2);
            await configManager.removeMockApi(0);

            const config = configManager.getConfig();
            expect(config.mockApis).to.have.lengthOf(1);
            expect(config.mockApis[0].path).to.equal('/posts');
        });
    });

    describe('updateMockApi', () => {
        it('should update mock API at specified index', async () => {
            const mockApi = {
                path: '/users',
                method: 'GET',
                enabled: true,
                mockData: '{}',
                statusCode: 200,
                delay: 0,
                useCookie: false
            };

            await configManager.addMockApi(mockApi);

            const updatedMockApi = {
                ...mockApi,
                path: '/users/updated',
                statusCode: 201
            };

            await configManager.updateMockApi(0, updatedMockApi);

            const config = configManager.getConfig();
            expect(config.mockApis[0].path).to.equal('/users/updated');
            expect(config.mockApis[0].statusCode).to.equal(201);
        });
    });

    describe('getConfigPath', () => {
        it('should return correct config file path', () => {
            const configPath = configManager.getConfigPath();
            const expectedPath = path.join(tempDir, '.intercept-wave', 'config.json');
            expect(configPath).to.equal(expectedPath);
        });
    });
});