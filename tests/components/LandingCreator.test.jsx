import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import LandingCreatorSection from '../../src/components/landing/LandingCreatorSection';
import UploadForm from '../../src/components/upload/UploadForm';
import AuthModal from '../../src/components/auth/AuthModal';
import { useLandingDraftStore, LANDING_DRAFT_MARKER, hasLostLandingDraft } from '../../src/store/landingDraftStore';
import { useUserStore } from '../../src/store/userStore';
import i18n from '../../src/i18n';
import creatorResources from '../../src/i18n/landingCreatorResources';

const { upload, ensureProfile } = vi.hoisted(() => ({ upload: vi.fn(), ensureProfile: vi.fn() }));
vi.mock('../../src/hooks/mutations/useUploadTrack', () => ({
  useUploadTrack: () => ({ mutateAsync: upload }), pollUploadStatus: vi.fn(),
}));
vi.mock('../../src/api/user', async (importOriginal) => ({ ...(await importOriginal()), ensureMyArtistProfile: ensureProfile }));
vi.mock('../../src/hooks/mutations/useAuth', () => ({
  useLogin: () => ({ isPending: false }), useRegister: () => ({ isPending: false }),
}));

function TestFlow() {
  return <MemoryRouter><Routes>
    <Route path="/" element={<LandingCreatorSection />} />
    <Route path="/upload" element={<><Link to="/">Back to landing</Link><UploadForm /></>} />
  </Routes></MemoryRouter>;
}

// jsdom does not implement the native dialog API. Browser QA exercises the
// browser's focus containment and Escape; here we exercise our close lifecycle.
const originalShowModal = HTMLDialogElement.prototype.showModal;
const originalClose = HTMLDialogElement.prototype.close;
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  HTMLDialogElement.prototype.close = function close() { this.open = false; };
});
afterAll(() => {
  HTMLDialogElement.prototype.showModal = originalShowModal;
  HTMLDialogElement.prototype.close = originalClose;
});

beforeEach(async () => {
  for (const [locale, creator] of Object.entries(creatorResources)) i18n.addResourceBundle(locale, 'common', { landing: { creator } }, true, true);
  await i18n.changeLanguage('en');
  useLandingDraftStore.getState().clearDraft();
  useUserStore.setState({ user: { id: 'real-user', role: 'ARTIST', canUploadTracks: true }, authHydrated: true, isAuthModalOpen: false });
  upload.mockReset();
  ensureProfile.mockReset();
});

describe('landing creator handoff', () => {
  it('updates a text-safe visual preview without playback, publication or upload', async () => {
    const user = userEvent.setup();
    render(<TestFlow />);
    const title = '<img src=x onerror=alert(1)> My song';
    await user.type(screen.getByLabelText('Track title'), title);
    await user.type(screen.getByLabelText('Artist name in preview'), 'An independent credit');
    await user.click(screen.getByRole('radio', { name: 'Beat', exact: true }));
    await user.click(screen.getByRole('button', { name: 'See preview' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: title })).toBeInTheDocument();
    expect(within(dialog).getByText('An independent credit')).toBeInTheDocument();
    expect(within(dialog).getByText('BEAT / PREVIEW')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /play|listen/i })).not.toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
    expect(ensureProfile).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Close preview' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'See preview' })).toHaveFocus();
  });

  it('accepts native dialog cancellation and restores editor focus', async () => {
    const user = userEvent.setup();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'auto';
    render(<TestFlow />);
    await user.click(screen.getByRole('button', { name: 'See preview' }));
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: false, cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'See preview' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('auto');
    document.body.style.overflow = previousOverflow;
  });

  it('restores page scroll when an open preview unmounts during route navigation', async () => {
    const user = userEvent.setup();
    const previousOverflow = document.body.style.overflow;
    const { unmount } = render(<TestFlow />);
    await user.click(screen.getByRole('button', { name: 'See preview' }));
    unmount();
    expect(document.body.style.overflow).toBe(previousOverflow);
  });

  it('carries the exact File and input values across SPA routes, never an owner override', async () => {
    const user = userEvent.setup();
    render(<TestFlow />);
    const file = new File(['audio bytes'], 'Night.wav', { type: 'audio/wav' });
    await user.upload(screen.getByLabelText('Choose your audio'), file);
    await user.clear(screen.getByLabelText('Track title'));
    await user.type(screen.getByLabelText('Track title'), 'My actual title');
    await user.type(screen.getByLabelText('Artist name in preview'), 'Someone else');
    await user.click(screen.getByRole('radio', { name: 'Beat', exact: true }));
    expect(upload).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Continue to upload' }));
    expect(screen.getByLabelText(i18n.t('uploadForm.trackTitle'))).toHaveValue('My actual title');
    expect(screen.getByText('Night.wav')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Beat/ })).toBeChecked();
    expect(screen.getByText(i18n.t('landing.creator.uploadCreditNotice', { credit: 'Someone else' }))).toBeInTheDocument();
    expect(useLandingDraftStore.getState().draft.audioFile).toBe(file);
    expect(useUserStore.getState().user.id).toBe('real-user');
    expect(upload).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText(i18n.t('uploadForm.trackTitle')));
    await user.type(screen.getByLabelText(i18n.t('uploadForm.trackTitle')), 'Edited in upload');
    await user.type(screen.getByLabelText(i18n.t('uploadForm.description')), 'A local description');
    await user.click(screen.getByRole('link', { name: 'Back to landing' }));
    expect(screen.getByLabelText('Track title')).toHaveValue('Edited in upload');
    expect(screen.getByLabelText('Artist name in preview')).toHaveValue('Someone else');
    await user.click(screen.getByRole('button', { name: 'Continue to upload' }));
    expect(screen.getByLabelText(i18n.t('uploadForm.description'))).toHaveValue('A local description');
    expect(useLandingDraftStore.getState().draft.audioFile).toBe(file);
    expect(upload).not.toHaveBeenCalled();
  });

  it('uses existing format and size validation for dropped audio', () => {
    render(<TestFlow />);
    const input = screen.getByLabelText('Choose your audio');
    const invalid = new File(['no audio'], 'image.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [invalid] } });
    expect(screen.getByRole('alert')).toHaveTextContent('50 MB');
    expect(useLandingDraftStore.getState().draft).toBeNull();
    const empty = new File([], 'empty.wav', { type: 'audio/wav' });
    fireEvent.change(input, { target: { files: [empty] } });
    expect(useLandingDraftStore.getState().draft).toBeNull();
    const valid = new File(['audio'], 'beat.ogg', { type: 'audio/ogg' });
    fireEvent.drop(input.closest('label'), { dataTransfer: { files: [valid] } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(useLandingDraftStore.getState().draft.audioFile).toBe(valid);
    expect(upload).not.toHaveBeenCalled();
  });

  it('submits only through the real form after required rights confirmation, without preview credit or owner fields', async () => {
    const user = userEvent.setup();
    const file = new File(['audio'], 'Original.wav', { type: 'audio/wav' });
    useLandingDraftStore.getState().updateDraft({ title: 'Original', artistCredit: 'Preview alias', audioFile: file });
    useLandingDraftStore.getState().requestUpload();
    // Retain entered data by using a recoverable submit failure; the assertion
    // below covers the actual existing mutation boundary, not a new endpoint.
    upload.mockRejectedValue(new Error('Test upload response'));
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:cover-test');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const { unmount } = render(<UploadForm />);
    const cover = new File(['cover'], 'cover.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(i18n.t('uploadForm.artworkFileLabel')), cover);
    await user.click(screen.getByRole('button', { name: i18n.t('uploadForm.primaryGenre') }));
    await user.click(screen.getByRole('option', { name: /^Pop/ }));
    await user.click(screen.getByRole('button', { name: i18n.t('uploadForm.submit') }));
    expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('uploadForm.rightsRequired'));
    expect(upload).not.toHaveBeenCalled();
    await user.click(screen.getByRole('checkbox', { name: i18n.t('uploadForm.rightsConfirmation') }));
    await user.click(screen.getByRole('button', { name: i18n.t('uploadForm.submit') }));
    expect(upload).toHaveBeenCalledTimes(1);
    const payload = upload.mock.calls[0][0];
    expect(payload).toMatchObject({ title: 'Original', audioFile: file, coverFile: cover, copyrightConfirmed: true, contentType: 'MUSIC' });
    for (const key of ['ownerId', 'artistId', 'artistCredit', 'role', 'returnTo']) expect(payload).not.toHaveProperty(key);
    unmount();
    expect(revokeUrl).toHaveBeenCalledWith('blob:cover-test');
    createUrl.mockRestore();
    revokeUrl.mockRestore();
  });

  it('routes guests through existing sign-in and keeps their draft after session hydration', async () => {
    useUserStore.setState({ user: null });
    const user = userEvent.setup();
    render(<TestFlow />);
    await user.type(screen.getByLabelText('Track title'), 'Guest draft');
    await user.click(screen.getByRole('button', { name: 'Continue to upload' }));
    await user.click(screen.getByRole('button', { name: i18n.t('header.signIn') }));
    expect(useUserStore.getState().isAuthModalOpen).toBe(true);
    act(() => useUserStore.setState({ user: { id: 'signed-in', role: 'ARTIST', canUploadTracks: true } }));
    expect(screen.getByLabelText(i18n.t('uploadForm.trackTitle'))).toHaveValue('Guest draft');
    expect(upload).not.toHaveBeenCalled();
  });

  it('keeps the existing no-artist-access gate and never initiates a raw upload', async () => {
    useUserStore.setState({ user: { id: 'listener', role: 'USER' } });
    const user = userEvent.setup();
    render(<TestFlow />);
    await user.type(screen.getByLabelText('Track title'), 'Waiting for access');
    await user.click(screen.getByRole('button', { name: 'Continue to upload' }));
    expect(screen.getByRole('heading', { name: i18n.t('uploadForm.creatorAccessRequired') })).toBeInTheDocument();
    expect(useLandingDraftStore.getState().draft.title).toBe('Waiting for access');
    expect(upload).not.toHaveBeenCalled();
    expect(ensureProfile).not.toHaveBeenCalled();
  });

  it('keeps a profile-blocked artist in the existing profile gate', async () => {
    useUserStore.setState({ user: { id: 'artist', role: 'ARTIST', canUploadTracks: false, uploadAccessReason: 'MISSING_ARTIST_PROFILE' } });
    const user = userEvent.setup();
    render(<TestFlow />);
    await user.click(screen.getByRole('button', { name: 'Continue to upload' }));
    expect(screen.getByRole('heading', { name: i18n.t('uploadForm.profileNotReadyTitle') })).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it('reports draft loss after a reload and warns before Google sign-in', () => {
    useLandingDraftStore.setState({ lostDraft: true });
    const { unmount } = render(<UploadForm />);
    expect(screen.getByRole('status')).toHaveTextContent(i18n.t('landing.creator.lostDraft'));
    unmount();
    useLandingDraftStore.getState().updateDraft({ title: 'Local' });
    render(<AuthModal isOpen onClose={() => {}} />);
    expect(screen.getByRole('button', { name: i18n.t('auth.continueGoogle') })).toHaveAccessibleDescription(i18n.t('landing.creator.googleDraftNotice'));
  });
});

describe('landing draft boundaries', () => {
  it('serializes only a loss marker and drops owner/profile/return URL fields', () => {
    const file = new File(['never persisted'], 'private.wav', { type: 'audio/wav' });
    useLandingDraftStore.getState().updateDraft({ title: 'Private title', artistCredit: 'Credit', audioFile: file, ownerId: 'victim', artistId: 'other', returnTo: 'https://evil.example' });
    useLandingDraftStore.getState().requestUpload();
    useLandingDraftStore.getState().saveUploadFields({ description: 'Memory only', ownerId: 'victim' });
    expect(sessionStorage.getItem(LANDING_DRAFT_MARKER)).toBe('1');
    expect(hasLostLandingDraft()).toBe(true);
    const draft = useLandingDraftStore.getState().draft;
    expect(draft).not.toHaveProperty('ownerId');
    expect(draft).not.toHaveProperty('artistId');
    expect(draft).not.toHaveProperty('returnTo');
    expect(draft.uploadFields).toEqual({ description: 'Memory only' });
    useLandingDraftStore.getState().clearDraft();
    expect(hasLostLandingDraft()).toBe(false);
  });

  it('continues to work when session storage is unavailable', () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => useLandingDraftStore.getState().updateDraft({ title: 'In memory' })).not.toThrow();
    expect(useLandingDraftStore.getState().draft.title).toBe('In memory');
    storage.mockRestore();
  });
});
