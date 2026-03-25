import type { WsDirection, WsRuleMode, ProxyProtocol } from '../types';

export interface MockApiConfig {
    path: string;
    enabled: boolean;
    mockData: string; // JSON string (compatible with JetBrains plugin)
    method: string;
    statusCode: number;
    useCookie?: boolean;
    delay?: number;
    contentType?: string; // Response content type (application/json, text/html, etc.)
    responseFile?: string; // Relative path to a file in workspace for response content (takes precedence over mockData)
    // Future extension hooks (no runtime behavior yet)
    headers?: Record<string, string>;
    templateId?: string;
    overrides?: Record<string, any>;
}

/**
 * HTTP Proxy configuration
 * - id: Unique identifier for the proxy
 * - name: Display name for the proxy
 * - enabled: Whether the proxy is active
 * - interceptPrefix: URL prefix to intercept (e.g., "/api")
 * - baseUrl: Target server URL to forward requests to
 * - stripPrefix: Whether to remove the interceptPrefix from forwarded requests
 * - globalCookie: Cookie string to include in forwarded requests
 * - mockApis: List of mock API configurations for this proxy
 * - priority: Matching priority (lower value = higher priority). When multiple proxies match the same path, the one with the lowest priority value is selected.
 */
export interface HttpProxy {
    id: string;
    name: string;
    enabled: boolean;
    interceptPrefix: string;
    baseUrl: string;
    stripPrefix: boolean;
    globalCookie: string;
    mockApis?: MockApiConfig[];
    priority?: number;
}

export interface WsTimelineItem {
    atMs: number;
    message: string;
}

export interface WsRule {
    enabled: boolean;
    path: string;
    eventKey?: string;
    eventValue?: string;
    direction: WsDirection;
    intercept?: boolean;
    mode: WsRuleMode;
    periodSec?: number;
    message: string;
    timeline?: WsTimelineItem[];
    loop?: boolean;
    onOpenFire?: boolean;
}

export interface TLSConfig {
    enabled: boolean;
    keyPath: string;
    certPath: string;
    passphrase?: string;
}

export interface ProxyGroup {
    id: string;
    name: string;
    port: number;
    interceptPrefix: string;
    baseUrl: string;
    stripPrefix: boolean;
    globalCookie: string;
    enabled: boolean;
    mockApis: MockApiConfig[];
    httpProxies?: HttpProxy[];
    // Future extension hooks (no runtime behavior yet)
    tls?: TLSConfig;
    defaultHeaders?: Record<string, string>;

    // v3 shared config fields (must stay in sync with Kotlin project)
    protocol?: ProxyProtocol; // defaults to 'HTTP' when omitted
    wsBaseUrl?: string | null;
    wsInterceptPrefix?: string | null;
    wsManualPush?: boolean;
    wsPushRules?: WsRule[];
    wssEnabled?: boolean;
    wssKeystorePath?: string | null;
    wssKeystorePassword?: string | null;
}

export interface MockConfig {
    version: string;
    proxyGroups: ProxyGroup[];
    // Legacy fields for backward compatibility
    port?: number;
    interceptPrefix?: string;
    baseUrl?: string;
    stripPrefix?: boolean;
    globalCookie?: string;
    mockApis?: MockApiConfig[];
}
