import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.restoreAllMocks());

it('loads the shared player and operates its controls when browser storage is denied', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Storage denied', 'SecurityError'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Storage denied', 'SecurityError'); });
  const { usePlayerStore } = await import('../playerStore');
  expect(usePlayerStore.getState().isPlayerCollapsed).toBe(false);
  expect(() => usePlayerStore.getState().collapsePlayer()).not.toThrow();
  expect(usePlayerStore.getState().isPlayerCollapsed).toBe(true);
  expect(() => usePlayerStore.getState().expandPlayer()).not.toThrow();
  expect(usePlayerStore.getState().isPlayerCollapsed).toBe(false);
  expect(() => usePlayerStore.getState().togglePlayerCollapsed()).not.toThrow();
  expect(usePlayerStore.getState().isPlayerCollapsed).toBe(true);
});
