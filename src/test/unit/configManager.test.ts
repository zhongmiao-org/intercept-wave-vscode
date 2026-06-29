import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigManager } from '../../common';

describe('ConfigManager 5.0', () => {
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

    it('creates a default 5.0 config with one default route', () => {
        const cm = createManager();
        const cfg = cm.getConfig();

        expect(cfg.version).to.equal('5.0');
        expect(cfg.proxyGroups).to.have.length(1);
        expect(cfg.proxyGroups[0].routes).to.have.length(1);
        expect(cfg.proxyGroups[0]).to.include({
            httpsEnabled: false,
            httpsKeystorePath: '',
            httpsKeystorePassword: '',
        });
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
        expect(cfg.proxyGroups[0].routes?.[0].requestHeaders).to.deep.equal([]);
        expect(cfg.proxyGroups[0].routes?.[0].responseHeaders).to.deep.equal([]);
    });

    it('migrates legacy flat config into 5.0 routes', () => {
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

        expect(cfg.version).to.equal('5.0');
        expect(group).to.include({
            httpsEnabled: false,
            httpsKeystorePath: '',
            httpsKeystorePassword: '',
        });
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
        expect(route?.requestHeaders).to.deep.equal([]);
        expect(route?.responseHeaders).to.deep.equal([]);
        expect(route?.mockApis).to.have.length(1);
    });

    it('migrates 3.1 HTTP proxy groups into routes while keeping data compatible with 5.0', () => {
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
        expect(route?.requestHeaders).to.deep.equal([]);
        expect(route?.responseHeaders).to.deep.equal([]);
        expect(route?.mockApis[0].path).to.equal('/test');
    });

    it('does not inject HTTP routes into migrated WS groups', () => {
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify({
            version: '3.1',
            proxyGroups: [
                {
                    id: 'ws-only',
                    name: 'User WS',
                    protocol: 'WS',
                    port: 8891,
                    routes: [],
                    stripPrefix: true,
                    globalCookie: '',
                    enabled: true,
                    wsBaseUrl: 'ws://localhost:9003',
                    wsInterceptPrefix: '/ws',
                    wsManualPush: true,
                    wsPushRules: [
                        {
                            enabled: true,
                            path: '/echo',
                            eventKey: 'action',
                            eventValue: 'test',
                            direction: 'both',
                            intercept: true,
                            mode: 'off',
                            periodSec: 5,
                            message: '{"message":"Hello"}',
                            timeline: [],
                            loop: false,
                            onOpenFire: false,
                        },
                    ],
                    wssEnabled: false,
                    wssKeystorePath: null,
                    wssKeystorePassword: null,
                },
            ],
        }, null, 2), 'utf-8');

        const cfg = createManager().getConfig();
        const group = cfg.proxyGroups[0];

        expect(cfg.version).to.equal('5.0');
        expect(group.protocol).to.equal('WS');
        expect(group.routes).to.deep.equal([]);
        expect(group.wsBaseUrl).to.equal('ws://localhost:9003');
        expect(group.wsInterceptPrefix).to.equal('/ws');
        expect(group.wsPushRules).to.have.length(1);
    });

    it('migrates 4.0 configs to 5.0 while preserving explicit shared routes', () => {
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify({
            version: '4.0',
            proxyGroups: [
                {
                    id: 'http-explicit',
                    name: 'Gateway',
                    protocol: 'HTTP',
                    port: 8888,
                    enabled: true,
                    httpsEnabled: true,
                    httpsKeystorePath: 'certs/intercept-wave-local.p12',
                    httpsKeystorePassword: 'changeit',
                    stripPrefix: true,
                    globalCookie: '',
                    routes: [
                        {
                            id: 'frontend',
                            name: 'Frontend',
                            pathPrefix: '/',
                            targetType: 'STATIC',
                            targetBaseUrl: 'http://localhost:5173',
                            staticRoot: 'frontend/dist',
                            stripPrefix: false,
                            rewriteTargetPath: '',
                            spaFallbackPath: '',
                            spaFallback: true,
                            requestHeaders: [],
                            responseHeaders: [
                                { name: 'Cache-Control', value: 'no-store', operation: 'SET', enabled: true },
                            ],
                            enableMock: false,
                            mockApis: [],
                        },
                    ],
                },
            ],
        }, null, 2), 'utf-8');

        const cfg = createManager().getConfig();
        const group = cfg.proxyGroups[0];
        const route = group.routes?.[0];

        expect(cfg.version).to.equal('5.0');
        expect(group).to.include({
            httpsEnabled: true,
            httpsKeystorePath: 'certs/intercept-wave-local.p12',
            httpsKeystorePassword: 'changeit',
        });
        expect(route).to.include({
            id: 'frontend',
            name: 'Frontend',
            pathPrefix: '/',
            targetType: 'STATIC',
            staticRoot: 'frontend/dist',
            spaFallback: true,
            enableMock: false,
        });
        expect(route?.responseHeaders).to.deep.equal([
            { name: 'Cache-Control', value: 'no-store', operation: 'SET', enabled: true },
        ]);
    });

    it('replaces placeholder routes with legacy HTTP fields during migration', () => {
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify({
            version: '3.0',
            proxyGroups: [
                {
                    id: 'legacy-placeholder',
                    name: 'Legacy Placeholder',
                    protocol: 'HTTP',
                    port: 18889,
                    interceptPrefix: '/backend',
                    baseUrl: 'http://localhost:5000',
                    stripPrefix: false,
                    mockApis: [
                        { path: '/alive', enabled: true, mockData: '{}', method: 'GET', statusCode: 200 },
                    ],
                    routes: [
                        {
                            id: 'placeholder',
                            name: 'API',
                            pathPrefix: '/api',
                            targetBaseUrl: 'http://localhost:8080',
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
            pathPrefix: '/backend',
            targetBaseUrl: 'http://localhost:5000',
            stripPrefix: false,
        });
        expect(route?.mockApis[0].path).to.equal('/alive');
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
            requestHeaders: [
                { name: 'X-Dev', value: 'one', operation: 'set' as any, enabled: true },
            ],
            responseHeaders: [
                { name: 'Cache-Control', value: 'no-store', operation: 'ADD', enabled: false },
            ],
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
        expect(cfg.proxyGroups[0].routes?.find(route => route.id === 'route-2')?.requestHeaders).to.deep.equal([
            { name: 'X-Dev', value: 'one', operation: 'SET', enabled: true },
        ]);
        expect(cfg.proxyGroups[0].routes?.find(route => route.id === 'route-2')?.responseHeaders).to.deep.equal([
            { name: 'Cache-Control', value: 'no-store', operation: 'ADD', enabled: false },
        ]);

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

    it('saves a 5.0-compatible file shape with routes', async () => {
        const cm = createManager();
        const cfg = cm.getConfig();
        cfg.proxyGroups[0].name = 'Shared Config';
        cfg.proxyGroups[0].httpsEnabled = true;
        cfg.proxyGroups[0].httpsKeystorePath = 'certs/intercept-wave-local.p12';
        cfg.proxyGroups[0].httpsKeystorePassword = 'changeit';
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
                requestHeaders: [],
                responseHeaders: [],
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
                requestHeaders: [
                    { name: 'Authorization', value: 'Bearer local', operation: 'SET', enabled: true },
                ],
                responseHeaders: [
                    { name: 'Access-Control-Allow-Origin', value: 'http://localhost:5173', operation: 'SET', enabled: true },
                ],
            },
        ];

        await cm.saveConfig(cfg);

        const saved = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        expect(saved.version).to.equal('5.0');
        expect(saved.proxyGroups[0]).to.include({
            httpsEnabled: true,
            httpsKeystorePath: 'certs/intercept-wave-local.p12',
            httpsKeystorePassword: 'changeit',
        });
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
        expect(saved.proxyGroups[0].routes[1].requestHeaders).to.deep.equal([
            { name: 'Authorization', value: 'Bearer local', operation: 'SET', enabled: true },
        ]);
        expect(saved.proxyGroups[0].routes[1].responseHeaders).to.deep.equal([
            { name: 'Access-Control-Allow-Origin', value: 'http://localhost:5173', operation: 'SET', enabled: true },
        ]);
    });

    it('normalizes and preserves HTTPS listener fields in the shared group shape', async () => {
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify({
            version: '4.0',
            proxyGroups: [
                {
                    id: 'g1',
                    name: 'HTTPS Group',
                    protocol: 'HTTP',
                    port: 9443,
                    enabled: true,
                    stripPrefix: true,
                    globalCookie: '',
                    interceptPrefix: '/api',
                    baseUrl: 'http://localhost:9000',
                    httpsEnabled: true,
                    httpsKeystorePath: ' certs/intercept-wave-local.p12 ',
                    httpsKeystorePassword: 'changeit',
                    mockApis: [],
                    routes: [],
                },
            ],
        }, null, 2), 'utf-8');

        const cm = createManager();
        const group = cm.getConfig().proxyGroups[0];

        expect(group).to.include({
            httpsEnabled: true,
            httpsKeystorePath: 'certs/intercept-wave-local.p12',
            httpsKeystorePassword: 'changeit',
        });

        await cm.saveConfig(cm.getConfig());
        const saved = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        expect(saved.proxyGroups[0]).to.include({
            httpsEnabled: true,
            httpsKeystorePath: 'certs/intercept-wave-local.p12',
            httpsKeystorePassword: 'changeit',
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

        const config = createManager().getConfig();
        const route = config.proxyGroups[0].routes?.[0];

        expect(route).to.include({
            targetType: 'PROXY',
            staticRoot: '',
            spaFallbackPath: '',
            spaFallback: false,
        });
        expect(config.proxyGroups[0]).to.include({
            httpsEnabled: false,
            httpsKeystorePath: '',
            httpsKeystorePassword: '',
        });
        expect(route?.requestHeaders).to.deep.equal([]);
        expect(route?.responseHeaders).to.deep.equal([]);
    });

    it('normalizes header override arrays and legacy lowercase operations', () => {
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
                            requestHeaders: [
                                { name: ' X-Token ', value: 123, operation: 'add', enabled: false },
                                { name: 'X-Default', value: 'v' },
                            ],
                            responseHeaders: [
                                { name: 'Cache-Control', value: 'no-store', operation: 'remove' },
                                { name: '', value: 'skip', operation: 'SET' },
                            ],
                            mockApis: [],
                        },
                    ],
                },
            ],
        }, null, 2), 'utf-8');

        const route = createManager().getConfig().proxyGroups[0].routes?.[0];

        expect(route?.requestHeaders).to.deep.equal([
            { name: 'X-Token', value: '', operation: 'ADD', enabled: false },
            { name: 'X-Default', value: 'v', operation: 'SET', enabled: true },
        ]);
        expect(route?.responseHeaders).to.deep.equal([
            { name: 'Cache-Control', value: 'no-store', operation: 'REMOVE', enabled: true },
            { name: '', value: 'skip', operation: 'SET', enabled: true },
        ]);
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
            requestHeaders: [],
            responseHeaders: [
                { name: 'Cache-Control', value: 'no-store', operation: 'SET', enabled: true },
            ],
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
        expect(route.responseHeaders).to.deep.equal([
            { name: 'Cache-Control', value: 'no-store', operation: 'SET', enabled: true },
        ]);
    });

    it('returns default config when stored json is invalid', () => {
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(configPath, '{broken json', 'utf-8');

        const cm = createManager();
        const cfg = cm.getConfig();

        expect(cfg.version).to.equal('5.0');
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
