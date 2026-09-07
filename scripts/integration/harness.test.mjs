import test from 'node:test';
import assert from 'node:assert/strict';
import { assertTestEnvironment, redactIntegrationOutput, summarizeE2E } from '../run-integration.mjs';

const environment = () => ({
  NODE_ENV: 'test', COMPOSE_PROJECT_NAME: 'noirsound-verify-012345abcdef', NS_TEST_DB_PORT: '54321',
  DATABASE_URL: 'postgresql://test@127.0.0.1:54321/noirsound_api_test',
  DATABASE_URL_TEST: 'postgresql://test@127.0.0.1:54321/noirsound_backend_test',
  SHADOW_DATABASE_URL: 'postgresql://test@127.0.0.1:54321/noirsound_shadow_test',
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
]) test(`rejects an unsafe ${key}`, () => assert.throws(() => assertTestEnvironment({ ...environment(), [key]: value })));
test('classifies all 86 cases without conflating fixtures and real services', () => assert.deepEqual(summarizeE2E(report()), { real: 70, httpFixture: 8, demo: 8, passed: 86, failed: 0, skipped: 0, interrupted: 0, notRun: 0 }));
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
