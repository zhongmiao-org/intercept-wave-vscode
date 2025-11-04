<div align="center">
  <img src="resources/logo.png" alt="Intercept Wave Logo" width="128" height="128">

# Intercept Wave for VSCode

[![Version](https://vsmarketplacebadges.dev/version-short/Ark65.intercept-wave.svg)](https://marketplace.visualstudio.com/items?itemName=Ark65.intercept-wave)
[![Installs](https://vsmarketplacebadges.dev/installs-short/Ark65.intercept-wave.svg)](https://marketplace.visualstudio.com/items?itemName=Ark65.intercept-wave)
[![Downloads](https://vsmarketplacebadges.dev/downloads-short/Ark65.intercept-wave.svg)](https://marketplace.visualstudio.com/items?itemName=Ark65.intercept-wave)
[![Rating](https://vsmarketplacebadges.dev/rating-star/Ark65.intercept-wave.svg)](https://marketplace.visualstudio.com/items?itemName=Ark65.intercept-wave)
[![codecov](https://codecov.io/gh/zhongmiao-org/intercept-wave-vscode/branch/main/graph/badge.svg)](https://app.codecov.io/gh/zhongmiao-org/intercept-wave-vscode)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/zhongmiao-org/intercept-wave-vscode/blob/main/LICENSE)

English | [简体中文](./README_zh.md)

</div>

A powerful VSCode extension that combines the proxy and interception capabilities similar to **Nginx** and **Charles**, designed specifically for local development environments. It intelligently intercepts HTTP requests, either returning custom mock data or acting as a proxy server to forward real requests to the original server with full HTTP headers.

## Highlights

- 📑 **Tab-based Interface**: Manage multiple proxy configuration groups in separate tabs
- 🚀 **Multiple Proxy Groups**: Run multiple mock services simultaneously, each on its own port
- 🏗️ **Microservices Ready**: Perfect for microservices architecture (e.g., user service on port 8888, order service on port 8889)
- 🔄 **Quick Switching**: Easily switch and manage different service configurations via tabs
- 🎨 **Refreshed UI**: Compact buttons, responsive layout, codicon icons, clearer disabled states

## Features

### Smart Interception & Proxy

- 🎯 Configure intercept prefix (e.g., `/api`) to precisely target specific request paths
- 🔄 **With Mock Config**: Returns preset mock data for offline development
- 🌐 **Without Mock Config**: Acts as a proxy server, forwarding requests with complete HTTP headers to get real data
- 🔀 Smart path matching with prefix stripping support

### Wildcard Path Matching

- Single-segment `*`: `/a/b/*` matches `/a/b/123` (not `/a/b/123/456`)
- Multi-segment `**`: `/a/b/**` matches `/a/b/123` and `/a/b/123/456` (not `/a/b`)
- In-segment position: `/order/*/submit` matches `/order/123/submit`
- Match priority: Exact path > fewer wildcards > method-specific (non-ALL) > longer pattern

### Developer-Friendly Features

- 👥 **Target Users**: Frontend Engineers, QA Engineers, Full-Stack Developers
- 🎨 Visual configuration UI within VSCode
- 💾 Persistent configuration with workspace-level isolation
- 🌐 Automatic CORS handling
- ⏱️ Network delay simulation support
- 🔧 Custom response status codes and headers
- 🍪 Global cookie support for authenticated APIs

## Installation

1. Open VSCode
2. Press `Ctrl+P` / `Cmd+P` to open Quick Open
3. Type `ext install Ark65.intercept-wave`
4. Press Enter

Or install from the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`).

## Quick Start

### 1. Manage Proxy Groups

1. Click the "Intercept Wave" icon in the Activity Bar
2. Use tabs at the top to switch between different proxy configuration groups
3. Click the **+** button to add a new proxy group
4. Right-click a tab or use the Settings button to:
    - Edit group name and configuration
    - Delete the group (at least one group must remain)
    - Enable/disable the group

### 2. Start Mock Server

**Start All Enabled Groups**:

- Click the "Start All" button to start all enabled proxy groups simultaneously
- Each group will run on its configured port

**Start Individual Group**:

- Select the desired group tab
- Click the "Start Server" button within that group
- Only this specific group will start

**Stop Servers**:

- Click "Stop All" to stop all running servers
- Or click "Stop Server" within a specific group to stop only that one

### 3. Configure Proxy Groups

Click the "Configure" or Settings button to set up each group:

#### Per-Group Configuration

Each proxy group has independent settings:

- **Group Name**: Descriptive name for this configuration (e.g., "User Service", "Dev Environment")
- **Mock Port**: Port for this group's mock server (e.g., 8888, 8889)
- **Intercept Prefix**: API path prefix to intercept (default: /api)
- **Base URL**: Base URL of the original server (e.g., http://localhost:8080)
- **Strip Prefix**: When enabled, `/api/user` matches mock path `/user`
- **Global Cookie**: Configure global cookie value for this group's mock APIs
- **Enabled**: Whether this group should start when clicking "Start All"

#### Mock API Configuration

Add mock APIs to each group:

- **Path**: e.g., `/user` (when stripPrefix is true) or `/api/user` (when false)
- **HTTP Method**: ALL, GET, POST, PUT, DELETE, PATCH
- **Status Code**: HTTP response status code (default: 200)
- **Delay (ms)**: Simulate network delay (default: 0)
- **Mock Data**: Response data in JSON format
- **Enabled**: Whether to enable this mock configuration
- **Use Global Cookie**: Include the configured global cookie in response

## Use Cases

### Case 1: Microservices Development

Mock multiple microservices simultaneously, each service running on an independent port:

**Proxy Group 1 - User Service (Port 8888)**:

```javascript
// Frontend code for user service
fetch('http://localhost:8888/api/user/info')
    .then(res => res.json())
    .then(data => console.log(data));
```

**Configuration**:

- Group Name: "User Service"
- Port: 8888
- Intercept Prefix: `/api`
- Mock API: `/user/info` returns user data

**Proxy Group 2 - Order Service (Port 8889)**:

```javascript
// Frontend code for order service
fetch('http://localhost:8889/order-api/orders')
    .then(res => res.json())
    .then(data => console.log(data));
```

**Configuration**:

- Group Name: "Order Service"
- Port: 8889
- Intercept Prefix: `/order-api`
- Mock API: `/orders` returns order list

Both services can run simultaneously, each on its own port!

### Case 2: Multi-Environment Management

Create different proxy groups for different environments:

- **Dev Environment** (Port 8888): Points to `http://localhost:8080`
- **Test Environment** (Port 8889): Points to `http://test.example.com`
- **Staging Environment** (Port 8890): Points to `http://staging.example.com`

Switch between environments by selecting different tabs, and start only the environment you need.

### Case 3: Mock Specific API

```javascript
// Frontend code
fetch('http://localhost:8888/api/user/info')
    .then(res => res.json())
    .then(data => console.log(data));
```

**Configuration**:

- Path: `/user/info` (with stripPrefix enabled)
- Method: `GET`
- Mock Data:

```json
{
    "code": 0,
    "data": {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com"
    },
    "message": "success"
}
```

### Case 4: Forward Unconfigured APIs

```javascript
// This API has no mock configuration, will be forwarded to original server
fetch('http://localhost:8888/api/posts')
    .then(res => res.json())
    .then(data => console.log(data));
```

If the base URL is configured as `http://api.example.com`, the actual request will be: `http://api.example.com/api/posts`

### Case 5: Simulate Authenticated APIs

1. Set cookie in global configuration: `sessionId=abc123; userId=456`
2. Check "Use Global Cookie" in mock API configuration
3. Mock API response will automatically include `Set-Cookie` response header

### Case 6: Simulate Network Delay

Set delay time in mock configuration (e.g., 1000ms) to simulate slow network environment.

### Case 7: Test Different Response Status Codes

Configure different status codes (404, 500, etc.) to test frontend error handling logic.

## Commands

- **Intercept Wave: Start Mock Server** - Start the mock server
- **Intercept Wave: Stop Mock Server** - Stop the mock server
- **Intercept Wave: Configure** - Open configuration UI
- **Intercept Wave: Open Configuration File** - Open the config.json file directly

## Configuration File

All configurations are saved in the `.intercept-wave` folder in your workspace:

```
.intercept-wave/
└── config.json           # Global configuration and API mappings
```

### config.json Example

```json
{
    "version": "2.0",
    "proxyGroups": [
        {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "name": "User Service",
            "enabled": true,
            "port": 8888,
            "interceptPrefix": "/api",
            "baseUrl": "http://localhost:8080",
            "stripPrefix": true,
            "globalCookie": "sessionId=abc123; userId=456",
            "mockApis": [
                {
                    "path": "/user/info",
                    "enabled": true,
                    "mockData": "{\"code\":0,\"data\":{\"id\":1,\"name\":\"John\"}}",
                    "method": "GET",
                    "statusCode": 200,
                    "useCookie": true,
                    "delay": 0
                }
            ]
        },
        {
            "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
            "name": "Order Service",
            "enabled": true,
            "port": 8889,
            "interceptPrefix": "/order-api",
            "baseUrl": "http://localhost:8081",
            "stripPrefix": true,
            "globalCookie": "",
            "mockApis": [
                {
                    "path": "/orders",
                    "enabled": true,
                    "mockData": "{\"code\":0,\"data\":[]}",
                    "method": "GET",
                    "statusCode": 200,
                    "useCookie": false,
                    "delay": 0
                }
            ]
        }
    ]
}
```

<!-- Migration notes for older versions have been removed for brevity. -->

## Advanced Features

### Global Cookie Configuration

Set cookie value in global configuration, multiple cookies separated by semicolons:

```
sessionId=abc123; userId=456; token=xyz789
```

Then check "Use Global Cookie" for mock APIs that need cookies, and the response will automatically include `Set-Cookie` header.

### CORS Support

Mock server automatically adds the following CORS headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

### Proxy Mode

Unconfigured mock APIs will be automatically forwarded to the original server, preserving:

- Original request headers
- User-Agent
- Request body (for POST/PUT, etc.)
- Cookies (if any)

## Important Notes

1. **Port Occupation**: Ensure the configured port is not occupied by other programs
2. **Workspace Required**: This extension requires an open workspace to function
3. **Security**: This tool is only for local development environment, do not use in production

## FAQ

### Q: What to do if the server fails to start?

A: Check if the port is occupied, you can change the port number in the configuration.

### Q: Why is my API not being mocked?

A: Ensure one of your mock paths matches the request path (wildcards supported) and the mock configuration is enabled. Also check the stripPrefix setting.

### Q: How to view request logs?

A: Open the VSCode Output panel and select "Intercept Wave" from the dropdown.

### Q: How does stripPrefix work?

A: When enabled, the interceptPrefix is removed before matching. For example:

- Request: `/api/user` with interceptPrefix `/api`
- Match path: `/user`
- So your mock API path should be configured as `/user`

### Q: How do I manage multiple proxy groups?

A: Use the tab interface at the top of the sidebar:

- Click the **+** button to add a new group
- Click on tabs to switch between groups
- Right-click a tab or use the Settings button to edit/delete groups
- Each group runs independently on its own port

### Q: Can I run multiple proxy groups at the same time?

A: Yes! You can either:

- Click "Start All" to start all enabled groups simultaneously
- Start individual groups one by one by selecting the tab and clicking "Start Server"
- Mix both approaches - some groups started via "Start All", others started individually

<!-- Legacy migration FAQ removed -->

## Feedback & Contribution

If you have any questions or suggestions, feel free to submit an [Issue](https://github.com/zhongmiao-org/intercept-wave-vscode/issues) or [Pull Request](https://github.com/zhongmiao-org/intercept-wave-vscode/pulls)!

## License

MIT License - see the [LICENSE](LICENSE) file for details

## Development

- Compile: `npm run compile`
- Lint: `npm run lint`
- Unit tests: `npm run test:unit`
- All tests: `npm run test`
- Webview watch (React UI): `npm run webview:watch`
- Standalone Webview dev server: `npm run webview:dev` (http://127.0.0.1:5173)
- Build Webview once: `npm run webview:build`
- Package extension (dev): `npm run package`
- Create VSIX: `npm run build:local`

Notes:
- The UI is implemented with React in `webview/` (no HTML templates). All Webview HTML is generated via `buildReactWebviewHtml` to ensure CSP safety.
- UI types live under `webview/src/interfaces`; backend types under `src/common/server/types.ts`.
