import { expect } from 'chai';
import { matchPathPattern, selectBestMockApiForRequest } from '../../common/server/pathMatcher';

describe('Wildcard path matcher', () => {
    it('matches single-segment * correctly', () => {
        expect(matchPathPattern('/a/b/*', '/a/b/123').matched).to.be.true;
        expect(matchPathPattern('/a/b/*', '/a/b/123/456').matched).to.be.false;
        expect(matchPathPattern('/order/*/submit', '/order/123/submit').matched).to.be.true;
        expect(matchPathPattern('/order/*/submit', '/order/123/456/submit').matched).to.be.false;
    });

    it('matches multi-segment ** correctly', () => {
        expect(matchPathPattern('/a/b/**', '/a/b/123').matched).to.be.true;
        expect(matchPathPattern('/a/b/**', '/a/b/123/456').matched).to.be.true;
        // does not match base path (needs at least one segment)
        expect(matchPathPattern('/a/b/**', '/a/b').matched).to.be.false;
    });

    it('normalizes slashes consistently', () => {
        expect(matchPathPattern('/a/b/*', '/a/b/123/').matched).to.be.false;
        expect(matchPathPattern('/a/b/*', '/a/b/123').matched).to.be.true;
        expect(matchPathPattern('/a/b/**', '/a/b/123/').matched).to.be.true;
    });

    it('selects best mock using priority rules', () => {
        const apis = [
            { path: '/x/y/z', method: 'ALL', enabled: true },
            { path: '/x/*/z', method: 'GET', enabled: true },
            { path: '/x/**', method: 'GET', enabled: true },
        ];

        // Exact path should beat wildcard, even if method is ALL
        const chosenExact = selectBestMockApiForRequest(apis, '/x/y/z', 'GET');
        expect(chosenExact?.path).to.equal('/x/y/z');
        expect(chosenExact?.method).to.equal('ALL');

        // When no exact match, fewer wildcards wins (/** vs /*/*)
        const apis2 = [
            { path: '/x/**/z', method: 'GET', enabled: true }, // 1 wildcard token
            { path: '/x/*/*/z', method: 'GET', enabled: true }, // 2 wildcard tokens
        ];
        const chosenFewer = selectBestMockApiForRequest(apis2, '/x/1/2/z', 'GET');
        expect(chosenFewer?.path).to.equal('/x/**/z');

        // Method-specific beats ALL when other factors tie
        const apis3 = [
            { path: '/a/b/*', method: 'ALL', enabled: true },
            { path: '/a/b/*', method: 'POST', enabled: true },
        ];
        const chosenMethod = selectBestMockApiForRequest(apis3, '/a/b/1', 'POST');
        expect(chosenMethod?.method).to.equal('POST');
    });
});

