import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/i18n';
import GenrePicker from '../../src/components/ui/GenrePicker';

describe('GenrePicker viewport dismissal', () => {
  let anchorRect;
  let frames;

  beforeEach(() => {
    anchorRect = { top: 366, left: 280, width: 320, height: 44, right: 600, bottom: 410 };
    frames = new Map();
    let nextFrame = 0;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => anchorRect);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => frames.delete(id));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function openPicker() {
    render(<main data-testid="upload-scroll"><GenrePicker value="" onChange={vi.fn()} /></main>);
    fireEvent.click(screen.getByTestId('genre-picker-trigger'));
    expect(screen.getByTestId('genre-picker-panel')).toBeVisible();
    // Deliver an event after the opening frames, as a browser can do for a
    // scroll completed before the activating click. This is not a delay retry.
    for (let frame = 0; frame < 3; frame += 1) {
      act(() => {
        const callbacks = [...frames.values()];
        frames.clear();
        callbacks.forEach((callback) => callback(frame * 16));
      });
    }
  }

  it('keeps the picker open for a late queued scroll that does not move its anchor', () => {
    openPicker();
    fireEvent.scroll(screen.getByTestId('upload-scroll'));
    expect(screen.getByTestId('genre-picker-panel')).toBeVisible();
    expect(screen.getByTestId('genre-picker-trigger')).toHaveAttribute('aria-expanded', 'true');
  });

  it.each([-1, -0.5, 0.5, 1])('keeps the picker open when the anchor settles by %s CSS pixels', (delta) => {
    openPicker();
    anchorRect = { ...anchorRect, top: 366 + delta, bottom: 410 + delta };
    fireEvent.scroll(screen.getByTestId('upload-scroll'));
    expect(screen.getByTestId('genre-picker-panel')).toBeVisible();
    expect(screen.getByTestId('genre-picker-trigger')).toHaveAttribute('aria-expanded', 'true');
  });

  it.each([-40, -2, 2])('dismisses when an outside scroll moves the anchor by %s CSS pixels', (delta) => {
    openPicker();
    anchorRect = { ...anchorRect, top: 366 + delta, bottom: 410 + delta };
    fireEvent.scroll(screen.getByTestId('upload-scroll'));
    expect(screen.queryByTestId('genre-picker-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('genre-picker-trigger')).toHaveAttribute('aria-expanded', 'false');
  });

  it('measures cumulative movement from the opening anchor instead of resetting the baseline', () => {
    openPicker();
    anchorRect = { ...anchorRect, top: 366.75, bottom: 410.75 };
    fireEvent.scroll(screen.getByTestId('upload-scroll'));
    expect(screen.getByTestId('genre-picker-panel')).toBeVisible();
    anchorRect = { ...anchorRect, top: 367.5, bottom: 411.5 };
    fireEvent.scroll(screen.getByTestId('upload-scroll'));
    expect(screen.queryByTestId('genre-picker-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('genre-picker-trigger')).toHaveAttribute('aria-expanded', 'false');
  });

  it.each([0, 10])('handles a window scroll with anchor movement %s without a non-Node target error', (delta) => {
    const onError = vi.fn((event) => event.preventDefault());
    window.addEventListener('error', onError);
    try {
      openPicker();
      anchorRect = { ...anchorRect, top: 366 + delta, bottom: 410 + delta };
      fireEvent.scroll(window);
      expect(onError).not.toHaveBeenCalled();
      if (delta === 0) expect(screen.getByTestId('genre-picker-panel')).toBeVisible();
      else expect(screen.queryByTestId('genre-picker-panel')).not.toBeInTheDocument();
    } finally {
      window.removeEventListener('error', onError);
    }
  });

  it('dismisses on resize even if the anchor has not moved', () => {
    openPicker();
    fireEvent.resize(window);
    expect(screen.queryByTestId('genre-picker-panel')).not.toBeInTheDocument();
  });

  it('keeps the picker open while its own option list scrolls', () => {
    openPicker();
    fireEvent.scroll(screen.getByRole('listbox'));
    expect(screen.getByTestId('genre-picker-panel')).toBeVisible();
  });
});
