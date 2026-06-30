import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import UserProfileHeader from '../../src/components/profile/UserProfileHeader';
import { mapArtistResponse } from '../../src/api/mappers/artistMapper';

describe('Role Leak & Presentation Protection Contracts', () => {
  it('does not display raw SYSTEM ADMIN or System Administrator in user profile header', () => {
    const adminUser = {
      id: 'admin-1',
      displayName: 'Admin User',
      username: 'admin',
      role: 'ADMIN',
      bio: 'Administrator',
      location: 'HQ',
      joinedAt: '2026-01-01',
    };

    render(
      <MemoryRouter>
        <UserProfileHeader user={adminUser} onEditClick={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.queryByText('System Admin')).not.toBeInTheDocument();
    expect(screen.queryByText(/System Administrator/i)).not.toBeInTheDocument();
    expect(screen.getByText('Listener')).toBeInTheDocument();
  });

  it('filters out raw ADMIN / internal roles from artist focus genres in mapper', () => {
    const rawArtistWithAdminGenre = {
      id: 'artist-1',
      genres: ['ADMIN', 'Phonk', 'SYSTEM_ADMIN', 'Electronic'],
      user: {
        displayName: 'Test Artist',
        username: 'test_artist',
      },
    };

    const cleanArtist = mapArtistResponse(rawArtistWithAdminGenre);
    expect(cleanArtist.genres).toEqual(['Phonk', 'Electronic']);
    expect(cleanArtist.genres).not.toContain('ADMIN');
    expect(cleanArtist.genres).not.toContain('SYSTEM_ADMIN');
  });
});
