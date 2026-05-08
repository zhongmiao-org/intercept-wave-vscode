import { afterEach, describe, it } from 'mocha';
import { expect } from 'chai';
import * as fs from 'fs';
import * as https from 'https';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import { createHttpsServerOptions } from '../../common/server';
import {
    generateLocalPkcs12Certificate,
    LOCAL_CERTIFICATE_ALIAS,
    LOCAL_CERTIFICATE_PASSWORD,
    LOCAL_CERTIFICATE_RELATIVE_PATH,
} from '../../common/utils';

describe('localCertificateUtils', () => {
    let workspaceRoot: string | undefined;

    afterEach(() => {
        if (workspaceRoot && fs.existsSync(workspaceRoot)) {
            fs.rmSync(workspaceRoot, { recursive: true, force: true });
        }
        workspaceRoot = undefined;
    });

    async function getFreePort(): Promise<number> {
        return await new Promise<number>((resolve, reject) => {
            const server = net.createServer();
            server.listen(0, () => {
                const address = server.address();
                if (!address || typeof address === 'string') {
                    server.close(() => reject(new Error('Failed to allocate free port')));
                    return;
                }
                const port = address.port;
                server.close(error => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(port);
                });
            });
            server.on('error', reject);
        });
    }

    it('generates a project-relative PKCS#12 file that Node HTTPS can load', async () => {
        workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'iw-cert-'));
        const result = generateLocalPkcs12Certificate(workspaceRoot, LOCAL_CERTIFICATE_RELATIVE_PATH, LOCAL_CERTIFICATE_PASSWORD, false);

        expect(result.relativePath).to.equal(LOCAL_CERTIFICATE_RELATIVE_PATH);
        expect(result.password).to.equal(LOCAL_CERTIFICATE_PASSWORD);
        expect(fs.existsSync(result.absolutePath)).to.equal(true);
        expect(fs.statSync(result.absolutePath).size).to.be.greaterThan(0);

        const server = https.createServer(
            createHttpsServerOptions({
                id: 'https',
                name: 'HTTPS',
                port: 0,
                enabled: true,
                httpsEnabled: true,
                httpsKeystorePath: result.relativePath,
                httpsKeystorePassword: result.password,
            } as any, workspaceRoot),
            (_req, res) => {
                res.writeHead(200);
                res.end('ok');
            }
        );
        const port = await getFreePort();
        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(port, resolve);
        });
        await new Promise<void>((resolve, reject) => {
            const req = https.request(
                {
                    hostname: 'localhost',
                    port,
                    path: '/',
                    rejectUnauthorized: false,
                },
                res => {
                    res.resume();
                    res.on('end', () => {
                        expect(res.statusCode).to.equal(200);
                        resolve();
                    });
                }
            );
            req.on('error', reject);
            req.end();
        });
        await new Promise<void>(resolve => server.close(() => resolve()));
    });

    it('rejects short passwords and existing files without overwrite', () => {
        workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'iw-cert-'));
        expect(() => generateLocalPkcs12Certificate(workspaceRoot!, LOCAL_CERTIFICATE_RELATIVE_PATH, 'short', false)).to.throw('at least 6 characters');

        const first = generateLocalPkcs12Certificate(workspaceRoot, LOCAL_CERTIFICATE_RELATIVE_PATH, LOCAL_CERTIFICATE_PASSWORD, false);
        expect(first.relativePath).to.equal(LOCAL_CERTIFICATE_RELATIVE_PATH);
        expect(() => generateLocalPkcs12Certificate(workspaceRoot!, LOCAL_CERTIFICATE_RELATIVE_PATH, LOCAL_CERTIFICATE_PASSWORD, false)).to.throw('already exists');
    });

    it('uses the shared local certificate alias constant', () => {
        expect(LOCAL_CERTIFICATE_ALIAS).to.equal('intercept-wave-local');
    });
});
