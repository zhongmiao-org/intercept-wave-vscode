import { expect } from 'chai';
import {
    computeHttpForwardPath,
    computeHttpMatchPath,
    computeHttpSpaFallbackPath,
    selectHttpRoute,
    shouldServeRouteWelcomePage,
} from '../../common';

describe('httpRouteUtils', () => {
    const routeRoot = {
        id: 'r0',
        name: 'Root',
        pathPrefix: '/',
        targetBaseUrl: 'http://root',
        stripPrefix: false,
        enableMock: true,
        mockApis: [],
    };

    const routeApi = {
        id: 'r1',
        name: 'Api',
        pathPrefix: '/api/',
        targetBaseUrl: 'http://api',
        stripPrefix: true,
        enableMock: true,
        mockApis: [],
    };

    const routeApiV2 = {
        id: 'r2',
        name: 'ApiV2',
        pathPrefix: '/api/v2',
        targetBaseUrl: 'http://api2',
        stripPrefix: true,
        enableMock: true,
        mockApis: [],
    };

    it('selects the longest matching route and falls back when there is one route', () => {
        const group = { routes: [routeRoot, routeApi, routeApiV2] } as any;
        expect(selectHttpRoute(group, '/api/v2/users')?.id).to.equal('r2');
        expect(selectHttpRoute(group, '/api')?.id).to.equal('r1');
        expect(selectHttpRoute(group, '/docs')?.id).to.equal('r0');
        expect(selectHttpRoute(group, '/dashboard/settings')?.id).to.equal('r0');
        expect(selectHttpRoute({ routes: [routeApi] } as any, '/no-match')?.id).to.equal('r1');
    });

    it('returns undefined when there are multiple routes and none match', () => {
        expect(selectHttpRoute({ routes: [routeApi, routeApiV2] } as any, '/other')).to.equal(undefined);
    });

    it('computes paths with and without stripping prefix', () => {
        expect(computeHttpMatchPath(routeApi as any, '/api/users')).to.equal('/users');
        expect(computeHttpForwardPath(routeApi as any, '/api')).to.equal('/');
        expect(computeHttpMatchPath({ ...routeApi, stripPrefix: false } as any, '/api/users')).to.equal('/api/users');
        expect(computeHttpForwardPath(routeRoot as any, '')).to.equal('/');
    });

    it('applies rewrite target path after stripping prefix for mock matching and forwarding', () => {
        const rewriteRoute = { ...routeApi, pathPrefix: '/backend', rewriteTargetPath: '/v1' };

        expect(computeHttpMatchPath(rewriteRoute as any, '/backend/users')).to.equal('/v1/users');
        expect(computeHttpForwardPath(rewriteRoute as any, '/backend/users')).to.equal('/v1/users');
    });

    it('keeps existing behavior when no rewrite target path is configured', () => {
        expect(computeHttpMatchPath({ ...routeApi, rewriteTargetPath: '' } as any, '/api/users')).to.equal('/users');
        expect(computeHttpForwardPath({ ...routeApi, rewriteTargetPath: undefined } as any, '/api/users')).to.equal('/users');
    });

    it('preserves query strings after route rewrite', () => {
        const rewriteRoute = { ...routeApi, pathPrefix: '/backend', rewriteTargetPath: '/v1/' };

        expect(computeHttpMatchPath(rewriteRoute as any, '/backend/users?active=true')).to.equal('/v1/users?active=true');
        expect(computeHttpForwardPath(rewriteRoute as any, '/backend?active=true')).to.equal('/v1?active=true');
    });

    it('treats root rewrite target path as no extra rewrite base', () => {
        expect(computeHttpForwardPath({ ...routeApi, rewriteTargetPath: '/' } as any, '/api/users')).to.equal('/users');
    });

    it('computes SPA fallback target paths through the same strip and rewrite rules', () => {
        expect(computeHttpSpaFallbackPath(routeRoot as any)).to.equal('/index.html');
        expect(computeHttpSpaFallbackPath(routeApi as any)).to.equal('/index.html');
        expect(computeHttpSpaFallbackPath({ ...routeApi, stripPrefix: false } as any)).to.equal('/api/index.html');
        expect(computeHttpSpaFallbackPath({ ...routeApi, rewriteTargetPath: '/app' } as any)).to.equal('/app/index.html');
    });

    it('serves welcome page only for stripped non-root prefixes', () => {
        expect(shouldServeRouteWelcomePage(routeApi as any, '/api')).to.equal(true);
        expect(shouldServeRouteWelcomePage(routeApi as any, '/api/')).to.equal(true);
        expect(shouldServeRouteWelcomePage(routeApi as any, '/api/users')).to.equal(false);
        expect(shouldServeRouteWelcomePage({ ...routeApi, stripPrefix: false } as any, '/api')).to.equal(false);
        expect(shouldServeRouteWelcomePage(routeRoot as any, '/')).to.equal(false);
    });
});
