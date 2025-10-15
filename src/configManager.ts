import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { MockConfig } from './mockServer';

export class ConfigManager {
    private configPath: string;

    constructor(private context: vscode.ExtensionContext) {
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

                // Auto-complete missing fields
                const defaultConfig = this.getDefaultConfig();
                const mergedConfig = { ...defaultConfig, ...config };

                // Ensure mockApis exists
                if (!Array.isArray(mergedConfig.mockApis)) {
                    mergedConfig.mockApis = [];
                }

                return mergedConfig;
            }
        } catch (error) {
            console.error('Error loading config:', error);
        }

        return this.getDefaultConfig();
    }

    async saveConfig(config: MockConfig): Promise<void> {
        try {
            const content = JSON.stringify(config, null, 2);
            fs.writeFileSync(this.configPath, content, 'utf-8');
            console.log('Configuration saved successfully');
        } catch (error) {
            console.error('Error saving config:', error);
            throw error;
        }
    }

    private getDefaultConfig(): MockConfig {
        return {
            port: 8888,
            interceptPrefix: '/api',
            baseUrl: 'http://localhost:8080',
            stripPrefix: true,
            globalCookie: '',
            mockApis: []
        };
    }

    async addMockApi(mockApi: any): Promise<void> {
        const config = this.getConfig();
        config.mockApis.push(mockApi);
        await this.saveConfig(config);
    }

    async removeMockApi(index: number): Promise<void> {
        const config = this.getConfig();
        config.mockApis.splice(index, 1);
        await this.saveConfig(config);
    }

    async updateMockApi(index: number, mockApi: any): Promise<void> {
        const config = this.getConfig();
        config.mockApis[index] = mockApi;
        await this.saveConfig(config);
    }
}