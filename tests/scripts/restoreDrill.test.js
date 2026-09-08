// @vitest-environment node
import { it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';

it('proves generated restore targets, archive integrity and run-owned cleanup guards', () => {
  const result = spawnSync('python3', ['tests/scripts/backupToolSafety.py'], {
    encoding: 'utf8', timeout: 30000, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });
  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(result.stderr).toContain('Ran 35 tests');
});
