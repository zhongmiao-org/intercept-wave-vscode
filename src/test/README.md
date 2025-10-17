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

Coverage reports are:
- Uploaded to Codecov
- Uploaded to Coveralls
- Commented on pull requests with detailed metrics