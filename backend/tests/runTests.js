const path = require('path');
const { spawnSync } = require('child_process');
const { Client } = require('pg');
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
  run(prismaBin, ['migrate', 'reset', '--force'], env);
  run(process.execPath, ['prisma/seed.js', 'demo'], env);
  run(vitestBin, ['run'], env);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
