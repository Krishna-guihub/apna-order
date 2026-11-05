import { useEffect, useRef } from 'react';

export function usePolling(callback, intervalMs = 5000, enabled = true) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    let busy = false;

    const tick = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        await savedCallback.current();
      } finally {
        busy = false;
      }
    };

    tick();
    const timer = window.setInterval(tick, intervalMs);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [intervalMs, enabled]);
}
