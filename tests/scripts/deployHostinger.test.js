// @vitest-environment node
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';

const SHA = '1'.repeat(40);
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
    script('bin/curl', 'exit 0');
    script('bin/docker', `printf 'docker %s\\n' "$*" >> "$CALL_LOG"
      case "$*" in
        *' ps -q '*) service="\${!#}"; [[ "\${TEST_MISSING_SERVICE:-}" == "$service" ]] || printf 'cid-%s\\n' "$service" ;;
        'inspect -f '*'.Config.Labels'*) printf '%s\\n' "$COMPOSE_PROJECT_NAME" ;;
        'inspect -f '*'.State.Status'*) printf 'running\\n' ;;
        'inspect -f '*'.State.Health'*) printf '%s\\n' "\${TEST_HEALTH:-healthy}" ;;
        'inspect -f '*'.Image'*) if [[ -f "$FIXTURE/updated" ]]; then printf 'sha256:%064d\\n' 2; else printf 'sha256:%064d\\n' 1; fi ;;
        'image inspect -f '*'.Config.Labels'*) printf '%s\\n' "$RELEASE_SHA" ;;
        'image inspect -f '*'.Id'*) printf 'sha256:%064d\\n' 2 ;;
        *' up -d '*) touch "$FIXTURE/updated" ;;
        *' run --rm --no-deps --pull never backend npx prisma migrate deploy'*) [[ "\${TEST_MIGRATE_FAIL:-}" != 1 ]] ;;
      esac`);
    script('app/scripts/backup-all.sh', `printf 'backup\\n' >> "$CALL_LOG"
      if [[ "\${TEST_BACKUP_FAIL:-}" == 1 ]]; then exit 21; fi
      cp "$FIXTURE/postgres.dump.gz" "$NOIRSOUND_BACKUP_DIR/postgres_fixture.dump.gz"
      cp "$FIXTURE/storage.tar.gz" "$NOIRSOUND_BACKUP_DIR/storage_fixture.tar.gz"
      printf 'stub manifest\\n' > "$NOIRSOUND_BACKUP_DIR/manifest_fixture.txt"`);
    script('app/scripts/restore-drill.sh', `printf 'restore\\n' >> "$CALL_LOG"
      [[ -s "$DRILL_POSTGRES_BACKUP" && -s "$DRILL_STORAGE_BACKUP" ]]
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
      env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`, FIXTURE: dir, CALL_LOG: log, APP_DIR: join(dir, 'app'), RELEASE_SHA: SHA, COMPOSE_PROJECT_NAME: 'verified-existing', OFFSITE_BACKUP_VERIFY_SCRIPT: join(dir, 'bin/offsite-verifier'), DRILL_DATABASE_URL: 'postgresql://fixture:fixture@localhost/owned_drill', DRILL_S3_BUCKET: 'owned-drill', DEPLOY_RECORD_DIR: join(dir, 'records'), ...overrides },
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
  it('does not update application services after a migration failure', () => {
    const result = run({ TEST_MIGRATE_FAIL: '1' });
    expect(result.status, result.stderr).not.toBe(0);
    expect(result.calls).toContain('migrate deploy');
    expect(result.calls).not.toContain(' up -d ');
  });
  it('requires backup → restore → offsite → SHA images → new-image migration → application update', () => {
    const result = run();
    expect(result.status, result.stderr).toBe(0);
    const positions = ['backup\n', 'restore\n', 'offsite\n', ' build backend worker web', ' run --rm --no-deps --pull never backend npx prisma migrate deploy', ' up -d --no-deps --no-build backend worker web'].map(value => result.calls.indexOf(value));
    expect(positions.every(value => value >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(result.calls).not.toMatch(/ up -d (postgres|redis|minio)|minio-create-bucket/);
    expect(result.stdout).toContain(SHA);
  });
});
