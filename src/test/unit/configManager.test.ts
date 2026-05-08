import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigManager } from '../../common';

describe('ConfigManager 4.0', () => {
    let configManager: ConfigManager;
    let configDir: string;
    let configPath: string;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder found in test');
        }

        configDir = path.join(workspaceFolder.uri.fsPath, '.intercept-wave');
        configPath = path.join(configDir, 'config.json');

        if (fs.existsSync(configDir)) {
            fs.rmSync(configDir, { recursive: true, force: true });
        }

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
            languageModelAccessInformation: {} as any,
        };
    });

    afterEach(() => {
        if (fs.existsSync(configDir)) {
            fs.rmSync(configDir, { recursive: true, force: true });
        }
    });

    function createManager() {
        configManager = new ConfigManager(mockContext);
        return configManager;
    }

    it('creates a default 4.0 config with one default route', () => {
        const cm = createManager();
        const cfg = cm.getConfig();

        expect(cfg.version).to.equal('4.0');
        expect(cfg.proxyGroups).to.have.length(1);
        expect(cfg.proxyGroups[0].routes).to.have.length(1);
        expect(cfg.proxyGroups[0].routes?.[0]).to.include({
            name: 'API',
            pathPrefix: '/api',
            targetType: 'PROXY',
            targetBaseUrl: 'http://localhost:8080',
            staticRoot: '',
            stripPrefix: true,
            rewriteTargetPath: '',
            spaFallbackPath: '',
            spaFallback: false,
            enableMock: true,
        });
    });

    it('migrates legacy flat config into 4.0 routes', () => {
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify({
            port: 9000,
            interceptPrefix: '/legacy',
            baseUrl: 'http://localhost:18080',
            stripPrefix: false,
            globalCookie: 'sid=1',
            mockApis: [{ path: '/user', enabled: true, mockData: '{"ok":true}', method: 'GET', statusCode: 200 }],
        }, null, 2), 'utf-8');

        const cm = createManager();
        const cfg = cm.getConfig();
        const group = cfg.proxyGroups[0];
        const route = group.routes?.[0];

        expect(cfg.version).to.equal('4.0');
        expect(route).to.exist;
        expect(route).to.include({
            name: 'API',
            pathPrefix: '/legacy',
            targetType: 'PROXY',
            targetBaseUrl: 'http://localhost:18080',
            staticRoot: '',
            stripPrefix: false,
            rewriteTargetPath: '',
            spaFallbackPath: '',
            spaFallback: false,
            enableMock: true,
        });
        expect(route?.mockApis).to.have.length(1);
    });

    it('migrates 3.1 proxy groups into routes while keeping data compatible with 4.0', () => {
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify({
            version: '3.1',
            proxyGroups: [
                {
                    id: 'g1',
                    name: 'User Service',
                    protocol: 'HTTP',
                    port: 8888,
                    interceptPrefix: '/api',
                    baseUrl: 'http://localhost:9000',
                    stripPrefix: true,
                    globalCookie: '',
                    enabled: true,
                    mockApis: [{ path: '/test', enabled: true, mockData: '{"data":10}', method: 'ALL', statusCode: 200, delay: 0 }],
                },
            ],
        }, null, 2), 'utf-8');

        const cm = createManager();
        const route = cm.getConfig().proxyGroups[0].routes?.[0];

        expect(route).to.include({
            name: 'API',
            pathPrefix: '/api',
            targetType: 'PROXY',
            targetBaseUrl: 'http://localhost:9000',
            staticRoot: '',
            stripPrefix: true,
            rewriteTargetPath: '',
            spaFallbackPath: '',
            spaFallback: false,
            enableMock: true,
        });
        expect(route?.mockApis[0].path).to.equal('/test');
    });

    it('adds, updates and removes routes inside a proxy group', async () => {
        const cm = createManager();
        const groupId = cm.getConfig().proxyGroups[0].id;

        await cm.addRoute(groupId, {
            id: 'route-2',
            name: 'API 2',
            pathPrefix: '/api2',
            targetType: 'PROXY',
            targetBaseUrl: 'http://localhost:8082',
            staticRoot: '',
            stripPrefix: true,
            rewriteTargetPath: '/v1/',
            spaFallbackPath: '/index.html',
            spaFallback: false,
            enableMock: false,
            mockApis: [],
        });

        let cfg = cm.getConfig();
        expect(cfg.proxyGroups[0].routes).to.have.length(2);

        await cm.updateRoute(groupId, 'route-2', {
            targetBaseUrl: 'http://localhost:9090',
            enableMock: true,
        });

        cfg = cm.getConfig();
        expect(cfg.proxyGroups[0].routes?.find(route => route.id === 'route-2')).to.include({
            targetBaseUrl: 'http://localhost:9090',
            staticRoot: '',
            rewriteTargetPath: '/v1/',
            spaFallbackPath: '/index.html',
            spaFallback: false,
            enableMock: true,
        });

        await cm.removeRoute(groupId, 'route-2');
        cfg = cm.getConfig();
        expect(cfg.proxyGroups[0].routes).to.have.length(1);
    });

    it('stores mock APIs on the specified route', async () => {
        const cm = createManager();
        const groupId = cm.getConfig().proxyGroups[0].id;

        await cm.addRoute(groupId, {
            id: 'route-2',
            name: 'API 2',
            pathPrefix: '/api2',
            targetType: 'PROXY',
            targetBaseUrl: 'http://localhost:8082',
            staticRoot: '',
            stripPrefix: true,
            rewriteTargetPath: '',
            spaFallbackPath: '',
            spaFallback: false,
            enableMock: true,
            mockApis: [],
        });

        await cm.addMockApi(groupId, 'route-2', {
            path: '/test',
            enabled: true,
            mockData: '{"value":1}',
            method: 'GET',
            statusCode: 200,
        });

        let cfg = cm.getConfig();
        expect(cfg.proxyGroups[0].routes?.[0].mockApis).to.have.length(0);
        expect(cfg.proxyGroups[0].routes?.find(route => route.id === 'route-2')?.mockApis).to.have.length(1);

        await cm.updateMockApi(groupId, 'route-2', 0, {
            path: '/test',
            enabled: false,
            mockData: '{"value":2}',
            method: 'POST',
            statusCode: 201,
        });

        cfg = cm.getConfig();
        expect(cfg.proxyGroups[0].routes?.find(route => route.id === 'route-2')?.mockApis[0]).to.include({
            enabled: false,
            method: 'POST',
            statusCode: 201,
        });

        await cm.removeMockApi(groupId, 'route-2', 0);
        cfg = cm.getConfig();
        expect(cfg.proxyGroups[0].routes?.find(route => route.id === 'route-2')?.mockApis).to.have.length(0);
    });

    it('keeps old mock api config serialization free of template metadata', async () => {
        const cm = createManager();
        const groupId = cm.getConfig().proxyGroups[0].id;
        const routeId = cm.getConfig().proxyGroups[0].routes?.[0].id || '';

        await cm.addMockApi(groupId, routeId, {
            path: '/template-free',
            enabled: true,
            mockData: '{"code":0,"message":"success","data":{}}',
            method: 'GET',
            statusCode: 200,
        });

        const saved = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const savedMock = saved.proxyGroups[0].routes[0].mockApis[0];

        expect(savedMock.mockData).to.equal('{"code":0,"message":"success","data":{}}');
        expect(savedMock).to.not.have.property('templateId');
    });

    it('saves a 4.0-compatible file shape with routes', async () => {
        const cm = createManager();
        const cfg = cm.getConfig();
        cfg.proxyGroups[0].name = 'Shared Config';
        cfg.proxyGroups[0].routes = [
            {
                id: 'route-1',
                name: 'API',
                pathPrefix: '/api',
                targetType: 'PROXY',
                targetBaseUrl: 'http://localhost:9000',
                staticRoot: '',
                stripPrefix: true,
                rewriteTargetPath: '',
                spaFallbackPath: '',
                spaFallback: false,
                enableMock: true,
                mockApis: [],
            },
            {
                id: 'route-2',
                name: 'Frontend Build',
                pathPrefix: '/',
                targetType: 'STATIC',
                targetBaseUrl: 'http://localhost:9001',
                staticRoot: 'frontend/dist',
                stripPrefix: true,
                spaFallbackPath: '/index.html',
                rewriteTargetPath: '/v2',
                spaFallback: true,
                enableMock: false,
                mockApis: [],
            },
        ];

        await cm.saveConfig(cfg);

        const saved = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        expect(saved.version).to.equal('4.0');
        expect(saved.proxyGroups[0].routes).to.have.length(2);
        expect(saved.proxyGroups[0].routes[1]).to.include({
            name: 'Frontend Build',
            pathPrefix: '/',
            targetType: 'STATIC',
            targetBaseUrl: 'http://localhost:9001',
            staticRoot: 'frontend/dist',
            rewriteTargetPath: '/v2',
            spaFallbackPath: '/index.html',
            spaFallback: true,
            enableMock: false,
        });
    });

    it('normalizes missing static route fields to proxy-compatible values', () => {
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify({
            version: '4.0',
            proxyGroups: [
                {
                    id: 'g1',
                    name: 'G1',
                    protocol: 'HTTP',
                    port: 8888,
                    enabled: true,
                    stripPrefix: true,
                    globalCookie: '',
                    interceptPrefix: '/api',
                    baseUrl: 'http://localhost:9000',
                    mockApis: [],
                    routes: [
                        {
                            id: 'route-1',
                            name: 'API',
                            pathPrefix: '/api',
                            targetBaseUrl: 'http://localhost:9000',
                            stripPrefix: true,
                            enableMock: true,
                            mockApis: [],
                        },
                    ],
                },
            ],
        }, null, 2), 'utf-8');

        const route = createManager().getConfig().proxyGroups[0].routes?.[0];

        expect(route).to.include({
            targetType: 'PROXY',
            staticRoot: '',
            spaFallbackPath: '',
            spaFallback: false,
        });
    });

    it('preserves static route fields in the shared config shape', async () => {
        const cm = createManager();
        const groupId = cm.getConfig().proxyGroups[0].id;

        await cm.addRoute(groupId, {
            id: 'static-route',
            name: 'Frontend Build',
            pathPrefix: '/',
            targetType: 'STATIC',
            targetBaseUrl: 'http://localhost:8080',
            staticRoot: './frontend/dist',
            stripPrefix: false,
            rewriteTargetPath: '',
            spaFallbackPath: '',
            spaFallback: true,
            enableMock: false,
            mockApis: [],
        });

        const saved = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const route = saved.proxyGroups[0].routes.find((item: any) => item.id === 'static-route');

        expect(route).to.include({
            targetType: 'STATIC',
            targetBaseUrl: 'http://localhost:8080',
            staticRoot: './frontend/dist',
            rewriteTargetPath: '',
            spaFallbackPath: '',
            spaFallback: true,
            enableMock: false,
        });
    });

    it('returns default config when stored json is invalid', () => {
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(configPath, '{broken json', 'utf-8');

        const cm = createManager();
        const cfg = cm.getConfig();

        expect(cfg.version).to.equal('4.0');
        expect(cfg.proxyGroups).to.have.length(1);
    });

    it('normalizes v2 mockData and ignores invalid tolerant json', () => {
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify({
            version: '2.0',
            proxyGroups: [
                {
                    id: 'g1',
                    name: 'G1',
                    mockApis: [
                        { path: '/ok', mockData: "{ foo: 'bar', }" },
                        { path: '/bad', mockData: '{bad}' },
                    ],
                },
            ],
        }, null, 2), 'utf-8');

        createManager();

        const saved = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        expect(saved.proxyGroups[0].mockApis[0].mockData).to.equal('{"foo":"bar"}');
        expect(saved.proxyGroups[0].mockApis[1].mockData).to.equal('{bad}');
    });

    it('normalizes ws groups and private route helpers fall back safely', async () => {
        const cm = createManager();
        const normalizeRoutes = (cm as any).normalizeRoutes.bind(cm) as (group: any) => any[];
        const findRoute = (cm as any).findRoute.bind(cm) as (config: any, groupId: string, routeId?: string) => any;

        expect(normalizeRoutes({ protocol: 'WS' })).to.deep.equal([]);
        expect(normalizeRoutes({ protocol: 'WS', routes: [{ id: 'r1', name: 'WS', pathPrefix: '/ws', targetBaseUrl: 'ws://upstream', stripPrefix: false, enableMock: false, mockApis: [] }] })).to.have.length(1);

        const cfg = cm.getConfig();
        await cm.toggleProxyGroupEnabled('missing');
        await cm.updateRoute('missing', 'route', { name: 'x' });
        await cm.removeRoute('missing', 'route');
        await cm.updateMockApi('missing', 'route', 0, { path: '/x', enabled: true, mockData: '{}', method: 'GET', statusCode: 200 });
        await cm.removeMockApi('missing', 'route', 0);

        expect(findRoute(cfg, cfg.proxyGroups[0].id, 'missing-route')).to.equal(cfg.proxyGroups[0].routes?.[0]);
    });
});
