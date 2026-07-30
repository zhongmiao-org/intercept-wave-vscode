<div align="center">
  <img src="resources/logo.svg" alt="Intercept Wave Logo" width="160" height="160">

# Intercept Wave for VSCode

[![Version](https://vsmarketplacebadges.dev/version-short/Ark65.intercept-wave.svg)](https://marketplace.visualstudio.com/items?itemName=Ark65.intercept-wave)
[![Installs](https://vsmarketplacebadges.dev/installs-short/Ark65.intercept-wave.svg)](https://marketplace.visualstudio.com/items?itemName=Ark65.intercept-wave)
[![Downloads](https://vsmarketplacebadges.dev/downloads-short/Ark65.intercept-wave.svg)](https://marketplace.visualstudio.com/items?itemName=Ark65.intercept-wave)
[![Rating](https://vsmarketplacebadges.dev/rating-star/Ark65.intercept-wave.svg)](https://marketplace.visualstudio.com/items?itemName=Ark65.intercept-wave)
[![codecov](https://codecov.io/gh/zhongmiao-org/intercept-wave-vscode/branch/main/graph/badge.svg)](https://app.codecov.io/gh/zhongmiao-org/intercept-wave-vscode)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/zhongmiao-org/intercept-wave-vscode/blob/main/LICENSE)

[English](./README.md) | 简体中文

</div>

一款功能强大的 VSCode 扩展插件,集成了类似 **Nginx** 和 **Charles** 的代理拦截能力,专为本地开发环境设计。它能智能拦截 HTTP 请求,既可以返回自定义的 Mock 数据,也可以作为代理服务器转发真实请求到原始服务器,完整保留 HTTP 头信息。

## 亮点

- 📑 **标签页界面**:在独立的标签页中管理多个代理配置组
- 🚀 **多代理组**:同时运行多个 Mock 服务,每个服务使用独立端口
- 🏗️ **微服务就绪**:完美支持微服务架构(例如:用户服务 8888、订单服务 8889)
- 🔄 **快速切换**:通过标签页轻松切换和管理不同服务配置
- 🎨 **UI 优化**:按钮更紧凑、布局更友好、补全了图标、禁用状态更清晰

## 功能特性

### 智能拦截与代理

- 🎯 配置拦截前缀(如 `/api`)来精确定位特定请求路径
- 🔄 **有 Mock 配置时**:返回预设的 Mock 数据,支持离线开发
- 🌐 **无 Mock 配置时**:作为代理服务器,携带完整 HTTP 头转发请求获取真实数据
- 🔀 智能路径匹配,支持前缀剥离和路由重写

### 通配路径匹配

- 🌟 Mock 接口路径支持通配匹配
- 🔹 单段通配 `*`：如 `/a/b/*` 匹配 `/a/b/123`（不匹配 `/a/b/123/456`）
- 🔹 多段通配 `**`：如 `/a/b/**` 匹配 `/a/b/123` 与 `/a/b/123/456`（不匹配 `/a/b`）
- 🔹 段内通配：如 `/order/*/submit` 匹配 `/order/123/submit`
- 🧭 匹配优先级：精确路径 > 通配符更少 > 方法更具体（非 ALL） > 模式更长

### 开发者友好特性

- 👥 **目标用户**:前端工程师、测试工程师、全栈开发者
- 🎨 VSCode 内可视化配置界面
- 💾 配置持久化,工作区级别隔离
- 🌐 自动处理 CORS 跨域问题
- ⏱️ 支持网络延迟模拟
- 🔧 自定义响应状态码和请求头
- 🍪 全局 Cookie 支持,方便测试需要认证的接口

## 安装方法

1. 打开 VSCode
2. 按 `Ctrl+P` / `Cmd+P` 打开快速打开面板
3. 输入 `ext install Ark65.intercept-wave`
4. 按回车键

或者从扩展视图(`Ctrl+Shift+X` / `Cmd+Shift+X`)中搜索安装。

## 快速开始

### 1. 管理代理组

1. 点击活动栏中的"Intercept Wave"图标
2. 使用顶部的标签页切换不同的代理配置组
3. 点击 **+** 按钮添加新的代理组
4. 右键点击标签页或使用设置按钮可以:
    - 编辑组名称和配置
    - 删除代理组(至少保留一个组)
    - 启用/禁用代理组

### 2. 启动 Mock 服务器

**启动所有已启用的组**:

- 点击"全部启动"按钮同时启动所有已启用的代理组
- 每个组将在其配置的端口上运行

**启动单个组**:

- 选择所需的组标签页
- 点击该组内的"启动服务"按钮
- 仅此特定组将启动

**停止服务器**:

- 点击"全部停止"停止所有正在运行的服务器
- 或点击特定组内的"停止服务"按钮仅停止该组

### 3. 配置代理组

点击"配置"或设置按钮设置每个组:

#### 每组配置

每个代理组都有独立的设置:

- **组名称**:此配置的描述性名称(例如:"用户服务"、"开发环境")
- **Mock 端口**:此组的 Mock 服务器端口(例如:8888、8889)
- **拦截前缀**:要拦截的 API 路径前缀(默认:/api)
- **基础 URL**:原始服务器的基础 URL(例如:http://localhost:8080)
- **剥离前缀**:启用后,`/api/user` 将匹配 Mock 路径 `/user`
- **重写目标路径**:可选的路由级目标路径基底,在剥离前缀后生效,例如 `/v1`
- **全局 Cookie**:为此组的 Mock API 配置全局 Cookie 值
- **启用**:点击"全部启动"时此组是否应该启动

#### Mock API 配置

为每个组添加 Mock API:

- **路径**:例如 `/user`(当 stripPrefix 为 true 时)或 `/api/user`(当为 false 时)
- **HTTP 方法**:ALL、GET、POST、PUT、DELETE、PATCH
- **状态码**:HTTP 响应状态码(默认:200)
- **延迟(毫秒)**:模拟网络延迟(默认:0)
- **响应模板**:可选的成功、分页、空数据、错误或登录过期 JSON 结构
- **Mock 数据**:JSON 格式的响应数据
- **启用**:是否启用此 Mock 配置
- **使用全局 Cookie**:在响应中包含配置的全局 Cookie

## 使用场景

### 场景 1:微服务开发

同时 Mock 多个微服务,每个服务运行在独立端口:

**代理组 1 - 用户服务(端口 8888)**:

```javascript
// 用户服务的前端代码
fetch('http://localhost:8888/api/user/info')
    .then(res => res.json())
    .then(data => console.log(data));
```

**配置**:

- 组名称:"用户服务"
- 端口:8888
- 拦截前缀:`/api`
- Mock API:`/user/info` 返回用户数据

**代理组 2 - 订单服务(端口 8889)**:

```javascript
// 订单服务的前端代码
fetch('http://localhost:8889/order-api/orders')
    .then(res => res.json())
    .then(data => console.log(data));
```

**配置**:

- 组名称:"订单服务"
- 端口:8889
- 拦截前缀:`/order-api`
- Mock API:`/orders` 返回订单列表

两个服务可以同时运行,各自使用独立端口!

### 场景 2:多环境管理

为不同环境创建不同的代理组:

- **开发环境**(端口 8888):指向 `http://localhost:8080`
- **测试环境**(端口 8889):指向 `http://test.example.com`
- **预发布环境**(端口 8890):指向 `http://staging.example.com`

通过选择不同的标签页切换环境,只启动需要的环境即可。

### 场景 3:Mock 特定 API

```javascript
// 前端代码
fetch('http://localhost:8888/api/user/info')
    .then(res => res.json())
    .then(data => console.log(data));
```

**配置**:

- 路径:`/user/info`(启用 stripPrefix 时)
- 方法:`GET`
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

### 场景 4:转发未配置的 API

```javascript
// 此 API 没有 Mock 配置,将转发到原始服务器
fetch('http://localhost:8888/api/posts')
    .then(res => res.json())
    .then(data => console.log(data));
```

如果基础 URL 配置为 `http://api.example.com`,实际请求将是:`http://api.example.com/api/posts`

### 场景 5:模拟需要认证的 API

1. 在全局配置中设置 Cookie:`sessionId=abc123; userId=456`
2. 在 Mock API 配置中勾选"使用全局 Cookie"
3. Mock API 响应将自动包含 `Set-Cookie` 响应头

### 场景 6:模拟网络延迟

在 Mock 配置中设置延迟时间(例如 1000ms)来模拟慢速网络环境。

### 场景 7:测试不同的响应状态码

配置不同的状态码(404、500 等)来测试前端错误处理逻辑。

## 测试

运行单元测试:

```bash
npm run test:unit
```

运行基于 Docker upstream 的集成测试:

```bash
docker compose -f docker/docker-compose.upstream.yml up -d upstream
npm run test:integration
```

集成测试默认使用:
- `IW_UPSTREAM_HTTP=http://localhost:9000`
- `IW_UPSTREAM_WS=ws://localhost:9003`

如果你还想运行 VS Code 扩展宿主环境的 smoke tests:

```bash
npm run test:vscode-integration
```

## 命令

- **Intercept Wave: Start Mock Server** - 启动 Mock 服务器
- **Intercept Wave: Stop Mock Server** - 停止 Mock 服务器
- **Intercept Wave: Configure** - 打开配置界面
- **Intercept Wave: Open Configuration File** - 直接打开 config.json 文件

## 配置文件

所有配置保存在工作区的 `.intercept-wave` 文件夹中:

```
.intercept-wave/
└── config.json           # 全局配置和 API 映射
```

### config.json 示例

```json
{
    "version": "5.0",
    "proxyGroups": [
        {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "name": "Gateway",
            "protocol": "HTTP",
            "port": 8888,
            "httpsEnabled": false,
            "httpsKeystorePath": "",
            "httpsKeystorePassword": "",
            "globalCookie": "sessionId=abc123; userId=456",
            "enabled": true,
            "routes": [
                {
                    "id": "7c20dc9b-089a-4496-9226-5071a48f2f94",
                    "name": "API",
                    "pathPrefix": "/api",
                    "targetType": "PROXY",
                    "targetBaseUrl": "http://localhost:9000",
                    "staticRoot": "",
                    "stripPrefix": true,
                    "rewriteTargetPath": "",
                    "spaFallbackPath": "",
                    "spaFallback": false,
                    "requestHeaders": [],
                    "responseHeaders": [],
                    "enableMock": true,
                    "mockApis": [
                        {
                            "path": "/user/info",
                            "enabled": true,
                            "mockData": "{\"code\":0,\"data\":{\"id\":1,\"name\":\"张三\"}}",
                            "method": "GET",
                            "statusCode": 200,
                            "useCookie": true,
                            "delay": 0
                        }
                    ]
                },
                {
                    "id": "173c004b-7edd-4653-8efc-4564412cb1c8",
                    "name": "Frontend Build",
                    "pathPrefix": "/",
                    "targetType": "STATIC",
                    "targetBaseUrl": "",
                    "staticRoot": "frontend/dist",
                    "stripPrefix": false,
                    "rewriteTargetPath": "",
                    "spaFallbackPath": "",
                    "spaFallback": true,
                    "requestHeaders": [],
                    "responseHeaders": [],
                    "enableMock": false,
                    "mockApis": []
                }
            ]
        }
    ]
}
```

说明: `version` 字段由扩展自动维护，表示 VS Code 与 JetBrains 插件共同使用的配置 schema 版本，无需手动修改。

<!-- 旧版本迁移说明已移除，保持简洁 -->

## 高级功能

### 全局 Cookie 配置

在全局配置中设置 Cookie 值,多个 Cookie 用分号分隔:

```
sessionId=abc123; userId=456; token=xyz789
```

然后为需要 Cookie 的 Mock API 勾选"使用全局 Cookie",响应将自动包含 `Set-Cookie` 头。

### Mock 响应模板

新建或编辑 Mock API 时，可以选择响应模板并点击 **应用模板** 替换可编辑的 Mock 数据区域。模板不会修改 HTTP 状态码或其他 Mock 设置，JSON 仍可继续编辑、格式化、校验，并按现有流程保存为压缩格式。

内置模板:

```json
{
    "success": {"code":0,"message":"success","data":{}},
    "pagination": {"code":0,"message":"success","data":{"list":[],"total":0,"pageNum":1,"pageSize":10}},
    "empty": {"code":0,"message":"success","data":null},
    "error": {"code":500,"message":"Internal Server Error","data":null},
    "auth expired": {"code":401,"message":"Unauthorized","data":null}
}
```

### CORS 支持

Mock 服务器自动添加以下 CORS 头:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

### Route 级 Header 覆盖

HTTP route 可以配置请求和响应 Header 覆盖规则。请求规则会在 proxy 转发上游前执行；响应规则会在返回浏览器前最后执行，因此会作用于 proxy、static、mock 以及命中 route 的 `OPTIONS` 预检响应，并且晚于默认 CORS 头。

每条规则使用共享配置结构:

```json
{
    "name": "Cache-Control",
    "value": "no-store",
    "operation": "SET",
    "enabled": true
}
```

支持的操作:

- `SET`: 替换 Header 值
- `ADD`: 如果已存在则用 `, ` 追加，否则设置该 Header
- `REMOVE`: 移除 Header；`value` 可以为空

常见用法:

```json
{
    "name": "API",
    "pathPrefix": "/api",
    "targetType": "PROXY",
    "targetBaseUrl": "http://localhost:9000",
    "stripPrefix": true,
    "requestHeaders": [
        { "name": "Authorization", "value": "Bearer local-dev-token", "operation": "SET", "enabled": true }
    ],
    "responseHeaders": [
        { "name": "Access-Control-Allow-Origin", "value": "http://localhost:5173", "operation": "SET", "enabled": true },
        { "name": "Cache-Control", "value": "no-store", "operation": "SET", "enabled": true }
    ],
    "enableMock": true,
    "mockApis": []
}
```

请求规则适合本地认证注入或上游功能开关；响应规则适合覆盖 CORS、禁用缓存、调整 `Content-Type`，或从 proxy、static、mock 响应中移除 Header。

受限请求 Header 可以保存，但运行时会跳过：`host`、`connection`、`content-length`、`date`、`expect`、`upgrade`、`trailer`、`te`。

受限响应 Header 可以保存，但运行时会跳过：`transfer-encoding`、`content-length`、`connection`。

### 代理模式

未配置 Mock 的 API 将自动转发到原始服务器,保留:

- 原始请求头
- User-Agent
- 请求体(对于 POST/PUT 等)
- Cookie(如果有)

### 本地网关 / Nginx 迁移

Intercept Wave 可以在本地开发阶段替代常见 nginx 反向代理配置，便于在 VS Code 内统一调试、Mock 和转发。它是本地开发网关，不是生产 nginx 替代品。

典型的前端 + 后端 nginx 配置：

```nginx
server {
  listen 8888;

  location /api/ {
    proxy_pass http://localhost:9000/;
  }

  location / {
    proxy_pass http://localhost:5173/;
    try_files $uri /index.html;
  }
}
```

等价的 Intercept Wave HTTP 路由：

```json
[
  {
    "name": "API",
    "pathPrefix": "/api",
    "targetType": "PROXY",
    "targetBaseUrl": "http://localhost:9000",
    "staticRoot": "",
    "stripPrefix": true,
    "rewriteTargetPath": "",
    "spaFallbackPath": "",
    "spaFallback": false,
    "enableMock": true,
    "mockApis": []
  },
  {
    "name": "Frontend",
    "pathPrefix": "/",
    "targetType": "PROXY",
    "targetBaseUrl": "http://localhost:5173",
    "staticRoot": "",
    "stripPrefix": false,
    "rewriteTargetPath": "",
    "spaFallbackPath": "/index.html",
    "spaFallback": false,
    "enableMock": false,
    "mockApis": []
  }
]
```

这适用于 Vite、Next、Webpack 等前端开发服务器：`/api/users` 进入后端路由，`/`、`/assets/app.js`、`/dashboard/settings` 进入前端开发服务器。浏览器刷新 `/dashboard/settings` 遇到上游 404 时，前端路由可通过 `spaFallbackPath` 重试 `/index.html`。

多后端微服务可按前缀拆分多条路由，并依赖最长前缀匹配：

```json
[
  { "name": "API", "pathPrefix": "/api", "targetBaseUrl": "http://localhost:9000", "stripPrefix": true, "rewriteTargetPath": "", "spaFallbackPath": "", "enableMock": true, "mockApis": [] },
  { "name": "Auth", "pathPrefix": "/auth", "targetBaseUrl": "http://localhost:9010", "stripPrefix": true, "rewriteTargetPath": "", "spaFallbackPath": "", "enableMock": true, "mockApis": [] },
  { "name": "Admin API", "pathPrefix": "/admin-api", "targetBaseUrl": "http://localhost:9020", "stripPrefix": true, "rewriteTargetPath": "", "spaFallbackPath": "", "enableMock": true, "mockApis": [] },
  { "name": "Frontend", "pathPrefix": "/", "targetBaseUrl": "http://localhost:5173", "stripPrefix": false, "rewriteTargetPath": "", "spaFallbackPath": "/index.html", "enableMock": false, "mockApis": [] }
]
```

前端生产构建可将前端 route 切换为静态文件服务：

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

静态目录按工作区根目录解析，因此共享配置建议使用 `dist`、`build`、`frontend/dist` 这类项目相对路径。项目外绝对路径也允许用于本机配置，但会让 `.intercept-wave/config.json` 依赖当前机器。static route 使用与 proxy route 相同的 route-local 路径规则：先 `stripPrefix`，再 `rewriteTargetPath`；查询参数不参与文件查找。原始或编码的目录穿越请求会在读取文件前被拒绝。

HTTP 配置组也可以在同一个端口上启用 HTTPS。启用后该配置组只启动 `https://localhost:<port>`，不会同时监听 HTTP：

```json
{
  "name": "Gateway",
  "protocol": "HTTP",
  "port": 9443,
  "httpsEnabled": true,
  "httpsKeystorePath": "certs/intercept-wave-local.p12",
  "httpsKeystorePassword": "changeit",
  "routes": [
    {
      "name": "API",
      "pathPrefix": "/api",
      "targetType": "PROXY",
      "targetBaseUrl": "http://localhost:9000",
      "staticRoot": "",
      "stripPrefix": true,
      "rewriteTargetPath": "",
      "spaFallbackPath": "",
      "spaFallback": false,
      "enableMock": true,
      "mockApis": []
    }
  ]
}
```

在 HTTP 配置组编辑器中点击“生成本地证书”可创建 `certs/intercept-wave-local.p12`。生成的 PKCS#12 文件包含私钥，仅用于本地调试；Intercept Wave 不会自动把它安装到浏览器或系统信任链。项目内证书路径会保存为工作区相对路径，便于共享配置。项目外绝对路径也允许，但属于本机配置。

偏好命令行的用户可使用等价 `keytool` 命令：

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

路径重写遵循 nginx-like 本地网关语义：

- `pathPrefix="/api"`，`stripPrefix=true`：`/api/users` 会按 `/users` 进行 Mock 匹配与转发
- `pathPrefix="/backend"`，`stripPrefix=true`，`rewriteTargetPath="/v1"`：`/backend/users` 会按 `/v1/users` 进行 Mock 匹配与转发

静态 `dist/` 服务、route 级 Header 和 HTTPS 监听已与兄弟 IntelliJ 插件保持共享配置语义一致。跨平台 roadmap 链接：VS Code [#39](https://github.com/zhongmiao-org/intercept-wave-vscode/issues/39)、IntelliJ [#150](https://github.com/zhongmiao-org/intercept-wave/issues/150)、IntelliJ 文档对应 issue [#157](https://github.com/zhongmiao-org/intercept-wave/issues/157)。

## 重要提示

1. **端口占用**:确保配置的端口没有被其他程序占用
2. **需要工作区**:此扩展需要打开工作区才能运行
3. **安全性**:此工具仅用于本地开发环境,请勿在生产环境使用

## 常见问题

### 问:服务器启动失败怎么办?

答:检查端口是否被占用,可以在配置中更改端口号。

### 问:为什么我的 API 没有被 Mock?

答:请确保存在至少一个 Mock 路径可以匹配该请求路径（已支持通配符），并且该 Mock 配置处于启用状态。同时检查 stripPrefix 设置。

### 问:如何查看请求日志?

答:打开 VSCode 输出面板,从下拉菜单中选择"Intercept Wave"。

### 问:stripPrefix 如何工作?

答:启用后,在匹配前会移除 interceptPrefix。例如:

- 请求:`/api/user`,interceptPrefix 为 `/api`
- 匹配路径:`/user`
- 所以你的 Mock API 路径应该配置为 `/user`

### 问:路由重写规则如何工作?

答:`rewriteTargetPath` 会在 `stripPrefix` 之后执行,并同时影响 Mock 匹配和上游转发。查询参数会被保留。

- 请求:`/backend/users?active=true`
- 路由:`pathPrefix="/backend"`、`stripPrefix=true`、`rewriteTargetPath="/v1"`
- 匹配和转发路径:`/v1/users?active=true`

这可以把常见本地 nginx 规则(如 `location /backend/ { proxy_pass http://service/v1/; }`)映射为一条 Intercept Wave 路由。

### 问:如何管理多个代理组?

答:使用侧边栏顶部的标签页界面:

- 点击 **+** 按钮添加新组
- 点击标签页切换不同组
- 右键点击标签页或使用设置按钮编辑/删除组
- 每个组在自己的端口上独立运行

### 问:可以同时运行多个代理组吗?

答:可以!您可以:

- 点击"全部启动"同时启动所有已启用的组
- 逐个选择标签页并点击"启动服务"来启动单个组
- 混合使用两种方式 - 某些组通过"全部启动",其他组单独启动

<!-- 旧版本迁移 FAQ 已移除 -->

## 反馈与贡献

如果您有任何问题或建议,欢迎提交 [Issue](https://github.com/zhongmiao-org/intercept-wave-vscode/issues) 或 [Pull Request](https://github.com/zhongmiao-org/intercept-wave-vscode/pulls)!

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 开发说明

- 编译：`npm run compile`
- 代码规范：`npm run lint`
- 单元测试：`npm run test:unit`
- 全量测试：`npm run test`
- Webview 实时构建（React UI）：`npm run webview:watch`
- 独立 Webview 开发服务器：`npm run webview:dev`（http://127.0.0.1:5173）
- 一次性构建 Webview：`npm run webview:build`
- 扩展打包（开发）：`npm run package`
- 生成 VSIX：`npm run build:local`

说明：
- UI 已迁移为 React（位于 `webview/`），不再使用 HTML 模板。Webview 容器 HTML 由 `buildReactWebviewHtml` 统一生成，保证 CSP/nonce 安全。
- UI 层类型位于 `webview/src/interfaces`；后端类型位于 `src/common/server/types.ts`。
