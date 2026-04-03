# Intercept Wave For VSCode Changelog

>English Changelog | [中文更新日志](./CHANGELOG_zh.md)

## [Unreleased]

## [4.0.0]

### Added

- 4.0 multi-route HTTP model aligned with the sibling `intercept-wave` project, so both projects can share the same major-version config file shape.
- Route-based HTTP config schema under each proxy group:
  - `routes: HttpRoute[]`
  - per-route `pathPrefix`, `targetBaseUrl`, `stripPrefix`, `enableMock`, and `mockApis`
- Rolling config migration support up to schema `4.0`, including automatic migration of legacy flat HTTP config and `3.1` proxy groups into route-based groups.
- New route-scoped CRUD flows in the provider/webview message layer:
  - add, update, delete route
  - route-scoped mock add, update, delete, toggle
- Upgraded VS Code webview UI for the 4.0 workflow:
  - sidebar navigator for groups and routes
  - full panel editor workspace for group, route, mock, and WS editing
  - route master-detail layout and mock preview workspace
- New unit tests for the 4.0 model:
  - config migration and save shape
  - route CRUD
  - route-scoped mock persistence
  - sidebar/panel selection sync for the new route model
- Docker-backed upstream integration test stack under `docker/docker-compose.upstream.yml` using `ghcr.io/zhongmiao-org/intercept-wave-upstream:v0.3.2`.
- Dedicated integration test suite for real upstream verification:
  - HTTP forwarding coverage for status/body/header/CORS passthrough, strip-prefix routing, method/body forwarding, cookie/header forwarding, and multi-service routing.
  - WebSocket forwarding coverage for upstream bridge connectivity, token-authenticated handshake, intercept rules, and queued message flush behavior.
- New integration test helpers and runner for Node-based CI execution without the VS Code extension host.
- Downloadable coverage artifacts in CI (`lcov.info`, `coverage-summary.json`, and HTML report) so reports can be inspected offline after each run.
- Chinese changelog file (`CHANGELOG_zh.md`) with cross-links between English and Chinese release notes.

### Changed

- HTTP request handling is now route-driven:
  - selects the best `HttpRoute` by longest path-prefix match
  - serves mock data from the matched route first when `enableMock=true`
  - falls back to forwarding to that route's `targetBaseUrl` when mock is disabled or not matched
- Saved config defaults and new group creation now generate a default route automatically, matching the 4.0 shared config contract.
- Group-level legacy HTTP fields (`interceptPrefix`, `baseUrl`, `mockApis`) are now treated as compatibility/migration inputs instead of the primary runtime source.
- Webview UX has been reworked into a VS Code-style navigator + editor workspace:
  - sidebar focuses on lightweight navigation
  - right-side panel becomes the main editor for group, route, mock, and WS details
- HTTP editing UI now uses a `Group -> Route -> Mock` interaction model, with route list, route detail, and route-scoped mock management.
- Sidebar navigation now behaves more like an Explorer tree, including collapsible groups, route children, hover actions, and synchronized opening in the full panel.
- Right-side panel layout has been refined into a stronger workbench structure:
  - top summary and actions
  - middle route master-detail
  - bottom mock list + preview area
- Expanded i18n coverage for the new 4.0 UI, including navigator text, route labels, route validation errors, and modal helper copy.
- Split test entry points in `package.json`:
  - `test:unit` remains focused on unit coverage.
  - `test:integration` now runs Docker-backed upstream integration tests.
  - `test:vscode-integration` keeps the VS Code extension-host smoke tests.
- Moved the former "real upstream" proxy assertion out of unit tests into the integration suite, keeping unit tests focused on local logic.
- CI workflow now separates cross-platform unit testing from the Ubuntu Docker integration job.
- CI now uploads coverage artifacts for download and forces JavaScript-based GitHub Actions onto Node 24 compatible runtime paths.
- Removed Qodana from the workflow.
- Replaced `glob` usage in the integration suite with `fs` recursion and removed the `glob` dependency.
- Upgraded ESLint tooling to the modern flat-config setup and newer dependency versions to address dependency advisories.

### Fixed

- Fixed route list rendering in the main panel so route detail no longer drops out of the intended grid cell.
- Fixed route action icons to remain centered and no longer distort list item height.
- Fixed sidebar hover actions so icons no longer cause row-height jitter.
- Fixed mock cards where narrow widths could force mock paths such as `/test` into vertical wrapping.
- Fixed panel tab/header instability caused by scrollbars appearing and disappearing in the group tab row.
- Fixed route detail panel stretching that visually detached the target base URL block from the rest of the detail card.

## [3.1.0]

### Added

- WebSocket proxy groups (`protocol: "WS"`) with per-group WS config (`wsBaseUrl`, `wsInterceptPrefix`, manual push toggle, WSS fields) shared with the JetBrains plugin.
- WebSocket rule model (`WsRule`) and UI for defining WS push/intercept rules, including:
  - Direction (`in` / `out` / `both`), optional event key/value matching, and intercept flag.
  - `periodic` rules with `periodSec` and optional `onOpenFire` behavior.
  - `timeline` rules with millisecond-precision schedule, looping, and per-item messages.
- WebSocket push panel in the webview:
  - Target selection: match connections by rule, all connections, or most recent.
  - Manual push of rule payloads or arbitrary JSON payloads to active WS connections.
- Node-side WebSocket server runtime (`WsServerManager`) that:
  - Listens per WS proxy group and optionally forwards to upstream WS (`wsBaseUrl`).
  - Applies `wsInterceptPrefix` + `stripPrefix` for matching paths (e.g. `/ws/echo` → `/echo`).
  - Evaluates WS rules on client→upstream and upstream→client traffic, with logging and intercept flags.

### Changed

- When a WS rule with `intercept: true` matches a client→upstream message, the message is no longer forwarded upstream; instead, if the rule defines a non-empty `message`, it is immediately pushed back to the client (mirroring the behavior of the IntelliJ plugin).
- For upstream connections that are still in `CONNECTING` state, client messages are queued per connection and flushed once the upstream WebSocket transitions to `OPEN` instead of being silently dropped.
- Webview group configuration modal now supports selecting protocol (`HTTP`/`WS`) and editing WS-specific fields; group summary panel shows WS base URL and intercept prefix for WS groups.

### Testing

- Added focused unit tests for the WS server runtime covering:
  - Path normalization and prefix stripping for WS groups.
  - Rule evaluation (path/direction/event key/value), intercept behavior, and event tracking.
  - Manual push selection (`match`/`all`/`recent`) and periodic/timeline scheduling (including legacy numeric timelines).
- Extended `MockServerManager` tests to cover WS delegation flows (manual push by rule/custom, WS group status, and WS stop logic), improving coverage of HTTP/WS integration paths.

## [3.0.1]

### Fixed

- Ensure webview bundle is built during packaging to avoid missing `dist/webview/app.js` after install. Fixes Webview.loadLocalResource 404 when loading `app.js` by updating `vscode:prepublish` to run `webview:build` before bundling.

## [3.0.0]

### 🎨 UI & UX
- Compact buttons with clear disabled styling; better fit for narrow sidebars
- Codicon icons for global/group actions and dialogs; status with green/red indicators
- Modal dialogs responsive (max-width 90vw), close via ESC/×/mask
- Mock list wraps long paths without pushing action buttons out of view

### ✨ Improvements
- Modern Webview CSP with `webview.cspSource`; reliable script execution on latest VS Code
- Method+Path uniqueness validation for Mock APIs (RESTful friendly)
- Clear errors and non-blocking refresh on partial failures (start-all with port conflicts)

### 🧰 Dev Experience
- Added `.editorconfig`; Prettier/VS Code settings already included
- Bundled `@vscode/codicons` CSS alongside TTF to ensure icons render in Webview

> Note: Previous v2.0-specific release notes have been trimmed from README to keep things concise. Historical entries remain below for reference.


## [2.2.1]
### 🚀 CI/CD

- 📝 Release workflow now patches `CHANGELOG.md` at the start of the publish job:
  - 🔁 Replaces the top `## [Unreleased]` with `## [<current version>]` and inserts a new empty `## [Unreleased]` above it.
  - 📰 Ensures the packaged extension and Marketplace listing include the correct versioned changelog.
- 🤖 After a successful publish, the workflow checks out `main`, opens a PR with the changelog update, and enables auto-merge so `main` reflects the release notes only after publish succeeds.
- 🔍 Qodana static analysis also runs on pushes to `main` (and manual runs on `main`) to provide main-branch reports in Qodana Cloud, in addition to PR scans.

## [2.2.0]
### ✨ Features

- 🌟 Mock API path wildcard matching
    - Single-segment `*`: e.g., `/a/b/*` matches `/a/b/123` (not `/a/b/123/456`)
    - Multi-segment `**`: e.g., `/a/b/**` matches `/a/b/123` and `/a/b/123/456` (not `/a/b`)
    - Segment wildcard position: e.g., `/order/*/submit` matches `/order/123/submit`
    - Match priority: Exact path > fewer wildcards > method-specific (non-ALL) > longer pattern

## [2.1.1]
### 🐛 Bug Fixes

- 🔧 **Tab Switching Issue**: Fixed active tab automatically switching to tab1 when starting a different tab's server
    - Added `setActiveGroup` message type to synchronize activeGroupId between frontend and backend
    - Frontend now notifies backend when user switches tabs
    - Backend maintains correct activeGroupId state across all operations
- 🚀 **CI/CD Fix**: Removed .vsix file upload from draft release creation to prevent conflicts with manual releases

## [2.1.0]
### 🧪 Testing & Quality

- ✅ **Test Architecture Refactoring**: Separated unit tests from integration tests
    - Unit tests: Pure logic testing with mocked dependencies
    - Integration tests: Real VSCode environment using `@vscode/test-electron`
- 📊 **Improved Test Coverage**: Comprehensive unit tests for all core modules
    - ConfigManager: 15 test cases covering config management and migration
    - MockServerManager: 20 test cases covering server lifecycle and request handling
    - SidebarProvider: 4 test cases for pure functions (getNonce)
    - Extension: Integration tests for activation and command registration
- 🔧 **Test Infrastructure**:
    - Separate test runners for unit and integration tests
    - Updated CI to run both test types appropriately
    - Integration tests only run on Ubuntu with xvfb (headless mode)
    - Integration tests now run with temporary workspace to properly test command registration
- 📦 **Dependency Fixes**:
    - Downgraded `uuid` from v13 to v9.0.1 (CommonJS compatibility)
    - Downgraded `chai` from v5 to v4.5.0 (CommonJS compatibility)
    - Ensures tests pass on Node 18.x and 20.x
- 📊 **Codecov Configuration**: Ignore VSCode-specific files that require integration tests
    - Excluded `src/extension.ts` and `src/providers/**` from coverage reports
    - Focus coverage metrics on testable business logic (common modules)
    - More accurate coverage representation for unit-testable code

### 🏗️ Code Organization

- 📁 **Directory Restructuring**: Better separation of concerns
    - `src/common/config/` - Configuration management (pure logic)
    - `src/common/server/` - HTTP server logic (pure Node.js)
    - `src/common/utils/` - Utility functions (template loader)
    - `src/providers/` - VSCode-specific providers (WebviewViewProvider)
    - `src/extension.ts` - Entry point (unchanged)
- 🔄 **Auto-generated Index Files**: Cleaner imports with barrel exports
    - Created index.ts files for each module directory
    - Simplified imports: `from '../common'` instead of `from '../common/config/configManager'`
- 📜 **Git History Preserved**: Used `git mv` for all file moves

### 🎨 Code Formatting

- ✨ **Prettier Integration**: Consistent code style across the project
    - Configured with: single quotes, 100 char line width, 4 space tabs, trailing commas
    - ESLint integration with `eslint-plugin-prettier` and `eslint-config-prettier`
    - All source code formatted (TypeScript, JavaScript, JSON, Markdown)
- 🔧 **VSCode Integration**: Auto-format on save
    - Added `.vscode/settings.json` with format-on-save enabled
    - Added `.vscode/extensions.json` recommending Prettier and ESLint extensions
- 📜 **NPM Scripts**:
    - `npm run format` - Format all code
    - `npm run format:check` - Check formatting (for CI)
- 🚫 **Prettier Ignore**: Excludes build output, dependencies, and HTML templates

### 🐛 Bug Fixes

- 🔧 **Server Control Fixes**:
    - Fixed "Stop All" button not working when individual groups are started
    - Fixed `isRunning` flag not set when starting individual groups
    - Fixed server stop logs showing group IDs instead of names
- 🎨 **UI Fixes**:
    - Fixed button state synchronization between frontend and backend
    - Fixed codicons CSS loading in webview with proper CSP
    - Fixed icon display warnings
- 🌐 **i18n Improvements**:
    - Updated Global Cookie placeholder text to be more descriptive
    - Changed to: "全局 cookie 值,格式: sessionId=abc123; userId=456"

### 📚 Documentation

- 📖 **Updated README**:
    - Added v2.0 multi-proxy group features
    - Updated screenshots and feature descriptions
    - Added test and coverage information
- 🇨🇳 **Chinese Documentation**: Updated README_zh.md with all new features
- 📝 **Test Documentation**: Added comprehensive testing setup and contribution guides

### 🔧 Developer Experience

- 🧹 **Code Cleanup**: Removed legacy v1.x methods and tests
- 🎯 **TypeScript**: Better type safety with separated concerns
- 🔍 **Linting**: ESLint now integrated with Prettier for consistent style
- ⚡ **CI/CD Pipeline Refactoring**: Unified workflow for better visibility
    - **Unified CI Workflow**: Merged `build.yml` and `test.yml` into single `ci.yml`
    - **Clear Pipeline Stages**:
        - Step 1: Build & Package (generates .vsix, runs on all events)
        - Step 2: Multi-platform testing (Ubuntu, macOS, Windows) × Multi-version (Node 18, 20)
        - Step 3: Upload Codecov (only Ubuntu 20.x)
        - Step 4: PR Coverage report with comparison to base branch (only PRs)
        - Step 5: Create Draft Release with .vsix attached (only push to main, after all tests pass)
    - **Better Resource Management**: Build first, tests depend on build success, release depends on tests
    - **Full Testing on Main Branch**: Push to main runs complete multi-platform test suite before creating release
    - **Artifact Management**: Extension package (.vsix) available for download in PRs (30 days retention)
- 🐛 **Extension Activation Fix**: Commands now properly register in integration test environment
- 📦 **Package Optimization with esbuild**: Revolutionary size reduction using module bundling
    - **Bundling Strategy**: Implemented esbuild to create single `dist/extension.js` file
    - **Near-Zero Dependencies**: Eliminated runtime node_modules (only webview UI resources included)
    - **Dramatic Size Reduction**: Reduced from 1,087 files (1.35MB) to **16 files (159KB)** - **88% reduction!**
    - **Performance**: Single 21KB bundled JavaScript file vs 533 separate JS files previously
    - **Build System**:
        - Added `esbuild.js` configuration for production bundling
        - Updated `package.json` main entry to `./dist/extension.js`
        - New scripts: `npm run package` (production build), `npm run package:watch` (watch mode)
        - Updated `copy-templates.js` to copy templates and webview resources to `dist/`
        - Webview dependencies (bundled.js, codicon.ttf) copied to `dist/webview/` during build
    - **Optimized `.vscodeignore`**: Simplified to exclude all source files, node_modules, and build artifacts
    - **CI/CD Integration**: Updated GitHub Actions workflow to use bundled build
    - **Test Compatibility**: Integration tests now run both `compile` and `package` to ensure dist/extension.js exists
    - Added `.gitattributes` for consistent line endings across platforms (LF on all platforms)

## [2.0.0]

### 🎉 Major Features

#### Multi-Service Proxy Support

- ✨ **Tab-based UI**: Organize multiple proxy configurations in separate tabs
- 🚀 **Multiple Proxy Groups**: Configure and manage multiple services simultaneously
- 🎯 **Individual Port Management**: Each proxy group can run on its own port
- ⚙️ **Per-Group Settings**: Customize port, intercept prefix, base URL, and more for each service
- 🔄 **Easy Switching**: Quickly switch between different proxy configurations via tabs

#### Enhanced User Interface

- 📑 **Tab System**: Visual tabs at the top showing all configured proxy groups
- ➕ **Quick Add**: Add new proxy groups with the "+" button
- ✏️ **Inline Editing**: Right-click or use Settings button to edit group configurations
- 🗑️ **Group Management**: Delete groups (except the last one) directly from tabs
- 🔘 **Enable/Disable Toggle**: Control which groups are active via checkbox in settings

#### Configuration Migration

- 🔄 **Automatic Migration**: Existing configurations (v1.x) automatically migrate to v2.0 format
- 📁 **Backward Compatible**: Legacy config files seamlessly convert to new `proxyGroups` structure
- 💾 **Preserved Data**: All existing mock APIs and settings are retained during migration
- 🆔 **UUID-based Groups**: Each proxy group gets a unique identifier for reliable management

### Technical Improvements

- 📦 **New Config Structure**: Configuration now uses `version` and `proxyGroups` array
- 🏗️ **Enhanced Architecture**: Refactored server manager to support multiple simultaneous servers
- 🎨 **Modernized UI**: Complete UI overhaul with tabbed interface design
- 🔧 **Improved State Management**: Better handling of active group selection and updates
- 📝 **TypeScript Enhancements**: Added ProxyGroup interface and updated type definitions

### Dependencies

- ➕ Added `uuid` (^13.0.0) for generating unique group identifiers
- ➕ Added `@types/uuid` (^10.0.0) for TypeScript support

### Developer Experience

- 🧪 **Test Configuration**: Updated tsconfig to exclude test files from compilation
- 🔨 **Build Process**: Maintained compatibility with existing build scripts
- 📚 **Code Organization**: Improved separation of concerns in sidebar and config management

### Breaking Changes

- ⚠️ **Config Format**: Configuration file structure has changed from flat to nested `proxyGroups`
- ⚠️ **API Changes**: ConfigManager methods now require `groupId` parameter for mock API operations
- ⚠️ **Type Updates**: MockConfig interface now includes `version` and `proxyGroups` fields

### Migration Guide

Existing users will have their configurations automatically migrated on first load after updating to v2.0.0. The old single-proxy configuration will become a new proxy group named "默认配置" (Default Configuration).

**Before (v1.x)**:

```json
{
  "port": 8888,
  "interceptPrefix": "/api",
  "baseUrl": "http://localhost:8080",
  "mockApis": [...]
}
```

**After (v2.0)**:

```json
{
  "version": "2.0",
  "proxyGroups": [
    {
      "id": "uuid-here",
      "name": "默认配置",
      "port": 8888,
      "interceptPrefix": "/api",
      "baseUrl": "http://localhost:8080",
      "enabled": true,
      "mockApis": [...]
    }
  ]
}
```

## [1.0.5] - 2025-01-17

### Added

- ✅ Unit testing infrastructure with Mocha and Chai
- 📊 Code coverage reporting with c8 (targeting 80% coverage)
- 🤖 GitHub Actions CI workflow for automated testing (PR only)
    - Multi-platform testing (Ubuntu, macOS, Windows)
    - Multi-version Node.js testing (18.x, 20.x)
    - Automated linting and test execution
- 📈 Automatic code coverage reports on Pull Requests
    - Coverage metrics (Lines, Branches, Functions, Statements)
    - Coverage change detection compared to base branch
    - Visual indicators (✅ Good ≥80%, ⚠️ Fair 60-79%, ❌ Poor <60%)
- 🔗 Codecov integration for coverage tracking (using GitHub App, no token required)
- 🎖️ Test and Coverage badges in README
- 📚 Comprehensive test suite for i18n module (9 test cases)
- 📖 Testing documentation (CONTRIBUTING.md, TEST_SETUP_SUMMARY.md, RELEASE_PROCESS.md)
- 🌏 Chinese and English README with language switcher

### Improved

- 📝 Updated README with VS Code marketplace badges
- 🎨 Enhanced README with logo and professional layout
- 🔧 Better TypeScript configuration for testing
- 🚀 Automated changelog extraction for release drafts
- ⚡ Tests only run on Pull Requests to save CI resources

### Fixed

- 🔧 Downgraded ESLint from 9.x to 8.x for compatibility with existing configuration format
- 🐛 Fixed ESLint errors in sidebarProvider.ts (unused parameters)
- 🐛 Fixed ESLint prefer-rest-params error in test runner
- 📊 Fixed c8 coverage configuration to properly track compiled JavaScript files
- 🔐 Added proper GitHub Actions permissions for PR comment posting
- ✅ All lint checks and unit tests now passing

## [1.0.4]

### Added

- ✨ Full internationalization (i18n) support for Chinese and English
- 🎨 Custom plugin icon with theme-aware variants (light/dark)
- 📊 VS Code Output panel integration for real-time logging
- 📝 Comprehensive Chinese documentation (readme_zh.md)
- 🛡️ Graceful handling when no workspace folder is open
- 🎯 Graphical UI for Mock API management (add/edit/delete/enable/disable)
- ✅ JSON validation and formatting buttons in Mock API form
- 🔄 Dynamic configuration reload without server restart

### Improved

- 🔧 Enhanced logging with emoji indicators and detailed request tracking
- 🌐 Automatic language detection based on VS Code settings
- 🎯 Better error messages with localized content
- 📦 Optimized VSIX package with proper icon assets
- 🚀 More robust activation with early workspace validation
- 💾 Changed data format from `responseBody` to `mockData` (JetBrains plugin compatible)
- 🎨 Improved checkbox and button spacing in Mock API form
- 📝 Enhanced proxy error logging with detailed error information

### Fixed

- 🐛 VSCode engine version compatibility (support ^1.85.0)
- 🔨 Added missing ESLint dependencies
- 📄 Added MIT License file
- ✅ Fixed activation failure when VS Code is opened without a workspace folder
- 📍 Webview provider now properly registers with retainContextWhenHidden option
- 🔍 Fixed Mock API path matching to strip query parameters
- 🌐 Fixed proxy forwarding with better error reporting (ECONNREFUSED)
- 🔄 Configuration changes now take effect immediately without server restart

## [1.0.0] - 2025-10-15

### Added

- Initial release of Intercept Wave for VSCode
- Mock server with HTTP request interception
- Proxy forwarding to original server
- Visual configuration UI
- Sidebar view for server control
- Support for custom mock responses
- Network delay simulation
- Global cookie support
- Automatic CORS handling
- Prefix stripping for path matching
- Configuration file persistence
