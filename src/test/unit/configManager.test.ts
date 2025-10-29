import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigManager } from '../../common';

function expectedVersion(): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return '2.0';
    const pkgPath = path.join(workspaceFolder.uri.fsPath, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const parts = (pkg.version as string).split('.');
    return `${parts[0]}.${parts[1]}`;
}

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
            asAbsolutePath: (relativePath: string) =>
                path.join(workspaceFolder.uri.fsPath, relativePath),
            storageUri: vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, 'storage')),
            globalStorageUri: vscode.Uri.file(
                path.join(workspaceFolder.uri.fsPath, 'globalStorage')
            ),
            logUri: vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, 'logs')),
            extensionMode: 3,
            storagePath: path.join(workspaceFolder.uri.fsPath, 'storage'),
            globalStoragePath: path.join(workspaceFolder.uri.fsPath, 'globalStorage'),
            logPath: path.join(workspaceFolder.uri.fsPath, 'logs'),
            secrets: {} as any,
            extension: {} as any,
            languageModelAccessInformation: {} as any,
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

        it('should migrate legacy config during construction when file exists', () => {
            // Remove any existing config and write a legacy config before creating manager
            if (fs.existsSync(configDir)) {
                fs.rmSync(configDir, { recursive: true, force: true });
            }
            fs.mkdirSync(configDir, { recursive: true });

            const legacyConfig = {
                port: 9000,
                interceptPrefix: '/legacy',
                // No version, no proxyGroups -> legacy
            } as any;
            fs.writeFileSync(configPath, JSON.stringify(legacyConfig, null, 2), 'utf-8');

            // Construct a new manager to trigger constructor migration path
            const cm = new ConfigManager(mockContext);

            // Read back file and verify migrated structure
            const content = fs.readFileSync(cm.getConfigPath(), 'utf-8');
            const migrated = JSON.parse(content);

            expect(migrated.version).to.equal(expectedVersion());
            expect(Array.isArray(migrated.proxyGroups)).to.be.true;
            expect(migrated.proxyGroups[0].port).to.equal(9000);
            expect(migrated.proxyGroups[0].interceptPrefix).to.equal('/legacy');
        });

        it('should compact mockData strings for v2.0 config on startup', () => {
            // Prepare a v2.0 config with pretty mockData
            if (fs.existsSync(configDir)) {
                fs.rmSync(configDir, { recursive: true, force: true });
            }
            fs.mkdirSync(configDir, { recursive: true });

            const prettyMock = JSON.stringify({ a: 1, b: [1, 2, 3] }, null, 2);
            const v2Config = {
                version: '2.0',
                proxyGroups: [
                    {
                        id: 'g1',
                        name: 'G1',
                        port: 12345,
                        interceptPrefix: '/api',
                        baseUrl: 'http://localhost:8080',
                        stripPrefix: true,
                        globalCookie: '',
                        enabled: true,
                        mockApis: [
                            {
                                path: '/x',
                                enabled: true,
                                mockData: prettyMock,
                                method: 'GET',
                                statusCode: 200,
                            },
                        ],
                    },
                ],
            } as any;
            fs.writeFileSync(configPath, JSON.stringify(v2Config, null, 2), 'utf-8');

            // Construct a new manager to trigger normalization
            const cm = new ConfigManager(mockContext);

            const saved = JSON.parse(fs.readFileSync(cm.getConfigPath(), 'utf-8'));
            const savedMock = saved.proxyGroups[0].mockApis[0].mockData as string;
            // Should be compact (no spaces/newlines except inside string literals)
            expect(savedMock).to.equal(JSON.stringify({ a: 1, b: [1, 2, 3] }));
        });

        it('should tolerant-parse JS/JSON5-like mockData and compact it', () => {
            // v2.0 config with non-strict JSON features in mockData
            if (fs.existsSync(configDir)) {
                fs.rmSync(configDir, { recursive: true, force: true });
            }
            fs.mkdirSync(configDir, { recursive: true });

            const tolerant = `// top comment\n{ a: 1, /* mid */ b: 'text', list: [1, 2,], }`;
            const v2Config = {
                version: '2.0',
                proxyGroups: [
                    {
                        id: 'g1',
                        name: 'G1',
                        port: 12346,
                        interceptPrefix: '/api',
                        baseUrl: 'http://localhost:8080',
                        stripPrefix: true,
                        globalCookie: '',
                        enabled: true,
                        mockApis: [
                            {
                                path: '/y',
                                enabled: true,
                                mockData: tolerant,
                                method: 'GET',
                                statusCode: 200,
                            },
                        ],
                    },
                ],
            } as any;
            fs.writeFileSync(configPath, JSON.stringify(v2Config, null, 2), 'utf-8');

            // Trigger normalization
            const cm = new ConfigManager(mockContext);

            const saved = JSON.parse(fs.readFileSync(cm.getConfigPath(), 'utf-8'));
            const savedMock = saved.proxyGroups[0].mockApis[0].mockData as string;
            expect(savedMock).to.equal(
                JSON.stringify({ a: 1, b: 'text', list: [1, 2] })
            );
        });

        it('should keep mockData unchanged if tolerant parse still fails', () => {
            // v2.0 config with irrecoverable JSON (double comma in array)
            if (fs.existsSync(configDir)) {
                fs.rmSync(configDir, { recursive: true, force: true });
            }
            fs.mkdirSync(configDir, { recursive: true });

            const bad = `{ a: 1, list: [1,,2] }`;
            const v2Config = {
                version: '2.0',
                proxyGroups: [
                    {
                        id: 'g1',
                        name: 'G1',
                        port: 12347,
                        interceptPrefix: '/api',
                        baseUrl: 'http://localhost:8080',
                        stripPrefix: true,
                        globalCookie: '',
                        enabled: true,
                        mockApis: [
                            {
                                path: '/z',
                                enabled: true,
                                mockData: bad,
                                method: 'GET',
                                statusCode: 200,
                            },
                        ],
                    },
                ],
            } as any;
            fs.writeFileSync(configPath, JSON.stringify(v2Config, null, 2), 'utf-8');

            // Trigger normalization
            const cm = new ConfigManager(mockContext);

            const savedRaw = fs.readFileSync(cm.getConfigPath(), 'utf-8');
            const saved = JSON.parse(savedRaw);
            const savedMock = saved.proxyGroups[0].mockApis[0].mockData as string;
            // Should remain unchanged
            expect(savedMock).to.equal(bad);
        });

        it('should not normalize when version is not 2.0', () => {
            // Prepare a non-2.0 config with tolerant content
            if (fs.existsSync(configDir)) {
                fs.rmSync(configDir, { recursive: true, force: true });
            }
            fs.mkdirSync(configDir, { recursive: true });

            const tolerant = `{ a: 1, list: [1, 2,], note: 'x' }`;
            const cfg = {
                version: '2.1',
                proxyGroups: [
                    {
                        id: 'g1',
                        name: 'G1',
                        port: 12348,
                        interceptPrefix: '/api',
                        baseUrl: 'http://localhost:8080',
                        stripPrefix: true,
                        globalCookie: '',
                        enabled: true,
                        mockApis: [
                            {
                                path: '/y',
                                enabled: true,
                                mockData: tolerant,
                                method: 'GET',
                                statusCode: 200,
                            },
                        ],
                    },
                ],
            } as any;
            fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8');

            const cm = new ConfigManager(mockContext);
            const saved = JSON.parse(fs.readFileSync(cm.getConfigPath(), 'utf-8'));
            // mockData should remain unnormalized because version !== 2.0 at constructor time
            expect(saved.proxyGroups[0].mockApis[0].mockData).to.equal(tolerant);
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

            expect(config.version).to.equal(expectedVersion());
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
                interceptPrefix: '/custom',
            };

            fs.writeFileSync(configPath, JSON.stringify(partialConfig, null, 2), 'utf-8');

            const config = configManager.getConfig();

            // Should migrate to v2.0 format
            expect(config.version).to.equal(expectedVersion());
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
                mockApis: null as any,
            };

            fs.writeFileSync(configPath, JSON.stringify(invalidConfig, null, 2), 'utf-8');

            const config = configManager.getConfig();

            // Should migrate and fix invalid mockApis
            expect(config.version).to.equal(expectedVersion());
            expect(Array.isArray(config.proxyGroups)).to.be.true;
            expect(Array.isArray(config.proxyGroups[0].mockApis)).to.be.true;
            expect(config.proxyGroups[0].mockApis.length).to.equal(0);
        });

        it('should return default config if config file has invalid JSON', () => {
            fs.writeFileSync(configPath, 'invalid json', 'utf-8');

            const config = configManager.getConfig();

            expect(config.version).to.equal(expectedVersion());
            expect(Array.isArray(config.proxyGroups)).to.be.true;
            expect(config.proxyGroups[0].port).to.equal(8888);
            expect(config.proxyGroups[0].interceptPrefix).to.equal('/api');
        });

        it('should return default config if config file does not exist', () => {
            if (fs.existsSync(configPath)) {
                fs.unlinkSync(configPath);
            }

            const config = configManager.getConfig();

            expect(config.version).to.equal(expectedVersion());
            expect(Array.isArray(config.proxyGroups)).to.be.true;
            expect(config.proxyGroups[0].port).to.equal(8888);
            expect(Array.isArray(config.proxyGroups[0].mockApis)).to.be.true;
        });

        it('should update version on load when mismatched', () => {
            // Write a v1.x config in new format
            const mismatched = {
                version: '1.9',
                proxyGroups: [
                    {
                        id: 'g1',
                        name: 'G1',
                        port: 9999,
                        interceptPrefix: '/api',
                        baseUrl: 'http://localhost:8080',
                        stripPrefix: true,
                        globalCookie: '',
                        enabled: true,
                        mockApis: [],
                    },
                ],
            };
            fs.writeFileSync(configPath, JSON.stringify(mismatched, null, 2), 'utf-8');

            const cfg = configManager.getConfig();
            expect(cfg.version).to.equal(expectedVersion());

            const saved = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            expect(saved.version).to.equal(expectedVersion());
        });
    });

    describe('saveConfig', () => {
        it('should save config to file', async () => {
            const testConfig = {
                version: expectedVersion(),
                proxyGroups: [
                    {
                        id: 'test-id',
                        name: 'Test Group',
                        port: 7777,
                        interceptPrefix: '/test',
                        baseUrl: 'http://test.com',
                        stripPrefix: false,
                        globalCookie: 'test-cookie',
                        enabled: true,
                        mockApis: [],
                    },
                ],
            };

            await configManager.saveConfig(testConfig);

            const content = fs.readFileSync(configPath, 'utf-8');
            const savedConfig = JSON.parse(content);

            expect(savedConfig).to.deep.equal(testConfig);
        });

        it('should format JSON with proper indentation', async () => {
            const testConfig = {
                version: expectedVersion(),
                proxyGroups: [
                    {
                        id: 'test-id',
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
            };

            await configManager.saveConfig(testConfig);

            const content = fs.readFileSync(configPath, 'utf-8');

            // Should have indentation (not minified)
            expect(content).to.include('\n');
            expect(content).to.include('  ');
        });

        it('should overwrite version when saving with mismatched version', async () => {
            const testConfig = {
                version: '0.0',
                proxyGroups: [
                    {
                        id: 'test-id',
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
            } as any;

            await configManager.saveConfig(testConfig);
            const content = fs.readFileSync(configPath, 'utf-8');
            const saved = JSON.parse(content);
            expect(saved.version).to.equal(expectedVersion());
        });
    });

    describe('proxy group ops', () => {
        it('add/remove/update/toggle proxy group', async () => {
            // Start from default
            let cfg = configManager.getConfig();
            const groupToAdd = {
                id: 'g-new',
                name: 'New',
                port: 7777,
                interceptPrefix: '/api',
                baseUrl: 'http://localhost:3000',
                stripPrefix: false,
                globalCookie: '',
                enabled: true,
                mockApis: [],
            };
            await configManager.addProxyGroup(groupToAdd as any);
            cfg = configManager.getConfig();
            expect(cfg.proxyGroups.some(g => g.id === 'g-new')).to.be.true;

            await configManager.updateProxyGroup('g-new', { name: 'UpdatedName' });
            cfg = configManager.getConfig();
            expect(cfg.proxyGroups.find(g => g.id === 'g-new')!.name).to.equal('UpdatedName');

            await configManager.toggleProxyGroupEnabled('g-new');
            cfg = configManager.getConfig();
            expect(cfg.proxyGroups.find(g => g.id === 'g-new')!.enabled).to.be.false;

            await configManager.removeProxyGroup('g-new');
            cfg = configManager.getConfig();
            expect(cfg.proxyGroups.some(g => g.id === 'g-new')).to.be.false;
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
                delay: 0,
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
                delay: 0,
            };

            const mockApi2 = {
                path: '/posts',
                method: 'GET',
                enabled: true,
                mockData: '[]',
                statusCode: 200,
                delay: 0,
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
                delay: 0,
            };

            const mockApi2 = {
                path: '/posts',
                method: 'GET',
                enabled: true,
                mockData: '[]',
                statusCode: 200,
                delay: 0,
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
                delay: 0,
            };

            const updatedMockApi = {
                path: '/user',
                method: 'POST',
                enabled: false,
                mockData: '{"updated": true}',
                statusCode: 201,
                delay: 100,
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
                delay: 0,
            };

            const mockApi2 = {
                path: '/posts',
                method: 'GET',
                enabled: true,
                mockData: '[]',
                statusCode: 200,
                delay: 0,
            };

            const updatedMockApi = {
                path: '/posts',
                method: 'POST',
                enabled: false,
                mockData: '[{"id": 1}]',
                statusCode: 201,
                delay: 50,
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
