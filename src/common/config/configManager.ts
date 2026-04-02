import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { HttpRoute, MockApiConfig, MockConfig, ProxyGroup } from '../interfaces';
import { parseJsonTolerant, stringifyCompact } from '../utils';
import { v4 as uuidv4 } from 'uuid';
import * as pkg from '../../../package.json';

interface LegacyRootConfig {
    port?: number;
    interceptPrefix?: string;
    baseUrl?: string;
    stripPrefix?: boolean;
    globalCookie?: string;
    mockApis?: MockApiConfig[];
}

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

        if (!fs.existsSync(this.configPath)) {
            void this.saveConfig(this.getDefaultConfig());
        } else {
            this.normalizeV2Config();
            this.migrateConfig();
        }
    }

    getConfigPath(): string {
        return this.configPath;
    }

    private getTargetVersion(): string {
        try {
            const full = (pkg as any).version as string;
            const parts = full.split('.');
            if (parts.length >= 2) {
                return `${parts[0]}.${parts[1]}`;
            }
        } catch {
            // ignore
        }
        return '2.0';
    }

    getConfig(): MockConfig {
        try {
            if (!fs.existsSync(this.configPath)) {
                return this.getDefaultConfig();
            }

            const content = fs.readFileSync(this.configPath, 'utf-8');
            const parsed = JSON.parse(content);
            const normalized = this.normalizeLoadedConfig(parsed);

            if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
                void this.saveConfig(normalized);
            }

            return normalized;
        } catch (error) {
            console.error('Error loading config:', error);
            return this.getDefaultConfig();
        }
    }

    async saveConfig(config: MockConfig): Promise<void> {
        try {
            const normalized = {
                version: this.getTargetVersion(),
                proxyGroups: Array.isArray(config.proxyGroups)
                    ? config.proxyGroups.filter(Boolean).map(group => this.normalizeProxyGroup(group))
                    : [this.getDefaultGroup()],
            };
            const content = JSON.stringify(normalized, null, 4);
            fs.writeFileSync(this.configPath, content, 'utf-8');
            console.log('Configuration saved successfully');
        } catch (error) {
            console.error('Error saving config:', error);
            throw error;
        }
    }

    private migrateConfig(): void {
        try {
            const current = this.getConfig();
            const content = fs.readFileSync(this.configPath, 'utf-8');
            const parsed = JSON.parse(content);

            if (JSON.stringify(parsed) !== JSON.stringify(current)) {
                fs.writeFileSync(this.configPath, JSON.stringify(current, null, 4), 'utf-8');
            }
        } catch (error) {
            console.error('Error migrating config:', error);
        }
    }

    private normalizeLoadedConfig(raw: any): MockConfig {
        if (!raw || typeof raw !== 'object') {
            return this.getDefaultConfig();
        }

        const migrated = this.migrateToLatest(raw);
        return {
            version: this.getTargetVersion(),
            proxyGroups: Array.isArray(migrated.proxyGroups)
                ? migrated.proxyGroups
                    .filter(Boolean)
                    .map(group => this.normalizeProxyGroup(group))
                : [this.getDefaultGroup()],
        };
    }

    private migrateToLatest(raw: any): MockConfig {
        if (!raw.version || !Array.isArray(raw.proxyGroups)) {
            return this.migrateFromLegacy(raw);
        }

        const version = String(raw.version);
        if (version === this.getTargetVersion()) {
            return raw as MockConfig;
        }

        let current = raw;
        while (current.version !== this.getTargetVersion()) {
            switch (current.version) {
                case '2.0':
                    current = { ...current, version: '3.0' };
                    break;
                case '3.0':
                case '3.1':
                    current = this.migrateV3ToV4(current);
                    break;
                default:
                    current = { ...current, version: this.getTargetVersion() };
                    break;
            }
        }

        return current as MockConfig;
    }

    private migrateV3ToV4(config: any): MockConfig {
        const proxyGroups = Array.isArray(config.proxyGroups) ? config.proxyGroups : [];
        return {
            ...config,
            version: this.getTargetVersion(),
            proxyGroups: proxyGroups.map((group: any) => {
                const routes = Array.isArray(group.routes) && group.routes.length > 0
                    ? group.routes
                    : [this.createDefaultHttpRoute(group)];
                return {
                    ...group,
                    routes,
                };
            }),
        };
    }

    private migrateFromLegacy(oldConfig: LegacyRootConfig): MockConfig {
        return {
            version: this.getTargetVersion(),
            proxyGroups: [
                {
                    ...this.getDefaultGroup(),
                    port: oldConfig.port || 8888,
                    stripPrefix: oldConfig.stripPrefix !== undefined ? oldConfig.stripPrefix : true,
                    globalCookie: oldConfig.globalCookie || '',
                    routes: [this.createDefaultHttpRoute(oldConfig)],
                    interceptPrefix: oldConfig.interceptPrefix || '/api',
                    baseUrl: oldConfig.baseUrl || 'http://localhost:8080',
                    mockApis: Array.isArray(oldConfig.mockApis) ? oldConfig.mockApis : [],
                },
            ],
        };
    }

    private normalizeProxyGroup(group: Partial<ProxyGroup> | null | undefined): ProxyGroup {
        const normalizedRoutes = this.normalizeRoutes(group);
        const primaryRoute = normalizedRoutes[0] || this.createDefaultHttpRoute(group);
        const primaryMockApis = primaryRoute.mockApis;
        return {
            id: group?.id || uuidv4(),
            name: group?.name || '默认配置',
            protocol: group?.protocol || 'HTTP',
            port: group?.port || 8888,
            routes: normalizedRoutes,
            stripPrefix: group?.stripPrefix !== undefined ? group.stripPrefix : true,
            globalCookie: group?.globalCookie || '',
            enabled: group?.enabled !== undefined ? group.enabled : true,
            interceptPrefix: group?.interceptPrefix || primaryRoute.pathPrefix || '/api',
            baseUrl: group?.baseUrl || primaryRoute.targetBaseUrl || 'http://localhost:8080',
            mockApis: Array.isArray(group?.mockApis) && group.mockApis.length > 0 ? this.normalizeMockApis(group.mockApis) : primaryMockApis,
            wsBaseUrl: group?.wsBaseUrl ?? null,
            wsInterceptPrefix: group?.wsInterceptPrefix ?? null,
            wsManualPush: group?.wsManualPush !== undefined ? group.wsManualPush : true,
            wsPushRules: Array.isArray(group?.wsPushRules) ? group.wsPushRules : [],
            wssEnabled: group?.wssEnabled !== undefined ? group.wssEnabled : false,
            wssKeystorePath: group?.wssKeystorePath ?? null,
            wssKeystorePassword: group?.wssKeystorePassword ?? null,
        };
    }

    private normalizeRoutes(group: Partial<ProxyGroup> | null | undefined): HttpRoute[] {
        const protocol = group?.protocol || 'HTTP';
        if (protocol === 'WS') {
            return Array.isArray(group?.routes)
                ? group!.routes.filter(Boolean).map(route => this.normalizeRoute(route))
                : [];
        }

        const sourceRoutes = Array.isArray(group?.routes) && group.routes.length > 0
            ? group.routes
            : [this.createDefaultHttpRoute(group)];
        return sourceRoutes.filter(Boolean).map(route => this.normalizeRoute(route));
    }

    private normalizeRoute(route: Partial<HttpRoute> | null | undefined): HttpRoute {
        return {
            id: route?.id || uuidv4(),
            name: route?.name || 'API',
            pathPrefix: route?.pathPrefix || '/api',
            targetBaseUrl: route?.targetBaseUrl || 'http://localhost:8080',
            stripPrefix: route?.stripPrefix !== undefined ? route.stripPrefix : true,
            enableMock: route?.enableMock !== undefined ? route.enableMock : true,
            mockApis: this.normalizeMockApis(route?.mockApis),
        };
    }

    private normalizeMockApis(mockApis: any): MockApiConfig[] {
        if (!Array.isArray(mockApis)) {
            return [];
        }

        return mockApis
            .filter(Boolean)
            .map(api => {
                const normalized = { ...api } as MockApiConfig;
                normalized.mockData = normalized.mockData || '{}';
                normalized.path = normalized.path || '/';
                normalized.method = normalized.method || 'ALL';
                normalized.statusCode = normalized.statusCode || 200;
                if (normalized.delay === undefined) {
                    normalized.delay = 0;
                }
                return normalized;
            });
    }

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
                            parsed = parseJsonTolerant(raw);
                        }
                        const compact = stringifyCompact(parsed);
                        if (raw !== compact) {
                            api.mockData = compact;
                            changed = true;
                        }
                    } catch {
                        // ignore invalid JSON
                    }
                }
            }
            if (changed) {
                fs.writeFileSync(this.configPath, JSON.stringify(config, null, 4), 'utf-8');
            }
        } catch (error) {
            console.error('Error normalizing v2 config:', error);
        }
    }

    private createDefaultHttpRoute(source?: Partial<ProxyGroup> | LegacyRootConfig | null): HttpRoute {
        return {
            id: uuidv4(),
            name: 'API',
            pathPrefix: source?.interceptPrefix || '/api',
            targetBaseUrl: source?.baseUrl || 'http://localhost:8080',
            stripPrefix: source?.stripPrefix !== undefined ? source.stripPrefix : true,
            enableMock: true,
            mockApis: this.normalizeMockApis(source?.mockApis),
        };
    }

    private getDefaultGroup(): ProxyGroup {
        return {
            id: uuidv4(),
            name: '默认配置',
            protocol: 'HTTP',
            port: 8888,
            routes: [this.createDefaultHttpRoute()],
            stripPrefix: true,
            globalCookie: '',
            enabled: true,
            interceptPrefix: '/api',
            baseUrl: 'http://localhost:8080',
            mockApis: [],
            wsBaseUrl: null,
            wsInterceptPrefix: null,
            wsManualPush: true,
            wsPushRules: [],
            wssEnabled: false,
            wssKeystorePath: null,
            wssKeystorePassword: null,
        };
    }

    private getDefaultConfig(): MockConfig {
        return {
            version: this.getTargetVersion(),
            proxyGroups: [this.getDefaultGroup()],
        };
    }

    async addProxyGroup(group: ProxyGroup): Promise<void> {
        const config = this.getConfig();
        config.proxyGroups.push(this.normalizeProxyGroup(group));
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
            config.proxyGroups[index] = this.normalizeProxyGroup({
                ...config.proxyGroups[index],
                ...updatedGroup,
                routes: updatedGroup.routes ?? config.proxyGroups[index].routes,
            });
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

    async addRoute(groupId: string, route: HttpRoute): Promise<void> {
        const config = this.getConfig();
        const group = config.proxyGroups.find(g => g.id === groupId);
        if (group) {
            group.routes = [...(group.routes || []), this.normalizeRoute(route)];
            await this.saveConfig(config);
        }
    }

    async updateRoute(groupId: string, routeId: string, route: Partial<HttpRoute>): Promise<void> {
        const config = this.getConfig();
        const group = config.proxyGroups.find(g => g.id === groupId);
        const routes = group?.routes || [];
        const index = routes.findIndex(r => r.id === routeId);
        if (group && index !== -1) {
            routes[index] = this.normalizeRoute({
                ...routes[index],
                ...route,
                mockApis: route.mockApis ?? routes[index].mockApis,
            });
            group.routes = routes;
            await this.saveConfig(config);
        }
    }

    async removeRoute(groupId: string, routeId: string): Promise<void> {
        const config = this.getConfig();
        const group = config.proxyGroups.find(g => g.id === groupId);
        if (group) {
            group.routes = (group.routes || []).filter(route => route.id !== routeId);
            await this.saveConfig(config);
        }
    }

    async addMockApi(groupId: string, routeIdOrMockApi: string | MockApiConfig, maybeMockApi?: MockApiConfig): Promise<void> {
        const config = this.getConfig();
        const routeId = typeof routeIdOrMockApi === 'string' ? routeIdOrMockApi : undefined;
        const mockApi = (typeof routeIdOrMockApi === 'string' ? maybeMockApi : routeIdOrMockApi) as MockApiConfig;
        const route = this.findRoute(config, groupId, routeId);
        if (route) {
            route.mockApis.push(this.normalizeMockApis([mockApi])[0]);
            const group = config.proxyGroups.find(g => g.id === groupId);
            if (group) group.mockApis = [...route.mockApis];
            await this.saveConfig(config);
        }
    }

    async removeMockApi(groupId: string, routeIdOrIndex: string | number, maybeIndex?: number): Promise<void> {
        const config = this.getConfig();
        const routeId = typeof routeIdOrIndex === 'string' ? routeIdOrIndex : undefined;
        const index = (typeof routeIdOrIndex === 'string' ? maybeIndex : routeIdOrIndex) as number;
        const route = this.findRoute(config, groupId, routeId);
        if (route) {
            route.mockApis.splice(index, 1);
            const group = config.proxyGroups.find(g => g.id === groupId);
            if (group) group.mockApis = [...route.mockApis];
            await this.saveConfig(config);
        }
    }

    async updateMockApi(groupId: string, routeIdOrIndex: string | number, indexOrMockApi: number | MockApiConfig, maybeMockApi?: MockApiConfig): Promise<void> {
        const config = this.getConfig();
        const routeId = typeof routeIdOrIndex === 'string' ? routeIdOrIndex : undefined;
        const index = (typeof routeIdOrIndex === 'string' ? indexOrMockApi : routeIdOrIndex) as number;
        const mockApi = (typeof routeIdOrIndex === 'string' ? maybeMockApi : indexOrMockApi) as MockApiConfig;
        const route = this.findRoute(config, groupId, routeId);
        if (route) {
            route.mockApis[index] = this.normalizeMockApis([mockApi])[0];
            const group = config.proxyGroups.find(g => g.id === groupId);
            if (group) group.mockApis = [...route.mockApis];
            await this.saveConfig(config);
        }
    }

    private findRoute(config: MockConfig, groupId: string, routeId?: string): HttpRoute | undefined {
        const routes = config.proxyGroups.find(g => g.id === groupId)?.routes || [];
        if (!routeId) {
            return routes[0];
        }
        return routes.find(route => route.id === routeId) || routes[0];
    }
}
