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

  [English](./README.md) | 简体中文
</div>

一款功能强大的 VSCode 扩展插件,集成了类似 **Nginx** 和 **Charles** 的代理拦截能力,专为本地开发环境设计。它能智能拦截 HTTP 请求,既可以返回自定义的 Mock 数据,也可以作为代理服务器转发真实请求到原始服务器,完整保留 HTTP 头信息。

## 功能特性

### 智能拦截与代理
- 🎯 配置拦截前缀(如 `/api`)来精确定位特定请求路径
- 🔄 **有 Mock 配置时**:返回预设的 Mock 数据,支持离线开发
- 🌐 **无 Mock 配置时**:作为代理服务器,携带完整 HTTP 头转发请求获取真实数据
- 🔀 智能路径匹配,支持前缀剥离

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

### 1. 启动 Mock 服务器

1. 点击活动栏中的"Intercept Wave"图标
2. 点击"Start Server"按钮
3. 服务器将在配置的端口上启动(默认:8888)

### 2. 配置 Mock API

点击"Configure"按钮进行设置:

#### 全局配置
- **Mock 端口**:本地 Mock 服务器端口(默认:8888)
- **拦截前缀**:要拦截的 API 路径前缀(默认:/api)
- **基础 URL**:原始服务器的基础 URL(例如:http://localhost:8080)
- **剥离前缀**:启用后,`/api/user` 将匹配 Mock 路径 `/user`
- **全局 Cookie**:为 Mock API 配置全局 Cookie 值

#### Mock API 配置
添加 Mock API 时需要配置:
- **路径**:例如 `/user`(当 stripPrefix 为 true 时)或 `/api/user`(当为 false 时)
- **HTTP 方法**:ALL、GET、POST、PUT、DELETE、PATCH
- **状态码**:HTTP 响应状态码(默认:200)
- **延迟(毫秒)**:模拟网络延迟(默认:0)
- **Mock 数据**:JSON 格式的响应数据
- **启用**:是否启用此 Mock 配置
- **使用全局 Cookie**:在响应中包含配置的全局 Cookie

## 使用场景

### 场景 1:Mock 特定 API

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

### 场景 2:转发未配置的 API

```javascript
// 此 API 没有 Mock 配置,将转发到原始服务器
fetch('http://localhost:8888/api/posts')
  .then(res => res.json())
  .then(data => console.log(data));
```

如果基础 URL 配置为 `http://api.example.com`,实际请求将是:`http://api.example.com/api/posts`

### 场景 3:模拟需要认证的 API

1. 在全局配置中设置 Cookie:`sessionId=abc123; userId=456`
2. 在 Mock API 配置中勾选"使用全局 Cookie"
3. Mock API 响应将自动包含 `Set-Cookie` 响应头

### 场景 4:模拟网络延迟

在 Mock 配置中设置延迟时间(例如 1000ms)来模拟慢速网络环境。

### 场景 5:测试不同的响应状态码

配置不同的状态码(404、500 等)来测试前端错误处理逻辑。

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
  "port": 8888,
  "interceptPrefix": "/api",
  "baseUrl": "http://localhost:8080",
  "stripPrefix": true,
  "globalCookie": "sessionId=abc123; userId=456",
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
```

## 高级功能

### 全局 Cookie 配置

在全局配置中设置 Cookie 值,多个 Cookie 用分号分隔:

```
sessionId=abc123; userId=456; token=xyz789
```

然后为需要 Cookie 的 Mock API 勾选"使用全局 Cookie",响应将自动包含 `Set-Cookie` 头。

### CORS 支持

Mock 服务器自动添加以下 CORS 头:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

### 代理模式

未配置 Mock 的 API 将自动转发到原始服务器,保留:
- 原始请求头
- User-Agent
- 请求体(对于 POST/PUT 等)
- Cookie(如果有)

## 重要提示

1. **端口占用**:确保配置的端口没有被其他程序占用
2. **需要工作区**:此扩展需要打开工作区才能运行
3. **安全性**:此工具仅用于本地开发环境,请勿在生产环境使用

## 常见问题

### 问:服务器启动失败怎么办?
答:检查端口是否被占用,可以在配置中更改端口号。

### 问:为什么我的 API 没有被 Mock?
答:确保 API 路径完全匹配且 Mock 配置已启用。同时检查 stripPrefix 设置。

### 问:如何查看请求日志?
答:打开 VSCode 输出面板,从下拉菜单中选择"Intercept Wave"。

### 问:stripPrefix 如何工作?
答:启用后,在匹配前会移除 interceptPrefix。例如:
- 请求:`/api/user`,interceptPrefix 为 `/api`
- 匹配路径:`/user`
- 所以你的 Mock API 路径应该配置为 `/user`

## 反馈与贡献

如果您有任何问题或建议,欢迎提交 [Issue](https://github.com/zhongmiao-org/intercept-wave-vscode/issues) 或 [Pull Request](https://github.com/zhongmiao-org/intercept-wave-vscode/pulls)!

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件