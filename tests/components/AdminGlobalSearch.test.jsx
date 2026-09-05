import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import AdminGlobalSearch from '../../src/components/admin/AdminGlobalSearch';
import { searchAdmin } from '../../src/api/admin';

vi.mock('../../src/api/admin', () => ({ searchAdmin: vi.fn() }));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function renderSearch() {
  return render(
    <MemoryRouter initialEntries={['/admin/overview']}>
      <AdminGlobalSearch />
      <LocationProbe />
    </MemoryRouter>
  );
}

describe('AdminGlobalSearch', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    await i18n.changeLanguage('en');
  });

  it('supports the keyboard shortcut, debounced grouped results, and keyboard navigation', async () => {
    searchAdmin.mockResolvedValue({
      groups: [{
        type: 'tracks',
        items: [{ id: 'track-42', title: 'Night Audit', subtitle: 'Operator', status: 'HIDDEN', to: '/admin/tracks/track-42' }],
      }],
    });
    const user = userEvent.setup();
    renderSearch();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = screen.getByRole('combobox');
    expect(input).toHaveFocus();

    await user.type(input, 'Night');
    await waitFor(() => expect(searchAdmin).toHaveBeenCalledTimes(1), { timeout: 1000 });
    expect(searchAdmin.mock.calls[0][0]).toBe('Night');
    expect(searchAdmin.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(await screen.findByRole('option', { name: /Night Audit/i })).toBeInTheDocument();

    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/tracks/track-42');
    expect(JSON.parse(localStorage.getItem('noirsound_admin_recent_searches'))).toEqual(['Night']);
  });

  it('cancels an in-flight request when the query changes and closes with Escape', async () => {
    const signals = [];
    searchAdmin.mockImplementation((_query, { signal }) => {
      signals.push(signal);
      return new Promise(() => {});
    });
    const user = userEvent.setup();
    renderSearch();
    const input = screen.getByRole('combobox');

    await user.type(input, 'ab');
    await waitFor(() => expect(searchAdmin).toHaveBeenCalledTimes(1), { timeout: 1000 });
    await user.type(input, 'c');
    expect(signals[0].aborted).toBe(true);
    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveFocus();
  });

  it('distinguishes a failed request from an empty result', async () => {
    searchAdmin.mockRejectedValue(new Error('Search unavailable'));
    const user = userEvent.setup();
    renderSearch();

    await user.type(screen.getByRole('combobox'), 'failure');

    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('admin.globalSearch.error'));
    expect(screen.queryByText(i18n.t('admin.globalSearch.empty'))).not.toBeInTheDocument();
  });
});
