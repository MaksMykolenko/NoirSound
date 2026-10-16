import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UploadForm from '../../src/components/upload/UploadForm';
import { useUserStore } from '../../src/store/userStore';
import { useLandingDraftStore } from '../../src/store/landingDraftStore';
import i18n from '../../src/i18n';

const { upload, poll, published, onboard } = vi.hoisted(() => ({ upload: vi.fn(), poll: vi.fn(), published: vi.fn(), onboard: vi.fn() }));
vi.mock('../../src/hooks/mutations/useUploadTrack', () => ({ useUploadTrack: () => ({ mutateAsync: upload, isPending: false, onPublished: published }), pollUploadStatus: poll }));
vi.mock('../../src/api/user', async (original) => ({ ...(await original()), onboardCreator: onboard }));
const initialUser = useUserStore.getState();
const audio = () => new File(['audio fixture'], 'My_first_track.wav', { type: 'audio/wav' });
async function prepare(user) {
  await user.upload(screen.getByLabelText(i18n.t('uploadForm.audioFileLabel')), audio());
  await user.click(screen.getByTestId('genre-picker-trigger'));
  await user.click(screen.getByRole('option', { name: /^Pop/ }));
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('en');
  useLandingDraftStore.getState().clearDraft();
  useUserStore.setState({ user: { id: 'artist', role: 'ARTIST', displayName: 'Test Artist', canUploadTracks: true }, authHydrated: true });
  upload.mockResolvedValue({ trackId: 'track-1', uploadId: 'upload-1' });
  poll.mockResolvedValue({ status: 'READY', trackStatus: 'PUBLISHED' });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-preview');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); useUserStore.setState(initialUser, true); });

describe('short publishing flow', () => {
  it.each(['MUSIC', 'BEAT'])('publishes %s without a cover or optional metadata, retaining rights confirmation', async (type) => {
    const user = userEvent.setup();
    render(<UploadForm />);
    if (type === 'BEAT') await user.click(screen.getByRole('radio', { name: /^Beat/ }));
    expect(screen.getByText(i18n.t('start.optionalDetails')).closest('details')).not.toHaveAttribute('open');
    await prepare(user);
    expect(screen.getByLabelText(i18n.t('uploadForm.trackTitle'))).toHaveValue('My first track');
    const publishLabel = i18n.t(type === 'BEAT' ? 'start.publishBeat' : 'start.publishTrack');
    await user.click(screen.getByRole('button', { name: publishLabel }));
    expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('uploadForm.rightsRequired'));
    expect(upload).not.toHaveBeenCalled();
    await user.click(screen.getByRole('checkbox', { name: i18n.t('uploadForm.rightsConfirmation') }));
    await user.click(screen.getByRole('button', { name: publishLabel }));
    expect(await screen.findByRole('heading', { name: i18n.t('start.published') })).toBeInTheDocument();
    expect(upload).toHaveBeenCalledOnce();
    expect(upload.mock.calls[0][0]).toMatchObject({ title: 'My first track', genre: 'pop', coverFile: null, contentType: type, beatBpm: null, copyrightConfirmed: true, tags: [] });
    expect(published).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: i18n.t('start.openRelease') })).toHaveAttribute('href', '/track/track-1');
  });

  it('preserves an edited title when audio is replaced and releases its preview URLs', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<UploadForm />);
    await prepare(user);
    fireEvent.change(screen.getByLabelText(i18n.t('uploadForm.trackTitle')), { target: { value: 'My chosen title' } });
    await user.upload(screen.getByLabelText(i18n.t('uploadForm.audioFileLabel')), new File(['next audio'], 'Replacement.wav', { type: 'audio/wav' }));
    expect(screen.getByLabelText(i18n.t('uploadForm.trackTitle'))).toHaveValue('My chosen title');
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it('keeps the selected audio after rejecting an oversized replacement', async () => {
    const user = userEvent.setup();
    render(<UploadForm />);
    await prepare(user);
    const oversized = new File(['oversized'], 'Too-big.wav', { type: 'audio/wav' });
    Object.defineProperty(oversized, 'size', { value: 51 * 1024 * 1024 });
    await user.upload(screen.getByLabelText(i18n.t('uploadForm.audioFileLabel')), oversized);
    expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('start.audioError'));
    expect(screen.getByText('My_first_track.wav')).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it('opens optional beat fields to explain invalid BPM before sending anything', async () => {
    const user = userEvent.setup();
    render(<UploadForm />);
    await prepare(user);
    await user.click(screen.getByRole('radio', { name: /^Beat/ }));
    const summary = screen.getByText(i18n.t('start.optionalBeat'));
    await user.click(summary);
    fireEvent.change(screen.getByLabelText(i18n.t('beats.bpm')), { target: { value: '12' } });
    await user.click(summary);
    await user.click(screen.getByRole('button', { name: i18n.t('start.publishBeat') }));
    expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('start.bpmError'));
    expect(summary.closest('details')).toHaveAttribute('open');
    expect(upload).not.toHaveBeenCalled();
  });

  it('rechecks the original upload after a status request fails without submitting a second release', async () => {
    poll.mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValueOnce({ status: 'READY', trackStatus: 'PUBLISHED' });
    const user = userEvent.setup();
    render(<UploadForm />);
    await prepare(user);
    await user.click(screen.getByRole('checkbox', { name: i18n.t('uploadForm.rightsConfirmation') }));
    await user.click(screen.getByRole('button', { name: i18n.t('start.publishTrack') }));
    expect(await screen.findByRole('heading', { name: i18n.t('start.checkStatusTitle') })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: i18n.t('actions.retry') }));
    expect(await screen.findByRole('heading', { name: i18n.t('start.published') })).toBeInTheDocument();
    expect(upload).toHaveBeenCalledOnce();
    expect(poll.mock.calls).toEqual([['upload-1'], ['upload-1']]);
  });

  it('asks a listener only for their artist name and waits for approval', async () => {
    const fetchCurrentUser = vi.fn(async () => useUserStore.setState({ user: { id: 'listener', role: 'LISTENER', displayName: 'Stage Name', creatorRegistration: { creatorType: 'BOTH' } } }));
    useUserStore.setState({ user: { id: 'listener', role: 'LISTENER', displayName: 'Listener' }, fetchCurrentUser });
    onboard.mockResolvedValue({});
    const user = userEvent.setup();
    const { container } = render(<UploadForm />);
    expect(container.querySelectorAll('input')).toHaveLength(1);
    await user.type(screen.getByLabelText(i18n.t('start.artistName')), 'Stage Name');
    await user.click(screen.getByRole('button', { name: i18n.t('start.requestAccess') }));
    expect(await screen.findByRole('heading', { name: i18n.t('start.requestPendingTitle') })).toBeInTheDocument();
    expect(onboard).toHaveBeenCalledWith({ displayName: 'Stage Name', creatorType: 'BOTH', intendsMusic: true, intendsBeats: true });
    expect(screen.queryByRole('button', { name: i18n.t('start.publishTrack') })).not.toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
    await act(async () => useUserStore.setState({ user: { id: 'listener', role: 'ARTIST', displayName: 'Stage Name', canUploadTracks: true } }));
    await waitFor(() => expect(screen.getByRole('button', { name: i18n.t('start.publishTrack') })).toBeInTheDocument());
  });
});
