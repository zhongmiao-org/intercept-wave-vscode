export function buildReactWebviewHtml(params: {
    nonce: string;
    codiconsFontUri: string;
    appJsUri: string;
    initialDataJson: string; // Pass stringified JSON to avoid double stringify
}): string {
    const { nonce, codiconsFontUri, appJsUri, initialDataJson } = params;
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: https: data:; style-src 'unsafe-inline' vscode-resource:; font-src vscode-resource:; script-src 'nonce-${nonce}' vscode-resource:;" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Intercept Wave</title>
    <style>
      @font-face { font-family: 'codicon'; src: url('${codiconsFontUri}') format('truetype'); font-weight: normal; font-style: normal; }
      .codicon { font: normal normal normal 16px/1 codicon; }
      html, body, #root { height: 100%; }
      body { padding: 0; margin: 0; }
      button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 1px solid var(--vscode-button-border, transparent); border-radius: 4px; padding: 4px 10px; cursor: pointer; }
      button:hover { background: var(--vscode-button-hoverBackground); }
      input, select, textarea { background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; padding: 4px 8px; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}">window.__IW_INITIAL_STATE__ = ${initialDataJson};</script>
    <script nonce="${nonce}" type="module" src="${appJsUri}"></script>
  </body>
</html>`;
}

