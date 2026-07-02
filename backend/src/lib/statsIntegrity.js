'use strict';

// Read-only stats/data integrity checks. Every function here only reads --
// none of them mutate anything. Shared verbatim by scripts/check-stats-integrity.js
// (CLI) and GET /api/admin/stats/integrity (admin UI) so the two can never
// disagree about what counts as a mismatch.

const { computeArtistMonthlyListeners } = require('./statsAccess');

/** ArtistFollow's PK is the (userId, artistId) composite, so true duplicate
 * rows are structurally impossible -- this is a defensive invariant check,
 * not an expected source of findings. */
async function findDuplicateFollows(prisma) {
  const groups = await prisma.artistFollow.groupBy({
    by: ['userId', 'artistId'],
    _count: { _all: true }
  });
  return groups
    .filter((group) => group._count._all > 1)
    .map((group) => ({ userId: group.userId, artistId: group.artistId, count: group._count._all }));
}

/** Users with role ARTIST but no ArtistProfile row -- role ARTIST is only
 * ever assigned in the same transaction that creates the profile (see
 * grantArtistAccess in artistAccess.js), so the two should never diverge;
 * a mismatch here means a partial write or manual DB edit corrupted the
 * pairing (see NOIRSOUND_ARTIST_ACCESS_ADMIN_AUDIT.md from the prior QA
 * pass).
 *
 * ADMIN is deliberately excluded: becoming an ADMIN never auto-creates a
 * profile (an explicit, tested contract -- "set-role to ADMIN does not
 * auto-create a profile unless explicitly requested"), and an admin with
 * no profile is a normal, common, fully-supported state with its own named
 * upload-access reason (MISSING_ARTIST_PROFILE), not a data bug. Flagging
 * every profile-less admin as a FAIL would be a false positive that no
 * "repair" could legitimately fix, since auto-granting artist profiles to
 * admins is not correct behavior either. */
async function findMissingArtistProfiles(prisma) {
  return prisma.user.findMany({
    where: {
      role: 'ARTIST',
      status: { not: 'DELETED' },
      artistProfile: null
    },
    select: { id: true, username: true, email: true, role: true }
  });
}

/** ArtistProfile.userId is a required, foreign-keyed, cascade-deleted
 * relation, so an orphaned profile is structurally impossible -- defensive
 * check, not an expected source of findings. */
async function findOrphanArtistProfiles(prisma) {
  const profiles = await prisma.artistProfile.findMany({
    select: { id: true, userId: true, user: { select: { id: true } } }
  });
  return profiles
    .filter((profile) => !profile.user)
    .map((profile) => ({ artistProfileId: profile.id, userId: profile.userId }));
}

/** Track.plays (a stored aggregate) vs. the real qualified PlayEvent count
 * for that track -- these can drift if a manual DB edit, a bug, or a schema
 * change (like the qualified-flag migration in this pass) changes the true
 * count without recomputing the cache. */
async function findStaleTrackPlayCounts(prisma) {
  const [tracks, grouped] = await Promise.all([
    prisma.track.findMany({ select: { id: true, title: true, plays: true } }),
    prisma.playEvent.groupBy({ by: ['trackId'], where: { qualified: true }, _count: { _all: true } })
  ]);
  const actualByTrack = new Map(grouped.map((group) => [group.trackId, group._count._all]));
  return tracks
    .map((track) => ({
      trackId: track.id,
      title: track.title,
      storedPlays: track.plays,
      actualQualifiedPlayEvents: actualByTrack.get(track.id) || 0
    }))
    .filter((row) => row.storedPlays !== row.actualQualifiedPlayEvents);
}

/** ArtistProfile.monthlyListeners (a stored, kept-fresh-on-write cache) vs.
 * a fresh distinct-listener recomputation -- see statsAccess.js for the
 * exact rule. Genuinely expected to be 0 in normal operation since it is
 * refreshed on every qualifying play; a nonzero result usually means the
 * 30-day window simply rolled since the last qualifying play (an artist
 * with no *new* activity does not get an automatic refresh), which is
 * exactly what `stats:check` / the admin recalculate button are for. */
async function findStaleMonthlyListeners(prisma, now = new Date()) {
  const artists = await prisma.artistProfile.findMany({
    select: {
      id: true,
      userId: true,
      monthlyListeners: true,
      user: { select: { username: true } }
    }
  });
  const results = [];
  for (const artist of artists) {
    // Sequential on purpose -- see recalculateAllArtistMonthlyListeners for
    // the same rationale; this is an occasional admin/CLI action, not a hot path.
    // eslint-disable-next-line no-await-in-loop
    const actual = await computeArtistMonthlyListeners(prisma, artist.id, artist.userId, now);
    if (actual !== artist.monthlyListeners) {
      results.push({
        artistId: artist.id,
        username: artist.user?.username || null,
        storedMonthlyListeners: artist.monthlyListeners,
        actualMonthlyListeners: actual
      });
    }
  }
  return results;
}

/** PlayEvent rows referencing a track or user id that no longer exists.
 * Track is a required, cascade-deleted relation so this should be
 * structurally impossible; userId is nullable + SetNull on delete, so a
 * dangling userId is also impossible by construction. Defensive check. */
async function findOrphanPlayEvents(prisma) {
  const [events, trackIds, userIds] = await Promise.all([
    prisma.playEvent.findMany({ select: { id: true, trackId: true, userId: true } }),
    prisma.track.findMany({ select: { id: true } }),
    prisma.user.findMany({ select: { id: true } })
  ]);
  const trackIdSet = new Set(trackIds.map((track) => track.id));
  const userIdSet = new Set(userIds.map((user) => user.id));
  return events
    .filter((event) => !trackIdSet.has(event.trackId) || (event.userId && !userIdSet.has(event.userId)))
    .map((event) => ({ playEventId: event.id, trackId: event.trackId, userId: event.userId }));
}

/** ArtistFollow rows aimed at an ArtistProfile id that no longer exists, or
 * a follower count that would disagree with a live COUNT -- both should be
 * structurally impossible (composite FK + cascade delete, and followers is
 * never a stored aggregate, always a live count), included as a defensive
 * invariant check for completeness. */
async function findOrphanFollows(prisma) {
  const [follows, artistIds, userIds] = await Promise.all([
    prisma.artistFollow.findMany({ select: { userId: true, artistId: true } }),
    prisma.artistProfile.findMany({ select: { id: true } }),
    prisma.user.findMany({ select: { id: true } })
  ]);
  const artistIdSet = new Set(artistIds.map((artist) => artist.id));
  const userIdSet = new Set(userIds.map((user) => user.id));
  return follows
    .filter((follow) => !artistIdSet.has(follow.artistId) || !userIdSet.has(follow.userId))
    .map((follow) => ({ userId: follow.userId, artistId: follow.artistId }));
}

/** Runs every check and returns a single structured report plus a verdict.
 * Pure/read-only -- safe to call as often as desired. */
async function runStatsIntegrityCheck(prisma, now = new Date()) {
  const [
    duplicateFollows,
    missingArtistProfiles,
    orphanArtistProfiles,
    staleTrackPlayCounts,
    staleMonthlyListeners,
    orphanPlayEvents,
    orphanFollows
  ] = await Promise.all([
    findDuplicateFollows(prisma),
    findMissingArtistProfiles(prisma),
    findOrphanArtistProfiles(prisma),
    findStaleTrackPlayCounts(prisma),
    findStaleMonthlyListeners(prisma, now),
    findOrphanPlayEvents(prisma),
    findOrphanFollows(prisma)
  ]);

  const counts = {
    duplicateFollows: duplicateFollows.length,
    missingArtistProfiles: missingArtistProfiles.length,
    orphanArtistProfiles: orphanArtistProfiles.length,
    staleTrackPlayCounts: staleTrackPlayCounts.length,
    staleMonthlyListeners: staleMonthlyListeners.length,
    orphanPlayEvents: orphanPlayEvents.length,
    orphanFollows: orphanFollows.length
  };
  const totalIssues = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return {
    generatedAt: now.toISOString(),
    counts,
    verdict: totalIssues === 0 ? 'PASS' : 'FAIL',
    details: {
      duplicateFollows,
      missingArtistProfiles,
      orphanArtistProfiles,
      staleTrackPlayCounts,
      staleMonthlyListeners,
      orphanPlayEvents,
      orphanFollows
    }
  };
}

module.exports = {
  findDuplicateFollows,
  findMissingArtistProfiles,
  findOrphanArtistProfiles,
  findStaleTrackPlayCounts,
  findStaleMonthlyListeners,
  findOrphanPlayEvents,
  findOrphanFollows,
  runStatsIntegrityCheck
};
