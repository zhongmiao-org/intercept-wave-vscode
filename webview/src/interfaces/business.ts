export interface MockApiConfig {
  path: string;
  enabled: boolean;
  mockData: string;
  method: string;
  statusCode: number;
  useCookie?: boolean;
  delay?: number;
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
}

export interface MockConfig {
  version: string;
  proxyGroups: ProxyGroup[];
}

export type GroupStatusMap = Record<string, boolean>;

export type I18nMap = Record<string, string>;

export type GroupDraft = Pick<
  ProxyGroup,
  'name' | 'enabled' | 'port' | 'interceptPrefix' | 'baseUrl' | 'stripPrefix' | 'globalCookie'
>;

export type MockApiDraft = Pick<
  MockApiConfig,
  'enabled' | 'method' | 'path' | 'statusCode' | 'delay' | 'mockData'
>;

