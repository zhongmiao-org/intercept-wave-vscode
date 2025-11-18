export interface MockApiConfig {
    path: string;
    enabled: boolean;
    mockData: string; // JSON string (compatible with JetBrains plugin)
    method: string;
    statusCode: number;
    useCookie?: boolean;
    delay?: number;
    // Future extension hooks (no runtime behavior yet)
    headers?: Record<string, string>;
    templateId?: string;
    overrides?: Record<string, any>;
}

export type WsDirection = 'in' | 'out' | 'both';

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
    timeline?: number[];
    loop?: boolean;
    onOpenFire?: boolean;
}

export type WsRuleMode = 'off' | 'periodic' | 'timeline';

export type WsManualTarget = 'match' | 'all' | 'recent';

export interface TLSConfig {
    enabled: boolean;
    keyPath: string;
    certPath: string;
    passphrase?: string;
}

export type ProxyProtocol = 'HTTP' | 'WS';

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
