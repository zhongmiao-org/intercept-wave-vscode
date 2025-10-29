import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {MockConfig, ProxyGroup} from '../server';
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
            }
        } catch (error) {
            console.error('Error migrating config:', error);
        }
    }

    // Normalize v2 config: compact mockData JSON strings to minified form
    private normalizeV2Config(): void {
        const parseJsonSmart = (raw: string) => {
            const stripComments = (input: string) => {
                let out = '';
                let i = 0;
                let inSingle = false,
                    inDouble = false,
                    inTemplate = false,
                    inLineComment = false,
                    inBlockComment = false;
                while (i < input.length) {
                    const ch = input[i];
                    const next = input[i + 1];
                    if (inLineComment) {
                        if (ch === '\n') {
                            inLineComment = false;
                            out += ch;
                        }
                        i++;
                        continue;
                    }
                    if (inBlockComment) {
                        if (ch === '*' && next === '/') {
                            inBlockComment = false;
                            i += 2;
                            continue;
                        }
                        i++;
                        continue;
                    }
                    if (!inSingle && !inDouble && !inTemplate) {
                        if (ch === '/' && next === '/') {
                            inLineComment = true;
                            i += 2;
                            continue;
                        }
                        if (ch === '/' && next === '*') {
                            inBlockComment = true;
                            i += 2;
                            continue;
                        }
                    }
                    if (!inDouble && !inTemplate && ch === '\'' && input[i - 1] !== '\\') {
                        inSingle = !inSingle;
                        out += ch;
                        i++;
                        continue;
                    }
                    if (!inSingle && !inTemplate && ch === '"' && input[i - 1] !== '\\') {
                        inDouble = !inDouble;
                        out += ch;
                        i++;
                        continue;
                    }
                    if (!inSingle && !inDouble && ch === '`' && input[i - 1] !== '\\') {
                        inTemplate = !inTemplate;
                        out += ch;
                        i++;
                        continue;
                    }
                    out += ch;
                    i++;
                }
                return out;
            };

            const removeTrailingCommas = (input: string) => input.replace(/,\s*(?=[}\]])/g, '');
            const quoteUnquotedKeys = (input: string) =>
                input.replace(/([,{]\s*)([A-Za-z_$][\w$-]*)(\s*):/g, (m, p1, key, p3) => {
                    if (key.startsWith('"') || key.startsWith('\'')) return m;
                    return `${p1}"${key}"${p3}:`;
                });
            const convertSingleQuotedStrings = (input: string) =>
                input.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_m, inner) => {
                    let content = String(inner);
                    content = content.replace(/\\'/g, "'");
                    content = content.replace(/\\/g, '\\\\');
                    content = content.replace(/"/g, '\\"');
                    return `"${content}"`;
                });

            const text = (raw ?? '').trim();
            if (!text) throw new Error('Empty JSON');
            try {
                return JSON.parse(text);
            } catch {
                let s = stripComments(text);
                s = convertSingleQuotedStrings(s);
                s = quoteUnquotedKeys(s);
                s = removeTrailingCommas(s);
                return JSON.parse(s);
            }
        };
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
                            // try tolerant parsing
                            parsed = parseJsonSmart(raw);
                        }
                        const compact = JSON.stringify(parsed);
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
