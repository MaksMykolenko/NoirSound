import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { cleanup, render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import { useUserStore } from '../../src/store/userStore';
import { AdminShell } from '../../src/pages/admin/AdminLayout';
import AdminCreators from '../../src/pages/admin/AdminCreators';
import { getAdminCreators, updateCreatorStatus } from '../../src/api/admin';

vi.mock('../../src/api/admin', () => ({
  getAdminCreators: vi.fn(),
  getAdminCreatorsExportUrl: vi.fn(() => '/api/admin/creators/export'),
  grantArtistAccess: vi.fn(),
  revokeArtistAccess: vi.fn(),
  updateCreatorStatus: vi.fn(),
  updateCreatorNote: vi.fn(),
  searchAdmin: vi.fn(async () => ({ groups: [] })),
}));

const mockCreatorsData = {
  items: [
    {
      id: 'reg-1',
      userId: 'user-1',
      user: {
        id: 'user-1',
        username: 'producer_dan',
        displayName: 'Producer Dan',
        email: 'dan@example.test',
        role: 'LISTENER',
        status: 'ACTIVE',
      },
      userAccess: { canUploadTracks: false },
      creatorType: 'BEATMAKER',
      intendsMusic: false,
      intendsBeats: true,
      displayName: 'Producer Dan',
      portfolioUrl: 'https://youtube.com/@danbeats',
      primaryPlatformUrl: 'https://youtube.com/@danbeats',
      status: 'REGISTERED',
      adminNote: null,
      createdAt: '2026-09-01T12:00:00Z',
    },
    {
      id: 'reg-2',
      userId: 'user-2',
      user: {
        id: 'user-2',
        username: 'singer_sarah',
        displayName: 'Sarah Melodies',
        email: 'sarah@example.test',
        role: 'ARTIST',
        status: 'ACTIVE',
      },
      userAccess: { canUploadTracks: true },
      creatorType: 'ARTIST',
      intendsMusic: true,
      intendsBeats: false,
      displayName: 'Sarah Melodies',
      portfolioUrl: 'https://soundcloud.com/sarah',
      primaryPlatformUrl: 'https://soundcloud.com/sarah',
      status: 'ENABLED',
      adminNote: 'Reviewed portfolio, approved.',
      createdAt: '2026-08-30T10:00:00Z',
    },
  ],
  counts: { TOTAL: 2, REGISTERED: 1, REVIEWED: 0, ENABLED: 1 },
  pagination: { total: 2, page: 1, limit: 20, totalPages: 1 },
};

describe('AdminCreators Component', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
    useUserStore.setState({ user: { id: 'admin-1', username: 'admin', displayName: 'Admin', role: 'ADMIN' }, authHydrated: true });
    localStorage.setItem('noirsound_admin_sidebar_collapsed', 'false');
    getAdminCreators.mockResolvedValue(mockCreatorsData);
  });

  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('en');
    useUserStore.setState({ user: null });
  });

  it('renders creator registrations list with statistics and table rows', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/creators']}>
        <Routes>
          <Route path="/admin/creators" element={<AdminCreators />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Creator Registrations')).toBeInTheDocument();
      expect(screen.getByText('@producer_dan')).toBeInTheDocument();
      expect(screen.getByText('@singer_sarah')).toBeInTheDocument();
    });

    expect(screen.getByText('BEATMAKER')).toBeInTheDocument();
    expect(screen.getByText('ARTIST')).toBeInTheDocument();
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
  });

  it('displays correct upload access badges and action buttons', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/creators']}>
        <Routes>
          <Route path="/admin/creators" element={<AdminCreators />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('@producer_dan')).toBeInTheDocument();
    });

    // producer_dan has canUploadTracks=false, so "Grant Access" is shown
    expect(screen.getByRole('button', { name: 'Grant Access' })).toBeInTheDocument();

    // singer_sarah has canUploadTracks=true, so "Revoke" is shown
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
  });

  it('allows changing creator status via dropdown', async () => {
    updateCreatorStatus.mockResolvedValue({});

    render(
      <MemoryRouter initialEntries={['/admin/creators']}>
        <Routes>
          <Route path="/admin/creators" element={<AdminCreators />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('@producer_dan')).toBeInTheDocument();
    });

    const statusSelects = screen.getAllByLabelText('Change Status');
    fireEvent.change(statusSelects[0], { target: { value: 'REVIEWED' } });

    await waitFor(() => {
      expect(updateCreatorStatus).toHaveBeenCalledWith('reg-1', { status: 'REVIEWED' });
    });
  });

  it('shows one enabled creator as total 1 and enabled 1 using the actual API envelope', async () => {
    getAdminCreators.mockResolvedValue({
      items: [mockCreatorsData.items[1]],
      counts: { TOTAL: 1, REGISTERED: 0, REVIEWED: 0, ENABLED: 1 },
      pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
    });
    render(<MemoryRouter><AdminCreators /></MemoryRouter>);
    await screen.findByText('@singer_sarah');
    const summary = screen.getByText('Total Creators').parentElement.parentElement;
    for (const [label, count] of [['Total Creators', '1'], ['Registered', '0'], ['Reviewed', '0'], ['Enabled', '1']]) {
      expect(within(within(summary).getByText(label).parentElement).getByText(count)).toBeInTheDocument();
    }
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('1–1 of 1');
  });

  it('uses server-wide counts separately from filtered pagination and the visible page', async () => {
    getAdminCreators.mockResolvedValue({
      items: [mockCreatorsData.items[1]],
      counts: { TOTAL: 31, REGISTERED: 10, REVIEWED: 20, ENABLED: 1 },
      pagination: { total: 21, page: 2, limit: 20, totalPages: 2 },
    });
    render(<MemoryRouter initialEntries={['/?page=2']}><AdminCreators /></MemoryRouter>);
    await screen.findByText('@singer_sarah');
    const summary = screen.getByText('Total Creators').parentElement.parentElement;
    for (const [label, count] of [['Total Creators', '31'], ['Registered', '10'], ['Reviewed', '20'], ['Enabled', '1']]) {
      expect(within(within(summary).getByText(label).parentElement).getByText(count)).toBeInTheDocument();
    }
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('21–21 of 21');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('uses canonical upload access even when a stale legacy user field disagrees', async () => {
    getAdminCreators.mockResolvedValue({
      ...mockCreatorsData,
      items: [{ ...mockCreatorsData.items[0], user: { ...mockCreatorsData.items[0].user, canUploadTracks: true }, userAccess: { canUploadTracks: false } }],
    });
    render(<MemoryRouter><AdminCreators /></MemoryRouter>);
    await screen.findByText('@producer_dan');
    expect(screen.getByRole('button', { name: 'Grant Access' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
  });

  it.each([
    ['en', 'Creators', 'Artist Access'],
    ['uk', 'Креатори', 'Доступ артиста'],
    ['pl', 'Twórcy', 'Dostęp artysty'],
    ['ru', 'Креаторы', 'Доступ артиста'],
  ])('renders creator navigation and access heading as translated strings in %s', async (locale, navLabel, accessLabel) => {
    await i18n.changeLanguage(locale);
    render(<MemoryRouter initialEntries={['/admin/creators']}><Routes>
      <Route path="/admin" element={<AdminShell />}><Route path="creators" element={<AdminCreators />} /></Route>
    </Routes></MemoryRouter>);
    await screen.findByText('@producer_dan');
    expect(within(screen.getByTestId('admin-sidebar')).getByRole('link', { name: navLabel })).toHaveAttribute('href', '/admin/creators');
    expect(screen.getByRole('columnheader', { name: accessLabel })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/returned an object|admin\.creators|admin\.artistAccess\.navLabel/);
  });

});
