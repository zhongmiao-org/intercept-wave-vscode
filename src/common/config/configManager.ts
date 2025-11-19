import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {MockConfig, ProxyGroup} from '../interfaces';
import { parseJsonTolerant, stringifyCompact } from '../utils';
import * as pkg from '../../../package.json';
import {v4 as uuidv4} from 'uuid';

export class ConfigManager {
    private readonly configPath: string;

    constructor(private readonly _: vscode.ExtensionContext) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder found');
        }

        const configDir = path.join(workspaceFolder.uri.fsPath, '.intercept-wave');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        this.configPath = path.join(configDir, 'config.json');

        // Initialize config if not exists
        if (!fs.existsSync(this.configPath)) {
            void this.saveConfig(this.getDefaultConfig());
        } else {
            // Migrate old config to new format if needed
            this.migrateConfig();
        }

        // Ensure v2 config compatibility and normalization (e.g., compact mockData)
        this.normalizeV2Config();
    }

    private getTargetVersion(): string {
        try {
            const full = (pkg as any).version as string;
            const parts = full.split('.');
            if (parts.length >= 2) {
                return `${parts[0]}.${parts[1]}`;
            }
        } catch (_) {
            // ignore
        }
        // fallback
        return '2.0';
    }

    getConfigPath(): string {
        return this.configPath;
    }

    getConfig(): MockConfig {
        try {
            if (fs.existsSync(this.configPath)) {
                const content = fs.readFileSync(this.configPath, 'utf-8');
                const config = JSON.parse(content);

                // Ensure new structure
                if (!config.version || !config.proxyGroups) {
                    return this.migrateFromLegacy(config);
                }

                // Update version to current major.minor when loading
                const targetVersion = this.getTargetVersion();
                if (config.version !== targetVersion) {
                    config.version = targetVersion;
                    void this.saveConfig(config);
                }

                return config;
            }
        } catch (error) {
            console.error('Error loading config:', error);
        }

        return this.getDefaultConfig();
    }

    async saveConfig(config: MockConfig): Promise<void> {
        try {
            // Ensure version is updated on any save/format
            config.version = this.getTargetVersion();

            const content = JSON.stringify(config, null, 4);
            fs.writeFileSync(this.configPath, content, 'utf-8');
            console.log('Configuration saved successfully');
        } catch (error) {
            console.error('Error saving config:', error);
            throw error;
        }
    }

    private migrateConfig(): void {
        try {
            const content = fs.readFileSync(this.configPath, 'utf-8');
            const config = JSON.parse(content);

            // Check if migration is needed
            if (!config.version || !config.proxyGroups) {
                const migratedConfig = this.migrateFromLegacy(config);
                void this.saveConfig(migratedConfig);
                console.log('Configuration migrated to v2.0 successfully');
                return;
            }

            // Normalize missing WS-related fields for existing configs to match v3 shared schema
            if (Array.isArray(config.proxyGroups)) {
                let changed = false;
                for (const group of config.proxyGroups as ProxyGroup[]) {
                    if (!group.protocol) {
                        group.protocol = 'HTTP';
                        changed = true;
                    }
                    if (group.wsBaseUrl === undefined) {
                        group.wsBaseUrl = null;
                        changed = true;
                    }
                    if (group.wsInterceptPrefix === undefined) {
                        group.wsInterceptPrefix = null;
                        changed = true;
                    }
                    if (group.wsManualPush === undefined) {
                        group.wsManualPush = true;
                        changed = true;
                    }
                    if (!group.wsPushRules) {
                        group.wsPushRules = [];
                        changed = true;
                    }
                    if (group.wssEnabled === undefined) {
                        group.wssEnabled = false;
                        changed = true;
                    }
                    if (group.wssKeystorePath === undefined) {
                        group.wssKeystorePath = null;
                        changed = true;
                    }
                    if (group.wssKeystorePassword === undefined) {
                        group.wssKeystorePassword = null;
                        changed = true;
                    }
                }
                if (changed) {
                    // 不能调用 saveConfig，否则会提前把 version 改成当前版本，
                    // 导致 normalizeV2Config 判定 version !== '2.0' 而提前返回，从而破坏现有测试。
                    const contentToWrite = JSON.stringify(config, null, 4);
                    fs.writeFileSync(this.configPath, contentToWrite, 'utf-8');
                    console.log('Configuration normalized with WS defaults');
                }
            }
        } catch (error) {
            console.error('Error migrating config:', error);
        }
    }

    // Normalize v2 config: compact mockData JSON strings to minified form
    private normalizeV2Config(): void {
        try {
            if (!fs.existsSync(this.configPath)) return;
            const content = fs.readFileSync(this.configPath, 'utf-8');
            const config = JSON.parse(content);

            if (!config || config.version !== '2.0' || !Array.isArray(config.proxyGroups)) {
                return;
            }

            let changed = false;
            for (const group of config.proxyGroups) {
                if (!group || !Array.isArray(group.mockApis)) continue;
                for (const api of group.mockApis) {
                    if (!api || typeof api.mockData !== 'string') continue;
                    const raw = api.mockData;
                    try {
                        let parsed: any;
                        try {
                            parsed = JSON.parse(raw);
                        } catch {
                            // try tolerant parsing via shared utils
                            parsed = parseJsonTolerant(raw);
                        }
                        const compact = stringifyCompact(parsed);
                        if (raw !== compact) {
                            api.mockData = compact;
                            changed = true;
                        }
                    } catch (e) {
                        // Keep original when not valid JSON; user can fix via UI
                    }
                }
            }

            if (changed) {
                // Use existing save to write pretty file with compacted mockData strings
                void this.saveConfig(config);
            }
        } catch (error) {
            console.error('Error normalizing v2 config:', error);
        }
    }

    private migrateFromLegacy(oldConfig: any): MockConfig {
        // Migrate from old format to new format
        const defaultGroup: ProxyGroup = {
            id: uuidv4(),
            name: '默认配置',
            port: oldConfig.port || 8888,
            interceptPrefix: oldConfig.interceptPrefix || '/api',
            baseUrl: oldConfig.baseUrl || 'http://localhost:8080',
            stripPrefix: oldConfig.stripPrefix !== undefined ? oldConfig.stripPrefix : true,
            globalCookie: oldConfig.globalCookie || '',
            enabled: true,
            mockApis: Array.isArray(oldConfig.mockApis) ? oldConfig.mockApis : [],
            protocol: 'HTTP',
            wsBaseUrl: null,
            wsInterceptPrefix: null,
            wsManualPush: true,
            wsPushRules: [],
            wssEnabled: false,
            wssKeystorePath: null,
            wssKeystorePassword: null,
        };

        return {
            version: this.getTargetVersion(),
            proxyGroups: [defaultGroup],
        };
    }

    private getDefaultConfig(): MockConfig {
        const defaultGroup: ProxyGroup = {
            id: uuidv4(),
            name: '默认配置',
            port: 8888,
            interceptPrefix: '/api',
            baseUrl: 'http://localhost:8080',
            stripPrefix: true,
            globalCookie: '',
            enabled: true,
            mockApis: [],
            protocol: 'HTTP',
            wsBaseUrl: null,
            wsInterceptPrefix: null,
            wsManualPush: true,
            wsPushRules: [],
            wssEnabled: false,
            wssKeystorePath: null,
            wssKeystorePassword: null,
        };

        return {
            version: this.getTargetVersion(),
            proxyGroups: [defaultGroup],
        };
    }

    // Proxy Group Management
    async addProxyGroup(group: ProxyGroup): Promise<void> {
        const config = this.getConfig();
        config.proxyGroups.push(group);
        await this.saveConfig(config);
    }

    async removeProxyGroup(groupId: string): Promise<void> {
        const config = this.getConfig();
        config.proxyGroups = config.proxyGroups.filter(g => g.id !== groupId);
        await this.saveConfig(config);
    }

    async updateProxyGroup(groupId: string, updatedGroup: Partial<ProxyGroup>): Promise<void> {
        const config = this.getConfig();
        const index = config.proxyGroups.findIndex(g => g.id === groupId);
        if (index !== -1) {
            config.proxyGroups[index] = { ...config.proxyGroups[index], ...updatedGroup };
            await this.saveConfig(config);
        }
    }

    async toggleProxyGroupEnabled(groupId: string): Promise<void> {
        const config = this.getConfig();
        const group = config.proxyGroups.find(g => g.id === groupId);
        if (group) {
            group.enabled = !group.enabled;
            await this.saveConfig(config);
        }
    }

    // Mock API Management (for a specific group)
    async addMockApi(groupId: string, mockApi: any): Promise<void> {
        const config = this.getConfig();
        const group = config.proxyGroups.find(g => g.id === groupId);
        if (group) {
            group.mockApis.push(mockApi);
            await this.saveConfig(config);
        }
    }

    async removeMockApi(groupId: string, index: number): Promise<void> {
        const config = this.getConfig();
        const group = config.proxyGroups.find(g => g.id === groupId);
        if (group) {
            group.mockApis.splice(index, 1);
            await this.saveConfig(config);
        }
    }

    async updateMockApi(groupId: string, index: number, mockApi: any): Promise<void> {
        const config = this.getConfig();
        const group = config.proxyGroups.find(g => g.id === groupId);
        if (group) {
            group.mockApis[index] = mockApi;
            await this.saveConfig(config);
        }
    }
}
