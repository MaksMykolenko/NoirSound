import React, { useRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useLandingMotion from '../../src/hooks/useLandingMotion';
function Harness() {
  const root = useRef(null);
  const motion = useLandingMotion(root);
  return <div ref={root}><button aria-pressed={motion.enabled} onClick={motion.toggle}>Motion</button><p data-reveal>Readable content</p></div>;
}
let media; let changes; let frames;
beforeEach(() => {
  localStorage.clear(); frames = new Map(); changes = new Set();
  media = { matches: false, addEventListener: vi.fn((_, cb) => changes.add(cb)), removeEventListener: vi.fn((_, cb) => changes.delete(cb)) };
  vi.stubGlobal('matchMedia', () => media);
  vi.stubGlobal('requestAnimationFrame', vi.fn(cb => { const id = frames.size + 1; frames.set(id, cb); return id; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn(id => frames.delete(id)));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('landing motion lifecycle', () => {
  it('persists an explicit off choice and obeys live device preference changes', () => {
    const { unmount } = render(<Harness />);
    const button = screen.getByRole('button', { name: 'Motion' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    act(() => { media.matches = true; changes.forEach(cb => cb()); });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'false');
    act(() => { media.matches = false; changes.forEach(cb => cb()); });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    unmount(); render(<Harness />);
    expect(screen.getByRole('button', { name: 'Motion' })).toHaveAttribute('aria-pressed', 'false');
  });
  it('keeps the control and content usable when preference storage is denied', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    const view = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Motion' }));
    expect(screen.getByRole('button', { name: 'Motion' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Readable content')).toBeVisible();
    view.unmount(); get.mockRestore(); set.mockRestore();
  });
  it('releases scroll listeners, media listeners, observers and queued callbacks at unmount', () => {
    const disconnect = vi.fn();
    vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() { disconnect(); } });
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() { disconnect(); } });
    const add = vi.spyOn(window, 'addEventListener'); const remove = vi.spyOn(window, 'removeEventListener');
    const view = render(<React.StrictMode><Harness /></React.StrictMode>);
    view.unmount();
    for (const event of ['scroll', 'resize', 'pageshow']) {
      for (const [, listener] of add.mock.calls.filter(([name]) => name === event)) expect(remove).toHaveBeenCalledWith(event, listener);
    }
    expect(changes.size).toBe(0); expect(frames.size).toBe(0); expect(disconnect).toHaveBeenCalled();
    add.mockRestore(); remove.mockRestore();
  });
  it('falls back to usable content and motion off if observer initialization throws, then releases all callbacks', () => {
    const initialize = vi.fn();
    vi.stubGlobal('IntersectionObserver', class {
      constructor() { initialize(); throw new Error('Observer unavailable'); }
    });
    const addWindow = vi.spyOn(window, 'addEventListener');
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    const addDocument = vi.spyOn(document, 'addEventListener');
    const removeDocument = vi.spyOn(document, 'removeEventListener');
    const view = render(<Harness />);
    const button = screen.getByRole('button', { name: 'Motion' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Readable content')).toBeVisible();
    expect(initialize).toHaveBeenCalledTimes(1);
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(localStorage.getItem('noirsound-landing-motion')).toBe('off');
    fireEvent.scroll(window);
    expect(initialize).toHaveBeenCalledTimes(1);
    view.unmount();
    for (const event of ['scroll', 'resize', 'pageshow']) {
      for (const [, listener] of addWindow.mock.calls.filter(([name]) => name === event)) expect(removeWindow).toHaveBeenCalledWith(event, listener);
    }
    for (const [, listener] of addDocument.mock.calls.filter(([name]) => name === 'visibilitychange')) expect(removeDocument).toHaveBeenCalledWith('visibilitychange', listener);
    expect(changes.size).toBe(0);
    expect(frames.size).toBe(0);
    const scheduledBefore = requestAnimationFrame.mock.calls.length;
    fireEvent.scroll(window);
    fireEvent(window, new Event('pageshow'));
    fireEvent(document, new Event('visibilitychange'));
    expect(requestAnimationFrame.mock.calls.length).toBe(scheduledBefore);
  });
  it('does not rerender the React owner while processing ordinary scroll frames', () => {
    let renders = 0;
    function ScrollHarness() {
      renders += 1;
      const root = useRef(null);
      useLandingMotion(root);
      return <div ref={root}><p>Content remains interactive</p></div>;
    }
    const view = render(<ScrollHarness />);
    const initialRenders = renders;
    for (let index = 0; index < 4; index += 1) {
      fireEvent.scroll(window);
      act(() => {
        const pending = [...frames.values()];
        frames.clear();
        pending.forEach(callback => callback(index * 16));
      });
    }
    expect(renders).toBe(initialRenders);
    view.unmount();
    expect(frames.size).toBe(0);
  });
});
