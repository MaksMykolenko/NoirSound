import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import i18n from '../../src/i18n';
import UploadForm from '../../src/components/upload/UploadForm';
import { useUserStore } from '../../src/store/userStore';
import { ensureMyArtistProfile } from '../../src/api/user';

// Keep the upload pipeline mocked — these tests are about the
// canUploadTracks / uploadAccessReason gate, not the upload flow itself.
vi.mock('../../src/hooks/mutations/useUploadTrack', () => ({
  useUploadTrack: () => ({ mutateAsync: vi.fn(), isPending: false }),
  pollUploadStatus: vi.fn(),
}));

vi.mock('../../src/api/user', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    ensureMyArtistProfile: vi.fn(),
  };
});

describe('UploadForm artist-access gating', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
  });

  it('shows a friendly fallback message instead of a raw error when the ArtistProfile is missing', () => {
    useUserStore.setState({
      user: {
        id: 'u1',
        role: 'ARTIST',
        displayName: 'Creator',
        canUploadTracks: false,
        uploadAccessReason: 'MISSING_ARTIST_PROFILE',
      },
      authHydrated: true,
      fetchCurrentUser: vi.fn(),
    });
    render(<UploadForm />);

    expect(screen.getByTestId('artist-profile-not-ready')).toBeInTheDocument();
    expect(screen.getByText('Artist profile not ready')).toBeInTheDocument();
    const panelText = screen.getByTestId('artist-profile-not-ready').textContent;
    expect(panelText).not.toContain('ArtistProfile is required');
    expect(panelText).not.toContain('ARTIST_PROFILE_REQUIRED');
    expect(panelText).not.toContain('422');
  });

  it('does not show a self-service button to a non-admin ARTIST blocked by a missing profile', () => {
    useUserStore.setState({
      user: {
        id: 'u1',
        role: 'ARTIST',
        displayName: 'Creator',
        canUploadTracks: false,
        uploadAccessReason: 'MISSING_ARTIST_PROFILE',
      },
      authHydrated: true,
      fetchCurrentUser: vi.fn(),
    });
    render(<UploadForm />);

    expect(screen.queryByRole('button', { name: 'Create my artist profile' })).not.toBeInTheDocument();
  });

  it('shows a working self-service "Create my artist profile" button for an ADMIN blocked by a missing profile', async () => {
    const fetchCurrentUser = vi.fn().mockResolvedValue();
    ensureMyArtistProfile.mockResolvedValue({ user: { id: 'u2', role: 'ADMIN', canUploadTracks: true } });
    useUserStore.setState({
      user: {
        id: 'u2',
        role: 'ADMIN',
        displayName: 'Site Admin',
        canUploadTracks: false,
        uploadAccessReason: 'MISSING_ARTIST_PROFILE',
      },
      authHydrated: true,
      fetchCurrentUser,
    });
    const user = userEvent.setup();
    render(<UploadForm />);

    const button = screen.getByRole('button', { name: 'Create my artist profile' });
    await user.click(button);

    await waitFor(() => {
      expect(ensureMyArtistProfile).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(fetchCurrentUser).toHaveBeenCalledTimes(1);
    });
  });

  it('does not offer self-service to an ADMIN blocked for a different reason (e.g. a hidden profile)', () => {
    useUserStore.setState({
      user: {
        id: 'u2',
        role: 'ADMIN',
        displayName: 'Site Admin',
        canUploadTracks: false,
        uploadAccessReason: 'ARTIST_PROFILE_HIDDEN',
      },
      authHydrated: true,
      fetchCurrentUser: vi.fn(),
    });
    render(<UploadForm />);

    expect(screen.queryByRole('button', { name: 'Create my artist profile' })).not.toBeInTheDocument();
  });

  it('renders the normal upload form once canUploadTracks is true', () => {
    useUserStore.setState({
      user: {
        id: 'u1',
        role: 'ARTIST',
        displayName: 'Creator',
        canUploadTracks: true,
        uploadAccessReason: null,
      },
      authHydrated: true,
      fetchCurrentUser: vi.fn(),
    });
    render(<UploadForm />);

    expect(screen.queryByTestId('artist-profile-not-ready')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Select track audio file')).toBeInTheDocument();
  });
});
