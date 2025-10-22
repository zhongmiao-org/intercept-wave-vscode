# Change Log

All notable changes to the "intercept-wave" extension will be documented in this file.

## [Unreleased]

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
    - **Zero Dependencies**: Completely eliminated `node_modules` from package (bundled into single file)
    - **Dramatic Size Reduction**: Reduced from 1,087 files (1.35MB) to **13 files (65KB)** - **98% reduction!**
    - **Performance**: Single 21KB bundled JavaScript file vs 533 separate JS files previously
    - **Build System**:
        - Added `esbuild.js` configuration for production bundling
        - Updated `package.json` main entry to `./dist/extension.js`
        - New scripts: `npm run package` (production build), `npm run package:watch` (watch mode)
        - Updated `copy-templates.js` to copy templates to both `out/` (for tests) and `dist/` (for bundled extension)
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
