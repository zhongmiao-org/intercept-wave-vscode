import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { MockServerManager, MockConfig, ConfigManager } from '../../common';
import * as http from 'http';
import { EventEmitter } from 'events';

describe('MockServerManager', () => {
    let mockServerManager: MockServerManager;
    let configManager: ConfigManager;
    let outputChannel: vscode.OutputChannel;
    let appendLineStub: sinon.SinonStub;

    const defaultConfig: MockConfig = {
        version: '2.0',
        proxyGroups: [
            {
                id: 'test-group-id',
                name: 'Test Group',
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

    beforeEach(() => {
        // Create stubs
        appendLineStub = sinon.stub();
        outputChannel = {
            appendLine: appendLineStub,
            show: sinon.stub(),
        } as any;

        // Create config manager stub
        configManager = {
            getConfig: sinon.stub().returns(defaultConfig),
            saveConfig: sinon.stub(),
            addMockApi: sinon.stub(),
            removeMockApi: sinon.stub(),
            updateMockApi: sinon.stub(),
            getConfigPath: sinon.stub(),
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
            // In v2.0, start() returns URL with group name
            expect(url).to.equal('http://localhost:9999 (Test Group)');
            expect(mockServerManager.getStatus()).to.be.true;
        });

        it('should throw error if server is already running', async () => {
            await mockServerManager.start();
            try {
                await mockServerManager.start();
                expect.fail('Should have thrown an error');
            } catch (error: any) {
                // In v2.0, error message changed to reflect that all servers are running
                expect(error.message).to.equal('All enabled servers are already running');
            }
        });

        it('should log server details to output channel', async () => {
            await mockServerManager.start();
            expect(appendLineStub.called).to.be.true;
            // In v2.0, log message includes "Mock servers started" (plural)
            expect(appendLineStub.args.some((arg: any) => arg[0].includes('Mock server'))).to.be
                .true;
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

    describe('startGroupById and stopGroupById', () => {
        it('startGroupById throws when group not found', async () => {
            const cfg = { version: '2.0', proxyGroups: [] } as MockConfig;
            (configManager.getConfig as sinon.SinonStub).returns(cfg);

            try {
                await mockServerManager.startGroupById('missing-id');
                expect.fail('should have thrown');
            } catch (err: any) {
                expect(err.message).to.equal('Group not found: missing-id');
            }
        });

        it('startGroupById throws when group disabled', async () => {
            const cfg: MockConfig = {
                version: '2.0',
                proxyGroups: [
                    {
                        id: 'g1',
                        name: 'G1',
                        port: 10001,
                        interceptPrefix: '/api',
                        baseUrl: 'http://localhost:8080',
                        stripPrefix: true,
                        globalCookie: '',
                        enabled: false,
                        mockApis: [],
                    },
                ],
            };
            (configManager.getConfig as sinon.SinonStub).returns(cfg);

            try {
                await mockServerManager.startGroupById('g1');
                expect.fail('should have thrown');
            } catch (err: any) {
                expect(err.message).to.equal('Group is disabled: G1');
            }
        });

        it('startGroupById throws when server already running', async () => {
            const cfg: MockConfig = {
                version: '2.0',
                proxyGroups: [
                    {
                        id: 'g1',
                        name: 'G1',
                        port: 10001,
                        interceptPrefix: '/api',
                        baseUrl: 'http://localhost:8080',
                        stripPrefix: true,
                        globalCookie: '',
                        enabled: true,
                        mockApis: [],
                    },
                ],
            };
            (configManager.getConfig as sinon.SinonStub).returns(cfg);

            await mockServerManager.startGroupById('g1');
            try {
                await mockServerManager.startGroupById('g1');
                expect.fail('should have thrown');
            } catch (err: any) {
                expect(err.message).to.equal('Server for group "G1" is already running');
            }
        });

        it('startGroupById starts server and stopGroupById stops it', async () => {
            const cfg: MockConfig = {
                version: '2.0',
                proxyGroups: [
                    {
                        id: 'g1',
                        name: 'G1',
                        port: 10001,
                        interceptPrefix: '/api',
                        baseUrl: 'http://localhost:8080',
                        stripPrefix: true,
                        globalCookie: '',
                        enabled: true,
                        mockApis: [],
                    },
                    {
                        id: 'g2',
                        name: 'G2',
                        port: 10002,
                        interceptPrefix: '/api',
                        baseUrl: 'http://localhost:8080',
                        stripPrefix: true,
                        globalCookie: '',
                        enabled: true,
                        mockApis: [],
                    },
                ],
            };
            (configManager.getConfig as sinon.SinonStub).returns(cfg);

            // Start two groups
            const url1 = await mockServerManager.startGroupById('g1');
            expect(url1).to.equal('http://localhost:10001 (G1)');
            const url2 = await mockServerManager.startGroupById('g2');
            expect(url2).to.equal('http://localhost:10002 (G2)');
            expect(mockServerManager.getStatus()).to.be.true;
            expect(mockServerManager.getGroupStatus('g1')).to.be.true;
            expect(mockServerManager.getGroupStatus('g2')).to.be.true;

            // Stop only g1 -> server still running because g2 is on
            await mockServerManager.stopGroupById('g1');
            expect(mockServerManager.getGroupStatus('g1')).to.be.false;
            expect(mockServerManager.getGroupStatus('g2')).to.be.true;
            expect(mockServerManager.getStatus()).to.be.true;

            // Stop g2 -> no servers left
            await mockServerManager.stopGroupById('g2');
            expect(mockServerManager.getGroupStatus('g2')).to.be.false;
            expect(mockServerManager.getStatus()).to.be.false;
        });

        it('stopGroupById is no-op when group server not running', async () => {
            // ensure no servers
            await mockServerManager.stop();
            // call with non-existing id must not throw
            await mockServerManager.stopGroupById('unknown');
            expect(mockServerManager.getStatus()).to.be.false;
        });
    });
    describe('request handling', () => {
        it('start throws when no enabled proxy groups', async () => {
            const cfg: MockConfig = { version: '2.0', proxyGroups: [ { id: 'g0', name: 'G0', port: 10050, interceptPrefix: '/api', baseUrl: 'http://localhost:8080', stripPrefix: true, globalCookie: '', enabled: false, mockApis: [] } ] } as any;
            (configManager.getConfig as sinon.SinonStub).returns(cfg);
            try {
                await mockServerManager.start();
                expect.fail('should throw');
            } catch (e: any) {
                expect(e.message).to.equal('No enabled proxy groups found');
            }
        });

        it('startGroup logs error and rejects on server error', async () => {
            // Stub http.createServer to emit error on listen
            const orig = (http as any).createServer;
            const createServerStub = sinon.stub(http as any, 'createServer').callsFake(() => {
                const srv = new EventEmitter() as any;
                srv.listen = (_port: number, _cb?: any) => {
                    setImmediate(() => srv.emit('error', new Error('boom')));
                };
                srv.close = (cb?: any) => { if (cb) cb(); };
                srv.on = srv.addListener.bind(srv);
                srv.removeListener = (_: any, __: any) => {};
                return srv;
            });
            try {
                const cfg: MockConfig = { version: '2.0', proxyGroups: [ { id: 'g1', name: 'G1', port: 10051, interceptPrefix: '/api', baseUrl: 'http://localhost:8080', stripPrefix: true, globalCookie: '', enabled: true, mockApis: [] } ] } as any;
                (configManager.getConfig as sinon.SinonStub).returns(cfg);
                try {
                    await mockServerManager.start();
                    expect.fail('should reject');
                } catch (e: any) {
                    expect(appendLineStub.called).to.be.true;
                }
            } finally {
                createServerStub.restore();
                // restore original reference in case
                (http as any).createServer = orig;
            }
        });

        it('forwardToOriginalServer catches URL parse error and returns 500', async () => {
            const cfg: MockConfig = {
                version: '2.0',
                proxyGroups: [
                    { id: 'g1', name: 'G1', port: 10052, interceptPrefix: '/api', baseUrl: 'http://:', stripPrefix: true, globalCookie: '', enabled: true, mockApis: [] },
                ],
            } as any;
            (configManager.getConfig as sinon.SinonStub).returns(cfg);
            await mockServerManager.start();
            const res = await new Promise<http.IncomingMessage>((resolve, reject) => {
                const req = http.get('http://localhost:10052/anything', resolve);
                req.on('error', reject);
            });
            expect(res.statusCode).to.equal(500);
        });
        it('should handle GET requests', async () => {
            const config = {
                ...defaultConfig,
                proxyGroups: [
                    {
                        ...defaultConfig.proxyGroups[0],
                        mockApis: [
                            {
                                path: '/test',
                                enabled: true,
                                mockData: '{"result": "success"}',
                                method: 'GET',
                                statusCode: 200,
                            },
                        ],
                    },
                ],
            };
            (configManager.getConfig as sinon.SinonStub).returns(config);

            await mockServerManager.start();

            const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
                const req = http.get('http://localhost:9999/test', res => {
                    resolve(res);
                });
                req.on('error', reject);
            });

            expect(response.statusCode).to.equal(200);
        });

        it('should handle mock response with delay', async () => {
            const config = {
                ...defaultConfig,
                proxyGroups: [
                    {
                        ...defaultConfig.proxyGroups[0],
                        mockApis: [
                            {
                                path: '/delayed',
                                enabled: true,
                                mockData: '{"result": "delayed"}',
                                method: 'GET',
                                statusCode: 200,
                                delay: 100,
                            },
                        ],
                    },
                ],
            };
            (configManager.getConfig as sinon.SinonStub).returns(config);

            await mockServerManager.start();

            const startTime = Date.now();
            const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
                const req = http.get('http://localhost:9999/delayed', res => {
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
                proxyGroups: [
                    {
                        ...defaultConfig.proxyGroups[0],
                        globalCookie: 'session=abc123',
                        mockApis: [
                            {
                                path: '/with-cookie',
                                enabled: true,
                                mockData: '{"result": "with cookie"}',
                                method: 'GET',
                                statusCode: 200,
                                useCookie: true,
                            },
                        ],
                    },
                ],
            };
            (configManager.getConfig as sinon.SinonStub).returns(config);

            await mockServerManager.start();

            const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
                const req = http.get('http://localhost:9999/with-cookie', res => {
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
                proxyGroups: [
                    {
                        ...defaultConfig.proxyGroups[0],
                        mockApis: [
                            {
                                path: '/users',
                                enabled: true,
                                mockData: '{"users": []}',
                                method: 'GET',
                                statusCode: 200,
                            },
                        ],
                    },
                ],
            };
            (configManager.getConfig as sinon.SinonStub).returns(config);

            await mockServerManager.start();

            const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
                const req = http.get('http://localhost:9999/users?page=1&limit=10', res => {
                    resolve(res);
                });
                req.on('error', reject);
            });

            expect(response.statusCode).to.equal(200);
        });

        it('should strip prefix when matching paths', async () => {
            const config = {
                ...defaultConfig,
                proxyGroups: [
                    {
                        ...defaultConfig.proxyGroups[0],
                        stripPrefix: true,
                        interceptPrefix: '/api',
                        mockApis: [
                            {
                                path: '/test',
                                enabled: true,
                                mockData: '{"result": "stripped"}',
                                method: 'GET',
                                statusCode: 200,
                            },
                        ],
                    },
                ],
            };
            (configManager.getConfig as sinon.SinonStub).returns(config);

            await mockServerManager.start();

            const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
                const req = http.get('http://localhost:9999/api/test', res => {
                    resolve(res);
                });
                req.on('error', reject);
            });

            expect(response.statusCode).to.equal(200);
        });

        it('should handle POST requests', async () => {
            const config = {
                ...defaultConfig,
                proxyGroups: [
                    {
                        ...defaultConfig.proxyGroups[0],
                        mockApis: [
                            {
                                path: '/create',
                                enabled: true,
                                mockData: '{"id": 123}',
                                method: 'POST',
                                statusCode: 201,
                            },
                        ],
                    },
                ],
            };
            (configManager.getConfig as sinon.SinonStub).returns(config);

            await mockServerManager.start();

            const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
                const req = http.request(
                    {
                        hostname: 'localhost',
                        port: 9999,
                        path: '/create',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    },
                    res => {
                        resolve(res);
                    }
                );
                req.on('error', reject);
                req.write('{"name": "test"}');
                req.end();
            });

            expect(response.statusCode).to.equal(201);
        });

        it('should handle disabled mock APIs by forwarding', async () => {
            const config = {
                ...defaultConfig,
                proxyGroups: [
                    {
                        ...defaultConfig.proxyGroups[0],
                        baseUrl: 'http://localhost:9998', // Non-existent server
                        mockApis: [
                            {
                                path: '/disabled',
                                enabled: false,
                                mockData: '{"result": "should not return this"}',
                                method: 'GET',
                                statusCode: 200,
                            },
                        ],
                    },
                ],
            };
            (configManager.getConfig as sinon.SinonStub).returns(config);

            await mockServerManager.start();

            // This should attempt to forward and fail (502)
            const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
                const req = http.get('http://localhost:9999/disabled', res => {
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
                proxyGroups: [
                    {
                        ...defaultConfig.proxyGroups[0],
                        mockApis: [
                            {
                                path: '/test1',
                                enabled: true,
                                mockData: '{}',
                                method: 'GET',
                                statusCode: 200,
                            },
                            {
                                path: '/test2',
                                enabled: false,
                                mockData: '{}',
                                method: 'POST',
                                statusCode: 200,
                            },
                        ],
                    },
                ],
            };
            (configManager.getConfig as sinon.SinonStub).returns(config);

            await mockServerManager.start();

            const response = await new Promise<{ res: http.IncomingMessage; body: string }>(
                (resolve, reject) => {
                    const req = http.get('http://localhost:9999/', res => {
                        let body = '';
                        res.on('data', chunk => (body += chunk));
                        res.on('end', () => resolve({ res, body }));
                    });
                    req.on('error', reject);
                }
            );

            expect(response.res.statusCode).to.equal(200);
            const data = JSON.parse(response.body);
            expect(data.status).to.equal('running');
            expect(data.mockApis.total).to.equal(2);
            expect(data.mockApis.enabled).to.equal(1);
        });

        it('should return same welcome JSON for prefix when stripPrefix=true', async () => {
            const config = {
                ...defaultConfig,
                proxyGroups: [
                    {
                        ...defaultConfig.proxyGroups[0],
                        interceptPrefix: '/api',
                        stripPrefix: true,
                        mockApis: [
                            {
                                path: '/hello',
                                enabled: true,
                                mockData: '{}',
                                method: 'GET',
                                statusCode: 200,
                            },
                        ],
                    },
                ],
            };
            (configManager.getConfig as sinon.SinonStub).returns(config);

            await mockServerManager.start();

            async function getJson(path: string) {
                return new Promise<{ res: http.IncomingMessage; body: string }>((resolve, reject) => {
                    const req = http.get(`http://localhost:9999${path}`, res => {
                        let body = '';
                        res.on('data', chunk => (body += chunk));
                        res.on('end', () => resolve({ res, body }));
                    });
                    req.on('error', reject);
                });
            }

            const root = await getJson('/');
            const pre1 = await getJson('/api');
            const pre2 = await getJson('/api/');

            expect(root.res.statusCode).to.equal(200);
            expect(pre1.res.statusCode).to.equal(200);
            expect(pre2.res.statusCode).to.equal(200);

            const rootJson = JSON.parse(root.body);
            const pre1Json = JSON.parse(pre1.body);
            const pre2Json = JSON.parse(pre2.body);

            expect(pre1Json).to.deep.equal(rootJson);
            expect(pre2Json).to.deep.equal(rootJson);
            // Ensure serverUrl exists
            expect(rootJson.group.serverUrl).to.equal('http://localhost:9999');
        });

        it('welcome page lists only enabled APIs and provides example links', async () => {
            const config = {
                ...defaultConfig,
                proxyGroups: [
                    {
                        ...defaultConfig.proxyGroups[0],
                        interceptPrefix: '/api',
                        stripPrefix: true,
                        mockApis: [
                            {
                                path: '/a',
                                enabled: true,
                                mockData: '{}',
                                method: 'GET',
                                statusCode: 200,
                            },
                            {
                                path: '/b',
                                enabled: false,
                                mockData: '{}',
                                method: 'GET',
                                statusCode: 200,
                            },
                            {
                                path: 'users', // no leading slash
                                enabled: true,
                                mockData: '{}',
                                method: 'POST',
                                statusCode: 200,
                            },
                        ],
                    },
                ],
            };
            (configManager.getConfig as sinon.SinonStub).returns(config);

            await mockServerManager.start();

            const result = await new Promise<{ res: http.IncomingMessage; body: string }>(
                (resolve, reject) => {
                    const req = http.get('http://localhost:9999/', res => {
                        let body = '';
                        res.on('data', chunk => (body += chunk));
                        res.on('end', () => resolve({ res, body }));
                    });
                    req.on('error', reject);
                }
            );

            expect(result.res.statusCode).to.equal(200);
            const json = JSON.parse(result.body);
            // Only enabled apis are listed
            expect(json.apis).to.be.an('array');
            expect(json.apis.length).to.equal(2);
            const examples = json.apis.map((a: any) => a.example);
            expect(examples).to.include('/api/a');
            expect(examples).to.include('/api/users');
            expect(examples).to.not.include('/api/b');
        });

        it('should handle root path welcome page', async () => {
            await mockServerManager.start();

            const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
                const req = http.get('http://localhost:9999/', res => {
                    resolve(res);
                });
                req.on('error', reject);
            });

            expect(response.statusCode).to.equal(200);
        });

        it('should handle OPTIONS request (CORS preflight)', async () => {
            await mockServerManager.start();

            const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
                const req = http.request(
                    {
                        hostname: 'localhost',
                        port: 9999,
                        path: '/test',
                        method: 'OPTIONS',
                    },
                    res => {
                        resolve(res);
                    }
                );
                req.on('error', reject);
                req.end();
            });

            expect(response.statusCode).to.equal(200);
            expect(response.headers['access-control-allow-origin']).to.equal('*');
        });

        it('should handle requests to non-existent endpoints by forwarding', async () => {
            const config = {
                ...defaultConfig,
                proxyGroups: [
                    {
                        ...defaultConfig.proxyGroups[0],
                        baseUrl: 'http://localhost:9998', // Non-existent server
                    },
                ],
            };
            (configManager.getConfig as sinon.SinonStub).returns(config);

            await mockServerManager.start();

            const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
                const req = http.get('http://localhost:9999/nonexistent', res => {
                    resolve(res);
                });
                req.on('error', reject);
            });

            // Should get 502 when forwarding fails
            expect(response.statusCode).to.equal(502);
        });

        it('should proxy requests to upstream and copy headers', async () => {
            // Start a simple upstream server to proxy to
            const upstreamPort = 10080;
            const upstreamServer = http.createServer((req, res) => {
                res.statusCode = 201;
                res.setHeader('Content-Type', 'text/plain');
                res.setHeader('X-Test', 'abc');
                res.end('hello world');
            });

            await new Promise<void>((resolve, reject) => {
                upstreamServer.listen(upstreamPort, (err?: any) =>
                    err ? reject(err) : resolve()
                );
            });

            try {
                const cfg = {
                    ...defaultConfig,
                    proxyGroups: [
                        {
                            ...defaultConfig.proxyGroups[0],
                            baseUrl: `http://localhost:${upstreamPort}`,
                            mockApis: [],
                        },
                    ],
                } as MockConfig;
                (configManager.getConfig as sinon.SinonStub).returns(cfg);

                await mockServerManager.start();

                const response = await new Promise<{ res: http.IncomingMessage; body: string }>(
                    (resolve, reject) => {
                        const req = http.get('http://localhost:9999/proxy', res => {
                            let body = '';
                            res.on('data', chunk => (body += chunk));
                            res.on('end', () => resolve({ res, body }));
                        });
                        req.on('error', reject);
                    }
                );

                expect(response.res.statusCode).to.equal(201);
                // Header copied from upstream
                expect(response.res.headers['x-test']).to.equal('abc');
                // CORS headers added
                expect(response.res.headers['access-control-allow-origin']).to.equal('*');
                // Body proxied through
                expect(response.body).to.equal('hello world');
            } finally {
                await new Promise<void>(resolve => upstreamServer.close(() => resolve()));
            }
        });

        it('should return 503 when proxy group is disabled at request time', async () => {
            // First config: group enabled for server start
            const enabledConfig = {
                ...defaultConfig,
                proxyGroups: [
                    {
                        ...defaultConfig.proxyGroups[0],
                        enabled: true,
                        mockApis: [],
                    },
                ],
            };

            // Second config: same group but disabled when handling request
            const disabledConfig = {
                ...defaultConfig,
                proxyGroups: [
                    {
                        ...defaultConfig.proxyGroups[0],
                        enabled: false,
                        mockApis: [],
                    },
                ],
            };

            const getConfigStub = configManager.getConfig as sinon.SinonStub;
            getConfigStub.reset();
            getConfigStub.onFirstCall().returns(enabledConfig); // start()
            getConfigStub.onSecondCall().returns(disabledConfig); // request handler
            getConfigStub.returns(disabledConfig); // subsequent calls (e.g., stop())

            await mockServerManager.start();

            const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
                const req = http.get('http://localhost:9999/any', res => resolve(res));
                req.on('error', reject);
            });

            expect(response.statusCode).to.equal(503);
        });
    });
});
