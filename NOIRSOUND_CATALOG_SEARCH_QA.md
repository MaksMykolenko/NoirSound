# NoirSound: catalog/search functional QA

Verdict: **CATALOG SEARCH READY** — verified local candidate; no remaining local blockers.

## Verification scope

Local candidate only. The tested worktree is `/Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Catalog Search`, branch `codex/catalog-search-pagination`, based on HEAD `79b43b5a93f356e4cc4c6224ab9676dfe3713c73` plus inherited and current uncommitted changes. There was no commit, push, merge, deployment or production-domain verification.

The original Design Baseline worktree was checked against all2,706 source hashes: no file changed or disappeared, its six tracked deletions remain, and its full Git status matches the captured status. Evidence: `artifacts/catalog-search/source-preservation.json`. The original localhost:54193 preview was preserved.

Only correctness and functional interaction checks were added. Existing visual tests remain deleted. No screenshot, bounding-box, computed CSS/class, color, font or layout assertions were reintroduced. `src/index.css` is unchanged from the inherited Design Baseline.

## Isolated services and fixtures

| Resource | Catalog test environment |
| --- | --- |
| Compose project | noirsound-catalog-test-20260904 |
| PostgreSQL | loopback55449; separate API, backend-test and performance-test databases |
| Redis | loopback56399 |
| MinIO/storage proxy | loopback59029; console59039 |
| API / worker | API53029 and a worker from this worktree |
| Real frontend | localhost54203 |
| Explicit demo frontend | localhost54204, separate mock adapter |

The gitignored integration environment is loaded by `artifacts/catalog-search/run-integration.mjs`. It rejects production mode and database URLs outside the dedicated loopback port/test database names. Infrastructure credentials are not written to these reports. Test volumes were preserved; no original/production database was reset or reseeded.

`backend/tests/fixtures/catalogFixture.js` creates160 MUSIC and160 BEAT public tracks, two public authors, four excluded authors, legacy/canonical genres, null dates, tied ranks, tags/credits, varied Beat metadata, unstreamable records and10 excluded privacy/moderation cases. It is not imported by normal minimal/demo seeds or application runtime. A late unique title includes Polish/Cyrillic text and literal percent/underscore/hash/quotes.

Real browser cases create their own320-public-record fixture with a unique run/project/worker prefix. They upload actual audio to private MinIO and use the real stream route; catalog, playback, likes and playlist responses are not intercepted. Repeated browser runs can leave multiple fixture prefixes in the isolated API database. Counts320 in those assertions are scoped to the current fixture query. The separate measured performance database has exactly330 tracks.

## Baseline and current gates

The initial gate was actually executed before harness corrections. No historical test registration or previous-task result is counted as a current execution.

| Baseline command | Passed | Failed | Skipped | Interrupted | Not run |
| --- | ---: | ---: | ---: | ---: | ---: |
| Frontend unit/components |398 (61 files)|0|0|0|0|
| Backend full harness |281 (19 files)|0|0|0|0|
| Full E2E |67|5|4|0|0|

Initial build, lint and Prisma validation passed; lint had seven inherited warnings. Baseline E2E failures: four admin tests pointed at the wrong adapter and one mobile genre test resized an already-open popup, invalidating its search locator. The previous batch title locator fix was confirmed.

Current final gate results follow. Intermediate frontend415/63-file results are superseded by the final431-test run, including demo literal-search and catalog-anchor regressions.

| Current check | State / evidence |
| --- | --- |
| Backend `npm run test` | PASS:331 tests /21 files,0failed/skipped/not-run; `backend-full-tests-final.log` |
| Backend final parser/legacy recheck | PASS:54 tests /2 files after the final search normalization change |
| Prisma validation | PASS on final backend source |
| Frontend `npm run test` | PASS:431 tests /64 files,0failed/skipped/not-run; `frontend-full-tests.log` |
| `npm run lint` | PASS, seven inherited warnings and no new warnings; `final-lint.log` |
| `npm run build` | PASS; `final-build.log` |
| `npm run check:forbidden` | PASS (forbidden files and supported secret signatures); `forbidden-scan.log` |
| `npm run test:e2e` | PASS:80passed,0failed/skipped/interrupted/not-run; `final-e2e-stable.log` and `final-e2e-stable.json` |
| `git diff --check` | PASS; final whitespace check includes source and reports |

All evidence filenames in this table are under `artifacts/catalog-search/` unless stated otherwise.

## Functional coverage and harness corrections

- Real PostgreSQL catalog integration independently compares every returned ID against fixture data for all four global orders, across320 records, ties and null dates. Music/Beat traversals each contain160 distinct IDs. It verifies late-title, tags, primary/featured credit, author and taxonomy searches; literal punctuation remains literal even when it resembles a genre. It tests explicit bounds, unknown/repeated parameters, malformed/cross-query cursors, canonical/legacy genres and old array response consumers.
- Total and facet expectations are computed independently from the explicit fixture values. Tests cover taxonomy/style/BPM exclusions, full-database counts, hidden-only facets, rare selected options outside the top100 and public-only creator event aggregates. Sensitive fields and full lyrics are absent from the lightweight response.
- Actual React Query component scenarios cover first/next loading, single-flight Load More, failed-cursor retry retaining rows, server order/total, no queue mutation while loading, stale-response cancellation, debounce, encoded F# Minor/Unicode URLs, Back/Forward, mode resets, viewer-specific keys, error/empty states and late-row player/like/menu actions. These component fixtures are not counted as backend persistence evidence.
- The new real-service desktop/mobile scenarios load30→60→90 records, check distinct IDs/no new PlayEvents during pagination, search the unique late record, switch Music/Beat/genre/Beat filters, refresh/navigate detail/back/history, play a later-page record, persist its Like and playlist membership, use the native shared context menu, and verify current-track/progress continuity when another page loads. Private-record search is tested without a genre constraint that could conceal leaks.
- Eight deterministic existing demo cases run explicitly in the dedicated demo project; eight HTTP-intercepted interaction cases remain separately identified. Neither category is counted as real backend persistence. Missing services fail the new key scenarios; no new skip was added.
- Large fixtures exposed inherited tests that assumed freshly published records were in the global first20, or that the first Discover item must be Music. Those tests now query their unique token/exact IDs or create their own worker-processed Music record. Publication, lyrics, privacy and player assertions remain intact.
- Existing Supertest database suites intermittently failed with socket hang-ups and an impossible upload-init404 while auto-opening/closing an ephemeral server per request. Independent endpoint43/43 passed with unchanged product code. The harness now opens one explicit loopback port0 listener per suite and closes it in teardown; the complete backend331-test run then passed. Product behavior was not changed to satisfy those transport failures.

Intermediate failed runs are retained rather than concealed: baseline67/5/4; first current full80 E2E72passed/7failed/1not-run; initial new browser registration expectation mismatch and a mobile expanded-player interaction correction; transient catalog resets/HTTP parser errors that did not recur on the stable final run (cause unproven); initial backend transport failures. Final counts above describe final executions, not sums of retries or registrations.

## Performance

Evidence: `artifacts/catalog-search/performance.json`, including actual SQL plans, source hashes, payload bytes and query-event counts. Reproduce with:

```bash
npm ci
(cd backend && npm ci)
node scripts/run-integration.mjs performance
```

The original measurement used `noirsound_catalog_perf_test` on loopback55449. The committed runner now generates isolated test credentials and chooses an available loopback port; it has no dependency on the original artifacts runner or ignored environment. Dataset:330 tracks,320 publicly eligible,160 MUSIC,160 BEAT,6 authors and1,622 PlayEvents. Measurements use ANALYZE, EXPLAIN ANALYZE BUFFERS, two warmups and seven full-response samples. Every measured response issues exactly seven read statements (including CTE queries); row count does not cause N+1 round trips. Payloads include complete returned facets and total.

| Scenario | Items / total | JSON bytes | Page SQL ms | Full response median ms | Maximum ms | Read queries |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
|recent_first|30 / 320|33295|0.646|12.726|15.582|7|
|recent_next|30 / 320|33324|0.637|10.503|12.039|7|
|literal_unicode_search|2 / 2|8559|2.179|22.208|35.148|7|
|beat_filter|9 / 9|14874|0.209|9.994|10.22|7|
|played|30 / 320|33267|0.828|9.613|10.554|7|
|trending_7days|30 / 320|33288|0.968|9.966|10.892|7|
|maximum_page|100 / 320|94189|0.659|10.056|11.414|7|

These are local warm-cache measurements on a small representative fixture. They do not establish million-record capacity or production latency. Existing indexes are available, including enum contentType comparisons; PostgreSQL can choose sequential scans for these tiny relations. No catalog-stage index migration is justified by these observed plans. Broad substring searches should be profiled again with real production-scale distributions before selecting further indexing/infrastructure.

## Remaining verification boundary

The integration runbook is in `NOIRSOUND_CATALOG_SEARCH_IMPLEMENTATION.md`: verified release commit → successful backup → NEW backend image containing migrations → migrate deploy from that image → service update → readiness and real-domain functional smoke. No production stage was executed. Two inherited migration directories are present; their production application is not known. The current catalog stage adds no new migration.

Final local verdict: **CATALOG SEARCH READY**. Final frontend431 + backend331 + E2E80 =842 passed tests in the main gates, with0 final failures/skips/interrupted/not-run. This sum excludes duplicate focused rechecks. E2E splits into64 real-adapter/UI cases (including4 new real catalog cases),8 HTTP-fixture interaction cases and8 explicit demo cases. No remaining local blocker. Production verification was outside the catalog-stage scope; the separate release finalization report records the subsequently authorized integration/deployment status.
