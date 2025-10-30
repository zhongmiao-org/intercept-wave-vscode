#!/usr/bin/env node
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

async function main() {
  const outDir = path.join(__dirname, '..', 'dist', 'webview');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  await esbuild.build({
    entryPoints: [path.join(__dirname, '..', 'webview', 'src', 'index.tsx')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2020'],
    outfile: path.join(outDir, 'app.js'),
    sourcemap: true,
    logLevel: 'silent',
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    jsx: 'automatic',
    jsxImportSource: 'react',
    external: [],
  });
  console.log('✓ Webview app built: dist/webview/app.js');
}

main().catch(err => {
  console.error('Error building webview:', err && err.message ? err.message : err);
  process.exit(1);
});

