import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ContextMenuProvider from '../ContextMenuProvider';
import useContextMenu from '../../../hooks/useContextMenu';

function Harness({ firstAction, secondAction }) {
  const { contextMenuProps, openFromButton } = useContextMenu([
    { id: 'first', label: 'First action', onSelect: firstAction },
    { id: 'disabled', label: 'Unavailable action', disabled: true },
    { id: 'second', label: 'Second action', onSelect: secondAction },
  ], [firstAction, secondAction]);

  return (
    <div onContextMenu={contextMenuProps.onContextMenu}>
      <button
        type="button"
        {...contextMenuProps}
        onClick={openFromButton}
      >
        Target
      </button>
      <input aria-label="Editable field" />
    </div>
  );
}

describe('ContextMenu', () => {
  afterEach(cleanup);

  it('opens from right click, skips disabled items with arrows, invokes, and restores focus', async () => {
    const firstAction = vi.fn();
    const secondAction = vi.fn();
    render(
      <ContextMenuProvider>
        <Harness firstAction={firstAction} secondAction={secondAction} />
      </ContextMenuProvider>
    );
    const target = screen.getByRole('button', { name: 'Target' });
    target.focus();
    fireEvent.contextMenu(target, { clientX: 40, clientY: 50 });

    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'Enter' });

    expect(firstAction).not.toHaveBeenCalled();
    expect(secondAction).toHaveBeenCalledOnce();
    await waitFor(() => expect(target).toHaveFocus());
  });

  it('opens with Shift+F10 and closes with Escape', async () => {
    render(
      <ContextMenuProvider>
        <Harness firstAction={vi.fn()} secondAction={vi.fn()} />
      </ContextMenuProvider>
    );
    const target = screen.getByRole('button', { name: 'Target' });
    target.focus();
    fireEvent.keyDown(target, { key: 'F10', shiftKey: true });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    await waitFor(() => expect(target).toHaveFocus());
  });

  it('preserves the native context menu on editable controls', () => {
    render(
      <ContextMenuProvider>
        <Harness firstAction={vi.fn()} secondAction={vi.fn()} />
      </ContextMenuProvider>
    );
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    screen.getByRole('textbox', { name: 'Editable field' }).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('clamps the desktop menu inside the viewport', async () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 260,
        bottom: 400,
        width: 260,
        height: 400,
        toJSON: () => ({}),
      });
    render(
      <ContextMenuProvider>
        <Harness firstAction={vi.fn()} secondAction={vi.fn()} />
      </ContextMenuProvider>
    );
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Target' }), {
      clientX: window.innerWidth - 1,
      clientY: window.innerHeight - 1,
    });
    const menu = screen.getByRole('menu');
    await waitFor(() => {
      expect(Number.parseFloat(menu.style.left)).toBeLessThanOrEqual(window.innerWidth - 270);
      expect(Number.parseFloat(menu.style.top)).toBeLessThanOrEqual(window.innerHeight - 410);
    });
    rectSpy.mockRestore();
  });
});
