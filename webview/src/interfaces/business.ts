export interface MockApiConfig {
  path: string;
  enabled: boolean;
  mockData: string;
  method: string;
  statusCode: number;
  useCookie?: boolean;
  delay?: number;
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
  interceptPrefix: string;
  baseUrl: string;
  stripPrefix: boolean;
  globalCookie: string;
  enabled: boolean;
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
  | 'interceptPrefix'
  | 'baseUrl'
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
