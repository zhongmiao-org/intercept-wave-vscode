import React from 'react';
import type { ProxyGroup, WsRule } from '../interfaces/business';
import { WsPushPanel, WsManualTarget } from './WsPushPanel';

export interface WsSectionProps {
    group: ProxyGroup;
    onAddRule: () => void;
    onEditRule: (index: number) => void;
    onDeleteRule: (index: number) => void;
    onToggleRule: (index: number) => void;
    sendWsByRule: (ruleIdx: number, target: WsManualTarget) => void;
    sendWsCustom: (msg: string, target: WsManualTarget) => void;
    t: (key: string) => string;
}

export function WsSection({
    group,
    onAddRule,
    onEditRule,
    onDeleteRule,
    onToggleRule,
    sendWsByRule,
    sendWsCustom,
    t,
}: WsSectionProps) {
    const rules = (group.wsPushRules || []) as WsRule[];
    const enabledCount = rules.filter(r => r.enabled).length;

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 600 }}>
                    {t('ui.wsPanel.rules') || 'Rules'} ({enabledCount}/{rules.length})
                </div>
                <div style={{ flex: 1 }} />
                <button onClick={onAddRule}>
                    <span className="codicon codicon-add" style={{ marginRight: 4 }} />
                    {t('ui.addWsRule') || 'Add WS Rule'}
                </button>
            </div>

            <div style={{ marginBottom: 12 }}>
                {rules.length === 0 && (
                    <div
                        style={{
                            color: 'var(--vscode-descriptionForeground, #888)',
                            fontStyle: 'italic',
                        }}
                    >
                        {t('ui.wsPanel.noRules') || 'No WS rules configured.'}
                    </div>
                )}
                {rules.length > 0 && (
                    <div
                        style={{
                            borderRadius: 3,
                            border: '1px solid var(--vscode-panel-border)',
                            overflow: 'hidden',
                        }}
                    >
                        {rules.map((r, idx) => (
                            <div
                                key={idx}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '32px 120px 80px 1fr auto',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '6px 8px',
                                    borderBottom:
                                        idx < rules.length - 1
                                            ? '1px solid var(--vscode-panel-border)'
                                            : 'none',
                                    background: 'var(--vscode-editor-background)',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <input
                                        type="checkbox"
                                        checked={r.enabled}
                                        onChange={() => onToggleRule(idx)}
                                    />
                                </div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: 'var(--vscode-descriptionForeground)',
                                    }}
                                >
                                    {(r.mode || 'off').toUpperCase()}
                                </div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: 'var(--vscode-descriptionForeground)',
                                    }}
                                >
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
                                    {r.path ||
                                        (r.eventKey ? `${r.eventKey}=${r.eventValue ?? ''}` : '(*)')}
                                </div>
                                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                    <button onClick={() => onEditRule(idx)}>
                                        <span
                                            className="codicon codicon-edit"
                                            style={{ marginRight: 4 }}
                                        />
                                        {t('ui.edit') || 'Edit'}
                                    </button>
                                    <button onClick={() => onDeleteRule(idx)}>
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
                )}
            </div>

            <WsPushPanel
                rules={rules}
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
    );
}
