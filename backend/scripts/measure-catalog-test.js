'use strict';

// Read-only query measurements after creating/seeding this one disposable DB.
// Never imported by the API, worker, normal seed, or deployment scripts.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { createHash } = require('node:crypto');
const { Client, Pool } = require('pg');
const { assertDatabaseScope, databaseUrl, createOwnedDatabase, dropOwnedDatabase } = require('../../scripts/integration/database-guard.cjs');
const { Prisma, PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { seedCatalogFixture } = require('../tests/fixtures/catalogFixture');
const { parseCatalogQuery, decodeCatalogCursor, catalogPageQuery, searchCatalog } = require('../src/lib/catalogSearch');

async function main() {
  assertDatabaseScope(process.env, process.env.DATABASE_URL, 'api');
  const configured = new URL(databaseUrl(process.env, 'performance'));
  const scope = assertDatabaseScope(process.env, configured.toString(), 'performance');
  const databaseName = scope.name;
  const admin = new Client({ connectionString: scope.adminUrl });
  await admin.connect();
  let owned;
  try {
    owned = await createOwnedDatabase(admin, scope);
    process.env.DATABASE_URL = configured.toString();
  const migration = spawnSync(path.resolve(__dirname, '../node_modules/.bin/prisma'), ['migrate', 'deploy'], {
    cwd: path.resolve(__dirname, '..'), env: process.env, stdio: 'pipe', encoding: 'utf8',
  });
  if (migration.status !== 0) throw new Error('Disposable performance database migration failed.');
  const prisma = new PrismaClient({
    adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })),
    log: [{ emit: 'event', level: 'query' }],
  });
  let selectCount = 0;
  prisma.$on('query', event => { if (/^\s*(SELECT|WITH)\b/iu.test(event.query)) selectCount += 1; });
  try {
    const prefix = 'catalog-perf';
    if (!await prisma.track.count({ where: { id: { startsWith: prefix } } })) {
      await seedCatalogFixture(prisma, { prefix });
    }
    // ANALYZE updates planner statistics only in our dedicated test database.
    for (const statement of [Prisma.sql`ANALYZE "Track"`, Prisma.sql`ANALYZE "PlayEvent"`, Prisma.sql`ANALYZE "ArtistProfile"`, Prisma.sql`ANALYZE "User"`]) {
      await prisma.$executeRaw(statement);
    }
    const counts = {
      tracks: await prisma.track.count(),
      music: await prisma.track.count({ where: { contentType: 'MUSIC', status: 'PUBLISHED', isPublic: true } }),
      beats: await prisma.track.count({ where: { contentType: 'BEAT', id: { startsWith: `${prefix}-beat-` } } }),
      authors: await prisma.artistProfile.count(), playEvents: await prisma.playEvent.count(),
    };
    if (counts.music < 150 || counts.beats < 150) throw new Error('Representative fixture is too small.');
    const scenarios = [
      ['recent_first', { limit: '30' }],
      ['recent_next', { limit: '30' }],
      ['literal_unicode_search', { q: 'Łódź Україна 50%_# "quote"', limit: '30' }],
      ['beat_filter', { contentType: 'BEAT', style: 'Trap', mood: 'Dark', key: 'F# Minor', bpmMin: '40', bpmMax: '150', limit: '30' }],
      ['played', { sort: 'played', limit: '30' }],
      ['trending_7days', { sort: 'trending', limit: '30' }],
      ['maximum_page', { limit: '100' }],
    ];
    const results = [];
    for (const [name, params] of scenarios) {
      const filters = parseCatalogQuery(params).value;
      if (!filters) throw new Error(`Invalid measurement parameters: ${name}`);
      let decoded = decodeCatalogCursor(filters);
      if (name === 'recent_next') {
        const first = await searchCatalog(prisma, filters, decoded);
        filters.cursor = first.pageInfo.nextCursor;
        decoded = decodeCatalogCursor(filters);
      }
      const query = catalogPageQuery(filters, decoded.value, decoded.asOf);
      const explained = await prisma.$queryRaw(Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`);
      const plan = explained[0]['QUERY PLAN'][0];
      const times = [];
      const statementCounts = [];
      let response;
      for (let run = 0; run < 9; run += 1) {
        const start = performance.now();
        const before = selectCount;
        response = await searchCatalog(prisma, filters, decoded);
        if (run > 1) {
          times.push(performance.now() - start);
          statementCounts.push(selectCount - before);
        }
      }
      times.sort((a, b) => a - b);
      results.push({
        scenario: name, total: response.total, items: response.items.length,
        jsonBytes: Buffer.byteLength(JSON.stringify(response)),
        pagePlanningMs: plan['Planning Time'], pageExecutionMs: plan['Execution Time'],
        fullCatalogMedianMs: Number(times[Math.floor(times.length / 2)].toFixed(3)),
        fullCatalogMaxMs: Number(times.at(-1).toFixed(3)), samples: times.length,
        selectStatementsPerResponse: statementCounts,
        plan, parameterizedSql: query.sql,
      });
    }
    const report = {
      measuredAt: new Date().toISOString(), database: databaseName, counts,
      sourceHashes: Object.fromEntries(['src/lib/catalogSearch.js', 'src/lib/publicVisibility.js', 'tests/fixtures/catalogFixture.js'].map(file => [file,
        createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '..', file))).digest('hex'),
      ])),
      methodology: 'Dedicated PostgreSQL database; ANALYZE first; EXPLAIN ANALYZE BUFFERS for actual parameterized page SQL; full catalog response includes total and all facet aggregates, 2 warmup + 7 measured samples. Local warm-cache measurements, not production or a large-scale capacity claim.',
      results,
    };
    const destination = path.resolve(__dirname, '../../test-results/integration/performance.json');
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ counts, results: results.map(({ plan: _plan, parameterizedSql: _sql, ...entry }) => entry) }, null, 2));
  } finally { await prisma.$disconnect(); }
  } finally {
    try { if (owned) await dropOwnedDatabase(admin, owned); }
    finally { await admin.end(); }
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
