import { expect } from 'chai';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as vscode from 'vscode';

describe('Extension', () => {
    let sandbox: sinon.SinonSandbox;
    let extensionModule: typeof import('../../extension');
    let originalReadFileSync: typeof fs.readFileSync;
    let testState: {
        providers: Array<{ id: string; provider: any }>;
        commands: Record<string, (...args: any[]) => any>;
        outputChannels: Array<{ name: string; channel: any }>;
    };

    async function loadExtension() {
        delete require.cache[require.resolve('../../extension')];
        extensionModule = require('../../extension');
    }

    function createContext(): vscode.ExtensionContext {
        return {
            subscriptions: [],
            extensionUri: vscode.Uri.file(process.cwd()),
        } as any;
    }

    beforeEach(async () => {
        sandbox = sinon.createSandbox();
        testState = {
            providers: [],
            commands: {},
            outputChannels: [],
        };
        (globalThis as any).__vscodeTestState = testState;

        (vscode.workspace as any).workspaceFolders = [
            {
                uri: vscode.Uri.file(process.cwd()),
                name: 'workspace',
                index: 0,
            },
        ];

        originalReadFileSync = require('fs').readFileSync;
        require('fs').readFileSync = (filePath: string, ...args: any[]) => {
            if (String(filePath).includes('noWorkspaceView.html')) {
                return '<html lang="">{{TITLE}} {{MESSAGE}}</html>';
            }
            return originalReadFileSync.call(require('fs'), filePath, ...args);
        };

        await loadExtension();
    });

    afterEach(() => {
        delete (globalThis as any).__vscodeTestState;
        require('fs').readFileSync = originalReadFileSync;
        sandbox.restore();
    });

    it('activates with workspace and registers providers and commands', () => {
        extensionModule.activate(createContext());

        expect(testState.outputChannels).to.have.length(1);
        expect(testState.providers).to.have.length(1);
        expect(testState.commands).to.have.keys(
            'interceptWave.openFullView',
            'interceptWave.startServer',
            'interceptWave.stopServer',
            'interceptWave.openConfig'
        );
    });

    it('executes registered commands without crashing', async () => {
        const showInfoStub = sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined as any);
        const showTextDocumentStub = sandbox.stub(vscode.window, 'showTextDocument').resolves(undefined as any);
        sandbox.stub(vscode.workspace, 'openTextDocument').resolves({} as any);

        extensionModule.activate(createContext());

        await testState.commands['interceptWave.openFullView']();
        await testState.commands['interceptWave.startServer']();
        await testState.commands['interceptWave.stopServer']();
        await testState.commands['interceptWave.openConfig']();

        expect(testState.outputChannels).to.have.length(1);
        expect(testState.commands['interceptWave.openFullView']).to.be.a('function');
        expect(testState.commands['interceptWave.openConfig']).to.be.a('function');
        expect(showInfoStub.callCount).to.be.greaterThan(0);
        expect(showTextDocumentStub.calledOnce).to.equal(true);
    });

    it('deactivate is safe before and after activation', async () => {
        await extensionModule.deactivate();
        extensionModule.activate(createContext());
        await extensionModule.deactivate();
    });

    it('registers no-workspace provider and renders template html', () => {
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: undefined,
            configurable: true,
        });
        extensionModule.activate(createContext());

        expect(testState.providers).to.have.length(1);
        const provider = testState.providers[testState.providers.length - 1].provider;
        const webviewView = {
            webview: {
                options: {},
                html: '',
            },
        } as any;

        provider.resolveWebviewView(webviewView);

        expect(webviewView.webview.options.enableScripts).to.equal(false);
        expect(webviewView.webview.html).to.include('noWorkspace.title');
    });

    it('falls back to inline no-workspace html when template loading fails', () => {
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: undefined,
            configurable: true,
        });
        require('fs').readFileSync = ((filePath: string, ...args: any[]) => {
            if (String(filePath).includes('noWorkspaceView.html')) {
                throw new Error('template missing');
            }
            return originalReadFileSync.call(require('fs'), filePath, ...args);
        }) as any;

        extensionModule.activate(createContext());
        const provider = testState.providers[testState.providers.length - 1].provider;
        const webviewView = {
            webview: {
                options: {},
                html: '',
            },
        } as any;

        provider.resolveWebviewView(webviewView);

        expect(webviewView.webview.html).to.include('<h3>noWorkspace.title</h3>');
    });

    it('surfaces activation errors when initialization fails', async () => {
        const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined as any);
        const registerCommandStub = sandbox.stub(vscode.commands, 'registerCommand');
        registerCommandStub.onFirstCall().throws(new Error('boom'));

        expect(() => extensionModule.activate(createContext())).to.throw('boom');
        expect(showErrorStub.calledOnce).to.equal(true);
    });
});
