import { ComponentType, LazyExoticComponent, lazy } from 'react';

const RELOAD_COOLDOWN_KEY = 'pk_chunk_reload_ts';
const RELOAD_COOLDOWN_MS = 15_000;

function isDynamicImportFetchError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('ChunkLoadError')
  );
}

export function triggerSingleChunkRecoveryReload(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const now = Date.now();
    const lastReload = Number(
      window.sessionStorage.getItem(RELOAD_COOLDOWN_KEY) ?? '0'
    );
    if (Number.isFinite(lastReload) && now - lastReload < RELOAD_COOLDOWN_MS) {
      return false;
    }
    window.sessionStorage.setItem(RELOAD_COOLDOWN_KEY, String(now));
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

/**
 * Wraps React.lazy dynamic imports with automatic retry backoff for transient
 * mobile network drops or dev-server restarts, plus a guarded one-time reload
 * if a new deployment replaced hashed JS chunks while the tab was open.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  retryDelaysMs: number[] = [500, 1200]
): LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
      try {
        return await importer();
      } catch (error) {
        lastError = error;
        if (!isDynamicImportFetchError(error)) {
          throw error;
        }
        if (attempt < retryDelaysMs.length) {
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelaysMs[attempt])
          );
          continue;
        }
      }
    }

    if (isDynamicImportFetchError(lastError)) {
      const reloading = triggerSingleChunkRecoveryReload();
      if (reloading) {
        return new Promise<{ default: T }>(() => {
          // Keep Suspense fallback visible while the browser completes reload
        });
      }
    }

    throw lastError;
  });
}
