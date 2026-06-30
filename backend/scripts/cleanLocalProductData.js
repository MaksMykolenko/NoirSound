#!/usr/bin/env node
/**
 * cleanLocalProductData.js – Safely wipes product content from local/dev/test database.
 *
 * Safety features:
 * - Refuses to run if NODE_ENV=production
 * - Refuses if database name/host does not look like local/dev/test
 * - Dry-run by default; requires --confirm flag to execute deletions
 * - Keeps core system accounts (admin, artist, listener) by default
 * - Deletes product content in safe dependency order
 */
require('dotenv').config();
const { createPrismaClient } = require('../src/lib/prisma');

const CORE_USER_EMAILS = [
  'admin@noirsound.com',
  'artist@noirsound.com',
  'listener@noirsound.com',
];

function enforceSafety() {
  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: Refusing to run product data cleanup with NODE_ENV=production.');
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
        + 'Cleanup is restricted to local development environments.'
      );
      process.exit(1);
    }
  } catch {
    console.error('ERROR: Could not parse DATABASE_URL.');
    process.exit(1);
  }
}

async function main() {
  enforceSafety();

  const confirm = process.argv.includes('--confirm');
  const includeUsers = process.argv.includes('--include-users');
  const dryRun = !confirm;
  const prisma = createPrismaClient();

  try {
    console.log(dryRun ? '\n=== DRY RUN: LOCAL PRODUCT DATA CLEANUP (pass --confirm to execute) ===\n' : '\n=== EXECUTING LOCAL PRODUCT DATA CLEANUP ===\n');

    const playEventCount = await prisma.playEvent.count();
    const listeningAggregateCount = await prisma.listeningAggregate.count();
    const commentLikeCount = await prisma.commentLike.count();
    const commentCount = await prisma.comment.count();
    const playlistTrackCount = await prisma.playlistTrack.count();
    const playlistLikeCount = await prisma.playlistLike.count();
    const playlistCount = await prisma.playlist.count();
    const trackLikeCount = await prisma.trackLike.count();
    const artistFollowCount = await prisma.artistFollow.count();
    const uploadCount = await prisma.upload.count();
    const trackAudioAssetCount = await prisma.trackAudioAsset.count();
    const trackCount = await prisma.track.count();
    const reportCount = await prisma.report.count();
    const moderationDecisionCount = await prisma.moderationDecision.count();

    const totalUsers = await prisma.user.count();
    const nonCoreUserCount = await prisma.user.count({
      where: { email: { notIn: CORE_USER_EMAILS } },
    });

    console.log(`Play Events: ${playEventCount}`);
    console.log(`Listening Aggregates: ${listeningAggregateCount}`);
    console.log(`Comment Likes: ${commentLikeCount}`);
    console.log(`Comments: ${commentCount}`);
    console.log(`Playlist Tracks: ${playlistTrackCount}`);
    console.log(`Playlist Likes: ${playlistLikeCount}`);
    console.log(`Playlists: ${playlistCount}`);
    console.log(`Track Likes: ${trackLikeCount}`);
    console.log(`Artist Follows: ${artistFollowCount}`);
    console.log(`Uploads: ${uploadCount}`);
    console.log(`Track Audio Assets: ${trackAudioAssetCount}`);
    console.log(`Tracks: ${trackCount}`);
    console.log(`Reports / Moderation Decisions: ${reportCount} / ${moderationDecisionCount}`);

    if (includeUsers) {
      console.log(`Non-core Users to delete: ${nonCoreUserCount} (Total users: ${totalUsers})`);
    } else {
      console.log(`Core users preserved (${CORE_USER_EMAILS.join(', ')}). Non-core users kept by default (use --include-users to purge).`);
    }

    if (dryRun) {
      console.log('\nDry run complete. No database records were modified.');
      console.log('To execute cleanup, run: npm run db:clean-local -- --confirm');
      return;
    }

    console.log('\nDeleting product data in safe dependency order...');

    await prisma.playEvent.deleteMany();
    await prisma.listeningAggregate.deleteMany();
    await prisma.commentLike.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.playlistTrack.deleteMany();
    await prisma.playlistLike.deleteMany();
    await prisma.playlist.deleteMany();
    await prisma.trackLike.deleteMany();
    await prisma.artistFollow.deleteMany();
    await prisma.upload.deleteMany();
    await prisma.moderationDecision.deleteMany();
    await prisma.report.deleteMany();
    await prisma.trackAudioAsset.deleteMany();
    await prisma.track.deleteMany();

    if (includeUsers) {
      await prisma.user.deleteMany({
        where: { email: { notIn: CORE_USER_EMAILS } },
      });
      console.log(`Deleted ${nonCoreUserCount} non-core users.`);
    }

    console.log('\nLocal product data cleanup successfully completed.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Cleanup failed:', error.message);
  process.exit(1);
});
