import { defineConfig, devices } from '@playwright/test';

const e2ePort = Number(process.env.E2E_PORT || 4173);
if (!Number.isInteger(e2ePort) || e2ePort < 1 || e2ePort > 65535) {
  throw new Error(`E2E_PORT must be a valid TCP port, received "${process.env.E2E_PORT}".`);
}

const e2eBaseUrl = process.env.E2E_BASE_URL || `http://localhost:${e2ePort}`;
const mockPort = Number(process.env.E2E_MOCK_PORT || e2ePort + 1);
if (!Number.isInteger(mockPort) || mockPort < 1 || mockPort > 65535 || mockPort === e2ePort) {
  throw new Error('E2E_MOCK_PORT must be a distinct valid TCP port.');
}
const mockBaseUrl = process.env.E2E_MOCK_BASE_URL || `http://localhost:${mockPort}`;
const parsedBaseUrl = new URL(e2eBaseUrl);
const parsedMockBaseUrl = new URL(mockBaseUrl);
if (![parsedBaseUrl, parsedMockBaseUrl].every(url => ['localhost', '127.0.0.1'].includes(url.hostname))) {
  throw new Error('Functional E2E frontend servers must use localhost or 127.0.0.1.');
}
if (![parsedBaseUrl, new URL(mockBaseUrl)].every(url => ['http:', 'https:'].includes(url.protocol))) {
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
      grepInvert: /@demo/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-demo',
      grep: /@demo/,
      metadata: { apiMode: 'demo-fixture' },
      use: { ...devices['Desktop Chrome'], baseURL: mockBaseUrl },
    },
    {
      name: 'chromium-mobile-catalog',
      testMatch: '**/catalog-search.spec.js',
      grepInvert: /@demo/,
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
  ],
  webServer: [{
    command: `npm run dev -- --host ${parsedBaseUrl.hostname} --port ${e2ePort} --strictPort`,
    url: `${e2eBaseUrl.replace(/\/$/, '')}/noirsound-e2e-identity.json`,
    reuseExistingServer: process.env.E2E_REUSE_SERVER !== 'false' && !process.env.CI,
    timeout: 120 * 1000,
  }, {
    command: `npm run dev -- --host ${parsedMockBaseUrl.hostname} --port ${mockPort} --strictPort`,
    env: { VITE_USE_MOCK_API: 'true' },
    url: `${mockBaseUrl.replace(/\/$/, '')}/noirsound-e2e-identity.json`,
    reuseExistingServer: process.env.E2E_REUSE_SERVER !== 'false' && !process.env.CI,
    timeout: 120 * 1000,
  }],
});
