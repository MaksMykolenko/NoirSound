const path = require('path');
const { spawnSync } = require('child_process');
const { Client } = require('pg');
const { readdirSync } = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function run(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: path.join(__dirname, '..'),
    env,
    stdio: 'inherit'
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function resetAndSeed(prismaBin, env) {
  run(prismaBin, ['migrate', 'reset', '--force'], env);
  run(process.execPath, ['prisma/seed.js', 'demo'], env);
}

const DATABASE_TEST_FILES = [
  'tests/artistAccess.test.js',
  'tests/catalogSearch.test.js',
  'tests/creatorRegistration.test.js',
  'tests/endpoints.test.js',
  'tests/seedStrategy.test.js',
  'tests/statsQA.test.js',
];

async function ensureTestDatabase(testUrl) {
  const parsed = new URL(testUrl);
  const databaseName = parsed.pathname.slice(1);
  if (!/^[a-zA-Z0-9_]*test[a-zA-Z0-9_]*$/i.test(databaseName)) {
    throw new Error(
      `Refusing to reset database "${databaseName}". DATABASE_URL_TEST must name a test database.`
    );
  }

  const adminUrl = new URL(testUrl);
  adminUrl.pathname = '/postgres';
  adminUrl.search = '';
  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  const existing = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [databaseName]
  );
  if (existing.rowCount === 0) {
    await client.query(`CREATE DATABASE "${databaseName}"`);
  }
  await client.end();
}

async function main() {
  const testUrl = process.env.DATABASE_URL_TEST;
  if (!testUrl) {
    throw new Error('DATABASE_URL_TEST is required for backend tests.');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Backend tests cannot run with NODE_ENV=production.');
  }

  await ensureTestDatabase(testUrl);

  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: testUrl
  };
  const prismaBin = path.join(__dirname, '..', 'node_modules', '.bin', 'prisma');
  const vitestBin = path.join(__dirname, '..', 'node_modules', '.bin', 'vitest');

  run(prismaBin, ['generate'], env);

  const allTestFiles = readdirSync(path.join(__dirname))
    .filter((file) => file.endsWith('.test.js'))
    .map((file) => `tests/${file}`)
    .sort();
  const unitTestFiles = allTestFiles.filter((file) => !DATABASE_TEST_FILES.includes(file));

  // Unit/mocked suites do not touch the shared PostgreSQL fixture and can run
  // together, but the cleanup-script safety contracts still inspect the
  // database in dry-run mode. Establish the schema and fixture before that
  // group so a brand-new CI service database behaves like a warmed local one.
  // Each real integration file then gets its own reset + demo seed so a
  // destructive fixture or leaked role/status can never affect another file.
  resetAndSeed(prismaBin, env);
  run(vitestBin, ['run', ...unitTestFiles], env);
  for (const testFile of DATABASE_TEST_FILES) {
    resetAndSeed(prismaBin, env);
    run(vitestBin, ['run', testFile], env);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
