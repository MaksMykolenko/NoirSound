# OAuth return URL remediation

The final landing auth-flow audit found an existing URL-normalization bypass in `backend/src/lib/googleOAuth.js`. The previous string-prefix check accepted `/\n/redirect.example.invalid` and equivalent CR/tab inputs. WHATWG URL parsing removes these characters, turning the accepted value into an external protocol-relative URL.

The narrow fix rejects ASCII control characters before parsing and verifies that URL resolution preserves a fixed local origin. Supported internal paths, query parameters, and hashes are returned unchanged. Existing OAuth state, PKCE, cookies, accounts, session issuance, artist access, and upload processing are unchanged.

Validation:

- `backend/tests/googleOAuth.unit.test.js`: 14 passing functional tests, including normalization attacks, all ASCII controls, valid upload/Discover/profile URLs, public OAuth-start redirects, and revalidation of a previously signed return cookie at callback.
- Combined targeted run: 4 files / 80 tests passed, 0 failed/skipped: Google OAuth, existing public-beta unit coverage, landing HTTP metadata, and metadata renderer. See `oauth-verification.json`.
- Existing server/Google OAuth callback smoke: 1 file / 10 tests passed, including normal account/session issuance using the existing mocked Google provider. See `oauth-existing-smoke.json`. Total post-fix targeted verification: 5 files / 90 tests passed.
- Focused lint and `git diff --check` passed. An initial broad unit invocation lacked the existing suite's required test JWT secret; the final invocation supplies newly generated ephemeral test secrets in memory. No project or production environment file was used.
- The production Docker HTTP smoke additionally checks LF/CR/tab attack redirects and a valid upload intent against the rebuilt backend, reading each 302 without following it: **43/43 checks PASS**. See `production-http/summary.json` and `final-smoke.log`. Backend image: `sha256:ca609ef1d827e05e9de0e37a6e84cc41234d25fcdb08e8553814c8339e6d7154`; current web entry is `/assets/index-CYRC88hv.js`.
- Actual Google account/provider authentication remains outside this local check. Provider callback behavior is exercised with signed local fixture cookies; this is not live third-party OAuth verification.
