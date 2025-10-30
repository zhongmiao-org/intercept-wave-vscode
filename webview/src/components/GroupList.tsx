import React from 'react';
import type { GroupListProps } from '../interfaces/ui.components';

export function GroupList({ groups, activeGroupId, onSelect, onAddGroup, noGroupsText }: GroupListProps) {
  return (
    <div style={{ borderRight: '1px solid var(--vscode-editorWidget-border, #ddd)' }}>
      <div style={{ padding: '0 12px 8px 12px' }}>
        <button onClick={onAddGroup}>＋</button>
      </div>
      <div>
        {groups.map(g => (
          <div key={g.id} onClick={() => onSelect(g.id)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer',
            background: activeGroupId === g.id ? 'var(--vscode-list-activeSelectionBackground, #e6f7ff)' : 'transparent'
          }}>
            <div style={{ fontWeight: 600, flex: 1 }}>{g.name}</div>
            <div style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground, #888)' }}>:{g.port}</div>
            <div style={{ fontSize: 12 }}>{g.running ? '●' : '○'}</div>
          </div>
        ))}
        {groups.length === 0 && (
          <div style={{ color: 'var(--vscode-descriptionForeground, #888)', fontStyle: 'italic', padding: 12 }}>
            {noGroupsText}
          </div>
        )}
      </div>
    </div>
  );
}
