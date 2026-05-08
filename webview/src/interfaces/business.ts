export interface MockApiConfig {
  path: string;
  enabled: boolean;
  mockData: string;
  method: string;
  statusCode: number;
  useCookie?: boolean;
  delay?: number;
}

export type HeaderOverrideOperation = 'ADD' | 'SET' | 'REMOVE';

export interface HeaderOverrideRule {
  name: string;
  value: string;
  operation: HeaderOverrideOperation;
  enabled: boolean;
}

export interface HttpRoute {
  id: string;
  name: string;
  pathPrefix: string;
  targetType?: 'PROXY' | 'STATIC';
  targetBaseUrl: string;
  staticRoot?: string;
  stripPrefix: boolean;
  rewriteTargetPath?: string;
  spaFallbackPath?: string;
  spaFallback?: boolean;
  requestHeaders?: HeaderOverrideRule[];
  responseHeaders?: HeaderOverrideRule[];
  enableMock: boolean;
  mockApis: MockApiConfig[];
}

export type ProxyProtocol = 'HTTP' | 'WS';

export type WsDirection = 'in' | 'out' | 'both';

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

export type WsRuleMode = 'off' | 'periodic' | 'timeline';

export interface ProxyGroup {
  id: string;
  name: string;
  port: number;
  routes?: HttpRoute[];
  stripPrefix: boolean;
  globalCookie: string;
  enabled: boolean;
  interceptPrefix: string;
  baseUrl: string;
  mockApis: MockApiConfig[];
  httpsEnabled?: boolean;
  httpsKeystorePath?: string;
  httpsKeystorePassword?: string;
  protocol?: ProxyProtocol;
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
}

export type GroupStatusMap = Record<string, boolean>;

export type I18nMap = Record<string, string>;

export type GroupDraft = Pick<
  ProxyGroup,
  | 'name'
  | 'enabled'
  | 'port'
  | 'stripPrefix'
  | 'globalCookie'
  | 'protocol'
  | 'wsBaseUrl'
  | 'wsInterceptPrefix'
  | 'wsManualPush'
  | 'httpsEnabled'
  | 'httpsKeystorePath'
  | 'httpsKeystorePassword'
  | 'wssEnabled'
  | 'wssKeystorePath'
  | 'wssKeystorePassword'
>;

export type MockApiDraft = Pick<
  MockApiConfig,
  'enabled' | 'method' | 'path' | 'statusCode' | 'delay' | 'mockData'
>;

export type RouteDraft = Pick<
  HttpRoute,
  'name' | 'pathPrefix' | 'targetType' | 'targetBaseUrl' | 'staticRoot' | 'stripPrefix' | 'rewriteTargetPath' | 'spaFallbackPath' | 'spaFallback' | 'requestHeaders' | 'responseHeaders' | 'enableMock'
>;
