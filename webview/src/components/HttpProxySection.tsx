import React, { useState, useMemo } from 'react';
import type { HttpProxy, MockApiConfig } from '../interfaces/business';

const methodColor = (method: string): string => {
    const m = (method || '').toUpperCase();
    switch (m) {
        case 'GET':
            return '#4caf50';
        case 'POST':
            return '#2196f3';
        case 'PUT':
            return '#ff9800';
        case 'DELETE':
            return '#f44336';
        case 'PATCH':
            return '#9c27b0';
        default:
            return '#607d8b';
    }
};

function getPathWithoutQuery(path: string): string {
    return path.split('?')[0];
}

export interface HttpProxySectionProps {
    proxies: HttpProxy[];
    activeProxy: HttpProxy | null;
    onSelectProxy: (id: string) => void;
    onOpenManageModal: () => void;
    onEditProxy: (index: number) => void;
    onToggleProxy: (index: number) => void;
    onDeleteProxy: (index: number) => void;
    onAddMock: () => void;
    onEditMock: (index: number) => void;
    onToggleMock: (index: number) => void;
    onDeleteMock: (index: number) => void;
    t: (key: string) => string;
}

export function HttpProxySection({
    proxies,
    activeProxy,
    onSelectProxy,
    onOpenManageModal,
    onEditProxy,
    onToggleProxy,
    onDeleteProxy,
    onAddMock,
    onEditMock,
    onToggleMock,
    onDeleteMock,
    t,
}: HttpProxySectionProps) {
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [searchText, setSearchText] = useState('');

    const filteredMocks = useMemo(() => {
        if (!activeProxy) return [];
        const mocks = (activeProxy.mockApis || []) as MockApiConfig[];
        if (!searchText.trim()) return mocks;
        const lowerSearch = searchText.toLowerCase();
        return mocks.filter(m => m.path.toLowerCase().includes(lowerSearch));
    }, [activeProxy, searchText]);

    const groupedMocks = useMemo(() => {
        const groups = new Map<string, (MockApiConfig & { originalIndex: number })[]>();
        filteredMocks.forEach((m, idx) => {
            const originalIdx = (activeProxy?.mockApis || []).indexOf(m);
            const pathKey = getPathWithoutQuery(m.path);
            if (!groups.has(pathKey)) {
                groups.set(pathKey, []);
            }
            groups
                .get(pathKey)!
                .push({ ...m, originalIndex: originalIdx >= 0 ? originalIdx : idx });
        });
        return groups;
    }, [filteredMocks, activeProxy]);

    const toggleGroup = (pathKey: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(pathKey)) {
                next.delete(pathKey);
            } else {
                next.add(pathKey);
            }
            return next;
        });
    };

    const allExpanded = expandedGroups.size === groupedMocks.size && groupedMocks.size > 0;

    const toggleExpandAll = () => {
        if (allExpanded) {
            setExpandedGroups(new Set());
        } else {
            setExpandedGroups(new Set(groupedMocks.keys()));
        }
    };
    return (
        <>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 8,
                    flexWrap: 'wrap',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {proxies.map(p => (
                        <div
                            key={p.id}
                            onClick={() => onSelectProxy(p.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '4px 10px',
                                fontSize: 12,
                                background:
                                    activeProxy?.id === p.id
                                        ? 'var(--vscode-button-background)'
                                        : 'var(--vscode-tab-inactiveBackground)',
                                color:
                                    activeProxy?.id === p.id
                                        ? 'var(--vscode-button-foreground)'
                                        : 'var(--vscode-tab-inactiveForeground)',
                                borderRadius: 3,
                                cursor: 'pointer',
                                border:
                                    activeProxy?.id === p.id
                                        ? '1px solid var(--vscode-button-background)'
                                        : '1px solid transparent',
                                opacity: p.enabled ? 1 : 0.6,
                            }}
                        >
                            <span
                                className={`codicon codicon-${p.enabled ? 'plug' : 'debug-disconnect'}`}
                                style={{ fontSize: 12 }}
                            />
                            <span>{p.name || '(unnamed)'}</span>
                        </div>
                    ))}
                </div>
                <div style={{ flex: 1 }} />
                <button onClick={onOpenManageModal} style={{ padding: '4px 8px', fontSize: 12 }}>
                    <span className="codicon codicon-list-unordered" style={{ marginRight: 4 }} />
                    {t('ui.manageProxies') || 'Manage Proxies'}
                </button>
            </div>

            {activeProxy ? (
                <>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 12px',
                            marginBottom: 12,
                            background: 'var(--vscode-editor-inactiveSelectionBackground)',
                            borderRadius: 4,
                            flexWrap: 'wrap',
                        }}
                    >
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'auto 1fr',
                                gap: '2px 12px',
                                fontSize: 11,
                                flex: 1,
                                minWidth: 0,
                            }}
                        >
                            <span style={{ color: 'var(--vscode-descriptionForeground)' }}>
                                {t('ui.prefix') || 'Prefix'}:
                            </span>
                            <span style={{ wordBreak: 'break-all' }}>
                                {activeProxy.interceptPrefix}
                            </span>
                            <span style={{ color: 'var(--vscode-descriptionForeground)' }}>
                                {t('ui.base') || 'Base'}:
                            </span>
                            <span style={{ wordBreak: 'break-all' }}>{activeProxy.baseUrl}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button
                                onClick={() =>
                                    onEditProxy(proxies.findIndex(p => p.id === activeProxy.id))
                                }
                                style={{ padding: '2px 8px', fontSize: 11 }}
                            >
                                <span className="codicon codicon-edit" style={{ marginRight: 4 }} />
                                {t('ui.edit') || 'Edit'}
                            </button>
                            <button
                                onClick={() =>
                                    onToggleProxy(proxies.findIndex(p => p.id === activeProxy.id))
                                }
                                style={{ padding: '2px 8px', fontSize: 11 }}
                            >
                                {activeProxy.enabled ? (
                                    <>
                                        <span
                                            className="codicon codicon-circle-slash"
                                            style={{ marginRight: 4 }}
                                        />
                                        {t('ui.disable') || 'Disable'}
                                    </>
                                ) : (
                                    <>
                                        <span
                                            className="codicon codicon-check"
                                            style={{ marginRight: 4 }}
                                        />
                                        {t('ui.enable') || 'Enable'}
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() =>
                                    onDeleteProxy(proxies.findIndex(p => p.id === activeProxy.id))
                                }
                                style={{ padding: '2px 8px', fontSize: 11 }}
                            >
                                <span
                                    className="codicon codicon-trash"
                                    style={{ marginRight: 4 }}
                                />
                                {t('ui.delete') || 'Delete'}
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                        {(() => {
                            const mocks = (activeProxy.mockApis || []) as MockApiConfig[];
                            const total = mocks.length;
                            const enabledCount = mocks.filter(m => m.enabled).length;
                            const filteredCount = filteredMocks.length;
                            return (
                                <div style={{ fontWeight: 600 }}>
                                    {`${t('ui.mockApis') || 'Mock APIs'} (${enabledCount}/${total})`}
                                    {searchText.trim() && filteredCount !== total && (
                                        <span
                                            style={{ marginLeft: 8, fontWeight: 400, fontSize: 11 }}
                                        >
                                            {t('ui.filtered') || 'filtered'}: {filteredCount}
                                        </span>
                                    )}
                                </div>
                            );
                        })()}
                        <div style={{ flex: 1 }} />
                        {groupedMocks.size > 1 && (
                            <button
                                onClick={toggleExpandAll}
                                style={{ fontSize: 11, padding: '2px 8px', marginRight: '8px' }}
                            >
                                {allExpanded
                                    ? t('ui.collapseAll') || 'Collapse All'
                                    : t('ui.expandAll') || 'Expand All'}
                            </button>
                        )}
                        <button onClick={onAddMock}>
                            <span className="codicon codicon-add" style={{ marginRight: 4 }} />
                            {t('ui.addMockApi') || 'Add Mock'}
                        </button>
                    </div>

                    <div style={{ marginBottom: 8 }}>
                        <input
                            type="text"
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                            placeholder={t('ui.searchUrl') || 'Search URL...'}
                            style={{
                                width: '100%',
                                padding: '4px 8px',
                                boxSizing: 'border-box',
                                fontSize: 12,
                                background: 'var(--vscode-input-background)',
                                color: 'var(--vscode-input-foreground)',
                                border: '1px solid var(--vscode-input-border)',
                                borderRadius: 2,
                            }}
                        />
                    </div>

                    <div>
                        {((activeProxy.mockApis || []) as MockApiConfig[]).length === 0 && (
                            <div
                                style={{
                                    color: 'var(--vscode-descriptionForeground)',
                                    fontStyle: 'italic',
                                    padding: '8px 0',
                                }}
                            >
                                {t('ui.noMockApis') || 'No mock APIs configured.'}
                            </div>
                        )}
                        {Array.from(groupedMocks.entries()).map(([pathKey, items]) => {
                            const isExpanded = expandedGroups.has(pathKey);
                            const hasMultiple = items.length > 1;

                            if (!hasMultiple) {
                                const m = items[0];
                                return (
                                    <div
                                        key={pathKey}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            padding: '8px 10px',
                                            marginBottom: 8,
                                            background: 'var(--vscode-editor-background)',
                                            borderRadius: 3,
                                            borderLeft: `3px solid ${m.enabled ? '#4caf50' : '#9e9e9e'}`,
                                            flexWrap: 'nowrap',
                                        }}
                                    >
                                        <div
                                            style={{
                                                minWidth: 42,
                                                textAlign: 'center',
                                                color: '#fff',
                                                background: methodColor(m.method),
                                                padding: '2px 6px',
                                                borderRadius: 2,
                                                fontSize: 10,
                                                fontWeight: 700,
                                            }}
                                        >
                                            {(m.method || '').toUpperCase()}
                                        </div>
                                        <div
                                            style={{
                                                flex: '1 1 auto',
                                                minWidth: 0,
                                                color: m.enabled
                                                    ? 'var(--vscode-editor-foreground)'
                                                    : 'var(--vscode-descriptionForeground)',
                                                overflowWrap: 'anywhere',
                                                wordBreak: 'break-word',
                                            }}
                                        >
                                            {m.path}
                                        </div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                gap: 6,
                                                flexShrink: 0,
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            <button onClick={() => onToggleMock(m.originalIndex)}>
                                                {m.enabled ? (
                                                    <>
                                                        <span
                                                            className="codicon codicon-circle-slash"
                                                            style={{ marginRight: 4 }}
                                                        />
                                                        {t('ui.disable') || 'Disable'}
                                                    </>
                                                ) : (
                                                    <>
                                                        <span
                                                            className="codicon codicon-check"
                                                            style={{ marginRight: 4 }}
                                                        />
                                                        {t('ui.enable') || 'Enable'}
                                                    </>
                                                )}
                                            </button>
                                            <button onClick={() => onEditMock(m.originalIndex)}>
                                                <span
                                                    className="codicon codicon-edit"
                                                    style={{ marginRight: 4 }}
                                                />
                                                {t('ui.edit') || 'Edit'}
                                            </button>
                                            <button onClick={() => onDeleteMock(m.originalIndex)}>
                                                <span
                                                    className="codicon codicon-trash"
                                                    style={{ marginRight: 4 }}
                                                />
                                                {t('ui.delete') || 'Delete'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={pathKey}
                                    style={{
                                        marginBottom: 8,
                                        background: 'var(--vscode-editor-background)',
                                        borderRadius: 3,
                                        overflow: 'hidden',
                                    }}
                                >
                                    <div
                                        onClick={() => toggleGroup(pathKey)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            padding: '8px 10px',
                                            cursor: 'pointer',
                                            background:
                                                'var(--vscode-list-hoverBackground, rgba(0,0,0,0.04))',
                                            borderLeft: `3px solid ${items.some(m => m.enabled) ? '#4caf50' : '#9e9e9e'}`,
                                        }}
                                    >
                                        <span
                                            style={{
                                                color: 'var(--vscode-descriptionForeground)',
                                                fontSize: 10,
                                            }}
                                        >
                                            {isExpanded ? '▼' : '▶'}
                                        </span>
                                        <span
                                            style={{
                                                color: 'var(--vscode-descriptionForeground)',
                                                fontSize: 11,
                                            }}
                                        >
                                            [{items.length}]
                                        </span>
                                        <span style={{ fontWeight: 500, flex: 1 }}>{pathKey}</span>
                                        <span
                                            style={{
                                                color: 'var(--vscode-descriptionForeground)',
                                                fontSize: 11,
                                            }}
                                        >
                                            {t('ui.variants') || 'variants'}
                                        </span>
                                    </div>
                                    {isExpanded &&
                                        items.map(m => (
                                            <div
                                                key={m.originalIndex}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 10,
                                                    padding: '6px 10px 6px 30px',
                                                    borderTop:
                                                        '1px solid var(--vscode-editorWidget-border, #eee)',
                                                    borderLeft: `3px solid ${m.enabled ? '#4caf50' : '#9e9e9e'}`,
                                                    marginLeft: 0,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        minWidth: 42,
                                                        textAlign: 'center',
                                                        color: '#fff',
                                                        background: methodColor(m.method),
                                                        padding: '2px 6px',
                                                        borderRadius: 2,
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    {(m.method || '').toUpperCase()}
                                                </div>
                                                <div
                                                    style={{
                                                        flex: '1 1 auto',
                                                        minWidth: 0,
                                                        color: m.enabled
                                                            ? 'var(--vscode-editor-foreground)'
                                                            : 'var(--vscode-descriptionForeground)',
                                                        overflowWrap: 'anywhere',
                                                        wordBreak: 'break-word',
                                                        fontSize: 12,
                                                    }}
                                                >
                                                    {m.path.includes('?') ? (
                                                        <>
                                                            <span
                                                                style={{
                                                                    color: 'var(--vscode-textLink-foreground, #007acc)',
                                                                }}
                                                            >
                                                                {m.path.substring(
                                                                    0,
                                                                    pathKey.length
                                                                )}
                                                            </span>
                                                            <span
                                                                style={{
                                                                    color: 'var(--vscode-descriptionForeground)',
                                                                }}
                                                            >
                                                                ?
                                                                {m.path.substring(
                                                                    pathKey.length + 1
                                                                )}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        m.path
                                                    )}
                                                </div>
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        gap: 6,
                                                        flexShrink: 0,
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    <button
                                                        onClick={() =>
                                                            onToggleMock(m.originalIndex)
                                                        }
                                                    >
                                                        {m.enabled ? (
                                                            <>
                                                                <span
                                                                    className="codicon codicon-circle-slash"
                                                                    style={{ marginRight: 4 }}
                                                                />
                                                                {t('ui.disable') || 'Disable'}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span
                                                                    className="codicon codicon-check"
                                                                    style={{ marginRight: 4 }}
                                                                />
                                                                {t('ui.enable') || 'Enable'}
                                                            </>
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => onEditMock(m.originalIndex)}
                                                    >
                                                        <span
                                                            className="codicon codicon-edit"
                                                            style={{ marginRight: 4 }}
                                                        />
                                                        {t('ui.edit') || 'Edit'}
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            onDeleteMock(m.originalIndex)
                                                        }
                                                    >
                                                        <span
                                                            className="codicon codicon-trash"
                                                            style={{ marginRight: 4 }}
                                                        />
                                                        {t('ui.delete') || 'Delete'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            );
                        })}
                    </div>
                </>
            ) : (
                <div
                    style={{
                        color: 'var(--vscode-descriptionForeground)',
                        fontStyle: 'italic',
                        padding: 20,
                        textAlign: 'center',
                    }}
                >
                    {t('ui.noProxies') ||
                        'No proxies configured. Click "Manage Proxies" to add one.'}
                </div>
            )}
        </>
    );
}
