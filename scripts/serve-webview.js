#!/usr/bin/env node
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

async function main() {
  const devDir = path.join(__dirname, '..', 'webview', 'dev');
  if (!fs.existsSync(devDir)) fs.mkdirSync(devDir, { recursive: true });

  const ctx = await esbuild.context({
    entryPoints: [path.join(__dirname, '..', 'webview', 'src', 'index.tsx')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2020'],
    outfile: path.join(devDir, 'app.js'),
    sourcemap: true,
    logLevel: 'info',
    define: { 'process.env.NODE_ENV': '"development"' },
    jsx: 'automatic',
    jsxImportSource: 'react',
  });
  await ctx.watch();

  const server = await ctx.serve({ servedir: devDir, port: 5173, host: '127.0.0.1' });
  console.log(`▶ webview dev server running at http://${server.host}:${server.port}`);
  console.log(`   Open /index.html (uses stubbed VS Code API)`);
}

main().catch(err => {
  console.error('Error serving webview:', err && err.message ? err.message : err);
  process.exit(1);
});

