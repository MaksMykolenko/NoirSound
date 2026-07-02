#!/usr/bin/env node
/**
 * recalculate-follower-counts.js -- Checks (and optionally repairs)
 * follower-count data integrity.
 *
 * IMPORTANT: unlike Track.plays or ArtistProfile.monthlyListeners, NoirSound
 * does NOT store a follower-count aggregate anywhere. ArtistFollow's primary
 * key is the composite (userId, artistId), and every follower count shown
 * anywhere in the app (artist cards, artist page, dashboard) is always a
 * live `count()`/`_count` query against that table at request time. There is
 * therefore no cached number that can go "stale" the way play counts or
 * monthly listeners can -- this script exists to verify the structural
 * invariants that make follower counts trustworthy in the first place,
 * not to recompute a cache:
 *
 *  1. Duplicate (userId, artistId) rows -- the composite primary key makes
 *     this impossible at the database level. Checked defensively anyway.
 *  2. Orphan follow rows referencing a userId/artistId that no longer
 *     exists -- both relations cascade-delete, so this should also be
 *     impossible via normal application writes. Checked defensively in
 *     case of a raw SQL edit or a restored backup that bypassed FK
 *     enforcement.
 *
 * Safety:
 * - Dry-run by default: only reports what it finds.
 * - Requires --apply to delete anything, and only ever deletes rows that
 *   are themselves already broken (duplicates beyond the first, or rows
 *   pointing at a user/artist that no longer exists) -- never a real,
 *   valid follow relationship.
 *
 * Usage:
 *   node scripts/recalculate-follower-counts.js            (dry run)
 *   node scripts/recalculate-follower-counts.js --apply     (repairs)
 */
require('dotenv').config();
const { createPrismaClient } = require('../src/lib/prisma');
const { findDuplicateFollows, findOrphanFollows } = require('../src/lib/statsIntegrity');

async function main() {
  const apply = process.argv.includes('--apply');
  const prisma = createPrismaClient();

  try {
    console.log(apply ? '\n=== APPLYING follower data-integrity repair ===\n' : '\n=== DRY RUN: follower data-integrity check (pass --apply to repair) ===\n');
    console.log('Note: follower counts are always computed live from ArtistFollow --');
    console.log('there is no stored aggregate to recalculate. This checks the table\'s');
    console.log('structural invariants instead.\n');

    const [duplicates, orphans] = await Promise.all([
      findDuplicateFollows(prisma),
      findOrphanFollows(prisma)
    ]);

    console.log(`Duplicate (userId, artistId) rows: ${duplicates.length} (expected: 0 -- prevented by the composite primary key)`);
    for (const row of duplicates) {
      console.log(`  user ${row.userId} -> artist ${row.artistId} (${row.count}x)`);
    }

    console.log(`Orphan follow rows: ${orphans.length} (expected: 0 -- prevented by cascade deletes)`);
    for (const row of orphans) {
      console.log(`  user ${row.userId} -> artist ${row.artistId}`);
    }

    if (duplicates.length === 0 && orphans.length === 0) {
      console.log('\nNo integrity issues found. Follower counts read directly from this table can be trusted as-is.');
      return;
    }

    if (!apply) {
      console.log('\nNo changes made. Re-run with --apply to delete the broken rows listed above.');
      return;
    }

    let deletedOrphans = 0;
    for (const row of orphans) {
      // eslint-disable-next-line no-await-in-loop
      const result = await prisma.artistFollow.deleteMany({
        where: { userId: row.userId, artistId: row.artistId }
      });
      deletedOrphans += result.count;
    }
    console.log(`\nDeleted ${deletedOrphans} orphan follow row(s).`);

    if (duplicates.length > 0) {
      console.log(`\n${duplicates.length} duplicate group(s) were reported but not auto-deleted: true duplicates`);
      console.log('cannot exist under the composite primary key, so this would need manual');
      console.log('investigation (likely a schema/migration issue) rather than an automated delete.');
    }

    console.log('\nDone.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('recalculate-follower-counts failed:', error.message);
  process.exitCode = 1;
});
