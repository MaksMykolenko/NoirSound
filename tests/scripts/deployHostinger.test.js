// @vitest-environment node
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync, appendFileSync, chmodSync, symlinkSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { gzipSync } from 'node:zlib';

const SHA = '1'.repeat(40);
const BACKUP_REFERENCE = '20260907T17481050d4f8eeZ';
describe('exact release deployment guards (no real infrastructure)', () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'noirsound-deploy-guards-'));
    for (const name of ['app', 'app/scripts', 'bin', 'objects']) mkdirSync(join(dir, name));
    copyFileSync(resolve('scripts/deploy-hostinger.sh'), join(dir, 'app/scripts/deploy-hostinger.sh'));
    writeFileSync(join(dir, 'app/docker-compose.production.yml'), 'services: {}\n');
    writeFileSync(join(dir, 'app/.env.production'), ['DOMAIN', 'FRONTEND_ORIGIN', 'DATABASE_URL', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB', 'REDIS_URL', 'S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'JWT_SECRET', 'COOKIE_SECRET'].map(key => `${key}=configured`).join('\n') + '\n');
    writeFileSync(join(dir, 'postgres.dump.gz'), gzipSync('stub database dump'));
    writeFileSync(join(dir, 'objects/owned.txt'), 'stub storage');
    expect(spawnSync('tar', ['-czf', join(dir, 'storage.tar.gz'), '-C', join(dir, 'objects'), '.']).status).toBe(0);
    const script = (path, body) => writeFileSync(join(dir, path), `#!/usr/bin/env bash\nset -eu\n${body}\n`, { mode: 0o755 });
    script('bin/git', `case "$*" in
      'rev-parse HEAD') printf '%s\\n' "\${TEST_HEAD:-$RELEASE_SHA}" ;;
      'rev-parse --path-format=absolute --git-path noirsound-deploy.lock') printf '%s/lock\\n' "$FIXTURE" ;;
      'status --porcelain --untracked-files=all') if [[ "\${TEST_DIRTY:-}" == 1 ]]; then printf ' M changed.js\\n'; fi ;;
      *) exit 8 ;;
    esac`);
    script('bin/flock', '[[ "${TEST_LOCKED:-}" != 1 ]]');
    script('bin/sha256sum', 'exec shasum -a 256 "$@"');
    script('bin/curl', `while [[ $# -gt 0 ]]; do if [[ "$1" == -o ]]; then shift; output="$1"; fi; shift; done
      printf '{"status":"ready","checks":{"database":"ok","redis":"ok","storage":"ok"}}' > "$output"
      printf '%s' "\${TEST_HTTP_STATUS:-200}"`);
    script('bin/docker', `printf 'docker %s\\n' "$*" >> "$CALL_LOG"
      case "$*" in
        *' ps -q '*) service="\${!#}"; [[ "\${TEST_MISSING_SERVICE:-}" == "$service" ]] || printf 'cid-%s\\n' "$service" ;;
        'inspect -f '*'.Config.Labels'*) printf '%s\\n' "$COMPOSE_PROJECT_NAME" ;;
        'inspect -f '*'.State.Status'*) printf 'running\\n' ;;
        'inspect -f '*'.State.Health'*) printf '%s\\n' "\${TEST_HEALTH:-healthy}" ;;
        'inspect -f '*'.RestartCount'*) printf '0\\n' ;;
        'inspect -f '*'.State.OOMKilled'*) printf 'false\\n' ;;
        'inspect -f '*'.Image'*) if [[ -f "$FIXTURE/updated" ]]; then printf 'sha256:%064d\\n' 2; else printf 'sha256:%064d\\n' 1; fi ;;
        'image inspect -f '*org.opencontainers.image.created*) printf '%s\\n' "$BUILD_DATE" ;;
        'image inspect -f '*org.opencontainers.image.source*) printf '%s\\n' 'https://github.com/MaksMykolenko/NoirSound' ;;
        'image inspect -f '*'.Config.Labels'*) printf '%s\\n' "$RELEASE_SHA" ;;
        'image inspect -f '*'.Id'*) printf 'sha256:%064d\\n' 2 ;;
        *' up -d '*) touch "$FIXTURE/updated" ;;
        *' run --rm --no-deps --pull never backend npx prisma migrate status'*) [[ "\${TEST_PENDING_MIGRATION:-}" != 1 ]] ;;
        *' run --rm --no-deps --pull never backend npx prisma migrate deploy'*) [[ "\${TEST_MIGRATE_FAIL:-}" != 1 ]] ;;
      esac`);
    script('app/scripts/backup-all.sh', `printf 'backup\\n' >> "$CALL_LOG"
      if [[ "\${TEST_BACKUP_FAIL:-}" == 1 ]]; then exit 21; fi
      cp "$FIXTURE/postgres.dump.gz" "$NOIRSOUND_BACKUP_DIR/postgres_${BACKUP_REFERENCE}.dump.gz"
      storage_reference="${BACKUP_REFERENCE}"
      [[ "\${TEST_MISMATCH_STORAGE:-}" != 1 ]] || storage_reference=20260907T17481150d4f8eeZ
      cp "$FIXTURE/storage.tar.gz" "$NOIRSOUND_BACKUP_DIR/storage_$storage_reference.tar.gz"
      printf 'stub manifest\\n' > "$NOIRSOUND_BACKUP_DIR/manifest_${BACKUP_REFERENCE}.txt"
      if [[ "\${TEST_BACKUP_OFFSITE_RECEIPT:-}" == 1 ]]; then
        (cd "$NOIRSOUND_BACKUP_DIR" && sha256sum "postgres_${BACKUP_REFERENCE}.dump.gz" "storage_$storage_reference.tar.gz" "manifest_${BACKUP_REFERENCE}.txt" > "manifest_${BACKUP_REFERENCE}.sha256")
        "$OFFSITE_BACKUP_VERIFY_SCRIPT" "$NOIRSOUND_BACKUP_DIR" "$NOIRSOUND_BACKUP_DIR/manifest_${BACKUP_REFERENCE}.sha256" "$NOIRSOUND_BACKUP_DIR/manifest_${BACKUP_REFERENCE}.offsite.txt"
      fi`);
    script('app/scripts/restore-drill.sh', `printf 'restore\\n' >> "$CALL_LOG"
      [[ -s "$DRILL_POSTGRES_BACKUP" && -s "$DRILL_STORAGE_BACKUP" ]]
      [[ "\${DRILL_MANIFEST##*/}" == 'manifest_${BACKUP_REFERENCE}.txt' ]]
      [[ "\${TEST_DRILL_FAIL:-}" != 1 ]]`);
    script('bin/offsite-verifier', `printf 'offsite\\n' >> "$CALL_LOG"
      if [[ "\${TEST_OFFSITE_FAIL:-}" == 1 ]]; then exit 22; fi
      digest="$(sha256sum "$2" | awk '{print $1}')"
      [[ "\${TEST_BAD_RECEIPT:-}" != 1 ]] || digest=wrong
      printf 'version=1\\nrelease_sha=%s\\nchecksum_sha256=%s\\noffsite_verified=true\\nprivate_storage_verified=true\\nbackup_reference=fixture-reference\\n' "$RELEASE_SHA" "$digest" > "$3"`);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));
  function run(overrides = {}) {
    const log = join(dir, 'calls'); writeFileSync(log, '');
    const result = spawnSync('bash', [join(dir, 'app/scripts/deploy-hostinger.sh')], {
      encoding: 'utf8', timeout: 15000,
      env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`, FIXTURE: dir, CALL_LOG: log, APP_DIR: join(dir, 'app'), RELEASE_SHA: SHA, COMPOSE_PROJECT_NAME: 'verified-existing', OFFSITE_BACKUP_VERIFY_SCRIPT: join(dir, 'bin/offsite-verifier'), READINESS_ATTEMPTS: '1', READINESS_SLEEP_SECONDS: '0', DEPLOY_RECORD_DIR: join(dir, 'records'), ...overrides },
    });
    return { ...result, calls: readFileSync(log, 'utf8') };
  }
  it.each([
    { RELEASE_SHA: 'main' },
    { TEST_HEAD: '2'.repeat(40) },
    { TEST_DIRTY: '1' },
    { TEST_LOCKED: '1' },
    { COMPOSE_PROJECT_NAME: '' },
    { OFFSITE_BACKUP_VERIFY_SCRIPT: '' },
    { TEST_MISSING_SERVICE: 'postgres' },
    { TEST_HEALTH: 'unhealthy' },
  ])('refuses unsafe identity/configuration before backup or build (%j)', overrides => {
    const result = run(overrides);
    expect(result.status, result.stderr).not.toBe(0);
    expect(result.calls).not.toMatch(/^backup$| build | up -d |migrate deploy/m);
  });
  it.each(['TEST_BACKUP_FAIL', 'TEST_DRILL_FAIL', 'TEST_OFFSITE_FAIL', 'TEST_BAD_RECEIPT'])('refuses %s before building or migrating', key => {
    const result = run({ [key]: '1' });
    expect(result.status, result.stderr).not.toBe(0);
    expect(result.calls).not.toMatch(/ build | up -d |migrate deploy/);
  });
  it('refuses a conflicting environment-file project before Docker or backup operations', () => {
    appendFileSync(join(dir, 'app/.env.production'), 'COMPOSE_PROJECT_NAME=another-project\n');
    const result = run();
    expect(result.status, result.stderr).not.toBe(0);
    expect(result.stderr).toContain('conflicting Compose projects');
    expect(result.calls).toBe('');
  });
  it.each([0o775, 0o757])('rejects writable offsite hooks before Docker or backup (%i)', mode => {
    chmodSync(join(dir, 'bin/offsite-verifier'), mode);
    const result = run();
    expect(result.status, result.stderr).not.toBe(0);
    expect(result.stderr).toContain('operator-owned regular executable');
    expect(result.calls).toBe('');
  });
  it('rejects a symlink to an otherwise trusted offsite hook', () => {
    const link = join(dir, 'bin/offsite-link');
    symlinkSync(join(dir, 'bin/offsite-verifier'), link);
    const result = run({ OFFSITE_BACKUP_VERIFY_SCRIPT: link });
    expect(result.status, result.stderr).not.toBe(0);
    expect(result.calls).toBe('');
  });
  it('rejects a mismatched storage run before restore or application changes', () => {
    const result = run({ TEST_MISMATCH_STORAGE: '1' });
    expect(result.status, result.stderr).not.toBe(0);
    expect(result.stderr).toContain('same backup run');
    expect(result.calls).not.toMatch(/^restore$|^offsite$| build | up -d |migrate deploy/m);
  });
  it.each(['environment', 'file'])('selects the exact integrity manifest when the %s hook creates an offsite receipt sibling', configuration => {
    const overrides = { TEST_BACKUP_OFFSITE_RECEIPT: '1' };
    if (configuration === 'file') {
      appendFileSync(join(dir, 'app/.env.production'), `OFFSITE_BACKUP_VERIFY_SCRIPT=${join(dir, 'bin/offsite-verifier')}\n`);
      overrides.OFFSITE_BACKUP_VERIFY_SCRIPT = '';
    }
    const result = run(overrides);
    expect(result.status, result.stderr).toBe(0);
    expect(result.calls.match(/^offsite$/gm)).toHaveLength(2);
    const record = join(dir, 'records', readdirSync(join(dir, 'records'))[0]);
    const backup = join(record, 'backup');
    expect(readdirSync(backup)).toContain(`manifest_${BACKUP_REFERENCE}.offsite.txt`);
    const checksums = readFileSync(join(backup, 'SHA256SUMS'), 'utf8');
    expect(checksums.trim().split('\n')).toHaveLength(3);
    expect(checksums).toContain(`manifest_${BACKUP_REFERENCE}.txt`);
    expect(checksums).not.toContain('.offsite.txt');
    expect(result.calls).toContain(' up -d --no-deps --no-build backend worker web');
  });
  it('does not update application services after a migration failure', () => {
    const result = run({ TEST_MIGRATE_FAIL: '1' });
    expect(result.status, result.stderr).not.toBe(0);
    expect(result.calls).toContain('migrate deploy');
    expect(result.calls).not.toContain(' up -d ');
  });

  it('does not treat an HTTP redirect as readiness', () => {
    const result = run({ TEST_HTTP_STATUS: '308' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Readiness failed');
  });
  it('stops before migration or app update when new-image migration status needs review', () => {
    const result = run({ TEST_PENDING_MIGRATION: '1' });
    expect(result.status).not.toBe(0);
    expect(result.calls).not.toContain('migrate deploy');
    expect(result.calls).not.toContain(' up -d ');
  });
  it('requires backup → restore → offsite → SHA images → new-image migration → application update', () => {
    const result = run();
    expect(result.status, result.stderr).toBe(0);
    const positions = ['backup\n', 'restore\n', 'offsite\n', ' build --build-arg GIT_SHA=' + SHA, ' run --rm --no-deps --pull never backend npx prisma migrate deploy', ' up -d --no-deps --no-build backend worker web'].map(value => result.calls.indexOf(value));
    expect(positions.every(value => value >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(result.calls).not.toMatch(/ up -d (postgres|redis|minio)|minio-create-bucket/);
    expect(result.stdout).toContain(SHA);
  });
});


describe('worker readiness with the actual ioredis client and isolated TCP fixtures', () => {
  const script = readFileSync(resolve('scripts/deploy-hostinger.sh'), 'utf8');
  const probe = script.match(/exec -T worker node -e '([\s\S]*?)' > "\$RECORD_DIR\/worker-readiness.log"/)[1];
  // Parse complete RESP arrays so fragmented/pipelined handshakes are realistic.
  function takeCommand(buffer) {
    const end = buffer.indexOf('\r\n');
    if (end < 0) return null;
    const count = Number(buffer.subarray(1, end).toString());
    let offset = end + 2;
    const args = [];
    for (let index = 0; index < count; index += 1) {
      const next = buffer.indexOf('\r\n', offset);
      if (next < 0) return null;
      const length = Number(buffer.subarray(offset + 1, next).toString());
      if (buffer.length < next + 2 + length + 2) return null;
      args.push(buffer.subarray(next + 2, next + 2 + length).toString());
      offset = next + 2 + length + 2;
    }
    return { args, offset };
  }
  async function runProbe(mode, source = probe) {
    const dir = mkdtempSync(join(tmpdir(), 'noirsound-worker-probe-'));
    for (const bin of ['ffmpeg', 'ffprobe']) writeFileSync(join(dir, bin), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    const sockets = new Set();
    const commands = [];
    const server = createServer(socket => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
      let buffer = Buffer.alloc(0);
      socket.on('data', data => {
        buffer = Buffer.concat([buffer, data]);
        let parsed;
        while ((parsed = takeCommand(buffer))) {
          buffer = buffer.subarray(parsed.offset);
          const command = parsed.args[0].toUpperCase();
          commands.push(command);
          if (mode === 'silent') continue;
          if (command === 'INFO') {
            const info = 'redis_version:7.4.11\r\nloading:0\r\n';
            // Force a real not-ready interval; ping must wait for connect().
            setTimeout(() => { if (!socket.destroyed) socket.write(`$${Buffer.byteLength(info)}\r\n${info}\r\n`); }, 120);
          } else socket.write(command === 'PING' ? '+PONG\r\n' : '+OK\r\n');
        }
      });
    });
    await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
    const port = server.address().port;
    if (mode === 'unreachable') await new Promise(resolveClose => server.close(resolveClose));
    const started = Date.now();
    try {
      const result = await new Promise((resolveExit, reject) => {
        const child = spawn(process.execPath, ['-e', source], {
          cwd: resolve('backend'),
          env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, REDIS_URL: `redis://127.0.0.1:${port}` },
          stdio: ['ignore', 'ignore', 'pipe'],
        });
        let stderr = '';
        child.stderr.on('data', data => { stderr += data; });
        const watchdog = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Readiness exceeded the independent 13s test watchdog')); }, 13000);
        child.once('error', error => { clearTimeout(watchdog); reject(error); });
        child.once('close', (status, signal) => { clearTimeout(watchdog); resolveExit({ status, signal, stderr }); });
      });
      return { ...result, commands, elapsed: Date.now() - started };
    } finally {
      for (const socket of sockets) socket.destroy();
      if (server.listening) await new Promise(resolveClose => server.close(resolveClose));
      rmSync(dir, { recursive: true, force: true });
    }
  }
  it('waits for a delayed healthy connection before pinging with the offline queue disabled', async () => {
    const result = await runProbe('healthy');
    expect(result.status, result.stderr).toBe(0);
    expect(result.commands).toContain('INFO');
    expect(result.commands.filter(command => command === 'PING')).toHaveLength(1);
    expect(result.signal).toBeNull();
    expect(result.elapsed).toBeLessThan(3000);
  });
  it('fails an unreachable endpoint promptly without leaking client errors', async () => {
    const result = await runProbe('unreachable');
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.elapsed).toBeLessThan(3000);
  });
  it('bounds a connected server that never replies and closes all connections', async () => {
    const result = await runProbe('silent');
    expect(result.status).toBe(1);
    expect(result.signal).toBeNull();
    expect(result.elapsed).toBeLessThan(12000);
  }, 15000);
});
