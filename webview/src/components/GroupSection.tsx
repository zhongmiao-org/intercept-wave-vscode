import React from 'react';
import type { ProxyGroup } from '../interfaces/business';

export interface GroupSectionProps {
    group: ProxyGroup;
    isRunning: boolean;
    isWsGroup: boolean;
    onStart: () => void;
    onStop: () => void;
    onEdit: () => void;
    onDelete: () => void;
    t: (key: string) => string;
}

export function GroupSection({
    group,
    isRunning,
    isWsGroup,
    onStart,
    onStop,
    onEdit,
    onDelete,
    t,
}: GroupSectionProps) {
    return (
        <>
            <div style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{group.name}</div>
                <div
                    style={{
                        color: 'var(--vscode-descriptionForeground)',
                        display: 'flex',
                        alignItems: 'center',
                    }}
                >
                    {isRunning ? (
                        <>
                            <span
                                className="codicon codicon-circle-filled"
                                style={{ color: '#2ecc71', marginRight: 4 }}
                            />
                            {t('ui.running') || 'Running'}
                        </>
                    ) : (
                        <>
                            <span
                                className="codicon codicon-circle-filled"
                                style={{ color: '#e74c3c', marginRight: 4 }}
                            />
                            {t('ui.stopped') || 'Stopped'}
                        </>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <button style={{ minWidth: 96 }} onClick={onStart} disabled={isRunning}>
                    <span className="codicon codicon-play" style={{ marginRight: 4 }} />
                    {t('ui.startServer') || 'Start'}
                </button>
                <button style={{ minWidth: 96 }} onClick={onStop} disabled={!isRunning}>
                    <span className="codicon codicon-stop" style={{ marginRight: 4 }} />
                    {t('ui.stopServer') || 'Stop'}
                </button>
            </div>

            <div
                style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                    marginBottom: 12,
                }}
            >
                <div
                    style={{
                        flex: 1,
                        background: 'var(--vscode-editor-background)',
                        border: '1px solid var(--vscode-panel-border)',
                        borderRadius: 4,
                        padding: 10,
                    }}
                >
                    <div style={{ marginBottom: 6, fontWeight: 600 }}>
                        {(t('ui.groupName') || 'Group Name') + ': '} {group.name} ({group.port})
                    </div>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '120px 1fr',
                            rowGap: 4,
                            columnGap: 8,
                        }}
                    >
                        <div>{t('ui.port') || 'Port'}:</div>
                        <div>{group.port}</div>
                        {isWsGroup && (
                            <>
                                <div>{t('ui.wsBaseUrl') || 'WebSocket Base URL'}:</div>
                                <div style={{ wordBreak: 'break-all' }}>
                                    {group.wsBaseUrl || t('ui.notSet') || '(Not set)'}
                                </div>
                                <div>{t('ui.wsInterceptPrefix') || 'WS Intercept Prefix'}:</div>
                                <div>{group.wsInterceptPrefix || t('ui.notSet') || '(Not set)'}</div>
                            </>
                        )}
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button onClick={onEdit}>
                        <span className="codicon codicon-gear" style={{ marginRight: 4 }} />
                        {t('ui.settings') || 'Settings'}
                    </button>
                    <button onClick={onDelete}>
                        <span className="codicon codicon-trash" style={{ marginRight: 4 }} />
                        {t('ui.delete') || 'Delete'}
                    </button>
                </div>
            </div>
        </>
    );
}
