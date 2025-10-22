#!/usr/bin/env node

/**
 * Cross-platform script to copy HTML templates from src to out directory
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'templates');
const outDir = path.join(__dirname, '..', 'out', 'templates');

// Create output directory if it doesn't exist
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
    console.log('Created directory:', outDir);
}

// Copy all HTML files
try {
    const files = fs.readdirSync(srcDir).filter(file => file.endsWith('.html'));

    files.forEach(file => {
        const srcFile = path.join(srcDir, file);
        const outFile = path.join(outDir, file);
        fs.copyFileSync(srcFile, outFile);
        console.log('Copied:', file);
    });

    console.log(`✓ Successfully copied ${files.length} template(s)`);
} catch (error) {
    console.error('Error copying templates:', error.message);
    process.exit(1);
}
