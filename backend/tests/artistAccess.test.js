import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import buildServer from '../src/index';
import seedModule from '../prisma/seed';

const { seedDemo } = seedModule;

function validUploadBody(overrides = {}) {
  return {
    title: 'Artist Access Fixture',
    genre: 'electronic',
    tags: [],
    copyrightConfirmed: true,
    audio: { filename: 'fixture.wav', mimeType: 'audio/wav', sizeBytes: 2048 },
    ...overrides
  };
}

describe('artist access admin API', () => {
  let app;
  let adminCookie;
  let listenerCookie;
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

    const listenerLogin = await supertest(app.server)
      .post('/api/auth/login')
      .send({ email: 'listener@noirsound.com', password: 'password123' });
    listenerCookie = listenerLogin.headers['set-cookie'];
  });

  afterAll(async () => {
    await app.close();
    if (previousRateMultiplier === undefined) delete process.env.RATE_LIMIT_MULTIPLIER;
    else process.env.RATE_LIMIT_MULTIPLIER = previousRateMultiplier;
  });

  async function registerUser(overrides = {}) {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const credentials = {
      email: `artist_access_${suffix}@test.local`,
      password: 'Password123!',
      username: `artist_access_${suffix}`,
      displayName: 'Artist Access Target',
      ...overrides
    };
    const registered = await supertest(app.server).post('/api/auth/register').send(credentials);
    expect(registered.statusCode).toBe(200);
    return { id: registered.body.user.id, cookie: registered.headers['set-cookie'], credentials };
  }

  it('rejects grant-artist from a non-admin', async () => {
    const target = await registerUser();
    const response = await supertest(app.server)
      .post(`/api/admin/users/${target.id}/grant-artist`)
      .set('Cookie', listenerCookie)
      .send({ reason: 'should not work' });
    expect(response.statusCode).toBe(403);
    expect(await app.prisma.artistProfile.count({ where: { userId: target.id } })).toBe(0);
  });

  it('grants artist access to a listener, creates exactly one ArtistProfile, and audits it', async () => {
    const target = await registerUser();
    expect(await app.prisma.artistProfile.count({ where: { userId: target.id } })).toBe(0);

    const response = await supertest(app.server)
      .post(`/api/admin/users/${target.id}/grant-artist`)
      .set('Cookie', adminCookie)
      .send({ reason: 'Granting artist access after review' });

    expect(response.statusCode).toBe(200);
    expect(response.body.user.role).toBe('ARTIST');
    expect(response.body.user.status).toBe('ACTIVE');
    expect(response.body.user.hasArtistProfile).toBe(true);
    expect(response.body.user.canUploadTracks).toBe(true);
    expect(response.body.user.uploadAccessReason).toBeNull();
    expect(response.body.user.artistProfileId).toBeTruthy();

    const profile = await app.prisma.artistProfile.findUnique({ where: { userId: target.id } });
    expect(profile).toBeTruthy();
    expect(profile.monthlyListeners).toBe(0);
    expect(profile.genres).toEqual([]);
    expect(profile.isHidden).toBe(false);
    expect(await app.prisma.artistProfile.count({ where: { userId: target.id } })).toBe(1);

    const user = await app.prisma.user.findUnique({ where: { id: target.id } });
    expect(user.role).toBe('ARTIST');

    expect(await app.prisma.auditLog.count({
      where: { action: 'USER_GRANT_ARTIST', targetId: target.id }
    })).toBe(1);
    expect(await app.prisma.auditLog.count({
      where: { action: 'ARTIST_PROFILE_CREATED', targetId: profile.id }
    })).toBe(1);
    const grantLog = await app.prisma.auditLog.findFirst({ where: { action: 'USER_GRANT_ARTIST', targetId: target.id } });
    expect(grantLog.reason).toBe('Granting artist access after review');
    expect(grantLog.actorId).toBeTruthy();
  });

  it('does not create a duplicate ArtistProfile on a repeated grant', async () => {
    const target = await registerUser();
    const first = await supertest(app.server)
      .post(`/api/admin/users/${target.id}/grant-artist`)
      .set('Cookie', adminCookie)
      .send({ reason: 'first grant' });
    expect(first.statusCode).toBe(200);
    const profileId = first.body.user.artistProfileId;

    const second = await supertest(app.server)
      .post(`/api/admin/users/${target.id}/grant-artist`)
      .set('Cookie', adminCookie)
      .send({ reason: 'second grant, should be idempotent' });
    expect(second.statusCode).toBe(200);
    expect(second.body.user.artistProfileId).toBe(profileId);
    expect(await app.prisma.artistProfile.count({ where: { userId: target.id } })).toBe(1);
  });

  it('gives an ADMIN an ArtistProfile via grant-artist without changing their role', async () => {
    const target = await registerUser();
    await app.prisma.user.update({ where: { id: target.id }, data: { role: 'ADMIN' } });

    const response = await supertest(app.server)
      .post(`/api/admin/users/${target.id}/grant-artist`)
      .set('Cookie', adminCookie)
      .send({ reason: 'admin needs to upload too' });

    expect(response.statusCode).toBe(200);
    expect(response.body.user.role).toBe('ADMIN');
    expect(response.body.user.hasArtistProfile).toBe(true);
    expect(response.body.user.canUploadTracks).toBe(true);
  });

  it('ensure-artist-profile creates a profile for an ADMIN without a role change, and is a no-op the second time', async () => {
    const target = await registerUser();
    await app.prisma.user.update({ where: { id: target.id }, data: { role: 'ADMIN' } });

    const first = await supertest(app.server)
      .post(`/api/admin/users/${target.id}/ensure-artist-profile`)
      .set('Cookie', adminCookie)
      .send({ reason: 'ensure profile' });
    expect(first.statusCode).toBe(200);
    expect(first.body.created).toBe(true);
    expect(first.body.user.role).toBe('ADMIN');

    const second = await supertest(app.server)
      .post(`/api/admin/users/${target.id}/ensure-artist-profile`)
      .set('Cookie', adminCookie)
      .send({ reason: 'ensure again' });
    expect(second.statusCode).toBe(200);
    expect(second.body.created).toBe(false);
    expect(second.body.artistProfile.id).toBe(first.body.artistProfile.id);
    expect(await app.prisma.artistProfile.count({ where: { userId: target.id } })).toBe(1);
  });

  it('rejects ensure-artist-profile and grant-artist from a non-admin', async () => {
    const target = await registerUser();
    const ensure = await supertest(app.server)
      .post(`/api/admin/users/${target.id}/ensure-artist-profile`)
      .set('Cookie', listenerCookie)
      .send({ reason: 'should not work' });
    expect(ensure.statusCode).toBe(403);
  });

  it('auto-creates an ArtistProfile when set-role moves a user to ARTIST', async () => {
    const target = await registerUser();
    const response = await supertest(app.server)
      .post(`/api/admin/users/${target.id}/set-role`)
      .set('Cookie', adminCookie)
      .send({ role: 'ARTIST', reason: 'promote to artist', confirmation: 'SET_ROLE' });

    expect(response.statusCode).toBe(200);
    expect(response.body.user.role).toBe('ARTIST');
    expect(response.body.user.hasArtistProfile).toBe(true);
    expect(await app.prisma.artistProfile.count({ where: { userId: target.id } })).toBe(1);
  });

  it('set-role to ARTIST does not create a profile when createArtistProfile is explicitly false', async () => {
    const target = await registerUser();
    const response = await supertest(app.server)
      .post(`/api/admin/users/${target.id}/set-role`)
      .set('Cookie', adminCookie)
      .send({ role: 'ARTIST', reason: 'promote without profile', confirmation: 'SET_ROLE', createArtistProfile: false });

    expect(response.statusCode).toBe(200);
    expect(response.body.user.hasArtistProfile).toBe(false);
    expect(response.body.user.canUploadTracks).toBe(false);
    expect(response.body.user.uploadAccessReason).toBe('MISSING_ARTIST_PROFILE');
  });

  it('set-role to ADMIN does not auto-create a profile unless explicitly requested', async () => {
    const target = await registerUser();
    const implicit = await supertest(app.server)
      .post(`/api/admin/users/${target.id}/set-role`)
      .set('Cookie', adminCookie)
      .send({ role: 'ADMIN', reason: 'promote to admin', confirmation: 'SET_ROLE' });
    expect(implicit.statusCode).toBe(200);
    expect(implicit.body.user.hasArtistProfile).toBe(false);

    const other = await registerUser();
    const explicit = await supertest(app.server)
      .post(`/api/admin/users/${other.id}/set-role`)
      .set('Cookie', adminCookie)
      .send({
        role: 'ADMIN', reason: 'promote to admin with profile', confirmation: 'SET_ROLE', createArtistProfile: true
      });
    expect(explicit.statusCode).toBe(200);
    expect(explicit.body.user.hasArtistProfile).toBe(true);
  });

  it('revoking artist access demotes ARTIST to LISTENER and hides the profile without deleting it', async () => {
    const target = await registerUser();
    const grant = await supertest(app.server)
      .post(`/api/admin/users/${target.id}/grant-artist`)
      .set('Cookie', adminCookie)
      .send({ reason: 'setup' });
    const profileId = grant.body.user.artistProfileId;

    const revoke = await supertest(app.server)
      .post(`/api/admin/users/${target.id}/revoke-artist`)
      .set('Cookie', adminCookie)
      .send({ reason: 'Artist access removed' });

    expect(revoke.statusCode).toBe(200);
    expect(revoke.body.user.role).toBe('LISTENER');
    expect(revoke.body.user.hasArtistProfile).toBe(true);
    expect(revoke.body.user.artistProfileHidden).toBe(true);
    expect(revoke.body.user.canUploadTracks).toBe(false);

    const stillExists = await app.prisma.artistProfile.findUnique({ where: { id: profileId } });
    expect(stillExists).toBeTruthy();
    expect(stillExists.isHidden).toBe(true);
    expect(await app.prisma.auditLog.count({
      where: { action: 'USER_REVOKE_ARTIST', targetId: target.id }
    })).toBe(1);
  });

  it('revoking artist access from an ADMIN only hides the profile and never changes their role', async () => {
    const target = await registerUser();
    await app.prisma.user.update({ where: { id: target.id }, data: { role: 'ADMIN' } });
    const grant = await supertest(app.server)
      .post(`/api/admin/users/${target.id}/grant-artist`)
      .set('Cookie', adminCookie)
      .send({ reason: 'setup admin profile' });
    expect(grant.body.user.role).toBe('ADMIN');

    const revoke = await supertest(app.server)
      .post(`/api/admin/users/${target.id}/revoke-artist`)
      .set('Cookie', adminCookie)
      .send({ reason: 'pause admin upload access' });

    expect(revoke.statusCode).toBe(200);
    expect(revoke.body.user.role).toBe('ADMIN');
    expect(revoke.body.user.artistProfileHidden).toBe(true);
    expect(revoke.body.user.canUploadTracks).toBe(false);
    const stillAdmin = await app.prisma.user.findUnique({ where: { id: target.id } });
    expect(stillAdmin.role).toBe('ADMIN');
  });

  it('revokes sessions on grant when requested, and leaves them when not', async () => {
    const revoked = await registerUser();
    expect(await app.prisma.session.count({ where: { userId: revoked.id } })).toBe(1);
    const revokedResponse = await supertest(app.server)
      .post(`/api/admin/users/${revoked.id}/grant-artist`)
      .set('Cookie', adminCookie)
      .send({ reason: 'grant + revoke sessions', revokeSessions: true });
    expect(revokedResponse.statusCode).toBe(200);
    expect(await app.prisma.session.count({ where: { userId: revoked.id } })).toBe(0);
    expect(await app.prisma.auditLog.count({
      where: { action: 'USER_REVOKE_SESSIONS', targetId: revoked.id }
    })).toBeGreaterThan(0);

    const kept = await registerUser();
    const keptResponse = await supertest(app.server)
      .post(`/api/admin/users/${kept.id}/grant-artist`)
      .set('Cookie', adminCookie)
      .send({ reason: 'grant without revoke', revokeSessions: false });
    expect(keptResponse.statusCode).toBe(200);
    expect(await app.prisma.session.count({ where: { userId: kept.id } })).toBe(1);
  });

  it('rejects granting artist access to a banned or deleted user', async () => {
    const banned = await registerUser();
    await supertest(app.server)
      .post(`/api/admin/users/${banned.id}/ban`)
      .set('Cookie', adminCookie)
      .send({ reason: 'test ban' });
    const bannedResponse = await supertest(app.server)
      .post(`/api/admin/users/${banned.id}/grant-artist`)
      .set('Cookie', adminCookie)
      .send({ reason: 'should be refused' });
    expect(bannedResponse.statusCode).toBe(409);
    expect(bannedResponse.body.error).toBe('ADMIN_USER_BANNED');

    const deleted = await registerUser();
    await app.prisma.user.update({ where: { id: deleted.id }, data: { status: 'DELETED' } });
    const deletedResponse = await supertest(app.server)
      .post(`/api/admin/users/${deleted.id}/grant-artist`)
      .set('Cookie', adminCookie)
      .send({ reason: 'should also be refused' });
    expect(deletedResponse.statusCode).toBe(409);
    expect(deletedResponse.body.error).toBe('ADMIN_USER_DELETED');
  });

  it('never changes an ADMIN role through revoke-artist, even for the only active admin', async () => {
    const admin = await app.prisma.user.findUnique({ where: { email: 'admin@noirsound.com' } });
    const response = await supertest(app.server)
      .post(`/api/admin/users/${admin.id}/revoke-artist`)
      .set('Cookie', adminCookie)
      .send({ reason: 'attempt to revoke admin artist access', hideArtistProfile: false, revokeSessions: false });
    expect(response.statusCode).toBe(200);
    expect(response.body.user.role).toBe('ADMIN');
    const stillAdmin = await app.prisma.user.findUnique({ where: { id: admin.id } });
    expect(stillAdmin.role).toBe('ADMIN');
  });

  it('blocks upload with a coded reason when ArtistProfile is missing, and allows it after grant', async () => {
    const target = await registerUser();
    await app.prisma.user.update({ where: { id: target.id }, data: { role: 'ARTIST' } });

    const blocked = await supertest(app.server)
      .post('/api/uploads/track/init')
      .set('Cookie', target.cookie)
      .send(validUploadBody({ title: 'Blocked Track' }));
    expect(blocked.statusCode).toBe(422);
    expect(blocked.body.error).toBe('ARTIST_PROFILE_REQUIRED');
    expect(blocked.body.uploadAccessReason).toBe('MISSING_ARTIST_PROFILE');

    const grant = await supertest(app.server)
      .post(`/api/admin/users/${target.id}/grant-artist`)
      .set('Cookie', adminCookie)
      .send({ reason: 'unblock upload', revokeSessions: false });
    expect(grant.statusCode).toBe(200);

    const allowed = await supertest(app.server)
      .post('/api/uploads/track/init')
      .set('Cookie', target.cookie)
      .send(validUploadBody({ title: 'Allowed Track' }));
    expect(allowed.statusCode).toBe(200);
    expect(allowed.body.trackId).toBeTruthy();
  });

  it('blocks upload when the ArtistProfile is hidden', async () => {
    const target = await registerUser();
    const grant = await supertest(app.server)
      .post(`/api/admin/users/${target.id}/grant-artist`)
      .set('Cookie', adminCookie)
      .send({ reason: 'setup for hide test', revokeSessions: false });
    expect(grant.body.user.canUploadTracks).toBe(true);

    const hide = await supertest(app.server)
      .post(`/api/admin/artists/${grant.body.user.artistProfileId}/hide`)
      .set('Cookie', adminCookie)
      .send({ reason: 'hide for test' });
    expect(hide.statusCode).toBe(200);

    const blocked = await supertest(app.server)
      .post('/api/uploads/track/init')
      .set('Cookie', target.cookie)
      .send(validUploadBody({ title: 'Hidden Profile Track' }));
    expect(blocked.statusCode).toBe(422);
    expect(blocked.body.uploadAccessReason).toBe('ARTIST_PROFILE_HIDDEN');
  });

  it('re-granting artist access unhides a previously hidden profile so uploads work again', async () => {
    const target = await registerUser();
    const grant = await supertest(app.server)
      .post(`/api/admin/users/${target.id}/grant-artist`)
      .set('Cookie', adminCookie)
      .send({ reason: 'setup', revokeSessions: false });
    const profileId = grant.body.user.artistProfileId;

    await supertest(app.server)
      .post(`/api/admin/users/${target.id}/revoke-artist`)
      .set('Cookie', adminCookie)
      .send({ reason: 'revoke for re-grant test', revokeSessions: false });
    expect((await app.prisma.artistProfile.findUnique({ where: { id: profileId } })).isHidden).toBe(true);

    const regrant = await supertest(app.server)
      .post(`/api/admin/users/${target.id}/grant-artist`)
      .set('Cookie', adminCookie)
      .send({ reason: 're-grant after revoke', revokeSessions: false });

    expect(regrant.statusCode).toBe(200);
    expect(regrant.body.user.role).toBe('ARTIST');
    expect(regrant.body.user.artistProfileHidden).toBe(false);
    expect(regrant.body.user.canUploadTracks).toBe(true);

    const allowed = await supertest(app.server)
      .post('/api/uploads/track/init')
      .set('Cookie', target.cookie)
      .send(validUploadBody({ title: 'Regranted Track' }));
    expect(allowed.statusCode).toBe(200);
  });

  it('reflects artist access fields on GET /admin/users and /admin/users/:id', async () => {
    const target = await registerUser();
    await supertest(app.server)
      .post(`/api/admin/users/${target.id}/grant-artist`)
      .set('Cookie', adminCookie)
      .send({ reason: 'for listing test' });

    const detail = await supertest(app.server)
      .get(`/api/admin/users/${target.id}`)
      .set('Cookie', adminCookie);
    expect(detail.statusCode).toBe(200);
    expect(detail.body.user.canUploadTracks).toBe(true);
    expect(detail.body.user.hasArtistProfile).toBe(true);
    expect(detail.body.user.artistProfileId).toBeTruthy();

    const list = await supertest(app.server)
      .get(`/api/admin/users?search=${encodeURIComponent(target.credentials.username)}`)
      .set('Cookie', adminCookie);
    expect(list.statusCode).toBe(200);
    const row = list.body.data.find((u) => u.id === target.id);
    expect(row).toBeTruthy();
    expect(row.canUploadTracks).toBe(true);
    expect(row.hasArtistProfile).toBe(true);
  });

  it('filters users by hasArtistProfile and uploadBlocked', async () => {
    const withProfile = await registerUser();
    await supertest(app.server)
      .post(`/api/admin/users/${withProfile.id}/grant-artist`)
      .set('Cookie', adminCookie)
      .send({ reason: 'filter test — has profile' });

    const withoutProfile = await registerUser();

    const hasProfileList = await supertest(app.server)
      .get('/api/admin/users?hasArtistProfile=true&pageSize=100')
      .set('Cookie', adminCookie);
    expect(hasProfileList.statusCode).toBe(200);
    expect(hasProfileList.body.data.some((u) => u.id === withProfile.id)).toBe(true);
    expect(hasProfileList.body.data.some((u) => u.id === withoutProfile.id)).toBe(false);

    const missingProfileList = await supertest(app.server)
      .get('/api/admin/users?hasArtistProfile=false&pageSize=100')
      .set('Cookie', adminCookie);
    expect(missingProfileList.statusCode).toBe(200);
    expect(missingProfileList.body.data.some((u) => u.id === withoutProfile.id)).toBe(true);
    expect(missingProfileList.body.data.some((u) => u.id === withProfile.id)).toBe(false);

    const blockedList = await supertest(app.server)
      .get('/api/admin/users?uploadBlocked=true&pageSize=100')
      .set('Cookie', adminCookie);
    expect(blockedList.statusCode).toBe(200);
    expect(blockedList.body.data.some((u) => u.id === withoutProfile.id)).toBe(true);
    expect(blockedList.body.data.some((u) => u.id === withProfile.id)).toBe(false);

    const readyList = await supertest(app.server)
      .get('/api/admin/users?uploadBlocked=false&pageSize=100')
      .set('Cookie', adminCookie);
    expect(readyList.statusCode).toBe(200);
    expect(readyList.body.data.some((u) => u.id === withProfile.id)).toBe(true);
    expect(readyList.body.data.some((u) => u.id === withoutProfile.id)).toBe(false);
  });

  it('lets an ADMIN self-create their own artist profile, but refuses non-admins', async () => {
    const target = await registerUser();
    const forbidden = await supertest(app.server)
      .post('/api/auth/me/ensure-artist-profile')
      .set('Cookie', target.cookie);
    expect(forbidden.statusCode).toBe(403);

    await app.prisma.user.update({ where: { id: target.id }, data: { role: 'ADMIN' } });
    const allowed = await supertest(app.server)
      .post('/api/auth/me/ensure-artist-profile')
      .set('Cookie', target.cookie);
    expect(allowed.statusCode).toBe(200);
    expect(allowed.body.user.hasArtistProfile).toBe(true);
    expect(allowed.body.user.canUploadTracks).toBe(true);
    expect(await app.prisma.artistProfile.count({ where: { userId: target.id } })).toBe(1);
  });
});
