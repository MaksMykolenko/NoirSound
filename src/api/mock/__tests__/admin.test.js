import realAdminSource from '../../real/admin.js?raw';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';

let api;
beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Demo admin must not use the network'); }));
  api = await import('../admin');
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });

test('implements every real admin operation without importing the backend adapter', () => {
  const realExports = [...realAdminSource.matchAll(/export const (\w+)/g)].map(match => match[1]).sort();
  expect(Object.keys(api).sort()).toEqual(realExports);
});

test('filters and paginates connected reports, including empty results', async () => {
  const first = await api.getAdminReports();
  const second = await api.getAdminReports({ page: 2 });
  expect(first.pagination).toEqual({ page: 1, pageSize: 25, total: 32, totalPages: 2 });
  expect(second.data).toHaveLength(7);
  expect(new Set([...first.data, ...second.data].map(row => row.id)).size).toBe(32);
  const filtered = await api.getAdminReports({ status: 'OPEN', targetType: 'TRACK', reason: 'copyright' });
  expect(filtered.data.length).toBeGreaterThan(0);
  for (const report of filtered.data) {
    expect(report).toMatchObject({ status: 'OPEN', targetType: 'TRACK', reason: 'COPYRIGHT' });
    expect((await api.getAdminReport(report.id)).target.id).toBe(report.targetId);
  }
  expect((await api.getAdminReports({ reason: 'nonexistent' })).pagination.total).toBe(0);
});

test('moderation updates the target, report, overview and audit without touching the public demo', async () => {
  const { mockTracks } = await import('../data');
  const original = structuredClone(mockTracks);
  const before = await api.getAdminOverview();
  const report = (await api.getAdminReports({ status: 'OPEN', targetType: 'TRACK' })).data[0];
  await api.resolveReport(report.id, { targetAction: 'HIDE_TARGET', notes: 'Review confirmed' });
  expect((await api.getAdminReport(report.id)).report.status).toBe('ACTION_TAKEN');
  expect((await api.getAdminTrack(report.targetId)).track).toMatchObject({ status: 'HIDDEN', streamAvailable: false });
  const after = await api.getAdminOverview();
  expect(after.reports.pending).toBe(before.reports.pending - 1);
  expect(after.tracks.hidden).toBe(before.tracks.hidden + 1);
  expect((await api.getAuditLogs()).data[0]).toMatchObject({ targetId: report.id, reason: 'Review confirmed' });
  expect(mockTracks).toEqual(original);
});

test('suspending a reported track suspends its owner rather than its reporter', async () => {
  const report = (await api.getAdminReports({ status: 'OPEN', targetType: 'TRACK' })).data[0];
  const owner = (await api.getAdminTrack(report.targetId)).track.artist.user.id;
  await api.resolveReport(report.id, { targetAction: 'SUSPEND_USER', notes: 'Demo owner moderation' });
  expect((await api.getAdminUser(owner)).user).toMatchObject({ status: 'SUSPENDED', canUploadTracks: false, sessions: { active: 0 } });
  expect((await api.getAdminUser(report.reporter.id)).user.status).toBe('ACTIVE');
});

test('artist access creates one profile, respects options and updates filters', async () => {
  const user = (await api.getAdminUsers({ role: 'LISTENER', status: 'ACTIVE', hasArtistProfile: 'false' })).data[0];
  await api.grantArtistAccess(user.id, { createProfile: true, revokeSessions: true, reason: 'Creator approved' });
  const granted = (await api.getAdminUser(user.id)).user;
  expect(granted).toMatchObject({ role: 'ARTIST', hasArtistProfile: true, canUploadTracks: true, sessions: { active: 0 } });
  await api.ensureArtistProfile(user.id, { reason: 'Ensure again' });
  expect((await api.getAdminArtists({ search: user.username })).data).toHaveLength(1);
  await api.revokeArtistAccess(user.id, { hideArtistProfile: true, reason: 'Demo revoke' });
  expect((await api.getAdminUser(user.id)).user).toMatchObject({ role: 'LISTENER', artistProfileHidden: true, canUploadTracks: false });
  expect((await api.getAdminUsers({ search: user.email, uploadBlocked: 'true' })).data).toHaveLength(1);
});

test('upload retries and comment moderation update their list filters', async () => {
  const before = await api.getAdminOverview();
  const failed = (await api.getAdminUploads({ status: 'FAILED' })).data[0];
  await api.retryUpload(failed.id, 'Retry demo upload');
  expect((await api.getAdminUpload(failed.id)).upload.status).toBe('PROCESSING');
  expect((await api.getAdminOverview()).uploads.failed).toBe(before.uploads.failed - 1);
  const comment = (await api.getAdminComments({ status: 'VISIBLE' })).data[0];
  await api.hideComment(comment.id, 'Demo hide');
  expect((await api.getAdminComments({ status: 'HIDDEN' })).data.some(row => row.id === comment.id)).toBe(true);
  await api.unhideComment(comment.id, 'Demo restore');
  expect((await api.getAdminComment(comment.id)).comment.isDeleted).toBe(false);
});

test('recalculations resolve the selected synthetic discrepancy and leave others intact', async () => {
  const before = await api.getStatsIntegrity();
  await api.recalculateArtistStats(before.details.staleMonthlyListeners[0].artistId, 'Demo recalculate');
  expect((await api.getStatsIntegrity()).counts).toMatchObject({ staleMonthlyListeners: 0, staleTrackPlayCounts: 1 });
  await api.recalculateStats('Demo tracks', 'trackPlays');
  expect((await api.getStatsIntegrity()).verdict).toBe('PASS');
  expect((await api.getAdminTrack(before.details.staleTrackPlayCounts[0].id)).track.plays).toBe(before.details.staleTrackPlayCounts[0].actualQualifiedPlayEvents);
  expect((await api.getAdminSystem()).readiness.status).toBe('unavailable');
});

test('responses are isolated copies and unknown ids reject without modifying state', async () => {
  const first = await api.getAdminTracks();
  first.data[0].title = 'Mutated response';
  expect((await api.getAdminTracks()).data[0].title).not.toBe('Mutated response');
  const before = await api.getAdminOverview();
  await expect(api.hideTrack('missing', 'Invalid record')).rejects.toThrow('not found');
  await expect(api.getAdminReport('missing')).rejects.toThrow('not found');
  expect(await api.getAdminOverview()).toEqual(before);
});
