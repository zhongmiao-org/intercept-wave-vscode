import type { GroupDraft, HttpRoute, MockApiConfig, MockApiDraft, ProxyGroup, RouteDraft, WsRule } from './business';
import type { GroupSummary } from './ui';

export interface GroupListProps {
  groups: GroupSummary[];
  activeGroupId?: string;
  onSelect: (groupId: string) => void;
  onAddGroup: () => void;
  noGroupsText: string;
}

export interface GroupHeaderProps {
  group: ProxyGroup;
  running: boolean;
  onStart: () => void;
  onStop: () => void;
  onEdit: () => void;
  onDelete: () => void;
  labels: {
    start: string;
    stop: string;
    edit: string;
    delete: string;
  };
}

export interface MockListProps {
  mocks: MockApiConfig[];
  onToggle: (index: number) => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onAdd: () => void;
  labels: {
    mockApis: string;
    addMock: string;
    enable: string;
    disable: string;
    edit: string;
    delete: string;
    emptyText: string;
  };
}

export interface RouteListProps {
  routes: HttpRoute[];
  activeRouteId?: string;
  onSelect: (routeId: string) => void;
  onAdd: () => void;
  onEdit: (routeId: string) => void;
  onDelete: (routeId: string) => void;
  labels: {
    title: string;
    addRoute: string;
    edit: string;
    delete: string;
    emptyText: string;
    enableMock: string;
    disableMock: string;
    mocksLabel?: string;
  };
}

export interface GroupModalProps {
  open: boolean;
  draft: GroupDraft;
  onChange: (next: GroupDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  labels: {
    titleAdd: string;
    titleEdit: string;
    chromeTitle?: string;
    hint?: string;
    listenerExtras?: string;
    close?: string;
    sectionGroup?: string;
    sectionHttp?: string;
    sectionWs?: string;
    name: string;
    enabled: string;
    protocol: string;
    protocolHttp: string;
    protocolWs: string;
    port: string;
    stripPrefix: string;
    globalCookie: string;
    wsBaseUrl: string;
    wsInterceptPrefix: string;
    wsManualPush: string;
    wssEnabled: string;
    wssKeystorePath: string;
    wssKeystorePassword: string;
    yesLabel: string;
    noLabel: string;
    save: string;
    cancel: string;
  };
  isEdit: boolean;
}

export interface WsRuleModalPropsLite {
  open: boolean;
  draft: WsRule;
  onChange: (next: WsRule) => void;
  onSave: () => void;
  onCancel: () => void;
  isEdit: boolean;
}


export interface MockModalProps {
  open: boolean;
  draft: MockApiDraft;
  onChange: (next: MockApiDraft) => void;
  onSave: () => void;
  onFormat: () => void;
  onCancel: () => void;
  labels: {
    titleAdd: string;
    titleEdit: string;
    hint?: string;
    close?: string;
    enabled: string;
    method: string;
    path: string;
    statusCode: string;
    delay: string;
    responseBody: string;
    format: string;
    cancel?: string;
    save: string;
  };
  isEdit: boolean;
}

export interface RouteModalProps {
  open: boolean;
  draft: RouteDraft;
  onChange: (next: RouteDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  labels: {
    titleAdd: string;
    titleEdit: string;
    chromeTitle?: string;
    hint?: string;
    name: string;
    pathPrefix: string;
    targetBaseUrl: string;
    stripPrefix: string;
    enableMock: string;
    yesLabel: string;
    noLabel: string;
    save: string;
    cancel: string;
  };
  isEdit: boolean;
}
