import React from 'react';
import type { GroupSummary } from '../interfaces/ui';

export interface GroupTabsProps {
    groups: GroupSummary[];
    activeGroupId: string | null;
    onSelect: (id: string) => void;
    onRemove: (id: string) => void;
    onAdd: () => void;
    t: (key: string) => string;
}

export function GroupTabs({
    groups,
    activeGroupId,
    onSelect,
    onRemove,
    onAdd,
    t,
}: GroupTabsProps) {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 12px 8px 12px',
                overflowX: 'auto',
            }}
        >
            {groups.map(g => (
                <div
                    key={g.id}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '0 8px',
                        height: 24,
                        fontSize: 12,
                        border: '1px solid var(--vscode-panel-border)',
                        borderRadius: 3,
                        cursor: 'pointer',
                        background:
                            activeGroupId === g.id
                                ? 'var(--vscode-tab-activeBackground)'
                                : 'var(--vscode-tab-inactiveBackground)',
                        color:
                            activeGroupId === g.id
                                ? 'var(--vscode-tab-activeForeground)'
                                : 'var(--vscode-tab-inactiveForeground)',
                    }}
                    onClick={() => onSelect(g.id)}
                >
                    <span style={{ lineHeight: 1 }}>
                        {g.name}(:{g.port})
                    </span>
                    <span
                        onClick={e => {
                            e.stopPropagation();
                            onRemove(g.id);
                        }}
                        style={{
                            opacity: 0.8,
                            fontSize: 12,
                            lineHeight: 1,
                            display: 'inline-block',
                        }}
                    >
                        ×
                    </span>
                </div>
            ))}
            <button
                onClick={onAdd}
                aria-label={t('ui.addProxyGroup') || 'Add Group'}
                title={t('ui.addProxyGroup') || 'Add Group'}
                style={{
                    marginLeft: 4,
                    minWidth: 0,
                    padding: 0,
                    width: 24,
                    height: 24,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <span className="codicon codicon-add" />
            </button>
        </div>
    );
}
