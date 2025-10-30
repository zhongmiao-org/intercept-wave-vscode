#!/usr/bin/env node
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

async function main() {
  const outDir = path.join(__dirname, '..', 'dist', 'webview');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const ctx = await esbuild.context({
    entryPoints: [path.join(__dirname, '..', 'webview', 'src', 'index.tsx')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2020'],
    outfile: path.join(outDir, 'app.js'),
    sourcemap: true,
    logLevel: 'info',
    define: { 'process.env.NODE_ENV': '"development"' },
    jsx: 'automatic',
    jsxImportSource: 'react',
  });
  await ctx.watch();
  console.log('▶ webview: watching dist/webview/app.js ...');
}

main().catch(err => {
  console.error('Error watching webview:', err && err.message ? err.message : err);
  process.exit(1);
});

