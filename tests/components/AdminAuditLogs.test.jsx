import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import AdminMediaPreview from '../../src/components/admin/AdminMediaPreview';
import AdminAuditLogs from '../../src/pages/admin/AdminAuditLogs';
import {
  exportAuditLogs,
  getAdminTrackPreview,
  getAuditLog,
  getAuditLogs,
} from '../../src/api/admin';

vi.mock('../../src/api/admin', () => ({
  exportAuditLogs: vi.fn(),
  getAdminTrackPreview: vi.fn(),
  getAuditLog: vi.fn(),
  getAuditLogs: vi.fn(),
}));

const auditEntry = {
  id: 'audit-1',
  createdAt: '2026-09-03T12:00:00.000Z',
  action: 'TRACK_HIDE',
  actor: {
    id: 'moderator-1',
    username: 'moderator',
    displayName: 'Moderator',
    role: 'ADMIN',
    email: 'private@example.test',
  },
  targetType: 'TRACK',
  targetId: 'track-1',
  reason: 'Fixture moderation reason',
  environment: 'PRODUCTION',
  result: 'SUCCESS',
  requestId: 'request-1',
  source: 'ADMIN_UI',
  metadata: { previousState: { status: 'PUBLISHED' }, newState: { status: 'HIDDEN' }, accessToken: 'never-copy-me' },
};

function listResponse(page = 1, totalPages = 3) {
  return {
    data: [auditEntry],
    pagination: { page, pageSize: 25, total: 75, totalPages },
  };
}

function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <div hidden>
      <output data-testid="location-probe">{`${location.pathname}${location.search}`}</output>
      <button type="button" data-testid="history-back" onClick={() => navigate(-1)}>back</button>
      <button type="button" data-testid="history-forward" onClick={() => navigate(1)}>forward</button>
    </div>
  );
}

function renderAuditLogs(path = '/admin/audit-logs', initialIndex) {
  const entries = Array.isArray(path) ? path : [path];
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={initialIndex}>
      <Routes>
        <Route
          path="/admin/audit-logs"
          element={(
            <>
              <AdminAuditLogs />
              <LocationProbe />
            </>
          )}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('AdminAuditLogs', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
    getAuditLogs.mockImplementation(async ({ page }) => listResponse(page));
    getAuditLog.mockResolvedValue({ auditLog: auditEntry });
    getAdminTrackPreview.mockResolvedValue({ url: '' });
    exportAuditLogs.mockResolvedValue({ url: 'blob:admin-audit', fileName: 'audit.csv' });
  });

  it('hydrates every filter from the URL, persists changes, and resets the query', async () => {
    renderAuditLogs('/admin/audit-logs?q=needle&action=TRACK_HIDE&resource=TRACK&actor=moderator&from=2026-09-01&to=2026-09-03&environment=PRODUCTION&result=SUCCESS&page=2&limit=25');

    await waitFor(() => {
      expect(getAuditLogs).toHaveBeenCalledWith({
        q: 'needle',
        action: 'TRACK_HIDE',
        resource: 'TRACK',
        actor: 'moderator',
        from: '2026-09-01',
        to: '2026-09-03',
        environment: 'PRODUCTION',
        result: 'SUCCESS',
        page: 2,
        limit: 25,
      }, { signal: expect.any(AbortSignal) });
    });

    expect(screen.getByLabelText(i18n.t('admin.audit.search'))).toHaveValue('needle');
    expect(screen.getByLabelText(i18n.t('admin.action'))).toHaveValue('TRACK_HIDE');
    expect(screen.getByLabelText(i18n.t('admin.audit.resource'))).toHaveValue('TRACK');
    expect(screen.getByLabelText(i18n.t('admin.actor'))).toHaveValue('moderator');
    expect(screen.getByLabelText(i18n.t('admin.audit.from'))).toHaveValue('2026-09-01');
    expect(screen.getByLabelText(i18n.t('admin.audit.to'))).toHaveValue('2026-09-03');
    expect(screen.getByLabelText(i18n.t('admin.audit.environment'))).toHaveValue('PRODUCTION');
    expect(screen.getByLabelText(i18n.t('admin.audit.result'))).toHaveValue('SUCCESS');
    expect(screen.getByLabelText(i18n.t('admin.audit.limit'))).toHaveValue('25');

    fireEvent.change(screen.getByLabelText(i18n.t('admin.audit.search')), { target: { value: 'updated' } });
    await waitFor(() => {
      const location = screen.getByTestId('location-probe').textContent;
      expect(location).toContain('q=updated');
      expect(location).not.toContain('page=2');
    });

    await userEvent.click(screen.getByRole('button', { name: i18n.t('admin.audit.resetFilters') }));
    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent('/admin/audit-logs');
    });
  });

  it('writes pagination to the URL and requests the selected page', async () => {
    renderAuditLogs();

    await screen.findByTestId('audit-row-audit-1');
    expect(screen.getByText(i18n.t('admin.paginationSummary', { first: 1, last: 25, total: 75 }))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('admin.goToPage', { page: 3 }) })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: i18n.t('admin.next') }));

    await waitFor(() => {
      expect(screen.getByTestId('location-probe').textContent).toContain('page=2');
      expect(getAuditLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2, limit: 50 }),
        { signal: expect.any(AbortSignal) }
      );
    });
  });

  it('debounces full-text requests while committing the final value to the URL', async () => {
    renderAuditLogs();
    await screen.findByTestId('audit-row-audit-1');
    const callsBeforeTyping = getAuditLogs.mock.calls.length;
    const input = screen.getByLabelText(i18n.t('admin.audit.search'));

    fireEvent.change(input, { target: { value: 'n' } });
    fireEvent.change(input, { target: { value: 'ne' } });
    fireEvent.change(input, { target: { value: 'needle' } });

    expect(getAuditLogs).toHaveBeenCalledTimes(callsBeforeTyping);
    expect(screen.getByTestId('location-probe').textContent).not.toContain('q=');
    await waitFor(() => {
      expect(screen.getByTestId('location-probe').textContent).toContain('q=needle');
      expect(getAuditLogs).toHaveBeenCalledTimes(callsBeforeTyping + 1);
    });
  });

  it('synchronizes the full-text field with URL back and forward navigation', async () => {
    renderAuditLogs([
      '/admin/audit-logs?q=before',
      '/admin/audit-logs?q=after',
    ], 1);
    const input = screen.getByLabelText(i18n.t('admin.audit.search'));
    expect(input).toHaveValue('after');

    fireEvent.click(screen.getByTestId('history-back'));
    await waitFor(() => expect(input).toHaveValue('before'));

    fireEvent.click(screen.getByTestId('history-forward'));
    await waitFor(() => expect(input).toHaveValue('after'));
  });

  it('opens a row with the keyboard, closes on Escape, and restores row focus', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderAuditLogs();
    const row = await screen.findByTestId('audit-row-audit-1');
    expect(within(row).getByText(i18n.t('admin.audit.actions.TRACK_HIDE', { defaultValue: 'Track Hide' }))).toBeInTheDocument();

    row.focus();
    fireEvent.keyDown(row, { key: 'Enter' });

    const drawer = await screen.findByRole('dialog');
    expect(drawer).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByTestId('location-probe').textContent).toContain('event=audit-1');
    await waitFor(() => {
      expect(getAuditLog).toHaveBeenCalledWith('audit-1', { signal: expect.any(AbortSignal) });
    });
    expect(within(drawer).getByText('2026-09-03T12:00:00.000Z')).toBeInTheDocument();
    expect(within(drawer).getByText('TRACK_HIDE')).toBeInTheDocument();
    expect(within(drawer).getByText('ADMIN_UI')).toBeInTheDocument();
    expect(within(drawer).getByRole('link', { name: i18n.t('admin.audit.openResource') })).toHaveAttribute('href', '/admin/tracks/track-1');
    await user.click(within(drawer).getByRole('button', {
      name: i18n.t('admin.audit.copyValue', { label: i18n.t('admin.targetId') }),
    }));
    expect(writeText).toHaveBeenCalledWith('track-1');
    await user.click(within(drawer).getByRole('button', {
      name: i18n.t('admin.audit.copyValue', { label: i18n.t('admin.audit.sanitizedEventJson') }),
    }));
    const copiedJson = writeText.mock.calls.at(-1)[0];
    expect(copiedJson).toContain('"action": "TRACK_HIDE"');
    expect(copiedJson).not.toContain('private@example.test');
    expect(copiedJson).not.toContain('never-copy-me');
    expect(copiedJson).toContain('[REDACTED]');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('location-probe').textContent).not.toContain('event=');
    expect(row).toHaveFocus();
  });

  it('aborts an obsolete list request when URL filters change', async () => {
    const signals = [];
    getAuditLogs.mockImplementation((_params, { signal }) => {
      signals.push(signal);
      return new Promise(() => {});
    });
    renderAuditLogs();

    await waitFor(() => expect(signals).toHaveLength(1));
    fireEvent.change(screen.getByLabelText(i18n.t('admin.audit.search')), { target: { value: 'new filter' } });

    await waitFor(() => expect(signals).toHaveLength(2));
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  it('passes active filters to the export trigger', async () => {
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderAuditLogs('/admin/audit-logs?q=needle&resource=TRACK&page=3&limit=100');
    await screen.findByTestId('audit-row-audit-1');

    await userEvent.click(screen.getByRole('button', { name: i18n.t('admin.audit.exportCsv') }));

    await waitFor(() => {
      expect(exportAuditLogs).toHaveBeenCalledWith({ q: 'needle', resource: 'TRACK' });
    });
    expect(anchorClick).toHaveBeenCalledTimes(1);
    anchorClick.mockRestore();
  });
});

describe('AdminMediaPreview', () => {
  let pause;

  beforeEach(() => {
    pause = vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    pause.mockRestore();
  });

  it('pauses every other admin preview when one starts playing', () => {
    render(
      <>
        <AdminMediaPreview title="Preview A" url="/a.mp3" mediaLabel="Preview audio A" unavailableLabel="Unavailable A" errorLabel="Failed A" />
        <AdminMediaPreview title="Preview B" url="/b.mp3" mediaLabel="Preview audio B" unavailableLabel="Unavailable B" errorLabel="Failed B" />
      </>
    );

    fireEvent.play(screen.getByLabelText('Preview audio B'));

    expect(pause).toHaveBeenCalledTimes(1);
    expect(pause.mock.instances[0]).toBe(screen.getByLabelText('Preview audio A'));
  });

  it('provides keyboard-focusable play, seek, and volume controls without native media controls', async () => {
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    render(
      <AdminMediaPreview title="Preview" url="/preview.mp3" mediaLabel="Preview audio" unavailableLabel="Unavailable" />
    );
    const audio = screen.getByLabelText('Preview audio');
    expect(audio).not.toHaveAttribute('controls');
    Object.defineProperty(audio, 'duration', { configurable: true, value: 120 });
    fireEvent.loadedMetadata(audio);

    fireEvent.change(screen.getByRole('slider', { name: i18n.t('admin.previewControls.seek') }), { target: { value: '30' } });
    fireEvent.change(screen.getByRole('slider', { name: i18n.t('admin.previewControls.volume') }), { target: { value: '0.25' } });
    expect(audio.currentTime).toBe(30);
    expect(audio.volume).toBe(0.25);

    await userEvent.click(screen.getByRole('button', { name: i18n.t('admin.previewControls.play') }));
    expect(play).toHaveBeenCalledWith();
    play.mockRestore();
  });

  it('pauses on source change and unmount, and exposes distinct unavailable and error states', () => {
    const view = render(
      <AdminMediaPreview title="Preview" url="/one.mp3" mediaLabel="Preview audio" unavailableLabel="Unavailable" errorLabel="Failed" />
    );

    const firstAudio = screen.getByLabelText('Preview audio');
    view.rerender(
      <AdminMediaPreview title="Preview" url="/two.mp3" mediaLabel="Preview audio" unavailableLabel="Unavailable" errorLabel="Failed" />
    );
    expect(pause.mock.instances).toContain(firstAudio);

    fireEvent.error(screen.getByLabelText('Preview audio'));
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');

    view.rerender(
      <AdminMediaPreview title="Preview" url="" mediaLabel="Preview audio" unavailableLabel="Unavailable" errorLabel="Failed" />
    );
    expect(screen.getByRole('status')).toHaveTextContent('Unavailable');

    view.rerender(
      <AdminMediaPreview title="Preview" url="/three.mp3" mediaLabel="Preview audio" unavailableLabel="Unavailable" errorLabel="Failed" />
    );
    const callsBeforeUnmount = pause.mock.calls.length;
    view.unmount();
    expect(pause).toHaveBeenCalledTimes(callsBeforeUnmount + 1);
  });
});
