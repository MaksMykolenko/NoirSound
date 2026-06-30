#!/usr/bin/env node
/**
 * cleanDemoData.js – Safely removes known demo seed records from the database.
 *
 * Safety features:
 * - Refuses to run if NODE_ENV=production
 * - Refuses if the database name does not look like a local/dev/test database
 * - Prints what it will delete before acting
 * - Requires --confirm flag to actually execute deletions
 * - Only deletes records with known demo seed identifiers (stable IDs, slugs, emails)
 * - Does NOT delete user-uploaded tracks or arbitrary records
 * - Does NOT delete the minimal seed users (admin, artist, listener)
 */
require('dotenv').config();
const { createPrismaClient } = require('../src/lib/prisma');

const {
  DEMO_TRACK_SLUGS,
  DEMO_ARTIST_EMAILS,
  DEMO_PLAYLIST_ID,
  DEMO_COMMENT_ID,
  DEMO_PLAY_EVENT_ID,
} = require('../prisma/seed');

// ---------------------------------------------------------------------------
// Safety checks
// ---------------------------------------------------------------------------
function enforceSafety() {
  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: Refusing to run demo cleanup with NODE_ENV=production.');
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL is not set.');
    process.exit(1);
  }

  try {
    const parsed = new URL(dbUrl);
    const dbName = parsed.pathname.slice(1).toLowerCase();
    const safePatterns = ['local', 'dev', 'test', 'noirsound'];
    const looksLocal = safePatterns.some((pattern) => dbName.includes(pattern))
      || parsed.hostname === 'localhost'
      || parsed.hostname === '127.0.0.1';

    if (!looksLocal) {
      console.error(
        `ERROR: Database "${dbName}" on host "${parsed.hostname}" does not look like a local/dev/test database.\n`
        + 'Set NODE_ENV or use a database with "local", "dev", or "test" in its name.'
      );
      process.exit(1);
    }
  } catch {
    console.error('ERROR: Could not parse DATABASE_URL.');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  enforceSafety();

  const dryRun = !process.argv.includes('--confirm');
  const prisma = createPrismaClient();

  try {
    console.log(dryRun ? '\n=== DRY RUN (pass --confirm to execute) ===\n' : '\n=== EXECUTING DEMO CLEANUP ===\n');

    // 1. Count demo play events
    const playEventCount = await prisma.playEvent.count({
      where: { id: DEMO_PLAY_EVENT_ID },
    });
    console.log(`Play events to delete: ${playEventCount} (id: ${DEMO_PLAY_EVENT_ID})`);

    // 2. Count demo comments
    const commentCount = await prisma.comment.count({
      where: { id: DEMO_COMMENT_ID },
    });
    console.log(`Comments to delete: ${commentCount} (id: ${DEMO_COMMENT_ID})`);

    // 3. Count demo playlist tracks
    const playlistTrackCount = await prisma.playlistTrack.count({
      where: { playlistId: DEMO_PLAYLIST_ID },
    });
    console.log(`Playlist tracks to delete: ${playlistTrackCount} (playlist: ${DEMO_PLAYLIST_ID})`);

    // 4. Count demo playlist
    const playlistCount = await prisma.playlist.count({
      where: { id: DEMO_PLAYLIST_ID },
    });
    console.log(`Playlists to delete: ${playlistCount} (id: ${DEMO_PLAYLIST_ID})`);

    // 5. Count demo tracks (by slug)
    const trackCount = await prisma.track.count({
      where: { slug: { in: DEMO_TRACK_SLUGS } },
    });
    console.log(`Demo tracks to delete: ${trackCount} (slugs: ${DEMO_TRACK_SLUGS.join(', ')})`);

    // 6. Count demo artist profiles and users (by email)
    const demoArtistUserCount = await prisma.user.count({
      where: { email: { in: DEMO_ARTIST_EMAILS } },
    });
    console.log(`Demo artist users to delete: ${demoArtistUserCount} (emails: ${DEMO_ARTIST_EMAILS.join(', ')})`);

    // Note: we do NOT delete the minimal seed users (admin, artist, listener).
    console.log('\nMinimal seed users will NOT be deleted (admin, artist, listener).');

    // Count user-uploaded tracks to show they are safe
    const userUploadedCount = await prisma.track.count({
      where: {
        slug: { notIn: DEMO_TRACK_SLUGS },
        OR: [
          { originalAudioKey: { not: null } },
          { processedAudioKey: { not: null } },
        ],
      },
    });
    if (userUploadedCount > 0) {
      console.log(`\nUser-uploaded tracks found: ${userUploadedCount} — these will NOT be touched.`);
    }

    if (dryRun) {
      console.log('\nNo changes made. Run with --confirm to execute.');
      return;
    }

    // Execute deletions in safe dependency order.
    console.log('\nDeleting...');

    const deletedPlayEvents = await prisma.playEvent.deleteMany({
      where: { id: DEMO_PLAY_EVENT_ID },
    });
    console.log(`  Deleted ${deletedPlayEvents.count} play events.`);

    const deletedComments = await prisma.comment.deleteMany({
      where: { id: DEMO_COMMENT_ID },
    });
    console.log(`  Deleted ${deletedComments.count} comments.`);

    const deletedPlaylistTracks = await prisma.playlistTrack.deleteMany({
      where: { playlistId: DEMO_PLAYLIST_ID },
    });
    console.log(`  Deleted ${deletedPlaylistTracks.count} playlist tracks.`);

    const deletedPlaylists = await prisma.playlist.deleteMany({
      where: { id: DEMO_PLAYLIST_ID },
    });
    console.log(`  Deleted ${deletedPlaylists.count} playlists.`);

    const deletedTracks = await prisma.track.deleteMany({
      where: { slug: { in: DEMO_TRACK_SLUGS } },
    });
    console.log(`  Deleted ${deletedTracks.count} demo tracks.`);

    // Delete demo artist profiles (cascade from user delete handles profiles)
    const deletedUsers = await prisma.user.deleteMany({
      where: { email: { in: DEMO_ARTIST_EMAILS } },
    });
    console.log(`  Deleted ${deletedUsers.count} demo artist users.`);

    console.log('\nDemo cleanup complete.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Cleanup failed:', error.message);
  process.exit(1);
});
