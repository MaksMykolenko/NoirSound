import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToastStore } from '../toastStore';

describe('useToastStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.setState({ toasts: [] });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('deduplicates identical visible messages', () => {
    const { addToast } = useToastStore.getState();

    addToast('Network error', 'error');
    addToast('Network error', 'error');

    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('caps the visible notification stack at three messages', () => {
    const { addToast } = useToastStore.getState();

    addToast('One');
    addToast('Two');
    addToast('Three');
    addToast('Four');

    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toEqual([
      'Two',
      'Three',
      'Four',
    ]);
  });
});
