'use strict';

// Single source of truth for "does this user have working artist upload
// access", and for the state transitions that grant/revoke it. Used by the
// admin artist-access endpoints, the upload-init route, and the auth/me
// route so the same rules apply everywhere instead of being re-implemented
// per call site.

const UPLOAD_ROLES = ['ARTIST', 'ADMIN'];
const BLOCKED_STATUSES = ['BANNED', 'DELETED'];

const UPLOAD_ACCESS_REASONS = Object.freeze({
  NOT_ARTIST_ROLE: 'NOT_ARTIST_ROLE',
  MISSING_ARTIST_PROFILE: 'MISSING_ARTIST_PROFILE',
  ARTIST_PROFILE_HIDDEN: 'ARTIST_PROFILE_HIDDEN',
  USER_SUSPENDED: 'USER_SUSPENDED',
  USER_BANNED: 'USER_BANNED',
  USER_DELETED: 'USER_DELETED'
});

// Prisma select shape shared by every route that needs to decide artist
// access. Keeping it here means the admin routes, the upload route, and the
// auth route all agree on exactly what "the user" looks like for this
// purpose.
const ARTIST_ACCESS_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  role: true,
  status: true,
  artistProfile: { select: { id: true, isHidden: true } }
};

function defaultArtistProfileData(userId) {
  return {
    userId,
    monthlyListeners: 0,
    genres: [],
    socialLinks: {},
    isHidden: false
  };
}

/**
 * Pure decision: can this user upload tracks right now, and if not, why?
 * Account-standing problems are reported before role/profile problems,
 * since fixing those is a prerequisite to everything else.
 */
function evaluateUploadAccess({ role, status, artistProfile }) {
  if (status === 'DELETED') {
    return { canUploadTracks: false, uploadAccessReason: UPLOAD_ACCESS_REASONS.USER_DELETED };
  }
  if (status === 'BANNED') {
    return { canUploadTracks: false, uploadAccessReason: UPLOAD_ACCESS_REASONS.USER_BANNED };
  }
  if (status === 'SUSPENDED') {
    return { canUploadTracks: false, uploadAccessReason: UPLOAD_ACCESS_REASONS.USER_SUSPENDED };
  }
  if (!UPLOAD_ROLES.includes(role)) {
    return { canUploadTracks: false, uploadAccessReason: UPLOAD_ACCESS_REASONS.NOT_ARTIST_ROLE };
  }
  if (!artistProfile) {
    return { canUploadTracks: false, uploadAccessReason: UPLOAD_ACCESS_REASONS.MISSING_ARTIST_PROFILE };
  }
  if (artistProfile.isHidden) {
    return { canUploadTracks: false, uploadAccessReason: UPLOAD_ACCESS_REASONS.ARTIST_PROFILE_HIDDEN };
  }
  return { canUploadTracks: true, uploadAccessReason: null };
}

/**
 * Expand a user row (with `artistProfile: { id, isHidden } | null` attached)
 * into the full artist-access contract used by the admin API and the client.
 */
function summarizeArtistAccess(user) {
  const artistProfile = user.artistProfile || null;
  return {
    hasArtistProfile: Boolean(artistProfile),
    artistProfileId: artistProfile?.id || null,
    artistProfileHidden: artistProfile?.isHidden || false,
    ...evaluateUploadAccess({ role: user.role, status: user.status, artistProfile })
  };
}

/** Fetch + summarize in one call. Returns null if the user does not exist. */
async function getArtistAccessState(client, userId) {
  const user = await client.user.findUnique({ where: { id: userId }, select: ARTIST_ACCESS_USER_SELECT });
  if (!user) return null;
  return { ...user, ...summarizeArtistAccess(user) };
}

/**
 * Idempotently ensure `userId` has an ArtistProfile. Never creates a
 * duplicate: checks first, and additionally treats a unique-constraint
 * violation (P2002 on the concurrent-request race) as success by re-reading
 * the row that won the race, rather than surfacing an error.
 */
async function ensureArtistProfile(client, userId) {
  const existing = await client.artistProfile.findUnique({ where: { userId } });
  if (existing) return { profile: existing, created: false };
  try {
    const created = await client.artistProfile.create({ data: defaultArtistProfileData(userId) });
    return { profile: created, created: true };
  } catch (error) {
    if (error && error.code === 'P2002') {
      const raced = await client.artistProfile.findUnique({ where: { userId } });
      if (raced) return { profile: raced, created: false };
    }
    throw error;
  }
}

/**
 * Grant artist upload access to an already-fetched, already-validated
 * `target` (a row shaped like ARTIST_ACCESS_USER_SELECT). Pass a `tx` to run
 * atomically with the caller's own audit writes. Performs, but does not
 * audit-log, the underlying writes — the route owns audit rows so it can
 * attach the actor/reason once and decide the top-level action name; this
 * mirrors how every other admin mutation in this codebase writes its own
 * audit rows inline rather than delegating that to a data helper.
 *
 * Non-negotiable safety rules enforced here regardless of options:
 *  - an ADMIN's role is never changed by this function;
 *  - a BANNED/DELETED target must be rejected by the caller before calling
 *    this (see routes/admin.js) — granting access never silently reactivates
 *    a banned or deleted account;
 *  - never creates a second ArtistProfile for the same user.
 */
async function grantArtistAccess(client, target, options = {}) {
  const createProfile = options.createProfile !== false;
  const revokeSessions = options.revokeSessions !== false;

  const previousRole = target.role;
  const previousStatus = target.status;
  const nextRole = target.role === 'ADMIN' ? 'ADMIN' : 'ARTIST';
  // Suspension is lifted as part of an explicit grant (the admin is actively
  // reviewing this account); a ban or deletion is a separate, deliberate
  // action and is never touched here.
  const nextStatus = target.status === 'SUSPENDED' ? 'ACTIVE' : target.status;
  const roleChanged = nextRole !== previousRole;
  const statusChanged = nextStatus !== previousStatus;

  if (roleChanged || statusChanged) {
    await client.user.update({
      where: { id: target.id },
      data: {
        ...(roleChanged ? { role: nextRole } : {}),
        ...(statusChanged ? { status: nextStatus } : {})
      }
    });
  }

  const profileResult = createProfile
    ? await ensureArtistProfile(client, target.id)
    : { profile: target.artistProfile, created: false };

  // A hidden profile blocks uploads just like a missing one does (see
  // evaluateUploadAccess). "Grant artist access" means "this account can
  // upload after this call succeeds", so a previously hidden profile is
  // unhidden as part of the grant — otherwise re-granting access after an
  // earlier revoke would silently leave uploads blocked. Not gated by an
  // option: it is inherent to what "grant" means, the same way lifting a
  // SUSPENDED status above is.
  let profile = profileResult.profile;
  let profileUnhiddenNow = false;
  if (profile && profile.isHidden) {
    profile = await client.artistProfile.update({ where: { id: profile.id }, data: { isHidden: false } });
    profileUnhiddenNow = true;
  }

  let revokedSessionCount = null;
  if (revokeSessions) {
    const result = await client.session.deleteMany({ where: { userId: target.id } });
    revokedSessionCount = result.count;
  }

  return {
    previousRole,
    nextRole,
    roleChanged,
    previousStatus,
    nextStatus,
    statusChanged,
    profile,
    profileCreated: profileResult.created,
    profileUnhiddenNow,
    sessionsRevoked: revokeSessions,
    revokedSessionCount
  };
}

/**
 * Revoke artist upload access from an already-fetched `target`. An ADMIN's
 * role is never changed (only their profile may be hidden); tracks and the
 * ArtistProfile row itself are never deleted — only ever hidden.
 */
async function revokeArtistAccess(client, target, options = {}) {
  const hideArtistProfile = options.hideArtistProfile !== false;
  const revokeSessions = options.revokeSessions !== false;

  const previousRole = target.role;
  const nextRole = target.role === 'ARTIST' ? 'LISTENER' : target.role;
  const roleChanged = nextRole !== previousRole;
  if (roleChanged) {
    await client.user.update({ where: { id: target.id }, data: { role: nextRole } });
  }

  let profile = target.artistProfile || null;
  let profileHiddenNow = false;
  if (hideArtistProfile && profile && !profile.isHidden) {
    profile = await client.artistProfile.update({ where: { id: profile.id }, data: { isHidden: true } });
    profileHiddenNow = true;
  }

  let revokedSessionCount = null;
  if (revokeSessions) {
    const result = await client.session.deleteMany({ where: { userId: target.id } });
    revokedSessionCount = result.count;
  }

  return {
    previousRole,
    nextRole,
    roleChanged,
    profile,
    profileHiddenNow,
    sessionsRevoked: revokeSessions,
    revokedSessionCount
  };
}

module.exports = {
  UPLOAD_ROLES,
  BLOCKED_STATUSES,
  UPLOAD_ACCESS_REASONS,
  ARTIST_ACCESS_USER_SELECT,
  defaultArtistProfileData,
  evaluateUploadAccess,
  summarizeArtistAccess,
  getArtistAccessState,
  ensureArtistProfile,
  grantArtistAccess,
  revokeArtistAccess
};
