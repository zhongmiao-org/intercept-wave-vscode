import React from 'react';
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
                                Prefix:
                            </span>
                            <span style={{ wordBreak: 'break-all' }}>
                                {activeProxy.interceptPrefix}
                            </span>
                            <span style={{ color: 'var(--vscode-descriptionForeground)' }}>
                                Base:
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
                                <span className="codicon codicon-trash" style={{ marginRight: 4 }} />
                                {t('ui.delete') || 'Delete'}
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                        {(() => {
                            const mocks = (activeProxy.mockApis || []) as MockApiConfig[];
                            const total = mocks.length;
                            const enabledCount = mocks.filter(m => m.enabled).length;
                            return (
                                <div
                                    style={{ fontWeight: 600 }}
                                >{`${t('ui.mockApis') || 'Mock APIs'} (${enabledCount}/${total})`}</div>
                            );
                        })()}
                        <div style={{ flex: 1 }} />
                        <button onClick={onAddMock}>
                            <span className="codicon codicon-add" style={{ marginRight: 4 }} />
                            {t('ui.addMockApi') || 'Add Mock'}
                        </button>
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
                        {((activeProxy.mockApis || []) as MockApiConfig[]).map((m, idx) => (
                            <div
                                key={idx}
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
                                    <button onClick={() => onToggleMock(idx)}>
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
                                    <button onClick={() => onEditMock(idx)}>
                                        <span
                                            className="codicon codicon-edit"
                                            style={{ marginRight: 4 }}
                                        />
                                        {t('ui.edit') || 'Edit'}
                                    </button>
                                    <button onClick={() => onDeleteMock(idx)}>
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
                    {t('ui.noProxies') || 'No proxies configured. Click "Manage Proxies" to add one.'}
                </div>
            )}
        </>
    );
}
