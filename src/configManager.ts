import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { MockConfig, ProxyGroup } from './mockServer';
import { v4 as uuidv4 } from 'uuid';

export class ConfigManager {
    private configPath: string;

    constructor(private _: vscode.ExtensionContext) {
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
            this.saveConfig(this.getDefaultConfig());
        } else {
            // Migrate old config to new format if needed
            this.migrateConfig();
        }
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

                return config;
            }
        } catch (error) {
            console.error('Error loading config:', error);
        }

        return this.getDefaultConfig();
    }

    async saveConfig(config: MockConfig): Promise<void> {
        try {
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
                this.saveConfig(migratedConfig);
                console.log('Configuration migrated to v2.0 successfully');
            }
        } catch (error) {
            console.error('Error migrating config:', error);
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
            mockApis: Array.isArray(oldConfig.mockApis) ? oldConfig.mockApis : []
        };

        return {
            version: '2.0',
            proxyGroups: [defaultGroup]
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
            mockApis: []
        };

        return {
            version: '2.0',
            proxyGroups: [defaultGroup]
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