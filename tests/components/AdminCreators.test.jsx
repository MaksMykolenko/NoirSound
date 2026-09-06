import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/i18n';
import AdminCreators from '../../src/pages/admin/AdminCreators';
import { getAdminCreators, updateCreatorStatus } from '../../src/api/admin';

vi.mock('../../src/api/admin', () => ({
  getAdminCreators: vi.fn(),
  getAdminCreatorsExportUrl: vi.fn(() => '/api/admin/creators/export'),
  grantArtistAccess: vi.fn(),
  revokeArtistAccess: vi.fn(),
  updateCreatorStatus: vi.fn(),
  updateCreatorNote: vi.fn(),
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
        canUploadTracks: false,
      },
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
        canUploadTracks: true,
      },
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
  total: 2,
  page: 1,
  pageSize: 50,
  totalPages: 1,
};

describe('AdminCreators Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminCreators.mockResolvedValue(mockCreatorsData);
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
});
