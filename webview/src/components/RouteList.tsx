import React from 'react';
import type { RouteListProps } from '../interfaces/ui.components';

export function RouteList({ routes, activeRouteId, onSelect, onAdd, onEdit, onDelete, labels }: RouteListProps) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--vscode-descriptionForeground)' }}>{labels.title}</div>
        <div style={{ flex: 1 }} />
        <button onClick={onAdd} style={{ height: 28, padding: '0 10px' }}>{labels.addRoute}</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {routes.map(route => (
          <div
            key={route.id}
            onClick={() => onSelect(route.id)}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 10,
              alignItems: 'start',
              padding: '10px 12px',
              border: activeRouteId === route.id
                ? '1px solid var(--vscode-focusBorder)'
                : '1px solid var(--vscode-panel-border)',
              borderRadius: 8,
              cursor: 'pointer',
              background: activeRouteId === route.id
                ? 'color-mix(in srgb, var(--vscode-list-activeSelectionBackground) 65%, transparent)'
                : 'var(--vscode-editor-background)',
              boxShadow: activeRouteId === route.id ? '0 0 0 1px color-mix(in srgb, var(--vscode-focusBorder) 35%, transparent) inset' : 'none',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 600 }}>{route.name}</div>
                <span style={{
                  fontSize: 11,
                  padding: '2px 6px',
                  borderRadius: 999,
                  background: route.enableMock
                    ? 'color-mix(in srgb, var(--vscode-testing-iconPassed) 18%, transparent)'
                    : 'color-mix(in srgb, var(--vscode-descriptionForeground) 18%, transparent)',
                  color: route.enableMock ? 'var(--vscode-testing-iconPassed)' : 'var(--vscode-descriptionForeground)',
                }}>
                  {route.enableMock ? labels.enableMock : labels.disableMock}
                </span>
                <span style={{
                  fontSize: 11,
                  padding: '2px 6px',
                  borderRadius: 999,
                  background: 'color-mix(in srgb, var(--vscode-badge-background) 55%, transparent)',
                  color: 'var(--vscode-badge-foreground)',
                }}>
                  {route.mockApis.filter(api => api.enabled).length}/{route.mockApis.length} {labels.mocksLabel || 'mock'}
                </span>
              </div>
              <div style={{
                fontSize: 12,
                fontFamily: 'var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, monospace)',
                color: 'var(--vscode-foreground)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginBottom: 4,
              }}>
                {route.pathPrefix}
              </div>
              <div style={{
                fontSize: 12,
                color: 'var(--vscode-descriptionForeground)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {route.targetBaseUrl}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(route.id); }}
                style={{ minWidth: 0, width: 30, height: 30, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                title={labels.edit}
              >
                <span className="codicon codicon-edit" style={{ lineHeight: 1, fontSize: 16 }} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(route.id); }}
                style={{ minWidth: 0, width: 30, height: 30, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                title={labels.delete}
              >
                <span className="codicon codicon-trash" style={{ lineHeight: 1, fontSize: 16 }} />
              </button>
            </div>
          </div>
        ))}
        {routes.length === 0 && (
          <div style={{
            color: 'var(--vscode-descriptionForeground, #888)',
            fontStyle: 'italic',
            border: '1px dashed var(--vscode-panel-border)',
            borderRadius: 8,
            padding: 14,
            textAlign: 'center',
          }}>{labels.emptyText}</div>
        )}
      </div>
    </div>
  );
}
