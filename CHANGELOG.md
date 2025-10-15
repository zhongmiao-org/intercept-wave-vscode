# Change Log

All notable changes to the "intercept-wave" extension will be documented in this file.

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