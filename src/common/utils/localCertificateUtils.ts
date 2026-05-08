import * as fs from 'fs';
import * as path from 'path';
import * as forge from 'node-forge';

export const LOCAL_CERTIFICATE_ALIAS = 'intercept-wave-local';
export const LOCAL_CERTIFICATE_PASSWORD = 'changeit';
export const LOCAL_CERTIFICATE_RELATIVE_PATH = 'certs/intercept-wave-local.p12';

export interface LocalCertificateResult {
    absolutePath: string;
    relativePath: string;
    password: string;
}

export function generateLocalPkcs12Certificate(
    workspaceRoot: string,
    relativeOrAbsolutePath: string = LOCAL_CERTIFICATE_RELATIVE_PATH,
    password: string = LOCAL_CERTIFICATE_PASSWORD,
    overwrite: boolean = false
): LocalCertificateResult {
    const normalizedPassword = password || LOCAL_CERTIFICATE_PASSWORD;
    if (normalizedPassword.length < 6) {
        throw new Error('PKCS#12 password must be at least 6 characters');
    }

    const outputPath = resolveLocalCertificatePath(workspaceRoot, relativeOrAbsolutePath);
    if (fs.existsSync(outputPath) && !overwrite) {
        throw new Error(`Certificate file already exists: ${outputPath}`);
    }
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const keys = forge.pki.rsa.generateKeyPair({ bits: 2048, workers: 2 });
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = createSerialNumber();
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date(cert.validity.notBefore.getTime() + 825 * 24 * 60 * 60 * 1000);

    const attrs = [
        { name: 'commonName', value: 'localhost' },
        { name: 'organizationalUnitName', value: 'Intercept Wave' },
        { name: 'organizationName', value: 'Local Development' },
        { name: 'localityName', value: 'Local' },
        { name: 'stateOrProvinceName', value: 'Local' },
        { name: 'countryName', value: 'US' },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([
        { name: 'basicConstraints', cA: false },
        { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
        { name: 'extKeyUsage', serverAuth: true },
        {
            name: 'subjectAltName',
            altNames: [
                { type: 2, value: 'localhost' },
                { type: 7, ip: '127.0.0.1' },
            ],
        },
    ]);
    cert.sign(keys.privateKey, forge.md.sha256.create());

    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, cert, normalizedPassword, {
        algorithm: '3des',
        friendlyName: LOCAL_CERTIFICATE_ALIAS,
    });
    const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
    fs.writeFileSync(outputPath, Buffer.from(p12Der, 'binary'));

    return {
        absolutePath: outputPath,
        relativePath: toStoredProjectPath(outputPath, workspaceRoot),
        password: normalizedPassword,
    };
}

export function resolveLocalCertificatePath(workspaceRoot: string, relativeOrAbsolutePath: string): string {
    const configured = relativeOrAbsolutePath.trim() || LOCAL_CERTIFICATE_RELATIVE_PATH;
    return path.resolve(path.isAbsolute(configured) ? configured : path.join(workspaceRoot, configured));
}

function toStoredProjectPath(selectedPath: string, workspaceRoot: string): string {
    const relative = path.relative(workspaceRoot, selectedPath);
    if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
        return relative.split(path.sep).join('/');
    }
    if (relative === '') {
        return '.';
    }
    return selectedPath;
}

function createSerialNumber(): string {
    return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}
