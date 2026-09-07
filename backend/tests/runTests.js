const path = require('path');
const { spawnSync } = require('child_process');
const { readdirSync } = require('fs');
const { assertDatabaseScope, databaseUrl, createOwnedDatabase, dropOwnedDatabase } = require('../../scripts/integration/database-guard.cjs');

function run(command, args, env) {
  const result = spawnSync(command, args, { cwd: path.join(__dirname, '..'), env, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Backend test command failed (${result.status ?? result.signal ?? 'spawn error'}).`);
}

const DATABASE_TEST_FILES = [
  'tests/artistAccess.test.js',
  'tests/catalogSearch.test.js',
  'tests/creatorRegistration.test.js',
  'tests/endpoints.test.js',
  'tests/seedStrategy.test.js',
  'tests/statsQA.test.js',
];

async function main() {
  // No dotenv or arbitrary URL: the outer harness provides generated identity
  // and its fresh PostgreSQL marker, checked before any CREATE/DROP operation.
  const scope = assertDatabaseScope(process.env, process.env.DATABASE_URL_TEST, 'backend');
  assertDatabaseScope(process.env, process.env.DATABASE_URL, 'api');
  const { Client } = require('pg');
  const client = new Client({ connectionString: scope.adminUrl });
  await client.connect();
  try {
    const prismaBin = path.join(__dirname, '..', 'node_modules', '.bin', 'prisma');
    const vitestBin = path.join(__dirname, '..', 'node_modules', '.bin', 'vitest');
    const allTestFiles = readdirSync(__dirname).filter(file => file.endsWith('.test.js')).map(file => `tests/${file}`).sort();
    const unitTestFiles = allTestFiles.filter(file => !DATABASE_TEST_FILES.includes(file));
    run(prismaBin, ['generate'], process.env);
    const groups = [unitTestFiles, ...DATABASE_TEST_FILES.map(file => [file])];
    for (const [index, files] of groups.entries()) {
      const purpose = index === 0 ? 'backend_unit' : `backend_${index}`;
      const url = databaseUrl(process.env, purpose);
      const owned = await createOwnedDatabase(client, assertDatabaseScope(process.env, url, purpose));
      console.log(`Created owned disposable backend database: ${owned.name}`);
      try {
        const env = { ...process.env, DATABASE_URL: url, DATABASE_URL_TEST: url };
        // Fresh databases make a destructive reset unnecessary.
        run(prismaBin, ['migrate', 'deploy'], env);
        run(process.execPath, ['prisma/seed.js', 'demo'], env);
        run(vitestBin, ['run', ...files], env);
      } finally {
        await dropOwnedDatabase(client, owned);
        console.log(`Removed owned disposable backend database: ${owned.name}`);
      }
    }
  } finally { await client.end(); }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
