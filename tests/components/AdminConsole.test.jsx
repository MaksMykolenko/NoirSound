import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import { useUserStore } from '../../src/store/userStore';
import AdminLayout from '../../src/pages/admin/AdminLayout';
import AdminOverview from '../../src/pages/admin/AdminOverview';
import AdminTracks from '../../src/pages/admin/AdminTracks';
import AdminUsers from '../../src/pages/admin/AdminUsers';
import AdminUserDetail from '../../src/pages/admin/AdminUserDetail';
import { ConfirmActionModal } from '../../src/components/admin/AdminUI';
import {
  getAdminOverview,
  getAdminTracks,
  getAdminUser,
  getAdminUsers,
  suspendUser,
  grantArtistAccess,
  ensureArtistProfile,
} from '../../src/api/admin';

vi.mock('../../src/api/admin', () => ({
  getAdminOverview: vi.fn(),
  getAdminTracks: vi.fn(),
  getAdminUsers: vi.fn(),
  getAdminUser: vi.fn(),
  suspendUser: vi.fn(),
  unsuspendUser: vi.fn(),
  banUser: vi.fn(),
  unbanUser: vi.fn(),
  revokeUserSessions: vi.fn(),
  setUserRole: vi.fn(),
  grantArtistAccess: vi.fn(),
  revokeArtistAccess: vi.fn(),
  ensureArtistProfile: vi.fn(),
  hideArtist: vi.fn(),
  unhideArtist: vi.fn(),
}));

const adminUser = {
  id: 'admin-1',
  email: 'admin@test.local',
  username: 'admin',
  displayName: 'Admin',
  role: 'ADMIN',
  status: 'ACTIVE',
};

function renderAdmin(path, element) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="overview" element={element} />
          <Route path="tracks" element={element} />
          <Route path="users" element={element} />
          <Route path="users/:id" element={element} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('Admin console', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
    useUserStore.setState({ user: adminUser, authHydrated: true });
  });

  it('shows access denied to an authenticated non-admin', () => {
    useUserStore.setState({
      user: { ...adminUser, role: 'LISTENER' },
      authHydrated: true,
    });
    renderAdmin('/admin/overview', <div>protected</div>);

    expect(screen.getByTestId('admin-access-denied')).toBeInTheDocument();
    expect(screen.queryByText('protected')).not.toBeInTheDocument();
  });

  it('renders admin navigation only for an admin', () => {
    renderAdmin('/admin/overview', <div>protected</div>);

    expect(screen.getByRole('link', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /audit logs/i })).toBeInTheDocument();
    expect(screen.getByText('protected')).toBeInTheDocument();
  });

  it('renders overview statistics and system cards', async () => {
    getAdminOverview.mockResolvedValue({
      users: { active: 10, suspended: 1, banned: 1 },
      tracks: { published: 7, hidden: 2 },
      uploads: { failed: 1, processing: 3 },
      reports: { pending: 4 },
      comments: { today: 5 },
      playEvents: { today: 20 },
      system: {
        status: 'ready',
        checks: {
          api: 'ok',
          database: 'ok',
          redis: 'ok',
          storage: 'ok',
          worker: 'ok',
          ffmpeg: 'ok',
        },
      },
    });
    renderAdmin('/admin/overview', <AdminOverview />);

    expect(await screen.findByText('Pending reports')).toBeInTheDocument();
    expect(screen.getByText('System status')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('renders the users table from the admin API', async () => {
    getAdminUsers.mockResolvedValue({
      data: [{
        id: 'user-1',
        displayName: 'Listener One',
        username: 'listener_one',
        email: 'listener@test.local',
        role: 'LISTENER',
        status: 'ACTIVE',
        updatedAt: '2026-06-30T00:00:00.000Z',
        counts: { tracks: 0, reports: 1 },
      }],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    });
    renderAdmin('/admin/users', <AdminUsers />);

    expect(await screen.findByText('Listener One')).toBeInTheDocument();
    expect(screen.getByText('listener@test.local')).toBeInTheDocument();
  });

  it('renders long admin track fixtures in a contained, paginated table', async () => {
    const longTitle = 'Midnight Signals from an Empty City Without Any Convenient Short Display Name';
    const longArtist = 'The Independent Artists Collective with an Exceptionally Long Public Name';
    const track = (id, status, overrides = {}) => ({
      id,
      title: `Track ${id}`,
      artist: { user: { displayName: `Artist ${id}` } },
      genre: 'AMBIENT',
      status,
      plays: 120,
      reportsCount: 0,
      updatedAt: '2026-07-12T12:00:00.000Z',
      uploads: [{ status }],
      ...overrides,
    });
    getAdminTracks.mockResolvedValue({
      data: [
        track('published', 'PUBLISHED', {
          title: longTitle,
          artist: { user: { displayName: longArtist } },
          reportsCount: 73,
        }),
        track('processing', 'PROCESSING'),
        track('hidden', 'HIDDEN'),
        track('failed', 'FAILED'),
      ],
      pagination: { page: 1, pageSize: 25, total: 126, totalPages: 6 },
    });
    const user = userEvent.setup();

    renderAdmin('/admin/tracks', <AdminTracks />);

    const title = await screen.findByText(longTitle);
    expect(title).toHaveClass('max-w-[18rem]', 'break-words');
    expect(screen.getByText(longArtist)).toHaveClass('max-w-[14rem]', 'break-words');

    const table = screen.getByRole('table');
    expect(table).toHaveClass('min-w-[760px]');
    expect(table.parentElement).toHaveClass('overflow-auto');
    within(table).getAllByRole('columnheader').forEach((heading) => {
      expect(heading).toHaveClass('sticky');
    });

    ['PUBLISHED', 'PROCESSING', 'HIDDEN', 'FAILED'].forEach((status) => {
      expect(within(table).getByText(i18n.t(`admin.statusValues.${status}`))).toBeInTheDocument();
    });
    expect(within(table).getByText('73')).toBeInTheDocument();
    expect(within(table).getAllByRole('link', { name: i18n.t('admin.view') })).toHaveLength(4);
    expect(screen.getByText(i18n.t('admin.pageOf', { page: 1, total: 6 }))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: i18n.t('admin.next') }));
    await waitFor(() => {
      expect(getAdminTracks).toHaveBeenLastCalledWith({ search: '', status: '', page: 2 });
    });
  });

  it('requires a reason before confirming a dangerous action', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmActionModal
        open
        actionLabel="Suspend"
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    const confirm = screen.getByRole('button', { name: 'Suspend' });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Policy violation' } });
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith('Policy violation');
  });

  it('calls the suspend endpoint from the user danger zone', async () => {
    getAdminUser.mockResolvedValue({
      user: {
        id: 'user-1',
        displayName: 'Listener One',
        username: 'listener_one',
        email: 'listener@test.local',
        role: 'LISTENER',
        status: 'ACTIVE',
        joinedAt: '2026-06-30T00:00:00.000Z',
        updatedAt: '2026-06-30T00:00:00.000Z',
        sessions: { active: 1 },
        counts: { sessions: 1, uploads: 0, comments: 0, reportsMade: 0 },
      },
      audit: [],
    });
    suspendUser.mockResolvedValue({ user: { id: 'user-1', status: 'SUSPENDED' } });
    const user = userEvent.setup();
    renderAdmin('/admin/users/user-1', <AdminUserDetail />);

    await user.click(await screen.findByRole('button', { name: 'Suspend' }));
    await user.type(screen.getByRole('textbox'), 'Repeated abuse');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(suspendUser).toHaveBeenCalledWith('user-1', 'Repeated abuse');
    });
  });
});

describe('Artist Access panel', () => {
  const blockedUser = {
    id: 'user-2',
    displayName: 'Listener Two',
    username: 'listener_two',
    email: 'listener2@test.local',
    role: 'LISTENER',
    status: 'ACTIVE',
    joinedAt: '2026-06-30T00:00:00.000Z',
    updatedAt: '2026-06-30T00:00:00.000Z',
    sessions: { active: 1 },
    counts: { sessions: 1, uploads: 0, comments: 0, reportsMade: 0 },
    hasArtistProfile: false,
    artistProfileId: null,
    artistProfileHidden: null,
    canUploadTracks: false,
    uploadAccessReason: 'NOT_ARTIST_ROLE',
  };

  const readyArtist = {
    ...blockedUser,
    role: 'ARTIST',
    hasArtistProfile: true,
    artistProfileId: 'artist-profile-9',
    artistProfileHidden: false,
    canUploadTracks: true,
    uploadAccessReason: null,
  };

  const adminMissingProfile = {
    ...blockedUser,
    id: 'user-3',
    role: 'ADMIN',
    hasArtistProfile: false,
    canUploadTracks: false,
    uploadAccessReason: 'MISSING_ARTIST_PROFILE',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
    useUserStore.setState({ user: adminUser, authHydrated: true });
  });

  it('shows the Artist Access panel with the missing-profile state visible', async () => {
    getAdminUser.mockResolvedValue({ user: blockedUser, audit: [] });
    renderAdmin('/admin/users/user-2', <AdminUserDetail />);

    const panel = await screen.findByTestId('artist-access-panel');
    expect(panel).toBeInTheDocument();
    expect(within(panel).getByText('Has ArtistProfile')).toBeInTheDocument();
    expect(within(panel).getAllByText('No').length).toBeGreaterThan(0);
    expect(within(panel).getByText('This account is not an Artist or Admin, so it cannot upload.')).toBeInTheDocument();
  });

  it('opens a confirm modal requiring a reason when Grant Artist Access is clicked', async () => {
    getAdminUser.mockResolvedValue({ user: blockedUser, audit: [] });
    const user = userEvent.setup();
    renderAdmin('/admin/users/user-2', <AdminUserDetail />);

    const panel = await screen.findByTestId('artist-access-panel');
    await user.click(within(panel).getByRole('button', { name: 'Grant Artist Access' }));

    const dialog = await screen.findByRole('dialog');
    const submit = within(dialog).getByRole('button', { name: 'Grant Artist Access' });
    expect(submit).toBeDisabled();
    expect(grantArtistAccess).not.toHaveBeenCalled();

    await user.type(within(dialog).getByRole('textbox'), 'Approved via support ticket');
    expect(submit).toBeEnabled();
  });

  it('grants artist access and updates the UI to reflect upload access', async () => {
    getAdminUser.mockResolvedValueOnce({ user: blockedUser, audit: [] });
    getAdminUser.mockResolvedValueOnce({ user: readyArtist, audit: [] });
    grantArtistAccess.mockResolvedValue({ user: readyArtist });
    const user = userEvent.setup();
    renderAdmin('/admin/users/user-2', <AdminUserDetail />);

    const panel = await screen.findByTestId('artist-access-panel');
    await user.click(within(panel).getByRole('button', { name: 'Grant Artist Access' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), 'Approved via support ticket');
    await user.click(within(dialog).getByRole('button', { name: 'Grant Artist Access' }));

    await waitFor(() => {
      expect(grantArtistAccess).toHaveBeenCalledWith(
        'user-2',
        expect.objectContaining({ reason: 'Approved via support ticket' })
      );
    });
    await waitFor(() => {
      expect(getAdminUser).toHaveBeenCalledTimes(2);
    });
    const updatedPanel = await screen.findByTestId('artist-access-panel');
    const canUploadRow = within(updatedPanel).getByText('Can upload tracks').closest('div');
    expect(within(canUploadRow).getByText('Yes')).toBeInTheDocument();
  });

  it('shows a Create Artist Profile button for an eligible user and it works', async () => {
    getAdminUser.mockResolvedValueOnce({ user: adminMissingProfile, audit: [] });
    getAdminUser.mockResolvedValueOnce({
      user: { ...adminMissingProfile, hasArtistProfile: true, artistProfileId: 'artist-profile-5', canUploadTracks: true, uploadAccessReason: null },
      audit: [],
    });
    ensureArtistProfile.mockResolvedValue({ user: { ...adminMissingProfile, hasArtistProfile: true } });
    const user = userEvent.setup();
    renderAdmin('/admin/users/user-3', <AdminUserDetail />);

    const panel = await screen.findByTestId('artist-access-panel');
    const createButton = within(panel).getByRole('button', { name: 'Create Artist Profile' });
    await user.click(createButton);
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), 'Self-service admin profile');
    await user.click(within(dialog).getByRole('button', { name: 'Create Artist Profile' }));

    await waitFor(() => {
      expect(ensureArtistProfile).toHaveBeenCalledWith(
        'user-3',
        expect.objectContaining({ reason: 'Self-service admin profile' })
      );
    });
  });

  it('does not render admin user-management screens (or Artist Access controls) for a non-admin', async () => {
    useUserStore.setState({ user: { ...adminUser, role: 'LISTENER' }, authHydrated: true });
    getAdminUser.mockResolvedValue({ user: blockedUser, audit: [] });
    renderAdmin('/admin/users/user-2', <AdminUserDetail />);

    expect(screen.getByTestId('admin-access-denied')).toBeInTheDocument();
    expect(screen.queryByTestId('artist-access-panel')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Grant Artist Access' })).not.toBeInTheDocument();
  });

  it('never displays raw SQL, table, or column names in the Artist Access panel', async () => {
    getAdminUser.mockResolvedValue({ user: readyArtist, audit: [] });
    renderAdmin('/admin/users/user-2', <AdminUserDetail />);

    const panel = await screen.findByTestId('artist-access-panel');
    const panelText = panel.textContent;
    for (const forbidden of ['SELECT ', 'UPDATE ', 'INSERT INTO', 'DELETE FROM', 'psql', '"User"', '"ArtistProfile"', 'UPDATE "User"']) {
      expect(panelText).not.toContain(forbidden);
    }
  });
});
