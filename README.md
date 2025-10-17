<div align="center">
  <img src="resources/logo.png" alt="Intercept Wave Logo" width="128" height="128">

  # Intercept Wave for VSCode

  [![Version](https://vsmarketplacebadges.dev/version-short/Ark65.intercept-wave.svg)](https://marketplace.visualstudio.com/items?itemName=Ark65.intercept-wave)
  [![Installs](https://vsmarketplacebadges.dev/installs-short/Ark65.intercept-wave.svg)](https://marketplace.visualstudio.com/items?itemName=Ark65.intercept-wave)
  [![Downloads](https://vsmarketplacebadges.dev/downloads-short/Ark65.intercept-wave.svg)](https://marketplace.visualstudio.com/items?itemName=Ark65.intercept-wave)
  [![Rating](https://vsmarketplacebadges.dev/rating-star/Ark65.intercept-wave.svg)](https://marketplace.visualstudio.com/items?itemName=Ark65.intercept-wave)
  [![Test](https://github.com/zhongmiao-org/intercept-wave-vscode/actions/workflows/test.yml/badge.svg)](https://github.com/zhongmiao-org/intercept-wave-vscode/actions/workflows/test.yml)
  [![codecov](https://codecov.io/gh/zhongmiao-org/intercept-wave-vscode/branch/main/graph/badge.svg)](https://app.codecov.io/gh/zhongmiao-org/intercept-wave-vscode)
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/zhongmiao-org/intercept-wave-vscode/blob/main/LICENSE)

  English | [简体中文](./README_zh.md)
</div>

A powerful VSCode extension that combines the proxy and interception capabilities similar to **Nginx** and **Charles**, designed specifically for local development environments. It intelligently intercepts HTTP requests, either returning custom mock data or acting as a proxy server to forward real requests to the original server with full HTTP headers.

## Features

### Smart Interception & Proxy
- 🎯 Configure intercept prefix (e.g., `/api`) to precisely target specific request paths
- 🔄 **With Mock Config**: Returns preset mock data for offline development
- 🌐 **Without Mock Config**: Acts as a proxy server, forwarding requests with complete HTTP headers to get real data
- 🔀 Smart path matching with prefix stripping support

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

### 1. Start Mock Server

1. Click the "Intercept Wave" icon in the Activity Bar
2. Click the "Start Server" button
3. The server will start on the configured port (default: 8888)

### 2. Configure Mock APIs

Click the "Configure" button to set up:

#### Global Configuration
- **Mock Port**: Port for the local mock server (default: 8888)
- **Intercept Prefix**: API path prefix to intercept (default: /api)
- **Base URL**: Base URL of the original server (e.g., http://localhost:8080)
- **Strip Prefix**: When enabled, `/api/user` matches mock path `/user`
- **Global Cookie**: Configure global cookie value for mock APIs

#### Mock API Configuration
Add mock APIs with:
- **Path**: e.g., `/user` (when stripPrefix is true) or `/api/user` (when false)
- **HTTP Method**: ALL, GET, POST, PUT, DELETE, PATCH
- **Status Code**: HTTP response status code (default: 200)
- **Delay (ms)**: Simulate network delay (default: 0)
- **Mock Data**: Response data in JSON format
- **Enabled**: Whether to enable this mock configuration
- **Use Global Cookie**: Include the configured global cookie in response

## Use Cases

### Case 1: Mock Specific API

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

### Case 2: Forward Unconfigured APIs

```javascript
// This API has no mock configuration, will be forwarded to original server
fetch('http://localhost:8888/api/posts')
  .then(res => res.json())
  .then(data => console.log(data));
```

If the base URL is configured as `http://api.example.com`, the actual request will be: `http://api.example.com/api/posts`

### Case 3: Simulate Authenticated APIs

1. Set cookie in global configuration: `sessionId=abc123; userId=456`
2. Check "Use Global Cookie" in mock API configuration
3. Mock API response will automatically include `Set-Cookie` response header

### Case 4: Simulate Network Delay

Set delay time in mock configuration (e.g., 1000ms) to simulate slow network environment.

### Case 5: Test Different Response Status Codes

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
  "port": 8888,
  "interceptPrefix": "/api",
  "baseUrl": "http://localhost:8080",
  "stripPrefix": true,
  "globalCookie": "sessionId=abc123; userId=456",
  "mockApis": [
    {
      "path": "/user/info",
      "enabled": true,
      "mockData": "{\"code\":0,\"data\":{\"name\":\"John\"}}",
      "method": "GET",
      "statusCode": 200,
      "useCookie": true,
      "delay": 0
    }
  ]
}
```

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
A: Make sure the API path matches exactly and the mock configuration is enabled. Also check the stripPrefix setting.

### Q: How to view request logs?
A: Open the VSCode Output panel and select "Intercept Wave" from the dropdown.

### Q: How does stripPrefix work?
A: When enabled, the interceptPrefix is removed before matching. For example:
- Request: `/api/user` with interceptPrefix `/api`
- Match path: `/user`
- So your mock API path should be configured as `/user`

## Feedback & Contribution

If you have any questions or suggestions, feel free to submit an [Issue](https://github.com/zhongmiao-org/intercept-wave-vscode/issues) or [Pull Request](https://github.com/zhongmiao-org/intercept-wave-vscode/pulls)!

## License

MIT License - see the [LICENSE](LICENSE) file for details