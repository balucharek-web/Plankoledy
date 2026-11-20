import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth } from 'firebase/auth';
import {
  Firestore,
  doc,
  enableNetwork,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

function createFirestoreInstance(): Firestore {
  try {
    return initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true,
        experimentalLongPollingOptions: {
          timeoutSeconds: 15,
        },
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db = createFirestoreInstance();
export const auth = getAuth(app);
auth.languageCode = 'pl';
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const FIREBASE_CONSOLE_UPGRADE_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void enableNetwork(db).catch(() => {});
  });
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine !== false) {
        void enableNetwork(db).catch(() => {});
      }
    });
  }
}

function waitForForegroundAndReady(): Promise<void> {
  const waitVisible = (): Promise<void> => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const onVis = () => {
        if (document.visibilityState === 'visible') {
          document.removeEventListener('visibilitychange', onVis);
          // Give mobile browsers a moment to restore sockets after waking from background
          setTimeout(resolve, 400);
        }
      };
      document.addEventListener('visibilitychange', onVis);
    });
  };

  const waitLoaded = (): Promise<void> => {
    if (typeof document === 'undefined' || document.readyState === 'complete') {
      return new Promise((resolve) => setTimeout(resolve, 300));
    }
    return new Promise((resolve) => {
      const done = () => {
        window.removeEventListener('load', done);
        clearTimeout(timer);
        setTimeout(resolve, 250);
      };
      const timer = setTimeout(done, 1500);
      window.addEventListener('load', done, { once: true });
    });
  };

  return waitLoaded().then(waitVisible);
}

async function testConnection(): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return;
  }

  // Skip probing on the transient page load where a stale dev Service Worker is being evicted
  if (
    import.meta.env.DEV &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    navigator.serviceWorker.controller
  ) {
    return;
  }

  await waitForForegroundAndReady();

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return;
  }

  const retryDelaysMs = [2500, 4500];

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
      return;
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code ?? '')
          : '';
      const msg = error instanceof Error ? error.message : String(error ?? '');

      // Reaching Firestore rules (permission-denied) confirms backend connectivity is healthy
      if (code === 'permission-denied') {
        return;
      }

      const isOffline =
        code === 'unavailable' ||
        msg.includes('the client is offline') ||
        msg.includes('Could not reach Cloud Firestore backend');

      if (!isOffline) {
        return;
      }

      if (attempt < retryDelaysMs.length) {
        await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]));
        if (
          (typeof navigator !== 'undefined' && navigator.onLine === false) ||
          (typeof document !== 'undefined' && document.visibilityState !== 'visible')
        ) {
          return;
        }
        await enableNetwork(db).catch(() => {});
        continue;
      }

      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

