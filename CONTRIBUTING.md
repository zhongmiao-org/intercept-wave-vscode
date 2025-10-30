# Contributing to Intercept Wave

Thank you for your interest in contributing to Intercept Wave! This document provides guidelines for development and testing.

## Development Setup

### Prerequisites

- Node.js 18.x or 20.x
- npm
- VS Code

### Getting Started

1. Clone the repository

```bash
git clone https://github.com/zhongmiao-org/intercept-wave-vscode.git
cd intercept-wave-vscode
```

2. Install dependencies

```bash
npm install
```

3. Compile the extension (Node build + copy static)

```bash
npm run compile
```

4. Open in VS Code

```bash
code .
```

5. Start Webview in watch mode (optional, recommended for UI work)

```bash
npm run webview:watch
```

6. Press `F5` to run the extension in development mode

Tip: run a standalone Webview dev server without VS Code:

```bash
npm run webview:dev
# open http://127.0.0.1:5173
```

This uses a stubbed `acquireVsCodeApi()` and injected INITIAL_STATE for quick UI iteration.

### Project Structure

```
src/
  common/
    server/
      types.ts            # MockApiConfig/ProxyGroup/MockConfig (backend types)
      mockServer.ts
      pathMatcher.ts
    utils/
      json.ts             # tolerant JSON parse/stringify
      webviewHtml.ts      # buildReactWebviewHtml helper (CSP-safe)
  providers/
    sidebarProvider.ts    # loads React Webview HTML via helper
  extension.ts            # no-workspace fallback loads React Webview too

webview/
  src/
    interfaces/
      business.ts         # UI-facing business entities (MockApiConfig, ...)
      ui.ts               # InitialState, GroupSummary, VsCodeApi
      ui.components.ts    # Props types for UI components
    components/           # Small, focused React components
    app.tsx               # Composes components, posts messages
    index.tsx             # Boot entry, message bridge
  dev/index.html          # Local dev shell (stub API)
```

Notes:
- Do not declare interfaces inside `.tsx` files. Put them under `webview/src/interfaces/*`.
- Avoid using TemplateLoader (removed). Use `buildReactWebviewHtml` to generate Webview HTML.
- Prefer `import type { ... }` for types.

## Testing

### Running Tests

We use Mocha, Chai, and Sinon for unit testing, and c8 for code coverage.

#### Run all unit tests

```bash
npm run test:unit
```

#### Run tests with coverage

```bash
npm run test:coverage
```

#### Run tests in watch mode (for development)

```bash
npm run test:unit -- --watch
```

### Writing Tests

Tests should be placed in `src/test/unit/` directory with the `.test.ts` extension.

Example test structure:

```typescript
import { expect } from 'chai';
import * as sinon from 'sinon';

describe('MyModule', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('myFunction', () => {
        it('should return expected result', () => {
            // Arrange
            const input = 'test';

            // Act
            const result = myFunction(input);

            // Assert
            expect(result).to.equal('expected');
        });
    });
});
```

### Code Coverage

We aim for the following coverage thresholds:

- Lines: 80%
- Functions: 80%
- Branches: 80%
- Statements: 80%

Coverage reports are generated in the `coverage/` directory:

- `coverage/lcov-report/index.html` - HTML coverage report
- `coverage/coverage-summary.json` - JSON summary

## Continuous Integration

### GitHub Actions Workflows

We have automated CI/CD workflows:

1. **Test Workflow** (`.github/workflows/test.yml`)
    - Runs on push to main and pull requests
    - Tests on multiple OS (Ubuntu, macOS, Windows)
    - Tests on Node.js 18.x and 20.x
    - Generates coverage reports
    - Posts coverage comments on PRs

2. **Build Workflow** (`.github/workflows/build.yml`)
    - Builds and packages the extension
    - Creates draft releases

### Pull Request Process

When you create a pull request:

1. **Automated Checks**
    - All tests must pass
    - Linting must pass
    - Tests run on all supported platforms

2. **Coverage Report**
    - A coverage report will be automatically posted as a PR comment
    - Shows coverage for Lines, Branches, Functions, and Statements
    - Displays coverage changes compared to the base branch
    - Indicates if coverage increased, decreased, or stayed the same

3. **Coverage Badges**
    - ✅ Good: ≥ 80%
    - ⚠️ Fair: 60-79%
    - ❌ Poor: < 60%

### Example Coverage Report

The PR comment will look like:

```markdown
## 📊 Code Coverage Report

| Metric        | Coverage | Change    |
| ------------- | -------- | --------- |
| ✅ Lines      | 85.50%   | 📈 +2.30% |
| ✅ Branches   | 82.00%   | 📈 +1.50% |
| ✅ Functions  | 88.00%   | ➡️ +0.00% |
| ✅ Statements | 85.20%   | 📈 +2.20% |

### Coverage Thresholds

- ✅ Good: ≥ 80%
- ⚠️ Fair: 60-79%
- ❌ Poor: < 60%

🎉 **Great job!** Coverage increased by 2.30%
```

## Code Style

- TypeScript + ESLint. Run `npm run lint` before pushing.
- React components should stay small and focused; lift shared types into `webview/src/interfaces`.
- Keep backend vs UI types separate (`src/common/server/types.ts` vs `webview/src/interfaces`).
- Use the shared JSON utils for tolerant parsing; do not duplicate JSON pipelines.
- Webview HTML must be created via `buildReactWebviewHtml` to ensure CSP-safe nonce and font URIs.

## Build, Package, VSIX

- Dev compile: `npm run compile`
- Watch (extension host): `npm run package:watch`
- Webview watch: `npm run webview:watch`
- One-off Webview build: `npm run webview:build`
- Lint: `npm run lint`
- Unit tests: `npm run test:unit`
- All tests: `npm run test`
- Create VSIX: `npm run build:local` (produces `intercept-wave-<version>.vsix`)

## Commit Messages

Follow conventional commit format:

- `feat: Add new feature`
- `fix: Fix bug`
- `docs: Update documentation`
- `test: Add or update tests`
- `chore: Update build config`

## Questions?

If you have questions, feel free to:

- Open an [Issue](https://github.com/zhongmiao-org/intercept-wave-vscode/issues)
- Start a [Discussion](https://github.com/zhongmiao-org/intercept-wave-vscode/discussions)

Thank you for contributing!
