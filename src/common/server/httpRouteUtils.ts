import { HttpRoute, ProxyGroup } from '../interfaces';

function normalizePathPrefix(prefix: string): string {
    if (!prefix || prefix.trim() === '') return '/';
    if (prefix === '/') return '/';
    while (prefix.endsWith('/')) {
        prefix = prefix.slice(0, -1);
    }
    return prefix || '/';
}

function routeMatches(route: HttpRoute, requestPath: string): boolean {
    const prefix = normalizePathPrefix(route.pathPrefix);
    return prefix === '/' || requestPath.startsWith(prefix);
}

function computePathWithOptionalStrip(requestPath: string, prefix: string, stripPrefix: boolean): string {
    if (!stripPrefix || prefix === '/') {
        return requestPath || '/';
    }
    if (requestPath.startsWith(prefix)) {
        const stripped = requestPath.substring(prefix.length);
        return stripped || '/';
    }
    return requestPath || '/';
}

export function selectHttpRoute(group: ProxyGroup, requestPath: string): HttpRoute | undefined {
    const routes = group.routes || [];
    const candidates = routes
        .map((route, index) => ({ route, index }))
        .filter(({ route }) => routeMatches(route, requestPath));

    if (candidates.length === 0) {
        return routes.length === 1 ? routes[0] : undefined;
    }

    candidates.sort((a, b) => {
        const aLen = normalizePathPrefix(a.route.pathPrefix).length;
        const bLen = normalizePathPrefix(b.route.pathPrefix).length;
        if (aLen !== bLen) return bLen - aLen;
        return a.index - b.index;
    });

    return candidates[0]?.route;
}

export function computeHttpMatchPath(route: HttpRoute, requestPath: string): string {
    return computePathWithOptionalStrip(requestPath, normalizePathPrefix(route.pathPrefix), route.stripPrefix);
}

export function computeHttpForwardPath(route: HttpRoute, requestPath: string): string {
    return computePathWithOptionalStrip(requestPath, normalizePathPrefix(route.pathPrefix), route.stripPrefix);
}

export function shouldServeRouteWelcomePage(route: HttpRoute, requestPath: string): boolean {
    if (!route.stripPrefix) return false;
    const prefix = normalizePathPrefix(route.pathPrefix);
    if (prefix === '/') return false;
    return requestPath === prefix || requestPath === `${prefix}/`;
}
