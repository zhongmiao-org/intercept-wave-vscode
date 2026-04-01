import * as path from 'path';
import * as fs from 'fs';
import Mocha from 'mocha';

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

export function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'bdd',
        color: true,
        timeout: 10000,
    });

    const testsRoot = path.resolve(__dirname, '.');

    return new Promise((resolve, reject) => {
        try {
            const files = getAllFiles(testsRoot, '.test.js');
            files.forEach(f => mocha.addFile(f));

            mocha.run(failures => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    resolve();
                }
            });
        } catch (err) {
            console.error(err);
                reject(err);
        }
    });
}
