#!/usr/bin/env node
/**
 * recalculate-track-stats.js -- Recomputes Track.plays (a stored aggregate)
 * from the real qualified PlayEvent count for every track, and corrects any
 * that have drifted.
 *
 * Track.plays is a *pure recomputation* target, never an increment: this
 * script (and the admin recalculate endpoint it shares logic with) can be
 * run as often as needed without ever double-counting or drifting further
 * from the truth.
 *
 * Safety:
 * - Dry-run by default: only reports what WOULD change.
 * - Requires --apply to actually write anything.
 * - Never deletes rows -- only rewrites the Track.plays integer to match
 *   the real, live count of qualified PlayEvent rows for that track.
 * - Logs every change (track id, title, previous value, new value).
 *
 * Usage:
 *   node scripts/recalculate-track-stats.js            (dry run)
 *   node scripts/recalculate-track-stats.js --apply     (writes changes)
 */
require('dotenv').config();
const { createPrismaClient } = require('../src/lib/prisma');
const { findStaleTrackPlayCounts } = require('../src/lib/statsIntegrity');
const { recalculateAllTrackPlayCounts } = require('../src/lib/statsAccess');

async function main() {
  const apply = process.argv.includes('--apply');
  const prisma = createPrismaClient();

  try {
    console.log(apply ? '\n=== APPLYING track play-count recalculation ===\n' : '\n=== DRY RUN: track play-count recalculation (pass --apply to write) ===\n');

    const stale = await findStaleTrackPlayCounts(prisma);

    if (stale.length === 0) {
      console.log('No drift found -- every Track.plays already matches its actual qualified PlayEvent count.');
      return;
    }

    console.log(`${stale.length} track(s) out of date:`);
    for (const row of stale) {
      console.log(`  "${row.title}" (${row.trackId}): stored=${row.storedPlays} -> actual=${row.actualQualifiedPlayEvents}`);
    }

    if (!apply) {
      console.log('\nNo changes made. Re-run with --apply to write these values.');
      return;
    }

    const results = await recalculateAllTrackPlayCounts(prisma);
    const changed = results.filter((row) => row.changed);
    console.log(`\nWrote ${changed.length} updated track(s):`);
    for (const row of changed) {
      console.log(`  ${row.trackId}: ${row.previousPlays} -> ${row.plays}`);
    }
    console.log('\nDone.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('recalculate-track-stats failed:', error.message);
  process.exitCode = 1;
});
