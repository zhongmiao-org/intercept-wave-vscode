# Intercept Wave for VSCode

一个强大的 VSCode 扩展,结合了类似 **Nginx** 和 **Charles** 的代理和拦截功能,专为本地开发环境设计。它能智能拦截 HTTP 请求,既可以返回自定义 Mock 数据,也可以作为代理服务器将真实请求转发到原始服务器。

## 功能特性

### 智能拦截与代理
- 🎯 配置拦截前缀(如 `/api`)精确定位特定请求路径
- 🔄 **有 Mock 配置时**: 返回预设的 Mock 数据,支持离线开发
- 🌐 **无 Mock 配置时**: 作为代理服务器,转发请求并保留完整 HTTP headers 获取真实数据
- 🔀 智能路径匹配,支持前缀剥离

### 开发者友好特性
- 👥 **目标用户**: 前端工程师、QA 工程师、全栈开发者
- 🎨 VSCode 内置可视化配置界面
- 💾 持久化配置,工作区级别隔离
- 🌐 自动处理 CORS 跨域
- ⏱️ 支持网络延迟模拟
- 🔧 自定义响应状态码和headers
- 🍪 全局 Cookie 支持,方便需要认证的 API 调试
- 📊 VS Code Output 面板实时查看请求日志

## 安装

1. 打开 VSCode
2. 按 `Ctrl+P` / `Cmd+P` 打开快速打开
3. 输入 `ext install Ark65.intercept-wave`
4. 按回车

或者从扩展视图 (`Ctrl+Shift+X` / `Cmd+Shift+X`) 搜索安装。

## 快速开始

### 1. 启动 Mock 服务器

**方式一：通过侧边栏**
1. 点击活动栏中的"Intercept Wave"图标
2. 点击"Start Server"按钮
3. 服务器将在配置的端口上启动(默认: 8888)

**方式二：通过命令面板**
1. 按 `Ctrl+Shift+P` / `Cmd+Shift+P` 打开命令面板
2. 输入 "Intercept Wave: Start Mock Server"
3. 按回车

**查看日志**
- 打开 VSCode Output 面板 (View → Output)
- 从下拉列表中选择 "Intercept Wave"
- 查看服务器状态、请求日志和响应信息

### 2. 配置 Mock APIs

点击"Configure"按钮进行设置:

#### 全局配置
- **Mock Port**: 本地 Mock 服务器端口(默认: 8888)
- **Intercept Prefix**: 要拦截的 API 路径前缀(默认: /api)
- **Base URL**: 原始服务器的基础 URL(如: http://localhost:8080)
- **Strip Prefix**: 启用后,`/api/user` 会匹配 Mock 路径 `/user`
- **Global Cookie**: 为 Mock APIs 配置全局 Cookie 值

#### Mock API 配置
添加 Mock API 时可配置:
- **Path**: 如 `/user`(stripPrefix 启用时) 或 `/api/user`(禁用时)
- **HTTP Method**: ALL, GET, POST, PUT, DELETE, PATCH
- **Status Code**: HTTP 响应状态码(默认: 200)
- **Delay (ms)**: 模拟网络延迟(默认: 0)
- **Mock Data**: JSON 格式的响应数据
- **Enabled**: 是否启用此 Mock 配置
- **Use Global Cookie**: 在响应中包含配置的全局 Cookie

## 使用场景

### 场景 1: Mock 特定 API

```javascript
// 前端代码
fetch('http://localhost:8888/api/user/info')
  .then(res => res.json())
  .then(data => console.log(data));
```

**配置**:
- Path: `/user/info` (stripPrefix 启用)
- Method: `GET`
- Mock Data:
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

### 场景 2: 转发未配置的 APIs

```javascript
// 此 API 没有 Mock 配置,将被转发到原始服务器
fetch('http://localhost:8888/api/posts')
  .then(res => res.json())
  .then(data => console.log(data));
```

如果基础 URL 配置为 `http://api.example.com`,实际请求将是: `http://api.example.com/api/posts`

### 场景 3: 模拟需要认证的 APIs

1. 在全局配置中设置 Cookie: `sessionId=abc123; userId=456`
2. 在 Mock API 配置中勾选"Use Global Cookie"
3. Mock API 响应将自动包含 `Set-Cookie` 响应头

### 场景 4: 模拟网络延迟

在 Mock 配置中设置延迟时间(如 1000ms)来模拟慢速网络环境。

### 场景 5: 测试不同响应状态码

配置不同的状态码(404, 500 等)来测试前端错误处理逻辑。

## 命令

- **Intercept Wave: Start Mock Server** - 启动 Mock 服务器
- **Intercept Wave: Stop Mock Server** - 停止 Mock 服务器
- **Intercept Wave: Configure** - 打开配置界面
- **Intercept Wave: Open Configuration File** - 直接打开 config.json 文件

## 查看日志

1. 打开 VSCode Output 面板:
   - 菜单: `View` → `Output`
   - 快捷键: `Ctrl+Shift+U` / `Cmd+Shift+U`

2. 从下拉列表中选择 `Intercept Wave`

3. 日志说明:
   - ✅ 服务器启动/停止
   - 📥 收到的请求
   - 🎯 路径匹配信息
   - ✅ Mock 响应 (包含状态码和延迟信息)
   - ⏩ 转发到原始服务器
   - ❌ 错误信息

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

然后为需要 Cookie 的 Mock API 勾选"Use Global Cookie",响应将自动包含 `Set-Cookie` header。

### CORS 支持

Mock 服务器自动添加以下 CORS headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

### 代理模式

未配置 Mock 的 API 将自动转发到原始服务器,保留:
- 原始请求 headers
- User-Agent
- 请求体 (POST/PUT 等)
- Cookies (如果有)

## 重要提示

1. **端口占用**: 确保配置的端口未被其他程序占用
2. **需要工作区**: 此扩展需要打开工作区才能正常运行
3. **安全性**: 此工具仅用于本地开发环境,请勿在生产环境使用

## 常见问题

### Q: 服务器启动失败怎么办?
A: 检查端口是否被占用,可以在配置中更改端口号。

### Q: 为什么我的 API 没有被 Mock?
A: 确保 API 路径完全匹配且 Mock 配置已启用。还要检查 stripPrefix 设置。

### Q: 如何查看请求日志?
A: 打开 VSCode Output 面板并从下拉列表中选择 "Intercept Wave"。日志会实时显示:
   - 📥 收到的请求
   - 🎯 匹配的路径
   - ✅ Mock/代理响应
   - ❌ 错误信息

### Q: stripPrefix 如何工作?
A: 启用时,interceptPrefix 会在匹配前被移除。例如:
- 请求: `/api/user` (interceptPrefix 为 `/api`)
- 匹配路径: `/user`
- 所以 Mock API 路径应配置为 `/user`

## 反馈与贡献

如果您有任何问题或建议,欢迎提交 [Issue](https://github.com/zhongmiao-org/intercept-wave-vscode/issues) 或 [Pull Request](https://github.com/zhongmiao-org/intercept-wave-vscode/pulls)!

## 许可证

MIT License