import React from 'react';
import type { ProxyGroup } from '../interfaces/business';

export interface GroupSectionProps {
    group: ProxyGroup;
    isRunning: boolean;
    onStart: () => void;
    onStop: () => void;
    onEdit: () => void;
    onDelete: () => void;
    t: (key: string) => string;
}

export function GroupSection({
    group,
    isRunning,
    onStart,
    onStop,
    onEdit,
    onDelete,
    t,
}: GroupSectionProps) {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 12px',
                background: 'var(--vscode-editor-background)',
                border: '1px solid var(--vscode-panel-border)',
                borderRadius: 4,
                marginBottom: 8,
            }}
        >
            <span
                className="codicon codicon-circle-filled"
                style={{ color: isRunning ? '#2ecc71' : '#e74c3c', fontSize: 10 }}
                title={isRunning ? t('ui.running') || 'Running' : t('ui.stopped') || 'Stopped'}
            />
            <span style={{ fontWeight: 600, minWidth: 80 }}>{group.name}</span>
            <span
                style={{
                    color: 'var(--vscode-descriptionForeground)',
                    fontSize: 12,
                    minWidth: 60,
                }}
            >
                :{group.port}
            </span>
            <div style={{ flex: 1 }} />
            <button
                onClick={onStart}
                disabled={isRunning}
                style={{ minWidth: 0, padding: '2px 8px', fontSize: 12 }}
                title={t('ui.startServer') || 'Start'}
            >
                <span className="codicon codicon-play" />
            </button>
            <button
                onClick={onStop}
                disabled={!isRunning}
                style={{ minWidth: 0, padding: '2px 8px', fontSize: 12 }}
                title={t('ui.stopServer') || 'Stop'}
            >
                <span className="codicon codicon-stop" />
            </button>
            <button
                onClick={onEdit}
                style={{ minWidth: 0, padding: '2px 8px', fontSize: 12 }}
                title={t('ui.settings') || 'Settings'}
            >
                <span className="codicon codicon-gear" />
            </button>
            <button
                onClick={onDelete}
                style={{ minWidth: 0, padding: '2px 8px', fontSize: 12 }}
                title={t('ui.delete') || 'Delete'}
            >
                <span className="codicon codicon-trash" />
            </button>
        </div>
    );
}
