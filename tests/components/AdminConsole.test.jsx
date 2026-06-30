import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import { useUserStore } from '../../src/store/userStore';
import AdminLayout from '../../src/pages/admin/AdminLayout';
import AdminOverview from '../../src/pages/admin/AdminOverview';
import AdminUsers from '../../src/pages/admin/AdminUsers';
import AdminUserDetail from '../../src/pages/admin/AdminUserDetail';
import { ConfirmActionModal } from '../../src/components/admin/AdminUI';
import {
  getAdminOverview,
  getAdminUser,
  getAdminUsers,
  suspendUser,
} from '../../src/api/admin';

vi.mock('../../src/api/admin', () => ({
  getAdminOverview: vi.fn(),
  getAdminUsers: vi.fn(),
  getAdminUser: vi.fn(),
  suspendUser: vi.fn(),
  unsuspendUser: vi.fn(),
  banUser: vi.fn(),
  unbanUser: vi.fn(),
  revokeUserSessions: vi.fn(),
  setUserRole: vi.fn(),
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
