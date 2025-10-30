import React from 'react';
import type { MockListProps } from '../interfaces/ui.components';

export function MockList({ mocks, onToggle, onEdit, onDelete, onAdd, labels }: MockListProps) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontWeight: 600 }}>{labels.mockApis}</div>
        <div style={{ flex: 1 }} />
        <button onClick={onAdd}>{labels.addMock}</button>
      </div>
      <div>
        {mocks.map((m, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 60px 160px', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--vscode-editorWidget-border, #eee)' }}>
            <div style={{ color: m.enabled ? 'var(--vscode-editor-foreground)' : 'var(--vscode-descriptionForeground)' }}>{m.method}</div>
            <div style={{ color: m.enabled ? 'var(--vscode-editor-foreground)' : 'var(--vscode-descriptionForeground)' }}>{m.path}</div>
            <div style={{ color: 'var(--vscode-descriptionForeground)' }}>{m.statusCode}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => onToggle(idx)}>{m.enabled ? labels.disable : labels.enable}</button>
              <button onClick={() => onEdit(idx)}>{labels.edit}</button>
              <button onClick={() => onDelete(idx)}>{labels.delete}</button>
            </div>
          </div>
        ))}
        {mocks.length === 0 && (
          <div style={{ color: 'var(--vscode-descriptionForeground, #888)', fontStyle: 'italic' }}>{labels.emptyText}</div>
        )}
      </div>
    </>
  );
}
