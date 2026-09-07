import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL;
if (process.env.PUBLIC_APP_ENABLED !== 'false' || process.env.VITE_PUBLIC_APP_ENABLED !== 'false'
  || !baseURL || new URL(baseURL).hostname !== '127.0.0.1') {
  throw new Error('Closed-mode E2E requires the isolated runner and both public flags false.');
}
export default defineConfig({
  testDir: './tests/e2e', testMatch: 'landing-closed.spec.js',
  globalSetup: './tests/e2e/globalSetup.js', fullyParallel: false, workers: 1,
  retries: 0, forbidOnly: true, reporter: 'html',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium-closed', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${Number(process.env.E2E_PORT)} --strictPort`,
    url: `${baseURL}/noirsound-e2e-identity.json`, reuseExistingServer: false,
    env: { VITE_PUBLIC_APP_ENABLED: 'false', VITE_USE_MOCK_API: 'false' }, timeout: 120000,
  },
});
