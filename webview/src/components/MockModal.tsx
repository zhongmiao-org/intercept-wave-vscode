import React from 'react';
import type { MockModalProps } from '../interfaces/ui.components';

export function MockModal({ open, draft, onChange, onSave, onFormat, onCancel, labels, isEdit }: MockModalProps) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)' }} onClick={onCancel}>
      <div style={{ width: 800, margin: '6vh auto', background: 'var(--vscode-editor-background)', padding: 16, borderRadius: 6 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{isEdit ? labels.titleEdit : labels.titleAdd}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 160px 1fr', gap: 8 }}>
          <label>{labels.enabled}</label>
          <input type="checkbox" checked={draft.enabled} onChange={e => onChange({ ...draft, enabled: e.target.checked })} />
          <label>{labels.method}</label>
          <select value={draft.method} onChange={e => onChange({ ...draft, method: e.target.value })}>
            {['GET','POST','PUT','DELETE','PATCH','HEAD','OPTIONS'].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <label>{labels.path}</label>
          <input value={draft.path} onChange={e => onChange({ ...draft, path: e.target.value })} />
          <label>{labels.statusCode}</label>
          <input type="number" value={draft.statusCode} onChange={e => onChange({ ...draft, statusCode: Number(e.target.value) })} />
          <label>{labels.delay}</label>
          <input type="number" value={draft.delay ?? 0} onChange={e => onChange({ ...draft, delay: Number(e.target.value) })} />
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>{labels.responseBody}</label>
          <textarea style={{ width: '100%', height: 220, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} value={draft.mockData} onChange={e => onChange({ ...draft, mockData: e.target.value })} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={onFormat}>{labels.format}</button>
            <button onClick={onSave}>{labels.save}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
