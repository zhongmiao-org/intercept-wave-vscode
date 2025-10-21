import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { MockServerManager, MockConfig } from '../../mockServer';
import { ConfigManager } from '../../configManager';
import * as http from 'http';

describe('MockServerManager', () => {
    let mockServerManager: MockServerManager;
    let configManager: ConfigManager;
    let outputChannel: vscode.OutputChannel;
    let appendLineStub: sinon.SinonStub;

    const defaultConfig: MockConfig = {
        version: '2.0',
        proxyGroups: [{
            id: 'test-group-id',
            name: 'Test Group',
            port: 9999,
            interceptPrefix: '/api',
            baseUrl: 'http://localhost:8080',
            stripPrefix: true,
            globalCookie: '',
            enabled: true,
            mockApis: []
        }]
    };

    beforeEach(() => {
        // Create stubs
        appendLineStub = sinon.stub();
        outputChannel = {
            appendLine: appendLineStub,
            show: sinon.stub()
        } as any;

        // Create config manager stub
        configManager = {
            getConfig: sinon.stub().returns(defaultConfig),
            saveConfig: sinon.stub(),
            addMockApi: sinon.stub(),
            removeMockApi: sinon.stub(),
            updateMockApi: sinon.stub(),
            getConfigPath: sinon.stub()
        } as any;

        mockServerManager = new MockServerManager(configManager, outputChannel);
    });

    afterEach(async () => {
        await mockServerManager.stop();
        sinon.restore();
    });

    describe('constructor', () => {
        it('should create an instance', () => {
            expect(mockServerManager).to.be.instanceOf(MockServerManager);
        });
    });

    describe('getStatus', () => {
        it('should return false when server is not running', () => {
            expect(mockServerManager.getStatus()).to.be.false;
        });

        it('should return true after server starts', async () => {
            await mockServerManager.start();
            expect(mockServerManager.getStatus()).to.be.true;
        });

        it('should return false after server stops', async () => {
            await mockServerManager.start();
            await mockServerManager.stop();
            expect(mockServerManager.getStatus()).to.be.false;
        });
    });

    describe('start', () => {
        it('should start the server and return URL', async () => {
            const url = await mockServerManager.start();
            expect(url).to.equal('http://localhost:9999');
            expect(mockServerManager.getStatus()).to.be.true;
        });

        it('should throw error if server is already running', async () => {
            await mockServerManager.start();
            try {
                await mockServerManager.start();
                expect.fail('Should have thrown an error');
            } catch (error: any) {
                expect(error.message).to.equal('Mock server is already running');
            }
        });

        it('should log server details to output channel', async () => {
            await mockServerManager.start();
            expect(appendLineStub.called).to.be.true;
            expect(appendLineStub.args.some((arg: any) => arg[0].includes('Mock server started'))).to.be.true;
        });
    });

    describe('stop', () => {
        it('should stop the running server', async () => {
            await mockServerManager.start();
            await mockServerManager.stop();
            expect(mockServerManager.getStatus()).to.be.false;
        });

        it('should not throw error when stopping a server that is not running', async () => {
            await mockServerManager.stop();
            expect(mockServerManager.getStatus()).to.be.false;
        });

        it('should log stop message to output channel', async () => {
            await mockServerManager.start();
            appendLineStub.resetHistory();
            await mockServerManager.stop();
            expect(appendLineStub.called).to.be.true;
            expect(appendLineStub.args.some((arg: any) => arg[0].includes('stopped'))).to.be.true;
        });
    });

    describe('server lifecycle', () => {
        it('should allow starting and stopping multiple times', async () => {
            await mockServerManager.start();
            await mockServerManager.stop();
            await mockServerManager.start();
            expect(mockServerManager.getStatus()).to.be.true;
            await mockServerManager.stop();
            expect(mockServerManager.getStatus()).to.be.false;
        });
    });

    describe('request handling', () => {
        it('should handle GET requests', async () => {
            const config = {
                ...defaultConfig,
                proxyGroups: [{
                    ...defaultConfig.proxyGroups[0],
                    mockApis: [{
                        path: '/test',
                        enabled: true,
                        mockData: '{"result": "success"}',
                        method: 'GET',
                        statusCode: 200
                    }]
                }]
            };
            (configManager.getConfig as sinon.SinonStub).returns(config);

            await mockServerManager.start();

            const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
                const req = http.get('http://localhost:9999/test', (res) => {
                    resolve(res);
                });
                req.on('error', reject);
            });

            expect(response.statusCode).to.equal(200);
        });

        it('should handle mock response with delay', async () => {
            const config = {
                ...defaultConfig,
                proxyGroups: [{
                    ...defaultConfig.proxyGroups[0],
                    mockApis: [{
                        path: '/delayed',
                        enabled: true,
                        mockData: '{"result": "delayed"}',
                        method: 'GET',
                        statusCode: 200,
                        delay: 100
                    }]
                }]
            };
            (configManager.getConfig as sinon.SinonStub).returns(config);

            await mockServerManager.start();

            const startTime = Date.now();
            const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
                const req = http.get('http://localhost:9999/delayed', (res) => {
                    resolve(res);
                });
                req.on('error', reject);
            });
            const endTime = Date.now();

            expect(response.statusCode).to.equal(200);
            expect(endTime - startTime).to.be.at.least(100);
        });

        it('should handle mock response with cookie', async () => {
            const config = {
                ...defaultConfig,
                proxyGroups: [{
                    ...defaultConfig.proxyGroups[0],
                    globalCookie: 'session=abc123',
                    mockApis: [{
                        path: '/with-cookie',
                        enabled: true,
                        mockData: '{"result": "with cookie"}',
                        method: 'GET',
                        statusCode: 200,
                        useCookie: true
                    }]
                }]
            };
            (configManager.getConfig as sinon.SinonStub).returns(config);

            await mockServerManager.start();

            const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
                const req = http.get('http://localhost:9999/with-cookie', (res) => {
                    resolve(res);
                });
                req.on('error', reject);
            });

            expect(response.statusCode).to.equal(200);
            expect(response.headers['set-cookie']).to.include('session=abc123');
        });

        it('should handle path with query parameters', async () => {
            const config = {
                ...defaultConfig,
                proxyGroups: [{
                    ...defaultConfig.proxyGroups[0],
                    mockApis: [{
                        path: '/users',
                        enabled: true,
                        mockData: '{"users": []}',
                        method: 'GET',
                        statusCode: 200
                    }]
                }]
            };
            (configManager.getConfig as sinon.SinonStub).returns(config);

            await mockServerManager.start();

            const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
                const req = http.get('http://localhost:9999/users?page=1&limit=10', (res) => {
                    resolve(res);
                });
                req.on('error', reject);
            });

            expect(response.statusCode).to.equal(200);
        });

        it('should strip prefix when matching paths', async () => {
            const config = {
                ...defaultConfig,
                proxyGroups: [{
                    ...defaultConfig.proxyGroups[0],
                    stripPrefix: true,
                    interceptPrefix: '/api',
                    mockApis: [{
                        path: '/test',
                        enabled: true,
                        mockData: '{"result": "stripped"}',
                        method: 'GET',
                        statusCode: 200
                    }]
                }]
            };
            (configManager.getConfig as sinon.SinonStub).returns(config);

            await mockServerManager.start();

            const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
                const req = http.get('http://localhost:9999/api/test', (res) => {
                    resolve(res);
                });
                req.on('error', reject);
            });

            expect(response.statusCode).to.equal(200);
        });

        it('should handle POST requests', async () => {
            const config = {
                ...defaultConfig,
                proxyGroups: [{
                    ...defaultConfig.proxyGroups[0],
                    mockApis: [{
                        path: '/create',
                        enabled: true,
                        mockData: '{"id": 123}',
                        method: 'POST',
                        statusCode: 201
                    }]
                }]
            };
            (configManager.getConfig as sinon.SinonStub).returns(config);

            await mockServerManager.start();

            const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
                const req = http.request({
                    hostname: 'localhost',
                    port: 9999,
                    path: '/create',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }, (res) => {
                    resolve(res);
                });
                req.on('error', reject);
                req.write('{"name": "test"}');
                req.end();
            });

            expect(response.statusCode).to.equal(201);
        });

        it('should handle disabled mock APIs by forwarding', async () => {
            const config = {
                ...defaultConfig,
                proxyGroups: [{
                    ...defaultConfig.proxyGroups[0],
                    baseUrl: 'http://localhost:9998', // Non-existent server
                    mockApis: [{
                        path: '/disabled',
                        enabled: false,
                        mockData: '{"result": "should not return this"}',
                        method: 'GET',
                        statusCode: 200
                    }]
                }]
            };
            (configManager.getConfig as sinon.SinonStub).returns(config);

            await mockServerManager.start();

            // This should attempt to forward and fail (502)
            const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
                const req = http.get('http://localhost:9999/disabled', (res) => {
                    resolve(res);
                });
                req.on('error', reject);
            });

            // Should get error response when forwarding fails
            expect(response.statusCode).to.equal(502);
        });

        it('should return welcome page with correct data structure', async () => {
            const config = {
                ...defaultConfig,
                proxyGroups: [{
                    ...defaultConfig.proxyGroups[0],
                    mockApis: [
                        {
                            path: '/test1',
                            enabled: true,
                            mockData: '{}',
                            method: 'GET',
                            statusCode: 200
                        },
                        {
                            path: '/test2',
                            enabled: false,
                            mockData: '{}',
                            method: 'POST',
                            statusCode: 200
                        }
                    ]
                }]
            };
            (configManager.getConfig as sinon.SinonStub).returns(config);

            await mockServerManager.start();

            const response = await new Promise<{res: http.IncomingMessage, body: string}>((resolve, reject) => {
                const req = http.get('http://localhost:9999/', (res) => {
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => resolve({ res, body }));
                });
                req.on('error', reject);
            });

            expect(response.res.statusCode).to.equal(200);
            const data = JSON.parse(response.body);
            expect(data.status).to.equal('running');
            expect(data.mockApis.total).to.equal(2);
            expect(data.mockApis.enabled).to.equal(1);
        });

        it('should handle root path welcome page', async () => {
            await mockServerManager.start();

            const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
                const req = http.get('http://localhost:9999/', (res) => {
                    resolve(res);
                });
                req.on('error', reject);
            });

            expect(response.statusCode).to.equal(200);
        });

        it('should handle OPTIONS request (CORS preflight)', async () => {
            await mockServerManager.start();

            const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
                const req = http.request({
                    hostname: 'localhost',
                    port: 9999,
                    path: '/test',
                    method: 'OPTIONS'
                }, (res) => {
                    resolve(res);
                });
                req.on('error', reject);
                req.end();
            });

            expect(response.statusCode).to.equal(200);
            expect(response.headers['access-control-allow-origin']).to.equal('*');
        });

        it('should handle requests to non-existent endpoints by forwarding', async () => {
            const config = {
                ...defaultConfig,
                proxyGroups: [{
                    ...defaultConfig.proxyGroups[0],
                    baseUrl: 'http://localhost:9998' // Non-existent server
                }]
            };
            (configManager.getConfig as sinon.SinonStub).returns(config);

            await mockServerManager.start();

            const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
                const req = http.get('http://localhost:9999/nonexistent', (res) => {
                    resolve(res);
                });
                req.on('error', reject);
            });

            // Should get 502 when forwarding fails
            expect(response.statusCode).to.equal(502);
        });
    });
});