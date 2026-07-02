import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import buildServer from '../src/index';
import seedModule from '../prisma/seed';

const { seedDemo } = seedModule;

// Dedicated coverage for the NoirSound Stats, Followers, Listening Data
// Integrity QA pass. Uses its own freshly created artist/track/listener
// fixtures (rather than the shared demo catalogue) so these assertions can
// never be affected by what other test files do to the demo rows, and vice
// versa. See NOIRSOUND_STATS_DATA_AUDIT.md for the rules under test.
describe('stats, followers, and listening data integrity', () => {
  let app;
  let adminCookie;
  const previousRateMultiplier = process.env.RATE_LIMIT_MULTIPLIER;

  beforeAll(async () => {
    process.env.RATE_LIMIT_MULTIPLIER = '10';
    app = buildServer();
    await app.ready();
    await seedDemo(app.prisma);

    const adminLogin = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'admin@noirsound.com', password: 'password123' });
    adminCookie = adminLogin.headers['set-cookie'];
  });

  afterAll(async () => {
    await app.close();
    if (previousRateMultiplier === undefined) delete process.env.RATE_LIMIT_MULTIPLIER;
    else process.env.RATE_LIMIT_MULTIPLIER = previousRateMultiplier;
  });

  async function registerUser(role, overrides = {}) {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const credentials = {
      email: `stats_qa_${suffix}@test.local`,
      password: 'Password123!',
      username: `stats_qa_${suffix}`,
      displayName: 'Stats QA Fixture User',
      ...overrides
    };
    const registered = await supertest(app.server).post('/api/auth/register').send(credentials);
    expect(registered.statusCode).toBe(200);
    if (role && role !== 'LISTENER') {
      await app.prisma.user.update({ where: { id: registered.body.user.id }, data: { role } });
    }
    return { id: registered.body.user.id, cookie: registered.headers['set-cookie'] };
  }

  // Creates a brand-new artist with a single PUBLISHED track, isolated from
  // every other test's data.
  async function createArtistWithTrack({ durationSeconds = 200 } = {}) {
    const artistUser = await registerUser('ARTIST');
    const artistProfile = await app.prisma.artistProfile.create({
      data: { userId: artistUser.id, genres: [], monthlyListeners: 0 }
    });
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const track = await app.prisma.track.create({
      data: {
        slug: `stats-qa-${suffix}`,
        artistId: artistProfile.id,
        title: 'Stats QA Fixture Track',
        genre: 'electronic',
        tags: [],
        durationSeconds,
        status: 'PUBLISHED',
        releaseDate: new Date(),
        publishedAt: new Date()
      }
    });
    return { artistUser, artistProfile, track };
  }

  describe('follow / unfollow', () => {
    it('requires authentication', async () => {
      const { artistProfile } = await createArtistWithTrack();
      const response = await supertest(app.server).post(`/api/artists/${artistProfile.id}/follow`);
      expect(response.statusCode).toBe(401);
    });

    it('follows exactly once even when called twice, and unfollow is a stable no-op', async () => {
      const { artistProfile } = await createArtistWithTrack();
      const follower = await registerUser('LISTENER');

      const first = await supertest(app.server)
        .post(`/api/artists/${artistProfile.id}/follow`)
        .set('Cookie', follower.cookie)
        .send({});
      expect(first.statusCode).toBe(200);
      expect(first.body.following).toBe(true);
      expect(first.body.followerCount).toBe(1);

      // Calling follow again must not create a second row or inflate the count.
      const second = await supertest(app.server)
        .post(`/api/artists/${artistProfile.id}/follow`)
        .set('Cookie', follower.cookie)
        .send({});
      expect(second.statusCode).toBe(200);
      expect(second.body.followerCount).toBe(1);
      expect(await app.prisma.artistFollow.count({
        where: { userId: follower.id, artistId: artistProfile.id }
      })).toBe(1);

      const artistRead = await supertest(app.server)
        .get(`/api/artists/${artistProfile.id}`)
        .set('Cookie', follower.cookie);
      expect(artistRead.body.artist.isFollowing).toBe(true);
      expect(artistRead.body.artist._count.followers).toBe(1);

      const unfollow = await supertest(app.server)
        .post(`/api/artists/${artistProfile.id}/unfollow`)
        .set('Cookie', follower.cookie)
        .send({});
      expect(unfollow.statusCode).toBe(200);
      expect(unfollow.body.unfollowed).toBe(true);
      expect(unfollow.body.followerCount).toBe(0);

      // Unfollowing again when already not following must not error.
      const unfollowAgain = await supertest(app.server)
        .post(`/api/artists/${artistProfile.id}/unfollow`)
        .set('Cookie', follower.cookie)
        .send({});
      expect(unfollowAgain.statusCode).toBe(200);
      expect(unfollowAgain.body.unfollowed).toBe(false);
      expect(unfollowAgain.body.followerCount).toBe(0);
    });

    it('does not let an artist follow their own profile', async () => {
      const { artistProfile, artistUser } = await createArtistWithTrack();
      const login = await supertest(app.server)
        .post('/api/auth/login')
        .send({ email: (await app.prisma.user.findUnique({ where: { id: artistUser.id } })).email, password: 'Password123!' });
      const response = await supertest(app.server)
        .post(`/api/artists/${artistProfile.id}/follow`)
        .set('Cookie', login.headers['set-cookie'])
        .send({});
      expect(response.statusCode).toBe(400);
    });

    it('returns 404 for a nonexistent artist', async () => {
      const follower = await registerUser('LISTENER');
      const response = await supertest(app.server)
        .post('/api/artists/00000000-0000-0000-0000-000000000000/follow')
        .set('Cookie', follower.cookie)
        .send({});
      expect(response.statusCode).toBe(404);
    });
  });

  describe('qualified plays', () => {
    it('does not count a play below the qualifying threshold', async () => {
      const { artistProfile, track } = await createArtistWithTrack({ durationSeconds: 200 });
      const listener = await registerUser('LISTENER');

      // Threshold is min(30, 200*0.5) = 30s; 10s must not qualify.
      const response = await supertest(app.server)
        .post(`/api/tracks/${track.id}/play-event`)
        .set('Cookie', listener.cookie)
        .send({ durationListenedSeconds: 10, completed: false });

      expect(response.statusCode).toBe(200);
      expect(response.body.qualified).toBe(false);

      const updatedTrack = await app.prisma.track.findUnique({ where: { id: track.id } });
      expect(updatedTrack.plays).toBe(0);
      const updatedArtist = await app.prisma.artistProfile.findUnique({ where: { id: artistProfile.id } });
      expect(updatedArtist.monthlyListeners).toBe(0);
    });

    it('counts a play once it crosses the qualifying threshold, and updates plays + monthly listeners', async () => {
      const { artistProfile, track } = await createArtistWithTrack({ durationSeconds: 200 });
      const listener = await registerUser('LISTENER');

      const response = await supertest(app.server)
        .post(`/api/tracks/${track.id}/play-event`)
        .set('Cookie', listener.cookie)
        .send({ durationListenedSeconds: 100, completed: false });

      expect(response.statusCode).toBe(200);
      expect(response.body.qualified).toBe(true);

      const updatedTrack = await app.prisma.track.findUnique({ where: { id: track.id } });
      expect(updatedTrack.plays).toBe(1);
      const updatedArtist = await app.prisma.artistProfile.findUnique({ where: { id: artistProfile.id } });
      expect(updatedArtist.monthlyListeners).toBe(1);
    });

    it('never trusts a client-sent qualified/completed flag over the real reported duration', async () => {
      const { track } = await createArtistWithTrack({ durationSeconds: 200 });
      const listener = await registerUser('LISTENER');

      const response = await supertest(app.server)
        .post(`/api/tracks/${track.id}/play-event`)
        .set('Cookie', listener.cookie)
        // A forged "qualified"/"completed": true with a trivially small
        // reported duration must still be recomputed as unqualified.
        .send({ durationListenedSeconds: 1, completed: true, qualified: true });

      expect(response.statusCode).toBe(200);
      expect(response.body.qualified).toBe(false);
    });

    it('does not let an artist inflate their own monthly-listener count by replaying their own track', async () => {
      const { artistProfile, artistUser, track } = await createArtistWithTrack({ durationSeconds: 200 });
      const artistRecord = await app.prisma.user.findUnique({ where: { id: artistUser.id } });
      const login = await supertest(app.server)
        .post('/api/auth/login')
        .send({ email: artistRecord.email, password: 'Password123!' });

      const response = await supertest(app.server)
        .post(`/api/tracks/${track.id}/play-event`)
        .set('Cookie', login.headers['set-cookie'])
        .send({ durationListenedSeconds: 150, completed: true });

      expect(response.statusCode).toBe(200);
      expect(response.body.qualified).toBe(true);

      // Track.plays still reflects the real qualified play...
      const updatedTrack = await app.prisma.track.findUnique({ where: { id: track.id } });
      expect(updatedTrack.plays).toBe(1);
      // ...but the artist's own play of their own track is not a distinct
      // "monthly listener" of themselves.
      const updatedArtist = await app.prisma.artistProfile.findUnique({ where: { id: artistProfile.id } });
      expect(updatedArtist.monthlyListeners).toBe(0);
    });

    it('only shows a qualified play in recently-played and listening stats', async () => {
      const { track } = await createArtistWithTrack({ durationSeconds: 60 });
      const listener = await registerUser('LISTENER');

      // First, an unqualified attempt (skip early).
      await supertest(app.server)
        .post(`/api/tracks/${track.id}/play-event`)
        .set('Cookie', listener.cookie)
        .send({ durationListenedSeconds: 5, completed: false });

      const recentAfterSkip = await supertest(app.server)
        .get('/api/me/recently-played')
        .set('Cookie', listener.cookie);
      expect(recentAfterSkip.body.data.find((entry) => entry.track.id === track.id)).toBeUndefined();

      // Then a real, qualifying listen (threshold is min(30, 60*0.5)=30s).
      await supertest(app.server)
        .post(`/api/tracks/${track.id}/play-event`)
        .set('Cookie', listener.cookie)
        .send({ durationListenedSeconds: 45, completed: true });

      const recentAfterQualify = await supertest(app.server)
        .get('/api/me/recently-played')
        .set('Cookie', listener.cookie);
      expect(recentAfterQualify.body.data.find((entry) => entry.track.id === track.id)).toBeTruthy();

      const stats = await supertest(app.server)
        .get('/api/me/listening-stats')
        .set('Cookie', listener.cookie);
      expect(stats.statusCode).toBe(200);
      const topTrackEntry = stats.body.topTracks.find((entry) => entry.track.id === track.id);
      expect(topTrackEntry).toBeTruthy();
      expect(topTrackEntry.playCount).toBe(1);
    });
  });

  describe('artist dashboard', () => {
    it('sources counts directly from the artist\'s own tracks, not the capped public feed', async () => {
      const { artistUser, artistProfile, track } = await createArtistWithTrack({ durationSeconds: 90 });
      const listener = await registerUser('LISTENER');
      await supertest(app.server)
        .post(`/api/tracks/${track.id}/play-event`)
        .set('Cookie', listener.cookie)
        .send({ durationListenedSeconds: 60, completed: true });

      const artistRecord = await app.prisma.user.findUnique({ where: { id: artistUser.id } });
      const login = await supertest(app.server)
        .post('/api/auth/login')
        .send({ email: artistRecord.email, password: 'Password123!' });

      const dashboard = await supertest(app.server)
        .get('/api/me/artist-dashboard')
        .set('Cookie', login.headers['set-cookie']);

      expect(dashboard.statusCode).toBe(200);
      expect(dashboard.body.totalPlays).toBe(1);
      expect(dashboard.body.tracks.some((t) => t.id === track.id)).toBe(true);
      expect(dashboard.body.geography).toBeNull();
      expect(dashboard.body.trends).toBeNull();
      expect(artistProfile.isHidden).toBe(false);
    });
  });

  describe('admin stats integrity + recalculation', () => {
    it('rejects non-admins', async () => {
      const listener = await registerUser('LISTENER');
      const integrity = await supertest(app.server).get('/api/admin/stats/integrity').set('Cookie', listener.cookie);
      const recalc = await supertest(app.server).post('/api/admin/stats/recalculate').set('Cookie', listener.cookie).send({ reason: 'x' });
      expect(integrity.statusCode).toBe(403);
      expect(recalc.statusCode).toBe(403);
    });

    it('detects and repairs a deliberately corrupted Track.plays value', async () => {
      const { track } = await createArtistWithTrack({ durationSeconds: 200 });
      const listener = await registerUser('LISTENER');
      await supertest(app.server)
        .post(`/api/tracks/${track.id}/play-event`)
        .set('Cookie', listener.cookie)
        .send({ durationListenedSeconds: 100, completed: true });

      // Simulate drift: directly corrupt the stored aggregate, bypassing the
      // normal write path (e.g. a bad manual DB edit).
      await app.prisma.track.update({ where: { id: track.id }, data: { plays: 999 } });

      const integrity = await supertest(app.server).get('/api/admin/stats/integrity').set('Cookie', adminCookie);
      expect(integrity.statusCode).toBe(200);
      expect(integrity.body.verdict).toBe('FAIL');
      expect(integrity.body.details.staleTrackPlayCounts.some((row) => row.trackId === track.id)).toBe(true);

      const recalc = await supertest(app.server)
        .post('/api/admin/stats/recalculate')
        .set('Cookie', adminCookie)
        .send({ reason: 'QA: repair corrupted track play count', target: 'trackPlays' });
      expect(recalc.statusCode).toBe(200);
      expect(recalc.body.trackPlays.tracksChanged).toBeGreaterThan(0);

      const repaired = await app.prisma.track.findUnique({ where: { id: track.id } });
      expect(repaired.plays).toBe(1);

      expect(await app.prisma.auditLog.count({ where: { action: 'STATS_RECALCULATE' } })).toBeGreaterThan(0);
    });

    it('detects and repairs a deliberately corrupted ArtistProfile.monthlyListeners value via the per-artist endpoint', async () => {
      const { artistProfile, track } = await createArtistWithTrack({ durationSeconds: 200 });
      const listener = await registerUser('LISTENER');
      await supertest(app.server)
        .post(`/api/tracks/${track.id}/play-event`)
        .set('Cookie', listener.cookie)
        .send({ durationListenedSeconds: 100, completed: true });

      await app.prisma.artistProfile.update({ where: { id: artistProfile.id }, data: { monthlyListeners: 42 } });

      const integrity = await supertest(app.server).get('/api/admin/stats/integrity').set('Cookie', adminCookie);
      expect(integrity.body.details.staleMonthlyListeners.some((row) => row.artistId === artistProfile.id)).toBe(true);

      const recalc = await supertest(app.server)
        .post(`/api/admin/stats/artists/${artistProfile.id}/recalculate`)
        .set('Cookie', adminCookie)
        .send({ reason: 'QA: repair corrupted monthly listeners' });
      expect(recalc.statusCode).toBe(200);
      expect(recalc.body.monthlyListeners).toBe(1);

      const repaired = await app.prisma.artistProfile.findUnique({ where: { id: artistProfile.id } });
      expect(repaired.monthlyListeners).toBe(1);
    });

    // Regression: findMissingArtistProfiles originally flagged role IN
    // ('ARTIST', 'ADMIN'). Becoming an ADMIN never auto-creates a profile
    // (see artistAccess.test.js: "set-role to ADMIN does not auto-create a
    // profile unless explicitly requested"), so a profile-less admin is a
    // normal, common, fully-supported state -- not a data integrity bug.
    // This was only caught by running check-stats-integrity.js end-to-end
    // against realistic seed data, where the demo admin (deliberately
    // profile-less) produced a false-positive FAIL verdict.
    it('does not flag a profile-less ADMIN as a missing-artist-profile issue', async () => {
      const admin = await registerUser('ADMIN');

      try {
        const integrity = await supertest(app.server).get('/api/admin/stats/integrity').set('Cookie', adminCookie);
        expect(integrity.statusCode).toBe(200);
        expect(integrity.body.details.missingArtistProfiles.some((row) => row.id === admin.id)).toBe(false);
      } finally {
        // Cleanup is not optional here: this test's own admin login lives in
        // a file-level `adminCookie`, but every OTHER test file shares this
        // same database and never resets between files. An extra ACTIVE
        // admin left behind changes "is this the last active admin?" for
        // every other file's admin-demotion-protection test (see
        // endpoints.test.js: "does not allow the last active admin to be
        // demoted" -- it would wrongly succeed instead of being blocked,
        // permanently demoting the shared seed admin for the rest of that
        // file's run). Same class of bug as the artistAccess.test.js leak
        // fixed earlier in this QA pass -- demote back immediately.
        await app.prisma.user.update({ where: { id: admin.id }, data: { role: 'LISTENER' } });
      }
    });

    it('flags a role-ARTIST user whose ArtistProfile is genuinely missing', async () => {
      // registerUser('ARTIST') only sets the role -- unlike
      // createArtistWithTrack, it never creates the paired ArtistProfile,
      // which is exactly the corrupted state this check exists to catch
      // (a partial write or manual DB edit that set role without a profile).
      const artist = await registerUser('ARTIST');

      try {
        const integrity = await supertest(app.server).get('/api/admin/stats/integrity').set('Cookie', adminCookie);
        expect(integrity.statusCode).toBe(200);
        expect(integrity.body.verdict).toBe('FAIL');
        expect(integrity.body.details.missingArtistProfiles.some((row) => row.id === artist.id)).toBe(true);
      } finally {
        // Same reasoning as above: don't leave a permanently "corrupted"
        // fixture in the shared database for every later test/file to see.
        await app.prisma.user.update({ where: { id: artist.id }, data: { role: 'LISTENER' } });
      }
    });
  });
});
