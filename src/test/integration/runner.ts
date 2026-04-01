import * as path from 'path';
import * as fs from 'fs';
import Mocha = require('mocha');
import * as Module from 'module';

const originalRequire = Module.prototype.require;
(Module.prototype.require as any) = function (this: any, id: string) {
    if (id === 'vscode') {
        return {
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
            },
            Uri: {
                file: (p: string) => ({ fsPath: p, scheme: 'file', path: p }),
                parse: (p: string) => ({ fsPath: p, scheme: 'file', path: p }),
            },
            ExtensionMode: {
                Production: 1,
                Development: 2,
                Test: 3,
            },
        };
    }
    return originalRequire.apply(this, arguments as any);
};

function getAllFiles(dirPath: string, extension: string, arrayOfFiles: string[] = []): string[] {
    const files = fs.readdirSync(dirPath);

    files.forEach(file => {
        const filePath = path.join(dirPath, file);
        if (fs.statSync(filePath).isDirectory()) {
            if (file === 'suite') {
                return;
            }
            arrayOfFiles = getAllFiles(filePath, extension, arrayOfFiles);
        } else if (file.endsWith(extension)) {
            arrayOfFiles.push(filePath);
        }
    });

    return arrayOfFiles;
}

export async function run(): Promise<void> {
    const mocha = new Mocha({
        ui: 'bdd',
        color: true,
        timeout: 20000,
    });
    (mocha as any).exit = true;

    const testsRoot = path.resolve(__dirname);

    try {
        const files = getAllFiles(testsRoot, '.test.js');
        files.forEach((f: string) => mocha.addFile(f));

        return new Promise<void>((resolve, reject) => {
            mocha.run(failures => {
                if (failures > 0) {
                    reject(new Error(`${failures} integration tests failed.`));
                } else {
                    resolve();
                }
            });
        });
    } catch (err) {
        console.error('Error loading integration test files:', err);
        throw err;
    }
}

if (require.main === module) {
    run().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
