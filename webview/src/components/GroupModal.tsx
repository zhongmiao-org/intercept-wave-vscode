import React from 'react';
import type { GroupModalProps } from '../interfaces/ui.components';

export function GroupModal({ open, draft, onChange, onSave, onCancel, onPickHttpsKeystore, onGenerateLocalCertificate, labels, isEdit }: GroupModalProps) {
  React.useEffect(() => {
    if (!open) return;
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
  }, [open, onCancel, onSave]);

  const [vw, setVw] = React.useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1200);
  React.useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const protocol = draft.protocol || 'HTTP';
  const isWs = protocol === 'WS';
  const modalWidth = Math.max(600, Math.min(840, vw - 48));
  const httpsKeystorePath = draft.httpsKeystorePath || '';
  const isExternalHttpsKeystore = httpsKeystorePath.trim() !== '' && /^(\/|[A-Za-z]:[\\/])/.test(httpsKeystorePath.trim());

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', overflowY: 'auto', zIndex: 50 }} onClick={onCancel}>
      <div
        style={{
          width: modalWidth,
          maxWidth: '96vw',
          margin: '6vh auto',
          background: 'var(--vscode-editor-background)',
          padding: 20,
          borderRadius: 10,
          border: '1px solid var(--vscode-panel-border)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          aria-label={labels.close || labels.cancel}
          title={labels.close || labels.cancel}
          onClick={onCancel}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'transparent',
            color: 'var(--vscode-foreground)',
            border: 'none',
            fontSize: 18,
            lineHeight: 1,
            cursor: 'pointer',
            minWidth: 0,
            padding: 0,
            width: 24,
            height: 24,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>

        {/* Title */}
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0, color: 'var(--vscode-descriptionForeground)' }}>
          {labels.chromeTitle || labels.sectionHttp}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
          {isEdit ? labels.titleEdit : labels.titleAdd}
        </div>
        <div style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)', marginBottom: 2 }}>
          {labels.hint}
        </div>

        {/* Group settings section */}
        <div style={{ fontWeight: 600, marginTop: 4, marginBottom: 4 }}>
          {labels.sectionGroup || labels.titleEdit}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '140px 1fr',
            rowGap: 8,
            columnGap: 8,
            alignItems: 'center',
          }}
        >
          <label>{labels.name}</label>
          <input autoFocus value={draft.name} onChange={e => onChange({ ...draft, name: e.target.value })} />

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
          <input
            type="number"
            value={draft.port}
            onChange={e => onChange({ ...draft, port: Number(e.target.value) })}
          />

          <label>{labels.stripPrefix}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={draft.stripPrefix}
              onChange={e => onChange({ ...draft, stripPrefix: e.target.checked })}
            />
            <span>{draft.stripPrefix ? labels.yesLabel : labels.noLabel}</span>
          </div>

          <label>{labels.enabled}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={e => onChange({ ...draft, enabled: e.target.checked })}
            />
            <span>{draft.enabled ? labels.yesLabel : labels.noLabel}</span>
          </div>
        </div>

        {/* HTTP or WebSocket specific section */}
        <div style={{ fontWeight: 600, marginTop: 10, marginBottom: 4 }}>
          {isWs ? labels.sectionWs : (labels.listenerExtras || labels.sectionHttp)}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '140px 1fr',
            rowGap: 8,
            columnGap: 8,
            alignItems: 'center',
          }}
        >
          {isWs ? (
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

              {/* WSS / TLS 相关配置暂不支持，先隐藏对应 UI 字段 */}
            </>
          ) : (
            <>
              <label>{labels.globalCookie}</label>
              <input
                value={draft.globalCookie}
                onChange={e => onChange({ ...draft, globalCookie: e.target.value })}
              />

              <div style={{ gridColumn: '1 / -1', marginTop: 8, fontWeight: 600 }}>{labels.httpsSection}</div>

              <label>{labels.httpsEnabled}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={draft.httpsEnabled === true}
                  onChange={e => onChange({ ...draft, httpsEnabled: e.target.checked })}
                />
                <span>{draft.httpsEnabled ? labels.yesLabel : labels.noLabel}</span>
              </div>

              <label>{labels.httpsKeystorePath}</label>
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                  <input
                    value={httpsKeystorePath}
                    placeholder="certs/intercept-wave-local.p12"
                    onChange={e => onChange({ ...draft, httpsKeystorePath: e.target.value })}
                  />
                  <button type="button" onClick={onPickHttpsKeystore}>{labels.chooseFile}</button>
                </div>
                <span style={{ fontSize: 11.5, lineHeight: 1.35, color: isExternalHttpsKeystore ? 'var(--vscode-editorWarning-foreground, var(--vscode-descriptionForeground))' : 'var(--vscode-descriptionForeground)' }}>
                  {isExternalHttpsKeystore ? labels.httpsExternalWarning : labels.httpsHint}
                </span>
              </div>

              <label>{labels.httpsKeystorePassword}</label>
              <input
                type="password"
                value={draft.httpsKeystorePassword || ''}
                placeholder="changeit"
                onChange={e => onChange({ ...draft, httpsKeystorePassword: e.target.value })}
              />

              <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 6 }}>
                <button type="button" onClick={onGenerateLocalCertificate} style={{ justifySelf: 'start' }}>
                  <span className="codicon codicon-key" style={{ marginRight: 6 }} />
                  {labels.generateLocalCertificate}
                </button>
                <span style={{ fontSize: 11.5, lineHeight: 1.35, color: 'var(--vscode-descriptionForeground)' }}>
                  {labels.httpsLocalCertificateWarning}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onCancel}>
            <span className="codicon codicon-close" style={{ marginRight: 6 }} />
            {labels.cancel}
          </button>
          <button onClick={onSave} style={{ fontWeight: 600 }}>
            <span className="codicon codicon-check" style={{ marginRight: 6 }} />
            {labels.save}
          </button>
        </div>
      </div>
    </div>
  );
}
