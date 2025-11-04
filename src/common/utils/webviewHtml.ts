export function buildReactWebviewHtml(params: {
    nonce: string;
    codiconsFontUri: string;
    codiconsCssUri?: string;
    appJsUri: string;
    initialDataJson: string; // Pass stringified JSON to avoid double stringify
    cspSource?: string; // Modern VS Code: webview.cspSource
}): string {
    const { nonce, codiconsFontUri, codiconsCssUri, appJsUri, initialDataJson, cspSource } = params;
    const csp = cspSource ?? '';
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${csp} https: data:; style-src 'unsafe-inline' ${csp}; font-src ${csp}; script-src 'nonce-${nonce}' ${csp}; connect-src 'none';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Intercept Wave</title>
    ${codiconsCssUri ? `<link rel="stylesheet" href="${codiconsCssUri}">` : ''}
    <style>
      @font-face { font-family: 'codicon'; src: url('${codiconsFontUri}') format('truetype'); font-weight: normal; font-style: normal; }
      .codicon { font: normal normal normal 1em/1 codicon; display: inline-block; vertical-align: middle; }
      html, body, #root { height: 100%; }
      body { padding: 0; margin: 0; }
      button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 1px solid var(--vscode-button-border, transparent); border-radius: 4px; padding: 3px 8px; cursor: pointer; font-size: 12px; line-height: 1.2; white-space: nowrap; min-width: 88px; display: inline-flex; align-items: center; gap: 6px; }
      button:hover { background: var(--vscode-button-hoverBackground); }
      button:disabled { opacity: 0.6; background: var(--vscode-disabledBackground, var(--vscode-button-background)); color: var(--vscode-disabledForeground, #888); cursor: not-allowed; filter: grayscale(0.4); }
      button:disabled:hover { background: var(--vscode-disabledBackground, var(--vscode-button-background)); }
      input, select, textarea { background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; padding: 4px 8px; }
      @media (max-width: 640px) {
        button { font-size: 11.5px; padding: 2px 6px; min-width: 72px; }
      }
      @media (max-width: 480px) {
        button { font-size: 11px; padding: 2px 5px; min-width: 64px; }
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}">window.__IW_INITIAL_STATE__ = ${initialDataJson};</script>
    <script nonce="${nonce}">
      (function(){
        try {
          var has = (typeof acquireVsCodeApi === 'function');
          window.__IW_HAS_VSCODE__ = has;
          if (has) {
            try { window.__IW_VSCODE__ = acquireVsCodeApi(); console.debug('[IW-BOOT] acquireVsCodeApi ok'); } catch (e) { console.error('[IW-BOOT] acquireVsCodeApi() threw', e); }
          } else {
            try { console.warn('[IW-BOOT] acquireVsCodeApi missing'); } catch {}
          }
        } catch (e) {
          try { console.error('[IW-BOOT] check error', e); } catch {}
        }
      })();
    </script>
    <script nonce="${nonce}" src="${appJsUri}"></script>
  </body>
</html>`;
}
