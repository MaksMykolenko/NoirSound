'use strict';

// Explicit test records; these helpers are never imported by application code.
async function seedCatalogFixture(prisma, { prefix = 'catalog-fixture', now = new Date(), processedAudioKey = 'catalog-test/shared.mp3' } = {}) {
  const url = new URL(process.env.DATABASE_URL || 'http://invalid');
  if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !url.pathname.includes('_test')) throw new Error('Catalog fixtures require an isolated loopback *_test database.');
  if (!/^[a-z0-9-]{3,60}$/u.test(prefix)) throw new Error('Fixture prefix must be an explicit lowercase test identifier.');
  const searchToken = prefix;
  const users = [
    { suffix: 'public', status: 'ACTIVE', hidden: false },
    { suffix: 'public2', status: 'ACTIVE', hidden: false },
    { suffix: 'hiddenartist', status: 'ACTIVE', hidden: true },
    { suffix: 'suspended', status: 'SUSPENDED', hidden: false },
    { suffix: 'banned', status: 'BANNED', hidden: false },
    { suffix: 'deleted', status: 'DELETED', hidden: false },
  ];
  for (const user of users) {
    await prisma.user.create({ data: {
      id: `${prefix}-user-${user.suffix}`, email: `${prefix}-${user.suffix}@example.invalid`, username: `${prefix}-${user.suffix}`,
      displayName: user.suffix === 'public' ? `Producer Żółw ${prefix}` : user.suffix === 'public2' ? `Producer Sova ${prefix}` : `${prefix} Secret creator ${user.suffix}`,
      role: 'ARTIST', status: user.status,
      artistProfile: { create: { id: `${prefix}-artist-${user.suffix}`, isHidden: user.hidden, genres: ['electronic'], monthlyListeners: user.suffix === 'public' ? 999999 : 0 } },
    } });
  }
  const artistId = `${prefix}-artist-public`;
  const publicTracks = [];
  for (const type of ['MUSIC', 'BEAT']) for (let index = 0; index < 160; index += 1) {
    const id = `${prefix}-${type.toLowerCase()}-${String(index).padStart(3, '0')}`;
    const weeklyPlays = index % 3;
    const oldPlays = index % 7;
    const title = index === 159 ? `${prefix} Late ${type} Łódź Україна 50%_# "quote"` : `${prefix} ${type} release ${String(index).padStart(3, '0')}`;
    publicTracks.push({
      id, title, artistId: index % 2 ? `${prefix}-artist-public2` : artistId, contentType: type, tags: [searchToken, index === 158 ? 'tag-only-місяць' : 'catalog-fixture'],
      primaryArtistName: index === 157 ? 'Credit-only Żuraw' : 'Catalog credits', featuredArtists: index === 156 ? ['Featured-only Київ'] : [],
      genre: type === 'MUSIC' ? index % 2 ? 'jazz' : index === 0 ? 'Electronic' : 'electronic' : index % 2 ? 'trap' : index === 0 ? 'Hip-Hop' : 'hip_hop',
      status: 'PUBLISHED', isPublic: true, processedAudioKey: index === 153 ? null : processedAudioKey,
      duration: index === 155 ? 0 : 120, durationSeconds: index === 155 ? 0 : 120,
      publishedAt: index % 40 === 0 ? null : new Date(now.getTime() - (Math.floor(index / 4) + 1) * 3600000),
      releaseDate: new Date(now.getTime() - 86400000), createdAt: new Date(now.getTime() - (index + 1) * 3600000),
      plays: weeklyPlays + oldPlays, likes: index % 9,
      beatStyle: type === 'BEAT' ? ['Trap', 'Trap', 'Drill', null][index % 4] : null,
      beatMood: type === 'BEAT' ? index % 2 ? 'Bright' : 'Dark' : null,
      beatKey: type === 'BEAT' ? ['F# Minor', 'C Major', null][index % 3] : null,
      beatBpm: type === 'BEAT' ? [80, 105, 138, 172, null][index % 5] : null,
      beatContactEnabled: type === 'BEAT', lyricsType: index === 159 ? 'PLAIN' : 'NONE',
      lyricsRightsConfirmed: index === 159, lyricsText: index === 159 ? 'Private full lyrics payload should never appear in catalogue.' : null,
      weeklyPlays, oldPlays,
    });
  }
  const hiddenTracks = ['private', 'hidden', 'draft', 'processing', 'failed', 'rejected', 'hiddenartist', 'suspended', 'banned', 'deleted'].map((kind, index) => ({
    ...publicTracks[index], id: `${prefix}-excluded-${kind}`, title: `${prefix} Hidden needle ${kind}`,
    genre: 'phonk', beatStyle: 'SecretStyle', beatMood: 'SecretMood', contentType: 'BEAT',
    artistId: users.some(user => user.suffix === kind) ? `${prefix}-artist-${kind}` : artistId,
    isPublic: kind !== 'private', status: ({ hidden: 'HIDDEN', draft: 'DRAFT', processing: 'PROCESSING', failed: 'FAILED', rejected: 'REJECTED' })[kind] || 'PUBLISHED',
  }));
  const databaseTracks = [...publicTracks, ...hiddenTracks].map(({ weeklyPlays: _weeklyPlays, oldPlays: _oldPlays, ...track }) => track);
  await prisma.track.createMany({ data: databaseTracks });
  const events = [];
  for (const track of publicTracks) {
    for (let event = 0; event < track.weeklyPlays; event += 1) events.push({ id: `${track.id}-week-${event}`, trackId: track.id, artistId: track.artistId, durationListenedSeconds: 60, qualified: true, createdAt: new Date(now.getTime() - 3600000) });
    for (let event = 0; event < track.oldPlays; event += 1) events.push({ id: `${track.id}-old-${event}`, trackId: track.id, artistId: track.artistId, durationListenedSeconds: 60, qualified: true, createdAt: new Date(now.getTime() - 30 * 86400000) });
    events.push({ id: `${track.id}-unqualified`, trackId: track.id, artistId: track.artistId, durationListenedSeconds: 1, qualified: false, createdAt: new Date(now.getTime() - 3600000) });
  }
  for (const track of hiddenTracks) for (let index = 0; index < 3; index += 1) events.push({ id: `${track.id}-week-${index}`, trackId: track.id, artistId: track.artistId, durationListenedSeconds: 60, qualified: true, createdAt: new Date(now.getTime() - 3600000) });
  await prisma.playEvent.createMany({ data: events });
  return { publicTracks, hiddenTracks, artistId, artistUserId: `${prefix}-user-public`, userIds: users.map(user => `${prefix}-user-${user.suffix}`), lateMusicId: `${prefix}-music-159`, lateBeatId: `${prefix}-beat-159`, searchToken, expected: { total: 320, music: 160, beats: 160 } };
}

module.exports = { seedCatalogFixture };
