const PURPOSE = /^(api|shadow|performance|backend|backend_unit|backend_[0-9]+)$/;
const validatedScopes = new WeakSet();
const createdDatabases = new WeakSet();

function assertDatabaseScope(env, connectionString, purpose) {
  const runId = env.NS_TEST_RUN_ID;
  if (env.NODE_ENV !== 'test' || env.NS_TEST_DISPOSABLE !== 'true'
      || !/^[a-f0-9]{12}$/.test(runId || '')
      || env.COMPOSE_PROJECT_NAME !== `noirsound-verify-${runId}`
      || !/^[a-f0-9]{48}$/.test(env.NS_TEST_DATABASE_PROOF || '')
      || !PURPOSE.test(purpose)) throw new Error('Generated disposable test identity required.');
  const port = Number(env.NS_TEST_DB_PORT);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid disposable PostgreSQL port.');
  let url;
  try { url = new URL(connectionString); } catch { throw new Error('Invalid disposable database URL.'); }
  const name = `noirsound_${runId}_${purpose}_test`;
  if (url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1' || url.port !== String(port)
      || url.username !== 'noirsound_verify' || url.password !== env.NS_TEST_DB_PASSWORD
      || !/^[a-f0-9]{48}$/.test(env.NS_TEST_DB_PASSWORD || '') || url.pathname !== `/${name}`
      || url.hash || [...url.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public')
      || url.searchParams.getAll('schema').length > 1) throw new Error('Disposable database scope rejected.');
  const admin = new URL(url);
  admin.pathname = '/postgres';
  admin.search = '';
  const scope = Object.freeze({ name, url: url.toString(), adminUrl: admin.toString(), proof: `${env.COMPOSE_PROJECT_NAME}:${env.NS_TEST_DATABASE_PROOF}` });
  validatedScopes.add(scope);
  return scope;
}

function databaseUrl(env, purpose) {
  const url = `postgresql://noirsound_verify:${env.NS_TEST_DB_PASSWORD}@127.0.0.1:${env.NS_TEST_DB_PORT}/noirsound_${env.NS_TEST_RUN_ID}_${purpose}_test?schema=public`;
  assertDatabaseScope(env, url, purpose);
  return url;
}

function assertDisposablePostgres(env, inspection) {
  assertDatabaseScope(env, env.DATABASE_URL, 'api');
  const labels = inspection.labels || {};
  const ports = inspection.ports?.['5432/tcp'];
  if (labels['com.docker.compose.project'] !== env.COMPOSE_PROJECT_NAME
      || labels['com.docker.compose.service'] !== 'postgres'
      || !Object.hasOwn(inspection.tmpfs || {}, '/var/lib/postgresql/data')
      || !Array.isArray(ports) || ports.length !== 1
      || ports[0].HostIp !== '127.0.0.1' || ports[0].HostPort !== env.NS_TEST_DB_PORT) {
    throw new Error('PostgreSQL container ownership/isolation not proven.');
  }
}

async function assertServerProof(client, scope) {
  const result = await client.query('SELECT proof FROM public.noirsound_test_harness');
  if (result.rows.length !== 1 || result.rows[0].proof !== scope.proof) throw new Error('Disposable PostgreSQL server proof mismatch.');
}

async function createOwnedDatabase(client, scope) {
  if (!validatedScopes.has(scope)) throw new Error('Validated database scope required.');
  await assertServerProof(client, scope);
  const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [scope.name]);
  if (existing.rowCount !== 0) throw new Error('Refusing pre-existing test database.');
  // The identifier and comment contain only validated generated characters.
  await client.query(`CREATE DATABASE "${scope.name}"`);
  await client.query(`COMMENT ON DATABASE "${scope.name}" IS '${scope.proof}'`);
  const owned = Object.freeze({ ...scope, created: true });
  createdDatabases.add(owned);
  return owned;
}

async function dropOwnedDatabase(client, owned) {
  if (!createdDatabases.has(owned)) throw new Error('Database creation ownership not proven.');
  await assertServerProof(client, owned);
  const result = await client.query("SELECT shobj_description(oid, 'pg_database') AS proof FROM pg_database WHERE datname = $1", [owned.name]);
  if (result.rows.length !== 1 || result.rows[0].proof !== owned.proof) throw new Error('Refusing cleanup: database ownership changed.');
  await client.query(`DROP DATABASE "${owned.name}" WITH (FORCE)`);
  createdDatabases.delete(owned);
}

module.exports = { assertDatabaseScope, assertDisposablePostgres, databaseUrl, assertServerProof, createOwnedDatabase, dropOwnedDatabase };
