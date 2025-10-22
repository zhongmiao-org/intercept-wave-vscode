import { describe, it } from 'mocha';
import { expect } from 'chai';
import * as extension from '../../extension';

describe('Extension', () => {
    // Note: Extension activation tests require VSCode extension host environment
    // These are covered by integration tests instead

    describe('module structure', () => {
        it('should export activate function', () => {
            expect(extension.activate).to.be.a('function');
        });

        it('should export deactivate function', () => {
            expect(extension.deactivate).to.be.a('function');
        });
    });
});
