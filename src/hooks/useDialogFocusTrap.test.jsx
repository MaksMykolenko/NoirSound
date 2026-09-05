import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useDialogFocusTrap from './useDialogFocusTrap';
import ContextMenuProvider from '../components/context-menu/ContextMenuProvider';
import useContextMenu from './useContextMenu';

function Dialog({ name, onClose, children, layer = 100 }) {
  const ref = useDialogFocusTrap(true, onClose);
  return <section ref={ref} role="dialog" aria-modal="true" aria-label={name} style={{ zIndex: layer }}>
    <button>{name} first</button>
    <button style={{ display: 'none' }}>Hidden control</button>
    {children}
    <button>{name} last</button>
  </section>;
}

function MenuTrigger() {
  const { openFromButton } = useContextMenu([{ id: 'play', label: 'Play', onSelect: vi.fn() }]);
  return <button onClick={openFromButton}>Open actions</button>;
}

describe('dialog focus and overlay priority', () => {
  afterEach(cleanup);

  it('closes a nested context menu before its queue dialog', async () => {
    const closeQueue = vi.fn();
    render(<ContextMenuProvider><Dialog name="Queue" onClose={closeQueue} layer={0}><MenuTrigger /></Dialog></ContextMenuProvider>);
    await waitFor(() => expect(screen.getByText('Queue first')).toHaveFocus());
    fireEvent.click(screen.getByText('Open actions'));
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(closeQueue).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('Open actions')).toHaveFocus());
    fireEvent.keyDown(screen.getByText('Open actions'), { key: 'Escape' });
    expect(closeQueue).toHaveBeenCalledOnce();
  });

  it('lets the higher confirmation dialog handle Escape without closing the underlying one', async () => {
    const closeQueue = vi.fn();
    const closeConfirmation = vi.fn();
    render(<><Dialog name="Queue" onClose={closeQueue} /><Dialog name="Confirmation" onClose={closeConfirmation} layer={260} /></>);
    await waitFor(() => expect(screen.getByText('Confirmation first')).toHaveFocus());
    fireEvent.keyDown(screen.getByText('Confirmation first'), { key: 'Escape' });
    expect(closeConfirmation).toHaveBeenCalledOnce();
    expect(closeQueue).not.toHaveBeenCalled();
  });

  it('keeps focus through callback changes and wraps around visible controls only', async () => {
    const latestClose = vi.fn();
    const { rerender } = render(<Dialog name="Editor" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Editor first')).toHaveFocus());
    screen.getByText('Editor last').focus();
    rerender(<Dialog name="Editor" onClose={() => latestClose()} />);
    expect(screen.getByText('Editor last')).toHaveFocus();
    fireEvent.keyDown(screen.getByText('Editor last'), { key: 'Tab' });
    expect(screen.getByText('Editor first')).toHaveFocus();
    fireEvent.keyDown(screen.getByText('Editor first'), { key: 'Tab', shiftKey: true });
    expect(screen.getByText('Editor last')).toHaveFocus();
    fireEvent.keyDown(screen.getByText('Editor last'), { key: 'Escape' });
    expect(latestClose).toHaveBeenCalledOnce();
  });

  it('excludes inactive roving-tab controls from the native Tab cycle', () => {
    function RovingDialog() {
      const ref = useDialogFocusTrap(true, vi.fn());
      return <section ref={ref} role="dialog" aria-modal="true">
        <button>Close filter</button>
        <button tabIndex={-1}>Inactive previous option</button>
        <button tabIndex={0}>Selected option</button>
        <button tabIndex={-1}>Inactive next option</button>
      </section>;
    }
    render(<RovingDialog />);
    screen.getByText('Selected option').focus();
    fireEvent.keyDown(screen.getByText('Selected option'), { key: 'Tab' });
    expect(screen.getByText('Close filter')).toHaveFocus();
    fireEvent.keyDown(screen.getByText('Close filter'), { key: 'Tab', shiftKey: true });
    expect(screen.getByText('Selected option')).toHaveFocus();
  });

  it('honors React autofocus and restores an opener remounted after the dialog closes', () => {
    function Confirmation({ onClose }) {
      const ref = useDialogFocusTrap(true, onClose);
      return <section ref={ref} role="dialog" aria-modal="true">
        <button>Close icon</button>
        <button autoFocus>Cancel</button>
        <button>Confirm action</button>
      </section>;
    }
    function Harness() {
      const [open, setOpen] = useState(false);
      return open
        ? <Confirmation onClose={() => setOpen(false)} />
        : <button aria-label="Open confirmation" onClick={() => setOpen(true)}>Open confirmation</button>;
    }
    render(<Harness />);
    const originalOpener = screen.getByRole('button', { name: 'Open confirmation' });
    originalOpener.focus();
    fireEvent.click(originalOpener);
    expect(originalOpener).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    const remountedOpener = screen.getByRole('button', { name: 'Open confirmation' });
    expect(remountedOpener).not.toBe(originalOpener);
    expect(remountedOpener).toHaveFocus();
  });

  it('returns to lyrics when remounting a mobile player that has its own focus trap', () => {
    function Player({ onLyrics }) {
      const ref = useDialogFocusTrap(true, vi.fn());
      return <section ref={ref} role="dialog" aria-modal="true" aria-label="Player">
        <button>Collapse player</button>
        <button aria-label="Open lyrics" onClick={onLyrics}>Open lyrics</button>
        <button aria-label="Open queue">Open queue</button>
      </section>;
    }
    function Fullscreen({ onClose }) {
      const [queueOpen, setQueueOpen] = useState(false);
      const ref = useDialogFocusTrap(true, onClose);
      const queueRef = useDialogFocusTrap(queueOpen, () => setQueueOpen(false));
      return <section ref={ref} role="dialog" aria-modal="true" aria-label="Lyrics" style={{ zIndex: 200 }}>
        <button>Close lyrics</button>
        <button aria-label="Open queue" onClick={() => setQueueOpen(true)}>Open queue</button>
        {queueOpen && <section ref={queueRef} role="dialog" aria-modal="true" aria-label="Queue" style={{ zIndex: 220 }}><button>Close queue</button></section>}
      </section>;
    }
    function Harness() {
      const [lyricsOpen, setLyricsOpen] = useState(false);
      return lyricsOpen ? <Fullscreen onClose={() => setLyricsOpen(false)} /> : <Player onLyrics={() => setLyricsOpen(true)} />;
    }
    render(<React.StrictMode><Harness /></React.StrictMode>);
    const opener = screen.getByRole('button', { name: 'Open lyrics' });
    opener.focus();
    fireEvent.click(opener);
    const queueOpener = screen.getByRole('button', { name: 'Open queue' });
    queueOpener.focus();
    fireEvent.click(queueOpener);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(queueOpener).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Open lyrics' })).toHaveFocus();
  });

  it('restores the opener and existing body scroll styles after nested dialogs close', async () => {
    document.body.style.overflow = 'auto';
    function Harness() {
      const [open, setOpen] = useState(false);
      const [nested, setNested] = useState(false);
      return <><button onClick={() => setOpen(true)}>Open editor</button>{open && <Dialog name="Editor" onClose={() => setOpen(false)}>
        <button onClick={() => setNested(true)}>Open confirmation</button>
        {nested && <Dialog name="Confirmation" layer={260} onClose={() => setNested(false)} />}
      </Dialog>}</>;
    }
    render(<Harness />);
    screen.getByText('Open editor').focus();
    fireEvent.click(screen.getByText('Open editor'));
    await waitFor(() => expect(screen.getByText('Editor first')).toHaveFocus());
    screen.getByText('Open confirmation').focus();
    fireEvent.click(screen.getByText('Open confirmation'));
    await waitFor(() => expect(screen.getByText('Confirmation first')).toHaveFocus());
    fireEvent.keyDown(screen.getByText('Confirmation first'), { key: 'Escape' });
    await waitFor(() => expect(screen.getByText('Open confirmation')).toHaveFocus());
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(screen.getByText('Open confirmation'), { key: 'Escape' });
    await waitFor(() => expect(screen.getByText('Open editor')).toHaveFocus());
    expect(document.body.style.overflow).toBe('auto');
    document.body.style.overflow = '';
  });
});
