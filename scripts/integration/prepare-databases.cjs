// Called only after the parent has created and inspected its fresh container.
const { Client } = require('../../backend/node_modules/pg');
const { assertDatabaseScope, databaseUrl, createOwnedDatabase } = require('./database-guard.cjs');

async function main() {
  const env = process.env;
  const scope = assertDatabaseScope(env, env.DATABASE_URL, 'api');
  const client = new Client({ connectionString: scope.adminUrl });
  await client.connect();
  try {
    // No IF NOT EXISTS: reusing any pre-existing harness is forbidden.
    await client.query('CREATE TABLE public.noirsound_test_harness (proof text NOT NULL)');
    await client.query('INSERT INTO public.noirsound_test_harness (proof) VALUES ($1)', [scope.proof]);
    for (const purpose of ['api', 'shadow']) {
      await createOwnedDatabase(client, assertDatabaseScope(env, databaseUrl(env, purpose), purpose));
    }
    console.log('Created fresh API/shadow databases with disposable server proof.');
  } finally { await client.end(); }
}

main().catch(() => { console.error('Disposable database preparation failed; no existing database was adopted.'); process.exitCode = 1; });
