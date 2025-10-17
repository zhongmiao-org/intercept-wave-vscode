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

3. Compile the extension
```bash
npm run compile
```

4. Open in VS Code
```bash
code .
```

5. Press `F5` to run the extension in development mode

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

## Code Style

- Follow TypeScript best practices
- Use ESLint for linting: `npm run lint`
- Use meaningful variable and function names
- Add comments for complex logic

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