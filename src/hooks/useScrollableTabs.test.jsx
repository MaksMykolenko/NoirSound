import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useScrollableTabs from './useScrollableTabs';

function Harness({ activeKey }) {
  const tabsRef = useScrollableTabs(activeKey);
  return (
    <div ref={tabsRef} data-testid="tabs">
      <button type="button" aria-selected={activeKey === 'first'}>First</button>
      <button type="button" aria-selected={activeKey === 'second'}>Second</button>
    </div>
  );
}

describe('useScrollableTabs', () => {
  const originalScrollIntoView = Element.prototype.scrollIntoView;
  const originalScrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
  const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  const scrolledElements = [];

  beforeEach(() => {
    scrolledElements.length = 0;
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(function scrollIntoView(options) {
        scrolledElements.push({ element: this, options });
      }),
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() { return this.dataset.testid === 'tabs' ? 300 : 0; },
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() { return this.dataset.testid === 'tabs' ? 100 : 0; },
    });
    vi.stubGlobal('requestAnimationFrame', (callback) => {
      callback();
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('ResizeObserver', class ResizeObserver {
      observe() {}
      disconnect() {}
    });
  });

  afterEach(() => {
    if (originalScrollIntoView) {
      Object.defineProperty(Element.prototype, 'scrollIntoView', {
        configurable: true,
        value: originalScrollIntoView,
      });
    } else {
      delete Element.prototype.scrollIntoView;
    }
    if (originalScrollWidth) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', originalScrollWidth);
    if (originalClientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
    vi.unstubAllGlobals();
  });

  it('keeps the selected tab visible and exposes overflow edge state', () => {
    const { rerender } = render(<Harness activeKey="first" />);
    const tabs = screen.getByTestId('tabs');

    expect(scrolledElements.at(-1)).toMatchObject({
      element: screen.getByRole('button', { name: 'First' }),
      options: { block: 'nearest', inline: 'nearest' },
    });
    expect(tabs).toHaveAttribute('data-overflowing', 'true');
    expect(tabs).toHaveAttribute('data-at-start', 'true');
    expect(tabs).toHaveAttribute('data-at-end', 'false');

    act(() => { tabs.scrollLeft = 200; });
    fireEvent.scroll(tabs);
    expect(tabs).toHaveAttribute('data-at-start', 'false');
    expect(tabs).toHaveAttribute('data-at-end', 'true');

    rerender(<Harness activeKey="second" />);
    expect(scrolledElements.at(-1)).toMatchObject({
      element: screen.getByRole('button', { name: 'Second' }),
      options: { block: 'nearest', inline: 'nearest' },
    });
  });
});
