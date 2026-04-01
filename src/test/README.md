# Tests

This directory contains all tests for the Intercept Wave VSCode extension.

## Test Structure

```
test/
├── unit/              # Unit tests for individual modules
│   ├── configManager.test.ts
│   └── i18n.test.ts
└── README.md         # This file
```

## Running Tests

### Run all unit tests
```bash
npm run test:unit
```

### Run Docker-backed integration tests
```bash
docker compose -f docker/docker-compose.upstream.yml up -d upstream
npm run test:integration
```

The integration suite expects:
- `IW_UPSTREAM_HTTP` (default: `http://localhost:9000`)
- `IW_UPSTREAM_WS` (default: `ws://localhost:9003`)

If upstream is not running, the suite fails fast and prints the Docker startup command.

### Run VS Code extension-host tests
```bash
npm run test:vscode-integration
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run tests with coverage (CI mode)
```bash
npm run test:coverage:ci
```

## Writing Tests

Tests are written using:
- **Mocha**: Test framework
- **Chai**: Assertion library
- **Sinon**: Mocking and stubbing library
- **c8**: Code coverage tool

Integration tests additionally use:
- **Docker Compose**: starts `intercept-wave-upstream`
- **ws**: real WebSocket client/server bridge verification

### Example Test

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

    it('should do something', () => {
        // Arrange
        const input = 'test';

        // Act
        const result = myFunction(input);

        // Assert
        expect(result).to.equal('expected');
    });
});
```

## Coverage Thresholds

The project aims for the following coverage thresholds:
- Lines: 80%
- Functions: 80%
- Branches: 80%
- Statements: 80%

## CI/CD

Tests run automatically on:
- Push to main branch
- Pull requests

CI is split into:
- Cross-platform unit test matrix (`lint` + `test:unit`)
- Ubuntu Docker integration job (`test:integration`)

Coverage reports are:
- Uploaded to Codecov
- Commented on pull requests with detailed metrics
