import React from 'react';
import type { WsRule } from '../interfaces/business';

export type WsManualTarget = 'match' | 'all' | 'recent';

export interface WsPushPanelProps {
  rules: WsRule[];
  onSendByRule: (ruleIndex: number, target: WsManualTarget) => void;
  onSendCustom: (target: WsManualTarget, payload: string) => void;
  labels: {
    title: string;
    rules: string;
    sendSelected: string;
    targetMatch: string;
    targetAll: string;
    targetRecent: string;
    customMessage: string;
    send: string;
    noRules: string;
  };
}

export function WsPushPanel({ rules, onSendByRule, onSendCustom, labels }: WsPushPanelProps) {
  const [selectedRuleIndex, setSelectedRuleIndex] = React.useState<number | null>(rules.length ? 0 : null);
  const [target, setTarget] = React.useState<WsManualTarget>('all');
  const [customPayload, setCustomPayload] = React.useState<string>('');

  React.useEffect(() => {
    if (!rules.length) {
      setSelectedRuleIndex(null);
      setCustomPayload('');
    } else if (selectedRuleIndex === null || selectedRuleIndex >= rules.length) {
      const nextIndex = 0;
      setSelectedRuleIndex(nextIndex);
      const rule = rules[nextIndex];
      if (rule) {
        setCustomPayload(rule.message);
      }
    }
  }, [rules, selectedRuleIndex]);

  const handleSendSelected = () => {
    if (selectedRuleIndex === null) return;
    onSendByRule(selectedRuleIndex, target);
  };

  const handleSendCustom = () => {
    if (!customPayload.trim()) return;
    onSendCustom(target, customPayload);
  };

  return (
    <div style={{ marginTop: 12, padding: 10, borderRadius: 4, border: '1px solid var(--vscode-panel-border)', background: 'var(--vscode-editor-background)' }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{labels.title}</div>

      {/* Target selection */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <span>{labels.rules}</span>
        <div style={{ flex: 1 }} />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <input type="radio" name="iw-ws-target" checked={target === 'match'} onChange={() => setTarget('match')} />
          {labels.targetMatch}
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <input type="radio" name="iw-ws-target" checked={target === 'all'} onChange={() => setTarget('all')} />
          {labels.targetAll}
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <input type="radio" name="iw-ws-target" checked={target === 'recent'} onChange={() => setTarget('recent')} />
          {labels.targetRecent}
        </label>
      </div>

      {/* Rules table */}
      <div style={{ maxHeight: 180, overflowY: 'auto', borderRadius: 3, border: '1px solid var(--vscode-panel-border)', marginBottom: 8 }}>
        {rules.length === 0 && (
          <div style={{ padding: 8, color: 'var(--vscode-descriptionForeground, #888)', fontStyle: 'italic' }}>
            {labels.noRules}
          </div>
        )}
        {rules.map((rule, idx) => (
          <label
            key={idx}
            style={{
              display: 'grid',
              gridTemplateColumns: '24px 1fr 80px 80px',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              borderBottom: '1px solid var(--vscode-panel-border)',
              cursor: 'pointer',
              background: selectedRuleIndex === idx ? 'var(--vscode-editor-selectionBackground)' : 'transparent',
            }}
            onClick={() => {
              setSelectedRuleIndex(idx);
              if (rule) {
                setCustomPayload(rule.message);
              }
            }}
          >
            <input
              type="radio"
              checked={selectedRuleIndex === idx}
              onChange={() => {
                setSelectedRuleIndex(idx);
                if (rule) {
                  setCustomPayload(rule.message);
                }
              }}
              style={{ justifySelf: 'center' }}
            />
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {rule.path || idx}
            </div>
            <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>
              {rule.mode}
            </div>
            <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>
              {rule.direction}
            </div>
          </label>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button onClick={handleSendSelected} disabled={selectedRuleIndex === null || rules.length === 0}>
          {labels.sendSelected}
        </button>
      </div>

      {/* Custom message */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div>{labels.customMessage}</div>
        <textarea
          value={customPayload}
          onChange={e => setCustomPayload(e.target.value)}
          rows={4}
          style={{ width: '100%', resize: 'vertical' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleSendCustom} disabled={!customPayload.trim()}>
            {labels.send}
          </button>
        </div>
      </div>
    </div>
  );
}
