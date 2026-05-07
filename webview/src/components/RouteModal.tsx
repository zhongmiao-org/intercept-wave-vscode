import React from 'react';
import type { HeaderOverrideRule, HeaderRuleOperation } from '../interfaces/business';
import type { RouteModalProps } from '../interfaces/ui.components';

export function RouteModal({ open, draft, onChange, onSave, onCancel, labels, isEdit }: RouteModalProps) {
  if (!open) return null;

  const createHeaderRule = (): HeaderOverrideRule => ({
    name: '',
    value: '',
    operation: 'set',
    enabled: true,
  });

  const updateHeaderRule = (kind: 'requestHeaders' | 'responseHeaders', index: number, patch: Partial<HeaderOverrideRule>) => {
    const current = draft[kind] || [];
    onChange({
      ...draft,
      [kind]: current.map((rule, idx) => idx === index ? { ...rule, ...patch } : rule),
    });
  };

  const addHeaderRule = (kind: 'requestHeaders' | 'responseHeaders') => {
    onChange({ ...draft, [kind]: [...(draft[kind] || []), createHeaderRule()] });
  };

  const removeHeaderRule = (kind: 'requestHeaders' | 'responseHeaders', index: number) => {
    onChange({ ...draft, [kind]: (draft[kind] || []).filter((_, idx) => idx !== index) });
  };

  const renderHeaderRules = (kind: 'requestHeaders' | 'responseHeaders', title: string) => {
    const rules = draft[kind] || [];
    return (
      <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 8, paddingTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--vscode-descriptionForeground)' }}>{title}</div>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={() => addHeaderRule(kind)}>{labels.addHeaderRule}</button>
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          {rules.map((rule, index) => (
            <div
              key={`${kind}-${index}`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(78px, 96px) minmax(120px, 1fr) minmax(120px, 1fr) auto auto',
                gap: 6,
                alignItems: 'center',
              }}
            >
              <select
                aria-label={labels.headerOperation}
                value={rule.operation}
                onChange={e => updateHeaderRule(kind, index, { operation: e.target.value as HeaderRuleOperation })}
              >
                <option value="set">{labels.headerOpSet}</option>
                <option value="add">{labels.headerOpAdd}</option>
                <option value="remove">{labels.headerOpRemove}</option>
              </select>
              <input
                aria-label={labels.headerName}
                value={rule.name}
                placeholder="Authorization"
                onChange={e => updateHeaderRule(kind, index, { name: e.target.value })}
              />
              <input
                aria-label={labels.headerValue}
                value={rule.value}
                placeholder="Bearer token"
                disabled={rule.operation === 'remove'}
                onChange={e => updateHeaderRule(kind, index, { value: e.target.value })}
              />
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={e => updateHeaderRule(kind, index, { enabled: e.target.checked })}
                />
                {labels.headerRuleEnabled}
              </label>
              <button type="button" onClick={() => removeHeaderRule(kind, index)}>{labels.delete}</button>
            </div>
          ))}
        </div>
      </div>
    );
  };

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

          <label>{labels.rewriteTargetPath}</label>
          <div style={{ display: 'grid', gap: 4 }}>
            <input value={draft.rewriteTargetPath || ''} placeholder="/v1" onChange={e => onChange({ ...draft, rewriteTargetPath: e.target.value })} />
            <span style={{ fontSize: 11.5, lineHeight: 1.35, color: 'var(--vscode-descriptionForeground)' }}>{labels.rewriteTargetPathHint}</span>
          </div>

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

          <div style={{ gridColumn: '1 / -1', marginTop: 4, borderTop: '1px solid var(--vscode-panel-border)', paddingTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--vscode-descriptionForeground)', marginBottom: 4 }}>{labels.headerOverrides}</div>
            <div style={{ fontSize: 11.5, lineHeight: 1.35, color: 'var(--vscode-descriptionForeground)' }}>{labels.headerRestrictedHint}</div>
          </div>
          {renderHeaderRules('requestHeaders', labels.requestHeaders)}
          {renderHeaderRules('responseHeaders', labels.responseHeaders)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={onCancel}>{labels.cancel}</button>
          <button onClick={onSave} style={{ fontWeight: 600 }}>{labels.save}</button>
        </div>
      </div>
    </div>
  );
}
