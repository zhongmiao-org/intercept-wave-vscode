import React from 'react';
import type { WsRule, WsDirection, WsRuleMode, WsTimelineItem } from '../interfaces/business';

export interface WsRuleModalProps {
  open: boolean;
  draft: WsRule;
  onChange: (next: WsRule) => void;
  onSave: () => void;
  onCancel: () => void;
  isEdit: boolean;
  labels: {
    titleAdd: string;
    titleEdit: string;
    enabled: string;
    path: string;
    mode: string;
    modeOff: string;
    modePeriodic: string;
    modeTimeline: string;
    eventKey: string;
    eventValue: string;
    direction: string;
    directionBoth: string;
    directionIn: string;
    directionOut: string;
    onOpen: string;
    intercept: string;
    periodSec: string;
    timelineSecList: string;
    message: string;
    formatJson: string;
    cancel: string;
    save: string;
    basicSectionTitle: string;
    timelineEmpty: string;
    timelineAdd: string;
    timelineEdit: string;
    timelineDelete: string;
    timelineEditorAddTitle: string;
    timelineEditorEditTitle: string;
    timelineEditorAtMs: string;
    timelineEditorMessage: string;
    timelineEditorSave: string;
    timelineEditorCancel: string;
  };
}

export function WsRuleModal({ open, draft, onChange, onSave, onCancel, isEdit, labels }: WsRuleModalProps) {
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

  const modalWidth = Math.max(720, Math.min(900, vw - 48));
  const gridCols = '140px 1fr';

  const mode: WsRuleMode = draft.mode || 'off';
  const direction: WsDirection = draft.direction || 'both';
  const timeline: WsTimelineItem[] = Array.isArray(draft.timeline)
    ? (draft.timeline as WsTimelineItem[])
    : [];
  const [selectedTimelineIndex, setSelectedTimelineIndex] = React.useState<number | null>(null);
  const [timelineEditMode, setTimelineEditMode] = React.useState<'idle' | 'add' | 'edit'>('idle');
  const [timelineDraftAtMs, setTimelineDraftAtMs] = React.useState<string>('');
  const [timelineDraftMessage, setTimelineDraftMessage] = React.useState<string>('{}');

  const beginAddTimelineItem = () => {
    setTimelineEditMode('add');
    setTimelineDraftAtMs('1000');
    setTimelineDraftMessage('{}');
  };

  const beginEditTimelineItem = () => {
    if (selectedTimelineIndex == null || selectedTimelineIndex < 0 || selectedTimelineIndex >= timeline.length) {
      return;
    }
    const current = timeline[selectedTimelineIndex];
    setTimelineEditMode('edit');
    setTimelineDraftAtMs(String(current.atMs));
    setTimelineDraftMessage(current.message ?? '{}');
  };

  const cancelTimelineEdit = () => {
    setTimelineEditMode('idle');
    setTimelineDraftAtMs('');
    setTimelineDraftMessage('{}');
  };

  const commitTimelineEdit = () => {
    const atMs = Number(timelineDraftAtMs);
    if (!Number.isFinite(atMs) || atMs < 0) {
      window.alert('时间点需为非负整数（毫秒）');
      return;
    }
    const item: WsTimelineItem = { atMs, message: timelineDraftMessage || '{}' };
    let next: WsTimelineItem[];
    let nextSelected = 0;

    if (timelineEditMode === 'add') {
      next = [...timeline, item].sort((a, b) => a.atMs - b.atMs);
      nextSelected = next.indexOf(item);
    } else if (timelineEditMode === 'edit') {
      if (selectedTimelineIndex == null || selectedTimelineIndex < 0 || selectedTimelineIndex >= timeline.length) {
        return;
      }
      const original = timeline[selectedTimelineIndex];
      next = timeline
        .map((it, idx) => (idx === selectedTimelineIndex ? item : it))
        .sort((a, b) => a.atMs - b.atMs);
      // 尝试优先选中时间点相同的新项
      nextSelected = next.findIndex(it => it.atMs === item.atMs && it.message === item.message);
      if (nextSelected < 0) {
        nextSelected = next.indexOf(item);
      }
    } else {
      return;
    }

    onChange({ ...draft, timeline: next });
    setSelectedTimelineIndex(nextSelected >= 0 ? nextSelected : 0);
    cancelTimelineEdit();
  };

  const deleteTimelineItem = () => {
    if (selectedTimelineIndex == null || selectedTimelineIndex < 0 || selectedTimelineIndex >= timeline.length) {
      return;
    }
    const next = timeline.filter((_, idx) => idx !== selectedTimelineIndex);
    onChange({ ...draft, timeline: next });
    if (!next.length) {
      setSelectedTimelineIndex(null);
    } else if (selectedTimelineIndex >= next.length) {
      setSelectedTimelineIndex(next.length - 1);
    }
  };

  const isTimelineMode = mode === 'timeline';

  const getMessageValue = (): string => {
    if (!isTimelineMode) return draft.message ?? '';
    if (selectedTimelineIndex == null || selectedTimelineIndex < 0 || selectedTimelineIndex >= timeline.length) {
      return '';
    }
    return timeline[selectedTimelineIndex].message ?? '';
  };

  const updateMessageValue = (value: string) => {
    if (!isTimelineMode) {
      onChange({ ...draft, message: value });
      return;
    }
    if (selectedTimelineIndex == null || selectedTimelineIndex < 0 || selectedTimelineIndex >= timeline.length) {
      return;
    }
    const next = timeline.map((it, idx) =>
      idx === selectedTimelineIndex ? { ...it, message: value } : it
    );
    onChange({ ...draft, timeline: next });
  };

  const handleFormatMessage = () => {
    const raw = getMessageValue();
    if (!raw || !raw.trim()) return;
    try {
      const parsed = JSON.parse(raw);
      const formatted = JSON.stringify(parsed, null, 2);
      updateMessageValue(formatted);
    } catch (e) {
      const msg = (e as Error)?.message || String(e);
      window.alert(`JSON 格式错误: ${msg}`);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        overflowY: 'auto',
        zIndex: 60,
      }}
      onClick={onCancel}
    >
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
          gap: 12,
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

        <h3 style={{ margin: 0, paddingRight: 24 }}>
          {isEdit ? labels.titleEdit : labels.titleAdd}
        </h3>

        {/* Basic settings */}
        <div style={{ fontWeight: 600, marginTop: 4 }}>{labels.basicSectionTitle}</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: gridCols as any,
            rowGap: 8,
            columnGap: 8,
            alignItems: 'center',
          }}
        >
          <label>{labels.enabled}</label>
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={e => onChange({ ...draft, enabled: e.target.checked })}
          />

          <label>{labels.path}</label>
          <input
            value={draft.path}
            onChange={e => onChange({ ...draft, path: e.target.value })}
            placeholder="/ws/**"
          />

          <label>{labels.mode}</label>
          <select
            value={mode}
            onChange={e =>
              onChange({
                ...draft,
                mode: e.target.value as WsRuleMode,
              })
            }
          >
            <option value="off">{labels.modeOff}</option>
            <option value="periodic">{labels.modePeriodic}</option>
            <option value="timeline">{labels.modeTimeline}</option>
          </select>

          <label>{labels.eventKey}</label>
          <input
            value={draft.eventKey ?? 'action'}
            onChange={e =>
              onChange({
                ...draft,
                eventKey: e.target.value || undefined,
              })
            }
            placeholder="action"
          />

          <label>{labels.eventValue}</label>
          <input
            value={draft.eventValue ?? ''}
            onChange={e =>
              onChange({
                ...draft,
                eventValue: e.target.value || undefined,
              })
            }
            placeholder=""
          />

          <label>{labels.direction}</label>
          <select
            value={direction}
            onChange={e =>
              onChange({
                ...draft,
                direction: e.target.value as WsDirection,
              })
            }
          >
            <option value="both">{labels.directionBoth}</option>
            <option value="in">{labels.directionIn}</option>
            <option value="out">{labels.directionOut}</option>
          </select>

          <label>{labels.onOpen}</label>
          <input
            type="checkbox"
            checked={!!draft.onOpenFire}
            onChange={e =>
              onChange({
                ...draft,
                onOpenFire: e.target.checked,
              })
            }
          />

          <label>{labels.intercept}</label>
          <input
            type="checkbox"
            checked={!!draft.intercept}
            onChange={e =>
              onChange({
                ...draft,
                intercept: e.target.checked,
              })
            }
          />

          {mode === 'periodic' && (
            <>
              <label>{labels.periodSec}</label>
              <input
                type="number"
                min={1}
                value={draft.periodSec ?? 5}
                onChange={e =>
                  onChange({
                    ...draft,
                    periodSec: Number(e.target.value) || 0,
                  })
                }
              />
            </>
          )}

          {mode === 'timeline' && (
            <>
              <label>{labels.timelineSecList}</label>
              <div style={{ gridColumn: '1 / span 2' }}>
                <div
                  style={{
                    maxHeight: 200,
                    overflowY: 'auto',
                    borderRadius: 3,
                    border: '1px solid var(--vscode-panel-border)',
                  }}
                >
                  {timeline.length === 0 && (
                    <div
                      style={{
                        padding: 8,
                        color: 'var(--vscode-descriptionForeground, #888)',
                        fontStyle: 'italic',
                      }}
                    >
                      {labels.timelineEmpty}
                    </div>
                  )}
                  {timeline.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedTimelineIndex(idx)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '80px 1fr',
                        gap: 8,
                        padding: '6px 8px',
                        borderBottom: '1px solid var(--vscode-panel-border)',
                        cursor: 'pointer',
                        background:
                          selectedTimelineIndex === idx
                            ? 'var(--vscode-editor-selectionBackground)'
                            : 'transparent',
                      }}
                    >
                      <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>
                        {item.atMs} ms
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--vscode-descriptionForeground)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.message}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button onClick={beginAddTimelineItem}>{labels.timelineAdd}</button>
                  <button onClick={beginEditTimelineItem} disabled={selectedTimelineIndex == null}>
                    {labels.timelineEdit}
                  </button>
                  <button onClick={deleteTimelineItem} disabled={selectedTimelineIndex == null}>
                    {labels.timelineDelete}
                  </button>
                </div>
                {timelineEditMode !== 'idle' && (
                  <div style={{ marginTop: 8, padding: 8, borderRadius: 4, border: '1px solid var(--vscode-panel-border)' }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>
                      {timelineEditMode === 'add'
                        ? labels.timelineEditorAddTitle
                        : labels.timelineEditorEditTitle}
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '120px 1fr',
                        rowGap: 6,
                        columnGap: 8,
                        alignItems: 'center',
                      }}
                    >
                      <label>{labels.timelineEditorAtMs}</label>
                      <input
                        type="number"
                        min={0}
                        value={timelineDraftAtMs}
                        onChange={e => setTimelineDraftAtMs(e.target.value)}
                      />
                      <label>{labels.timelineEditorMessage}</label>
                      <textarea
                        style={{
                          width: '100%',
                          minHeight: 80,
                          resize: 'vertical',
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        }}
                        value={timelineDraftMessage}
                        onChange={e => setTimelineDraftMessage(e.target.value)}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                      <button onClick={cancelTimelineEdit}>{labels.timelineEditorCancel}</button>
                      <button onClick={commitTimelineEdit}>{labels.timelineEditorSave}</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Message content */}
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 8 }}>
            <div style={{ fontWeight: 600 }}>{labels.message}</div>
            <div style={{ flex: 1 }} />
            <button onClick={handleFormatMessage}>
              <span className="codicon codicon-wand" style={{ marginRight: 6 }} />
              {labels.formatJson}
            </button>
          </div>
          <textarea
            style={{
              width: '100%',
              minHeight: 160,
              resize: 'vertical',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
            value={getMessageValue()}
            onChange={e => updateMessageValue(e.target.value)}
            disabled={isTimelineMode && (selectedTimelineIndex == null || selectedTimelineIndex < 0 || selectedTimelineIndex >= timeline.length)}
            placeholder={
              isTimelineMode
                ? '请选择一个时间点，然后在此编辑该时间点的消息内容 (JSON)'
                : ''
            }
          />
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 12,
          }}
        >
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
