export interface MockApiConfig {
  path: string;
  enabled: boolean;
  mockData: string;
  method: string;
  statusCode: number;
  useCookie?: boolean;
  delay?: number;
}

export interface HttpRoute {
  id: string;
  name: string;
  pathPrefix: string;
  targetBaseUrl: string;
  stripPrefix: boolean;
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
  'name' | 'pathPrefix' | 'targetBaseUrl' | 'stripPrefix' | 'enableMock'
>;
