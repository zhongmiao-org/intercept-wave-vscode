import React from 'react';
import type { MockModalProps } from '../interfaces/ui.components';

export function MockModal({ open, draft, onChange, onSave, onFormat, onCancel, labels, isEdit }: MockModalProps) {
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
  const [vw, setVw] = React.useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1200);
  React.useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const cols = '140px 1fr';
  const modalWidth = Math.max(360, Math.min(720, vw - 24));
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.24)', overflowY: 'auto' }} onClick={onCancel}>
      <div style={{ width: modalWidth, maxWidth: '90vw', margin: '6vh auto', background: 'var(--vscode-editor-background)', padding: 18, borderRadius: 10, border: '1px solid var(--vscode-panel-border)', boxShadow: '0 18px 40px rgba(0,0,0,0.35)', position: 'relative' }} onClick={e => e.stopPropagation()}>
        <button aria-label={labels.close || labels.cancel || 'Close'} title={labels.close || labels.cancel || 'Close'} onClick={onCancel} style={{ position: 'absolute', top: 8, right: 8, background: 'transparent', color: 'var(--vscode-foreground)', border: 'none', fontSize: 18, lineHeight: 1, cursor: 'pointer', minWidth: 0, padding: 0, width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>×</button>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--vscode-descriptionForeground)', marginBottom: 6 }}>{labels.chromeTitle || 'Mock'}</div>
        <h3 style={{ marginTop: 0, marginBottom: 6, paddingRight: 24 }}>{isEdit ? labels.titleEdit : labels.titleAdd}</h3>
        <div style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)', marginBottom: 14 }}>
          {labels.hint}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: cols as any, gap: 8, alignItems: 'center' }}>
          <label>{labels.enabled}</label>
          <input type="checkbox" checked={draft.enabled} onChange={e => onChange({ ...draft, enabled: e.target.checked })} style={{ justifySelf: 'start' }} />

          <label>{labels.method}</label>
          <select value={draft.method} onChange={e => onChange({ ...draft, method: e.target.value })}>
            {['GET','POST','PUT','DELETE','PATCH','HEAD','OPTIONS'].map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <label>{labels.path}</label>
          <input autoFocus value={draft.path} onChange={e => onChange({ ...draft, path: e.target.value })} />

          <label>{labels.statusCode}</label>
          <input type="number" value={draft.statusCode} onChange={e => onChange({ ...draft, statusCode: Number(e.target.value) })} />

          <label>{labels.delay}</label>
          <input type="number" value={draft.delay ?? 0} onChange={e => onChange({ ...draft, delay: Number(e.target.value) })} />

          <label>{labels.responseBody}</label>
          <div>
            <button onClick={onFormat}><span className="codicon codicon-wand" style={{ marginRight: 6 }} />{labels.format}</button>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <textarea
            style={{
              width: '100%',
              minHeight: 260,
              resize: 'vertical',
              boxSizing: 'border-box',
              fontFamily: 'var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, monospace)',
              lineHeight: 1.45,
              padding: 10,
              borderRadius: 6,
              border: '1px solid var(--vscode-panel-border)',
              background: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
            }}
            value={draft.mockData}
            onChange={e => onChange({ ...draft, mockData: e.target.value })}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
            <button onClick={onCancel}><span className="codicon codicon-close" style={{ marginRight: 6 }} />{labels.cancel}</button>
            <button onClick={onSave} style={{ fontWeight: 600 }}><span className="codicon codicon-check" style={{ marginRight: 6 }} />{labels.save}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
