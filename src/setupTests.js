import '@testing-library/jest-dom';

// jsdom has no ResizeObserver; Radix popovers (shadcn Tooltip) measure their
// trigger with it as soon as they open on focus or hover.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
