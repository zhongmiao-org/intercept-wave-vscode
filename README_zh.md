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

## ✨ v2.0 新功能:多服务代理

- 📑 **标签页界面**:在独立的标签页中管理多个代理配置组
- 🚀 **多代理组**:同时运行多个 Mock 服务,每个服务使用独立端口
- 🏗️ **微服务就绪**:完美支持微服务架构(例如:用户服务使用 8888 端口,订单服务使用 8889 端口)
- 🔄 **快速切换**:通过标签页轻松切换和管理不同的服务配置
- 🌍 **多环境**:轻松管理开发、测试、预发布等多个环境

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

### 1. 管理代理组 (v2.0)

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
- **全局 Cookie**:为此组的 Mock API 配置全局 Cookie 值
- **启用**:点击"全部启动"时此组是否应该启动

#### Mock API 配置
为每个组添加 Mock API:
- **路径**:例如 `/user`(当 stripPrefix 为 true 时)或 `/api/user`(当为 false 时)
- **HTTP 方法**:ALL、GET、POST、PUT、DELETE、PATCH
- **状态码**:HTTP 响应状态码(默认:200)
- **延迟(毫秒)**:模拟网络延迟(默认:0)
- **Mock 数据**:JSON 格式的响应数据
- **启用**:是否启用此 Mock 配置
- **使用全局 Cookie**:在响应中包含配置的全局 Cookie

## 使用场景

### 场景 1:微服务开发 (v2.0)

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

### 场景 2:多环境管理 (v2.0)

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

### config.json 示例 (v2.0)

```json
{
  "version": "2.0",
  "proxyGroups": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "用户服务",
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
          "mockData": "{\"code\":0,\"data\":{\"id\":1,\"name\":\"张三\"}}",
          "method": "GET",
          "statusCode": 200,
          "useCookie": true,
          "delay": 0
        }
      ]
    },
    {
      "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "name": "订单服务",
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

### 从 v1.x 迁移到 v2.0

从 v1.x 升级到 v2.0 时,您的现有配置将自动迁移:

**升级前 (v1.x)**:
```json
{
  "port": 8888,
  "interceptPrefix": "/api",
  "baseUrl": "http://localhost:8080",
  "mockApis": [...]
}
```

**升级后 (v2.0)**:
```json
{
  "version": "2.0",
  "proxyGroups": [
    {
      "id": "自动生成的-uuid",
      "name": "默认配置",
      "enabled": true,
      "port": 8888,
      "interceptPrefix": "/api",
      "baseUrl": "http://localhost:8080",
      "mockApis": [...]
    }
  ]
}
```

您的旧配置将成为一个名为"默认配置"的新代理组。

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

### 问:如何管理多个代理组? (v2.0)
答:使用侧边栏顶部的标签页界面:
- 点击 **+** 按钮添加新组
- 点击标签页切换不同组
- 右键点击标签页或使用设置按钮编辑/删除组
- 每个组在自己的端口上独立运行

### 问:可以同时运行多个代理组吗? (v2.0)
答:可以!您可以:
- 点击"全部启动"同时启动所有已启用的组
- 逐个选择标签页并点击"启动服务"来启动单个组
- 混合使用两种方式 - 某些组通过"全部启动",其他组单独启动

### 问:升级到 v2.0 后我的 v1.x 配置会怎样? (v2.0)
答:您的配置会自动迁移到 v2.0 格式。您的旧单代理设置将成为一个名为"默认配置"的新代理组。所有现有的 Mock API 和设置都会保留。

## 反馈与贡献

如果您有任何问题或建议,欢迎提交 [Issue](https://github.com/zhongmiao-org/intercept-wave-vscode/issues) 或 [Pull Request](https://github.com/zhongmiao-org/intercept-wave-vscode/pulls)!

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件