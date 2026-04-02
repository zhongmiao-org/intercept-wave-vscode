import React from 'react';
import type { RouteModalProps } from '../interfaces/ui.components';

export function RouteModal({ open, draft, onChange, onSave, onCancel, labels, isEdit }: RouteModalProps) {
  if (!open) return null;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, onSave]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.24)', overflowY: 'auto', zIndex: 60 }} onClick={onCancel}>
      <div style={{ width: 640, maxWidth: '92vw', margin: '6vh auto', background: 'var(--vscode-editor-background)', padding: 20, borderRadius: 10, border: '1px solid var(--vscode-panel-border)', boxShadow: '0 18px 40px rgba(0,0,0,0.35)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--vscode-descriptionForeground)', marginBottom: 6 }}>{labels.chromeTitle || 'Route'}</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{isEdit ? labels.titleEdit : labels.titleAdd}</div>
        <div style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)', marginBottom: 14 }}>
          {labels.hint}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: 10, columnGap: 10, alignItems: 'center' }}>
          <label>{labels.name}</label>
          <input autoFocus value={draft.name} onChange={e => onChange({ ...draft, name: e.target.value })} />

          <label>{labels.pathPrefix}</label>
          <input value={draft.pathPrefix} onChange={e => onChange({ ...draft, pathPrefix: e.target.value })} />

          <label>{labels.targetBaseUrl}</label>
          <input value={draft.targetBaseUrl} onChange={e => onChange({ ...draft, targetBaseUrl: e.target.value })} />

          <label>{labels.stripPrefix}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={draft.stripPrefix} onChange={e => onChange({ ...draft, stripPrefix: e.target.checked })} />
            <span>{draft.stripPrefix ? labels.yesLabel : labels.noLabel}</span>
          </div>

          <label>{labels.enableMock}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={draft.enableMock} onChange={e => onChange({ ...draft, enableMock: e.target.checked })} />
            <span>{draft.enableMock ? labels.yesLabel : labels.noLabel}</span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={onCancel}>{labels.cancel}</button>
          <button onClick={onSave} style={{ fontWeight: 600 }}>{labels.save}</button>
        </div>
      </div>
    </div>
  );
}
