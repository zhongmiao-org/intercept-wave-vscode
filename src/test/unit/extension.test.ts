import { describe, it } from 'mocha';
import { expect } from 'chai';

describe('Extension', () => {
    // Note: Extension activation tests require VSCode extension host environment
    // These are covered by integration tests instead

    describe('module structure', () => {
        it('should export activate function', () => {
            const extension = require('../../extension');
            expect(extension.activate).to.be.a('function');
        });

        it('should export deactivate function', () => {
            const extension = require('../../extension');
            expect(extension.deactivate).to.be.a('function');
        });
    });
});