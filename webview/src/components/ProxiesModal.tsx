import React from 'react';
import type { HttpProxy } from '../interfaces/business';

export interface ProxiesModalProps {
    open: boolean;
    proxies: HttpProxy[];
    onChange: (proxies: HttpProxy[]) => void;
    onAdd: () => void;
    onEdit: (index: number) => void;
    onCancel: () => void;
    labels: {
        title: string;
        name: string;
        interceptPrefix: string;
        baseUrl: string;
        priority: string;
        enabled: string;
        actions: string;
        moveUp: string;
        moveDown: string;
        edit: string;
        delete: string;
        add: string;
        close: string;
        noProxies: string;
    };
}

export function ProxiesModal({ open, proxies, onChange, onAdd, onEdit, onCancel, labels }: ProxiesModalProps) {
    if (!open) return null;

    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onCancel]);

    const [vw, setVw] = React.useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1200);
    React.useEffect(() => {
        const onResize = () => setVw(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const modalWidth = Math.max(500, Math.min(700, vw - 48));

    const moveUp = (index: number) => {
        if (index <= 0) return;
        const newProxies = [...proxies];
        [newProxies[index - 1], newProxies[index]] = [newProxies[index], newProxies[index - 1]];
        newProxies.forEach((p, i) => p.priority = i);
        onChange(newProxies);
    };

    const moveDown = (index: number) => {
        if (index >= proxies.length - 1) return;
        const newProxies = [...proxies];
        [newProxies[index], newProxies[index + 1]] = [newProxies[index + 1], newProxies[index]];
        newProxies.forEach((p, i) => p.priority = i);
        onChange(newProxies);
    };

    const toggleEnabled = (index: number) => {
        const newProxies = [...proxies];
        newProxies[index] = { ...newProxies[index], enabled: !newProxies[index].enabled };
        onChange(newProxies);
    };

    const deleteProxy = (index: number) => {
        const newProxies = proxies.filter((_, i) => i !== index);
        newProxies.forEach((p, i) => p.priority = i);
        onChange(newProxies);
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', overflowY: 'auto', zIndex: 50 }} onClick={onCancel}>
            <div
                style={{
                    width: modalWidth,
                    maxWidth: '96vw',
                    margin: '6vh auto',
                    background: 'var(--vscode-editor-background)',
                    padding: 20,
                    borderRadius: 6,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    position: 'relative',
                }}
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onCancel}
                    style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        background: 'transparent',
                        color: 'var(--vscode-foreground)',
                        border: 'none',
                        fontSize: 18,
                        cursor: 'pointer',
                        width: 24,
                        height: 24,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    ×
                </button>

                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, paddingRight: 24 }}>
                    {labels.title}
                </div>

                <div style={{ marginBottom: 12, color: 'var(--vscode-descriptionForeground)', fontSize: 12 }}>
                    优先级从高到低：列表顶部的代理优先匹配请求
                </div>

                {proxies.length === 0 ? (
                    <div style={{ color: 'var(--vscode-descriptionForeground)', fontStyle: 'italic', padding: 20, textAlign: 'center' }}>
                        {labels.noProxies}
                    </div>
                ) : (
                    <div style={{ border: '1px solid var(--vscode-panel-border)', borderRadius: 4, overflow: 'hidden' }}>
                        {proxies.map((proxy, index) => (
                            <div
                                key={proxy.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '8px 12px',
                                    borderBottom: index < proxies.length - 1 ? '1px solid var(--vscode-panel-border)' : 'none',
                                    background: proxy.enabled ? 'var(--vscode-editor-background)' : 'var(--vscode-editor-inactiveSelectionBackground)',
                                    opacity: proxy.enabled ? 1 : 0.7,
                                }}
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <button
                                        onClick={() => moveUp(index)}
                                        disabled={index === 0}
                                        style={{ padding: '2px 4px', fontSize: 10, opacity: index === 0 ? 0.3 : 1 }}
                                        title={labels.moveUp}
                                    >
                                        ▲
                                    </button>
                                    <button
                                        onClick={() => moveDown(index)}
                                        disabled={index === proxies.length - 1}
                                        style={{ padding: '2px 4px', fontSize: 10, opacity: index === proxies.length - 1 ? 0.3 : 1 }}
                                        title={labels.moveDown}
                                    >
                                        ▼
                                    </button>
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span>{proxy.name || '(unnamed)'}</span>
                                        <span style={{ fontSize: 10, padding: '1px 4px', background: 'var(--vscode-badge-background)', color: 'var(--vscode-badge-foreground)', borderRadius: 2 }}>
                                            #{index + 1}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 8px' }}>
                                        <span>Prefix:</span>
                                        <span style={{ wordBreak: 'break-all' }}>{proxy.interceptPrefix}</span>
                                        <span>Base:</span>
                                        <span style={{ wordBreak: 'break-all' }}>{proxy.baseUrl}</span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                    <button onClick={() => toggleEnabled(index)} style={{ padding: '4px 8px', fontSize: 11 }}>
                                        {proxy.enabled ? 'Disable' : 'Enable'}
                                    </button>
                                    <button onClick={() => onEdit(index)} style={{ padding: '4px 8px', fontSize: 11 }}>
                                        Edit
                                    </button>
                                    <button onClick={() => deleteProxy(index)} style={{ padding: '4px 8px', fontSize: 11 }}>
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
                    <button onClick={onAdd}>
                        <span className="codicon codicon-add" style={{ marginRight: 6 }} />
                        {labels.add}
                    </button>
                    <button onClick={onCancel}>
                        <span className="codicon codicon-check" style={{ marginRight: 6 }} />
                        {labels.close}
                    </button>
                </div>
            </div>
        </div>
    );
}
