# Change Log

All notable changes to the "intercept-wave" extension will be documented in this file.

## [1.0.5] - 2025-01-16

### Added
- ✅ Unit testing infrastructure with Mocha, Chai, and Sinon
- 📊 Code coverage reporting with c8 (targeting 80% coverage)
- 🤖 GitHub Actions CI workflow for automated testing
  - Multi-platform testing (Ubuntu, macOS, Windows)
  - Multi-version Node.js testing (18.x, 20.x)
  - Automated linting and test execution
- 📈 Automatic code coverage reports on Pull Requests
  - Coverage metrics (Lines, Branches, Functions, Statements)
  - Coverage change detection compared to base branch
  - Visual indicators (✅ Good ≥80%, ⚠️ Fair 60-79%, ❌ Poor <60%)
- 🔗 Codecov integration for coverage tracking (using GitHub App)
- 🎖️ Test and Coverage badges in README
- 📚 Comprehensive test suite for ConfigManager and i18n modules (25 test cases)
- 📖 Testing documentation (CONTRIBUTING.md, TEST_SETUP_SUMMARY.md)
- 🌏 Chinese and English README with language switcher

### Improved
- 📝 Updated README with VS Code marketplace badges
- 🎨 Enhanced README with logo and professional layout
- 🔧 Better TypeScript configuration for testing
- 🚀 Automated changelog extraction for release drafts

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