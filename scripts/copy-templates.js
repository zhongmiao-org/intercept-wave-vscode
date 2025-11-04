#!/usr/bin/env node

/**
 * Cross-platform script to copy HTML templates and webview dependencies
 * from src to out and dist directories
 */

const fs = require('fs');
const path = require('path');

const srcTemplatesDir = path.join(__dirname, '..', 'src', 'templates');
const outTemplatesDir = path.join(__dirname, '..', 'out', 'templates');
const distTemplatesDir = path.join(__dirname, '..', 'dist', 'templates');
const distWebviewDir = path.join(__dirname, '..', 'dist', 'webview');

// Create output directories if they don't exist
[outTemplatesDir, distTemplatesDir, distWebviewDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

try {
    let templateFiles = [];
    if (fs.existsSync(srcTemplatesDir)) {
        // Copy HTML templates to both out and dist
        templateFiles = fs
            .readdirSync(srcTemplatesDir)
            .filter(file => file.endsWith('.html'));

        templateFiles.forEach(file => {
            const srcFile = path.join(srcTemplatesDir, file);

            // Copy to out directory (for tests)
            const outFile = path.join(outTemplatesDir, file);
            fs.copyFileSync(srcFile, outFile);

            // Copy to dist directory (for bundled extension)
            const distFile = path.join(distTemplatesDir, file);
            fs.copyFileSync(srcFile, distFile);
        });
    }

    console.log(`✓ Copied ${templateFiles.length} template(s) to out/ and dist/`);

    // Copy webview dependencies to dist/webview
    const webviewDeps = [
        {
            src: path.join(
                __dirname,
                '..',
                'node_modules',
                '@vscode-elements',
                'elements',
                'dist',
                'bundled.js'
            ),
            dest: path.join(distWebviewDir, 'bundled.js'),
            name: '@vscode-elements/bundled.js',
        },
        {
            src: path.join(
                __dirname,
                '..',
                'node_modules',
                '@vscode',
                'codicons',
                'dist',
                'codicon.ttf'
            ),
            dest: path.join(distWebviewDir, 'codicon.ttf'),
            name: '@vscode/codicons/codicon.ttf',
        },
        {
            src: path.join(
                __dirname,
                '..',
                'node_modules',
                '@vscode',
                'codicons',
                'dist',
                'codicon.css'
            ),
            dest: path.join(distWebviewDir, 'codicon.css'),
            name: '@vscode/codicons/codicon.css',
        },
    ];

    webviewDeps.forEach(({ src, dest, name }) => {
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            console.log(`✓ Copied ${name}`);
        } else {
            console.warn(`⚠ Warning: ${name} not found at ${src}`);
        }
    });

    console.log('✓ All resources copied successfully');
} catch (error) {
    console.error('Error copying resources:', error.message);
    process.exit(1);
}
