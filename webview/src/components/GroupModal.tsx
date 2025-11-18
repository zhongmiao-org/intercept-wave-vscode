import React from 'react';
import type { GroupModalProps } from '../interfaces/ui.components';

export function GroupModal({ open, draft, onChange, onSave, onCancel, labels, isEdit }: GroupModalProps) {
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
  const modalWidth = Math.max(360, Math.min(560, vw - 24));

  const protocol = draft.protocol || 'HTTP';
  const wsEnabled = protocol === 'WS';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', overflowY: 'auto' }} onClick={onCancel}>
      <div style={{ width: modalWidth, maxWidth: '90vw', margin: '10vh auto', background: 'var(--vscode-editor-background)', padding: 16, borderRadius: 6, position: 'relative' }} onClick={e => e.stopPropagation()}>
        <button aria-label="Close" title="Close" onClick={onCancel} style={{ position: 'absolute', top: 8, right: 8, background: 'transparent', color: 'var(--vscode-foreground)', border: 'none', fontSize: 18, lineHeight: 1, cursor: 'pointer', minWidth: 0, padding: 0, width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>×</button>
        <h3 style={{ marginTop: 0 }}>{isEdit ? labels.titleEdit : labels.titleAdd}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: cols as any, gap: 8, alignItems: 'center' }}>
          <label>{labels.name}</label>
          <input value={draft.name} onChange={e => onChange({ ...draft, name: e.target.value })} />
          <label>{labels.protocol}</label>
          <select
            value={protocol}
            onChange={e => {
              const nextProtocol = e.target.value as 'HTTP' | 'WS';
              onChange({
                ...draft,
                protocol: nextProtocol,
              });
            }}
          >
            <option value="HTTP">{labels.protocolHttp}</option>
            <option value="WS">{labels.protocolWs}</option>
          </select>
          <label>{labels.port}</label>
          <input type="number" value={draft.port} onChange={e => onChange({ ...draft, port: Number(e.target.value) })} />
          <label>{labels.interceptPrefix}</label>
          <input value={draft.interceptPrefix} onChange={e => onChange({ ...draft, interceptPrefix: e.target.value })} />
          <label>{labels.baseUrl}</label>
          <input value={draft.baseUrl} onChange={e => onChange({ ...draft, baseUrl: e.target.value })} />
          <label>{labels.stripPrefix}</label>
          <input type="checkbox" checked={draft.stripPrefix} onChange={e => onChange({ ...draft, stripPrefix: e.target.checked })} style={{ justifySelf: 'start' }} />
          <label>{labels.globalCookie}</label>
          <input value={draft.globalCookie} onChange={e => onChange({ ...draft, globalCookie: e.target.value })} />

          {wsEnabled && (
            <>
              <label>{labels.wsBaseUrl}</label>
              <input
                value={draft.wsBaseUrl ?? ''}
                onChange={e =>
                  onChange({
                    ...draft,
                    wsBaseUrl: e.target.value || null,
                  })
                }
              />
              <label>{labels.wsInterceptPrefix}</label>
              <input
                value={draft.wsInterceptPrefix ?? ''}
                onChange={e =>
                  onChange({
                    ...draft,
                    wsInterceptPrefix: e.target.value || null,
                  })
                }
              />
              <label>{labels.wsManualPush}</label>
              <input
                type="checkbox"
                checked={draft.wsManualPush ?? true}
                onChange={e =>
                  onChange({
                    ...draft,
                    wsManualPush: e.target.checked,
                  })
                }
                style={{ justifySelf: 'start' }}
              />
              <label>{labels.wssEnabled}</label>
              <input
                type="checkbox"
                checked={draft.wssEnabled ?? false}
                onChange={e =>
                  onChange({
                    ...draft,
                    wssEnabled: e.target.checked,
                  })
                }
                style={{ justifySelf: 'start' }}
              />
              <label>{labels.wssKeystorePath}</label>
              <input
                value={draft.wssKeystorePath ?? ''}
                onChange={e =>
                  onChange({
                    ...draft,
                    wssKeystorePath: e.target.value || null,
                  })
                }
              />
              <label>{labels.wssKeystorePassword}</label>
              <input
                type="password"
                value={draft.wssKeystorePassword ?? ''}
                onChange={e =>
                  onChange({
                    ...draft,
                    wssKeystorePassword: e.target.value || null,
                  })
                }
              />
            </>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button onClick={onCancel}><span className="codicon codicon-close" style={{ marginRight: 6 }} />{labels.cancel}</button>
          <button onClick={onSave}><span className="codicon codicon-check" style={{ marginRight: 6 }} />{labels.save}</button>
        </div>
      </div>
    </div>
  );
}
