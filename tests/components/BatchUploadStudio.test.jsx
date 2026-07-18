import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import BatchFileDropzone from '../../src/components/upload/batch/BatchFileDropzone';
import BatchPlaylistEditor from '../../src/components/upload/batch/BatchPlaylistEditor';
import BatchTrackSettingsDrawer from '../../src/components/upload/batch/BatchTrackSettingsDrawer';

function item(overrides = {}) {
  return {
    id: 'item-1',
    clientId: 'local-1',
    fileName: 'midnight_signal.wav',
    fileSize: 2048,
    mimeType: 'audio/wav',
    status: 'DRAFT',
    target: 'PLAYLIST',
    playlistOrder: 1,
    title: 'Midnight Signal',
    primaryArtistName: 'Noir Artist',
    featuredArtists: [],
    genre: null,
    tags: [],
    description: '',
    explicit: false,
    visibility: 'PUBLIC',
    copyrightConfirmed: false,
    missingFields: ['genre', 'copyrightConfirmed'],
    ...overrides,
  };
}

describe('Batch Upload Studio components', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('accepts multiple audio files through the picker and shows staging rows', async () => {
    const onFiles = vi.fn();
    const user = userEvent.setup();
    const view = render(
      <BatchFileDropzone
        stagedFiles={[]}
        onFiles={onFiles}
        onRemove={vi.fn()}
        onCreate={vi.fn()}
        creating={false}
        mode="MIXED"
        onModeChange={vi.fn()}
      />
    );
    const files = [
      new File(['wav'], 'first_track.wav', { type: 'audio/wav' }),
      new File(['mp3'], 'second_track.mp3', { type: 'audio/mpeg' }),
    ];
    await user.upload(screen.getByLabelText('Select files'), files);
    expect(onFiles).toHaveBeenCalledWith(files);

    view.rerender(
      <BatchFileDropzone
        stagedFiles={files.map((file, index) => ({ clientId: `c-${index}`, file }))}
        onFiles={onFiles}
        onRemove={vi.fn()}
        onCreate={vi.fn()}
        creating={false}
        mode="MIXED"
        onModeChange={vi.fn()}
      />
    );
    expect(screen.getByText('first_track.wav')).toBeInTheDocument();
    expect(screen.getByText('second_track.mp3')).toBeInTheDocument();
  });

  it('keeps localized batch modes intact and uses mobile-safe select typography', async () => {
    await i18n.changeLanguage('uk');
    const onModeChange = vi.fn();
    const user = userEvent.setup();
    const stagedFile = new File(['wav'], 'нічний_трек.wav', { type: 'audio/wav' });

    render(
      <BatchFileDropzone
        stagedFiles={[{ clientId: 'localized-track', file: stagedFile }]}
        onFiles={vi.fn()}
        onRemove={vi.fn()}
        onCreate={vi.fn()}
        creating={false}
        mode="MIXED"
        onModeChange={onModeChange}
      />
    );

    const modeSelect = screen.getByRole('combobox', { name: i18n.t('batchUpload.batchMode') });
    expect(modeSelect).toHaveClass('text-base', 'sm:text-sm');
    expect([...modeSelect.options].map(({ value, textContent }) => [value, textContent])).toEqual([
      ['MIXED', i18n.t('batchUpload.mixed')],
      ['SINGLES_ONLY', i18n.t('batchUpload.singlesOnly')],
      ['PLAYLIST', i18n.t('batchUpload.playlistOnly')],
    ]);

    await user.selectOptions(modeSelect, 'PLAYLIST');
    expect(onModeChange).toHaveBeenCalledWith('PLAYLIST');
  });

  it('renders playlist placeholders and opens a clicked playlist track', async () => {
    const onOpenTrack = vi.fn();
    const user = userEvent.setup();
    render(
      <BatchPlaylistEditor
        batch={{
          playlist: { title: '', description: '', visibility: 'PUBLIC', tags: [], hasCover: false },
          creator: { displayName: 'Noir Artist' },
          items: [item()],
        }}
        onSave={vi.fn()}
        onOpenTrack={onOpenTrack}
        saving={false}
      />
    );
    expect(screen.getByPlaceholderText('Untitled playlist')).toBeInTheDocument();
    expect(screen.getByText('Midnight Signal')).toBeInTheDocument();
    await user.click(screen.getByText('Midnight Signal'));
    expect(onOpenTrack).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-1' }));
  });

  it('saves full per-track settings and keeps genre labels English under Ukrainian UI', async () => {
    await i18n.changeLanguage('uk');
    const onSave = vi.fn().mockResolvedValue();
    const user = userEvent.setup();
    render(
      <BatchTrackSettingsDrawer
        item={item()}
        open
        onClose={vi.fn()}
        onSave={onSave}
        saving={false}
      />
    );

    await user.click(screen.getByTestId('genre-picker-trigger'));
    const hipHop = screen.getByTestId('genre-picker-panel').querySelector('[data-genre-option="hip_hop"]');
    expect(hipHop).toHaveTextContent('Hip-Hop');
    expect(hipHop).not.toHaveTextContent('Хіп-хоп');
    fireEvent.click(hipHop);
    await user.click(screen.getByRole('button', { name: 'Права' }));
    await user.click(screen.getByRole('checkbox', { name: /володію|контролюю/i }));
    await user.click(screen.getByRole('button', { name: /зберегти чернетку/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Midnight Signal',
        genre: 'hip_hop',
        copyrightConfirmed: true,
        target: 'PLAYLIST',
      }),
      null
    ));
  });

  it('updates the live playlist title and preserves accessible order controls', async () => {
    const user = userEvent.setup();
    render(
      <BatchPlaylistEditor
        batch={{
          playlist: { title: '', description: '', visibility: 'PUBLIC', tags: [], hasCover: false },
          creator: { displayName: 'Noir Artist' },
          items: [item(), item({ id: 'item-2', title: 'Second Signal', playlistOrder: 2 })],
        }}
        onSave={vi.fn()}
        onOpenTrack={vi.fn()}
        saving={false}
      />
    );
    const title = screen.getByLabelText('Playlist title');
    await user.type(title, 'Night Drive');
    expect(title).toHaveValue('Night Drive');
    expect(screen.getAllByRole('button', { name: 'Move track down' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Move track up' })).toHaveLength(2);
  });

  it('edits lyrics in the batch drawer and keeps a separate lyrics rights confirmation', async () => {
    const onSave = vi.fn().mockResolvedValue();
    const user = userEvent.setup();
    render(
      <BatchTrackSettingsDrawer
        item={item()}
        open
        onClose={vi.fn()}
        onSave={onSave}
        saving={false}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Lyrics' }));
    await user.type(screen.getByPlaceholderText(i18n.t('lyrics.textPlaceholder')), 'Batch original line');
    await user.type(screen.getByLabelText(i18n.t('lyrics.language')), 'en');
    await user.click(screen.getByRole('checkbox', { name: i18n.t('lyrics.rightsConfirm') }));
    await user.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        lyricsText: 'Batch original line',
        lyricsType: 'PLAIN',
        lyricsLanguage: 'en',
        lyricsRightsConfirmed: true,
      }),
      null
    ));
  });

  it('shows a lyrics badge in the playlist preview', () => {
    render(
      <BatchPlaylistEditor
        batch={{
          playlist: { title: 'Night Drive', description: '', visibility: 'PUBLIC', tags: [], hasCover: false },
          creator: { displayName: 'Noir Artist' },
          items: [item({ hasLyrics: true, lyricsRightsConfirmed: true })],
        }}
        onSave={vi.fn()}
        onOpenTrack={vi.fn()}
        saving={false}
      />
    );
    expect(screen.getByText(i18n.t('lyrics.title'))).toBeInTheDocument();
  });
});
