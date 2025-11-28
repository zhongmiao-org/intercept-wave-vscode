import React, { useCallback, useMemo, useState } from 'react';
import { GroupDraft, MockApiDraft, MockApiConfig, ProxyGroup, WsRule } from './interfaces/business';
import { GroupSummary, InitialState, IWWindow, VsCodeApi } from './interfaces/ui';
import { GroupModal } from './components/GroupModal';
import { MockModal } from './components/MockModal';
import { WsPushPanel, WsManualTarget } from './components/WsPushPanel';
import { WsRuleModal } from './components/WsRuleModal';

function useVscode(): VsCodeApi {
  try {
    const w = window as unknown as IWWindow;
    const api = (w.__IW_VSCODE__ || (w.acquireVsCodeApi ? w.acquireVsCodeApi() : ({ postMessage: (_: unknown) => {} } as VsCodeApi)));
      return {
      postMessage: (message: unknown) => {
        try { console.debug('[IW] postMessage →', message); } catch {}
        try { (api as any).postMessage(message); } catch (e) { try { console.error('[IW] postMessage error', e); } catch {} }
      },
      getState: (api as any).getState?.bind(api),
      setState: (api as any).setState?.bind(api),
    } as VsCodeApi;
  } catch {
    return { postMessage: (_: unknown) => { try { console.warn('[IW] postMessage dropped: vscode api missing'); } catch {} } } as VsCodeApi;
  }
}

function parseJsonSmart(raw: string): unknown {
  const text = (raw ?? '').trim();
  if (!text) throw new Error('Empty JSON');
  try {
    return JSON.parse(text);
  } catch {
    // strip comments
    function stripComments(input: string): string {
      let out = '';
      let i = 0;
      let inSingle = false,
        inDouble = false,
        inTemplate = false,
        inLineComment = false,
        inBlockComment = false;
      while (i < input.length) {
        const ch = input[i];
        const next = input[i + 1];
        if (inLineComment) {
          if (ch === '\n') {
            inLineComment = false;
            out += ch;
          }
          i++;
          continue;
        }
        if (inBlockComment) {
          if (ch === '*' && next === '/') {
            inBlockComment = false;
            i += 2;
            continue;
          }
          i++;
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
          i++;
          continue;
        }
        if (!inSingle && !inTemplate && ch === '"' && input[i - 1] !== '\\') {
          inDouble = !inDouble;
          out += ch;
          i++;
          continue;
        }
        if (!inSingle && !inDouble && ch === '`' && input[i - 1] !== '\\') {
          inTemplate = !inTemplate;
          out += ch;
          i++;
          continue;
        }
        out += ch;
        i++;
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

export function App({ state, setState }: { state: InitialState; setState: (s: InitialState) => void }) {
  const vscode = useVscode();
  const t = useCallback((k: string) => {
    const v = (state.i18n && (state.i18n as any)[k]) as string | undefined;
    if (!v) return '';
    // If VS Code l10n returns the key itself (e.g., 'ui.startAll') in base locale, treat as missing
    if (v === k) return '';
    // Defensive: if value still looks like a dotted key, fallback to default text in UI
    if (/^[a-z]+\./i.test(v)) return '';
    return v;
  }, [state.i18n]);

  const Icon = ({ name, color }: { name: string; color?: string }) => (
    <span className={`codicon codicon-${name}`} style={{ color }} />
  );

  const groups: GroupSummary[] = (state.config?.proxyGroups ?? []).map((g: ProxyGroup) => ({
    id: g.id,
    name: g.name,
    port: g.port,
    running: !!state.groupStatuses?.[g.id],
  }));

  const activeGroup = useMemo(() => {
    const id = state.activeGroupId || groups[0]?.id;
    return (state.config?.proxyGroups ?? []).find((g: ProxyGroup) => g.id === id);
  }, [state.activeGroupId, state.config, groups]);

  // UI state
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null as GroupDraft | null);
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [showMockModal, setShowMockModal] = useState(false);
  const [editingMockIndex, setEditingMockIndex] = useState(null as number | null);
  const [mockDraft, setMockDraft] = useState(null as MockApiDraft | null);
  const [showWsRuleModal, setShowWsRuleModal] = useState(false);
  const [editingWsRuleIndex, setEditingWsRuleIndex] = useState<number | null>(null);
  const [wsRuleDraft, setWsRuleDraft] = useState<WsRule | null>(null);

  const startAll = () => vscode.postMessage({ type: 'startServer' });
  const stopAll = () => vscode.postMessage({ type: 'stopServer' });
  const startGroup = (id: string) => vscode.postMessage({ type: 'startGroup', groupId: id });
  const stopGroup = (id: string) => vscode.postMessage({ type: 'stopGroup', groupId: id });
  const setActiveGroup = (id: string) => {
    setState({ ...state, activeGroupId: id });
    vscode.postMessage({ type: 'setActiveGroup', groupId: id });
  };

  // Group operations
  const onAddGroup = () => {
    setIsEditingGroup(false);
    setEditingGroup({
      name: '',
      enabled: true,
      port: 8888,
      interceptPrefix: '/api',
      baseUrl: 'http://localhost:8080',
      stripPrefix: true,
      globalCookie: '',
      protocol: 'HTTP',
      wsBaseUrl: null,
      wsInterceptPrefix: null,
      wsManualPush: true,
      wssEnabled: false,
      wssKeystorePath: null,
      wssKeystorePassword: null,
    } as GroupDraft);
    setShowGroupModal(true);
  };
  const onEditGroup = () => {
    if (!activeGroup) return;
    const { id: _id, mockApis: _m, ...rest } = activeGroup as ProxyGroup;
    setEditingGroup({ ...(rest as GroupDraft) });
    setIsEditingGroup(true);
    setShowGroupModal(true);
  };
  const onDeleteGroup = () => {
    if (!activeGroup) return;
    vscode.postMessage({ type: 'deleteGroup', groupId: activeGroup.id });
  };
  const onSaveGroup = () => {
    if (!editingGroup) return;
    if (isEditingGroup && activeGroup && activeGroup.id) {
      vscode.postMessage({ type: 'updateGroup', groupId: activeGroup.id, data: editingGroup });
    } else {
      vscode.postMessage({ type: 'addGroup', data: editingGroup });
    }
  };

  // Mock operations
  const onAddMock = () => {
    if (!activeGroup) return;
    setEditingMockIndex(null);
    setMockDraft({ enabled: true, method: 'GET', path: '/', statusCode: 200, mockData: '{"ok":true}', delay: 0 } as MockApiDraft);
    setShowMockModal(true);
  };
  const onEditMock = (index: number) => {
    if (!activeGroup) return;
    const m = (activeGroup.mockApis as MockApiConfig[])[index];
    setEditingMockIndex(index);
    let response = m.mockData;
    try { response = JSON.stringify(JSON.parse(m.mockData), null, 2); } catch {}
    setMockDraft({ ...m, mockData: response });
    setShowMockModal(true);
  };
  const onDeleteMock = (index: number) => {
    if (!activeGroup) return;
    vscode.postMessage({ type: 'deleteMock', groupId: activeGroup.id, index });
  };
  const onToggleMock = (index: number) => {
    if (!activeGroup) return;
    vscode.postMessage({ type: 'toggleMock', groupId: activeGroup.id, index });
  };
  const onSaveMock = () => {
    if (!activeGroup || !mockDraft) return;
    // validate + compact JSON
    try {
      const parsed = parseJsonSmart(mockDraft.mockData ?? '');
      const compact = JSON.stringify(parsed);
      const payload = { ...mockDraft, mockData: compact };
      if (editingMockIndex !== null) {
        vscode.postMessage({ type: 'updateMock', groupId: activeGroup.id, index: editingMockIndex, data: payload });
      } else {
        vscode.postMessage({ type: 'addMock', groupId: activeGroup.id, data: payload });
      }
    } catch (e) {
      const msg = (e as Error)?.message || String(e);
      alert((state.i18n?.['ui.jsonInvalid'] || 'Invalid JSON') + ': ' + msg);
      return;
    }
  };

  const ensureWsRuleDefaults = (rule: Partial<WsRule>): WsRule => {
    return {
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
    };
  };

  const onAddWsRule = () => {
    const base: Partial<WsRule> = {
      enabled: true,
      path: '',
      eventKey: 'action',
      eventValue: '',
      direction: 'both',
      intercept: false,
      mode: 'off',
      periodSec: 5,
      message: '{}',
      timeline: [],
      loop: false,
      onOpenFire: false,
    };
    setEditingWsRuleIndex(null);
    setWsRuleDraft(ensureWsRuleDefaults(base));
    setShowWsRuleModal(true);
  };

  const onEditWsRule = (index: number) => {
    if (!activeGroup) return;
    const rules = ((activeGroup as ProxyGroup).wsPushRules || []) as WsRule[];
    const rule = rules[index];
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
    const group = activeGroup as ProxyGroup;
    const existingRules = (group.wsPushRules || []) as WsRule[];
    const nextRules = existingRules.map((r, idx) =>
      idx === index ? { ...r, enabled: !r.enabled } : r
    );
    vscode.postMessage({ type: 'updateWsRules', groupId: group.id, rules: nextRules });
  };

  const onSaveWsRule = () => {
    if (!activeGroup || !wsRuleDraft) return;
    const group = activeGroup as ProxyGroup;
    const existingRules = (group.wsPushRules || []) as WsRule[];
    let nextRules: WsRule[];
    if (editingWsRuleIndex === null) {
      nextRules = [...existingRules, ensureWsRuleDefaults(wsRuleDraft)];
    } else {
      nextRules = existingRules.map((r, idx) =>
        idx === editingWsRuleIndex ? ensureWsRuleDefaults(wsRuleDraft) : r
      );
    }
    vscode.postMessage({ type: 'updateWsRules', groupId: group.id, rules: nextRules });
    setShowWsRuleModal(false);
    setEditingWsRuleIndex(null);
    setWsRuleDraft(null);
  };


  const formatMock = () => {
    if (!mockDraft) return;
    try {
      const parsed = parseJsonSmart(mockDraft.mockData ?? '');
      setMockDraft({ ...mockDraft, mockData: JSON.stringify(parsed, null, 2) });
    } catch (e) {
      const msg = (e as Error)?.message || String(e);
      alert((state.i18n?.['ui.jsonInvalid'] || 'Invalid JSON') + ': ' + msg);
    }
  };

  React.useEffect(() => {
    const handler = (_e: Event) => {
      setShowGroupModal(false);
      setIsEditingGroup(false);
      setShowMockModal(false);
      // Also clear any panel action when extension requests close
      if (state.viewKind === 'panel') setState({ ...state, panelAction: null });
    };
    window.addEventListener('iw:closeGroupForm', handler);
    return () => window.removeEventListener('iw:closeGroupForm', handler);
  }, [state.viewKind, setState, state]);

  // When a panelAction arrives (from sidebar), prepare local drafts
  React.useEffect(() => {
    const act = state.panelAction?.type;
    if (!act) return;
    if (act === 'addGroup') {
      setEditingGroup({
        name: '',
        enabled: true,
        port: 8888,
        interceptPrefix: '/api',
        baseUrl: '',
        stripPrefix: true,
        globalCookie: '',
        protocol: 'HTTP',
        wsBaseUrl: null,
        wsInterceptPrefix: null,
        wsManualPush: true,
        wssEnabled: false,
        wssKeystorePath: null,
        wssKeystorePassword: null,
      } as GroupDraft);
      setShowGroupModal(false);
    }
    if (act === 'editGroup' && activeGroup) {
      const { id: _id, mockApis: _m, ...rest } = activeGroup as ProxyGroup;
      setEditingGroup({ ...(rest as GroupDraft) });
      setShowGroupModal(false);
    }
    if (act === 'addMock' && activeGroup) {
      setEditingMockIndex(null);
      setMockDraft({ enabled: true, method: 'GET', path: '/', statusCode: 200, mockData: '{"ok":true}', delay: 0 } as MockApiDraft);
      setShowMockModal(false);
    }
    if (act === 'editMock' && activeGroup && typeof state.panelAction?.index === 'number') {
      const idx = state.panelAction.index as number;
      const m = (activeGroup.mockApis as MockApiConfig[])[idx];
      setEditingMockIndex(idx);
      let response = m.mockData; try { response = JSON.stringify(JSON.parse(m.mockData), null, 2); } catch {}
      setMockDraft({ ...m, mockData: response });
      setShowMockModal(false);
    }
  }, [state.panelAction, activeGroup]);

  const removeGroupFromTab = (id: string) => {
    vscode.postMessage({ type: 'deleteGroup', groupId: id });
  };

  const methodColor = (m: string) => {
    const k = (m || '').toUpperCase();
    if (k === 'GET') return '#2ecc71';
    if (k === 'POST') return '#f1c40f';
    if (k === 'PUT') return '#e67e22';
    if (k === 'DELETE') return '#e74c3c';
    return '#3498db';
  };

  // Aggregated running info for buttons
  const totalGroups = (state.config?.proxyGroups || []).length;
  const runningCount = (state.config?.proxyGroups || []).reduce((acc: number, g: ProxyGroup) => acc + (state.groupStatuses?.[g.id] ? 1 : 0), 0);
  const allRunning = totalGroups > 0 && runningCount === totalGroups;
  const noneRunning = runningCount === 0;

  const isWsGroup = !!activeGroup && (activeGroup as ProxyGroup).protocol === 'WS';

  const sendWsByRule = (ruleIndex: number, target: WsManualTarget) => {
    if (!activeGroup) return;
    vscode.postMessage({ type: 'wsManualPushByRule', groupId: activeGroup.id, ruleIndex, target });
  };

  const sendWsCustom = (target: WsManualTarget, payload: string) => {
    if (!activeGroup) return;
    vscode.postMessage({ type: 'wsManualPushCustom', groupId: activeGroup.id, target, payload });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'var(--vscode-font-family, system-ui, Arial)' }}>
      {/* Global controls */}
      <div style={{ display: 'flex', gap: 8, padding: 12, flexWrap: 'wrap' }}>
        <button style={{ minWidth: 96 }} onClick={startAll} disabled={allRunning}><Icon name="play" />{t('ui.startAll') || 'Start All'}</button>
        <button style={{ minWidth: 96 }} onClick={stopAll} disabled={noneRunning}><Icon name="stop" />{t('ui.stopAll') || 'Stop All'}</button>
        <div style={{ flex: 1 }} />
      </div>

      {/* Group tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px 8px 12px', overflowX: 'auto' }}>
        {groups.map(g => (
          <div
            key={g.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0 8px', height: 24, fontSize: 12,
              border: '1px solid var(--vscode-panel-border)', borderRadius: 3,
              cursor: 'pointer',
              background: state.activeGroupId === g.id ? 'var(--vscode-tab-activeBackground)' : 'var(--vscode-tab-inactiveBackground)',
              color: state.activeGroupId === g.id ? 'var(--vscode-tab-activeForeground)' : 'var(--vscode-tab-inactiveForeground)'
            }}
            onClick={() => setActiveGroup(g.id)}
          >
            <span style={{ lineHeight: 1 }}>{g.name}(:{g.port})</span>
            <span
              onClick={(e) => { e.stopPropagation(); removeGroupFromTab(g.id); }}
              style={{ opacity: 0.8, fontSize: 12, lineHeight: 1, display: 'inline-block' }}
            >
              ×
            </span>
          </div>
        ))}
        <button
          onClick={onAddGroup}
          aria-label={t('ui.addProxyGroup') || 'Add Group'}
          title={t('ui.addProxyGroup') || 'Add Group'}
          style={{ marginLeft: 4, minWidth: 0, padding: 0, width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <span className="codicon codicon-add" />
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: 12, overflowY: 'auto' }}>
        {activeGroup ? (
          <>
            {/* Group title and status */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{activeGroup.name}</div>
              <div style={{ color: 'var(--vscode-descriptionForeground)', display: 'flex', alignItems: 'center' }}>
                {state.groupStatuses?.[activeGroup.id]
                  ? (<><Icon name="circle-filled" color="#2ecc71" />{t('ui.running') || 'Running'}</>)
                  : (<><Icon name="circle-filled" color="#e74c3c" />{t('ui.stopped') || 'Stopped'}</>)}
              </div>
            </div>

            {/* Start/Stop buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <button style={{ minWidth: 96 }} onClick={() => startGroup(activeGroup.id)} disabled={!!state.groupStatuses?.[activeGroup.id]}><Icon name="play" />{t('ui.startServer') || 'Start'}</button>
              <button style={{ minWidth: 96 }} onClick={() => stopGroup(activeGroup.id)} disabled={!state.groupStatuses?.[activeGroup.id]}><Icon name="stop" />{t('ui.stopServer') || 'Stop'}</button>
            </div>

            {/* Group info + actions */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ flex: 1, background: 'var(--vscode-editor-background)', border: '1px solid var(--vscode-panel-border)', borderRadius: 4, padding: 10 }}>
                <div style={{ marginBottom: 6, fontWeight: 600 }}>{(t('ui.groupName') || 'Group Name') + ': '} {activeGroup.name} ({activeGroup.port})</div>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 4, columnGap: 8 }}>
                  <div>{t('ui.port') || 'Port'}:</div>
                  <div>{activeGroup.port}</div>
                  {!isWsGroup && (
                    <>
                      <div>{t('ui.interceptPrefix') || 'Intercept Prefix'}:</div>
                      <div>{activeGroup.interceptPrefix}</div>
                      <div>{t('ui.baseUrl') || 'Base URL'}:</div>
                      <div style={{ wordBreak: 'break-all' }}>{activeGroup.baseUrl}</div>
                    </>
                  )}
                  {isWsGroup && (
                    <>
                      <div>{t('ui.wsBaseUrl') || 'WebSocket Base URL'}:</div>
                      <div style={{ wordBreak: 'break-all' }}>{(activeGroup as ProxyGroup).wsBaseUrl || (t('ui.notSet') || '(Not set)')}</div>
                      <div>{t('ui.wsInterceptPrefix') || 'WS Intercept Prefix'}:</div>
                      <div>{(activeGroup as ProxyGroup).wsInterceptPrefix || (t('ui.notSet') || '(Not set)')}</div>
                    </>
                  )}
                  <div>{t('ui.stripPrefix') || 'Strip Prefix'}:</div>
                  <div>{activeGroup.stripPrefix ? (t('ui.yes') || 'Yes') : (t('ui.no') || 'No')}</div>
                  {!isWsGroup && (
                    <>
                      <div>{t('ui.globalCookie') || 'Global Cookie'}:</div>
                      <div>{(activeGroup.globalCookie && activeGroup.globalCookie.trim()) ? activeGroup.globalCookie : (t('ui.notSet') || '(Not set)')}</div>
                    </>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={onEditGroup}><Icon name="gear" />{t('ui.settings') || 'Settings'}</button>
                <button onClick={onDeleteGroup}><Icon name="trash" />{t('ui.delete') || 'Delete'}</button>
                {isWsGroup && (
                  <button onClick={onAddWsRule}>
                    <Icon name="add" />
                    {t('ui.addWsRule') || 'Add WS Rule'}
                  </button>
                )}
              </div>
            </div>

            {isWsGroup ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>
                    {t('ui.wsPanel.rules') || 'Rules'}
                    {' '}
                    ({(((activeGroup as ProxyGroup).wsPushRules || []) as WsRule[]).filter(r => r.enabled).length}
                    /
                    {(((activeGroup as ProxyGroup).wsPushRules || []) as WsRule[]).length})
                  </div>
                  <div style={{ flex: 1 }} />
                  <button onClick={onAddWsRule}>
                    <Icon name="add" />
                    {t('ui.addWsRule') || 'Add WS Rule'}
                  </button>
                </div>

                <div style={{ marginBottom: 12 }}>
                  {(((activeGroup as ProxyGroup).wsPushRules || []) as WsRule[]).length === 0 && (
                    <div style={{ color: 'var(--vscode-descriptionForeground, #888)', fontStyle: 'italic' }}>
                      {t('ui.wsPanel.noRules') || 'No WS rules configured.'}
                    </div>
                  )}
                  {(((activeGroup as ProxyGroup).wsPushRules || []) as WsRule[]).length > 0 && (
                    <div
                      style={{
                        borderRadius: 3,
                        border: '1px solid var(--vscode-panel-border)',
                        overflow: 'hidden',
                      }}
                    >
                      {(((activeGroup as ProxyGroup).wsPushRules || []) as WsRule[]).map((r, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '32px 120px 80px 1fr auto',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 8px',
                            borderBottom: '1px solid var(--vscode-panel-border)',
                            background: 'var(--vscode-editor-background)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <input
                              type="checkbox"
                              checked={r.enabled}
                              onChange={() => onToggleWsRuleEnabled(idx)}
                            />
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>
                            {(r.mode || 'off').toUpperCase()}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>
                            {r.direction || 'both'}
                          </div>
                          <div
                            style={{
                              flex: 1,
                              minWidth: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {r.path || (r.eventKey ? `${r.eventKey}=${r.eventValue ?? ''}` : '(*)')}
                          </div>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button onClick={() => onEditWsRule(idx)}>
                              <Icon name="edit" />
                              {t('ui.edit') || 'Edit'}
                            </button>
                            <button onClick={() => onDeleteWsRule(idx)}>
                              <Icon name="trash" />
                              {t('ui.delete') || 'Delete'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <WsPushPanel
                  rules={((activeGroup as ProxyGroup).wsPushRules || []) as WsRule[]}
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
              </>
            ) : (
              <>
                {/* Mock APIs header */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                  {(() => {
                    const total = (activeGroup.mockApis || []).length;
                    const enabledCount = ((activeGroup.mockApis || []) as MockApiConfig[]).filter(m => m.enabled).length;
                    return <div style={{ fontWeight: 600 }}>{`${t('ui.mockApis') || 'Mock APIs'} (${enabledCount}/${total})`}</div>;
                  })()}
                  <div style={{ flex: 1 }} />
                  <button onClick={onAddMock}><Icon name="add" />{t('ui.addMockApi') || 'Add Mock'}</button>
                </div>

                {/* Mock APIs list */}
                <div>
                  {((activeGroup.mockApis as MockApiConfig[]) || []).map((m, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 8, background: 'var(--vscode-editor-background)', borderRadius: 3, borderLeft: `3px solid ${m.enabled ? '#4caf50' : '#9e9e9e'}`, flexWrap: 'nowrap' }}>
                      <div style={{ minWidth: 42, textAlign: 'center', color: '#fff', background: methodColor(m.method), padding: '2px 6px', borderRadius: 2, fontSize: 10, fontWeight: 700 }}>{(m.method || '').toUpperCase()}</div>
                      <div style={{ flex: '1 1 auto', minWidth: 0, color: m.enabled ? 'var(--vscode-editor-foreground)' : 'var(--vscode-descriptionForeground)', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{m.path}</div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0, whiteSpace: 'nowrap' }}>
                        <button onClick={() => onToggleMock(idx)}>
                          {m.enabled ? (<><Icon name="circle-slash" />{t('ui.disable') || 'Disable'}</>) : (<><Icon name="check" />{t('ui.enable') || 'Enable'}</>)}
                        </button>
                        <button onClick={() => onEditMock(idx)}><Icon name="edit" />{t('ui.edit') || 'Edit'}</button>
                        <button onClick={() => onDeleteMock(idx)}><Icon name="trash" />{t('ui.delete') || 'Delete'}</button>
                      </div>
                    </div>
                  ))}
                  {((activeGroup.mockApis as MockApiConfig[]) || []).length === 0 && (
                    <div style={{ color: 'var(--vscode-descriptionForeground, #888)', fontStyle: 'italic' }}>{t('ui.clickAddToCreate') || 'Click Add to create'}</div>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <div style={{ color: 'var(--vscode-descriptionForeground, #888)' }}>No active group</div>
        )}
      </div>

      {/* Group Modal */}
      <GroupModal
        open={showGroupModal && !!editingGroup}
        draft={editingGroup || {
          name: '',
          enabled: true,
          port: 8888,
          interceptPrefix: '/api',
          baseUrl: '',
          stripPrefix: true,
          globalCookie: '',
          protocol: 'HTTP',
          wsBaseUrl: null,
          wsInterceptPrefix: null,
          wsManualPush: true,
          wssEnabled: false,
          wssKeystorePath: null,
          wssKeystorePassword: null,
        }}
        onChange={setEditingGroup as (d: GroupDraft) => void}
        onSave={onSaveGroup}
        onCancel={() => setShowGroupModal(false)}
        isEdit={isEditingGroup}
        labels={{
          titleAdd: t('ui.addProxyGroup') || 'Add Group',
          titleEdit: t('ui.editProxyGroup') || 'Edit Group',
          sectionGroup: t('ui.section.group') || '配置组设置',
          sectionHttp: t('ui.section.http') || 'HTTP 设置',
          sectionWs: t('ui.section.ws') || 'WebSocket 设置',
          name: t('ui.groupName') || 'Name',
          enabled: t('ui.enabled') || 'Enabled',
          protocol: t('ui.protocol') || 'Protocol',
          protocolHttp: t('ui.protocol.http') || 'HTTP',
          protocolWs: t('ui.protocol.ws') || 'WebSocket',
          port: t('ui.port') || 'Port',
          interceptPrefix: t('ui.interceptPrefix') || 'Intercept Prefix',
          baseUrl: t('ui.baseUrl') || 'Base URL',
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

      {/* Mock Modal */}
      <MockModal
        open={showMockModal && !!mockDraft}
        draft={mockDraft || { enabled:true, method:'GET', path:'/', statusCode:200, delay:0, mockData:'{"ok":true}' }}
        onChange={setMockDraft as (d: MockApiDraft) => void}
        onSave={onSaveMock}
        onFormat={formatMock}
        onCancel={() => setShowMockModal(false)}
        isEdit={editingMockIndex !== null}
        labels={{
          titleAdd: t('ui.addMockApi') || 'Add Mock',
          titleEdit: t('ui.editMockApi') || 'Edit Mock',
          enabled: t('ui.enabled') || 'Enabled',
          method: t('ui.method') || 'Method',
          path: t('ui.path') || 'Path',
          statusCode: t('ui.statusCode') || 'Status',
          delay: t('ui.delay') || 'Delay',
          responseBody: t('ui.responseBody') || 'Response Body (JSON)',
          format: t('ui.format') || 'Format',
          save: t('ui.save') || 'Save',
          cancel: t('ui.cancel') || 'Cancel',
        }}
      />

      {/* WS Rule Modal */}
      <WsRuleModal
        open={showWsRuleModal && !!wsRuleDraft}
        draft={
          wsRuleDraft || ensureWsRuleDefaults({ enabled: true, mode: 'off', direction: 'both', message: '{}' })
        }
        onChange={setWsRuleDraft as (r: WsRule) => void}
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
  );
}
/// <reference path="./react-shim.d.ts" />
