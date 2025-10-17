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
        port: 9999,
        interceptPrefix: '/api',
        baseUrl: 'http://localhost:8080',
        stripPrefix: true,
        globalCookie: '',
        mockApis: []
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
                mockApis: [{
                    path: '/test',
                    enabled: true,
                    mockData: '{"result": "success"}',
                    method: 'GET',
                    statusCode: 200
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
        });
    });
});