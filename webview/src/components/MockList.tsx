import React, { useState, useMemo } from 'react';
import type { MockListProps, MockApiConfig } from '../interfaces/ui.components';

function getPathWithoutQuery(path: string): string {
    return path.split('?')[0];
}

export function MockList({ mocks, onToggle, onEdit, onDelete, onAdd, labels }: MockListProps) {
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const groupedMocks = useMemo(() => {
        const groups = new Map<string, (MockApiConfig & { originalIndex: number })[]>();
        mocks.forEach((m, idx) => {
            const pathKey = getPathWithoutQuery(m.path);
            if (!groups.has(pathKey)) {
                groups.set(pathKey, []);
            }
            groups.get(pathKey)!.push({ ...m, originalIndex: idx });
        });
        return groups;
    }, [mocks]);

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

    const expandAll = () => {
        setExpandedGroups(new Set(groupedMocks.keys()));
    };

    const collapseAll = () => {
        setExpandedGroups(new Set());
    };

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 600 }}>{labels.mockApis}</div>
                <div style={{ flex: 1 }} />
                {groupedMocks.size > 1 && (
                    <>
                        <button onClick={expandAll} style={{ marginRight: 4, fontSize: 12 }}>{labels.expandAll || 'Expand All'}</button>
                        <button onClick={collapseAll} style={{ marginRight: 8, fontSize: 12 }}>{labels.collapseAll || 'Collapse All'}</button>
                    </>
                )}
                <button onClick={onAdd}>{labels.addMock}</button>
            </div>
            <div>
                {Array.from(groupedMocks.entries()).map(([pathKey, items]) => {
                    const isExpanded = expandedGroups.has(pathKey);
                    const hasMultiple = items.length > 1;

                    if (!hasMultiple) {
                        const item = items[0];
                        return (
                            <div key={pathKey} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 60px 160px', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--vscode-editorWidget-border, #eee)' }}>
                                <div style={{ color: item.enabled ? 'var(--vscode-editor-foreground)' : 'var(--vscode-descriptionForeground)' }}>{item.method}</div>
                                <div style={{ color: item.enabled ? 'var(--vscode-editor-foreground)' : 'var(--vscode-descriptionForeground)' }}>{item.path}</div>
                                <div style={{ color: 'var(--vscode-descriptionForeground)' }}>{item.statusCode}</div>
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                    <button onClick={() => onToggle(item.originalIndex)}>{item.enabled ? labels.disable : labels.enable}</button>
                                    <button onClick={() => onEdit(item.originalIndex)}>{labels.edit}</button>
                                    <button onClick={() => onDelete(item.originalIndex)}>{labels.delete}</button>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={pathKey} style={{ borderBottom: '1px solid var(--vscode-editorWidget-border, #eee)' }}>
                            <div
                                onClick={() => toggleGroup(pathKey)}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '20px 70px 1fr 60px',
                                    gap: 8,
                                    alignItems: 'center',
                                    padding: '8px 0',
                                    cursor: 'pointer',
                                    backgroundColor: 'var(--vscode-list-hoverBackground, rgba(0,0,0,0.04))',
                                }}
                            >
                                <div style={{ textAlign: 'center', color: 'var(--vscode-descriptionForeground)' }}>
                                    {isExpanded ? '▼' : '▶'}
                                </div>
                                <div style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 12 }}>[{items.length}]</div>
                                <div style={{ fontWeight: 500 }}>{pathKey}</div>
                                <div style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 12 }}>{labels.variants || 'variants'}</div>
                            </div>
                            {isExpanded && items.map((item) => (
                                <div
                                    key={item.originalIndex}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '70px 1fr 60px 160px',
                                        gap: 8,
                                        alignItems: 'center',
                                        padding: '6px 0 6px 20px',
                                        backgroundColor: 'var(--vscode-editor-background)',
                                    }}
                                >
                                    <div style={{ color: item.enabled ? 'var(--vscode-editor-foreground)' : 'var(--vscode-descriptionForeground)' }}>{item.method}</div>
                                    <div style={{ color: item.enabled ? 'var(--vscode-editor-foreground)' : 'var(--vscode-descriptionForeground)', fontSize: 12 }}>
                                        {item.path.includes('?') ? (
                                            <>
                                                <span style={{ color: 'var(--vscode-textLink-foreground, #007acc)' }}>{item.path.substring(0, pathKey.length)}</span>
                                                <span style={{ color: 'var(--vscode-descriptionForeground)' }}>?{item.path.substring(pathKey.length + 1)}</span>
                                            </>
                                        ) : item.path}
                                    </div>
                                    <div style={{ color: 'var(--vscode-descriptionForeground)' }}>{item.statusCode}</div>
                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                        <button onClick={() => onToggle(item.originalIndex)}>{item.enabled ? labels.disable : labels.enable}</button>
                                        <button onClick={() => onEdit(item.originalIndex)}>{labels.edit}</button>
                                        <button onClick={() => onDelete(item.originalIndex)}>{labels.delete}</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    );
                })}
                {mocks.length === 0 && (
                    <div style={{ color: 'var(--vscode-descriptionForeground, #888)', fontStyle: 'italic' }}>{labels.emptyText}</div>
                )}
            </div>
        </>
    );
}
