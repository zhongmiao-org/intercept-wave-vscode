import type { GroupStatusMap, I18nMap, MockConfig } from './business';

export interface InitialState {
  config: MockConfig;
  activeGroupId?: string;
  isRunning: boolean;
  groupStatuses: GroupStatusMap;
  i18n: I18nMap;
  viewKind?: 'sidebar' | 'panel';
  panelAction?: { type: string; groupId?: string; index?: number } | null;
}

export interface GroupSummary {
  id: string;
  name: string;
  port: number;
  running: boolean;
}

export interface VsCodeApi {
  postMessage: (message: unknown) => void;
  getState?: () => unknown;
  setState?: (state: unknown) => void;
}

export type IWWindow = Window & {
  acquireVsCodeApi?: () => VsCodeApi;
  __IW_INITIAL_STATE__?: InitialState;
  __IW_HAS_VSCODE__?: boolean;
  __IW_VSCODE__?: VsCodeApi;
};
