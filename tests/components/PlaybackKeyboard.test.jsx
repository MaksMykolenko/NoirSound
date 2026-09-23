import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import usePlaybackKeyboard from '../../src/hooks/usePlaybackKeyboard';
import { usePlayerStore } from '../../src/store/playerStore';

const initial = usePlayerStore.getState();
function Harness() {
  usePlaybackKeyboard();
  return <><main data-testid="page">Music</main><input aria-label="Search" /><button>Native button</button><div contentEditable suppressContentEditableWarning data-testid="editor">Draft</div></>;
}
beforeEach(() => usePlayerStore.setState({ currentTrack: { id: 'music' }, togglePlay: vi.fn() }));
afterEach(() => { cleanup(); usePlayerStore.setState(initial, true); });

it('toggles once from the page background and prevents Space scrolling', () => {
  render(<Harness />);
  expect(fireEvent.keyDown(screen.getByTestId('page'), { key: ' ', code: 'Space' })).toBe(false);
  fireEvent.keyDown(screen.getByTestId('page'), { key: ' ', code: 'Space', repeat: true });
  expect(usePlayerStore.getState().togglePlay).toHaveBeenCalledOnce();
});
it('leaves text entry, editable content, and native buttons alone', () => {
  render(<Harness />);
  for (const target of [screen.getByRole('textbox'), screen.getByRole('button'), screen.getByTestId('editor')]) {
    expect(fireEvent.keyDown(target, { key: ' ', code: 'Space' })).toBe(true);
  }
  expect(usePlayerStore.getState().togglePlay).not.toHaveBeenCalled();
});
it('keeps page scrolling without a selected track and removes its listener on unmount', () => {
  const { unmount } = render(<Harness />);
  usePlayerStore.setState({ currentTrack: null });
  expect(fireEvent.keyDown(document.body, { key: ' ', code: 'Space' })).toBe(true);
  unmount();
  usePlayerStore.setState({ currentTrack: { id: 'music' } });
  fireEvent.keyDown(document.body, { key: ' ', code: 'Space' });
  expect(usePlayerStore.getState().togglePlay).not.toHaveBeenCalled();
});
