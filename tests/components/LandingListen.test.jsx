import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LandingListenSection from '../../src/components/landing/LandingListenSection';
import { usePlayerStore } from '../../src/store/playerStore';
import i18n from '../../src/i18n';
const { showcase } = vi.hoisted(() => ({ showcase: vi.fn() }));
vi.mock('../../src/api/tracks', () => ({ getLandingShowcase: showcase }));
vi.mock('../../src/hooks/useEntityContextMenu', () => ({ useTrackContextMenu: () => ({ contextMenuProps: {} }) }));
const music = { id: 'music', title: 'A real music release', artistName: 'Artist one', contentType: 'MUSIC', audioUrl: '/api/tracks/music/stream', isStreamable: true, duration: 81 };
const beat = { id: 'beat', title: 'A real beat', artistName: 'Artist two', contentType: 'BEAT', audioUrl: '/api/tracks/beat/stream', isStreamable: true, duration: 91, beatBpm: 94, beatKey: 'D Minor' };
let play;
let toggle;
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><LandingListenSection /></MemoryRouter></QueryClientProvider>);
}
beforeEach(async () => {
  await i18n.changeLanguage('en');
  play = vi.fn(); toggle = vi.fn();
  usePlayerStore.setState({ currentTrack: null, isPlaying: false, playTrack: play, togglePlay: toggle });
  showcase.mockReset();
});
describe('landing public listening', () => {
  it('switches real content and same-tab catalog destinations without starting playback', async () => {
    showcase.mockResolvedValue({ MUSIC: [music], BEAT: [beat] });
    const user = userEvent.setup(); show();
    const first = (await screen.findAllByRole('button', { name: `Play ${music.title}` }))[0];
    await user.hover(first);
    expect(play).not.toHaveBeenCalled();
    await user.click(screen.getByRole('tab', { name: 'Music' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Beats' })).toHaveFocus();
    expect(screen.getAllByRole('button', { name: `Play ${beat.title}` })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: `Play ${music.title}` })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explore the beat catalog' })).toHaveAttribute('href', '/discover?content=BEAT');
    expect(play).not.toHaveBeenCalled(); expect(toggle).not.toHaveBeenCalled();
  });
  it('delegates a chosen real release and its bounded queue to the shared player', async () => {
    showcase.mockResolvedValue({ MUSIC: [music], BEAT: [beat] });
    const user = userEvent.setup(); show();
    await user.click((await screen.findAllByRole('button', { name: `Play ${music.title}` }))[0]);
    expect(play).toHaveBeenCalledExactlyOnceWith(music, [music], { type: 'landing', title: 'NoirSound' });
  });
  it('pauses the active release without resetting its queue or position', async () => {
    showcase.mockResolvedValue({ MUSIC: [music], BEAT: [beat] });
    usePlayerStore.setState({ currentTrack: music, isPlaying: true, progress: 33, queue: [music, beat] });
    const user = userEvent.setup(); show();
    await user.click((await screen.findAllByRole('button', { name: `Pause ${music.title}` }))[0]);
    expect(toggle).toHaveBeenCalledOnce(); expect(play).not.toHaveBeenCalled();
    expect(usePlayerStore.getState().progress).toBe(33);
    expect(usePlayerStore.getState().queue).toEqual([music, beat]);
  });
  it.each(['loading', 'empty', 'error'])('%s is honest, with no playable fake release and a working catalog link', async state => {
    if (state === 'loading') showcase.mockReturnValue(new Promise(() => {}));
    if (state === 'empty') showcase.mockResolvedValue({ MUSIC: [], BEAT: [] });
    if (state === 'error') showcase.mockRejectedValue(new Error('API offline'));
    show();
    const message = { loading: 'Finding sounds…', empty: 'No playable releases here yet.', error: 'The selection is unavailable right now.' }[state];
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(message));
    expect(screen.queryByRole('button', { name: /^(Play|Pause) / })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explore the music catalog' })).toHaveAttribute('href', '/discover?content=MUSIC');
    expect(play).not.toHaveBeenCalled();
  });
});
