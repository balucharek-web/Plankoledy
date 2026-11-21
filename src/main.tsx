import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { triggerSingleChunkRecoveryReload } from './utils/lazyRetry';

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    triggerSingleChunkRecoveryReload();
  });

  const recoverFromFirestoreAssertion = (message: string) => {
    if (!message.includes('INTERNAL ASSERTION FAILED')) return false;
    const key = 'pk_firestore_assert_reload_ts';
    try {
      const now = Date.now();
      const last = Number(window.sessionStorage.getItem(key) ?? '0');
      if (Number.isFinite(last) && now - last < 30_000) return false;
      window.sessionStorage.setItem(key, String(now));
      window.location.reload();
      return true;
    } catch {
      return false;
    }
  };

  window.addEventListener('error', (event) => {
    const msg =
      event.error instanceof Error
        ? event.error.message
        : String(event.message ?? '');
    if (recoverFromFirestoreAssertion(msg)) {
      event.preventDefault();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg =
      reason instanceof Error ? reason.message : String(reason ?? '');
    if (recoverFromFirestoreAssertion(msg)) {
      event.preventDefault();
    }
  });
}

// Tier 1 Demo Key quota and auth monitoring
(window as any).gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};

const origError = console.error;
console.error = (...args: unknown[]) => {
  origError.apply(console, args);
  const msg = args.map((a) => String(a)).join(' ');
  if (
    msg.includes('OverQuotaMapError') ||
    msg.includes('QuotaExceededError')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
};

if (import.meta.env.DEV && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  void navigator.serviceWorker
    .getRegistrations()
    .then(async (registrations) => {
      if (registrations.length === 0) return;
      await Promise.all(registrations.map((registration) => registration.unregister()));

      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => key.startsWith('workbox-precache'))
            .map((key) => caches.delete(key))
        );
      }

      if (hadController && !window.sessionStorage.getItem('pk_dev_sw_cleaned')) {
        window.sessionStorage.setItem('pk_dev_sw_cleaned', '1');
        window.location.reload();
      }
    })
    .catch(() => {});
}

createRoot(document.getElementById('root')!).render(<App />);
