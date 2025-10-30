import React from 'react';
import type { GroupModalProps } from '../interfaces/ui.components';

export function GroupModal({ open, draft, onChange, onSave, onCancel, labels, isEdit }: GroupModalProps) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)' }} onClick={onCancel}>
      <div style={{ width: 560, margin: '10vh auto', background: 'var(--vscode-editor-background)', padding: 16, borderRadius: 6 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{isEdit ? labels.titleEdit : labels.titleAdd}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8 }}>
          <label>{labels.name}</label>
          <input value={draft.name} onChange={e => onChange({ ...draft, name: e.target.value })} />
          <label>{labels.port}</label>
          <input type="number" value={draft.port} onChange={e => onChange({ ...draft, port: Number(e.target.value) })} />
          <label>{labels.interceptPrefix}</label>
          <input value={draft.interceptPrefix} onChange={e => onChange({ ...draft, interceptPrefix: e.target.value })} />
          <label>{labels.baseUrl}</label>
          <input value={draft.baseUrl} onChange={e => onChange({ ...draft, baseUrl: e.target.value })} />
          <label>{labels.stripPrefix}</label>
          <input type="checkbox" checked={draft.stripPrefix} onChange={e => onChange({ ...draft, stripPrefix: e.target.checked })} />
          <label>{labels.globalCookie}</label>
          <input value={draft.globalCookie} onChange={e => onChange({ ...draft, globalCookie: e.target.value })} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button onClick={onCancel}>{labels.cancel}</button>
          <button onClick={onSave}>{labels.save}</button>
        </div>
      </div>
    </div>
  );
}
