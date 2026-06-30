import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import buildServer from '../src/index';
import seedModule from '../prisma/seed';

const { MINIMAL_USERS, seedMinimal } = seedModule;

describe('Seed Strategy Contracts', () => {
  let app;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('minimal seed creates users and artist profile only, with zero runtime content', async () => {
    // Clean existing runtime records first to verify seedMinimal behavior in isolation
    await app.prisma.playEvent.deleteMany();
    await app.prisma.comment.deleteMany();
    await app.prisma.playlistTrack.deleteMany();
    await app.prisma.playlist.deleteMany();
    await app.prisma.track.deleteMany();

    const seedResult = await seedMinimal(app.prisma);

    expect(seedResult.admin.email).toBe(MINIMAL_USERS.admin.email);
    expect(seedResult.artistUser.email).toBe(MINIMAL_USERS.artist.email);
    expect(seedResult.listener.email).toBe(MINIMAL_USERS.listener.email);
    expect(seedResult.artistProfile.userId).toBe(seedResult.artistUser.id);

    const trackCount = await app.prisma.track.count();
    const playlistCount = await app.prisma.playlist.count();
    const commentCount = await app.prisma.comment.count();
    const playEventCount = await app.prisma.playEvent.count();

    expect(trackCount).toBe(0);
    expect(playlistCount).toBe(0);
    expect(commentCount).toBe(0);
    expect(playEventCount).toBe(0);
  });
});
