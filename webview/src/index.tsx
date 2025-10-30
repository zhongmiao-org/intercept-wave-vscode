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
    function onMessage(event: MessageEvent) {
      const msg = event.data;
      if (msg?.type === 'configUpdated') {
        setState(s => ({
          ...s,
          config: msg.config,
          activeGroupId: msg.activeGroupId ?? s.activeGroupId,
          groupStatuses: msg.groupStatuses ?? s.groupStatuses,
          isRunning: !!msg.isRunning,
        }));
      }
      if (msg?.type === 'closeGroupForm') {
        // Dispatch a custom event to let App close its modal
        window.dispatchEvent(new CustomEvent('iw:closeGroupForm'));
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return <App state={state} setState={setState} />;
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Root />);
}
/// <reference path="./react-shim.d.ts" />
