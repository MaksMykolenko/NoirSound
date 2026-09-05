import { mockArtists, mockTracks } from './data';

// Synthetic admin sandbox. State lasts for this page session only; never persist
// moderation changes or modify the shared public demo catalog.
const copy = (value) => structuredClone(value);
const now = () => new Date().toISOString();
const ago = (hours) => new Date(Date.now() - hours * 3600000).toISOString();
const users = [
  ...mockArtists.map((artist, i) => ({
    id: `demo-user-${i + 1}`, displayName: artist.name, username: artist.username,
    role: 'ARTIST', status: i === 5 ? 'SUSPENDED' : 'ACTIVE',
  })),
  ...['Olena Kovalenko', 'Jakub Nowak', 'Maya Chen', 'Андрій Мельник', 'Nora Silva', 'Alex Morgan',
    'Sofia Rossi', 'Noah Williams', 'Кіра Лісова', 'Léa Martin', 'Sam Rivera', 'Demo Moderator'].map((name, i) => ({
    id: `demo-user-${i + 7}`, displayName: name, username: i === 11 ? 'demo_moderator' : `listener_${i + 1}`,
    role: i === 11 ? 'ADMIN' : 'LISTENER', status: i === 8 ? 'BANNED' : i === 9 ? 'SUSPENDED' : 'ACTIVE',
  })),
].map((user, i) => ({ ...user, email: `${user.username}@example.invalid`, joinedAt: ago(24 * (i + 7)),
  updatedAt: ago(i * 3), sessions: { active: user.status === 'ACTIVE' ? i % 3 + 1 : 0 } }));
const artists = copy(mockArtists).map((artist, i) => ({
  ...artist, userId: users[i].id, isHidden: i === 5, updatedAt: ago(i * 5),
}));
const tracks = copy(mockTracks).map((track, i) => ({
  ...track, contentType: track.contentType || 'MUSIC',
  status: ['PUBLISHED', 'PUBLISHED', 'HIDDEN', 'PUBLISHED', 'PUBLISHED', 'PENDING_REVIEW',
    'PUBLISHED', 'PROCESSING', 'PUBLISHED', 'FAILED', 'REJECTED', 'DRAFT'][i],
  updatedAt: ago(i * 2), createdAt: ago(24 * (i + 2)),
  lyricsText: typeof track.lyrics === 'string' ? track.lyrics : null,
  lyricsLanguage: track.hasLyrics ? 'en' : null, lyricsRightsConfirmed: Boolean(track.hasLyrics),
}));
const commentTexts = [
  'That bass at 0:42 is incredible.', 'Perfect for a rainy evening. Saved!',
  'Is there a version without vocals?', 'The texture in the second half is beautiful.',
  'Чудова атмосфера, слухаю на повторі.', 'Please credit the original sample.',
  'Repeated promotional message — demo moderation example.', 'Świetny klimat i miks!',
];
const comments = commentTexts.map((text, i) => ({
  id: `demo-comment-${i + 1}`, text, userId: users[i + 6].id, trackId: tracks[i].id,
  isDeleted: i === 6, createdAt: ago(i * 2), updatedAt: ago(i),
}));
const uploadStatuses = ['FAILED', 'PROCESSING', 'READY', 'UPLOADING', 'INITIATED', 'CANCELLED', 'FAILED', 'READY'];
const uploads = uploadStatuses.map((status, i) => ({
  id: `demo-upload-${i + 1}`, trackId: tracks[i].id, userId: artists.find(a => a.id === tracks[i].artistId).userId,
  originalFileName: `${tracks[i].title.toLowerCase().replaceAll(' ', '_')}_master.wav`,
  mimeType: 'audio/wav', sizeBytes: (i + 3) * 8388608, status,
  error: status === 'FAILED' ? 'Demo: audio processing interrupted. Ready to retry.' : null,
  createdAt: ago(i + 2), updatedAt: ago(i),
}));
const targets = [
  ['TRACK', tracks[0].id], ['COMMENT', comments[5].id], ['USER', users[10].id],
  ['ARTIST', artists[3].id], ['TRACK', tracks[4].id], ['COMMENT', comments[6].id],
];
const reportReasons = ['COPYRIGHT', 'SPAM', 'HARASSMENT', 'OTHER'];
const details = [
  'Demo report: this release may contain an uncleared sample. Compare the submitted recording and contact the creator.',
  'Demo report: repeated promotional content appeared several times in a short period.',
  'Demo report: a listener flagged repeated personal remarks. Review the surrounding context before taking action.',
  'Demo report: the title and description appear to describe a different recording.',
];
const reports = Array.from({ length: 32 }, (_, i) => ({
  id: `demo-report-${String(i + 1).padStart(3, '0')}`, targetType: targets[i % targets.length][0],
  targetId: targets[i % targets.length][1], reason: reportReasons[i % 4], details: details[i % 4],
  reporterId: users[6 + i % 11].id,
  status: i < 12 ? 'OPEN' : ['ESCALATED', 'REVIEWED', 'ACTION_TAKEN', 'DISMISSED'][i % 4],
  createdAt: ago(i * 3 + 1), reviewedAt: i < 12 ? null : ago(i),
}));
const auditTemplates = [
  ['TRACK_HIDE', 'TRACK', tracks[2].id],
  ['REPORT_RESOLVE', 'REPORT', reports[0].id],
  ['USER_SUSPEND', 'USER', users[10].id],
  ['UPLOAD_RETRY', 'UPLOAD', uploads[0].id],
  ['ARTIST_HIDE', 'ARTIST', artists[5].id],
  ['COMMENT_HIDE', 'COMMENT', comments[6].id],
];
const audit = Array.from({ length: 126 }, (_, i) => {
  const [action, targetType, targetId] = auditTemplates[i % auditTemplates.length];
  return {
    id: `demo-audit-${String(i + 1).padStart(3, '0')}`, action, actor: copy(users.at(-1)), targetType, targetId,
    reason: i % 19 === 0
      ? 'Synthetic long-form moderation rationale: reviewers compared the resource, surrounding context and prior history before recording this demo decision.'
      : 'Synthetic moderation history for operations preview.',
    result: i % 23 === 0 ? 'FAILURE' : 'SUCCESS', source: i % 9 === 0 ? 'SYSTEM' : 'ADMIN_UI', environment: 'DEMO',
    requestId: `demo-request-${String(i + 1).padStart(4, '0')}`, createdAt: ago(i + 2),
    metadata: { previousState: { status: 'OPEN' }, newState: { status: i % 23 === 0 ? 'UNCHANGED' : 'REVIEWED' }, simulated: true },
  };
});
const integrity = {
  duplicateFollows: [], missingArtistProfiles: [], orphanArtistProfiles: [], orphanPlayEvents: [], orphanFollows: [],
  staleTrackPlayCounts: [{ id: tracks[0].id, title: tracks[0].title, storedPlays: tracks[0].plays, actualQualifiedPlayEvents: tracks[0].plays + 3 }],
  staleMonthlyListeners: [{ artistId: artists[0].id, username: artists[0].username,
    storedMonthlyListeners: artists[0].monthlyListeners, actualMonthlyListeners: artists[0].monthlyListeners + 2 }],
};

function find(rows, id) {
  const row = rows.find(item => item.id === String(id));
  if (!row) throw new Error('Demo record not found.');
  return row;
}
const searchMatch = (query, ...values) => !query || values.some(value => String(value ?? '').toLowerCase().includes(String(query).trim().toLowerCase()));
const equalFilter = (filter, value) => filter === undefined || filter === null || filter === '' || String(filter) === String(value);
const reportCount = (type, id) => reports.filter(r => r.targetType === type && r.targetId === id).length;
const basicUser = (id) => copy(find(users, id));
function artistRow(artist) {
  return { ...artist, user: basicUser(artist.userId), _count: {
    tracks: tracks.filter(t => t.artistId === artist.id).length, followers: artist.followers,
  } };
}
function trackRow(track) {
  return { ...track, artist: artistRow(find(artists, track.artistId)), reportsCount: reportCount('TRACK', track.id),
    streamAvailable: track.status === 'PUBLISHED', _count: { comments: comments.filter(c => c.trackId === track.id && !c.isDeleted).length },
    uploads: uploads.filter(u => u.trackId === track.id) };
}
function userRow(user) {
  const artist = artists.find(a => a.userId === user.id);
  const canUploadTracks = ['ARTIST', 'ADMIN'].includes(user.role) && user.status === 'ACTIVE' && Boolean(artist) && !artist.isHidden;
  return { ...user, hasArtistProfile: Boolean(artist), artistProfileId: artist?.id ?? null,
    artistProfileHidden: Boolean(artist?.isHidden), canUploadTracks,
    uploadAccessReason: canUploadTracks ? null : user.status !== 'ACTIVE' ? `USER_${user.status}`
      : !['ARTIST', 'ADMIN'].includes(user.role) ? 'NOT_ARTIST_ROLE' : !artist ? 'MISSING_ARTIST_PROFILE' : 'ARTIST_PROFILE_HIDDEN',
    artistProfile: artist ? { ...artistRow(artist), tracks: tracks.filter(t => t.artistId === artist.id) } : null,
    counts: { tracks: tracks.filter(t => t.artistId === artist?.id).length, reports: reportCount('USER', user.id),
      comments: comments.filter(c => c.userId === user.id).length } };
}
const reportRow = (report) => ({ ...report, reporter: basicUser(report.reporterId) });
const commentRow = (comment) => ({ ...comment, user: basicUser(comment.userId), track: find(tracks, comment.trackId), reportsCount: reportCount('COMMENT', comment.id) });
const uploadRow = (upload) => ({ ...upload, user: basicUser(upload.userId), track: find(tracks, upload.trackId) });
function paginate(rows, params = {}) {
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(params.pageSize) || 25)));
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(totalPages, Math.max(1, Math.floor(Number(params.page) || 1)));
  return copy({ data: rows.slice((page - 1) * pageSize, page * pageSize), pagination: { page, pageSize, total: rows.length, totalPages } });
}
function log(action, type, row, reason) {
  row.updatedAt = now();
  audit.unshift({ id: `demo-audit-${audit.length + 1}`, action, actor: basicUser(users.at(-1).id),
    targetType: type, targetId: row.id, reason: reason || 'Demo action', result: 'SUCCESS', source: 'ADMIN_UI',
    environment: 'DEMO', requestId: `demo-request-${Date.now()}`, createdAt: now(), metadata: { simulated: true } });
  return copy(row);
}
function change(rows, id, patch, action, type, reason) {
  const row = find(rows, id);
  Object.assign(row, patch);
  return log(action, type, row, reason);
}
const readiness = () => ({ status: 'unavailable', checks: Object.fromEntries(
  ['api', 'database', 'redis', 'storage', 'worker', 'ffmpeg'].map(key => [key, 'unavailable'])) });

export async function getAdminOverview() {
  const count = (rows, status) => rows.filter(row => row.status === status).length;
  return { users: { active: count(users, 'ACTIVE'), suspended: count(users, 'SUSPENDED'), banned: count(users, 'BANNED') },
    tracks: { published: count(tracks, 'PUBLISHED'), hidden: count(tracks, 'HIDDEN') },
    uploads: { failed: count(uploads, 'FAILED'), processing: count(uploads, 'PROCESSING') },
    reports: { pending: count(reports, 'OPEN') + count(reports, 'ESCALATED') },
    comments: { today: comments.filter(c => new Date(c.createdAt).toDateString() === new Date().toDateString()).length },
    playEvents: { today: 128 }, system: readiness() };
}
export async function searchAdmin(query, { signal } = {}) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const q = String(query || '').trim();
  if (q.length < 2) return { groups: [] };
  const destination = (type, id) => {
    if (type === 'auditEvents') return `/admin/audit-logs?event=${encodeURIComponent(id)}`;
    if (type === 'uploads') return `/admin/uploads?search=${encodeURIComponent(id)}`;
    return `/admin/${type}/${encodeURIComponent(id)}`;
  };
  const make = (type, rows, title, subtitle, status) => ({
    type,
    items: rows.slice(0, 5).map(row => ({ id: row.id, title: title(row), subtitle: subtitle(row), status: status(row),
      to: destination(type, row.id) })),
  });
  const groups = [
    make('users', users.filter(u => searchMatch(q, u.id, u.displayName, u.username, u.email)), u => u.displayName, u => `@${u.username}`, u => u.status),
    make('tracks', tracks.filter(t => searchMatch(q, t.id, t.title, t.artistName)), t => t.title, t => t.artistName, t => t.status),
    make('artists', artists.filter(a => searchMatch(q, a.id, a.name, a.username)), a => a.name, a => `@${a.username}`, a => a.isHidden ? 'HIDDEN' : 'ACTIVE'),
    make('reports', reports.filter(r => searchMatch(q, r.id, r.reason, r.targetId)), r => r.reason, r => r.id, r => r.status),
    make('uploads', uploads.filter(u => searchMatch(q, u.id, u.originalFileName)), u => u.originalFileName, u => u.id, u => u.status),
    make('auditEvents', audit.filter(a => searchMatch(q, a.id, a.action, a.targetId, a.reason)), a => a.action, a => a.targetId, () => 'SUCCESS'),
  ].filter(group => group.items.length);
  return copy({ groups });
}
export async function getAdminUsers(params = {}) {
  return paginate(users.map(userRow).filter(u => searchMatch(params.search, u.displayName, u.username, u.email)
    && equalFilter(params.role, u.role) && equalFilter(params.status, u.status)
    && equalFilter(params.hasArtistProfile, u.hasArtistProfile) && equalFilter(params.uploadBlocked, !u.canUploadTracks)), params);
}
export async function getAdminUser(id) { return copy({ user: userRow(find(users, id)), audit: audit.filter(a => a.targetType === 'USER' && a.targetId === id) }); }
export async function getAdminTracks(params = {}) {
  return paginate(tracks.map(trackRow).filter(t => searchMatch(params.search, t.title, t.artist.user.displayName)
    && equalFilter(params.status, t.status) && equalFilter(params.contentType, t.contentType)), params);
}
export async function getAdminTrack(id) { return copy({ track: trackRow(find(tracks, id)), reports: reports.filter(r => r.targetType === 'TRACK' && r.targetId === id).map(reportRow) }); }
export async function getAdminArtists(params = {}) {
  return paginate(artists.map(artistRow).filter(a => searchMatch(params.search, a.name, a.user.username, a.user.email) && equalFilter(params.hidden, a.isHidden)), params);
}
export async function getAdminArtist(id) { const artist = find(artists, id); return copy({ artist: { ...artistRow(artist), tracks: tracks.filter(t => t.artistId === id) } }); }
export async function getAdminReports(params = {}) {
  return paginate(reports.map(reportRow).filter(r => equalFilter(params.status, r.status)
    && equalFilter(params.targetType, r.targetType) && searchMatch(params.reason, r.reason)), params);
}
function reportTarget(report) {
  const rows = { TRACK: tracks, COMMENT: comments, USER: users, ARTIST: artists }[report.targetType];
  return find(rows, report.targetId);
}
export async function getAdminReport(id) { const report = find(reports, id); return copy({ report: reportRow(report), target: reportTarget(report) }); }
export async function getAdminComments(params = {}) {
  return paginate(comments.map(commentRow).filter(c => searchMatch(params.search, c.text, c.user.username)
    && equalFilter(params.status, c.isDeleted ? 'HIDDEN' : 'VISIBLE')), params);
}
export async function getAdminComment(id) { return copy({ comment: commentRow(find(comments, id)) }); }
export async function getAdminUploads(params = {}) {
  return paginate(uploads.map(uploadRow).filter(u => searchMatch(params.search, u.originalFileName, u.user.username, u.track.title) && equalFilter(params.status, u.status)), params);
}
export async function getAdminUpload(id) { return copy({ upload: uploadRow(find(uploads, id)) }); }
function filteredAudit(params = {}) {
  const from = params.from ? new Date(`${params.from}T00:00:00.000Z`) : null;
  const to = params.to ? new Date(`${params.to}T23:59:59.999Z`) : null;
  return audit.filter(a => searchMatch(params.q, a.actor.username, a.actor.displayName, a.action, a.targetType, a.targetId, a.requestId, a.reason)
    && searchMatch(params.actor, a.actor.username, a.actor.displayName, a.actor.id)
    && equalFilter(params.action, a.action) && equalFilter(params.resource || params.targetType, a.targetType)
    && equalFilter(params.environment, a.environment || 'DEMO') && equalFilter(params.result, a.result || 'SUCCESS')
    && (!from || new Date(a.createdAt) >= from) && (!to || new Date(a.createdAt) <= to));
}
export async function getAuditLogs(params = {}, { signal } = {}) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return paginate(filteredAudit(params).map(a => ({ ...a, environment: a.environment || 'DEMO', result: a.result || 'SUCCESS', requestId: a.requestId || `demo-request-${a.id}` })), { ...params, pageSize: params.limit || params.pageSize || 50 });
}
export async function getAuditLog(id, { signal } = {}) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const entry = find(audit, id);
  return copy({ auditLog: { ...entry, environment: entry.environment || 'DEMO', result: entry.result || 'SUCCESS', requestId: entry.requestId || `demo-request-${entry.id}` } });
}
export async function exportAuditLogs(params = {}) {
  const cell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return ['createdAt,actor,action,resource,targetId,reason,result,requestId', ...filteredAudit(params).map(a => [a.createdAt, a.actor.username, a.action, a.targetType, a.targetId, a.reason, a.result || 'SUCCESS', a.requestId || `demo-request-${a.id}`].map(cell).join(','))].join('\n');
}
export async function getAdminTrackPreview(id) { const track = find(tracks, id); return copy({ url: track.audioUrl, expiresAt: null }); }

export async function updateAdminUser(id, payload) {
  const { displayName, username } = payload;
  return change(users, id, { ...(displayName !== undefined && { displayName }), ...(username !== undefined && { username }) }, 'USER_UPDATE', 'USER', payload.reason);
}
export async function suspendUser(id, reason) { return change(users, id, { status: 'SUSPENDED', sessions: { active: 0 } }, 'USER_SUSPEND', 'USER', reason); }
export async function unsuspendUser(id, reason) { return change(users, id, { status: 'ACTIVE' }, 'USER_UNSUSPEND', 'USER', reason); }
export async function banUser(id, reason) { return change(users, id, { status: 'BANNED', sessions: { active: 0 } }, 'USER_BAN', 'USER', reason); }
export async function unbanUser(id, reason) { return change(users, id, { status: 'ACTIVE' }, 'USER_UNBAN', 'USER', reason); }
export async function revokeUserSessions(id, reason) { return change(users, id, { sessions: { active: 0 } }, 'USER_REVOKE_SESSIONS', 'USER', reason); }
function ensureProfile(user) {
  let artist = artists.find(a => a.userId === user.id);
  if (!artist) {
    artist = { id: `demo-artist-${user.id}`, userId: user.id, name: user.displayName, username: user.username, genres: [], isHidden: false, followers: 0, monthlyListeners: 0, updatedAt: now() };
    artists.push(artist);
  }
  return artist;
}
export async function setUserRole(id, role, reason, options = {}) {
  if (!['LISTENER', 'ARTIST', 'ADMIN'].includes(role)) throw new Error('Invalid demo role.');
  const user = find(users, id);
  if (options.createArtistProfile) ensureProfile(user);
  if (options.hideArtistProfile) { const artist = artists.find(a => a.userId === id); if (artist) artist.isHidden = true; }
  if (options.revokeSessions) user.sessions.active = 0;
  user.role = role;
  return log('USER_SET_ROLE', 'USER', user, reason);
}
export async function grantArtistAccess(id, payload = {}) {
  const user = find(users, id);
  if (['BANNED', 'DELETED'].includes(user.status)) throw new Error('Artist access is unavailable for this demo account.');
  if (payload.createProfile !== false) ensureProfile(user).isHidden = false;
  if (user.role !== 'ADMIN') user.role = 'ARTIST';
  if (payload.revokeSessions) user.sessions.active = 0;
  return log('USER_GRANT_ARTIST', 'USER', user, payload.reason);
}
export async function revokeArtistAccess(id, payload = {}) {
  const user = find(users, id);
  const artist = artists.find(a => a.userId === id);
  user.role = 'LISTENER';
  if (payload.hideArtistProfile !== false && artist) artist.isHidden = true;
  if (payload.revokeSessions) user.sessions.active = 0;
  return log('USER_REVOKE_ARTIST', 'USER', user, payload.reason);
}
export async function ensureArtistProfile(id, payload = {}) {
  const user = find(users, id); ensureProfile(user);
  if (payload.revokeSessions) user.sessions.active = 0;
  return log('USER_ENSURE_ARTIST_PROFILE', 'USER', user, payload.reason);
}
export async function hideTrack(id, reason) { return change(tracks, id, { status: 'HIDDEN' }, 'TRACK_HIDE', 'TRACK', reason); }
export async function unhideTrack(id, reason) { return change(tracks, id, { status: 'PUBLISHED' }, 'TRACK_UNHIDE', 'TRACK', reason); }
export async function rejectTrack(id, reason) { return change(tracks, id, { status: 'REJECTED' }, 'TRACK_REJECT', 'TRACK', reason); }
export async function restoreTrack(id, reason) { return change(tracks, id, { status: 'PUBLISHED' }, 'TRACK_RESTORE', 'TRACK', reason); }
export async function forceReprocessTrack(id, reason) { return change(tracks, id, { status: 'PROCESSING' }, 'TRACK_REPROCESS', 'TRACK', reason); }
export async function removeTrackLyrics(id, reason) { return change(tracks, id, { hasLyrics: false, lyricsText: null, lyrics: null, lyricsType: null, lyricsLanguage: null, lyricsRightsConfirmed: false }, 'TRACK_LYRICS_REMOVE', 'TRACK', reason); }
export async function updateTrackContentType(id, payload) {
  if (!['MUSIC', 'BEAT'].includes(payload.contentType)) throw new Error('Invalid demo content type.');
  const patch = {};
  for (const key of ['contentType', 'bpm', 'key', 'mood', 'style', 'licenseType', 'usageNotes', 'contactEnabled']) {
    if (payload[key] !== undefined) patch[key] = payload[key];
  }
  return change(tracks, id, patch, 'TRACK_CONTENT_TYPE_UPDATE', 'TRACK', payload.reason);
}
export async function hideArtist(id, reason) { return change(artists, id, { isHidden: true }, 'ARTIST_HIDE', 'ARTIST', reason); }
export async function unhideArtist(id, reason) { return change(artists, id, { isHidden: false }, 'ARTIST_UNHIDE', 'ARTIST', reason); }
export async function retryUpload(id, reason) { return change(uploads, id, { status: 'PROCESSING', error: null }, 'UPLOAD_RETRY', 'UPLOAD', reason); }
export async function cancelUpload(id, reason) { return change(uploads, id, { status: 'CANCELLED' }, 'UPLOAD_CANCEL', 'UPLOAD', reason); }
export async function hideComment(id, reason) { return change(comments, id, { isDeleted: true }, 'COMMENT_HIDE', 'COMMENT', reason); }
export async function unhideComment(id, reason) { return change(comments, id, { isDeleted: false }, 'COMMENT_UNHIDE', 'COMMENT', reason); }
export async function resolveReport(id, payload = {}) {
  const report = find(reports, id);
  const action = payload.targetAction || 'NONE';
  const target = reportTarget(report);
  if (action === 'HIDE_TARGET') {
    const hide = { TRACK: hideTrack, COMMENT: hideComment, ARTIST: hideArtist }[report.targetType];
    if (!hide) throw new Error('This demo target cannot be hidden.');
    await hide(target.id, payload.notes);
  } else if (action === 'SUSPEND_USER') {
    const userId = report.targetType === 'USER' ? target.id : report.targetType === 'TRACK' ? find(artists, target.artistId).userId : target.userId;
    await suspendUser(userId, payload.notes);
  } else if (action !== 'NONE') throw new Error('Invalid demo report action.');
  return change(reports, id, { status: action === 'NONE' ? 'REVIEWED' : 'ACTION_TAKEN', reviewedAt: now(), notes: payload.notes }, 'REPORT_RESOLVE', 'REPORT', payload.notes);
}
export async function rejectReport(id, reason) { return change(reports, id, { status: 'DISMISSED', reviewedAt: now() }, 'REPORT_REJECT', 'REPORT', reason); }
export async function escalateReport(id, reason) { return change(reports, id, { status: 'ESCALATED' }, 'REPORT_ESCALATE', 'REPORT', reason); }
export async function getAdminSystem() {
  const count = status => uploads.filter(u => u.status === status).length;
  return { readiness: readiness(), version: 'Demo simulation', commit: null, uptimeSeconds: null, config: {},
    queue: { counts: { waiting: count('INITIATED'), active: count('PROCESSING'), completed: count('READY'), failed: count('FAILED'), delayed: 0 } } };
}
export async function getStatsIntegrity() {
  const counts = Object.fromEntries(Object.entries(integrity).map(([key, rows]) => [key, rows.length]));
  return copy({ generatedAt: now(), verdict: Object.values(counts).some(Boolean) ? 'FAIL' : 'PASS', counts, details: integrity });
}
export async function recalculateStats(reason, target = 'all') {
  if (!['all', 'monthlyListeners', 'trackPlays'].includes(target)) throw new Error('Invalid demo recalculation target.');
  if (target === 'all' || target === 'trackPlays') {
    for (const row of integrity.staleTrackPlayCounts) find(tracks, row.id).plays = row.actualQualifiedPlayEvents;
    integrity.staleTrackPlayCounts = [];
  }
  if (target === 'all' || target === 'monthlyListeners') {
    for (const row of integrity.staleMonthlyListeners) find(artists, row.artistId).monthlyListeners = row.actualMonthlyListeners;
    integrity.staleMonthlyListeners = [];
  }
  log('STATS_RECALCULATE', 'SYSTEM', { id: target }, reason);
  return getStatsIntegrity();
}
export async function recalculateArtistStats(id, reason) {
  const artist = find(artists, id);
  const issue = integrity.staleMonthlyListeners.find(row => row.artistId === id);
  if (issue) artist.monthlyListeners = issue.actualMonthlyListeners;
  integrity.staleMonthlyListeners = integrity.staleMonthlyListeners.filter(row => row.artistId !== id);
  log('ARTIST_STATS_RECALCULATE', 'ARTIST', artist, reason);
  return getStatsIntegrity();
}
