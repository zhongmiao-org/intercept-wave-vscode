import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { InitialState, IWWindow } from './interfaces/ui';

function Root() {
  const [state, setState] = useState(() => {
    const w = window as unknown as IWWindow;
    return (w.__IW_INITIAL_STATE__ || ({ config: { version: '', proxyGroups: [] }, groupStatuses: {}, isRunning: false, i18n: {}, activeGroupId: undefined } as InitialState));
  });

  useEffect(() => {
    try {
      const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') || '';
      console.debug('[IW] boot', { origin: location.origin, ua: navigator.userAgent, csp });
    } catch {}

    function onMessage(event: MessageEvent) {
      const msg = event.data;
      try { console.debug('[IW] onMessage ←', msg); } catch {}
      if (msg?.type === 'configUpdated') {
        setState(s => ({
          ...s,
          config: msg.config,
          activeGroupId: msg.activeGroupId ?? s.activeGroupId,
          groupStatuses: msg.groupStatuses ?? s.groupStatuses,
          isRunning: !!msg.isRunning,
        }));
      }
      if (msg?.type === 'panelAction') {
        setState(s => ({ ...s, panelAction: msg.action }));
      }
      if (msg?.type === 'notify') {
        try { console.warn('[IW] notify ←', msg?.level, msg?.text); } catch {}
      }
      if (msg?.type === 'closeGroupForm') {
        // Close any open form state in panel/side view
        window.dispatchEvent(new CustomEvent('iw:closeGroupForm'));
        setState(s => ({ ...s, panelAction: null }));
      }
    }
    window.addEventListener('message', onMessage);
    try { console.debug('[IW] message listener attached'); } catch {}
    // Error taps
    const onError = (e: ErrorEvent) => {
      try { console.error('[IW] window.error', e.message, e.filename, e.lineno, e.colno); } catch {}
      try {
        const api = (window as any).acquireVsCodeApi ? (window as any).acquireVsCodeApi() : undefined;
        api?.postMessage({ type: 'webviewClientError', kind: 'error', message: e.message, filename: e.filename, line: e.lineno, col: e.colno });
      } catch {}
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      try { console.error('[IW] unhandledrejection', e.reason); } catch {}
      try {
        const api = (window as any).acquireVsCodeApi ? (window as any).acquireVsCodeApi() : undefined;
        api?.postMessage({ type: 'webviewClientError', kind: 'unhandledrejection', reason: String(e.reason ?? '') });
      } catch {}
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    // Handshake: notify extension that webview is ready
    try {
      const api = (window as any).acquireVsCodeApi ? (window as any).acquireVsCodeApi() : undefined;
      api?.postMessage({ type: 'webviewReady', ua: navigator.userAgent, ts: Date.now() });
      console.debug('[IW] webviewReady → posted');
    } catch {}
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return <App state={state} setState={setState} />;
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Root />);
}
/// <reference path="./react-shim.d.ts" />
