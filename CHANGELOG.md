# Change Log

All notable changes to the "intercept-wave" extension will be documented in this file.

## [Unreleased]

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