import React, { useCallback, useMemo, useState } from 'react';
import { GroupDraft, HttpRoute, MockApiDraft, ProxyGroup, RouteDraft, WsRule } from './interfaces/business';
import { InitialState, IWWindow, VsCodeApi } from './interfaces/ui';
import { GroupModal } from './components/GroupModal';
import { MockModal } from './components/MockModal';
import { RouteList } from './components/RouteList';
import { RouteModal } from './components/RouteModal';
import { WsPushPanel, WsManualTarget } from './components/WsPushPanel';
import { WsRuleModal } from './components/WsRuleModal';

function useVscode(): VsCodeApi {
  try {
    const w = window as unknown as IWWindow;
    const api = (w.__IW_VSCODE__ || (w.acquireVsCodeApi ? w.acquireVsCodeApi() : ({ postMessage: (_: unknown) => {} } as VsCodeApi)));
    return {
      postMessage: (message: unknown) => {
        try { (api as any).postMessage(message); } catch {}
      },
      getState: (api as any).getState?.bind(api),
      setState: (api as any).setState?.bind(api),
    } as VsCodeApi;
  } catch {
    return { postMessage: (_: unknown) => {} } as VsCodeApi;
  }
}

function parseJsonSmart(raw: string): unknown {
  const text = (raw ?? '').trim();
  if (!text) throw new Error('Empty JSON');
  try {
    return JSON.parse(text);
  } catch {
    function stripComments(input: string): string {
      let out = '';
      let i = 0;
      let inSingle = false;
      let inDouble = false;
      let inTemplate = false;
      let inLineComment = false;
      let inBlockComment = false;
      while (i < input.length) {
        const ch = input[i];
        const next = input[i + 1];
        if (inLineComment) {
          if (ch === '\n') {
            inLineComment = false;
            out += ch;
          }
          i += 1;
          continue;
        }
        if (inBlockComment) {
          if (ch === '*' && next === '/') {
            inBlockComment = false;
            i += 2;
            continue;
          }
          i += 1;
          continue;
        }
        if (!inSingle && !inDouble && !inTemplate) {
          if (ch === '/' && next === '/') {
            inLineComment = true;
            i += 2;
            continue;
          }
          if (ch === '/' && next === '*') {
            inBlockComment = true;
            i += 2;
            continue;
          }
        }
        if (!inDouble && !inTemplate && ch === "'" && input[i - 1] !== '\\') {
          inSingle = !inSingle;
          out += ch;
          i += 1;
          continue;
        }
        if (!inSingle && !inTemplate && ch === '"' && input[i - 1] !== '\\') {
          inDouble = !inDouble;
          out += ch;
          i += 1;
          continue;
        }
        if (!inSingle && !inDouble && ch === '`' && input[i - 1] !== '\\') {
          inTemplate = !inTemplate;
          out += ch;
          i += 1;
          continue;
        }
        out += ch;
        i += 1;
      }
      return out;
    }

    function removeTrailingCommas(input: string) {
      return input.replace(/,\s*(?=[}\]])/g, '');
    }

    function quoteUnquotedKeys(input: string) {
      return input.replace(/([,{]\s*)([A-Za-z_$][\w$-]*)(\s*):/g, (m: string, p1: string, key: string, p3: string) => {
        if (key.startsWith('"') || key.startsWith("'")) return m;
        return `${p1}"${key}"${p3}:`;
      });
    }

    function convertSingleQuotedStrings(input: string) {
      return input.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_m, inner) => {
        let content = String(inner);
        content = content.replace(/\\'/g, "'");
        content = content.replace(/\\/g, '\\\\');
        content = content.replace(/"/g, '\\"');
        return `"${content}"`;
      });
    }

    let s = stripComments(text);
    s = convertSingleQuotedStrings(s);
    s = quoteUnquotedKeys(s);
    s = removeTrailingCommas(s);
    return JSON.parse(s);
  }
}

function createDefaultGroupDraft(): GroupDraft {
  return {
    name: '',
    enabled: true,
    port: 8888,
    stripPrefix: true,
    globalCookie: '',
    protocol: 'HTTP',
    wsBaseUrl: null,
    wsInterceptPrefix: null,
    wsManualPush: true,
    wssEnabled: false,
    wssKeystorePath: null,
    wssKeystorePassword: null,
  };
}

function createDefaultRouteDraft(name = 'API'): RouteDraft {
  return {
    name,
    pathPrefix: '/api',
    targetBaseUrl: 'http://localhost:8080',
    stripPrefix: true,
    enableMock: true,
  };
}

function createDefaultMockDraft(): MockApiDraft {
  return { enabled: true, method: 'GET', path: '/', statusCode: 200, delay: 0, mockData: '{"ok":true}' };
}

export function App({ state, setState }: { state: InitialState; setState: (s: InitialState) => void }) {
  const vscode = useVscode();

  const t = useCallback((k: string) => {
    const v = (state.i18n && (state.i18n as any)[k]) as string | undefined;
    if (!v || v === k || /^[a-z]+\./i.test(v)) return '';
    return v;
  }, [state.i18n]);

  const Icon = ({ name, color }: { name: string; color?: string }) => (
    <span className={`codicon codicon-${name}`} style={{ color }} />
  );

  const panelPaneStyle: React.CSSProperties = {
    display: 'grid',
    gap: 12,
    alignContent: 'start',
    minWidth: 0,
    padding: 12,
    borderRadius: 8,
    border: '1px solid var(--vscode-panel-border)',
    background: 'color-mix(in srgb, var(--vscode-editor-background) 92%, var(--vscode-sideBar-background))',
    boxShadow: '0 1px 0 rgba(0, 0, 0, 0.12)',
  };

  const SectionCard = ({
    title,
    subtitle,
    action,
    children,
  }: {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <section
      style={{
        background: 'var(--vscode-editor-background)',
        border: '1px solid var(--vscode-panel-border)',
        borderRadius: 8,
        padding: 14,
        boxShadow: '0 1px 0 rgba(0, 0, 0, 0.12)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--vscode-descriptionForeground)', marginBottom: 4 }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--vscode-descriptionForeground)' }}>
              {subtitle}
            </div>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );

  const StatBadge = ({ label, value, tone = 'neutral' }: { label: string; value: string | number; tone?: 'neutral' | 'success' | 'muted' }) => {
    const toneStyle = tone === 'success'
      ? {
        background: 'color-mix(in srgb, var(--vscode-testing-iconPassed) 16%, transparent)',
        border: 'color-mix(in srgb, var(--vscode-testing-iconPassed) 40%, var(--vscode-panel-border))',
        color: 'var(--vscode-foreground)',
      }
      : tone === 'muted'
        ? {
          background: 'color-mix(in srgb, var(--vscode-descriptionForeground) 10%, transparent)',
          border: 'color-mix(in srgb, var(--vscode-descriptionForeground) 26%, var(--vscode-panel-border))',
          color: 'var(--vscode-descriptionForeground)',
        }
        : {
          background: 'color-mix(in srgb, var(--vscode-button-background) 14%, transparent)',
          border: 'color-mix(in srgb, var(--vscode-button-background) 32%, var(--vscode-panel-border))',
          color: 'var(--vscode-foreground)',
        };

    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          borderRadius: 999,
          border: `1px solid ${toneStyle.border}`,
          background: toneStyle.background,
          color: toneStyle.color,
          fontSize: 12,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ opacity: 0.78 }}>{label}</span>
        <strong style={{ fontWeight: 700 }}>{value}</strong>
      </div>
    );
  };

  const groups = useMemo(() => (state.config?.proxyGroups ?? []).map((g: ProxyGroup) => ({
    id: g.id,
    name: g.name,
    port: g.port,
    running: state.groupStatuses?.[g.id],
  })), [state.config, state.groupStatuses]);

  const activeGroup = useMemo(() => {
    const id = state.activeGroupId || groups[0]?.id;
    return (state.config?.proxyGroups ?? []).find((g: ProxyGroup) => g.id === id);
  }, [groups, state.activeGroupId, state.config]);

  const activeRoute = useMemo(() => {
    if (!activeGroup || activeGroup.protocol === 'WS') return undefined;
    const routeId = state.activeRouteId || activeGroup.routes?.[0]?.id;
    return (activeGroup.routes || []).find((route: HttpRoute) => route.id === routeId) || activeGroup.routes?.[0];
  }, [activeGroup, state.activeRouteId]);

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupDraft | null>(null);
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RouteDraft | null>(null);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [showMockModal, setShowMockModal] = useState(false);
  const [editingMockIndex, setEditingMockIndex] = useState<number | null>(null);
  const [mockDraft, setMockDraft] = useState<MockApiDraft | null>(null);
  const [selectedMockIndex, setSelectedMockIndex] = useState<number>(0);
  const [showWsRuleModal, setShowWsRuleModal] = useState(false);
  const [editingWsRuleIndex, setEditingWsRuleIndex] = useState<number | null>(null);
  const [wsRuleDraft, setWsRuleDraft] = useState<WsRule | null>(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const [hoveredRouteKey, setHoveredRouteKey] = useState<string | null>(null);

  const startAll = () => vscode.postMessage({ type: 'startServer' });
  const stopAll = () => vscode.postMessage({ type: 'stopServer' });
  const startGroup = (id: string) => vscode.postMessage({ type: 'startGroup', groupId: id });
  const stopGroup = (id: string) => vscode.postMessage({ type: 'stopGroup', groupId: id });

  const setActiveGroup = (id: string) => {
    const group = (state.config?.proxyGroups ?? []).find((item: ProxyGroup) => item.id === id);
    const nextRouteId = group?.routes?.[0]?.id;
    setState({ ...state, activeGroupId: id, activeRouteId: nextRouteId });
    vscode.postMessage({ type: 'setActiveGroup', groupId: id, routeId: nextRouteId });
    if (nextRouteId) {
      vscode.postMessage({ type: 'setActiveRoute', routeId: nextRouteId });
    }
  };

  const setActiveRoute = (routeId: string) => {
    setState({ ...state, activeRouteId: routeId });
    vscode.postMessage({ type: 'setActiveRoute', routeId });
  };

  const nextRouteName = useCallback(() => {
    const routes = activeGroup?.routes || [];
    return routes.length === 0 ? 'API' : `API ${routes.length + 1}`;
  }, [activeGroup]);

  const onAddGroup = () => {
    setIsEditingGroup(false);
    setEditingGroup(createDefaultGroupDraft());
    setShowGroupModal(true);
  };

  const onEditGroup = () => {
    if (!activeGroup) return;
    const { id: _id, routes: _routes, interceptPrefix: _interceptPrefix, baseUrl: _baseUrl, mockApis: _mockApis, ...rest } = activeGroup;
    setEditingGroup(rest as GroupDraft);
    setIsEditingGroup(true);
    setShowGroupModal(true);
  };

  const onSaveGroup = () => {
    if (!editingGroup) return;
    if (isEditingGroup && activeGroup) {
      vscode.postMessage({ type: 'updateGroup', groupId: activeGroup.id, data: editingGroup });
    } else {
      vscode.postMessage({ type: 'addGroup', data: editingGroup });
    }
    setShowGroupModal(false);
  };

  const onDeleteGroup = () => {
    if (!activeGroup) return;
    vscode.postMessage({ type: 'deleteGroup', groupId: activeGroup.id });
  };

  const onAddRoute = () => {
    setEditingRouteId(null);
    setEditingRoute(createDefaultRouteDraft(nextRouteName()));
    setShowRouteModal(true);
  };

  const onEditRoute = (routeId: string) => {
    if (!activeGroup) return;
    const route = activeGroup.routes.find(item => item.id === routeId);
    if (!route) return;
    setEditingRouteId(route.id);
    setEditingRoute({
      name: route.name,
      pathPrefix: route.pathPrefix,
      targetBaseUrl: route.targetBaseUrl,
      stripPrefix: route.stripPrefix,
      enableMock: route.enableMock,
    });
    setShowRouteModal(true);
  };

  const onSaveRoute = () => {
    if (!activeGroup || !editingRoute) return;
    if (editingRouteId) {
      vscode.postMessage({ type: 'updateRoute', groupId: activeGroup.id, routeId: editingRouteId, data: editingRoute });
    } else {
      vscode.postMessage({ type: 'addRoute', groupId: activeGroup.id, data: editingRoute });
    }
    setShowRouteModal(false);
  };

  const onDeleteRoute = (routeId: string) => {
    if (!activeGroup) return;
    vscode.postMessage({ type: 'deleteRoute', groupId: activeGroup.id, routeId });
  };

  const onAddMock = () => {
    if (!activeGroup || !activeRoute) return;
    setEditingMockIndex(null);
    setMockDraft(createDefaultMockDraft());
    setShowMockModal(true);
  };

  const onEditMock = (index: number) => {
    if (!activeRoute) return;
    const mock = activeRoute.mockApis[index];
    if (!mock) return;
    let response = mock.mockData;
    try { response = JSON.stringify(JSON.parse(mock.mockData), null, 2); } catch {}
    setEditingMockIndex(index);
    setMockDraft({ ...mock, mockData: response });
    setShowMockModal(true);
  };

  const onDeleteMock = (index: number) => {
    if (!activeGroup || !activeRoute) return;
    vscode.postMessage({ type: 'deleteMock', groupId: activeGroup.id, routeId: activeRoute.id, index });
  };

  const onToggleMock = (index: number) => {
    if (!activeGroup || !activeRoute) return;
    vscode.postMessage({ type: 'toggleMock', groupId: activeGroup.id, routeId: activeRoute.id, index });
  };

  const onSaveMock = () => {
    if (!activeGroup || !activeRoute || !mockDraft) return;
    try {
      const compact = JSON.stringify(parseJsonSmart(mockDraft.mockData ?? ''));
      const payload = { ...mockDraft, mockData: compact };
      if (editingMockIndex !== null) {
        vscode.postMessage({ type: 'updateMock', groupId: activeGroup.id, routeId: activeRoute.id, index: editingMockIndex, data: payload });
      } else {
        vscode.postMessage({ type: 'addMock', groupId: activeGroup.id, routeId: activeRoute.id, data: payload });
      }
      setShowMockModal(false);
    } catch (e) {
      alert(`${t('ui.jsonInvalid') || 'Invalid JSON'}: ${(e as Error)?.message || String(e)}`);
    }
  };

  const formatMock = () => {
    if (!mockDraft) return;
    try {
      setMockDraft({ ...mockDraft, mockData: JSON.stringify(parseJsonSmart(mockDraft.mockData ?? ''), null, 2) });
    } catch (e) {
      alert(`${t('ui.jsonInvalid') || 'Invalid JSON'}: ${(e as Error)?.message || String(e)}`);
    }
  };

  const ensureWsRuleDefaults = (rule: Partial<WsRule>): WsRule => ({
    enabled: rule.enabled ?? true,
    path: rule.path ?? '',
    eventKey: rule.eventKey ?? 'action',
    eventValue: rule.eventValue ?? '',
    direction: rule.direction ?? 'both',
    intercept: rule.intercept ?? false,
    mode: rule.mode ?? 'off',
    periodSec: rule.periodSec ?? 5,
    message: rule.message ?? '{}',
    timeline: Array.isArray(rule.timeline) ? rule.timeline : [],
    loop: rule.loop ?? false,
    onOpenFire: rule.onOpenFire ?? false,
  });

  const onAddWsRule = () => {
    setEditingWsRuleIndex(null);
    setWsRuleDraft(ensureWsRuleDefaults({ enabled: true, mode: 'off', direction: 'both', message: '{}' }));
    setShowWsRuleModal(true);
  };

  const onEditWsRule = (index: number) => {
    if (!activeGroup) return;
    const rule = ((activeGroup.wsPushRules || []) as WsRule[])[index];
    if (!rule) return;
    setEditingWsRuleIndex(index);
    setWsRuleDraft(ensureWsRuleDefaults(rule));
    setShowWsRuleModal(true);
  };

  const onDeleteWsRule = (index: number) => {
    if (!activeGroup) return;
    vscode.postMessage({ type: 'updateWsRules', groupId: activeGroup.id, rulesIndexToDelete: index });
  };

  const onToggleWsRuleEnabled = (index: number) => {
    if (!activeGroup) return;
    const nextRules = ((activeGroup.wsPushRules || []) as WsRule[]).map((rule, idx) => idx === index ? { ...rule, enabled: !rule.enabled } : rule);
    vscode.postMessage({ type: 'updateWsRules', groupId: activeGroup.id, rules: nextRules });
  };

  const onSaveWsRule = () => {
    if (!activeGroup || !wsRuleDraft) return;
    const existingRules = (activeGroup.wsPushRules || []) as WsRule[];
    const nextRules = editingWsRuleIndex === null
      ? [...existingRules, ensureWsRuleDefaults(wsRuleDraft)]
      : existingRules.map((rule, idx) => idx === editingWsRuleIndex ? ensureWsRuleDefaults(wsRuleDraft) : rule);
    vscode.postMessage({ type: 'updateWsRules', groupId: activeGroup.id, rules: nextRules });
    setShowWsRuleModal(false);
  };

  React.useEffect(() => {
    const handler = () => {
      setShowGroupModal(false);
      setShowRouteModal(false);
      setShowMockModal(false);
    };
    window.addEventListener('iw:closeGroupForm', handler);
    return () => window.removeEventListener('iw:closeGroupForm', handler);
  }, []);

  React.useEffect(() => {
    if (!activeGroup) return;
    if (activeGroup.protocol === 'WS') return;
    if (!activeRoute && activeGroup.routes?.[0]?.id) {
      setState({ ...state, activeRouteId: activeGroup.routes[0].id });
    }
  }, [activeGroup, activeRoute, setState, state]);

  React.useEffect(() => {
    if (!activeRoute) {
      setSelectedMockIndex(0);
      return;
    }
    if (selectedMockIndex >= activeRoute.mockApis.length) {
      setSelectedMockIndex(0);
    }
  }, [activeRoute, selectedMockIndex]);

  React.useEffect(() => {
    if (!activeGroup?.id) return;
    setExpandedGroupIds(prev => (prev.includes(activeGroup.id) ? prev : [...prev, activeGroup.id]));
  }, [activeGroup?.id]);

  React.useEffect(() => {
    const action = state.panelAction;
    if (!action || state.viewKind !== 'panel') return;

    if (action.type === 'focusEntity' && action.groupId) {
      const group = (state.config?.proxyGroups ?? []).find((item: ProxyGroup) => item.id === action.groupId);
      const nextRouteId = action.routeId || group?.routes?.[0]?.id;
      setState({ ...state, activeGroupId: action.groupId, activeRouteId: nextRouteId, panelAction: null });
      return;
    }

    if (action.type === 'addGroup') {
      setState({ ...state, panelAction: null });
      onAddGroup();
      return;
    }

    setState({ ...state, panelAction: null });
  }, [state, setState]);

  const totalGroups = (state.config?.proxyGroups || []).length;
  const runningCount = (state.config?.proxyGroups || []).reduce((acc: number, g: ProxyGroup) => acc + (state.groupStatuses?.[g.id] ? 1 : 0), 0);
  const allRunning = totalGroups > 0 && runningCount === totalGroups;
  const noneRunning = runningCount === 0;
  const isWsGroup = !!activeGroup && activeGroup.protocol === 'WS';
  const isSidebarView = state.viewKind === 'sidebar';

  const sendWsByRule = (ruleIndex: number, target: WsManualTarget) => {
    if (!activeGroup) return;
    vscode.postMessage({ type: 'wsManualPushByRule', groupId: activeGroup.id, ruleIndex, target });
  };

  const sendWsCustom = (target: WsManualTarget, payload: string) => {
    if (!activeGroup) return;
    vscode.postMessage({ type: 'wsManualPushCustom', groupId: activeGroup.id, target, payload });
  };

  const runningColor = 'var(--vscode-testing-iconPassed, #89d185)';
  const stoppedColor = 'var(--vscode-errorForeground, #f48771)';

  const methodBadgeStyle = (method: string) => {
    const key = (method || '').toUpperCase();
    if (key === 'GET') {
      return {
        background: 'color-mix(in srgb, var(--vscode-testing-iconPassed) 18%, transparent)',
        color: 'var(--vscode-testing-iconPassed, #89d185)',
      };
    }
    if (key === 'POST') {
      return {
        background: 'color-mix(in srgb, var(--vscode-charts-yellow) 20%, transparent)',
        color: 'var(--vscode-charts-yellow, #f0c674)',
      };
    }
    if (key === 'PUT') {
      return {
        background: 'color-mix(in srgb, var(--vscode-charts-orange) 20%, transparent)',
        color: 'var(--vscode-charts-orange, #d19a66)',
      };
    }
    if (key === 'DELETE') {
      return {
        background: 'color-mix(in srgb, var(--vscode-errorForeground) 16%, transparent)',
        color: 'var(--vscode-errorForeground, #f48771)',
      };
    }
    return {
      background: 'color-mix(in srgb, var(--vscode-textLink-foreground) 18%, transparent)',
      color: 'var(--vscode-textLink-foreground, #4daafc)',
    };
  };

  const openPanelForSelection = (groupId: string, routeId?: string) => {
    const group = (state.config?.proxyGroups ?? []).find((item: ProxyGroup) => item.id === groupId);
    const nextRouteId = routeId || group?.routes?.[0]?.id;
    setState({ ...state, activeGroupId: groupId, activeRouteId: nextRouteId });
    vscode.postMessage({ type: 'setActiveGroup', groupId, routeId: nextRouteId });
    if (nextRouteId) {
      vscode.postMessage({ type: 'setActiveRoute', routeId: nextRouteId });
    }
    vscode.postMessage({ type: 'openPanel', action: { type: 'focusEntity', groupId, routeId: nextRouteId } });
  };

  const openPanelForAddGroup = () => {
    vscode.postMessage({ type: 'openPanel', action: { type: 'addGroup' } });
  };

  const selectedMock = activeRoute?.mockApis?.[selectedMockIndex];
  const selectedMockPreview = useMemo(() => {
    if (!selectedMock?.mockData) return '';
    try {
      return JSON.stringify(parseJsonSmart(selectedMock.mockData), null, 2);
    } catch {
      return selectedMock.mockData;
    }
  }, [selectedMock]);

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroupIds(prev => (
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    ));
  };

  if (isSidebarView) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'var(--vscode-font-family, system-ui, Arial)', background: 'var(--vscode-sideBar-background)' }}>
        <div style={{ padding: 12, borderBottom: '1px solid var(--vscode-panel-border)', display: 'grid', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--vscode-descriptionForeground)', marginBottom: 4 }}>
              Intercept Wave
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{t('ui.navigator') || 'Navigator'}</div>
            <div style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)', marginTop: 4 }}>
              {t('ui.navigatorHint') || 'Browse groups on the left, edit details in the workspace panel.'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <StatBadge label={t('ui.section.group') || 'Groups'} value={totalGroups} />
            <StatBadge label={t('ui.running') || 'Running'} value={runningCount} tone={runningCount > 0 ? 'success' : 'muted'} />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => activeGroup && openPanelForSelection(activeGroup.id, activeRoute?.id)} disabled={!activeGroup}>
              <Icon name="go-to-file" />
              {t('ui.openWorkspace') || 'Open Workspace'}
            </button>
            <button onClick={openPanelForAddGroup}>
              <Icon name="add" />
              {t('ui.addProxyGroup') || 'Add Group'}
            </button>
          </div>
        </div>

        <div style={{ padding: 12, overflowY: 'auto', display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--vscode-descriptionForeground)' }}>
            {t('ui.proxyGroups') || 'Proxy Groups'}
          </div>
          {(state.config?.proxyGroups || []).map((group: ProxyGroup) => {
            const isActiveGroup = group.id === activeGroup?.id;
            const isRunningGroup = state.groupStatuses?.[group.id];
            const isExpanded = expandedGroupIds.includes(group.id);
            const showGroupActions = hoveredGroupId === group.id || isActiveGroup;
            return (
              <section
                key={group.id}
                onMouseEnter={() => setHoveredGroupId(group.id)}
                onMouseLeave={() => setHoveredGroupId(current => (current === group.id ? null : current))}
                style={{
                  borderLeft: `2px solid ${isActiveGroup ? 'var(--vscode-focusBorder)' : 'transparent'}`,
                  paddingLeft: 8,
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gap: 2,
                    padding: '6px 8px 6px 10px',
                    borderRadius: 8,
                    background: isActiveGroup
                      ? 'color-mix(in srgb, var(--vscode-list-activeSelectionBackground) 45%, transparent)'
                      : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <button
                      onClick={() => toggleGroupExpanded(group.id)}
                      title={isExpanded ? (t('ui.collapse') || 'Collapse') : (t('ui.expand') || 'Expand')}
                      style={{
                        minWidth: 0,
                        width: 18,
                        height: 18,
                        padding: 0,
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--vscode-descriptionForeground)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span className={`codicon ${isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`} />
                    </button>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: isRunningGroup ? runningColor : stoppedColor, flexShrink: 0 }} />
                    <button
                      onClick={() => openPanelForSelection(group.id)}
                      style={{
                        minWidth: 0,
                        flex: 1,
                        border: 'none',
                        background: 'transparent',
                        padding: 0,
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: 'inherit',
                      }}
                    >
                      <div style={{ fontSize: 13.5, fontWeight: 700, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {group.name}
                      </div>
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, width: 52, justifyContent: 'flex-end', opacity: showGroupActions ? 1 : 0, transition: 'opacity 120ms ease', pointerEvents: showGroupActions ? 'auto' : 'none' }}>
                      <button
                        onClick={() => openPanelForSelection(group.id)}
                        title={t('ui.openInPanel') || 'Open in panel'}
                        style={{ minWidth: 0, width: 24, height: 24, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <span className="codicon codicon-go-to-file" />
                      </button>
                      <button
                        onClick={() => (isRunningGroup ? stopGroup(group.id) : startGroup(group.id))}
                        title={isRunningGroup ? (t('ui.stopServer') || 'Stop Server') : (t('ui.startServer') || 'Start Server')}
                        style={{ minWidth: 0, width: 24, height: 24, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <span className={`codicon ${isRunningGroup ? 'codicon-debug-stop' : 'codicon-play'}`} />
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--vscode-descriptionForeground)', paddingLeft: 24 }}>
                    <span>:{group.port}</span>
                    <span>{group.protocol || 'HTTP'}</span>
                    <span>{(group.routes || []).length} {t('ui.routes') || 'routes'}</span>
                  </div>
                </div>
                {group.protocol !== 'WS' && isExpanded && (
                  <div style={{ marginTop: 2, marginLeft: 16, paddingLeft: 12, borderLeft: '1px solid color-mix(in srgb, var(--vscode-panel-border) 70%, transparent)', display: 'grid', gap: 2 }}>
                    {(group.routes || []).map((route: HttpRoute) => {
                      const selected = route.id === activeRoute?.id && isActiveGroup;
                      const routeKey = `${group.id}:${route.id}`;
                      const showRouteActions = hoveredRouteKey === routeKey || selected;
                      return (
                        <button
                          key={route.id}
                          onMouseEnter={() => setHoveredRouteKey(routeKey)}
                          onMouseLeave={() => setHoveredRouteKey(current => (current === routeKey ? null : current))}
                          onClick={() => openPanelForSelection(group.id, route.id)}
                          style={{
                            width: '100%',
                            display: 'grid',
                            gap: 3,
                            textAlign: 'left',
                            padding: '7px 10px 7px 14px',
                            borderRadius: 6,
                            border: 'none',
                            background: selected
                              ? 'color-mix(in srgb, var(--vscode-list-activeSelectionBackground) 45%, transparent)'
                              : 'transparent',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span className="codicon codicon-symbol-method" style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)' }} />
                            <strong style={{ fontSize: 12.5, minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{route.name}</strong>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 999,
                                fontSize: 10,
                                background: route.enableMock
                                  ? 'color-mix(in srgb, var(--vscode-testing-iconPassed) 18%, transparent)'
                                  : 'color-mix(in srgb, var(--vscode-descriptionForeground) 12%, transparent)',
                                color: route.enableMock
                                  ? 'var(--vscode-testing-iconPassed, #89d185)'
                                  : 'var(--vscode-descriptionForeground)',
                              }}
                            >
                              {route.enableMock ? (t('ui.mockOn') || 'Mock on') : (t('ui.mockOff') || 'Mock off')}
                            </span>
                            <span style={{ width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: showRouteActions ? 1 : 0, transition: 'opacity 120ms ease', pointerEvents: showRouteActions ? 'auto' : 'none' }}>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openPanelForSelection(group.id, route.id);
                                }}
                                title={t('ui.openInPanel') || 'Open in panel'}
                                style={{ minWidth: 0, width: 20, height: 20, padding: 0, border: 'none', background: 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vscode-descriptionForeground)' }}
                              >
                                <span className="codicon codicon-go-to-file" style={{ fontSize: 12 }} />
                              </button>
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--vscode-foreground)', paddingLeft: 20 }}>{route.pathPrefix}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--vscode-descriptionForeground)', paddingLeft: 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{route.targetBaseUrl}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .iw-panel-tabs {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px 8px 12px;
          min-height: 48px;
          box-sizing: border-box;
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .iw-panel-tabs::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'var(--vscode-font-family, system-ui, Arial)', background: 'var(--vscode-sideBar-background)' }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: 12,
          borderBottom: '1px solid var(--vscode-panel-border)',
          background: 'color-mix(in srgb, var(--vscode-sideBar-background) 92%, var(--vscode-editor-background))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--vscode-descriptionForeground)', marginBottom: 4 }}>
              Intercept Wave
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {t('ui.proxyControl') || 'Proxy Control'}
            </div>
          </div>
          <button style={{ minWidth: 96 }} onClick={startAll} disabled={allRunning}><Icon name="play" />{t('ui.startAll') || 'Start All'}</button>
          <button style={{ minWidth: 96 }} onClick={stopAll} disabled={noneRunning}><Icon name="stop" />{t('ui.stopAll') || 'Stop All'}</button>
          <button onClick={onAddGroup}><Icon name="add" />{t('ui.addProxyGroup') || 'Add Group'}</button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <StatBadge label={t('ui.section.group') || 'Groups'} value={totalGroups} />
          <StatBadge label={t('ui.running') || 'Running'} value={runningCount} tone={runningCount > 0 ? 'success' : 'muted'} />
          <StatBadge label={t('ui.schema') || 'Schema'} value={state.config?.version || '4.0'} tone="muted" />
        </div>
      </div>

      <div className="iw-panel-tabs">
        {groups.map(g => (
          <div
            key={g.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 12px',
              minHeight: 30,
              fontSize: 12,
              border: `1px solid ${state.activeGroupId === g.id ? 'var(--vscode-focusBorder)' : 'var(--vscode-panel-border)'}`,
              borderRadius: 999,
              cursor: 'pointer',
              background: state.activeGroupId === g.id
                ? 'color-mix(in srgb, var(--vscode-button-background) 18%, var(--vscode-editor-background))'
                : 'var(--vscode-editor-background)',
              color: state.activeGroupId === g.id ? 'var(--vscode-foreground)' : 'var(--vscode-descriptionForeground)',
              boxShadow: state.activeGroupId === g.id ? '0 0 0 1px color-mix(in srgb, var(--vscode-focusBorder) 30%, transparent) inset' : 'none',
              whiteSpace: 'nowrap',
              flex: '0 0 auto',
            }}
            onClick={() => setActiveGroup(g.id)}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: g.running ? runningColor : stoppedColor,
                boxShadow: `0 0 0 2px color-mix(in srgb, ${g.running ? runningColor : stoppedColor} 20%, transparent)`,
              }}
            />
            <span>{g.name}(:{g.port})</span>
          </div>
        ))}
      </div>

      <div style={{ padding: 12, overflowY: 'auto' }}>
        {!activeGroup && <div style={{ color: 'var(--vscode-descriptionForeground)' }}>{t('ui.noActiveGroup') || 'No active group'}</div>}
        {activeGroup && (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{activeGroup.name}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <StatBadge label={t('ui.port') || 'Port'} value={activeGroup.port} />
                  <StatBadge label={t('ui.protocol') || 'Protocol'} value={activeGroup.protocol || 'HTTP'} tone="muted" />
                  <StatBadge
                    label={t('ui.running') || 'Running'}
                    value={state.groupStatuses?.[activeGroup.id] ? (t('ui.running') || 'Running') : (t('ui.stopped') || 'Stopped')}
                    tone={state.groupStatuses?.[activeGroup.id] ? 'success' : 'muted'}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button style={{ minWidth: 96 }} onClick={() => startGroup(activeGroup.id)} disabled={state.groupStatuses?.[activeGroup.id]}><Icon name="play" />{t('ui.startServer') || 'Start'}</button>
                <button style={{ minWidth: 96 }} onClick={() => stopGroup(activeGroup.id)} disabled={!state.groupStatuses?.[activeGroup.id]}><Icon name="stop" />{t('ui.stopServer') || 'Stop'}</button>
                <button onClick={onEditGroup}><Icon name="gear" />{t('ui.settings') || 'Settings'}</button>
                <button onClick={onDeleteGroup}><Icon name="trash" />{t('ui.delete') || 'Delete'}</button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <SectionCard
                title={t('ui.section.group') || 'Group Settings'}
                subtitle={t('ui.listenerSharedHint') || 'Listener-level settings shared by the routes in this port.'}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <div>
                    <div style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 12, marginBottom: 4 }}>{t('ui.groupName') || 'Name'}</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{activeGroup.name}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 12, marginBottom: 4 }}>{t('ui.port') || 'Port'}</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{activeGroup.port}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 12, marginBottom: 4 }}>{t('ui.protocol') || 'Protocol'}</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{activeGroup.protocol || 'HTTP'}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 12, marginBottom: 4 }}>{t('ui.stripPrefix') || 'Strip Prefix'}</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{activeGroup.stripPrefix ? (t('ui.yes') || 'Yes') : (t('ui.no') || 'No')}</div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 12, marginBottom: 4 }}>{t('ui.globalCookie') || 'Global Cookie'}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-word' }}>{activeGroup.globalCookie || (t('ui.notSet') || '(Not set)')}</div>
                  </div>
                </div>
              </SectionCard>

              {isWsGroup ? (
                <div style={{ display: 'grid', gap: 16 }}>
                  <SectionCard
                    title={t('ui.wsPanel.rules') || 'Rules'}
                    subtitle="Manage match conditions and push behavior for the active listener."
                    action={<button onClick={onAddWsRule}><Icon name="add" />{t('ui.addWsRule') || 'Add WS Rule'}</button>}
                  >
                    {(((activeGroup.wsPushRules || []) as WsRule[]).length === 0) && (
                      <div style={{ color: 'var(--vscode-descriptionForeground)', fontStyle: 'italic' }}>
                        {t('ui.wsPanel.noRules') || 'No WS rules configured.'}
                      </div>
                    )}

                    {(((activeGroup.wsPushRules || []) as WsRule[]).length > 0) && (
                      <div style={{ border: '1px solid var(--vscode-panel-border)', borderRadius: 6, overflow: 'hidden' }}>
                        {((activeGroup.wsPushRules || []) as WsRule[]).map((rule, idx) => (
                          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '32px 110px 80px 1fr auto', alignItems: 'center', gap: 10, padding: '8px 10px', borderBottom: '1px solid var(--vscode-panel-border)' }}>
                            <input type="checkbox" checked={rule.enabled} onChange={() => onToggleWsRuleEnabled(idx)} />
                            <div>{(rule.mode || 'off').toUpperCase()}</div>
                            <div style={{ color: 'var(--vscode-descriptionForeground)' }}>{rule.direction || 'both'}</div>
                            <div style={{ minWidth: 0, wordBreak: 'break-word' }}>{rule.path || `${rule.eventKey || 'action'}=${rule.eventValue || ''}`}</div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => onEditWsRule(idx)}>{t('ui.edit') || 'Edit'}</button>
                              <button onClick={() => onDeleteWsRule(idx)}>{t('ui.delete') || 'Delete'}</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </SectionCard>

                  <WsPushPanel
                    rules={((activeGroup.wsPushRules || []) as WsRule[])}
                    onSendByRule={sendWsByRule}
                    onSendCustom={sendWsCustom}
                    labels={{
                      title: t('ui.wsPanel.title') || 'WebSocket Push',
                      rules: t('ui.wsPanel.rules') || 'Rules',
                      sendSelected: t('ui.wsPanel.sendSelected') || 'Send Selected',
                      targetMatch: t('ui.wsPanel.target.match') || 'Match',
                      targetAll: t('ui.wsPanel.target.all') || 'All',
                      targetRecent: t('ui.wsPanel.target.recent') || 'Recent',
                      customMessage: t('ui.wsPanel.customMessage') || 'Custom Message (JSON)',
                      send: t('ui.wsPanel.send') || 'Send',
                      noRules: t('ui.wsPanel.noRules') || 'No WS rules configured.',
                    }}
                  />
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) minmax(420px, 1fr)', gap: 16, alignItems: 'start' }}>
                    <div style={panelPaneStyle}>
                      <RouteList
                        routes={activeGroup.routes || []}
                        activeRouteId={activeRoute?.id}
                        onSelect={setActiveRoute}
                        onAdd={onAddRoute}
                        onEdit={onEditRoute}
                        onDelete={onDeleteRoute}
                        labels={{
                          title: t('ui.routes') || 'Routes',
                          addRoute: t('ui.addRoute') || 'Add Route',
                          edit: t('ui.edit') || 'Edit',
                          delete: t('ui.delete') || 'Delete',
                          emptyText: t('ui.noRoutesConfigured') || 'No routes configured.',
                          enableMock: t('ui.mockOn') || 'Mock enabled',
                          disableMock: t('ui.mockOff') || 'Mock disabled',
                          mocksLabel: t('ui.mocks') || 'mock',
                        }}
                      />
                    </div>

                    {!activeRoute ? (
                      <SectionCard title={t('ui.routeDetail') || 'Route Detail'} subtitle={t('ui.routeSelectionHint') || 'Select a route to inspect its forwarding and mock settings.'}>
                        <div style={{ color: 'var(--vscode-descriptionForeground)', fontStyle: 'italic' }}>{t('ui.noRouteSelected') || 'No route selected.'}</div>
                      </SectionCard>
                    ) : (
                      <SectionCard
                        title={t('ui.routeDetail') || 'Route Detail'}
                        subtitle={t('ui.routeMatchHint') || 'Requests are matched by longest path prefix, then mocked or forwarded using this rule.'}
                        action={<button onClick={() => onEditRoute(activeRoute.id)}><Icon name="edit" />{t('ui.edit') || 'Edit'}</button>}
                      >
                        <div style={{ display: 'grid', gap: 14 }}>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'minmax(0, 1fr) auto',
                              gap: 12,
                              alignItems: 'start',
                              padding: '12px 14px',
                              borderRadius: 8,
                              border: '1px solid var(--vscode-panel-border)',
                              background: 'color-mix(in srgb, var(--vscode-sideBar-background) 42%, transparent)',
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{activeRoute.name}</div>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontFamily: 'var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, monospace)',
                                  color: 'var(--vscode-foreground)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {activeRoute.pathPrefix}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              <StatBadge label={t('ui.enableMock') || 'Enable Mock'} value={activeRoute.enableMock ? (t('ui.yes') || 'Yes') : (t('ui.no') || 'No')} tone={activeRoute.enableMock ? 'success' : 'muted'} />
                              <StatBadge label={t('ui.stripPrefix') || 'Strip Prefix'} value={activeRoute.stripPrefix ? (t('ui.yes') || 'Yes') : (t('ui.no') || 'No')} tone="muted" />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                            <div style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--vscode-panel-border)', background: 'color-mix(in srgb, var(--vscode-editor-background) 88%, var(--vscode-sideBar-background))' }}>
                              <div style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 12, marginBottom: 6 }}>{t('ui.routePrefix') || 'Path Prefix'}</div>
                              <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeRoute.pathPrefix}</div>
                            </div>
                            <div style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--vscode-panel-border)', background: 'color-mix(in srgb, var(--vscode-editor-background) 88%, var(--vscode-sideBar-background))' }}>
                              <div style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 12, marginBottom: 6 }}>{t('ui.enableMock') || 'Enable Mock'}</div>
                              <div style={{ fontSize: 14, fontWeight: 600 }}>{activeRoute.enableMock ? (t('ui.yes') || 'Yes') : (t('ui.no') || 'No')}</div>
                            </div>
                            <div style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--vscode-panel-border)', background: 'color-mix(in srgb, var(--vscode-editor-background) 88%, var(--vscode-sideBar-background))' }}>
                              <div style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 12, marginBottom: 6 }}>{t('ui.stripPrefix') || 'Strip Prefix'}</div>
                              <div style={{ fontSize: 14, fontWeight: 600 }}>{activeRoute.stripPrefix ? (t('ui.yes') || 'Yes') : (t('ui.no') || 'No')}</div>
                            </div>
                            <div style={{ gridColumn: '1 / -1', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--vscode-panel-border)', background: 'color-mix(in srgb, var(--vscode-editor-background) 88%, var(--vscode-sideBar-background))' }}>
                              <div style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 12, marginBottom: 6 }}>{t('ui.targetBaseUrl') || 'Target Base URL'}</div>
                              <div style={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-all' }}>{activeRoute.targetBaseUrl}</div>
                            </div>
                          </div>

                        </div>
                      </SectionCard>
                    )}
                  </div>

                  {activeRoute && (
                    <SectionCard
                      title={t('ui.mockApis') || 'Mock APIs'}
                      subtitle={`${activeRoute.mockApis.filter(api => api.enabled).length}/${activeRoute.mockApis.length} ${t('ui.mocks') || 'mocks'}`}
                      action={<button onClick={onAddMock}><Icon name="add" />{t('ui.addMockApi') || 'Add Mock'}</button>}
                    >
                      {activeRoute.mockApis.length === 0 ? (
                        <div style={{ color: 'var(--vscode-descriptionForeground)', fontStyle: 'italic', border: '1px dashed var(--vscode-panel-border)', borderRadius: 6, padding: 14 }}>
                          {t('ui.clickAddToCreate') || 'Click Add to create'}
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
                          <div
                            style={{
                              ...panelPaneStyle,
                              padding: 10,
                              gap: 8,
                            }}
                          >
                            {activeRoute.mockApis.map((mock, idx) => {
                              const badgeStyle = methodBadgeStyle(mock.method);
                              const isSelected = idx === selectedMockIndex;
                              return (
                                <div
                                  key={idx}
                                  onClick={() => setSelectedMockIndex(idx)}
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: '56px minmax(0, 1fr) auto',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: '10px 12px',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    border: isSelected
                                      ? '1px solid var(--vscode-focusBorder)'
                                      : `1px solid ${mock.enabled ? 'color-mix(in srgb, var(--vscode-testing-iconPassed) 35%, var(--vscode-panel-border))' : 'var(--vscode-panel-border)'}`,
                                    background: isSelected
                                      ? 'color-mix(in srgb, var(--vscode-list-activeSelectionBackground) 45%, transparent)'
                                      : 'color-mix(in srgb, var(--vscode-editor-background) 82%, var(--vscode-sideBar-background))',
                                  }}
                                >
                                  <div
                                    style={{
                                      minWidth: 0,
                                      textAlign: 'center',
                                      padding: '4px 8px',
                                      borderRadius: 999,
                                      fontSize: 10,
                                      fontWeight: 700,
                                      letterSpacing: 0.6,
                                      ...badgeStyle,
                                    }}
                                  >
                                    {(mock.method || '').toUpperCase()}
                                  </div>
                                  <div style={{ minWidth: 0 }}>
                                    <div
                                      style={{
                                        color: mock.enabled ? 'var(--vscode-editor-foreground)' : 'var(--vscode-descriptionForeground)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        fontWeight: 600,
                                      }}
                                    >
                                      {mock.path}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {mock.statusCode} · {mock.delay}ms
                                    </div>
                                  </div>
                                  <div style={{ display: 'grid', gap: 6, justifyItems: 'stretch', minWidth: 78 }}>
                                    <button style={{ minWidth: 78 }} onClick={(event) => { event.stopPropagation(); onToggleMock(idx); }}>{mock.enabled ? (t('ui.disable') || 'Disable') : (t('ui.enable') || 'Enable')}</button>
                                    <button style={{ minWidth: 78 }} onClick={(event) => { event.stopPropagation(); onEditMock(idx); }}>{t('ui.edit') || 'Edit'}</button>
                                    <button style={{ minWidth: 78 }} onClick={(event) => { event.stopPropagation(); onDeleteMock(idx); }}>{t('ui.delete') || 'Delete'}</button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div
                            style={{
                              border: '1px solid var(--vscode-panel-border)',
                              borderRadius: 8,
                              background: 'color-mix(in srgb, var(--vscode-editor-background) 88%, black)',
                              overflow: 'hidden',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--vscode-panel-border)', background: 'color-mix(in srgb, var(--vscode-sideBar-background) 55%, transparent)', flexWrap: 'wrap' }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--vscode-descriptionForeground)', marginBottom: 2 }}>
                                  {t('ui.mockModalTitle') || 'Mock'}
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                  {selectedMock?.path || '/'}
                                </div>
                              </div>
                              <div style={{ flex: 1 }} />
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                <StatBadge label={t('ui.statusCode') || 'Status'} value={selectedMock?.statusCode ?? 200} tone="muted" />
                                <StatBadge label={t('ui.delay') || 'Delay'} value={`${selectedMock?.delay ?? 0}ms`} tone="muted" />
                                <StatBadge label={t('ui.enable') || 'Enable'} value={selectedMock?.enabled ? (t('ui.yes') || 'Yes') : (t('ui.no') || 'No')} tone={selectedMock?.enabled ? 'success' : 'muted'} />
                              </div>
                            </div>
                            <div style={{ padding: 12 }}>
                              <div style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)', marginBottom: 8 }}>
                                {selectedMock?.useCookie ? (t('ui.cookieUsed') || 'Cookie') : (t('ui.cookieUnused') || 'No cookie')}
                              </div>
                              <pre
                                style={{
                                  margin: 0,
                                  minHeight: 280,
                                  maxHeight: 420,
                                  overflow: 'auto',
                                  padding: 14,
                                  borderRadius: 6,
                                  background: 'var(--vscode-textCodeBlock-background)',
                                  color: 'var(--vscode-editor-foreground)',
                                  fontSize: 12,
                                  lineHeight: 1.55,
                                  fontFamily: 'var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, monospace)',
                                }}
                              >
                                <code>{selectedMockPreview}</code>
                              </pre>
                            </div>
                          </div>
                        </div>
                      )}
                    </SectionCard>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      <GroupModal
        open={showGroupModal && !!editingGroup}
        draft={editingGroup || createDefaultGroupDraft()}
        onChange={setEditingGroup as (next: GroupDraft) => void}
        onSave={onSaveGroup}
        onCancel={() => setShowGroupModal(false)}
        isEdit={isEditingGroup}
        labels={{
          titleAdd: t('ui.addProxyGroup') || 'Add Group',
          titleEdit: t('ui.editProxyGroup') || 'Edit Group',
          sectionGroup: t('ui.section.group') || 'Group Settings',
          chromeTitle: t('ui.groupModalTitle') || 'Listener',
          hint: t('ui.groupModalHint') || 'This dialog only controls the local listener. HTTP routes and mocks are edited in the main panel.',
          listenerExtras: t('ui.listenerExtras') || 'Listener Extras',
          close: t('ui.close') || 'Close',
          sectionHttp: t('ui.section.http') || 'HTTP Settings',
          sectionWs: t('ui.section.ws') || 'WebSocket Settings',
          name: t('ui.groupName') || 'Name',
          enabled: t('ui.enabled') || 'Enabled',
          protocol: t('ui.protocol') || 'Protocol',
          protocolHttp: t('ui.protocol.http') || 'HTTP',
          protocolWs: t('ui.protocol.ws') || 'WebSocket',
          port: t('ui.port') || 'Port',
          stripPrefix: t('ui.stripPrefix') || 'Strip Prefix',
          globalCookie: t('ui.globalCookie') || 'Global Cookie',
          wsBaseUrl: t('ui.wsBaseUrl') || 'WS Base URL',
          wsInterceptPrefix: t('ui.wsInterceptPrefix') || 'WS Intercept Prefix',
          wsManualPush: t('ui.wsManualPush') || 'Enable Manual Push',
          wssEnabled: t('ui.wssEnabled') || 'Enable WSS (TLS)',
          wssKeystorePath: t('ui.wssKeystorePath') || 'WSS Keystore Path',
          wssKeystorePassword: t('ui.wssKeystorePassword') || 'WSS Keystore Password',
          yesLabel: t('ui.yes') || 'Yes',
          noLabel: t('ui.no') || 'No',
          save: t('ui.save') || 'Save',
          cancel: t('ui.cancel') || 'Cancel',
        }}
      />

      <RouteModal
        open={showRouteModal && !!editingRoute}
        draft={editingRoute || createDefaultRouteDraft()}
        onChange={setEditingRoute as (next: RouteDraft) => void}
        onSave={onSaveRoute}
        onCancel={() => setShowRouteModal(false)}
        isEdit={!!editingRouteId}
        labels={{
          titleAdd: t('ui.addRoute') || 'Add Route',
          titleEdit: t('ui.editRoute') || 'Edit Route',
          chromeTitle: t('ui.route') || 'Route',
          hint: t('ui.routeModalHint') || 'Configure how this local prefix maps to an upstream service. Press Cmd/Ctrl + Enter to save.',
          name: t('ui.groupName') || 'Name',
          pathPrefix: t('ui.routePrefix') || 'Path Prefix',
          targetBaseUrl: t('ui.targetBaseUrl') || 'Target Base URL',
          stripPrefix: t('ui.stripPrefix') || 'Strip Prefix',
          enableMock: t('ui.enableMock') || 'Enable Mock',
          yesLabel: t('ui.yes') || 'Yes',
          noLabel: t('ui.no') || 'No',
          save: t('ui.save') || 'Save',
          cancel: t('ui.cancel') || 'Cancel',
        }}
      />

      <MockModal
        open={showMockModal && !!mockDraft}
        draft={mockDraft || createDefaultMockDraft()}
        onChange={setMockDraft as (next: MockApiDraft) => void}
        onSave={onSaveMock}
        onFormat={formatMock}
        onCancel={() => setShowMockModal(false)}
        isEdit={editingMockIndex !== null}
        labels={{
          titleAdd: t('ui.addMockApi') || 'Add Mock',
          titleEdit: t('ui.editMockApi') || 'Edit Mock',
          chromeTitle: t('ui.mockModalTitle') || 'Mock',
          hint: t('ui.mockModalHint') || 'Tune the matcher above and edit the JSON payload below. Press Cmd/Ctrl + Enter to save.',
          close: t('ui.close') || 'Close',
          enabled: t('ui.enabled') || 'Enabled',
          method: t('ui.method') || 'Method',
          path: t('ui.path') || 'Path',
          statusCode: t('ui.statusCode') || 'Status',
          delay: t('ui.delay') || 'Delay',
          responseBody: t('ui.responseBody') || 'Response Body (JSON)',
          format: t('ui.format') || 'Format',
          cancel: t('ui.cancel') || 'Cancel',
          save: t('ui.save') || 'Save',
        }}
      />

      <WsRuleModal
        open={showWsRuleModal && !!wsRuleDraft}
        draft={wsRuleDraft || ensureWsRuleDefaults({ enabled: true, mode: 'off', direction: 'both', message: '{}' })}
        onChange={setWsRuleDraft as (next: WsRule) => void}
        onSave={onSaveWsRule}
        onCancel={() => {
          setShowWsRuleModal(false);
          setEditingWsRuleIndex(null);
          setWsRuleDraft(null);
        }}
        isEdit={editingWsRuleIndex !== null}
        labels={{
          titleAdd: t('ui.addWsRule') || 'Add WS Rule',
          titleEdit: t('ui.editWsRule') || 'Edit WS Rule',
          enabled: t('ui.enabled') || 'Enabled',
          path: t('ui.path') || 'Route Path',
          mode: t('ui.wsRule.mode') || 'Mode',
          modeOff: t('ui.wsRule.mode.off') || 'Off',
          modePeriodic: t('ui.wsRule.mode.periodic') || 'Periodic',
          modeTimeline: t('ui.wsRule.mode.timeline') || 'Timeline',
          eventKey: t('ui.wsRule.event.key') || 'Event Key',
          eventValue: t('ui.wsRule.event.value') || 'Event Value',
          direction: t('ui.wsRule.direction') || 'Direction',
          directionBoth: t('ui.wsRule.direction.both') || 'Both',
          directionIn: t('ui.wsRule.direction.in') || 'Inbound',
          directionOut: t('ui.wsRule.direction.out') || 'Outbound',
          onOpen: t('ui.wsRule.onOpen') || 'Send on connect',
          intercept: t('ui.wsRule.intercept') || 'Intercept forwarding',
          periodSec: t('ui.wsRule.period.sec') || 'Interval (seconds)',
          timelineSecList: t('ui.wsRule.timeline.secList') || 'Timeline (seconds, comma separated)',
          message: t('ui.wsRule.message') || 'Message (JSON)',
          formatJson: t('ui.format') || 'Format',
          cancel: t('ui.cancel') || 'Cancel',
          save: t('ui.save') || 'Save',
          basicSectionTitle: t('ui.wsRule.section.basic') || 'Basic Settings',
          timelineEmpty: t('ui.wsRule.timeline.empty') || 'No timeline items. Click "Add" to create one.',
          timelineAdd: t('ui.wsRule.timeline.add') || 'Add',
          timelineEdit: t('ui.wsRule.timeline.edit') || 'Edit',
          timelineDelete: t('ui.wsRule.timeline.delete') || 'Delete',
          timelineEditorAddTitle: t('ui.wsRule.timeline.editor.addTitle') || 'Add timeline item',
          timelineEditorEditTitle: t('ui.wsRule.timeline.editor.editTitle') || 'Edit timeline item',
          timelineEditorAtMs: t('ui.wsRule.timeline.editor.atMs') || 'At (ms)',
          timelineEditorMessage: t('ui.wsRule.timeline.editor.message') || 'Message (JSON)',
          timelineEditorSave: t('ui.wsRule.timeline.editor.save') || 'Save item',
          timelineEditorCancel: t('ui.wsRule.timeline.editor.cancel') || 'Cancel',
        }}
      />
      </div>
    </>
  );
}
