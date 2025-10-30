import React, { useCallback, useMemo, useState } from 'react';
import { GroupDraft, MockApiDraft, MockApiConfig, ProxyGroup } from './interfaces/business';
import { GroupSummary, InitialState, IWWindow, VsCodeApi } from './interfaces/ui';
import { GroupList } from './components/GroupList';
import { GroupHeader } from './components/GroupHeader';
import { MockList } from './components/MockList';
import { GroupModal } from './components/GroupModal';
import { MockModal } from './components/MockModal';

function useVscode(): VsCodeApi {
  try {
    const w = window as unknown as IWWindow;
    return w.acquireVsCodeApi ? w.acquireVsCodeApi() : ({ postMessage: (_: unknown) => {} } as VsCodeApi);
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
  const t = useCallback((k: string) => state.i18n?.[k] ?? k, [state.i18n]);

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
  const [showMockModal, setShowMockModal] = useState(false);
  const [editingMockIndex, setEditingMockIndex] = useState(null as number | null);
  const [mockDraft, setMockDraft] = useState(null as MockApiDraft | null);

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
    setEditingGroup({
      name: '',
      enabled: true,
      port: 8888,
      interceptPrefix: '/api',
      baseUrl: 'http://localhost:8080',
      stripPrefix: true,
      globalCookie: '',
    } as GroupDraft);
    setShowGroupModal(true);
  };
  const onEditGroup = () => {
    if (!activeGroup) return;
    const { id: _id, mockApis: _m, ...rest } = activeGroup as ProxyGroup;
    setEditingGroup({ ...(rest as GroupDraft) });
    setShowGroupModal(true);
  };
  const onDeleteGroup = () => {
    if (!activeGroup) return;
    vscode.postMessage({ type: 'deleteGroup', groupId: activeGroup.id });
  };
  const onSaveGroup = () => {
    if (!editingGroup) return;
    if (activeGroup && showGroupModal && activeGroup.id) {
      vscode.postMessage({ type: 'updateGroup', groupId: activeGroup.id, data: editingGroup });
    } else {
      vscode.postMessage({ type: 'addGroup', data: editingGroup });
    }
  };

  // Mock operations
  const onAddMock = () => {
    if (!activeGroup) return;
    setEditingMockIndex(null);
    setMockDraft({
      enabled: true,
      method: 'GET',
      path: '/',
      statusCode: 200,
      mockData: '{"ok":true}',
      delay: 0,
    } as MockApiDraft);
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
    const handler = (_e: Event) => setShowGroupModal(false);
    window.addEventListener('iw:closeGroupForm', handler);
    return () => window.removeEventListener('iw:closeGroupForm', handler);
  }, []);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', height: '100vh', fontFamily: 'var(--vscode-font-family, system-ui, Arial)' }}>
      <div>
        <div style={{ display: 'flex', gap: 8, padding: 12 }}>
          <button onClick={startAll}>{t('ui.startAll') || 'Start All'}</button>
          <button onClick={stopAll}>{t('ui.stopAll') || 'Stop All'}</button>
        </div>
        <GroupList
          groups={groups}
          activeGroupId={state.activeGroupId}
          onSelect={setActiveGroup}
          onAddGroup={onAddGroup}
          noGroupsText={t('ui.noMockApis') || 'No groups yet'}
        />
      </div>

      <div style={{ padding: 12 }}>
        {activeGroup ? (
          <>
            <GroupHeader
              group={activeGroup as ProxyGroup}
              running={!!state.groupStatuses?.[activeGroup.id]}
              onStart={() => startGroup(activeGroup.id)}
              onStop={() => stopGroup(activeGroup.id)}
              onEdit={onEditGroup}
              onDelete={onDeleteGroup}
              labels={{
                start: t('ui.startServer') || 'Start',
                stop: t('ui.stopServer') || 'Stop',
                edit: t('ui.edit') || 'Edit',
                delete: t('ui.delete') || 'Delete',
              }}
            />

            <MockList
              mocks={(activeGroup.mockApis as MockApiConfig[]) || []}
              onToggle={onToggleMock}
              onEdit={onEditMock}
              onDelete={onDeleteMock}
              onAdd={onAddMock}
              labels={{
                mockApis: t('ui.mockApis') || 'Mock APIs',
                addMock: t('ui.addMockApi') || 'Add Mock',
                enable: t('ui.enable') || 'Enable',
                disable: t('ui.disable') || 'Disable',
                edit: t('ui.edit') || 'Edit',
                delete: t('ui.delete') || 'Delete',
                emptyText: t('ui.clickAddToCreate') || 'Click Add to create',
              }}
            />
          </>
        ) : (
          <div style={{ color: 'var(--vscode-descriptionForeground, #888)' }}>No active group</div>
        )}
      </div>

      {/* Group Modal */}
      <GroupModal
        open={showGroupModal && !!editingGroup}
        draft={editingGroup || { name:'', enabled:true, port:8888, interceptPrefix:'/api', baseUrl:'', stripPrefix:true, globalCookie:'' }}
        onChange={setEditingGroup as (d: GroupDraft) => void}
        onSave={onSaveGroup}
        onCancel={() => setShowGroupModal(false)}
        isEdit={!!(editingGroup && activeGroup)}
        labels={{
          titleAdd: t('ui.addProxyGroup') || 'Add Group',
          titleEdit: t('ui.editProxyGroup') || 'Edit Group',
          name: t('ui.groupName') || 'Name',
          port: t('ui.port') || 'Port',
          interceptPrefix: t('ui.interceptPrefix') || 'Intercept Prefix',
          baseUrl: t('ui.baseUrl') || 'Base URL',
          stripPrefix: t('ui.stripPrefix') || 'Strip Prefix',
          globalCookie: t('ui.globalCookie') || 'Global Cookie',
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
        }}
      />
    </div>
  );
}
/// <reference path="./react-shim.d.ts" />
