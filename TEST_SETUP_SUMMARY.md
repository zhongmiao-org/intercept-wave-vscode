# Test Setup Summary

This document summarizes the testing infrastructure added to the Intercept Wave VSCode extension.

## 📦 What Was Added

### 1. Testing Dependencies (package.json)

Added the following dev dependencies:
- `mocha` - Test framework
- `chai` - Assertion library
- `@types/chai` - TypeScript types for Chai
- `sinon` - Mocking and stubbing library
- `@types/sinon` - TypeScript types for Sinon
- `@types/mocha` - TypeScript types for Mocha
- `c8` - Code coverage tool
- `ts-node` - TypeScript execution environment

### 2. Test Scripts (package.json)

```json
{
  "test:unit": "mocha --require ts-node/register 'src/test/unit/**/*.test.ts'",
  "test:coverage": "c8 --reporter=lcov --reporter=text npm run test:unit",
  "test:coverage:ci": "c8 --reporter=lcov --reporter=text --reporter=json-summary npm run test:unit"
}
```

### 3. Configuration Files

#### `.mocharc.json`
Mocha test framework configuration:
- Registers ts-node for TypeScript support
- Specifies test file patterns
- Configures test extensions

#### `.c8rc.json`
Coverage tool configuration:
- Includes all source files
- Excludes test files from coverage
- Sets coverage thresholds to 80%
- Configures multiple reporters (text, lcov, json-summary, cobertura)

### 4. Test Files

#### `src/test/unit/configManager.test.ts`
Comprehensive test suite for ConfigManager:
- Constructor tests
- Config CRUD operations
- File I/O operations
- Error handling
- Default value handling
- Mock API management

**Coverage**: 13 test cases covering:
- Configuration initialization
- Reading/writing config files
- Adding/removing/updating mock APIs
- Error scenarios
- Default config merging

#### `src/test/unit/i18n.test.ts`
Comprehensive test suite for i18n module:
- Translation function tests
- Locale detection
- Placeholder replacement
- Fallback behavior
- Multi-language support

**Coverage**: 12 test cases covering:
- English and Chinese translations
- Locale variants (zh-CN, zh-TW, etc.)
- Missing translation fallback
- Placeholder substitution
- Case-insensitive locale detection

### 5. GitHub Actions CI Workflow

#### `.github/workflows/test.yml`

**Features**:
- **Multi-platform testing**: Ubuntu, macOS, Windows
- **Multi-version testing**: Node.js 18.x and 20.x
- **Automated linting**: Runs ESLint on all source files
- **Coverage reporting**:
  - Uploads to Codecov
  - Uploads to Coveralls
  - Posts detailed report on PRs

**Jobs**:

1. **test** - Runs unit tests on all platforms and Node versions
2. **coverage** - Generates coverage report and posts PR comment (PR only)

**PR Comment Features**:
- 📊 Displays coverage metrics (Lines, Branches, Functions, Statements)
- 📈/📉 Shows coverage changes compared to base branch
- ✅/⚠️/❌ Visual indicators for coverage quality
- 🎉 Congratulatory message when coverage increases

### 6. Documentation

#### `src/test/README.md`
Test directory documentation explaining:
- Test structure
- How to run tests
- How to write tests
- Coverage thresholds
- CI/CD integration

#### `CONTRIBUTING.md`
Complete contributor guide covering:
- Development setup
- Testing guide
- Code coverage requirements
- CI/CD workflows
- PR process
- Example coverage reports

### 7. Updated Files

#### `.gitignore`
Added exclusions for:
- `coverage/` - Coverage reports
- `.nyc_output/` - NYC coverage data
- `*.lcov` - LCOV coverage files
- `.test-config/` - Test temporary files

#### `README.md` & `README_zh.md`
Added badges:
- ![Test](https://github.com/zhongmiao-org/intercept-wave-vscode/workflows/Test/badge.svg)
- ![Coverage Status](https://coveralls.io/repos/github/zhongmiao-org/intercept-wave-vscode/badge.svg?branch=main)

## 🚀 Quick Start

### Install Dependencies
```bash
npm install
```

### Run Tests
```bash
# Run unit tests only
npm run test:unit

# Run tests with coverage
npm run test:coverage

# Run tests with CI coverage format
npm run test:coverage:ci
```

### View Coverage Report
After running `npm run test:coverage`, open:
```
coverage/lcov-report/index.html
```

## 📊 Coverage Goals

We aim for **80% coverage** across all metrics:
- ✅ Lines: 80%
- ✅ Functions: 80%
- ✅ Branches: 80%
- ✅ Statements: 80%

## 🔄 CI/CD Integration

### On Push to Main
- Runs tests on all platforms
- Generates coverage report
- Uploads to Codecov and Coveralls

### On Pull Request
- Runs tests on all platforms
- Generates coverage report
- Posts coverage comment with:
  - Current coverage metrics
  - Coverage changes
  - Visual quality indicators
  - Congratulatory message (if improved)

## 📝 Example PR Coverage Comment

```markdown
## 📊 Code Coverage Report

| Metric | Coverage | Change |
|--------|----------|--------|
| ✅ Lines | 85.50% | 📈 +2.30% |
| ✅ Branches | 82.00% | 📈 +1.50% |
| ✅ Functions | 88.00% | ➡️ +0.00% |
| ✅ Statements | 85.20% | 📈 +2.20% |

### Coverage Thresholds
- ✅ Good: ≥ 80%
- ⚠️ Fair: 60-79%
- ❌ Poor: < 60%

🎉 **Great job!** Coverage increased by 2.30%
```

## 🎯 Next Steps

1. **Install dependencies**: `npm install`
2. **Run tests**: `npm run test:coverage`
3. **Review coverage**: Check `coverage/lcov-report/index.html`
4. **Write more tests**: Add tests for remaining modules
5. **Create PR**: Push changes and see coverage report in PR comments

## 📚 Additional Resources

- [Mocha Documentation](https://mochajs.org/)
- [Chai Assertion Library](https://www.chaijs.com/)
- [Sinon Mocking Library](https://sinonjs.org/)
- [c8 Coverage Tool](https://github.com/bcoe/c8)

## 🐛 Troubleshooting

### Tests not running?
- Ensure all dependencies are installed: `npm install`
- Check Node.js version: `node -v` (should be 18.x or 20.x)
- Compile TypeScript: `npm run compile`

### Coverage not generating?
- Ensure c8 is installed: `npm list c8`
- Check .c8rc.json configuration
- Try running: `npx c8 npm run test:unit`

### CI failing?
- Check GitHub Actions logs
- Ensure all tests pass locally
- Verify lint passes: `npm run lint`

## 📞 Support

If you encounter issues:
1. Check the [CONTRIBUTING.md](./CONTRIBUTING.md) guide
2. Review existing [Issues](https://github.com/zhongmiao-org/intercept-wave-vscode/issues)
3. Create a new issue with details

---

**Last Updated**: 2025-01-16
**Test Framework**: Mocha + Chai + Sinon + c8
**Coverage Tool**: c8
**CI Platform**: GitHub Actions