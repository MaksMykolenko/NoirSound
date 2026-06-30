import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import i18n from '../../src/i18n';
import UploadForm from '../../src/components/upload/UploadForm';
import { useUserStore } from '../../src/store/userStore';

// Keep the upload pipeline mocked — these tests are about genre UX only.
vi.mock('../../src/hooks/mutations/useUploadTrack', () => ({
  useUploadTrack: () => ({ mutateAsync: vi.fn(), isPending: false }),
  pollUploadStatus: vi.fn(),
}));

describe('UploadForm genre selection', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    useUserStore.setState({
      user: { id: 'u1', role: 'ARTIST', displayName: 'Creator' },
      authHydrated: true,
    });
  });

  it('renders the genre picker, helper text, and tags input', () => {
    render(<UploadForm />);
    expect(screen.getByTestId('genre-picker-trigger')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('uploadForm.genreHelper'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('uploadForm.tagsHelper'))).toBeInTheDocument();
    expect(screen.getByLabelText(i18n.t('uploadForm.tags'))).toBeInTheDocument();
  });

  it('exposes broad genre groups and many genres in the picker', () => {
    render(<UploadForm />);
    fireEvent.click(screen.getByTestId('genre-picker-trigger'));
    const panel = screen.getByTestId('genre-picker-panel');

    for (const group of ['popular', 'urban', 'rock', 'metal', 'electronic', 'jazz_blues', 'world']) {
      expect(panel.querySelector(`[data-genre-group="${group}"]`)).toBeTruthy();
    }
    for (const key of ['pop', 'rap', 'rock', 'jazz', 'classical', 'electronic', 'country', 'reggae']) {
      expect(panel.querySelector(`[data-genre-option="${key}"]`)).toBeTruthy();
    }
  });

  it('filters genres by alias search', () => {
    render(<UploadForm />);
    fireEvent.click(screen.getByTestId('genre-picker-trigger'));
    fireEvent.change(screen.getByTestId('genre-search'), { target: { value: 'dnb' } });
    const panel = screen.getByTestId('genre-picker-panel');
    expect(panel.querySelector('[data-genre-option="drum_and_bass"]')).toBeTruthy();
    expect(panel.querySelector('[data-genre-option="rock"]')).toBeFalsy();
  });

  it('selecting a genre updates the trigger to the localized label', () => {
    render(<UploadForm />);
    fireEvent.click(screen.getByTestId('genre-picker-trigger'));
    fireEvent.click(screen.getByTestId('genre-picker-panel').querySelector('[data-genre-option="hip_hop"]'));
    expect(screen.getByTestId('genre-picker-trigger')).toHaveTextContent('Hip-Hop');
  });
});
