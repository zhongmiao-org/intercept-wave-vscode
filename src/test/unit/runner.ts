import * as path from 'path';
import * as fs from 'fs';
import Mocha = require('mocha');
import * as Module from 'module';

// Mock vscode module before running tests
const originalRequire = Module.prototype.require;
const vscodeMock = {
    workspace: {
        workspaceFolders: [
            {
                uri: { fsPath: process.cwd(), scheme: 'file', path: process.cwd() },
                name: 'test-workspace',
                index: 0,
            },
        ],
        getConfiguration: () => ({
            get: () => undefined,
            update: () => Promise.resolve(),
        }),
        openTextDocument: () => Promise.resolve(),
    },
    l10n: {
        t: (key: string, ..._args: any[]) => key,
    },
    env: {
        language: 'en',
    },
    window: {
        showInformationMessage: () => Promise.resolve(),
        showErrorMessage: () => Promise.resolve(),
        showWarningMessage: () => Promise.resolve(),
        showTextDocument: () => Promise.resolve(),
        createOutputChannel: (name: string) => {
            const channel = {
                appendLine: () => undefined,
                show: () => undefined,
                dispose: () => undefined,
            };
            (globalThis as any).__vscodeTestState?.outputChannels?.push({
                name,
                channel,
            });
            return channel;
        },
        registerWebviewViewProvider: (id: string, provider: any) => {
            (globalThis as any).__vscodeTestState?.providers?.push({
                id,
                provider,
            });
            return { dispose: () => undefined };
        },
        createWebviewPanel: () => ({
            reveal: () => undefined,
            onDidDispose: () => ({ dispose: () => undefined }),
            webview: {
                html: '',
                options: {},
                cspSource: 'vscode-webview://test',
                postMessage: () => Promise.resolve(true),
                onDidReceiveMessage: () => ({ dispose: () => undefined }),
                asWebviewUri: (uri: any) => uri,
            },
        }),
    },
    Uri: {
        file: (p: string) => ({ fsPath: p, scheme: 'file', path: p }),
        parse: (p: string) => ({ fsPath: p, scheme: 'file', path: p }),
        joinPath: (base: any, ...parts: string[]) => ({
            fsPath: [base.fsPath, ...parts].join('/'),
            scheme: 'file',
            path: [base.path || base.fsPath, ...parts].join('/'),
        }),
    },
    commands: {
        registerCommand: (id: string, cb: (...args: any[]) => any) => {
            const state = (globalThis as any).__vscodeTestState;
            if (state?.commands) {
                state.commands[id] = cb;
            }
            return { dispose: () => undefined };
        },
        executeCommand: () => Promise.resolve(),
    },
    ViewColumn: {
        Active: 1,
    },
    ExtensionMode: {
        Production: 1,
        Development: 2,
        Test: 3,
    },
};
(Module.prototype.require as any) = function (this: any, id: string) {
    if (id === 'vscode') {
        return vscodeMock;
    }
    return originalRequire.apply(this, arguments as any);
};

function getAllFiles(dirPath: string, extension: string, arrayOfFiles: string[] = []): string[] {
    const files = fs.readdirSync(dirPath);

    files.forEach(file => {
        const filePath = path.join(dirPath, file);
        if (fs.statSync(filePath).isDirectory()) {
            arrayOfFiles = getAllFiles(filePath, extension, arrayOfFiles);
        } else if (file.endsWith(extension)) {
            arrayOfFiles.push(filePath);
        }
    });

    return arrayOfFiles;
}

export async function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'bdd',
        color: true,
        timeout: 10000,
    });

    const testsRoot = path.resolve(__dirname);

    try {
        // Find all test files
        const files = getAllFiles(testsRoot, '.test.js');

        // Add files to the test suite
        files.forEach((f: string) => mocha.addFile(f));

        // Run the mocha test
        return new Promise<void>((resolve, reject) => {
            mocha.run(failures => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    resolve();
                }
            });
        });
    } catch (err) {
        console.error('Error loading test files:', err);
        throw err;
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    run().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
