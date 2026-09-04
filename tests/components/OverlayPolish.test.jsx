import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import { ReportDialog } from '../../src/components/ui/ReportButton';
import GenrePicker from '../../src/components/ui/GenrePicker';
import useDialogFocusTrap from '../../src/hooks/useDialogFocusTrap';
import { submitReport } from '../../src/api/moderation';

vi.mock('../../src/api/moderation', () => ({
  REPORT_REASONS: ['COPYRIGHT', 'SPAM', 'OTHER'],
  submitReport: vi.fn(),
}));

describe('polished report and genre overlays', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it('labels report fields and returns keyboard focus when Escape closes the dialog', async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>Report this release</button>
        {open && <ReportDialog targetType="TRACK" targetId="track-1" onClose={() => setOpen(false)} />}</>;
    }
    render(<Harness />);
    const opener = screen.getByText('Report this release');
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('Report content');
    expect(within(dialog).getByRole('combobox', { name: 'Reason' })).toHaveFocus();
    expect(within(dialog).getByRole('textbox', { name: 'Details (optional)' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('retains modal keyboard containment while a report submission is pending', async () => {
    let resolveSubmit;
    vi.mocked(submitReport).mockImplementation(() => new Promise((resolve) => { resolveSubmit = resolve; }));
    const onClose = vi.fn();
    render(<ReportDialog targetType="TRACK" targetId="track-1" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    const details = screen.getByRole('textbox', { name: 'Details (optional)' });
    details.focus();
    fireEvent.keyDown(details, { key: 'Tab' });
    expect(screen.getByRole('combobox', { name: 'Reason' })).toHaveFocus();
    resolveSubmit({ id: 'report-1' });
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('keeps a portaled genre list open when scrolled and closes it before its parent dialog', () => {
    const closeParent = vi.fn();
    function Harness() {
      const dialogRef = useDialogFocusTrap(true, closeParent);
      return <section ref={dialogRef} role="dialog" aria-modal="true" aria-label="Upload settings" style={{ zIndex: 260 }}>
        <GenrePicker ariaLabel="Primary genre" value="" onChange={vi.fn()} />
      </section>;
    }
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Primary genre' });
    fireEvent.click(trigger);
    const list = screen.getByRole('listbox', { name: 'Primary genre' });
    fireEvent.scroll(list);
    expect(list).toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId('genre-search'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(closeParent).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(closeParent).toHaveBeenCalledOnce();
  });
});
