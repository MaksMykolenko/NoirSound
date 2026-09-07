# Clean-checkout integration verification

Prerequisites: Node 22.12+ (CI uses Node 22), npm, Docker with Compose v2, FFmpeg/FFprobe, and Playwright Chromium. Start from the exact candidate commit in a separate checkout. No `.env` files, local databases, prior API processes, generated audio, or existing `node_modules` are needed.

```bash
npm ci
npm ci --prefix backend
npx playwright install chromium
node scripts/run-integration.mjs all
```

On Ubuntu CI, install `ffmpeg` and run `npx playwright install --with-deps chromium`. The runner does not install or update dependencies. The `all` mode runs frontend lint, tests, build, forbidden scan and diff check, Prisma generation/validation, the full backend migration/seed/test harness, then open and closed functional E2E projects. Separate `backend`, `security` (migration/schema diff plus the security suites), and `e2e` modes serve CI; `closed` runs only the closed-mode phase. Dedicated Node checks verify database/container ownership, fail-closed guards and strict result classification. Test totals come from each fresh run, not a historical baseline.

Each invocation generates random test-only credentials, a 12-hex run ID, a unique `noirsound-verify-<run-id>` Compose project, and six loopback ports. Inherited database URLs, project IDs, private environment files and production environments are rejected. The runner requires a new project, checks PostgreSQL's exact Compose labels, tmpfs data directory and generated loopback port, then creates a server ownership marker with a random proof. Database names are `noirsound_<run-id>_<purpose>_test`. Only explicit `NODE_ENV=test` and exact generated credentials/URLs are accepted.

The backend runner creates a fresh database for the unit group and each PostgreSQL fixture file. Before creation it checks the server proof and rejects pre-existing databases; schema setup uses `prisma migrate deploy`, never reset. Cleanup is restricted to objects recorded as created by this process, with both server and database ownership markers rechecked, including after a test fails. API and shadow databases are separate. Redis and private MinIO are isolated; the existing Nginx storage proxy supplies browser upload CORS. Auth, CSRF, qualified-play rules and rate limiting remain active; the existing non-production test rate multiplier is 20.

The runner creates the private test bucket and minimal test accounts. Real E2E tests create their own uploads and catalog fixtures. Demo data stays in the explicit demo adapter. Playwright starts separate real and demo frontend processes with server reuse disabled, and its global setup requires real API/database/storage/queue readiness. No unknown preview process or environment file is reused.

The release E2E command fixes one worker and zero retries, disables tracing, and checks the machine-readable result: 70 open-mode real-service cases, 8 HTTP-fixture interactions and 8 explicit demo cases, each passed once. It then restarts only the test API with `PUBLIC_APP_ENABLED=false`, starts the frontend with `VITE_PUBLIC_APP_ENABLED=false`, and requires 8 additional real-service closed-mode cases. A skipped, interrupted, failed, missing, retried or unclassified case fails the gate. Coverage changes require an explicit expected-count update; fixture cases never prove persistence. No screenshots or visual assertions are introduced.

Final non-secret summaries are written to ignored `test-results/integration/<mode>-summary.json`. Generated test values are not written to an environment file. Redacted command and process logs stay in a private operating-system temporary directory; CI uploads only the summary. The runner stops only process groups and containers that it created. Its Compose file uses no named volumes; it never invokes `down -v`, deletes another database/volume, or touches production or existing preview stacks.

`artifacts/catalog-search/run-integration.mjs` remains historical local evidence and is not a runtime dependency. The optional `performance` mode runs the existing guarded catalog measurement script in another fresh isolated stack and records its output under `test-results/integration`. It is separate from the default release gates. There is no deployment mode.
