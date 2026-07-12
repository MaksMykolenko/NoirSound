import { create } from 'zustand';

let toastSequence = 0;

export const useToastStore = create((set) => ({
  toasts: [],
  addToast: (message, type = 'info') => {
    const id = `${Date.now()}-${toastSequence += 1}`;
    set((state) => {
      const alreadyVisible = state.toasts.some(
        (toast) => toast.message === message && toast.type === type
      );
      if (alreadyVisible) return state;

      return {
        // Keep the notification region readable on compact screens even when
        // several parallel API requests fail at once.
        toasts: [...state.toasts, { id, message, type }].slice(-3),
      };
    });

    // Auto-remove after 3 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 3000);
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));
