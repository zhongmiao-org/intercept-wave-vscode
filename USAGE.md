# Intercept Wave Usage Guide

[简体中文](./USAGE_zh.md)

## Overview

Intercept Wave is a VSCode extension that helps you handle HTTP mocking, proxy forwarding, and WebSocket debugging in one local workflow. You can use it to:

- Intercept specific APIs and return custom mock data
- Forward unmatched requests to upstream services automatically
- Maintain multiple proxy groups for different services or environments
- Add CORS headers automatically to simplify frontend integration

## Quick Start

### 1. Open the Extension

1. Open your workspace in VSCode
2. Click the "Intercept Wave" icon in the Activity Bar
3. Select a proxy group and click "Start Server", or use "Start All" at the top
4. After the server starts, use the local access URL such as `http://localhost:8888`, or `https://localhost:9443` when HTTPS is enabled for that HTTP group

### 2. Configure Mock Services

Click the "Configure" or settings button to edit proxy groups.

#### Group Basics

- **Protocol**: `HTTP` or `WS`
- **Group Name**: For example, "Gateway", "User Service", or "Order Service"
- **Port**: The local listening port for the current group
- **Enabled**: Whether this group should be included in "Start All"
- **HTTPS**: HTTP groups can optionally listen as `https://localhost:<port>` on the same port using a PKCS#12 `.p12` / `.pfx` keystore

#### HTTP Settings

- **Global Cookie**: Optionally append a shared cookie to mock responses
- **Routes**: Each HTTP group can contain multiple routes, and each route includes:
    - **Path Prefix**: Such as `/api` or `/order-api`
    - **Target Type**: `PROXY` for upstream forwarding, or `STATIC` for local frontend build files
    - **Target Base URL**: Such as `http://localhost:8080`
    - **Static Root**: Such as `dist`, `build`, or `frontend/dist` when `targetType="STATIC"`
    - **Strip Prefix**: Whether to remove the route prefix before matching and forwarding
    - **Rewrite Target Path**: Optional path base applied after strip-prefix, such as `/v1`
    - **SPA Fallback Path**: Optional proxy fallback path for frontend navigation 404s, such as `/index.html`
    - **SPA Fallback**: Static route fallback switch that serves `index.html` for missing browser navigation paths
    - **Request Headers / Response Headers**: Optional route-level header override rules using `ADD`, `SET`, or `REMOVE`
    - **Enable Mock**: Whether this route should check its own mock list first

Route rewrite is useful when replacing a local nginx rule. For example, with `pathPrefix="/backend"`, `stripPrefix=true`, and `rewriteTargetPath="/v1"`, a request to `/backend/users?active=true` is matched and forwarded as `/v1/users?active=true`. This is local development gateway behavior, not production nginx replacement behavior.

Frontend dev server proxy example: configure an API route with `pathPrefix="/api"`, `stripPrefix=true`, `targetBaseUrl="http://localhost:9000"`, and a frontend route with `pathPrefix="/"`, `stripPrefix=false`, `targetBaseUrl="http://localhost:5173"`, `spaFallbackPath="/index.html"`, `enableMock=false`. Then `/api/users` goes to the backend, while `/`, `/assets/app.js`, and `/dashboard/settings` go to the frontend dev server.

Frontend build static route example: after running your frontend build, configure `targetType="STATIC"`, `staticRoot="frontend/dist"`, `pathPrefix="/"`, and `spaFallback=true`. Then `/assets/index.js` and `/assets/style.css` are served from the build directory with frontend MIME types, while `/dashboard` returns `index.html` for browser navigation refreshes.

Static roots are resolved from the workspace/project root. Project-internal folders are saved as relative paths such as `dist`, `build`, or `frontend/dist`, which keeps `.intercept-wave/config.json` shareable. Absolute paths outside the project are allowed for local experiments, but they depend on the current machine.

#### HTTPS Local Origin

Enable HTTPS on an HTTP group when your browser or frontend framework needs a secure local origin. When `httpsEnabled=true`, the configured port listens only on HTTPS and does not also expose HTTP.

```json
{
    "name": "Gateway",
    "port": 9443,
    "protocol": "HTTP",
    "httpsEnabled": true,
    "httpsKeystorePath": "certs/intercept-wave-local.p12",
    "httpsKeystorePassword": "changeit",
    "routes": [
        {
            "name": "API",
            "pathPrefix": "/api",
            "targetBaseUrl": "http://localhost:9000",
            "stripPrefix": true,
            "rewriteTargetPath": "",
            "spaFallbackPath": "",
            "enableMock": true,
            "mockApis": []
        }
    ]
}
```

Use **Generate local certificate** in the group editor to create a standard PKCS#12 file at `certs/intercept-wave-local.p12`. The generated certificate uses `CN=localhost` with SAN entries for `localhost` and `127.0.0.1`, and the default password is `changeit`. The file contains a private key and is for local debugging only. Intercept Wave does not install it into the system or browser trust store, so your browser may still ask you to trust the self-signed certificate.

Project-internal certificate paths are saved relative to the workspace and can be shared with the config. External absolute paths are allowed but machine-local.

Equivalent manual `keytool` command:

```bash
mkdir -p certs
keytool -genkeypair \
  -alias intercept-wave-local \
  -keyalg RSA \
  -keysize 2048 \
  -validity 825 \
  -storetype PKCS12 \
  -keystore certs/intercept-wave-local.p12 \
  -storepass changeit \
  -keypass changeit \
  -dname "CN=localhost, OU=Intercept Wave, O=Local Development, L=Local, ST=Local, C=US" \
  -ext "SAN=dns:localhost,ip:127.0.0.1"
```

#### Nginx Migration Recipes

Use one HTTP group as the local gateway port, then add routes that mirror nginx `location` blocks. This is intended for local development, not production traffic.

Frontend dev server plus backend API:

```json
{
    "name": "Gateway",
    "port": 8888,
    "protocol": "HTTP",
    "httpsEnabled": false,
    "httpsKeystorePath": "",
    "httpsKeystorePassword": "",
    "routes": [
        {
            "name": "API",
            "pathPrefix": "/api",
            "targetBaseUrl": "http://localhost:9000",
            "stripPrefix": true,
            "rewriteTargetPath": "",
            "spaFallbackPath": "",
            "enableMock": true,
            "mockApis": []
        },
        {
            "name": "Frontend",
            "pathPrefix": "/",
            "targetBaseUrl": "http://localhost:5173",
            "stripPrefix": false,
            "rewriteTargetPath": "",
            "spaFallbackPath": "/index.html",
            "enableMock": false,
            "mockApis": []
        }
    ]
}
```

Multiple backend services with a frontend fallback:

```json
[
    {
        "name": "API",
        "pathPrefix": "/api",
        "targetBaseUrl": "http://localhost:9000",
        "stripPrefix": true,
        "rewriteTargetPath": "",
        "spaFallbackPath": "",
        "enableMock": true,
        "mockApis": []
    },
    {
        "name": "Auth",
        "pathPrefix": "/auth",
        "targetBaseUrl": "http://localhost:9010",
        "stripPrefix": true,
        "rewriteTargetPath": "",
        "spaFallbackPath": "",
        "enableMock": true,
        "mockApis": []
    },
    {
        "name": "Admin API",
        "pathPrefix": "/admin-api",
        "targetBaseUrl": "http://localhost:9020",
        "stripPrefix": true,
        "rewriteTargetPath": "",
        "spaFallbackPath": "",
        "enableMock": true,
        "mockApis": []
    },
    {
        "name": "Frontend",
        "pathPrefix": "/",
        "targetBaseUrl": "http://localhost:5173",
        "stripPrefix": false,
        "rewriteTargetPath": "",
        "spaFallbackPath": "/index.html",
        "enableMock": false,
        "mockApis": []
    }
]
```

Frontend static build route for `dist/` or `build/` output:

```json
{
    "name": "Frontend Build",
    "pathPrefix": "/",
    "targetType": "STATIC",
    "targetBaseUrl": "http://localhost:8080",
    "staticRoot": "frontend/dist",
    "stripPrefix": false,
    "rewriteTargetPath": "",
    "spaFallbackPath": "",
    "spaFallback": true,
    "enableMock": false,
    "mockApis": []
}
```

For static routes, Intercept Wave still uses the same route-local path semantics: `stripPrefix` runs first, `rewriteTargetPath` runs second, and the query string is ignored for file lookup. Requests with raw or encoded `..` are rejected before any file is read outside `staticRoot`.

Route-level header override examples:

```json
{
    "requestHeaders": [
        { "name": "Authorization", "value": "Bearer local-dev-token", "operation": "SET", "enabled": true },
        { "name": "X-Debug-Mode", "value": "1", "operation": "ADD", "enabled": true },
        { "name": "Cookie", "value": "", "operation": "REMOVE", "enabled": false }
    ],
    "responseHeaders": [
        { "name": "Access-Control-Allow-Origin", "value": "http://localhost:5173", "operation": "SET", "enabled": true },
        { "name": "Access-Control-Allow-Credentials", "value": "true", "operation": "SET", "enabled": true },
        { "name": "Cache-Control", "value": "no-store", "operation": "SET", "enabled": true }
    ]
}
```

Request rules run before proxy forwarding and are useful for local auth injection, feature flags, or removing incoming cookies. Response rules run last for proxy, static, mock, and matched preflight responses, so they can override default CORS, cache, and content headers when those headers are not restricted.

Restricted request headers are skipped at runtime: `host`, `connection`, `content-length`, `date`, `expect`, `upgrade`, `trailer`, `te`.

Restricted response headers are skipped at runtime: `transfer-encoding`, `content-length`, `connection`.

Common issues:

- **Port occupied**: change the group port or stop the process that already listens on it.
- **SPA refresh returns 404**: for proxy-to-dev-server routes, keep the frontend route at `pathPrefix="/"`, set `enableMock=false`, and set `spaFallbackPath="/index.html"` for HTML navigation requests. For static build routes, set `targetType="STATIC"` and `spaFallback=true`.
- **Prefix or rewrite mismatch**: `stripPrefix` runs before `rewriteTargetPath`; Mock paths and forwarded paths use the rewritten route-local path.
- **Unexpected CORS or cache headers**: response header rules run after the default CORS headers, so use `SET` or `REMOVE` on `responseHeaders` for route-specific CORS and cache behavior.
- **HTTPS certificate warning**: generated certificates are self-signed and local-debug only; trust them manually only when appropriate for your browser or system.

Related roadmap items: VS Code [#39](https://github.com/zhongmiao-org/intercept-wave-vscode/issues/39), IntelliJ [#150](https://github.com/zhongmiao-org/intercept-wave/issues/150), and IntelliJ docs [#157](https://github.com/zhongmiao-org/intercept-wave/issues/157).

#### Mock API Settings

1. Click "Add Mock" or the add action for the current route
2. Fill in the following fields:
    - **Path**: For example, `/user/info` or `/api/user/info`, depending on whether the current route strips its prefix
    - **HTTP Method**: ALL, GET, POST, PUT, DELETE, PATCH
    - **Status Code**: The HTTP response status code, default `200`
    - **Delay (ms)**: Simulated network delay, default `0`
    - **Response Template**: Optional built-in response shape for success, pagination, empty data, error, or auth expiration
    - **Mock Data**: The response payload in JSON format
    - **Enabled**: Whether this mock rule is active
    - **Use Global Cookie**: Whether the response should include the group-level cookie
3. Click "Apply Template" to replace the editable Mock Data area with the selected template when useful
4. Click "Format JSON" to make the payload easier to read
5. Save the mock rule

## Common Scenarios

### Scenario 1: Mock a Specific API

```javascript
// Frontend code
fetch('http://localhost:8888/api/user/info')
    .then(res => res.json())
    .then(data => console.log(data));
```

Configuration:

- Path: `/user/info` when `stripPrefix=true` on the `/api` route
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

### Scenario 2: Forward an Unconfigured API

```javascript
// This API is not mocked, so it will be forwarded automatically
fetch('http://localhost:8888/api/posts')
    .then(res => res.json())
    .then(data => console.log(data));
```

If the matched route target is configured as `http://api.example.com`, the request is forwarded to that upstream using the route path rules.

### Scenario 3: Simulate Network Delay

Set a delay value in the mock rule, for example `1000ms`, to simulate a slow network.

### Scenario 4: Test Different Response Status Codes

Configure different status codes such as `404` or `500` to verify frontend error handling.

### Scenario 5: Debug WebSocket Traffic

When a group uses the `WS` protocol, you can start local WebSocket mock/proxy services and configure push rules for debugging message flows.

## Configuration File

Configuration is stored in the VSCode workspace state and follows the shared Intercept Wave 4.0 route-based shape when exported or migrated.

### Example HTTP Group Shape

```json
{
    "version": "4.0",
    "proxyGroups": [
        {
            "name": "Gateway",
            "port": 8888,
            "enabled": true,
            "protocol": "HTTP",
            "globalCookie": "sessionId=abc123",
            "routes": [
                {
                    "name": "API",
                    "pathPrefix": "/api",
                    "targetBaseUrl": "http://localhost:8080",
                    "stripPrefix": true,
                    "rewriteTargetPath": "",
                    "spaFallbackPath": "",
                    "enableMock": true,
                    "mockApis": [
                        {
                            "path": "/user/info",
                            "enabled": true,
                            "mockData": "{\"code\":0,\"data\":{\"name\":\"John Doe\"}}",
                            "method": "GET",
                            "statusCode": 200,
                            "useCookie": true,
                            "delay": 0
                        }
                    ]
                }
            ]
        }
    ]
}
```

## Advanced Features

### Global Cookie

After you set a cookie value at the group level, you can enable "Use Global Cookie" on selected mock rules and the response will include a `Set-Cookie` header automatically.

### CORS Support

The mock server automatically adds the following CORS headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

### Proxy Mode

When no mock rule matches, the request is forwarded to the upstream server while preserving as much original request data as possible:

- Original request headers
- User-Agent
- Request body
- Cookies
