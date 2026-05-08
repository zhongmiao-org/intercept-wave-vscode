import React from 'react';
import type { RouteModalProps } from '../interfaces/ui.components';
import type { HeaderOverrideRule } from '../interfaces/business';

const RESTRICTED_REQUEST_HEADERS = new Set(['host', 'connection', 'content-length', 'date', 'expect', 'upgrade', 'trailer', 'te']);
const RESTRICTED_RESPONSE_HEADERS = new Set(['transfer-encoding', 'content-length', 'connection']);

export function RouteModal({ open, draft, onChange, onSave, onCancel, onPickStaticRoot, labels, isEdit }: RouteModalProps) {
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

  if (!open) return null;

  const targetType = draft.targetType === 'STATIC' ? 'STATIC' : 'PROXY';
  const staticRoot = draft.staticRoot || '';
  const isExternalStaticRoot = staticRoot.trim() !== '' && /^(\/|[A-Za-z]:[\\/])/.test(staticRoot.trim());
  const requestHeaders = draft.requestHeaders || [];
  const responseHeaders = draft.responseHeaders || [];

  const updateHeaderRule = (kind: 'requestHeaders' | 'responseHeaders', index: number, patch: Partial<HeaderOverrideRule>) => {
    const rules = [...(draft[kind] || [])];
    rules[index] = { ...rules[index], ...patch };
    onChange({ ...draft, [kind]: rules });
  };

  const addHeaderRule = (kind: 'requestHeaders' | 'responseHeaders') => {
    onChange({
      ...draft,
      [kind]: [...(draft[kind] || []), { name: '', value: '', operation: 'SET', enabled: true }],
    });
  };

  const removeHeaderRule = (kind: 'requestHeaders' | 'responseHeaders', index: number) => {
    onChange({ ...draft, [kind]: (draft[kind] || []).filter((_, itemIndex) => itemIndex !== index) });
  };

  const renderHeaderRules = (
    title: string,
    kind: 'requestHeaders' | 'responseHeaders',
    rules: HeaderOverrideRule[],
    restrictedHeaders: Set<string>,
    restrictedHint: string
  ) => (
    <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 8, marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ fontSize: 13 }}>{title}</strong>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={() => addHeaderRule(kind)}>{labels.addHeaderRule}</button>
      </div>
      <div style={{ fontSize: 11.5, lineHeight: 1.35, color: 'var(--vscode-descriptionForeground)' }}>{labels.headerRulesHint}</div>
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '58px 96px minmax(110px, 1fr) minmax(120px, 1.2fr) 32px', gap: 6, fontSize: 11.5, color: 'var(--vscode-descriptionForeground)' }}>
          <span>{labels.headerRuleEnabled}</span>
          <span>{labels.headerRuleOperation}</span>
          <span>{labels.headerRuleName}</span>
          <span>{labels.headerRuleValue}</span>
          <span />
        </div>
        {rules.map((rule, index) => {
          const isRestricted = restrictedHeaders.has((rule.name || '').trim().toLowerCase());
          return (
            <div key={index} style={{ display: 'grid', gap: 4 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '58px 96px minmax(110px, 1fr) minmax(120px, 1.2fr) 32px', gap: 6, alignItems: 'center' }}>
                <input aria-label={labels.headerRuleEnabled} type="checkbox" checked={rule.enabled} onChange={e => updateHeaderRule(kind, index, { enabled: e.target.checked })} />
                <select value={rule.operation} onChange={e => updateHeaderRule(kind, index, { operation: e.target.value as HeaderOverrideRule['operation'] })}>
                  <option value="SET">{labels.headerOperationSet}</option>
                  <option value="ADD">{labels.headerOperationAdd}</option>
                  <option value="REMOVE">{labels.headerOperationRemove}</option>
                </select>
                <input value={rule.name} placeholder="X-Dev-Gateway" onChange={e => updateHeaderRule(kind, index, { name: e.target.value })} />
                <input value={rule.value} placeholder={rule.operation === 'REMOVE' ? '' : 'value'} disabled={rule.operation === 'REMOVE'} onChange={e => updateHeaderRule(kind, index, { value: e.target.value })} />
                <button type="button" onClick={() => removeHeaderRule(kind, index)} title={labels.removeHeaderRule} style={{ minWidth: 0, width: 30, height: 28, padding: 0 }}>
                  <span className="codicon codicon-trash" />
                </button>
              </div>
              {isRestricted && (
                <div style={{ fontSize: 11.5, lineHeight: 1.35, color: 'var(--vscode-editorWarning-foreground, var(--vscode-descriptionForeground))' }}>{restrictedHint}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.24)', overflowY: 'auto', zIndex: 60 }} onClick={onCancel}>
      <div style={{ width: 640, maxWidth: '92vw', margin: '6vh auto', background: 'var(--vscode-editor-background)', padding: 20, borderRadius: 10, border: '1px solid var(--vscode-panel-border)', boxShadow: '0 18px 40px rgba(0,0,0,0.35)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0, color: 'var(--vscode-descriptionForeground)', marginBottom: 6 }}>{labels.chromeTitle || 'Route'}</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{isEdit ? labels.titleEdit : labels.titleAdd}</div>
        <div style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)', marginBottom: 14 }}>
          {labels.hint}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: 10, columnGap: 10, alignItems: 'center' }}>
          <label>{labels.name}</label>
          <input autoFocus value={draft.name} onChange={e => onChange({ ...draft, name: e.target.value })} />

          <label>{labels.pathPrefix}</label>
          <input value={draft.pathPrefix} onChange={e => onChange({ ...draft, pathPrefix: e.target.value })} />

          <label>{labels.targetType}</label>
          <select
            value={targetType}
            onChange={e => onChange({ ...draft, targetType: e.target.value as 'PROXY' | 'STATIC' })}
          >
            <option value="PROXY">{labels.targetTypeProxy}</option>
            <option value="STATIC">{labels.targetTypeStatic}</option>
          </select>

          {targetType === 'PROXY' && (
            <>
              <label>{labels.targetBaseUrl}</label>
              <input value={draft.targetBaseUrl} onChange={e => onChange({ ...draft, targetBaseUrl: e.target.value })} />
            </>
          )}

          {targetType === 'STATIC' && (
            <>
              <label>{labels.staticRoot}</label>
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                  <input value={staticRoot} placeholder="frontend/dist" onChange={e => onChange({ ...draft, staticRoot: e.target.value })} />
                  <button type="button" onClick={onPickStaticRoot}>{labels.chooseFolder}</button>
                </div>
                <span style={{ fontSize: 11.5, lineHeight: 1.35, color: isExternalStaticRoot ? 'var(--vscode-editorWarning-foreground, var(--vscode-descriptionForeground))' : 'var(--vscode-descriptionForeground)' }}>
                  {isExternalStaticRoot ? labels.staticRootExternalHint : labels.staticRootHint}
                </span>
              </div>
            </>
          )}

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

          {targetType === 'PROXY' && (
            <>
              <label>{labels.spaFallbackPath}</label>
              <div style={{ display: 'grid', gap: 4 }}>
                <input value={draft.spaFallbackPath || ''} placeholder="/index.html" onChange={e => onChange({ ...draft, spaFallbackPath: e.target.value })} />
                <span style={{ fontSize: 11.5, lineHeight: 1.35, color: 'var(--vscode-descriptionForeground)' }}>{labels.spaFallbackPathHint}</span>
              </div>
            </>
          )}

          {targetType === 'STATIC' && (
            <>
              <label>{labels.spaFallback}</label>
              <div style={{ display: 'grid', gap: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={draft.spaFallback === true} onChange={e => onChange({ ...draft, spaFallback: e.target.checked })} />
                  <span>{draft.spaFallback ? labels.yesLabel : labels.noLabel}</span>
                </label>
                <span style={{ fontSize: 11.5, lineHeight: 1.35, color: 'var(--vscode-descriptionForeground)' }}>{labels.spaFallbackHint}</span>
              </div>
            </>
          )}

          <label>{labels.enableMock}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={draft.enableMock} onChange={e => onChange({ ...draft, enableMock: e.target.checked })} />
            <span>{draft.enableMock ? labels.yesLabel : labels.noLabel}</span>
          </div>

          {renderHeaderRules(labels.requestHeaders, 'requestHeaders', requestHeaders, RESTRICTED_REQUEST_HEADERS, labels.restrictedRequestHeaderHint)}
          {renderHeaderRules(labels.responseHeaders, 'responseHeaders', responseHeaders, RESTRICTED_RESPONSE_HEADERS, labels.restrictedResponseHeaderHint)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={onCancel}>{labels.cancel}</button>
          <button onClick={onSave} style={{ fontWeight: 600 }}>{labels.save}</button>
        </div>
      </div>
    </div>
  );
}
