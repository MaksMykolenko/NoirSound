#!/usr/bin/env node
/**
 * recalculate-artist-stats.js -- Recomputes ArtistProfile.monthlyListeners
 * (a stored, kept-fresh-on-write cache) from a fresh distinct-qualified-
 * listener count over the trailing 30 days, for every artist.
 *
 * monthlyListeners is refreshed automatically on every qualifying play (see
 * POST /api/tracks/:id/play-event), so this script is mainly useful when:
 *  - the 30-day window has simply rolled forward with no new activity for
 *    an artist (nothing will re-trigger a refresh on its own), or
 *  - a bulk data change (migration, manual DB edit, restored backup) needs
 *    every artist's cache brought back in sync at once.
 *
 * Safety:
 * - Dry-run by default: only reports what WOULD change.
 * - Requires --apply to actually write anything.
 * - Never deletes rows -- only rewrites the ArtistProfile.monthlyListeners
 *   integer to match a fresh recomputation.
 * - Logs every change (artist id, username, previous value, new value).
 *
 * Usage:
 *   node scripts/recalculate-artist-stats.js            (dry run)
 *   node scripts/recalculate-artist-stats.js --apply     (writes changes)
 */
require('dotenv').config();
const { createPrismaClient } = require('../src/lib/prisma');
const { findStaleMonthlyListeners } = require('../src/lib/statsIntegrity');
const { recalculateAllArtistMonthlyListeners } = require('../src/lib/statsAccess');

async function main() {
  const apply = process.argv.includes('--apply');
  const prisma = createPrismaClient();

  try {
    console.log(apply ? '\n=== APPLYING artist monthly-listener recalculation ===\n' : '\n=== DRY RUN: artist monthly-listener recalculation (pass --apply to write) ===\n');

    const now = new Date();
    const stale = await findStaleMonthlyListeners(prisma, now);

    if (stale.length === 0) {
      console.log('No drift found -- every ArtistProfile.monthlyListeners already matches a fresh recomputation.');
      return;
    }

    console.log(`${stale.length} artist(s) out of date:`);
    for (const row of stale) {
      console.log(`  ${row.username || row.artistId}: stored=${row.storedMonthlyListeners} -> actual=${row.actualMonthlyListeners}`);
    }

    if (!apply) {
      console.log('\nNo changes made. Re-run with --apply to write these values.');
      return;
    }

    const results = await recalculateAllArtistMonthlyListeners(prisma, now);
    const changed = results.filter((row) => row.changed);
    console.log(`\nWrote ${changed.length} updated artist(s):`);
    for (const row of changed) {
      console.log(`  ${row.artistId}: ${row.previousMonthlyListeners} -> ${row.monthlyListeners}`);
    }
    console.log('\nDone.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('recalculate-artist-stats failed:', error.message);
  process.exitCode = 1;
});
