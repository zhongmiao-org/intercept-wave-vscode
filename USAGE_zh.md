# Intercept Wave 使用指南

[English](./USAGE.md)

## 功能概述

Intercept Wave 是一个 VS Code 扩展，用于在本地开发中统一处理 HTTP Mock、代理转发和 WebSocket 调试。你可以用它来：

- 拦截指定接口并返回自定义 Mock 数据
- 将未命中的请求自动转发到上游服务
- 为不同服务或环境维护多个配置组
- 自动补充 CORS 头，减少前端联调阻力

## 快速开始

### 1. 启动扩展

1. 在 VS Code 中打开工作区
2. 点击 Activity Bar 中的 "Intercept Wave" 图标
3. 选择一个配置组后点击“启动服务”，或使用顶部的“全部启动”
4. 服务启动成功后，使用本地访问地址，例如 `http://localhost:8888`

### 2. 配置 Mock 服务

点击“配置”或设置按钮编辑代理组。

#### 配置组基础信息

- **协议类型**：`HTTP` 或 `WS`
- **配置组名称**：例如“网关”“用户服务”“订单服务”
- **端口号**：当前配置组监听的本地端口
- **启用**：是否允许被“全部启动”统一拉起

#### HTTP 配置

- **全局 Cookie**：需要时可统一为 Mock 响应附带 Cookie
- **路由列表**：一个 HTTP 配置组可维护多条路由，每条路由都包含：
    - **路径前缀**：如 `/api`、`/order-api`
    - **目标类型**：`PROXY` 表示转发到上游，`STATIC` 表示服务本地前端构建文件
    - **目标地址**：如 `http://localhost:8080`
    - **静态目录**：当 `targetType="STATIC"` 时可配置 `dist`、`build` 或 `frontend/dist`
    - **剥离前缀**：是否在匹配和转发前移除当前路由前缀
    - **重写目标路径**：可选，剥离前缀后追加的目标路径基底，如 `/v1`
    - **SPA 回退路径**：可选，proxy 路由前端导航请求返回 404 时重试的路径，如 `/index.html`
    - **SPA 回退**：static 路由开关，未命中文件的浏览器导航请求会返回 `index.html`
    - **请求 Header / 响应 Header**：可选的 route 级 Header 覆盖规则，支持 `ADD`、`SET`、`REMOVE`
    - **启用 Mock**：是否优先使用该路由下的 Mock 列表

路由重写适合迁移本地 nginx 规则。例如配置 `pathPrefix="/backend"`、`stripPrefix=true`、`rewriteTargetPath="/v1"` 后，访问 `/backend/users?active=true` 会按 `/v1/users?active=true` 进行匹配和转发。该能力用于本地开发网关，不是生产 nginx 替代方案。

前端开发服务器代理示例：配置后端路由 `pathPrefix="/api"`、`stripPrefix=true`、`targetBaseUrl="http://localhost:9000"`，再配置前端路由 `pathPrefix="/"`、`stripPrefix=false`、`targetBaseUrl="http://localhost:5173"`、`spaFallbackPath="/index.html"`、`enableMock=false`。之后 `/api/users` 进入后端，`/`、`/assets/app.js`、`/dashboard/settings` 进入前端开发服务器。

前端构建产物静态路由示例：前端构建完成后，配置 `targetType="STATIC"`、`staticRoot="frontend/dist"`、`pathPrefix="/"`、`spaFallback=true`。之后 `/assets/index.js` 和 `/assets/style.css` 会从构建目录读取并返回正确的前端 MIME 类型，浏览器刷新 `/dashboard` 会返回 `index.html`。

静态目录按工作区/项目根目录解析。项目内目录会保存为 `dist`、`build`、`frontend/dist` 这样的相对路径，便于共享 `.intercept-wave/config.json`；项目外绝对路径也允许用于本机实验，但依赖当前机器。

#### Nginx 迁移配置片段

用一个 HTTP 配置组作为本地网关端口，再用多条路由对应 nginx 的多个 `location`。该能力面向本地开发，不用于生产流量。

前端开发服务器 + 后端 API：

```json
{
    "name": "Gateway",
    "port": 8888,
    "protocol": "HTTP",
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

多后端服务 + 前端兜底：

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

面向 `dist/` 或 `build/` 产物的前端静态路由：

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

static 路由同样使用现有 route-local 路径语义：先执行 `stripPrefix`，再执行 `rewriteTargetPath`，查询参数不参与文件查找。包含原始或编码 `..` 的请求会在读取文件前被拒绝，不能逃出 `staticRoot`。

route 级 Header 覆盖示例：

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

请求规则会在 proxy 转发前执行，适合本地认证注入、功能开关或移除传入 Cookie。响应规则会最后作用于 proxy、static、mock 和命中 route 的预检响应，因此可在不受限时覆盖默认 CORS、缓存和内容类型相关 Header。

受限请求 Header 运行时会跳过：`host`、`connection`、`content-length`、`date`、`expect`、`upgrade`、`trailer`、`te`。

受限响应 Header 运行时会跳过：`transfer-encoding`、`content-length`、`connection`。

常见问题：

- **端口占用**：修改配置组端口，或停止已经监听该端口的进程。
- **SPA 刷新返回 404**：proxy 到前端开发服务器时，前端路由保持 `pathPrefix="/"`，设置 `enableMock=false`，并设置 `spaFallbackPath="/index.html"` 处理 HTML 导航请求。static 构建路由则设置 `targetType="STATIC"` 和 `spaFallback=true`。
- **前缀或重写不符合预期**：`stripPrefix` 会先于 `rewriteTargetPath` 执行；Mock 路径和转发路径都使用重写后的路由本地路径。
- **CORS 或缓存 Header 不符合预期**：响应 Header 规则会在默认 CORS 头之后执行，可通过 `responseHeaders` 的 `SET` 或 `REMOVE` 配置 route 级 CORS 与缓存行为。
- **HTTPS**：HTTPS 监听支持由 [#40](https://github.com/zhongmiao-org/intercept-wave-vscode/issues/40) 跟进。

相关 roadmap：VS Code [#39](https://github.com/zhongmiao-org/intercept-wave-vscode/issues/39)、IntelliJ [#150](https://github.com/zhongmiao-org/intercept-wave/issues/150)、IntelliJ 文档 [#157](https://github.com/zhongmiao-org/intercept-wave/issues/157)。

#### Mock 接口配置

1. 点击“添加 Mock”或当前路由的新增操作
2. 填写以下信息：
    - **路径**：例如 `/user/info` 或 `/api/user/info`，取决于当前路由是否启用了“剥离前缀”
    - **HTTP 方法**：ALL、GET、POST、PUT、DELETE、PATCH
    - **状态码**：HTTP 响应状态码（默认：200）
    - **延迟（毫秒）**：模拟网络延迟（默认：0）
    - **响应模板**：可选，内置成功、分页、空数据、错误或登录过期响应结构
    - **Mock 数据**：JSON 格式的响应数据
    - **启用**：是否启用该 Mock 规则
    - **使用全局 Cookie**：是否在响应中附带该配置组的全局 Cookie
3. 需要用模板替换可编辑 Mock 数据区域时，点击“应用模板”
4. 点击“格式化 JSON”按钮，可将内容整理为更易阅读的格式
5. 保存 Mock 规则

## 使用场景

### 场景 1: Mock 特定接口

```javascript
// 前端代码
fetch('http://localhost:8888/api/user/info')
    .then(res => res.json())
    .then(data => console.log(data));
```

配置：

- 路径: `/user/info`，当 `/api` 路由启用 `stripPrefix=true`
- 方法: `GET`
- Mock 数据:

```json
{
    "code": 0,
    "data": {
        "id": 1,
        "name": "张三",
        "email": "zhangsan@example.com"
    },
    "message": "success"
}
```

### 场景 2: 转发未配置的接口

```javascript
// 这个接口没有配置 Mock，会自动转发到原始服务器
fetch('http://localhost:8888/api/posts')
    .then(res => res.json())
    .then(data => console.log(data));
```

如果命中的路由目标地址配置为 `http://api.example.com`，请求会按该路由的路径规则转发到上游。

### 场景 3: 模拟网络延迟

在 Mock 配置中设置延迟时间（例如：1000ms），模拟慢速网络环境。

### 场景 4: 测试不同的响应状态码

配置不同的状态码（404、500 等）来测试前端的错误处理逻辑。

### 场景 5: WebSocket 调试

当配置组协议类型为 `WS` 时，可以启动本地 WebSocket Mock/代理服务，并配置推送规则调试消息流。

## 配置文件

配置保存在 VS Code 工作区状态中；导出或迁移时遵循共享的 Intercept Wave 4.0 route-based 配置结构。

### HTTP 配置组结构示例

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
                            "mockData": "{\"code\":0,\"data\":{\"name\":\"张三\"}}",
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

## 高级功能

### 全局 Cookie

在配置组中设置 Cookie 值后，可为指定 Mock 规则开启“使用全局 Cookie”，响应时会自动带上 `Set-Cookie`。

### CORS 支持

Mock 服务器自动添加以下 CORS 头：

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

### 代理模式

未配置 Mock 的接口会自动转发到上游服务器，并尽量保留：

- 原始请求头
- User-Agent
- 请求体
- Cookie
