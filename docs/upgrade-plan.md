# Intercept Wave 升级规划与架构指引

本方案用于在无上下文场景下，快速了解当前已完成内容、未来目标能力、技术选型与实施路径。涵盖 HTTPS、WebSocket、配置导入/导出、Mock 模板库、自定义 HTTP 头，以及改造为 React Webview 与国际化支持。

## 变更说明（本次仅重构留口，不实现功能）
- 不改变现有功能行为；仅做“未来扩展的接口与结构”准备。
- 代码层面的可向后兼容变更：
  - 新增公共消息协议类型：`src/common/messages.ts`（未启用新消息，仅类型声明）。
  - 新增公共 JSON 工具：`src/common/utils/json.ts`（可被现有/未来 UI 与后端共用，现阶段未强制替换旧调用）。
  - 可扩展数据模型：
    - `MockApiConfig` 新增可选字段：`headers?`、`templateId?`、`overrides?`（均不参与当前运行逻辑）。
    - 新增 `TLSConfig` 类型（仅类型）。
    - `ProxyGroup` 新增可选字段：`tls?`、`defaultHeaders?`（均不参与当前运行逻辑）。
  - 汇总导出：`src/common/index.ts` 暴露 `messages`，`src/common/utils/index.ts` 暴露 `json`。
- 文档：新增本升级规划，明确未来扩展路线与数据/消息约定。

## 一、当前成果概览
- 前缀欢迎页：当 `stripPrefix=true` 时，访问 `/<interceptPrefix>` 与 `/<interceptPrefix>/` 返回与根路径 `/` 相同的欢迎 JSON，仅展示启用的 API，包含可访问示例链接。
- 智能粘贴/格式化：Mock 编辑器前端支持 JS/JSON5 片段；保存前严格校验并落盘紧凑 JSON。
- 配置归一化：启动时自动压缩 v2.0 配置的 `mockData` 为紧凑 JSON；容错解析支持单引号、未引号键、尾逗号、注释。加载/保存时 `version` 写入扩展主次版本 `x.y`。
- 单测与覆盖率：新增分支与错误路径的测试，PR diff hit ≥ 90%。

## 二、架构评估
- 业务服务层（`MockServerManager`、`ConfigManager`、`pathMatcher`）无 UI 依赖；UI 与业务通过 `SidebarProvider` 消息通信。
- Webview 内仍有少量逻辑（JSON 容错与压缩），后续建议沉到 `src/common/utils/json.ts` 共享。
- 结论：现有架构可平滑扩展，无需推倒重来。

## 三、目标能力与数据模型
```ts
// src/common/server/mockServer.ts 增量模型建议
export interface TLSConfig {
  enabled: boolean;
  keyPath: string;
  certPath: string;
  passphrase?: string;
}

export interface ProxyGroup {
  // existing...
  tls?: TLSConfig;
  defaultHeaders?: Record<string, string>;
}

export interface MockApiConfig {
  // existing...
  headers?: Record<string, string>;
  templateId?: string;
  overrides?: Record<string, any>;
}
```
- HTTPS：加载 key/cert，支持自签证书路径配置（`.intercept-wave/certs`）。
- WebSocket：在 `upgrade` 分支处理，沿用路径匹配/stripPrefix 与 Mock/转发优先级。
- 导入/导出：`ConfigManager.importConfig/exportConfig`，严格校验、迁移与去重合并（以 group.id 为键）。
- 模板库：`.intercept-wave/templates` 目录化；`templateId + overrides` 生成响应。
- 自定义 HTTP 头：按 “API > Group” 合并，响应时写入。

## 四、消息协议（类型化）
将 Webview ↔ Provider 消息类型置于 `src/common/messages.ts`：
```ts
export type RequestMessage =
  | { type: 'startServer' }
  | { type: 'stopServer' }
  | { type: 'startGroup'; groupId: string }
  | { type: 'stopGroup'; groupId: string }
  | { type: 'importConfig'; payload: string }
  | { type: 'exportConfig' }
  | { type: 'addMock'; groupId: string; data: MockApiConfig }
  | { type: 'updateMock'; groupId: string; index: number; data: MockApiConfig }
  | { type: 'deleteMock'; groupId: string; index: number };

export type ResponseMessage =
  | { type: 'configUpdated'; config: MockConfig; groupStatuses: Record<string, boolean>; activeGroupId?: string }
  | { type: 'exportResult'; payload: string }
  | { type: 'error'; message: string };
```

## 五、React Webview 方案（含国际化）
- 选型：React + VS Code Webview UI Toolkit（官方生态丰富，适配简便）。
- 目录：
```
webview/
  src/
    app.tsx
    index.tsx
    components/
    state/store.ts        // Zustand 或 Context
    i18n/
      en.json
      zh-CN.json
      index.ts            // 简单 t(key)
    lib/
      json.ts             // 共享 JSON 容错/压缩（与 common/utils/json.ts 同实现）
      messages.ts         // 复用 common/messages.ts（构建别名）
  // 使用 esbuild 脚本替代 Vite（可选）
  // scripts/build-webview.js
  // scripts/build-webview-watch.js
```
- 通信：统一 `postMessage` 方法 + `message` 事件处理；类型使用 `common/messages.ts`。
- JSON 编辑器：Monaco/CodeMirror，仅在编辑器区域引入，格式化与校验走 `lib/json.ts`。
- 国际化：
  - 前端通过 `en.json/zh-CN.json` + `t(key)` 实现；语言取 `vscode.env.language` 或由 Provider 注入。
  - 后端保留 `vscode.l10n.t`；前后端 key 尽量一致。
  - 一致性指引：
    - 统一 key 命名空间（如 `ui.*`、`error.*`、`success.*`）。
    - 新增/变更文案需同时更新前后端资源，前端资源以 JSON 驱动（不在代码中硬编码）。
    - 单元测试中通过 mock 的 `vscode.l10n.t` 与前端 `t(key)` 保证回退与缺失键提示。

## 六、实施路径
- Phase 1（后端）：扩展模型（TLS/Headers/WS/模板引用），下沉 JSON 工具，定义消息协议。
- Phase 2（UI）：现有页面先加导入/导出、模板库；若复杂度提升再切 React。
- Phase 3（模板生态）：模板索引与参数化、远程源预留。

里程碑验收（不改变现有功能的前提下）：
- 编译/测试/Lint 全通过，现有行为不变。
- 新增类型与工具可被引用但未导致现有逻辑变更。
- 文档与导出入口（index.ts）同步更新。

## 七、测试与质量
- PR diff hit ≥ 90%；核心文件 Statements ≥ 95%、Branches ≥ 85%。
- 单元测试覆盖：HTTPS/WS、导入/导出、模板库、头合并、错误路径。

## 八、风险与规避
- 证书管理复杂：提供自签流程与错误提示；自动校验路径与权限。
- WS 与 HTTP Mock/转发优先级：路径独立、规则一致、日志详尽。
- 导入/导出破坏性：dry-run + 差异预览 + 自动备份。

---

附：本次新增工具骨架
- `src/common/messages.ts`：类型化消息协议
- `src/common/utils/json.ts`：JSON 容错与压缩工具（UI/后端共用）
