import test from 'node:test';
import assert from 'node:assert/strict';
import { assertTestEnvironment, redactIntegrationOutput, summarizeE2E, summarizeClosedE2E } from '../run-integration.mjs';
import { spawnSync } from 'node:child_process';
import databaseGuard from './database-guard.cjs';

const { assertDatabaseScope, assertDisposablePostgres, createOwnedDatabase, dropOwnedDatabase } = databaseGuard;
const password = 'a'.repeat(48);
const dbUrl = purpose => `postgresql://noirsound_verify:${password}@127.0.0.1:54321/noirsound_012345abcdef_${purpose}_test?schema=public`;

const environment = () => ({
  NODE_ENV: 'test', COMPOSE_PROJECT_NAME: 'noirsound-verify-012345abcdef', NS_TEST_DB_PORT: '54321',
  NS_TEST_RUN_ID: '012345abcdef', NS_TEST_DISPOSABLE: 'true', NS_TEST_DATABASE_PROOF: 'b'.repeat(48), NS_TEST_DB_PASSWORD: password,
  DATABASE_URL: dbUrl('api'), DATABASE_URL_TEST: dbUrl('backend'), SHADOW_DATABASE_URL: dbUrl('shadow'),
  REDIS_URL: 'redis://127.0.0.1:54322', S3_ENDPOINT: 'http://127.0.0.1:54323', S3_PUBLIC_ENDPOINT: 'http://127.0.0.1:54323',
  VITE_API_BASE_URL: 'http://127.0.0.1:54324/api', E2E_BASE_URL: 'http://127.0.0.1:54325', VITE_USE_MOCK_API: 'false',
});
const report = () => ({ suites: [{ specs: [
  ...Array.from({ length: 70 }, (_, index) => ({ file: 'real.spec.js', title: `real ${index}`, tests: [{ projectName: 'chromium', expectedStatus: 'passed', status: 'expected', results: [{ status: 'passed' }] }] })),
  ...Array.from({ length: 8 }, (_, index) => ({ file: 'ui-interactions.spec.js', title: `HTTP ${index}`, tests: [{ projectName: 'chromium', expectedStatus: 'passed', status: 'expected', results: [{ status: 'passed' }] }] })),
  ...Array.from({ length: 8 }, (_, index) => ({ file: 'demo.spec.js', title: `demo ${index}`, tests: [{ projectName: 'chromium-demo', expectedStatus: 'passed', status: 'expected', results: [{ status: 'passed' }] }] })),
] }] });

test('accepts only the generated isolated service scope', () => assert.doesNotThrow(() => assertTestEnvironment(environment())));
for (const [key, value] of [
  ['NODE_ENV', 'production'], ['COMPOSE_PROJECT_NAME', 'noirsound-production'],
  ['DATABASE_URL_TEST', 'postgresql://test@127.0.0.1:54321/noirsound'],
  ['DATABASE_URL', 'postgresql://test@db.example.invalid:54321/noirsound_api_test'],
  ['S3_PUBLIC_ENDPOINT', 'https://storage.example.invalid'], ['VITE_USE_MOCK_API', 'true'],
  ['NODE_ENV', 'development'], ['NODE_ENV', ''], ['NS_TEST_RUN_ID', '112345abcdef'],
  ['NS_TEST_DISPOSABLE', 'false'], ['NS_TEST_DATABASE_PROOF', ''], ['NS_TEST_DB_PORT', '5432'],
  ['DATABASE_URL', dbUrl('api').replace('127.0.0.1', 'localhost')],
  ['DATABASE_URL', dbUrl('api').replace('127.0.0.1', '46.202.143.125')],
  ['DATABASE_URL', dbUrl('api').replace('012345abcdef', 'fedcba543210')],
  ['DATABASE_URL', `${dbUrl('api')}&host=production.internal`],
  ['DATABASE_URL', `${dbUrl('api')}&schema=other`],
  ['DATABASE_URL', dbUrl('api').replace('/noirsound_', '/%6eoirsound_')],
  ['DATABASE_URL_TEST', dbUrl('api')],
]) test(`rejects an unsafe ${key}`, () => assert.throws(() => assertTestEnvironment({ ...environment(), [key]: value })));

const inspection = () => ({ labels: { 'com.docker.compose.project': environment().COMPOSE_PROJECT_NAME, 'com.docker.compose.service': 'postgres' }, tmpfs: { '/var/lib/postgresql/data': '' }, ports: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '54321' }] } });
test('requires matching disposable container labels, tmpfs and exact loopback port', () => {
  assert.doesNotThrow(() => assertDisposablePostgres(environment(), inspection()));
  for (const change of [
    value => { value.labels['com.docker.compose.project'] = 'noirsound'; },
    value => { value.tmpfs = {}; },
    value => { value.ports['5432/tcp'][0].HostIp = '0.0.0.0'; },
    value => { value.ports['5432/tcp'][0].HostPort = '5432'; },
  ]) { const value = inspection(); change(value); assert.throws(() => assertDisposablePostgres(environment(), value)); }
});
function fakeDatabase({ exists = false, serverProof, databaseProof } = {}) {
  const scope = assertDatabaseScope(environment(), dbUrl('backend'), 'backend');
  const statements = [];
  return { scope, statements, client: { async query(sql) {
    statements.push(sql);
    if (sql.includes('public.noirsound_test_harness')) return { rows: [{ proof: serverProof ?? scope.proof }] };
    if (sql.startsWith('SELECT 1')) return { rowCount: exists ? 1 : 0, rows: [] };
    if (sql.startsWith('SELECT shobj_description')) return { rows: [{ proof: databaseProof ?? scope.proof }] };
    return { rowCount: 0, rows: [] };
  } } };
}
test('creates only after server proof and absence, then cleans up only its owned database', async () => {
  const db = fakeDatabase();
  const owned = await createOwnedDatabase(db.client, db.scope);
  await dropOwnedDatabase(db.client, owned);
  assert.equal(db.statements.filter(sql => sql.startsWith('CREATE DATABASE')).length, 1);
  assert.equal(db.statements.filter(sql => sql.startsWith('DROP DATABASE')).length, 1);
  await assert.rejects(dropOwnedDatabase(db.client, owned), /ownership not proven/);
});
test('refuses a pre-existing test database without reset, creation or cleanup', async () => {
  const db = fakeDatabase({ exists: true });
  await assert.rejects(createOwnedDatabase(db.client, db.scope), /pre-existing/);
  assert.equal(db.statements.some(sql => /^(CREATE|DROP|COMMENT)/.test(sql)), false);
});
test('refuses a server that lacks this run proof before any database mutation', async () => {
  const db = fakeDatabase({ serverProof: 'unrelated-run' });
  await assert.rejects(createOwnedDatabase(db.client, db.scope), /proof mismatch/);
  assert.equal(db.statements.length, 1);
});
test('refuses cleanup when database identity changed or ownership was forged', async () => {
  const db = fakeDatabase({ databaseProof: 'replaced-database' });
  const owned = await createOwnedDatabase(db.client, db.scope);
  await assert.rejects(dropOwnedDatabase(db.client, owned), /ownership changed/);
  await assert.rejects(dropOwnedDatabase(db.client, { ...owned }), /ownership not proven/);
  assert.equal(db.statements.some(sql => sql.startsWith('DROP DATABASE')), false);
});
test('backend direct invocation rejects arbitrary DATABASE_URL_TEST before connecting', () => {
  const result = spawnSync(process.execPath, ['backend/tests/runTests.js'], { cwd: new URL('../../', import.meta.url), env: { PATH: process.env.PATH, NODE_ENV: 'test', DATABASE_URL_TEST: 'postgresql://user@127.0.0.1:5432/production_test' }, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Generated disposable test identity required/);
  assert.doesNotMatch(result.stderr, /postgresql:\/\//);
});
test('classifies all 86 cases without conflating fixtures and real services', () => assert.deepEqual(summarizeE2E(report()), { real: 70, httpFixture: 8, demo: 8, passed: 86, failed: 0, skipped: 0, interrupted: 0, notRun: 0 }));
test('closed-mode coverage requires exactly 8 real-service cases and no retry or skip', () => {
  const closed = { suites: [{ specs: Array.from({ length: 8 }, (_, index) => ({ file: 'landing-closed.spec.js', title: `closed ${index}`, tests: [{ projectName: 'chromium-closed', expectedStatus: 'passed', status: 'expected', results: [{ status: 'passed' }] }] })) }] };
  assert.equal(summarizeClosedE2E(closed).passed, 8);
  const retry = structuredClone(closed); retry.suites[0].specs[0].tests[0].results.push({ status: 'passed' }); assert.throws(() => summarizeClosedE2E(retry));
  const skipped = structuredClone(closed); skipped.suites[0].specs[0].tests[0].expectedStatus = 'skipped'; assert.throws(() => summarizeClosedE2E(skipped));
  closed.suites[0].specs.pop(); assert.throws(() => summarizeClosedE2E(closed));
});
for (const status of ['skipped', 'failed', 'interrupted']) test(`rejects an E2E ${status} result`, () => {
  const value = report(); value.suites[0].specs[0].tests[0].results[0].status = status;
  assert.throws(() => summarizeE2E(value));
});
test('rejects missing coverage and retries instead of counting them as unique successes', () => {
  const missing = report(); missing.suites[0].specs.pop(); assert.throws(() => summarizeE2E(missing));
  const retry = report(); retry.suites[0].specs[0].tests[0].results.push({ status: 'passed' }); assert.throws(() => summarizeE2E(retry));
});
test('redacts complete database URLs and generated credentials', () => {
  assert.equal(redactIntegrationOutput('connect postgresql://user:secret@127.0.0.1:5432/db?schema=public\nkey=generated-value', ['generated-value']), 'connect [redacted-database-url]\nkey=[test-secret]');
});
test('redacts signed storage URLs rather than leaking their credential query', () => {
  assert.equal(redactIntegrationOutput('PUT http://127.0.0.1/object?X-Amz-Algorithm=v4&X-Amz-Credential=value'), 'PUT [redacted-signed-url]');
});
test('redacts cookie and authorization lines', () => {
  assert.equal(redactIntegrationOutput('Set-Cookie: session=value; HttpOnly\nAuthorization: Bearer value\nstatus: 200'), 'Set-Cookie: [redacted]\nAuthorization: [redacted]\nstatus: 200');
});
