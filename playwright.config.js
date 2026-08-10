import { defineConfig, devices } from '@playwright/test';

const e2ePort = Number(process.env.E2E_PORT || 4173);
if (!Number.isInteger(e2ePort) || e2ePort < 1 || e2ePort > 65535) {
  throw new Error(`E2E_PORT must be a valid TCP port, received "${process.env.E2E_PORT}".`);
}

const e2eBaseUrl = process.env.E2E_BASE_URL || `http://localhost:${e2ePort}`;
const parsedBaseUrl = new URL(e2eBaseUrl);
if (!['http:', 'https:'].includes(parsedBaseUrl.protocol)) {
  throw new Error(`E2E_BASE_URL must use http or https, received "${e2eBaseUrl}".`);
}

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/globalSetup.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: e2eBaseUrl,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run dev -- --host localhost --port ${e2ePort} --strictPort`,
    url: `${e2eBaseUrl.replace(/\/$/, '')}/noirsound-e2e-identity.json`,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
