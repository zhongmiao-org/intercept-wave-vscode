import React from 'react';
import type { HttpProxyDraft } from '../interfaces/business';

export interface HttpProxyModalProps {
  open: boolean;
  draft: HttpProxyDraft;
  onChange: (d: HttpProxyDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  isEdit: boolean;
  labels: {
    titleAdd: string;
    titleEdit: string;
    name: string;
    enabled: string;
    interceptPrefix: string;
    baseUrl: string;
    stripPrefix: string;
    globalCookie: string;
    save: string;
    cancel: string;
    yesLabel: string;
    noLabel: string;
  };
}

export function HttpProxyModal({ open, draft, onChange, onSave, onCancel, labels, isEdit }: HttpProxyModalProps) {
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

  const cols = '140px 1fr';
  const modalWidth = Math.max(360, Math.min(600, vw - 24));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', overflowY: 'auto' }} onClick={onCancel}>
      <div style={{ width: modalWidth, maxWidth: '90vw', margin: '6vh auto', background: 'var(--vscode-editor-background)', padding: 16, borderRadius: 6, position: 'relative' }} onClick={e => e.stopPropagation()}>
        <button aria-label="Close" title="Close" onClick={onCancel} style={{ position: 'absolute', top: 8, right: 8, background: 'transparent', color: 'var(--vscode-foreground)', border: 'none', fontSize: 18, lineHeight: 1, cursor: 'pointer', minWidth: 0, padding: 0, width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>×</button>
        <h3 style={{ marginTop: 0, paddingRight: 24 }}>{isEdit ? labels.titleEdit : labels.titleAdd}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: cols as any, gap: 8, alignItems: 'center' }}>
          <label>{labels.name}</label>
          <input value={draft.name} onChange={e => onChange({ ...draft, name: e.target.value })} placeholder="e.g. User API" />

          <label>{labels.enabled}</label>
          <input type="checkbox" checked={draft.enabled} onChange={e => onChange({ ...draft, enabled: e.target.checked })} style={{ justifySelf: 'start' }} />

          <label>{labels.interceptPrefix}</label>
          <input value={draft.interceptPrefix} onChange={e => onChange({ ...draft, interceptPrefix: e.target.value })} placeholder="e.g. /api/user" />

          <label>{labels.baseUrl}</label>
          <input value={draft.baseUrl} onChange={e => onChange({ ...draft, baseUrl: e.target.value })} placeholder="e.g. http://localhost:8080" />

          <label>{labels.stripPrefix}</label>
          <select value={draft.stripPrefix ? 'yes' : 'no'} onChange={e => onChange({ ...draft, stripPrefix: e.target.value === 'yes' })}>
            <option value="yes">{labels.yesLabel}</option>
            <option value="no">{labels.noLabel}</option>
          </select>

          <label>{labels.globalCookie}</label>
          <input value={draft.globalCookie} onChange={e => onChange({ ...draft, globalCookie: e.target.value })} placeholder="e.g. sessionId=abc123" />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onCancel}><span className="codicon codicon-close" style={{ marginRight: 6 }} />{labels.cancel}</button>
          <button onClick={onSave}><span className="codicon codicon-check" style={{ marginRight: 6 }} />{labels.save}</button>
        </div>
      </div>
    </div>
  );
}
