# Intercept Wave For VSCode 更新日志

>[English Changelog](./CHANGELOG.md) | 中文更新日志

## [Unreleased]

### 新增

- 新增与兄弟项目 `intercept-wave` 对齐的 4.0 多规则 HTTP 模型，同一大版本下可直接共用配置文件结构。
- 新增基于路由的 HTTP 配置结构，每个代理组下支持：
  - `routes: HttpRoute[]`
  - 每条 route 独立配置 `pathPrefix`、`targetBaseUrl`、`stripPrefix`、`enableMock`、`mockApis`
- 新增滚动升级到 `4.0` 的配置迁移能力，支持将旧版平铺 HTTP 配置和 `3.1` 配置组自动迁移为 route 模型。
- 新增 route 作用域下的 provider/webview 消息流：
  - 新增、编辑、删除 route
  - route 级 mock 的新增、编辑、删除、启停切换
- 新增面向 4.0 工作流的 VS Code Webview UI 升级：
  - 左侧 sidebar 负责 group / route 导航
  - 右侧 panel 作为 group、route、mock、WS 的完整编辑工作台
  - 支持 route master-detail 布局与 mock 预览工作区
- 新增面向 4.0 模型的单元测试，覆盖：
  - 配置迁移与保存结构
  - route CRUD
  - route 级 mock 持久化
  - sidebar / panel 在新 route 模型下的选中同步
- 新增基于 Docker 的 upstream 集成测试环境：`docker/docker-compose.upstream.yml`，使用 `ghcr.io/zhongmiao-org/intercept-wave-upstream:v0.3.2`。
- 新增独立的真实 upstream 集成测试套件：
  - HTTP：覆盖状态码/响应体/响应头/CORS 透传、`stripPrefix` 路由、请求方法与请求体转发、Header/Cookie 透传、多服务路由。
  - WebSocket：覆盖 upstream 桥接连通性、带 token 的握手、拦截规则、上游连接建立前的消息排队与 flush。
- 新增 Node 环境下运行的 integration runner 与辅助工具，不依赖 VS Code extension host 即可完成 upstream 集成测试。
- CI 现在会上传可下载的覆盖率产物：`lcov.info`、`coverage-summary.json` 与 HTML 报表，便于离线分析覆盖率。
- 新增中文版更新日志 `CHANGELOG_zh.md`，并与英文版互相链接。

### 变更

- HTTP 请求处理改为基于 route 的转发模型：
  - 按最长路径前缀选择最佳 `HttpRoute`
  - `enableMock=true` 时优先命中该 route 下的 mock
  - 未命中 mock 或未启用 mock 时，回退转发到该 route 的 `targetBaseUrl`
- 默认配置和新增代理组时会自动生成一条默认 route，以满足 4.0 共享配置约定。
- 组级旧 HTTP 字段（`interceptPrefix`、`baseUrl`、`mockApis`）现在仅作为兼容读取和迁移输入，不再作为主要运行时来源。
- Webview 交互升级为更符合 VS Code 的“导航器 + 编辑器工作台”模式：
  - 左侧 sidebar 负责轻量导航
  - 右侧 panel 负责 group、route、mock、WS 的完整编辑
- HTTP 编辑体验改为 `Group -> Route -> Mock` 模型，围绕 route 列表、route 详情和 route 级 mock 管理展开。
- sidebar 导航现在更接近 Explorer 树结构，支持 group 折叠、route 子节点、hover 操作，以及与右侧 panel 的同步打开和选中。
- 右侧 panel 重新整理为更明确的工作台布局：
  - 顶部摘要与操作
  - 中部 route master-detail
  - 底部 mock 列表与预览区
- 扩大了 4.0 新 UI 的国际化覆盖范围，包括导航文案、route 标签、route 校验错误和弹窗说明文本。
- 调整 `package.json` 中的测试入口：
  - `test:unit` 继续只跑单元测试。
  - `test:integration` 专门运行基于 Docker upstream 的集成测试。
  - `test:vscode-integration` 保留 VS Code extension-host smoke tests。
- 将原本依赖真实 upstream 的代理断言从 unit tests 中迁移到 integration suite，使单元测试聚焦本地逻辑。
- CI 工作流拆分为跨平台单元测试矩阵和独立的 Ubuntu Docker integration job。
- CI 现在会上传覆盖率产物，并将 JavaScript 类 GitHub Actions 强制运行在 Node 24 兼容路径上。
- 从工作流中移除了 Qodana。
- integration suite 不再使用 `glob`，改为 `fs` 递归扫描，并移除了 `glob` 依赖。
- ESLint 工具链升级为 flat config 方案，并同步升级相关依赖版本以处理依赖安全告警。

### 修复

- 修复主面板中 route 列表渲染导致 `Route Detail` 掉出预期 grid 区域的问题。
- 修复 route 列表项中编辑/删除图标未居中、影响列表观感的问题。
- 修复 sidebar hover 时操作图标撑开行高、导致列表抖动的问题。
- 修复 mock 卡片在窄宽度下可能把 `/test` 这类路径挤成竖排显示的问题。
- 修复 group tab 行在滚动条出现/消失时导致头部高度不稳定、页面来回跳动的问题。
- 修复 route detail 被整列拉伸后，目标基础地址看起来脱离详情区域的问题。

## [3.1.0]

### 新增

- WebSocket 代理分组（`protocol: "WS"`）与共享配置字段（`wsBaseUrl`、`wsInterceptPrefix`、手动推送开关、WSS 字段），与 JetBrains 插件保持一致。
- WebSocket 规则模型（`WsRule`）与对应 UI，支持：
  - 方向（`in` / `out` / `both`）、可选事件键/值匹配、拦截开关。
  - 带 `periodSec` 和可选 `onOpenFire` 的 `periodic` 规则。
  - 支持毫秒级时间线、循环和逐项消息的 `timeline` 规则。
- Webview 中的 WebSocket 推送面板：
  - 目标选择：按规则匹配连接、全部连接、最近连接。
  - 向活跃 WS 连接手动推送规则消息或任意 JSON 消息。
- Node 侧 WebSocket 运行时（`WsServerManager`）：
  - 为每个 WS 分组监听本地端口，并可按需转发到上游 WS（`wsBaseUrl`）。
  - 使用 `wsInterceptPrefix` + `stripPrefix` 进行路径匹配（例如 `/ws/echo` → `/echo`）。
  - 对 client→upstream 与 upstream→client 流量执行 WS 规则匹配、日志记录和拦截。

### 变更

- 当 `intercept: true` 的 WS 规则命中 client→upstream 消息时，不再转发到 upstream；如果规则配置了非空 `message`，则立即回推给客户端（与 IntelliJ 插件行为一致）。
- 当上游 WS 连接仍处于 `CONNECTING` 状态时，客户端消息会按连接排队，并在上游进入 `OPEN` 后自动 flush，不再被静默丢弃。
- Webview 中的分组配置弹窗支持选择协议（`HTTP`/`WS`）并编辑 WS 专属字段；分组摘要面板会展示 WS upstream 地址和 WS 拦截前缀。

### 测试

- 为 WS 运行时补充了聚焦的单元测试，覆盖：
  - WS 分组下的路径规范化与前缀剥离。
  - 规则匹配（路径/方向/事件键值）、拦截行为与事件跟踪。
  - 手动推送目标选择（`match`/`all`/`recent`）以及 periodic/timeline 调度（含旧版数值 timeline）。
- 扩展 `MockServerManager` 测试，覆盖 WS 委托流程（按规则/自定义手动推送、WS 分组状态、WS 停止逻辑），提升 HTTP/WS 集成路径覆盖率。

## [3.0.1]

### 修复

- 确保打包阶段会构建 webview bundle，避免安装后缺失 `dist/webview/app.js`，修复 `Webview.loadLocalResource` 加载 `app.js` 时的 404 问题。

## [3.0.0]

### 🎨 UI 与体验

- 更紧凑的按钮和更清晰的禁用态，更适合窄侧边栏
- 全局/分组操作和弹窗使用 Codicon 图标，状态使用红绿指示
- 模态框支持响应式布局（最大宽度 90vw），支持 ESC / × / 蒙层关闭
- Mock 列表可换行展示长路径，不会把操作按钮挤出布局

### ✨ 改进

- 使用现代 Webview CSP 与 `webview.cspSource`，在新版 VS Code 中脚本执行更稳定
- Mock API 增加 Method + Path 唯一性校验，更适合 RESTful 场景
- 对局部失败提供更清晰的错误提示和非阻塞刷新（如 Start All 中某些端口冲突）

### 🧰 开发体验

- 新增 `.editorconfig`；同时已包含 Prettier / VS Code 配置
- 在 Webview 中一起打包 `@vscode/codicons` CSS 与字体，确保图标稳定渲染

> 注：旧版 v2.0 相关发布说明已从 README 中精简，历史记录仍保留在本文件中。
