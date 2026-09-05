// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';

describe('restore drill resource ownership guards', () => {
  let fixture;
  beforeEach(() => {
    fixture = mkdtempSync(join(tmpdir(), 'noirsound-restore-safety-'));
    for (const folder of ['scripts', 'bin', 'backups', 'objects']) mkdirSync(join(fixture, folder));
    for (const name of ['restore-drill.sh', 'restore-postgres.sh', 'restore-storage.sh', 'lib-backup-common.sh']) {
      copyFileSync(resolve('scripts', name), join(fixture, 'scripts', name));
    }
    writeFileSync(join(fixture, 'environment'), '');
    writeFileSync(join(fixture, 'backups/postgres_fixture.dump.gz'), gzipSync('stub database archive'));
    writeFileSync(join(fixture, 'objects/fixture.txt'), 'owned test object');
    const archive = spawnSync('tar', ['-czf', join(fixture, 'backups/storage_fixture.tar.gz'), '-C', join(fixture, 'objects'), '.']);
    if (archive.status !== 0) throw new Error('Unable to create test storage archive.');
    const stub = (name, source) => writeFileSync(join(fixture, 'bin', name), `#!/bin/sh\n${source}\n`, { mode: 0o755 });
    stub('psql', `printf 'psql %s\\n' "$*" >> "$CALL_LOG"
case "$*" in
  *'SELECT 1 FROM pg_database'*) [ "$TEST_EXISTING_DB" = 1 ] && printf '1\\n'; exit 0 ;;
  *'CREATE DATABASE'*) [ "$TEST_CREATE_FAIL" = 1 ] && exit 12; exit 0 ;;
  *'DROP DATABASE'*) [ "$TEST_DB_CLEANUP_FAIL" = 1 ] && exit 16; exit 0 ;;
  *'SHOW server_version_num'*) printf '150000\\n' ;;
  *'SELECT COUNT'*) printf '1\\n' ;;
esac`);
    stub('pg_restore', `case "$*" in *--version*) printf 'pg_restore (PostgreSQL) 15.0\\n'; exit 0 ;; esac
cat >/dev/null
[ "$TEST_RESTORE_FAIL" = 1 ] && exit 13
exit 0`);
    stub('aws', `printf 'aws %s\\n' "$*" >> "$CALL_LOG"
case "$*" in
  *'list-buckets'*) printf '%s\\n' "$S3_BUCKET"; [ "$TEST_EXISTING_BUCKET" = 1 ] && printf '%s\\n' "$DRILL_S3_BUCKET"; exit 0 ;;
  *'s3 mb'*) [ "$TEST_BUCKET_CREATE_FAIL" = 1 ] && exit 14; exit 0 ;;
  *'s3 sync'*) [ "$TEST_STORAGE_RESTORE_FAIL" = 1 ] && exit 15; exit 0 ;;
  *'s3 rb'*) [ "$TEST_BUCKET_CLEANUP_FAIL" = 1 ] && exit 17; exit 0 ;;
  *'s3 ls'*) printf '2026-01-01 00:00:00 17 fixture.txt\\n' ;;
esac`);
  });
  afterEach(() => rmSync(fixture, { recursive: true, force: true }));

  function run(overrides = {}) {
    const log = join(fixture, 'calls'); writeFileSync(log, '');
    const result = spawnSync('bash', [join(fixture, 'scripts/restore-drill.sh')], {
      encoding: 'utf8', timeout: 15000,
      env: {
        ...process.env, PATH: `${join(fixture, 'bin')}:${process.env.PATH}`, CALL_LOG: log,
        NOIRSOUND_ENV_FILE: join(fixture, 'environment'), NOIRSOUND_BACKUP_DIR: join(fixture, 'backups'),
        DATABASE_URL: 'postgresql://test:test@localhost/live_db',
        DRILL_DATABASE_URL: 'postgresql://test:test@localhost/noirsound_drill_owned',
        S3_ENDPOINT: 'http://localhost:9000', S3_BUCKET: 'noirsound-live',
        DRILL_S3_BUCKET: 'noirsound-drill-owned', S3_ACCESS_KEY_ID: 'test', S3_SECRET_ACCESS_KEY: 'test',
        ...overrides,
      },
    });
    return { ...result, calls: readFileSync(log, 'utf8') };
  }
  const expectNoMutations = result => {
    expect(result.status, result.stderr).not.toBe(0);
    expect(result.calls).not.toMatch(/CREATE DATABASE|DROP DATABASE|s3 (?:mb|rm|rb|sync)/);
  };

  it.each([
    { DATABASE_URL: 'postgresql://test:test@localhost/live_drill', DRILL_DATABASE_URL: 'postgresql://test:test@localhost/live_drill' },
    { DRILL_DATABASE_URL: 'postgresql://test:test@localhost/unsafe_drill";DROP DATABASE live_db;--' },
    { S3_BUCKET: 'noirsound-drill-live', DRILL_S3_BUCKET: 'noirsound-drill-live', NOIRSOUND_ALLOW_PROD_RESTORE: 'yes' },
  ])('rejects live or unsafe targets before any service command: %j', overrides => {
    const result = run(overrides); expectNoMutations(result); expect(result.calls).toBe('');
  });
  it.each([{ TEST_EXISTING_DB: '1' }, { TEST_EXISTING_BUCKET: '1' }])('refuses resources owned by another run: %j', overrides => {
    expectNoMutations(run(overrides));
  });
  it('requires a storage archive before creating a database', () => {
    rmSync(join(fixture, 'backups/storage_fixture.tar.gz'));
    const result = run(); expectNoMutations(result); expect(result.calls).toBe('');
  });
  it('does not clean up a database when its creation failed', () => {
    const result = run({ TEST_CREATE_FAIL: '1' });
    expect(result.status).not.toBe(0); expect(result.calls).toContain('CREATE DATABASE');
    expect(result.calls).not.toMatch(/DROP DATABASE|s3 (?:mb|rm|rb|sync)/);
  });
  it('cleans only the database it created when database restore fails', () => {
    const result = run({ TEST_RESTORE_FAIL: '1' });
    expect(result.status).not.toBe(0); expect(result.calls).toContain('DROP DATABASE IF EXISTS "noirsound_drill_owned"');
    expect(result.calls).not.toMatch(/s3 (?:mb|rm|rb|sync)/);
  });
  it('does not remove a bucket whose creation failed', () => {
    const result = run({ TEST_BUCKET_CREATE_FAIL: '1' });
    expect(result.status).not.toBe(0); expect(result.calls).toContain('s3 mb s3://noirsound-drill-owned');
    expect(result.calls).not.toMatch(/s3 (?:rm|rb|sync)/);
  });
  it('cleans only owned resources after storage restoration fails', () => {
    const result = run({ TEST_STORAGE_RESTORE_FAIL: '1' });
    expect(result.status).not.toBe(0);
    expect(result.calls).toContain('s3 rb s3://noirsound-drill-owned --force');
    expect(result.calls).toContain('DROP DATABASE IF EXISTS "noirsound_drill_owned"');
    expect(result.calls).not.toMatch(/s3 (?:rm|rb) s3:\/\/noirsound-live|DROP DATABASE IF EXISTS "live_db"/);
  });
  it('verifies both restored resources and removes only those created in this run', () => {
    const result = run(); expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('1/1 objects restored');
    expect(result.calls.match(/DROP DATABASE/g)).toHaveLength(1);
    expect(result.calls.match(/s3 rb/g)).toHaveLength(1);
    expect(result.calls).not.toMatch(/s3 (?:rm|rb) s3:\/\/noirsound-live|DROP DATABASE IF EXISTS "live_db"/);
  });
  it('preserves the caller archive pair instead of stale environment-file defaults', () => {
    writeFileSync(join(fixture, 'environment'), 'DRILL_POSTGRES_BACKUP=/stale/postgres.dump.gz\nDRILL_STORAGE_BACKUP=/stale/storage.tar.gz\n');
    const result = run({
      DRILL_POSTGRES_BACKUP: join(fixture, 'backups/postgres_fixture.dump.gz'),
      DRILL_STORAGE_BACKUP: join(fixture, 'backups/storage_fixture.tar.gz'),
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('PG backup:      postgres_fixture.dump.gz');
    expect(result.stdout).toContain('Storage backup: storage_fixture.tar.gz');
  });
  it.each([{ TEST_DB_CLEANUP_FAIL: '1' }, { TEST_BUCKET_CLEANUP_FAIL: '1' }])('does not claim success when owned-resource cleanup fails: %j', overrides => {
    const result = run(overrides);
    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain('Restore drill PASSED');
    expect(result.stderr).toContain('could not be fully removed');
    expect(result.calls).not.toMatch(/s3 (?:rm|rb) s3:\/\/noirsound-live|DROP DATABASE IF EXISTS "live_db"/);
  });
});
