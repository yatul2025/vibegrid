/**
 * client/src/__tests__/setup.js
 * =============================
 * Global test environment configuration for Vitest
 * 
 * Provides mock handlers for Node 20's global fetch so relative API calls
 * during component integration tests resolve cleanly without URL parse errors.
 */

import { beforeEach, afterEach, vi } from 'vitest';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn(async (url, init) => {
    if (typeof url === 'string' && (url.startsWith('/api') || url.includes('localhost'))) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [] }),
        text: async () => JSON.stringify({ success: true, data: [] }),
        headers: new Headers({ 'Content-Type': 'application/json' })
      };
    }
    return originalFetch ? originalFetch(url, init) : { ok: true, json: async () => ({}) };
  });
});

afterEach(() => {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  }
});
