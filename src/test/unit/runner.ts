import * as path from 'path';
import * as fs from 'fs';
import Mocha = require('mocha');
import * as Module from 'module';

// Mock vscode module before running tests
const originalRequire = Module.prototype.require;
(Module.prototype.require as any) = function (this: any, id: string) {
    if (id === 'vscode') {
        // Return a basic mock of vscode API
        return {
            workspace: {
                workspaceFolders: undefined,
                getConfiguration: () => ({
                    get: () => undefined,
                    update: () => Promise.resolve()
                })
            },
            env: {
                language: 'en'
            },
            window: {
                showInformationMessage: () => Promise.resolve(),
                showErrorMessage: () => Promise.resolve(),
                showWarningMessage: () => Promise.resolve()
            },
            Uri: {
                file: (p: string) => ({ fsPath: p, scheme: 'file', path: p }),
                parse: (p: string) => ({ fsPath: p, scheme: 'file', path: p })
            },
            ExtensionMode: {
                Production: 1,
                Development: 2,
                Test: 3
            }
        };
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
        timeout: 10000
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