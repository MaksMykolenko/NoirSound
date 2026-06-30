require('dotenv').config();
const argon2 = require('argon2');
const { createPrismaClient } = require('../src/lib/prisma');

const prisma = createPrismaClient();

// ---------------------------------------------------------------------------
// Minimal seed data – users and required profiles only.
// No tracks, playlists, comments, play events, or fake content.
// ---------------------------------------------------------------------------
const MINIMAL_USERS = {
  admin: {
    email: 'admin@noirsound.com',
    username: 'admin',
    displayName: 'System Admin',
    role: 'ADMIN',
  },
  artist: {
    email: 'artist@noirsound.com',
    username: 'velvet_circuit',
    displayName: 'Velvet Circuit',
    role: 'ARTIST',
    genres: ['phonk', 'synthwave'],
  },
  listener: {
    email: 'listener@noirsound.com',
    username: 'music_fan',
    displayName: 'Music Fan',
    role: 'LISTENER',
  },
};

// ---------------------------------------------------------------------------
// Demo seed data – explicitly opt-in only.
// Uses stable IDs/slugs/emails for idempotency and safe cleanup.
// ---------------------------------------------------------------------------
const DEMO_ARTISTS = [
  {
    email: 'mira.vale@noirsound.local',
    username: 'mira_vale',
    displayName: 'Mira Vale',
    genres: ['ambient', 'pop'],
  },
  {
    email: 'northline@noirsound.local',
    username: 'northline_archive',
    displayName: 'Northline Archive',
    genres: ['lofi', 'experimental', 'jazz'],
  },
  {
    email: 'static.bloom@noirsound.local',
    username: 'static_bloom',
    displayName: 'Static Bloom',
    genres: ['electronic', 'synthwave', 'rock'],
  },
];

const DEMO_TRACKS = [
  {
    slug: 'seed-glass-highway',
    artistEmail: 'artist@noirsound.com',
    title: 'Glass Highway',
    description: 'A restrained phonk cut built around night-drive percussion.',
    genre: 'phonk',
    tags: ['night-drive', 'phonk'],
    durationSeconds: 185,
    coverUrl: '/images/cover_phonk.png',
    releaseDate: '2026-06-20T00:00:00.000Z',
  },
  {
    slug: 'seed-redline-echo',
    artistEmail: 'artist@noirsound.com',
    title: 'Redline Echo',
    description: 'Dark synthesizers and clipped drums with an unfinished-film atmosphere.',
    genre: 'synthwave',
    tags: ['dark-synth', 'cinematic'],
    durationSeconds: 210,
    coverUrl: null,
    releaseDate: '2026-06-16T00:00:00.000Z',
  },
  {
    slug: 'seed-low-orbit',
    artistEmail: 'mira.vale@noirsound.local',
    title: 'Low Orbit',
    description: 'Slow ambient movement for headphones and late rooms.',
    genre: 'ambient',
    tags: ['ambient', 'drone'],
    durationSeconds: 248,
    coverUrl: '/images/cover_ambient.png',
    releaseDate: '2026-06-12T00:00:00.000Z',
  },
  {
    slug: 'seed-rain-on-fifth-street',
    artistEmail: 'northline@noirsound.local',
    title: 'Rain on Fifth Street',
    description: 'Soft tape texture, brushed drums, and a patient piano loop.',
    genre: 'lofi',
    tags: ['lo-fi', 'rain'],
    durationSeconds: 196,
    coverUrl: '/images/cover_lofi.png',
    releaseDate: '2026-06-08T00:00:00.000Z',
  },
  {
    slug: 'seed-soft-static',
    artistEmail: 'northline@noirsound.local',
    title: 'Soft Static',
    description: 'An experimental miniature assembled from room tone and tape hiss.',
    genre: 'experimental',
    tags: ['tape', 'experimental'],
    durationSeconds: 142,
    coverUrl: null,
    releaseDate: '2026-06-04T00:00:00.000Z',
  },
  {
    slug: 'seed-voltage-garden',
    artistEmail: 'static.bloom@noirsound.local',
    title: 'Voltage Garden',
    description: 'Bright modular patterns over a compact electronic rhythm.',
    genre: 'electronic',
    tags: ['modular', 'electronic'],
    durationSeconds: 224,
    coverUrl: '/images/cover_electronic.png',
    releaseDate: '2026-05-30T00:00:00.000Z',
  },
  {
    slug: 'seed-afterimage-protocol',
    artistEmail: 'static.bloom@noirsound.local',
    title: 'Afterimage Protocol',
    description: 'A slower synthwave piece with wide pads and dry percussion.',
    genre: 'synthwave',
    tags: ['synthwave', 'nocturnal'],
    durationSeconds: 238,
    coverUrl: null,
    releaseDate: '2026-05-26T00:00:00.000Z',
  },
  {
    slug: 'seed-concrete-bars',
    artistEmail: 'artist@noirsound.com',
    title: 'Concrete Bars',
    description: 'A boom-bap-leaning rap sketch with dusty drums and a low piano.',
    genre: 'rap',
    tags: ['boom-bap', 'underground'],
    durationSeconds: 168,
    coverUrl: null,
    releaseDate: '2026-05-22T00:00:00.000Z',
  },
  {
    slug: 'seed-paper-lanterns',
    artistEmail: 'mira.vale@noirsound.local',
    title: 'Paper Lanterns',
    description: 'A bright synth-pop demo with a hands-in-the-air chorus.',
    genre: 'pop',
    tags: ['synth-pop', 'summer'],
    durationSeconds: 201,
    coverUrl: null,
    releaseDate: '2026-05-18T00:00:00.000Z',
  },
  {
    slug: 'seed-amber-static',
    artistEmail: 'static.bloom@noirsound.local',
    title: 'Amber Static',
    description: 'Mid-tempo alternative rock with reverb-soaked guitars.',
    genre: 'rock',
    tags: ['alt-rock', 'guitar'],
    durationSeconds: 229,
    coverUrl: null,
    releaseDate: '2026-05-14T00:00:00.000Z',
  },
  {
    slug: 'seed-blue-corner',
    artistEmail: 'northline@noirsound.local',
    title: 'Blue Corner',
    description: 'A late-night jazz trio sketch — brushed kit, upright bass, soft keys.',
    genre: 'jazz',
    tags: ['trio', 'late-night'],
    durationSeconds: 254,
    coverUrl: null,
    releaseDate: '2026-05-10T00:00:00.000Z',
  },
  {
    slug: 'seed-dnipro-nights',
    artistEmail: 'artist@noirsound.com',
    title: 'Dnipro Nights',
    description: 'Ukrainian-language indie with a warm, hometown feel.',
    genre: 'ukrainian',
    tags: ['ukrainian', 'indie'],
    durationSeconds: 212,
    coverUrl: null,
    releaseDate: '2026-05-06T00:00:00.000Z',
  },
];

// Stable IDs for demo records so they are idempotent and safely removable.
const DEMO_PLAYLIST_ID = 'seed-nocturne-notes';
const DEMO_COMMENT_ID = 'seed-comment-glass-highway';
const DEMO_PLAY_EVENT_ID = 'seed-play-glass-highway';

// Emails used exclusively by the demo seed (not minimal seed).
const DEMO_ARTIST_EMAILS = DEMO_ARTISTS.map((a) => a.email);

// All demo track slugs for identification.
const DEMO_TRACK_SLUGS = DEMO_TRACKS.map((t) => t.slug);

// ---------------------------------------------------------------------------
// Minimal seed – creates only users and required profiles.
// ---------------------------------------------------------------------------
async function seedMinimal(client = prisma) {
  console.log('Seeding NoirSound (MINIMAL mode)...');
  const passwordHash = await argon2.hash('password123');

  const admin = await client.user.upsert({
    where: { email: MINIMAL_USERS.admin.email },
    update: {
      username: MINIMAL_USERS.admin.username,
      displayName: MINIMAL_USERS.admin.displayName,
      passwordHash,
      role: MINIMAL_USERS.admin.role,
    },
    create: {
      email: MINIMAL_USERS.admin.email,
      username: MINIMAL_USERS.admin.username,
      displayName: MINIMAL_USERS.admin.displayName,
      passwordHash,
      role: MINIMAL_USERS.admin.role,
    },
  });

  const artistUser = await client.user.upsert({
    where: { email: MINIMAL_USERS.artist.email },
    update: {
      username: MINIMAL_USERS.artist.username,
      displayName: MINIMAL_USERS.artist.displayName,
      passwordHash,
      role: MINIMAL_USERS.artist.role,
      avatarUrl: null,
    },
    create: {
      email: MINIMAL_USERS.artist.email,
      username: MINIMAL_USERS.artist.username,
      displayName: MINIMAL_USERS.artist.displayName,
      passwordHash,
      role: MINIMAL_USERS.artist.role,
      avatarUrl: null,
    },
  });

  // The artist user needs an ArtistProfile so the account functions correctly.
  const artistProfile = await client.artistProfile.upsert({
    where: { userId: artistUser.id },
    update: {
      genres: MINIMAL_USERS.artist.genres,
      monthlyListeners: 0,
    },
    create: {
      userId: artistUser.id,
      genres: MINIMAL_USERS.artist.genres,
      monthlyListeners: 0,
    },
  });

  const listener = await client.user.upsert({
    where: { email: MINIMAL_USERS.listener.email },
    update: {
      username: MINIMAL_USERS.listener.username,
      displayName: MINIMAL_USERS.listener.displayName,
      passwordHash,
      role: MINIMAL_USERS.listener.role,
    },
    create: {
      email: MINIMAL_USERS.listener.email,
      username: MINIMAL_USERS.listener.username,
      displayName: MINIMAL_USERS.listener.displayName,
      passwordHash,
      role: MINIMAL_USERS.listener.role,
    },
  });

  console.log('Minimal seed completed: 3 users (admin, artist, listener), 1 artist profile.');
  console.log('No tracks, playlists, comments, or play events were created.');

  return { admin, artistUser, artistProfile, listener };
}

// ---------------------------------------------------------------------------
// Demo seed – creates demo tracks/playlists/comments/play events.
// Always runs minimal seed first to ensure base users exist.
// ---------------------------------------------------------------------------
async function seedDemo(client = prisma) {
  console.log('Seeding NoirSound (DEMO mode)...');

  // Ensure base users exist first.
  const { listener } = await seedMinimal(client);
  const passwordHash = await argon2.hash('password123');

  // Create additional demo artists.
  const artistProfilesByEmail = new Map();

  // Fetch the primary artist profile created by minimal seed.
  const primaryArtistUser = await client.user.findUnique({
    where: { email: MINIMAL_USERS.artist.email },
    include: { artistProfile: true },
  });
  artistProfilesByEmail.set(MINIMAL_USERS.artist.email, primaryArtistUser.artistProfile);

  for (const artistData of DEMO_ARTISTS) {
    const user = await client.user.upsert({
      where: { email: artistData.email },
      update: {
        username: artistData.username,
        displayName: artistData.displayName,
        passwordHash,
        role: 'ARTIST',
        avatarUrl: null,
      },
      create: {
        email: artistData.email,
        username: artistData.username,
        displayName: artistData.displayName,
        passwordHash,
        role: 'ARTIST',
        avatarUrl: null,
      },
    });

    const profile = await client.artistProfile.upsert({
      where: { userId: user.id },
      update: {
        genres: artistData.genres,
        monthlyListeners: 0,
      },
      create: {
        userId: user.id,
        genres: artistData.genres,
        monthlyListeners: 0,
      },
    });
    artistProfilesByEmail.set(artistData.email, profile);
  }

  // Clean up legacy tracks from previous seed versions.
  const primaryArtist = artistProfilesByEmail.get(MINIMAL_USERS.artist.email);
  await client.track.deleteMany({
    where: {
      artistId: primaryArtist.id,
      slug: null,
      title: { in: ['Neon Drift', 'Midnight Run'] },
      originalAudioKey: null,
      processedAudioKey: null,
      copyrightConfirmed: false,
    },
  });

  // Seed demo tracks.
  const tracksBySlug = new Map();
  for (const trackData of DEMO_TRACKS) {
    const artist = artistProfilesByEmail.get(trackData.artistEmail);
    const releaseDate = new Date(trackData.releaseDate);
    const track = await client.track.upsert({
      where: { slug: trackData.slug },
      update: {
        artistId: artist.id,
        title: trackData.title,
        description: trackData.description,
        genre: trackData.genre,
        tags: trackData.tags,
        durationSeconds: trackData.durationSeconds,
        coverUrl: trackData.coverUrl,
        status: 'PUBLISHED',
        releaseDate,
        publishedAt: releaseDate,
      },
      create: {
        slug: trackData.slug,
        artistId: artist.id,
        title: trackData.title,
        description: trackData.description,
        genre: trackData.genre,
        tags: trackData.tags,
        durationSeconds: trackData.durationSeconds,
        coverUrl: trackData.coverUrl,
        status: 'PUBLISHED',
        releaseDate,
        publishedAt: releaseDate,
      },
    });
    tracksBySlug.set(trackData.slug, track);
  }

  // Seed demo playlist.
  await client.playlist.deleteMany({
    where: {
      creatorId: listener.id,
      name: 'Night Drive',
      description: 'The ultimate late night phonk collection',
      id: { not: DEMO_PLAYLIST_ID },
    },
  });

  const playlist = await client.playlist.upsert({
    where: { id: DEMO_PLAYLIST_ID },
    update: {
      name: 'Nocturne Notes',
      description: 'A small cross-section of the local development catalogue.',
      creatorId: listener.id,
      coverUrl: null,
      isPublic: true,
    },
    create: {
      id: DEMO_PLAYLIST_ID,
      name: 'Nocturne Notes',
      description: 'A small cross-section of the local development catalogue.',
      creatorId: listener.id,
      coverUrl: null,
      isPublic: true,
    },
  });

  const playlistTracks = [
    tracksBySlug.get('seed-glass-highway'),
    tracksBySlug.get('seed-low-orbit'),
    tracksBySlug.get('seed-rain-on-fifth-street'),
    tracksBySlug.get('seed-voltage-garden'),
  ];
  await client.playlistTrack.deleteMany({ where: { playlistId: playlist.id } });
  await client.playlistTrack.createMany({
    data: playlistTracks.map((track, index) => ({
      playlistId: playlist.id,
      trackId: track.id,
      order: index + 1,
    })),
    skipDuplicates: true,
  });

  // Seed demo comment.
  const glassHighway = tracksBySlug.get('seed-glass-highway');
  await client.comment.upsert({
    where: { id: DEMO_COMMENT_ID },
    update: {
      text: 'The restrained percussion works well here.',
      userId: listener.id,
      trackId: glassHighway.id,
      isDeleted: false,
    },
    create: {
      id: DEMO_COMMENT_ID,
      text: 'The restrained percussion works well here.',
      userId: listener.id,
      trackId: glassHighway.id,
    },
  });

  // Seed demo play event.
  await client.playEvent.upsert({
    where: { id: DEMO_PLAY_EVENT_ID },
    update: {
      trackId: glassHighway.id,
      userId: listener.id,
      artistId: glassHighway.artistId,
      durationListenedSeconds: 120,
      completed: true,
      source: 'seed_history',
    },
    create: {
      id: DEMO_PLAY_EVENT_ID,
      trackId: glassHighway.id,
      userId: listener.id,
      artistId: glassHighway.artistId,
      durationListenedSeconds: 120,
      completed: true,
      source: 'seed_history',
    },
  });

  console.log(`Demo seed completed: ${DEMO_ARTISTS.length + 1} artists, ${DEMO_TRACKS.length} tracks.`);
  return {
    listener,
    artists: artistProfilesByEmail,
    tracks: tracksBySlug,
    playlist,
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
if (require.main === module) {
  const mode = process.argv[2] || 'minimal';
  const validModes = ['minimal', 'demo'];

  if (!validModes.includes(mode)) {
    console.error(`Unknown seed mode: "${mode}". Use one of: ${validModes.join(', ')}`);
    process.exitCode = 1;
  } else {
    const seedFn = mode === 'demo' ? seedDemo : seedMinimal;
    seedFn()
      .catch((error) => {
        console.error(error);
        process.exitCode = 1;
      })
      .finally(async () => {
        await prisma.$disconnect();
      });
  }
}

module.exports = {
  MINIMAL_USERS,
  DEMO_ARTISTS,
  DEMO_TRACKS,
  DEMO_TRACK_SLUGS,
  DEMO_ARTIST_EMAILS,
  DEMO_PLAYLIST_ID,
  DEMO_COMMENT_ID,
  DEMO_PLAY_EVENT_ID,
  seedMinimal,
  seedDemo,
};
