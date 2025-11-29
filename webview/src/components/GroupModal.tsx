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

  const protocol = draft.protocol || 'HTTP';
  const isWs = protocol === 'WS';
  const modalWidth = Math.max(600, Math.min(840, vw - 48));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', overflowY: 'auto', zIndex: 50 }} onClick={onCancel}>
      <div
        style={{
          width: modalWidth,
          maxWidth: '96vw',
          margin: '6vh auto',
          background: 'var(--vscode-editor-background)',
          padding: 20,
          borderRadius: 6,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          aria-label="Close"
          title="Close"
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
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
          {isEdit ? labels.titleEdit : labels.titleAdd}
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
          {isWs ? (labels.sectionWs || 'WebSocket 设置') : (labels.sectionHttp || 'HTTP 设置')}
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
              <label>{labels.baseUrl}</label>
              <input
                value={draft.baseUrl}
                onChange={e => onChange({ ...draft, baseUrl: e.target.value })}
              />

              <label>{labels.interceptPrefix}</label>
              <input
                value={draft.interceptPrefix}
                onChange={e => onChange({ ...draft, interceptPrefix: e.target.value })}
              />

              <label>{labels.globalCookie}</label>
              <input
                value={draft.globalCookie}
                onChange={e => onChange({ ...draft, globalCookie: e.target.value })}
              />
            </>
          )}
        </div>

        {/* Footer buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onCancel}>
            <span className="codicon codicon-close" style={{ marginRight: 6 }} />
            {labels.cancel}
          </button>
          <button onClick={onSave}>
            <span className="codicon codicon-check" style={{ marginRight: 6 }} />
            {labels.save}
          </button>
        </div>
      </div>
    </div>
  );
}
