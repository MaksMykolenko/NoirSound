import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import AdminArtists from '../../src/pages/admin/AdminArtists';
import AdminComments from '../../src/pages/admin/AdminComments';
import AdminReports from '../../src/pages/admin/AdminReports';
import AdminUploads from '../../src/pages/admin/AdminUploads';
import AdminUsers from '../../src/pages/admin/AdminUsers';
import {
  getAdminArtists,
  getAdminComments,
  getAdminReports,
  getAdminUploads,
  getAdminUsers,
} from '../../src/api/admin';

vi.mock('../../src/api/admin', () => ({
  cancelUpload: vi.fn(),
  getAdminArtists: vi.fn(),
  getAdminComments: vi.fn(),
  getAdminReports: vi.fn(),
  getAdminUploads: vi.fn(),
  getAdminUsers: vi.fn(),
  hideComment: vi.fn(),
  retryUpload: vi.fn(),
  unhideComment: vi.fn(),
}));

function emptyPage(page = 1, total = 0) {
  return {
    data: [],
    pagination: { page, pageSize: 25, total, totalPages: Math.max(1, Math.ceil(total / 25)) },
  };
}

function renderPage(path, Page) {
  const routePath = path.split('?')[0];
  const router = createMemoryRouter(
    [{ path: routePath, element: <Page /> }],
    { initialEntries: [path] }
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('admin list URL state', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
    [getAdminArtists, getAdminComments, getAdminReports, getAdminUploads, getAdminUsers]
      .forEach((loader) => loader.mockImplementation((query) => Promise.resolve(emptyPage(query.page))));
  });

  it.each([
    {
      name: 'reports',
      Page: AdminReports,
      path: '/admin/reports?reason=spam&status=ESCALATED&targetType=USER&page=4',
      loader: getAdminReports,
      query: { reason: 'spam', status: 'ESCALATED', targetType: 'USER', page: 4 },
    },
    {
      name: 'users',
      Page: AdminUsers,
      path: '/admin/users?search=mira&role=ARTIST&status=ACTIVE&hasArtistProfile=true&uploadBlocked=false&page=3',
      loader: getAdminUsers,
      query: { search: 'mira', role: 'ARTIST', status: 'ACTIVE', hasArtistProfile: 'true', uploadBlocked: 'false', page: 3 },
    },
    {
      name: 'artists',
      Page: AdminArtists,
      path: '/admin/artists?search=noir&hidden=true&page=2',
      loader: getAdminArtists,
      query: { search: 'noir', hidden: 'true', page: 2 },
    },
    {
      name: 'comments',
      Page: AdminComments,
      path: '/admin/comments?search=copyright&status=HIDDEN&page=5',
      loader: getAdminComments,
      query: { search: 'copyright', status: 'HIDDEN', page: 5 },
    },
    {
      name: 'uploads',
      Page: AdminUploads,
      path: '/admin/uploads?search=midnight&status=FAILED&page=6',
      loader: getAdminUploads,
      query: { search: 'midnight', status: 'FAILED', page: 6 },
    },
  ])('hydrates $name filters and page from a deep link', async ({ Page, path, loader, query }) => {
    renderPage(path, Page);
    await waitFor(() => expect(loader).toHaveBeenCalledWith(query));
  });

  it('restores filters and page across history navigation', async () => {
    const router = renderPage('/admin/users?search=Mira&role=ARTIST&page=5', AdminUsers);
    const search = await screen.findByRole('searchbox', { name: i18n.t('admin.searchUsers') });
    expect(search).toHaveValue('Mira');

    fireEvent.change(search, { target: { value: 'Nora' } });
    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search);
      expect(params.get('search')).toBe('Nora');
      expect(params.get('role')).toBe('ARTIST');
      expect(params.has('page')).toBe(false);
    });
    await waitFor(() => expect(getAdminUsers).toHaveBeenLastCalledWith({
      search: 'Nora',
      role: 'ARTIST',
      status: '',
      hasArtistProfile: '',
      uploadBlocked: '',
      page: 1,
    }));

    await act(() => router.navigate(-1));
    await waitFor(() => expect(search).toHaveValue('Mira'));
    await waitFor(() => expect(getAdminUsers).toHaveBeenLastCalledWith({
      search: 'Mira',
      role: 'ARTIST',
      status: '',
      hasArtistProfile: '',
      uploadBlocked: '',
      page: 5,
    }));

    await act(() => router.navigate(1));
    await waitFor(() => expect(search).toHaveValue('Nora'));
  });

  it('writes pagination to the URL while retaining active upload filters', async () => {
    getAdminUploads.mockImplementation((query) => Promise.resolve(emptyPage(query.page, 75)));
    const router = renderPage('/admin/uploads?search=wave&status=FAILED&page=2', AdminUploads);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: i18n.t('admin.next') }));
    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search);
      expect(params.get('search')).toBe('wave');
      expect(params.get('status')).toBe('FAILED');
      expect(params.get('page')).toBe('3');
    });
    await waitFor(() => expect(getAdminUploads).toHaveBeenLastCalledWith({
      search: 'wave', status: 'FAILED', page: 3,
    }));
  });

  it('keeps the reports all-status option distinct from its default open filter', async () => {
    const router = renderPage('/admin/reports?page=4', AdminReports);
    const user = userEvent.setup();

    await user.selectOptions(await screen.findByRole('combobox', { name: i18n.t('admin.status') }), '');
    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search);
      expect(params.has('status')).toBe(true);
      expect(params.get('status')).toBe('');
      expect(params.has('page')).toBe(false);
    });
    await waitFor(() => expect(getAdminReports).toHaveBeenLastCalledWith({
      reason: '', status: '', targetType: '', page: 1,
    }));
  });
});
