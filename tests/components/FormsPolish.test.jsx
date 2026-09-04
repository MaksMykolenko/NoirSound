import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import { ConfirmActionModal } from '../../src/components/admin/AdminUI';
import BatchTrackSettingsDrawer from '../../src/components/upload/batch/BatchTrackSettingsDrawer';
import ContentTypeSelector from '../../src/components/upload/ContentTypeSelector';

const track = {
  id: 'draft-long-title',
  title: 'Нічний сигнал — bardzo długa nazwa utworu 2026 / final mix',
  fileName: 'very-long-unbroken-filename-012345678901234567890123456789.mp3',
  fileSize: 2048,
  mimeType: 'audio/mpeg',
  status: 'FAILED',
  contentType: 'BEAT',
  target: 'SINGLE',
};

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(async () => { cleanup(); await act(() => i18n.changeLanguage('en')); });

describe('Form and moderation keyboard access', () => {
  it('traps moderation focus, keeps entered reason on rerender, and cancels with Escape', async () => {
    const close = vi.fn();
    const confirm = vi.fn();
    const { rerender } = render(<ConfirmActionModal open onClose={() => close()} onConfirm={confirm} actionLabel="Confirm" />);
    const dialog = screen.getByRole('dialog');
    const reason = within(dialog).getByRole('textbox');
    await waitFor(() => expect(dialog).toContainElement(document.activeElement));
    fireEvent.change(reason, { target: { value: 'A review reason retained while typing' } });
    rerender(<ConfirmActionModal open onClose={() => close()} onConfirm={confirm} actionLabel="Confirm" />);
    expect(reason).toHaveValue('A review reason retained while typing');
    const buttons = within(dialog).getAllByRole('button');
    buttons.at(-1).focus();
    fireEvent.keyDown(buttons.at(-1), { key: 'Tab' });
    expect(buttons[0]).toHaveFocus();
    fireEvent.keyDown(buttons[0], { key: 'Escape' });
    expect(close).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('keeps a failed batch item inspectable and closes its drawer without saving on Escape', async () => {
    const close = vi.fn();
    const save = vi.fn();
    render(<BatchTrackSettingsDrawer open item={track} onClose={close} onSave={save} saving={false} />);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: track.title })).toBeInTheDocument();
    expect(within(dialog).getByText(track.fileName)).toHaveAttribute('title', track.fileName);
    await waitFor(() => expect(dialog).toContainElement(document.activeElement));
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    expect(close).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
  });

  it('retains translated radio labels and their full label activation area', async () => {
    await i18n.changeLanguage('uk');
    const change = vi.fn();
    render(<ContentTypeSelector value="MUSIC" onChange={change} />);
    const beat = screen.getByRole('radio', { name: 'Біт' });
    fireEvent.click(beat.closest('label'));
    expect(change).toHaveBeenCalledWith('BEAT');
  });
});
