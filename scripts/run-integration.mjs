#!/usr/bin/env node
// Portable local/CI verification. No environment file or existing service is used.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import databaseGuard from './integration/database-guard.cjs';

const { assertDatabaseScope, assertDisposablePostgres } = databaseGuard;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backend = resolve(root, 'backend');
const composeFile = resolve(root, 'tests/integration/compose.yml');
const reportDir = resolve(root, 'test-results/integration');
const runtimeKeys = ['PATH', 'HOME', 'USER', 'LOGNAME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot', 'COMSPEC', 'PATHEXT', 'CI', 'PLAYWRIGHT_BROWSERS_PATH', 'npm_config_cache', 'NPM_CONFIG_CACHE'];

export function assertTestEnvironment(env) {
  for (const [key, purpose] of [['DATABASE_URL', 'api'], ['DATABASE_URL_TEST', 'backend'], ['SHADOW_DATABASE_URL', 'shadow']]) {
    assertDatabaseScope(env, env[key], purpose);
  }
  for (const key of ['S3_ENDPOINT', 'S3_PUBLIC_ENDPOINT', 'VITE_API_BASE_URL', 'E2E_BASE_URL']) {
    const value = new URL(env[key]);
    if (value.protocol !== 'http:' || value.hostname !== '127.0.0.1') throw new Error(`Loopback service guard rejected ${key}.`);
  }
  if (new URL(env.REDIS_URL).hostname !== '127.0.0.1' || env.VITE_USE_MOCK_API !== 'false') throw new Error('Real test services are required.');
}

export function summarizeE2E(report) {
  const counts = { real: 0, httpFixture: 0, demo: 0 };
  const visit = suite => {
    for (const spec of suite.specs || []) for (const test of spec.tests || []) {
      if (test.expectedStatus !== 'passed' || test.status !== 'expected' || test.results?.length !== 1 || test.results[0].status !== 'passed') {
        throw new Error(`E2E release gate did not pass exactly once: ${spec.file}: ${spec.title}`);
      }
      if (test.projectName === 'chromium-demo') counts.demo += 1;
      else if (test.projectName === 'chromium' && spec.file === 'ui-interactions.spec.js') counts.httpFixture += 1;
      else if (['chromium', 'chromium-mobile-catalog'].includes(test.projectName)) counts.real += 1;
      else throw new Error('Unclassified E2E project.');
    }
    for (const child of suite.suites || []) visit(child);
  };
  if (report.errors?.length) throw new Error('Playwright reported a global error.');
  for (const suite of report.suites || []) visit(suite);
  // Landing adds four real catalog/player/navigation cases and two real creator
  // upload/auth cases. Fixture-only checks remain classified separately.
  if (counts.real !== 70 || counts.httpFixture !== 8 || counts.demo !== 8) throw new Error(`E2E coverage changed: ${JSON.stringify(counts)}; review the expected 70 real / 8 HTTP / 8 demo cases explicitly.`);
  return { ...counts, passed: 86, failed: 0, skipped: 0, interrupted: 0, notRun: 0 };
}

export function summarizeClosedE2E(report) {
  let passed = 0;
  const visit = suite => {
    for (const spec of suite.specs || []) for (const test of spec.tests || []) {
      if (spec.file !== 'landing-closed.spec.js' || test.projectName !== 'chromium-closed'
          || test.expectedStatus !== 'passed' || test.status !== 'expected'
          || test.results?.length !== 1 || test.results[0].status !== 'passed') {
        throw new Error('Closed-mode real-service E2E must pass each expected case exactly once.');
      }
      passed += 1;
    }
    for (const child of suite.suites || []) visit(child);
  };
  if (report.errors?.length) throw new Error('Closed-mode E2E reported a global error.');
  for (const suite of report.suites || []) visit(suite);
  if (passed !== 8) throw new Error(`Closed-mode E2E coverage changed: ${passed}; expected 8 real-service cases.`);
  return { real: passed, passed, failed: 0, skipped: 0, retried: 0, interrupted: 0, notRun: 0 };
}

export function redactIntegrationOutput(value, secrets = []) {
  return secrets.filter(Boolean).reduce((text, secret) => text.replaceAll(secret, '[test-secret]'), String(value))
    .replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, '[redacted-database-url]')
    .replace(/https?:\/\/[^\s"'<>]*[?&](?:X-Amz-[^=\s]+|token|signature)=[^\s"'<>]*/gi, '[redacted-signed-url]')
    .replace(/((?:set-cookie|cookie|authorization)["']?\s*[:=]\s*)[^\r\n]+/gi, '$1[redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted-token]');
}

async function allocatePorts(count) {
  const servers = [];
  try {
    for (let index = 0; index < count; index += 1) {
      const server = createServer();
      await new Promise((resolvePort, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolvePort); });
      servers.push(server);
    }
    return servers.map(server => server.address().port);
  } finally {
    await Promise.all(servers.map(server => new Promise(done => server.close(done))));
  }
}

async function main(mode) {
  if (!['all', 'backend', 'security', 'e2e', 'closed', 'performance', 'preview'].includes(mode)) throw new Error('Usage: node scripts/run-integration.mjs all|backend|security|e2e|closed|performance|preview (after npm ci in root and backend).');
  if (process.env.NODE_ENV === 'production') throw new Error('Do not invoke test verification from a production environment.');
  for (const key of ['DATABASE_URL', 'DATABASE_URL_TEST', 'SHADOW_DATABASE_URL', 'COMPOSE_PROJECT_NAME', 'NS_TEST_RUN_ID', 'NS_TEST_DATABASE_PROOF']) {
    if (process.env[key] !== undefined) throw new Error(`Remove inherited ${key}; the harness creates its own disposable identity.`);
  }
  for (const directory of [root, backend]) {
    const privateEnv = readdirSync(directory).find(name => /^\.env(?:\.|$)/.test(name) && !['.env.example', '.env.production.example'].includes(name));
    if (privateEnv) throw new Error(`Use a clean verification checkout without ${directory === root ? '' : 'backend/'}${privateEnv}.`);
  }
  if (!existsSync(resolve(backend, 'node_modules/.bin/prisma'))) throw new Error('Run npm ci in backend before verification.');
  if (['all', 'e2e', 'closed'].includes(mode) && !existsSync(resolve(root, 'node_modules/.bin/playwright'))) throw new Error('Run npm ci in the repository root before verification.');
  if (mode === 'preview' && !existsSync(resolve(root, 'node_modules/.bin/vite'))) throw new Error('Run npm ci in the repository root before local preview.');
  const scratch = mkdtempSync(resolve(tmpdir(), 'noirsound-integration-'));
  mkdirSync(reportDir, { recursive: true });
  const [dbPort, redisPort, storagePort, apiPort, webPort, mockPort] = await allocatePorts(6);
  const token = () => randomBytes(24).toString('hex');
  const baseEnv = Object.fromEntries(runtimeKeys.filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
  const dbUser = 'noirsound_verify';
  const dbPassword = token();
  const runId = randomBytes(6).toString('hex');
  const database = purpose => `postgresql://${dbUser}:${dbPassword}@127.0.0.1:${dbPort}/noirsound_${runId}_${purpose}_test?schema=public`;
  const env = {
    ...baseEnv, NODE_ENV: 'test', COMPOSE_PROJECT_NAME: `noirsound-verify-${runId}`,
    NS_TEST_RUN_ID: runId, NS_TEST_DISPOSABLE: 'true', NS_TEST_DATABASE_PROOF: token(),
    NS_TEST_DB_USER: dbUser, NS_TEST_DB_PASSWORD: dbPassword, NS_TEST_DB_PORT: String(dbPort),
    NS_TEST_REDIS_PORT: String(redisPort), NS_TEST_STORAGE_PORT: String(storagePort),
    NS_TEST_S3_USER: `verify${randomBytes(6).toString('hex')}`, NS_TEST_S3_PASSWORD: token(),
    DATABASE_URL: database('api'), DATABASE_URL_TEST: database('backend'), SHADOW_DATABASE_URL: database('shadow'),
    REDIS_URL: `redis://127.0.0.1:${redisPort}`, S3_ENDPOINT: `http://127.0.0.1:${storagePort}`, S3_PUBLIC_ENDPOINT: `http://127.0.0.1:${storagePort}`,
    S3_BUCKET: 'noirsound-integration-test', S3_REGION: 'us-east-1', S3_FORCE_PATH_STYLE: 'true',
    JWT_SECRET: token(), COOKIE_SECRET: token(), PORT: String(apiPort),
    FRONTEND_ORIGIN: `http://127.0.0.1:${webPort},http://localhost:${webPort}`,
    VITE_API_BASE_URL: `http://127.0.0.1:${apiPort}/api`, VITE_USE_MOCK_API: 'false',
    E2E_PORT: String(webPort), E2E_BASE_URL: `http://127.0.0.1:${webPort}`,
    APP_SHELL_ORIGIN: `http://127.0.0.1:${webPort}`,
    E2E_MOCK_PORT: String(mockPort), E2E_MOCK_BASE_URL: `http://127.0.0.1:${mockPort}`,
    RATE_LIMIT_MULTIPLIER: '20', E2E_REQUIRE_REAL_SERVICES: 'true', E2E_REUSE_SERVER: 'false',
    PUBLIC_APP_ENABLED: 'true', VITE_PUBLIC_APP_ENABLED: 'true',
    PLAYWRIGHT_JSON_OUTPUT_NAME: resolve(scratch, 'playwright.json'), PLAYWRIGHT_HTML_OPEN: 'never',
  };
  env.S3_ACCESS_KEY_ID = env.NS_TEST_S3_USER;
  env.S3_SECRET_ACCESS_KEY = env.NS_TEST_S3_PASSWORD;
  assertTestEnvironment(env);
  const secrets = [dbPassword, env.NS_TEST_DATABASE_PROOF, env.NS_TEST_S3_USER, env.NS_TEST_S3_PASSWORD, env.JWT_SECRET, env.COOKIE_SECRET];
  const redact = chunk => redactIntegrationOutput(chunk, secrets);
  const children = new Set();
  const composeArgs = ['compose', '--project-name', env.COMPOSE_PROJECT_NAME, '--file', composeFile];
  let composeStarted = false;
  let stopping = false;
  let exitSignal = null;

  function command(commandName, args, { cwd = root, environment = env, background = false, label = commandName, quiet = false, capture = false } = {}) {
    const log = createWriteStream(resolve(scratch, `${label.replace(/[^a-z0-9-]/gi, '-')}.log`), { flags: 'a', mode: 0o600 });
    const child = spawn(commandName, args, { cwd, env: environment, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    children.add(child);
    let captured = '';
    if (capture) child.stdout.on('data', chunk => { captured += chunk.toString(); });
    for (const stream of [child.stdout, child.stderr]) {
      let buffered = '';
      const write = value => { const safe = redact(value); log.write(safe); if (!background && !quiet) process.stdout.write(safe); };
      stream.setEncoding('utf8');
      stream.on('data', chunk => {
        buffered += chunk;
        const lastNewline = buffered.lastIndexOf('\n');
        if (lastNewline >= 0) { write(buffered.slice(0, lastNewline + 1)); buffered = buffered.slice(lastNewline + 1); }
      });
      stream.on('end', () => { if (buffered) write(buffered); });
    }
    const completion = new Promise((done, reject) => {
      child.once('error', error => { children.delete(child); log.end(); reject(error); });
      child.once('close', (code, signal) => {
        children.delete(child); log.end();
        if (code === 0 || child.expectedStop || (stopping && background)) done(capture ? captured : undefined);
        else reject(new Error(`${label} failed (${signal || code}); redacted log: ${scratch}/${label.replace(/[^a-z0-9-]/gi, '-')}.log`));
      });
    });
    if (background) completion.catch(error => { child.failure = error; });
    return background ? child : completion;
  }
  async function waitUntil(url, processes = []) {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      const failed = processes.find(child => child.failure || child.exitCode !== null);
      if (failed) throw failed.failure || new Error('A required test service exited.');
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
        if (response.ok) return;
      } catch { /* bounded readiness polling */ }
      await new Promise(done => setTimeout(done, 1000));
    }
    throw new Error('Timed out waiting for isolated test service readiness.');
  }
  async function stopTestProcess(child) {
    child.expectedStop = true;
    await new Promise((done, reject) => {
      const timer = setTimeout(() => {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already exited */ }
        reject(new Error('Test API did not stop within 10 seconds.'));
      }, 10000);
      child.once('close', () => { clearTimeout(timer); done(); });
      try { process.kill(-child.pid, 'SIGTERM'); } catch (error) { clearTimeout(timer); reject(error); }
    });
  }
  const signalHandler = signal => {
    exitSignal = signal;
    for (const child of children) { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already exited */ } }
  };
  process.once('SIGINT', signalHandler); process.once('SIGTERM', signalHandler);
  const evidence = { mode, project: env.COMPOSE_PROJECT_NAME, runId, databaseSetup: 'fresh databases + migrate deploy; no reset', startedAt: new Date().toISOString(), status: 'running' };
  console.log(`Integration verification: ${mode}; isolated project ${env.COMPOSE_PROJECT_NAME}.`);
  try {
    await command(process.execPath, ['--test', 'scripts/integration/harness.test.mjs'], { label: 'harness-tests' });
    await command('ffmpeg', ['-version'], { quiet: true, label: 'ffmpeg' });
    await command('ffprobe', ['-version'], { quiet: true, label: 'ffprobe' });
    await command('docker', [...composeArgs, 'config', '--quiet'], { label: 'compose-validation' });
    const existing = await command('docker', ['ps', '--all', '--filter', `label=com.docker.compose.project=${env.COMPOSE_PROJECT_NAME}`, '--format', '{{.ID}}'], { label: 'project-absence', quiet: true, capture: true });
    if (existing.trim()) throw new Error('Refusing pre-existing verification project.');
    composeStarted = true;
    await command('docker', [...composeArgs, 'up', '--detach', '--wait', '--wait-timeout', '120'], { label: 'compose-start' });
    const postgresId = (await command('docker', [...composeArgs, 'ps', '--quiet', 'postgres'], { label: 'postgres-id', quiet: true, capture: true })).trim();
    if (!/^[a-f0-9]{64}$/.test(postgresId)) throw new Error('Fresh PostgreSQL container not identified.');
    const postgres = await command('docker', ['inspect', '--format', '{"labels":{{json .Config.Labels}},"tmpfs":{{json .HostConfig.Tmpfs}},"ports":{{json .HostConfig.PortBindings}}}', postgresId], { label: 'postgres-isolation', quiet: true, capture: true });
    assertDisposablePostgres(env, JSON.parse(postgres));
    evidence.postgresContainer = postgresId;
    evidence.postgresIsolation = 'new project; matching labels; tmpfs; generated loopback port';
    await command(process.execPath, ['scripts/integration/prepare-databases.cjs'], { label: 'database-prepare' });
    await waitUntil(`${env.S3_ENDPOINT}/minio/health/ready`);
    await command(process.execPath, ['scripts/integration/prepare-storage.cjs'], { label: 'storage-prepare' });
    if (mode === 'all') {
      for (const task of ['lint', 'test', 'build', 'check:forbidden']) await command('npm', ['run', task], { label: `frontend-${task}`, environment: { ...env, NODE_ENV: task === 'build' ? 'production' : 'test' } });
      await command('npm', ['run', 'build'], { label: 'frontend-build-closed', environment: { ...env, NODE_ENV: 'production', VITE_PUBLIC_APP_ENABLED: 'false' } });
      await command('git', ['diff', '--check'], { label: 'diff-check' });
    }
    await command('npx', ['--no-install', 'prisma', 'generate'], { cwd: backend, label: 'prisma-generate' });
    await command('npx', ['--no-install', 'prisma', 'validate'], { cwd: backend, label: 'prisma-validate' });
    if (['all', 'backend'].includes(mode)) await command('npm', ['run', 'test'], { cwd: backend, environment: { ...env, NODE_ENV: 'test' }, label: 'backend-tests' });
    if (['all', 'security'].includes(mode)) {
      await command('npx', ['--no-install', 'prisma', 'migrate', 'diff', '--from-migrations', 'prisma/migrations', '--to-schema', 'prisma/schema.prisma', '--exit-code'], { cwd: backend, label: 'migration-schema-diff' });
      if (mode === 'security') await command('npm', ['run', 'test:unit'], { cwd: backend, environment: { ...env, NODE_ENV: 'test' }, label: 'backend-security-tests' });
    }
    if (mode === 'performance') await command(process.execPath, ['scripts/measure-catalog-test.js'], { cwd: backend, label: 'catalog-performance' });
    if (['all', 'e2e', 'closed', 'preview'].includes(mode)) {
      await command('npx', ['--no-install', 'prisma', 'migrate', 'deploy'], { cwd: backend, label: 'api-migrate' });
      await command(process.execPath, ['prisma/seed.js', 'minimal'], { cwd: backend, label: 'api-seed' });
      let api = command(process.execPath, ['scripts/integration/start-api.cjs'], { background: true, label: 'api' });
      const worker = command(process.execPath, ['src/workers/audioProcessor.js'], { cwd: backend, background: true, label: 'worker' });
      await waitUntil(`${env.VITE_API_BASE_URL}/ready`, [api, worker]);
      if (mode === 'preview') {
        const web = command('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'], { background: true, label: 'preview-web' });
        await waitUntil(env.E2E_BASE_URL, [api, worker, web]);
        evidence.status = 'ready';
        evidence.preview = { url: env.E2E_BASE_URL, apiUrl: env.VITE_API_BASE_URL, pid: process.pid, apiMode: 'real', data: 'Fresh isolated test database with minimal test accounts and no demo releases; data lasts until this preview stops.' };
        writeFileSync(resolve(reportDir, 'preview-summary.json'), `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
        console.log(`Local real-service preview ready: ${env.E2E_BASE_URL}`);
        console.log('Uses a fresh isolated database, real API, storage, and processing worker. No demo releases. Stop with Ctrl+C; preview data is temporary.');
        await new Promise((done, reject) => {
          const timer = setInterval(() => {
            if (exitSignal) { clearInterval(timer); done(); return; }
            const failed = [api, worker, web].find(child => child.failure || child.exitCode !== null);
            if (failed) { clearInterval(timer); reject(failed.failure || new Error('A required preview service exited.')); }
          }, 500);
        });
      } else if (mode !== 'closed') {
        await command('npm', ['run', 'test:e2e', '--', '--workers=1', '--retries=0', '--trace=off', '--reporter=list,json', `--output=${resolve(scratch, 'playwright-results')}`], { label: 'e2e' });
        if ([api, worker].some(child => child.failure || child.exitCode !== null)) throw new Error('A required API/worker service exited during E2E.');
        evidence.e2e = summarizeE2E(JSON.parse(readFileSync(env.PLAYWRIGHT_JSON_OUTPUT_NAME, 'utf8')));
        console.log(`E2E verified: ${JSON.stringify(evidence.e2e)}`);
      }
      if (['all', 'e2e', 'closed'].includes(mode)) {
        await stopTestProcess(api);
        const closedEnv = { ...env, PUBLIC_APP_ENABLED: 'false', VITE_PUBLIC_APP_ENABLED: 'false', PLAYWRIGHT_JSON_OUTPUT_NAME: resolve(scratch, 'playwright-closed.json') };
        api = command(process.execPath, ['scripts/integration/start-api.cjs'], { environment: closedEnv, background: true, label: 'api-closed' });
        await waitUntil(`${env.VITE_API_BASE_URL}/ready`, [api, worker]);
        await command('npm', ['run', 'test:e2e', '--', '--config=playwright.closed.config.js', '--workers=1', '--retries=0', '--trace=off', '--reporter=list,json', `--output=${resolve(scratch, 'playwright-closed-results')}`], { environment: closedEnv, label: 'e2e-closed' });
        if ([api, worker].some(child => child.failure || child.exitCode !== null)) throw new Error('A required API/worker service exited during closed E2E.');
        evidence.closedE2e = summarizeClosedE2E(JSON.parse(readFileSync(closedEnv.PLAYWRIGHT_JSON_OUTPUT_NAME, 'utf8')));
        console.log(`Closed-mode E2E verified: ${JSON.stringify(evidence.closedE2e)}`);
      }
    }
    if (exitSignal && mode !== 'preview') throw new Error(`Verification interrupted by ${exitSignal}.`);
    evidence.status = mode === 'preview' ? 'stopped' : 'passed';
  } catch (error) {
    evidence.status = 'failed';
    throw error;
  } finally {
    stopping = true;
    for (const child of children) { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already exited */ } }
    await new Promise(done => setTimeout(done, 1000));
    for (const child of children) { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already exited */ } }
    let cleanupError;
    if (composeStarted) {
      try { await command('docker', [...composeArgs, 'down', '--timeout', '10'], { label: 'compose-stop' }); evidence.cleanup = 'passed'; }
      catch (error) { cleanupError = error; evidence.cleanup = 'failed'; evidence.status = 'failed'; }
    }
    evidence.finishedAt = new Date().toISOString();
    writeFileSync(resolve(reportDir, `${mode}-summary.json`), `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
    process.removeListener('SIGINT', signalHandler); process.removeListener('SIGTERM', signalHandler);
    console.log(`Verification ${evidence.status}; summary: test-results/integration/${mode}-summary.json. Redacted local logs: ${scratch}`);
    if (cleanupError) { console.error(cleanupError.message); process.exitCode = 1; }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
}
