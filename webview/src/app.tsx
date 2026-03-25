import React, { useCallback, useMemo, useState } from 'react';
import {
    GroupDraft,
    MockApiDraft,
    MockApiConfig,
    ProxyGroup,
    WsRule,
    HttpProxy,
    HttpProxyDraft,
} from './interfaces/business';
import { GroupSummary, InitialState, IWWindow, VsCodeApi } from './interfaces/ui';
import { GroupModal } from './components/GroupModal';
import { MockModal } from './components/MockModal';
import { WsManualTarget } from './components/WsPushPanel';
import { WsRuleModal } from './components/WsRuleModal';
import { HttpProxyModal } from './components/HttpProxyModal';
import { ProxiesModal } from './components/ProxiesModal';
import { GroupTabs } from './components/GroupTabs';
import { GroupSection } from './components/GroupSection';
import { WsSection } from './components/WsSection';
import { HttpProxySection } from './components/HttpProxySection';

function useVscode(): VsCodeApi {
    try {
        const w = window as unknown as IWWindow;
        const api =
            w.__IW_VSCODE__ ||
            (w.acquireVsCodeApi
                ? w.acquireVsCodeApi()
                : ({ postMessage: (_: unknown) => {} } as VsCodeApi));
        return {
            postMessage: (message: unknown) => {
                try {
                    console.debug('[IW] postMessage →', message);
                } catch {}
                try {
                    (api as any).postMessage(message);
                } catch (e) {
                    try {
                        console.error('[IW] postMessage error', e);
                    } catch {}
                }
            },
            getState: (api as any).getState?.bind(api),
            setState: (api as any).setState?.bind(api),
        } as VsCodeApi;
    } catch {
        return {
            postMessage: (_: unknown) => {
                try {
                    console.warn('[IW] postMessage dropped: vscode api missing');
                } catch {}
            },
        } as VsCodeApi;
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
            return input.replace(
                /([,{]\s*)([A-Za-z_$][\w$-]*)(\s*):/g,
                (m: string, p1: string, key: string, p3: string) => {
                    if (key.startsWith('"') || key.startsWith("'")) return m;
                    return `${p1}"${key}"${p3}:`;
                }
            );
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

export function App({
    state,
    setState,
}: {
    state: InitialState;
    setState: (s: InitialState) => void;
}) {
    const vscode = useVscode();
    const t = useCallback(
        (k: string) => {
            const v = (state.i18n && (state.i18n as any)[k]) as string | undefined;
            if (!v) return '';
            // If VS Code l10n returns the key itself (e.g., 'ui.startAll') in base locale, treat as missing
            if (v === k) return '';
            // Defensive: if value still looks like a dotted key, fallback to default text in UI
            if (/^[a-z]+\./i.test(v)) return '';
            return v;
        },
        [state.i18n]
    );

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
    const [showHttpProxyModal, setShowHttpProxyModal] = useState(false);
    const [editingHttpProxyIndex, setEditingHttpProxyIndex] = useState<number | null>(null);
    const [httpProxyDraft, setHttpProxyDraft] = useState<HttpProxyDraft | null>(null);
    const [activeProxyId, setActiveProxyId] = useState<string | null>(null);
    const [showProxiesModal, setShowProxiesModal] = useState(false);

    const httpProxies = useMemo(() => {
        if (!activeGroup || (activeGroup as ProxyGroup).protocol === 'WS') return [];
        const proxies = ((activeGroup as ProxyGroup).httpProxies || []) as HttpProxy[];
        return proxies.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
    }, [activeGroup]);

    const activeProxy = useMemo(() => {
        if (!httpProxies.length) return null;
        if (!activeProxyId) return httpProxies[0];
        return httpProxies.find(p => p.id === activeProxyId) || httpProxies[0];
    }, [httpProxies, activeProxyId]);

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
            vscode.postMessage({
                type: 'updateGroup',
                groupId: activeGroup.id,
                data: editingGroup,
            });
        } else {
            vscode.postMessage({ type: 'addGroup', data: editingGroup });
        }
    };

    // Mock operations (now associated with active proxy)
    const onAddMock = () => {
        if (!activeGroup || !activeProxy) {
            alert(t('ui.selectProxyFirst') || 'Please select a proxy first');
            return;
        }
        setEditingMockIndex(null);
        setMockDraft({
            enabled: true,
            method: 'GET',
            path: '/',
            statusCode: 200,
            mockData: '{"ok":true}',
            delay: 0,
            contentType: 'application/json',
        } as MockApiDraft);
        setShowMockModal(true);
    };
    const onEditMock = (index: number) => {
        if (!activeGroup || !activeProxy) {
            alert(t('ui.selectProxyFirst') || 'Please select a proxy first');
            return;
        }
        const mocks = (activeProxy.mockApis || []) as MockApiConfig[];
        const m = mocks[index];
        if (!m) return;
        setEditingMockIndex(index);
        let response = m.mockData;
        const contentType = m.contentType || 'application/json';
        if (contentType === 'application/json') {
            try {
                response = JSON.stringify(JSON.parse(m.mockData), null, 2);
            } catch {}
        }
        setMockDraft({ ...m, mockData: response });
        setShowMockModal(true);
    };
    const onDeleteMock = (index: number) => {
        if (!activeGroup || !activeProxy) {
            alert(t('ui.selectProxyFirst') || 'Please select a proxy first');
            return;
        }
        const proxies = [...httpProxies];
        const proxyIdx = httpProxies.findIndex(p => p.id === activeProxy.id);
        if (proxyIdx === -1) return;
        const mocks = [...(activeProxy.mockApis || [])];
        mocks.splice(index, 1);
        proxies[proxyIdx] = { ...proxies[proxyIdx], mockApis: mocks };
        vscode.postMessage({
            type: 'updateHttpProxies',
            groupId: activeGroup.id,
            httpProxies: proxies,
        });
    };
    const onToggleMock = (index: number) => {
        if (!activeGroup || !activeProxy) {
            alert(t('ui.selectProxyFirst') || 'Please select a proxy first');
            return;
        }
        const proxies = [...httpProxies];
        const proxyIdx = httpProxies.findIndex(p => p.id === activeProxy.id);
        if (proxyIdx === -1) return;
        const mocks = (activeProxy.mockApis || []).map((m, i) =>
            i === index ? { ...m, enabled: !m.enabled } : m
        );
        proxies[proxyIdx] = { ...proxies[proxyIdx], mockApis: mocks };
        vscode.postMessage({
            type: 'updateHttpProxies',
            groupId: activeGroup.id,
            httpProxies: proxies,
        });
    };
    const onSaveMock = () => {
        if (!activeGroup || !activeProxy || !mockDraft) return;
        const contentType = mockDraft.contentType || 'application/json';
        let mockData = mockDraft.mockData;
        if (contentType === 'application/json') {
            try {
                const parsed = parseJsonSmart(mockDraft.mockData ?? '');
                mockData = JSON.stringify(parsed);
            } catch (e) {
                const msg = (e as Error)?.message || String(e);
                alert((state.i18n?.['ui.jsonInvalid'] || 'Invalid JSON') + ': ' + msg);
                return;
            }
        }
        const payload = { ...mockDraft, mockData };
        const proxies = [...httpProxies];
        const proxyIdx = httpProxies.findIndex(p => p.id === activeProxy.id);
        if (proxyIdx === -1) return;
        const existingMocks = (activeProxy.mockApis || []) as MockApiConfig[];
        let nextMocks: MockApiConfig[];
        if (editingMockIndex !== null) {
            nextMocks = existingMocks.map((m, i) => (i === editingMockIndex ? payload : m));
        } else {
            nextMocks = [...existingMocks, payload];
        }
        proxies[proxyIdx] = { ...proxies[proxyIdx], mockApis: nextMocks };
        vscode.postMessage({
            type: 'updateHttpProxies',
            groupId: activeGroup.id,
            httpProxies: proxies,
        });
        setShowMockModal(false);
        setEditingMockIndex(null);
        setMockDraft(null);
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
        vscode.postMessage({
            type: 'updateWsRules',
            groupId: activeGroup.id,
            rulesIndexToDelete: index,
        });
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
        const contentType = mockDraft.contentType || 'application/json';
        if (contentType === 'application/json') {
            try {
                const parsed = parseJsonSmart(mockDraft.mockData ?? '');
                setMockDraft({ ...mockDraft, mockData: JSON.stringify(parsed, null, 2) });
            } catch (e) {
                const msg = (e as Error)?.message || String(e);
                alert((state.i18n?.['ui.jsonInvalid'] || 'Invalid JSON') + ': ' + msg);
            }
        }
    };

    // HttpProxy operations
    const onAddHttpProxy = () => {
        if (!activeGroup) return;
        setEditingHttpProxyIndex(null);
        setHttpProxyDraft({
            name: '',
            enabled: true,
            interceptPrefix: '/api',
            baseUrl: 'http://localhost:8080',
            stripPrefix: true,
            globalCookie: '',
        });
        setShowHttpProxyModal(true);
    };

    const onEditHttpProxy = (index: number) => {
        if (!activeGroup) return;
        const proxies = (activeGroup as ProxyGroup).httpProxies || [];
        const proxy = proxies[index];
        if (!proxy) return;
        setEditingHttpProxyIndex(index);
        setHttpProxyDraft({
            name: proxy.name,
            enabled: proxy.enabled,
            interceptPrefix: proxy.interceptPrefix,
            baseUrl: proxy.baseUrl,
            stripPrefix: proxy.stripPrefix,
            globalCookie: proxy.globalCookie,
        });
        setShowHttpProxyModal(true);
    };

    const onDeleteHttpProxy = (index: number) => {
        if (!activeGroup) return;
        const proxies = [...((activeGroup as ProxyGroup).httpProxies || [])];
        proxies.splice(index, 1);
        vscode.postMessage({
            type: 'updateHttpProxies',
            groupId: activeGroup.id,
            httpProxies: proxies,
        });
    };

    const onToggleHttpProxy = (index: number) => {
        if (!activeGroup) return;
        const proxies = ((activeGroup as ProxyGroup).httpProxies || []).map((p, idx) =>
            idx === index ? { ...p, enabled: !p.enabled } : p
        );
        vscode.postMessage({
            type: 'updateHttpProxies',
            groupId: activeGroup.id,
            httpProxies: proxies,
        });
    };

    const onSaveHttpProxy = () => {
        if (!activeGroup || !httpProxyDraft) return;
        const existingProxies = (activeGroup as ProxyGroup).httpProxies || [];
        const newProxy: HttpProxy = {
            id:
                editingHttpProxyIndex !== null
                    ? existingProxies[editingHttpProxyIndex].id
                    : `proxy-${Date.now()}`,
            ...httpProxyDraft,
            priority:
                editingHttpProxyIndex !== null
                    ? existingProxies[editingHttpProxyIndex].priority
                    : existingProxies.length,
        };
        let nextProxies: HttpProxy[];
        if (editingHttpProxyIndex !== null) {
            nextProxies = existingProxies.map((p, idx) =>
                idx === editingHttpProxyIndex ? newProxy : p
            );
        } else {
            nextProxies = [...existingProxies, newProxy];
        }
        vscode.postMessage({
            type: 'updateHttpProxies',
            groupId: activeGroup.id,
            httpProxies: nextProxies,
        });
        setShowHttpProxyModal(false);
        setEditingHttpProxyIndex(null);
        setHttpProxyDraft(null);
    };

    const onUpdateProxiesOrder = (newProxies: HttpProxy[]) => {
        if (!activeGroup) return;
        vscode.postMessage({
            type: 'updateHttpProxies',
            groupId: activeGroup.id,
            httpProxies: newProxies,
        });
    };

    const onOpenProxiesModal = () => {
        setShowProxiesModal(true);
    };

    const onEditProxyFromModal = (index: number) => {
        const sortedProxies = [...httpProxies];
        const proxy = sortedProxies[index];
        if (!proxy) return;
        const originalIndex = ((activeGroup as ProxyGroup).httpProxies || []).findIndex(
            p => p.id === proxy.id
        );
        if (originalIndex === -1) return;
        setEditingHttpProxyIndex(originalIndex);
        setHttpProxyDraft({
            name: proxy.name,
            enabled: proxy.enabled,
            interceptPrefix: proxy.interceptPrefix,
            baseUrl: proxy.baseUrl,
            stripPrefix: proxy.stripPrefix,
            globalCookie: proxy.globalCookie,
        });
        setShowProxiesModal(false);
        setShowHttpProxyModal(true);
    };

    const onAddProxyFromModal = () => {
        setShowProxiesModal(false);
        onAddHttpProxy();
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

    // Handle response file selection result
    React.useEffect(() => {
        const handler = (event: MessageEvent) => {
            const data = event.data;
            if (data.type === 'responseFileSelected' && data.path) {
                if (mockDraft) {
                    setMockDraft({ ...mockDraft, responseFile: data.path });
                }
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [mockDraft]);

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
            setMockDraft({
                enabled: true,
                method: 'GET',
                path: '/',
                statusCode: 200,
                mockData: '{"ok":true}',
                delay: 0,
            } as MockApiDraft);
            setShowMockModal(false);
        }
        if (act === 'editMock' && activeGroup && typeof state.panelAction?.index === 'number') {
            const idx = state.panelAction.index as number;
            const m = (activeGroup.mockApis as MockApiConfig[])[idx];
            setEditingMockIndex(idx);
            let response = m.mockData;
            try {
                response = JSON.stringify(JSON.parse(m.mockData), null, 2);
            } catch {}
            setMockDraft({ ...m, mockData: response });
            setShowMockModal(false);
        }
    }, [state.panelAction, activeGroup]);

    const removeGroupFromTab = (id: string) => {
        vscode.postMessage({ type: 'deleteGroup', groupId: id });
    };

    const totalGroups = (state.config?.proxyGroups || []).length;
    const runningCount = (state.config?.proxyGroups || []).reduce(
        (acc: number, g: ProxyGroup) => acc + (state.groupStatuses?.[g.id] ? 1 : 0),
        0
    );
    const allRunning = totalGroups > 0 && runningCount === totalGroups;
    const noneRunning = runningCount === 0;

    const isWsGroup = !!activeGroup && (activeGroup as ProxyGroup).protocol === 'WS';

    const sendWsByRule = (ruleIndex: number, target: WsManualTarget) => {
        if (!activeGroup) return;
        vscode.postMessage({
            type: 'wsManualPushByRule',
            groupId: activeGroup.id,
            ruleIndex,
            target,
        });
    };

    const sendWsCustom = (target: WsManualTarget, payload: string) => {
        if (!activeGroup) return;
        vscode.postMessage({
            type: 'wsManualPushCustom',
            groupId: activeGroup.id,
            target,
            payload,
        });
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                fontFamily: 'var(--vscode-font-family, system-ui, Arial)',
            }}
        >
            {/* Global controls */}
            <div style={{ display: 'flex', gap: 8, padding: 12, flexWrap: 'wrap' }}>
                <button style={{ minWidth: 96 }} onClick={startAll} disabled={allRunning}>
                    <Icon name="play" />
                    {t('ui.startAll') || 'Start All'}
                </button>
                <button style={{ minWidth: 96 }} onClick={stopAll} disabled={noneRunning}>
                    <Icon name="stop" />
                    {t('ui.stopAll') || 'Stop All'}
                </button>
                <div style={{ flex: 1 }} />
            </div>

            <GroupTabs
                groups={groups}
                activeGroupId={state.activeGroupId}
                onSelect={setActiveGroup}
                onRemove={removeGroupFromTab}
                onAdd={onAddGroup}
                t={t}
            />

            {/* Content */}
            <div style={{ padding: 12, overflowY: 'auto' }}>
                {activeGroup ? (
                    <>
                        <GroupSection
                            group={activeGroup as ProxyGroup}
                            isRunning={!!state.groupStatuses?.[activeGroup.id]}
                            onStart={() => startGroup(activeGroup.id)}
                            onStop={() => stopGroup(activeGroup.id)}
                            onEdit={onEditGroup}
                            onDelete={onDeleteGroup}
                            t={t}
                        />

                        {isWsGroup ? (
                            <WsSection
                                group={activeGroup as ProxyGroup}
                                onAddRule={onAddWsRule}
                                onEditRule={onEditWsRule}
                                onDeleteRule={onDeleteWsRule}
                                onToggleRule={onToggleWsRuleEnabled}
                                sendWsByRule={sendWsByRule}
                                sendWsCustom={sendWsCustom}
                                t={t}
                            />
                        ) : (
                            <HttpProxySection
                                proxies={httpProxies}
                                activeProxy={activeProxy}
                                onSelectProxy={setActiveProxyId}
                                onOpenManageModal={onOpenProxiesModal}
                                onEditProxy={onEditHttpProxy}
                                onToggleProxy={onToggleHttpProxy}
                                onDeleteProxy={onDeleteHttpProxy}
                                onAddMock={onAddMock}
                                onEditMock={onEditMock}
                                onToggleMock={onToggleMock}
                                onDeleteMock={onDeleteMock}
                                t={t}
                            />
                        )}
                    </>
                ) : (
                    <div style={{ color: 'var(--vscode-descriptionForeground, #888)' }}>
                        No active group
                    </div>
                )}
            </div>

            {/* Group Modal */}
            <GroupModal
                open={showGroupModal && !!editingGroup}
                draft={
                    editingGroup || {
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
                    }
                }
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
                draft={
                    mockDraft || {
                        enabled: true,
                        method: 'GET',
                        path: '/',
                        statusCode: 200,
                        delay: 0,
                        mockData: '{"ok":true}',
                        contentType: 'application/json',
                    }
                }
                onChange={setMockDraft as (d: MockApiDraft) => void}
                onSave={onSaveMock}
                onFormat={formatMock}
                onCancel={() => setShowMockModal(false)}
                onSelectFile={() => vscode.postMessage({ type: 'selectResponseFile' })}
                isEdit={editingMockIndex !== null}
                labels={{
                    titleAdd: t('ui.addMockApi') || 'Add Mock',
                    titleEdit: t('ui.editMockApi') || 'Edit Mock',
                    enabled: t('ui.enabled') || 'Enabled',
                    method: t('ui.method') || 'Method',
                    path: t('ui.path') || 'Path',
                    statusCode: t('ui.statusCode') || 'Status',
                    delay: t('ui.delay') || 'Delay',
                    responseFile: t('ui.responseFile') || 'Response File',
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
                    wsRuleDraft ||
                    ensureWsRuleDefaults({
                        enabled: true,
                        mode: 'off',
                        direction: 'both',
                        message: '{}',
                    })
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
                    timelineSecList:
                        t('ui.wsRule.timeline.secList') || 'Timeline (seconds, comma separated)',
                    message: t('ui.wsRule.message') || 'Message (JSON)',
                    formatJson: t('ui.format') || 'Format',
                    cancel: t('ui.cancel') || 'Cancel',
                    save: t('ui.save') || 'Save',
                    basicSectionTitle: t('ui.wsRule.section.basic') || 'Basic Settings',
                    timelineEmpty:
                        t('ui.wsRule.timeline.empty') ||
                        'No timeline items. Click "Add" to create one.',
                    timelineAdd: t('ui.wsRule.timeline.add') || 'Add',
                    timelineEdit: t('ui.wsRule.timeline.edit') || 'Edit',
                    timelineDelete: t('ui.wsRule.timeline.delete') || 'Delete',
                    timelineEditorAddTitle:
                        t('ui.wsRule.timeline.editor.addTitle') || 'Add timeline item',
                    timelineEditorEditTitle:
                        t('ui.wsRule.timeline.editor.editTitle') || 'Edit timeline item',
                    timelineEditorAtMs: t('ui.wsRule.timeline.editor.atMs') || 'At (ms)',
                    timelineEditorMessage:
                        t('ui.wsRule.timeline.editor.message') || 'Message (JSON)',
                    timelineEditorSave: t('ui.wsRule.timeline.editor.save') || 'Save item',
                    timelineEditorCancel: t('ui.wsRule.timeline.editor.cancel') || 'Cancel',
                    timelineInvalidAtMs:
                        t('ui.wsRule.timeline.invalidAtMs') ||
                        'Timeline point must be a non-negative integer (milliseconds)',
                    jsonFormatError: t('ui.wsRule.jsonFormatError') || 'JSON format error: {0}',
                    selectTimelineItem:
                        t('ui.wsRule.selectTimelineItem') ||
                        'Select a timeline item to edit its message content (JSON)',
                }}
            />

            {/* HTTP Proxy Modal */}
            <HttpProxyModal
                open={showHttpProxyModal && !!httpProxyDraft}
                draft={
                    httpProxyDraft || {
                        name: '',
                        enabled: true,
                        interceptPrefix: '/api',
                        baseUrl: '',
                        stripPrefix: true,
                        globalCookie: '',
                    }
                }
                onChange={setHttpProxyDraft as (d: HttpProxyDraft) => void}
                onSave={onSaveHttpProxy}
                onCancel={() => {
                    setShowHttpProxyModal(false);
                    setEditingHttpProxyIndex(null);
                    setHttpProxyDraft(null);
                }}
                isEdit={editingHttpProxyIndex !== null}
                labels={{
                    titleAdd: t('ui.addHttpProxy') || 'Add HTTP Proxy',
                    titleEdit: t('ui.editHttpProxy') || 'Edit HTTP Proxy',
                    name: t('ui.proxyName') || 'Name',
                    enabled: t('ui.enabled') || 'Enabled',
                    interceptPrefix: t('ui.interceptPrefix') || 'Intercept Prefix',
                    baseUrl: t('ui.baseUrl') || 'Base URL',
                    stripPrefix: t('ui.stripPrefix') || 'Strip Prefix',
                    globalCookie: t('ui.globalCookie') || 'Global Cookie',
                    save: t('ui.save') || 'Save',
                    cancel: t('ui.cancel') || 'Cancel',
                    yesLabel: t('ui.yes') || 'Yes',
                    noLabel: t('ui.no') || 'No',
                }}
            />

            <ProxiesModal
                open={showProxiesModal}
                proxies={httpProxies}
                onChange={onUpdateProxiesOrder}
                onAdd={onAddProxyFromModal}
                onEdit={onEditProxyFromModal}
                onCancel={() => setShowProxiesModal(false)}
                labels={{
                    title: t('ui.manageProxies') || 'Manage Proxies',
                    name: t('ui.proxyName') || 'Name',
                    interceptPrefix: t('ui.interceptPrefix') || 'Intercept Prefix',
                    baseUrl: t('ui.baseUrl') || 'Base URL',
                    priority: t('ui.priority') || 'Priority',
                    enabled: t('ui.enabled') || 'Enabled',
                    actions: t('ui.actions') || 'Actions',
                    moveUp: t('ui.moveUp') || 'Move Up',
                    moveDown: t('ui.moveDown') || 'Move Down',
                    edit: t('ui.edit') || 'Edit',
                    delete: t('ui.delete') || 'Delete',
                    add: t('ui.addHttpProxy') || 'Add Proxy',
                    close: t('ui.close') || 'Close',
                    noProxies: t('ui.noProxies') || 'No proxies configured',
                    enable: t('ui.enable') || 'Enable',
                    disable: t('ui.disable') || 'Disable',
                    prefix: t('ui.prefix') || 'Prefix',
                    base: t('ui.base') || 'Base',
                    priorityHint:
                        t('ui.priorityHint') ||
                        'Priority from high to low: proxies at the top of the list match requests first',
                }}
            />
        </div>
    );
}
/// <reference path="./react-shim.d.ts" />
