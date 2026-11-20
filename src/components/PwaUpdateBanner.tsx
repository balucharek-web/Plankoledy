import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

/**
 * Monitors the production Service Worker for newly deployed versions (e.g. after GitHub Pages sync)
 * and offers a clean 1-tap reload so installed Android/iOS PWAs never linger on stale cached builds.
 */
export const PwaUpdateBanner: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (
      import.meta.env.DEV ||
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator)
    ) {
      return;
    }

    let cancelled = false;
    let activeRegistration: ServiceWorkerRegistration | null = null;
    const hadControllerAtStart = Boolean(navigator.serviceWorker.controller);

    const markReady = (worker: ServiceWorker | null) => {
      if (cancelled) return;
      setWaitingWorker(worker);
      setUpdateAvailable(true);
      setDismissed(false);
    };

    const watchRegistration = (reg: ServiceWorkerRegistration) => {
      activeRegistration = reg;
      if (reg.waiting && hadControllerAtStart) {
        markReady(reg.waiting);
      }

      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (
            installing.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            markReady(reg.waiting ?? installing);
          }
        });
      });
    };

    const handleControllerChange = () => {
      if (!hadControllerAtStart) return;
      markReady(null);
    };

    navigator.serviceWorker.addEventListener(
      'controllerchange',
      handleControllerChange
    );

    void navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (!reg || cancelled) return;
        watchRegistration(reg);
        void reg.update().catch(() => {});
      })
      .catch(() => {});

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible' && activeRegistration) {
        void activeRegistration.update().catch(() => {});
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        handleControllerChange
      );
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, []);

  if (!updateAvailable || dismissed) return null;

  const handleApplyUpdate = () => {
    if (waitingWorker) {
      try {
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      } catch {
        // Fallback straight to reload
      }
    }
    window.setTimeout(() => {
      window.location.reload();
    }, 120);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print fixed top-3 left-1/2 -translate-x-1/2 z-[1400] w-[calc(100%-24px)] max-w-md bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700/80 px-3.5 py-2.5 flex items-center justify-between gap-2.5"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <RefreshCw className="w-4 h-4 text-amber-400 shrink-0" />
        <div className="min-w-0">
          <div className="text-xs font-semibold leading-tight">
            Dostępna nowa wersja aplikacji
          </div>
          <div className="text-[11px] text-slate-300 truncate mt-0.5">
            Odśwież, aby wczytać najnowsze poprawki
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={handleApplyUpdate}
          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold whitespace-nowrap transition-colors"
        >
          Odśwież
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Zamknij powiadomienie o aktualizacji"
          className="min-w-[34px] min-h-[36px] inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
