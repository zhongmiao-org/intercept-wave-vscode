import React from 'react';
import type { MockModalProps } from '../interfaces/ui.components';

const CONTENT_TYPES = [
    { value: 'application/json', label: 'JSON' },
    { value: 'text/html', label: 'HTML' },
    { value: 'text/plain', label: 'Text' },
    { value: 'application/javascript', label: 'JavaScript' },
    { value: 'text/css', label: 'CSS' },
    { value: 'application/xml', label: 'XML' },
    { value: '__FILE__', label: 'File' },
];

export function MockModal({
    open,
    draft,
    onChange,
    onSave,
    onFormat,
    onCancel,
    onSelectFile,
    labels,
    isEdit,
}: MockModalProps) {
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
    const [vw, setVw] = React.useState<number>(
        typeof window !== 'undefined' ? window.innerWidth : 1200
    );
    React.useEffect(() => {
        const onResize = () => setVw(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    const cols = '140px 1fr';
    const modalWidth = Math.max(360, Math.min(720, vw - 24));

    const handleClearFile = () => {
        onChange({ ...draft, responseFile: undefined, contentType: 'application/json' });
    };

    const isFileMode = draft.contentType === '__FILE__';

    const handleContentTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newType = e.target.value;
        if (newType === '__FILE__') {
            if (!draft.responseFile && onSelectFile) {
                onSelectFile();
            }
            onChange({ ...draft, contentType: newType });
        } else {
            onChange({ ...draft, contentType: newType, responseFile: undefined });
        }
    };

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.2)',
                overflowY: 'auto',
            }}
            onClick={onCancel}
        >
            <div
                style={{
                    width: modalWidth,
                    maxWidth: '90vw',
                    margin: '6vh auto',
                    background: 'var(--vscode-editor-background)',
                    padding: 16,
                    borderRadius: 6,
                    position: 'relative',
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
                        gap: 0,
                    }}
                >
                    ×
                </button>
                <h3 style={{ marginTop: 0, paddingRight: 24 }}>
                    {isEdit ? labels.titleEdit : labels.titleAdd}
                </h3>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: cols as any,
                        gap: 8,
                        alignItems: 'center',
                    }}
                >
                    <label>{labels.enabled}</label>
                    <input
                        type="checkbox"
                        checked={draft.enabled}
                        onChange={e => onChange({ ...draft, enabled: e.target.checked })}
                        style={{ justifySelf: 'start' }}
                    />

                    <label>{labels.method}</label>
                    <select
                        value={draft.method}
                        onChange={e => onChange({ ...draft, method: e.target.value })}
                    >
                        {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].map(m => (
                            <option key={m} value={m}>
                                {m}
                            </option>
                        ))}
                    </select>

                    <label>{labels.path}</label>
                    <input
                        value={draft.path}
                        onChange={e => onChange({ ...draft, path: e.target.value })}
                    />

                    <label>{labels.statusCode}</label>
                    <input
                        type="number"
                        value={draft.statusCode}
                        onChange={e => onChange({ ...draft, statusCode: Number(e.target.value) })}
                    />

                    <label>{labels.delay}</label>
                    <input
                        type="number"
                        value={draft.delay ?? 0}
                        onChange={e => onChange({ ...draft, delay: Number(e.target.value) })}
                    />

                    <label>{labels.queryParams}</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <textarea
                            style={{
                                minHeight: 60,
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                                fontSize: 12,
                            }}
                            value={draft.queryParams || ''}
                            onChange={e =>
                                onChange({ ...draft, queryParams: e.target.value || undefined })
                            }
                            onBlur={e => {
                                const val = e.target.value;
                                if (val && val.includes('%')) {
                                    try {
                                        const decoded = decodeURIComponent(val);
                                        if (decoded !== val) {
                                            onChange({ ...draft, queryParams: decoded });
                                        }
                                    } catch {
                                        // ignore
                                    }
                                }
                            }}
                            placeholder={labels.queryParamsHint}
                        />
                    </div>

                    <label>{labels.requestBody}</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <textarea
                            style={{
                                minHeight: 60,
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                                fontSize: 12,
                            }}
                            value={draft.requestBody || ''}
                            onChange={e =>
                                onChange({ ...draft, requestBody: e.target.value || undefined })
                            }
                            onBlur={e => {
                                const val = e.target.value;
                                if (val && val.includes('%')) {
                                    try {
                                        const decoded = decodeURIComponent(val);
                                        if (decoded !== val) {
                                            onChange({ ...draft, requestBody: decoded });
                                        }
                                    } catch {
                                        // ignore
                                    }
                                }
                            }}
                            placeholder={labels.requestBodyHint}
                        />
                    </div>

                    <label>{labels.responseBody}</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <select
                            value={
                                isFileMode ? '__FILE__' : draft.contentType || 'application/json'
                            }
                            onChange={handleContentTypeChange}
                            style={{ minWidth: 140 }}
                        >
                            {CONTENT_TYPES.map(ct => (
                                <option key={ct.value} value={ct.value}>
                                    {ct.label}
                                </option>
                            ))}
                        </select>
                        {!isFileMode && (
                            <button onClick={onFormat}>
                                <span className="codicon codicon-wand" style={{ marginRight: 6 }} />
                                {labels.format}
                            </button>
                        )}
                    </div>
                </div>
                <div style={{ marginTop: 8 }}>
                    {isFileMode ? (
                        <div
                            style={{
                                display: 'flex',
                                gap: 8,
                                alignItems: 'center',
                                padding: '8px 0',
                            }}
                        >
                            <input
                                value={draft.responseFile || ''}
                                onChange={e =>
                                    onChange({
                                        ...draft,
                                        responseFile: e.target.value || undefined,
                                    })
                                }
                                placeholder="Select a file or enter path"
                                style={{
                                    flex: 1,
                                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                                }}
                            />
                            <button
                                onClick={onSelectFile}
                                title="Browse file"
                                disabled={!onSelectFile}
                            >
                                <span
                                    className="codicon codicon-folder"
                                    style={{ marginRight: 4 }}
                                />
                                Browse
                            </button>
                            {draft.responseFile && (
                                <button onClick={handleClearFile} title="Clear">
                                    <span className="codicon codicon-close" />
                                </button>
                            )}
                        </div>
                    ) : (
                        <textarea
                            style={{
                                width: '96%',
                                height: 180,
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                            }}
                            value={draft.mockData}
                            onChange={e => onChange({ ...draft, mockData: e.target.value })}
                            placeholder="Enter response body"
                        />
                    )}
                    {isFileMode && draft.responseFile && (
                        <div
                            style={{
                                fontSize: 12,
                                color: 'var(--vscode-descriptionForeground)',
                                marginTop: 4,
                            }}
                        >
                            📄 Response will be loaded from: {draft.responseFile}
                        </div>
                    )}
                    <div
                        style={{
                            display: 'flex',
                            gap: 8,
                            justifyContent: 'flex-end',
                            marginTop: 8,
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
        </div>
    );
}
