import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

describe('Clean Local Product Data Safety Contracts', () => {
  const scriptPath = path.join(__dirname, '..', 'scripts', 'cleanLocalProductData.js');

  it('refuses to run without --confirm flag in dry run mode', () => {
    const output = execSync(`node "${scriptPath}"`, {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'development' },
    });
    expect(output).toContain('DRY RUN');
    expect(output).toContain('pass --confirm to execute');
  }, 15000);

  it('refuses to run when NODE_ENV is production', () => {
    expect(() => {
      execSync(`node "${scriptPath}" --confirm`, {
        encoding: 'utf8',
        env: { ...process.env, NODE_ENV: 'production' },
        stdio: 'pipe',
      });
    }).toThrow();
  }, 15000);
});
