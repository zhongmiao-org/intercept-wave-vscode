#!/usr/bin/env node

/**
 * Cross-platform script to copy HTML templates from src to out and dist directories
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'templates');
const outDir = path.join(__dirname, '..', 'out', 'templates');
const distDir = path.join(__dirname, '..', 'dist', 'templates');

// Create output directories if they don't exist
[outDir, distDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Copy all HTML files to both out and dist
try {
    const files = fs.readdirSync(srcDir).filter(file => file.endsWith('.html'));

    files.forEach(file => {
        const srcFile = path.join(srcDir, file);

        // Copy to out directory (for tests)
        const outFile = path.join(outDir, file);
        fs.copyFileSync(srcFile, outFile);

        // Copy to dist directory (for bundled extension)
        const distFile = path.join(distDir, file);
        fs.copyFileSync(srcFile, distFile);

        console.log('Copied:', file);
    });

    console.log(`✓ Successfully copied ${files.length} template(s) to out/ and dist/`);
} catch (error) {
    console.error('Error copying templates:', error.message);
    process.exit(1);
}
