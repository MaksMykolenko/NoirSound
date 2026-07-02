'use strict';

// Shared source-of-truth helpers for play qualification and artist monthly
// listeners. See NOIRSOUND_STATS_DATA_AUDIT.md for the full rationale.

const QUALIFY_CAP_SECONDS = 30;
const MONTHLY_WINDOW_DAYS = 30;

/**
 * A play "qualifies" once the listener has been listening for at least
 * min(30s, 50% of the track's real duration) -- whichever is smaller. If the
 * track's duration is unknown (<=0), only the flat 30s rule can apply, since
 * "50% of an unknown length" cannot be evaluated.
 */
function qualifyThresholdSeconds(trackDurationSeconds) {
  const duration = Number(trackDurationSeconds) || 0;
  if (duration <= 0) return QUALIFY_CAP_SECONDS;
  return Math.min(QUALIFY_CAP_SECONDS, duration * 0.5);
}

/**
 * Recomputed server-side from the reported duration vs. the track's actual
 * duration -- a client-sent "qualified"/"completed" flag is never trusted
 * directly for this decision.
 */
function isQualifiedPlay(durationListenedSeconds, trackDurationSeconds) {
  const listened = Number(durationListenedSeconds) || 0;
  if (listened <= 0) return false;
  return listened >= qualifyThresholdSeconds(trackDurationSeconds);
}

function monthlyWindowStart(now = new Date()) {
  return new Date(now.getTime() - MONTHLY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Distinct-listener count for one artist over the trailing 30 days.
 *
 * Listener identity priority per the product rule documented in
 * NOIRSOUND_STATS_DATA_AUDIT.md: authenticated userId is the only identity
 * used today. The client does not populate PlayEvent.sessionId yet and no
 * IP/user-agent capture exists, so neither is a reliable or privacy-safe
 * stand-in identity -- anonymous qualified plays still increment Track.plays,
 * but are not counted as a distinct monthly listener.
 *
 * The artist's own plays of their own tracks are excluded so an artist
 * cannot trivially inflate their own monthly-listener count by replaying
 * their own release.
 */
async function computeArtistMonthlyListeners(prisma, artistId, ownerUserId, now = new Date()) {
  const since = monthlyWindowStart(now);
  const rows = await prisma.playEvent.findMany({
    where: {
      artistId,
      qualified: true,
      userId: ownerUserId ? { not: ownerUserId } : { not: null },
      createdAt: { gte: since },
      // "Monthly listeners" reflects standing against the artist's *current*
      // public catalog: a play recorded while a track was published still
      // stops contributing once that track is later hidden/unpublished (e.g.
      // taken down for a copyright claim). This is deliberately different
      // from Track.plays, which is a lifetime count of a specific track's
      // own history and is never revised by a later visibility change.
      track: { status: 'PUBLISHED' }
    },
    select: { userId: true },
    distinct: ['userId']
  });
  // `userId: { not: ownerUserId }` still admits null (anonymous) rows in
  // Prisma's NOT semantics, so filter those out explicitly -- anonymous
  // plays are not a distinct identity we can count.
  return rows.filter((row) => row.userId !== null).length;
}

/**
 * Recomputes and persists ArtistProfile.monthlyListeners for one artist.
 * Safe to call as often as needed -- it is a pure recomputation, not an
 * increment, so it can never drift further from the truth by being called
 * repeatedly or concurrently.
 */
async function recalculateArtistMonthlyListeners(prisma, artistId, now = new Date()) {
  const artist = await prisma.artistProfile.findUnique({
    where: { id: artistId },
    select: { id: true, userId: true, monthlyListeners: true }
  });
  if (!artist) return null;

  const monthlyListeners = await computeArtistMonthlyListeners(prisma, artist.id, artist.userId, now);
  const changed = monthlyListeners !== artist.monthlyListeners;
  if (changed) {
    await prisma.artistProfile.update({
      where: { id: artist.id },
      data: { monthlyListeners }
    });
  }
  return {
    artistId: artist.id,
    previousMonthlyListeners: artist.monthlyListeners,
    monthlyListeners,
    changed
  };
}

/** Recomputes every artist's monthlyListeners. Intended for admin/on-demand use. */
async function recalculateAllArtistMonthlyListeners(prisma, now = new Date()) {
  const artists = await prisma.artistProfile.findMany({ select: { id: true } });
  const results = [];
  for (const artist of artists) {
    // Sequential on purpose: this runs rarely (admin action), and keeps
    // each recalculation a simple, easy-to-audit unit of work.
    // eslint-disable-next-line no-await-in-loop
    const result = await recalculateArtistMonthlyListeners(prisma, artist.id, now);
    if (result) results.push(result);
  }
  return results;
}

/**
 * Recomputes Track.plays from the real qualified PlayEvent count for every
 * track -- a pure recomputation (not an increment), safe to call as often as
 * needed. Intended for admin/on-demand use and for the repair script.
 */
async function recalculateAllTrackPlayCounts(prisma) {
  const [tracks, grouped] = await Promise.all([
    prisma.track.findMany({ select: { id: true, plays: true } }),
    prisma.playEvent.groupBy({ by: ['trackId'], where: { qualified: true }, _count: { _all: true } })
  ]);
  const actualByTrack = new Map(grouped.map((group) => [group.trackId, group._count._all]));
  const results = [];
  for (const track of tracks) {
    const actualPlays = actualByTrack.get(track.id) || 0;
    const changed = actualPlays !== track.plays;
    if (changed) {
      // eslint-disable-next-line no-await-in-loop
      await prisma.track.update({ where: { id: track.id }, data: { plays: actualPlays } });
    }
    results.push({ trackId: track.id, previousPlays: track.plays, plays: actualPlays, changed });
  }
  return results;
}

module.exports = {
  QUALIFY_CAP_SECONDS,
  MONTHLY_WINDOW_DAYS,
  qualifyThresholdSeconds,
  isQualifiedPlay,
  monthlyWindowStart,
  computeArtistMonthlyListeners,
  recalculateArtistMonthlyListeners,
  recalculateAllArtistMonthlyListeners,
  recalculateAllTrackPlayCounts
};
