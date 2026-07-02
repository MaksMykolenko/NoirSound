#!/usr/bin/env node
/**
 * check-stats-integrity.js -- Read-only cross-check between stored stats
 * aggregates (Track.plays, ArtistProfile.monthlyListeners) and what the raw
 * PlayEvent/ArtistFollow tables actually say, plus a handful of structural
 * invariant checks (duplicate follows, orphan rows, missing artist
 * profiles).
 *
 * This script NEVER writes to the database. It shares its checks verbatim
 * with GET /api/admin/stats/integrity (see backend/src/lib/statsIntegrity.js)
 * so the CLI and the admin UI can never disagree about what counts as a
 * mismatch.
 *
 * Exit code: 0 if PASS, 1 if FAIL (or on error) -- safe to wire into CI.
 *
 * Usage:
 *   npm run stats:check
 *   node scripts/check-stats-integrity.js
 */
require('dotenv').config();
const { createPrismaClient } = require('../src/lib/prisma');
const { runStatsIntegrityCheck } = require('../src/lib/statsIntegrity');

function printSection(title, rows, formatRow) {
  console.log(`\n${title}: ${rows.length}`);
  if (rows.length === 0) return;
  const preview = rows.slice(0, 20);
  for (const row of preview) {
    console.log(`  - ${formatRow(row)}`);
  }
  if (rows.length > preview.length) {
    console.log(`  ... and ${rows.length - preview.length} more`);
  }
}

async function main() {
  const prisma = createPrismaClient();
  try {
    console.log('=== NoirSound stats integrity check ===');
    console.log(`Started: ${new Date().toISOString()}`);

    const report = await runStatsIntegrityCheck(prisma);

    console.log(`\nVerdict: ${report.verdict}`);
    console.log('Issue counts:');
    for (const [key, count] of Object.entries(report.counts)) {
      console.log(`  ${key}: ${count}`);
    }

    printSection(
      'Duplicate follows (structural invariant -- should never happen)',
      report.details.duplicateFollows,
      (row) => `user ${row.userId} -> artist ${row.artistId} (${row.count}x)`
    );
    printSection(
      'Users with ARTIST role but no ArtistProfile',
      report.details.missingArtistProfiles,
      (row) => `${row.username} <${row.email}> [${row.role}] (${row.id})`
    );
    printSection(
      'Orphan ArtistProfiles (structural invariant -- should never happen)',
      report.details.orphanArtistProfiles,
      (row) => `artistProfile ${row.artistProfileId} -> missing user ${row.userId}`
    );
    printSection(
      'Tracks where stored plays != actual qualified PlayEvent count',
      report.details.staleTrackPlayCounts,
      (row) => `"${row.title}" (${row.trackId}): stored=${row.storedPlays} actual=${row.actualQualifiedPlayEvents}`
    );
    printSection(
      'Artists where stored monthlyListeners != recomputed value',
      report.details.staleMonthlyListeners,
      (row) => `${row.username || row.artistId}: stored=${row.storedMonthlyListeners} actual=${row.actualMonthlyListeners}`
    );
    printSection(
      'Orphan PlayEvents (structural invariant -- should never happen)',
      report.details.orphanPlayEvents,
      (row) => `playEvent ${row.playEventId} (track=${row.trackId}, user=${row.userId})`
    );
    printSection(
      'Orphan ArtistFollows (structural invariant -- should never happen)',
      report.details.orphanFollows,
      (row) => `user ${row.userId} -> artist ${row.artistId}`
    );

    if (report.verdict === 'FAIL') {
      console.log('\nSome stored aggregates are out of date. Recalculate with:');
      console.log('  node scripts/recalculate-track-stats.js --apply');
      console.log('  node scripts/recalculate-artist-stats.js --apply');
      console.log('  node scripts/recalculate-follower-counts.js --apply');
      console.log('(or use the admin UI recalculate buttons under /admin/system/stats)');
    } else {
      console.log('\nAll checked aggregates match the raw data. No action needed.');
    }

    process.exitCode = report.verdict === 'PASS' ? 0 : 1;
  } catch (error) {
    console.error('\nstats:check failed to run:', error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
