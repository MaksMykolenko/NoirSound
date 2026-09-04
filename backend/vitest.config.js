import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // tests/runTests.js gives every DB-backed file a freshly reset database.
    // Keep direct Vitest invocations sequential as a second guard against
    // accidental shared-database races during targeted local debugging.
    fileParallelism: false,
  },
});
