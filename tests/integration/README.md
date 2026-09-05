# Clean-checkout integration verification

Prerequisites: Node 22.12+ (CI uses Node 22), npm, Docker with Compose v2, FFmpeg/FFprobe, and Playwright Chromium. Start from the exact candidate commit in a separate checkout. No `.env` files, local databases, prior API processes, generated audio, or existing `node_modules` are needed.

```bash
npm ci
npm ci --prefix backend
npx playwright install chromium
node scripts/run-integration.mjs all
```

On Ubuntu CI, install `ffmpeg` and run `npx playwright install --with-deps chromium`. The runner does not install or update dependencies. The `all` mode runs the existing frontend lint, tests, build, forbidden scan and diff check, Prisma generation/validation, the full backend migration/seed/test harness, then all functional E2E projects. Separate `backend`, `security` (migration/schema diff plus the existing security suites), and `e2e` modes are used by the existing CI jobs. Fifteen Node harness checks additionally verify scope guards and strict result classification; they are separate from the catalog baseline of 431 frontend, 331 backend, and 80 E2E cases; release-blocker safety tests are counted separately in the final release report.

Each invocation generates random test-only infrastructure/session credentials in memory, a unique `noirsound-verify-*` Compose project, and six available loopback ports. PostgreSQL uses separate `noirsound_api_test` and `noirsound_backend_test` databases, so backend resets cannot affect the live test API. Redis and private MinIO are isolated; the committed existing Nginx storage proxy supplies browser upload CORS. The API listens on loopback and the worker uses the same generated environment. Auth, CSRF, qualified-play rules and rate limiting remain active; the existing non-production test rate multiplier is 20.

The runner creates the private test bucket and minimal test accounts. Real E2E tests create their own uploads and catalog fixtures. Demo data stays in the explicit demo adapter. Playwright starts separate real and demo frontend processes with server reuse disabled, and its global setup requires real API/database/storage/queue readiness. No unknown preview process or environment file is reused.

The release E2E command fixes one worker and zero retries, disables tracing, and checks the machine-readable result: exactly 64 real-adapter/UI cases, 8 HTTP-fixture interaction cases and 8 explicit demo cases, each passed once. A skipped, interrupted, failed, missing, retried or unclassified case fails the gate. Coverage changes require an explicit update to the expected split; fixtures are never reported as persistence tests. No screenshots or visual assertions are introduced.

Final non-secret summaries are written to ignored `test-results/integration/<mode>-summary.json`. Generated test values are not written to an environment file. Redacted command and process logs stay in a private operating-system temporary directory; CI uploads only the summary. The runner stops only process groups and containers that it created. Its Compose file uses no named volumes; it never invokes `down -v`, deletes another database/volume, or touches production or existing preview stacks.

`artifacts/catalog-search/run-integration.mjs` remains historical local evidence and is not a runtime dependency. The optional `performance` mode runs the existing guarded catalog measurement script in another fresh isolated stack and records its output under `test-results/integration`. It is separate from the default release gates. There is no deployment mode.
