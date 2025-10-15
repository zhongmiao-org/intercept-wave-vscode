import * as vscode from 'vscode';
import { MockServerManager } from './mockServer';
import { ConfigManager } from './configManager';

export class SidebarProvider implements vscode.WebviewViewProvider {
    constructor(
        private readonly extensionUri: vscode.Uri,
        private mockServerManager: MockServerManager,
        private configManager: ConfigManager
    ) {
        console.log('[SidebarProvider] Constructor called');
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        console.log('[SidebarProvider] resolveWebviewView called');

        try {
            webviewView.webview.options = {
                enableScripts: true,
                localResourceRoots: [this.extensionUri]
            };
            console.log('[SidebarProvider] Webview options set');

            webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
            console.log('[SidebarProvider] Webview HTML set');

            webviewView.webview.onDidReceiveMessage(async data => {
                switch (data.type) {
                    case 'startServer':
                        try {
                            const url = await this.mockServerManager.start();
                            vscode.window.showInformationMessage(`Server started: ${url}`);
                            webviewView.webview.postMessage({ type: 'serverStarted', url });
                        } catch (error: any) {
                            vscode.window.showErrorMessage(`Failed to start server: ${error.message}`);
                        }
                        break;
                    case 'stopServer':
                        try {
                            await this.mockServerManager.stop();
                            vscode.window.showInformationMessage('Server stopped');
                            webviewView.webview.postMessage({ type: 'serverStopped' });
                        } catch (error: any) {
                            vscode.window.showErrorMessage(`Failed to stop server: ${error.message}`);
                        }
                        break;
                    case 'openConfig':
                        vscode.commands.executeCommand('interceptWave.configure');
                        break;
                    case 'addMock':
                        try {
                            await this.configManager.addMockApi(data.data);
                            const config = this.configManager.getConfig();
                            webviewView.webview.postMessage({ type: 'mockListUpdated', mocks: config.mockApis });
                            vscode.window.showInformationMessage('Mock API added successfully');
                        } catch (error: any) {
                            vscode.window.showErrorMessage(`Failed to add mock API: ${error.message}`);
                        }
                        break;
                    case 'updateMock':
                        try {
                            await this.configManager.updateMockApi(data.index, data.data);
                            const config = this.configManager.getConfig();
                            webviewView.webview.postMessage({ type: 'mockListUpdated', mocks: config.mockApis });
                            vscode.window.showInformationMessage('Mock API updated successfully');
                        } catch (error: any) {
                            vscode.window.showErrorMessage(`Failed to update mock API: ${error.message}`);
                        }
                        break;
                    case 'deleteMock':
                        try {
                            await this.configManager.removeMockApi(data.index);
                            const config = this.configManager.getConfig();
                            webviewView.webview.postMessage({ type: 'mockListUpdated', mocks: config.mockApis });
                            vscode.window.showInformationMessage('Mock API deleted successfully');
                        } catch (error: any) {
                            vscode.window.showErrorMessage(`Failed to delete mock API: ${error.message}`);
                        }
                        break;
                    case 'toggleMock':
                        try {
                            const config = this.configManager.getConfig();
                            config.mockApis[data.index].enabled = !config.mockApis[data.index].enabled;
                            await this.configManager.saveConfig(config);
                            webviewView.webview.postMessage({ type: 'mockListUpdated', mocks: config.mockApis });
                        } catch (error: any) {
                            vscode.window.showErrorMessage(`Failed to toggle mock API: ${error.message}`);
                        }
                        break;
                    case 'getMock':
                        try {
                            const config = this.configManager.getConfig();
                            webviewView.webview.postMessage({ type: 'editMock', data: config.mockApis[data.index] });
                        } catch (error: any) {
                            vscode.window.showErrorMessage(`Failed to get mock API: ${error.message}`);
                        }
                        break;
                }
            });
        } catch (error: any) {
            console.error('[SidebarProvider] Error in resolveWebviewView:', error);
            vscode.window.showErrorMessage(`Failed to load Intercept Wave view: ${error.message}`);
        }
    }

    private getHtmlForWebview(webview: vscode.Webview) {
        const config = this.configManager.getConfig();
        const isRunning = this.mockServerManager.getStatus();

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Intercept Wave</title>
                <style>
                    body {
                        padding: 10px;
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        color: var(--vscode-foreground);
                    }
                    .header {
                        margin-bottom: 15px;
                    }
                    .status {
                        padding: 8px;
                        margin-bottom: 10px;
                        border-radius: 3px;
                        background: var(--vscode-editor-background);
                        font-size: 12px;
                    }
                    .status.running {
                        color: #4caf50;
                    }
                    .status.stopped {
                        color: #9e9e9e;
                    }
                    .url {
                        color: #2196F3;
                        word-break: break-all;
                        font-size: 11px;
                        margin-top: 5px;
                    }
                    button {
                        width: 100%;
                        padding: 8px;
                        margin-bottom: 8px;
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        cursor: pointer;
                        border-radius: 3px;
                        font-size: 12px;
                    }
                    button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                    button:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }
                    button.secondary {
                        background: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                    }
                    button.secondary:hover {
                        background: var(--vscode-button-secondaryHoverBackground);
                    }
                    .section {
                        margin-top: 20px;
                    }
                    .section-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 10px;
                    }
                    .section-header h3 {
                        margin: 0;
                        font-size: 13px;
                    }
                    .add-btn {
                        padding: 4px 8px;
                        font-size: 11px;
                        width: auto;
                        margin: 0;
                    }
                    .mock-list {
                        max-height: 400px;
                        overflow-y: auto;
                    }
                    .mock-item {
                        padding: 8px;
                        margin-bottom: 8px;
                        background: var(--vscode-editor-background);
                        border-radius: 3px;
                        border-left: 3px solid #4caf50;
                    }
                    .mock-item.disabled {
                        opacity: 0.6;
                        border-left-color: #9e9e9e;
                    }
                    .mock-item-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 5px;
                    }
                    .mock-method {
                        display: inline-block;
                        padding: 2px 6px;
                        background: #2196F3;
                        color: white;
                        border-radius: 2px;
                        font-size: 10px;
                        font-weight: bold;
                        margin-right: 5px;
                    }
                    .mock-method.post { background: #4caf50; }
                    .mock-method.put { background: #ff9800; }
                    .mock-method.delete { background: #f44336; }
                    .mock-path {
                        font-size: 11px;
                        word-break: break-all;
                    }
                    .mock-actions {
                        display: flex;
                        gap: 5px;
                    }
                    .mock-actions button {
                        width: auto;
                        padding: 2px 8px;
                        margin: 0;
                        font-size: 10px;
                    }
                    .empty-state {
                        text-align: center;
                        padding: 20px;
                        color: var(--vscode-descriptionForeground);
                        font-size: 12px;
                    }
                    .form-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: var(--vscode-editor-background);
                        z-index: 1000;
                        overflow-y: auto;
                        padding: 10px;
                        display: none;
                    }
                    .form-overlay.show {
                        display: block;
                    }
                    .form-group {
                        margin-bottom: 12px;
                    }
                    .form-group label {
                        display: block;
                        margin-bottom: 4px;
                        font-size: 11px;
                        font-weight: bold;
                    }
                    .form-group input,
                    .form-group select,
                    .form-group textarea {
                        width: 100%;
                        padding: 6px;
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 2px;
                        font-size: 12px;
                        box-sizing: border-box;
                    }
                    .form-group textarea {
                        min-height: 80px;
                        font-family: monospace;
                    }
                    .form-actions {
                        display: flex;
                        gap: 8px;
                        margin-top: 15px;
                    }
                    .form-actions button {
                        flex: 1;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2 style="margin: 0 0 10px 0; font-size: 14px;">Intercept Wave</h2>
                    <div class="status ${isRunning ? 'running' : 'stopped'}" id="status">
                        ${isRunning ? '● Running' : '○ Stopped'}
                    </div>
                    ${isRunning ? `<div class="url" id="serverUrl">http://localhost:${config.port}</div>` : ''}
                </div>

                <button id="startBtn" ${isRunning ? 'disabled' : ''}>Start Server</button>
                <button id="stopBtn" ${!isRunning ? 'disabled' : ''}>Stop Server</button>
                <button id="configBtn" class="secondary">Settings</button>

                <div class="section">
                    <div class="section-header">
                        <h3>Mock APIs (${config.mockApis.filter((a: any) => a.enabled).length}/${config.mockApis.length})</h3>
                        <button class="add-btn" id="addMockBtn">+ Add</button>
                    </div>
                    <div class="mock-list" id="mockList">
                        ${this.renderMockList(config.mockApis)}
                    </div>
                </div>

                <!-- Mock API Form -->
                <div class="form-overlay" id="mockForm">
                    <h3 style="margin-top: 0; font-size: 13px;" id="formTitle">Add Mock API</h3>
                    <div class="form-group">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" id="mockEnabled" checked style="margin-right: 8px; width: auto; cursor: pointer;">
                            <span>Enabled</span>
                        </label>
                    </div>
                    <div class="form-group">
                        <label>Method</label>
                        <select id="mockMethod">
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                            <option value="PATCH">PATCH</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Path (e.g., /api/users or /api/users/:id)</label>
                        <input type="text" id="mockPath" placeholder="/api/users">
                    </div>
                    <div class="form-group">
                        <label>Status Code</label>
                        <input type="number" id="mockStatus" value="200">
                    </div>
                    <div class="form-group">
                        <label style="margin-bottom: 8px;">
                            Response Body (JSON)
                            <span style="float: right; font-weight: normal;">
                                <button type="button" id="formatJsonBtn" style="width: auto; padding: 2px 8px; margin: 0 5px 0 0; font-size: 11px;">Format</button>
                                <button type="button" id="validateJsonBtn" style="width: auto; padding: 2px 8px; margin: 0; font-size: 11px;">Validate</button>
                            </span>
                        </label>
                        <textarea id="mockResponse" placeholder='{"message": "Success"}'></textarea>
                        <div id="jsonError" style="display: none; color: #f44336; font-size: 11px; margin-top: 4px;"></div>
                        <div id="jsonSuccess" style="display: none; color: #4caf50; font-size: 11px; margin-top: 4px;"></div>
                    </div>
                    <div class="form-group">
                        <label>Delay (ms)</label>
                        <input type="number" id="mockDelay" value="0">
                    </div>
                    <div class="form-actions">
                        <button id="saveBtn">Save</button>
                        <button id="cancelBtn" class="secondary">Cancel</button>
                    </div>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    let editingIndex = -1;

                    document.getElementById('startBtn').addEventListener('click', () => {
                        vscode.postMessage({ type: 'startServer' });
                    });

                    document.getElementById('stopBtn').addEventListener('click', () => {
                        vscode.postMessage({ type: 'stopServer' });
                    });

                    document.getElementById('configBtn').addEventListener('click', () => {
                        vscode.postMessage({ type: 'openConfig' });
                    });

                    document.getElementById('addMockBtn').addEventListener('click', () => {
                        editingIndex = -1;
                        document.getElementById('formTitle').textContent = 'Add Mock API';
                        clearForm();
                        document.getElementById('mockForm').classList.add('show');
                    });

                    document.getElementById('saveBtn').addEventListener('click', () => {
                        const mockApi = {
                            enabled: document.getElementById('mockEnabled').checked,
                            method: document.getElementById('mockMethod').value,
                            path: document.getElementById('mockPath').value,
                            statusCode: parseInt(document.getElementById('mockStatus').value),
                            mockData: document.getElementById('mockResponse').value,  // Store as string (JetBrains compatible)
                            useCookie: false,
                            delay: parseInt(document.getElementById('mockDelay').value)
                        };

                        if (editingIndex >= 0) {
                            vscode.postMessage({ type: 'updateMock', index: editingIndex, data: mockApi });
                        } else {
                            vscode.postMessage({ type: 'addMock', data: mockApi });
                        }
                        document.getElementById('mockForm').classList.remove('show');
                    });

                    document.getElementById('cancelBtn').addEventListener('click', () => {
                        document.getElementById('mockForm').classList.remove('show');
                    });

                    // Format JSON button
                    document.getElementById('formatJsonBtn').addEventListener('click', () => {
                        const textarea = document.getElementById('mockResponse');
                        const errorDiv = document.getElementById('jsonError');
                        const successDiv = document.getElementById('jsonSuccess');

                        try {
                            const parsed = JSON.parse(textarea.value);
                            textarea.value = JSON.stringify(parsed, null, 2);
                            errorDiv.style.display = 'none';
                            successDiv.textContent = '✓ JSON formatted successfully';
                            successDiv.style.display = 'block';
                            setTimeout(() => { successDiv.style.display = 'none'; }, 3000);
                        } catch (e) {
                            successDiv.style.display = 'none';
                            errorDiv.textContent = '✗ Invalid JSON: ' + e.message;
                            errorDiv.style.display = 'block';
                        }
                    });

                    // Validate JSON button
                    document.getElementById('validateJsonBtn').addEventListener('click', () => {
                        const textarea = document.getElementById('mockResponse');
                        const errorDiv = document.getElementById('jsonError');
                        const successDiv = document.getElementById('jsonSuccess');

                        try {
                            JSON.parse(textarea.value);
                            errorDiv.style.display = 'none';
                            successDiv.textContent = '✓ JSON is valid';
                            successDiv.style.display = 'block';
                            setTimeout(() => { successDiv.style.display = 'none'; }, 3000);
                        } catch (e) {
                            successDiv.style.display = 'none';
                            errorDiv.textContent = '✗ Invalid JSON: ' + e.message;
                            errorDiv.style.display = 'block';
                        }
                    });

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'serverStarted':
                                updateServerStatus(true, message.url);
                                break;
                            case 'serverStopped':
                                updateServerStatus(false);
                                break;
                            case 'mockListUpdated':
                                updateMockList(message.mocks);
                                break;
                        }
                    });

                    function updateServerStatus(running, url) {
                        const statusEl = document.getElementById('status');
                        const startBtn = document.getElementById('startBtn');
                        const stopBtn = document.getElementById('stopBtn');

                        if (running) {
                            statusEl.textContent = '● Running';
                            statusEl.className = 'status running';
                            startBtn.disabled = true;
                            stopBtn.disabled = false;
                            if (url) {
                                statusEl.insertAdjacentHTML('afterend', \`<div class="url" id="serverUrl">\${url}</div>\`);
                            }
                        } else {
                            statusEl.textContent = '○ Stopped';
                            statusEl.className = 'status stopped';
                            startBtn.disabled = false;
                            stopBtn.disabled = true;
                            const urlEl = document.getElementById('serverUrl');
                            if (urlEl) urlEl.remove();
                        }
                    }

                    function updateMockList(mocks) {
                        const listEl = document.getElementById('mockList');
                        listEl.innerHTML = renderMockList(mocks);
                        attachMockListeners();
                    }

                    function renderMockList(mocks) {
                        if (!mocks || mocks.length === 0) {
                            return '<div class="empty-state">No mock APIs configured.<br>Click "+ Add" to create one.</div>';
                        }
                        return mocks.map((mock, index) => \`
                            <div class="mock-item \${mock.enabled ? '' : 'disabled'}">
                                <div class="mock-item-header">
                                    <div>
                                        <span class="mock-method \${mock.method.toLowerCase()}">\${mock.method}</span>
                                        <span class="mock-path">\${mock.path}</span>
                                    </div>
                                    <div class="mock-actions">
                                        <button onclick="toggleMock(\${index})">\${mock.enabled ? 'Disable' : 'Enable'}</button>
                                        <button onclick="editMock(\${index})">Edit</button>
                                        <button onclick="deleteMock(\${index})">Delete</button>
                                    </div>
                                </div>
                            </div>
                        \`).join('');
                    }

                    function toggleMock(index) {
                        vscode.postMessage({ type: 'toggleMock', index });
                    }

                    window.editMock = function(index) {
                        editingIndex = index;
                        vscode.postMessage({ type: 'getMock', index });
                    };

                    window.deleteMock = function(index) {
                        if (confirm('Delete this mock API?')) {
                            vscode.postMessage({ type: 'deleteMock', index });
                        }
                    };

                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.type === 'editMock') {
                            const mock = message.data;
                            document.getElementById('formTitle').textContent = 'Edit Mock API';
                            document.getElementById('mockEnabled').checked = mock.enabled;
                            document.getElementById('mockMethod').value = mock.method;
                            document.getElementById('mockPath').value = mock.path;
                            document.getElementById('mockStatus').value = mock.statusCode;
                            // mockData is already a string, format it if it's valid JSON
                            try {
                                const parsed = JSON.parse(mock.mockData);
                                document.getElementById('mockResponse').value = JSON.stringify(parsed, null, 2);
                            } catch (e) {
                                document.getElementById('mockResponse').value = mock.mockData;
                            }
                            document.getElementById('mockDelay').value = mock.delay || 0;
                            document.getElementById('mockForm').classList.add('show');
                        }
                    });

                    function clearForm() {
                        document.getElementById('mockEnabled').checked = true;
                        document.getElementById('mockMethod').value = 'GET';
                        document.getElementById('mockPath').value = '';
                        document.getElementById('mockStatus').value = '200';
                        document.getElementById('mockResponse').value = '';
                        document.getElementById('mockDelay').value = '0';
                    }

                    function parseJSON(str) {
                        try {
                            return JSON.parse(str);
                        } catch (e) {
                            return str;
                        }
                    }

                    function attachMockListeners() {
                        // Listeners are attached via onclick attributes
                    }
                </script>
            </body>
            </html>
        `;
    }

    private renderMockList(mocks: any[]): string {
        if (!mocks || mocks.length === 0) {
            return '<div class="empty-state">No mock APIs configured.<br>Click "+ Add" to create one.</div>';
        }
        return mocks.map((mock, index) => `
            <div class="mock-item ${mock.enabled ? '' : 'disabled'}">
                <div class="mock-item-header">
                    <div>
                        <span class="mock-method ${mock.method.toLowerCase()}">${mock.method}</span>
                        <span class="mock-path">${mock.path}</span>
                    </div>
                    <div class="mock-actions">
                        <button onclick="toggleMock(${index})">${mock.enabled ? 'Disable' : 'Enable'}</button>
                        <button onclick="editMock(${index})">Edit</button>
                        <button onclick="deleteMock(${index})">Delete</button>
                    </div>
                </div>
            </div>
        `).join('');
    }
}