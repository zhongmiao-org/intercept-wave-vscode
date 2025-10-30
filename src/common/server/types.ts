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
    // Future extension hooks (no runtime behavior yet)
    tls?: TLSConfig;
    defaultHeaders?: Record<string, string>;
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

