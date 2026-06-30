# NoirSound GitHub Deployment Audit

Date: 2026-06-30

## Verdict

Current audit result: HOSTINGER DEPLOYMENT READY, with full integration and Docker image execution delegated to the required GitHub CI gate because local Docker/PostgreSQL services were unavailable.

## Public Repository Safety

- Real env files are present locally as `.env` and `backend/.env`, but `git ls-files` shows they are not tracked.
- `.env.example`, `.env.production.example`, and `backend/.env.example` are tracked templates only.
- `npm run check:forbidden` passes after this pass.
- The current working tree already contains many deleted historical `NOIRSOUND_*.md` report files. Those deletions were not reverted.
- Generated Playwright report output, last-run metadata, and lint output were removed from tracking. Existing design screenshots remain intentional project artifacts and can be slimmed separately if desired.

## Forbidden Files

Tracked forbidden files checked:

- `.env`: absent from Git tracking.
- `.env.production`: absent from Git tracking.
- Private key extensions `.pem`, `.key`, `.p12`: absent from Git-visible files.
- Backup folders and dump/archive files: blocked by `scripts/check-forbidden-files.sh`.
- PostgreSQL migration SQL and the local test database init SQL are explicitly allowed.

## Ignore Rules

Updated `.gitignore` covers:

- `.env`, `.env.*`, with exceptions for `.env.example` and `.env.production.example`.
- `backend/.env`, `backend/.env.*`, with exceptions for backend templates.
- `node_modules/`, `dist/`, `build/`, `coverage/`, `playwright-report/`, `test-results/`.
- `backups/`, logs, editor folders, `.DS_Store`.
- private key/certificate extensions.

Updated Docker ignore files avoid sending env files, keys, logs, test output, backups, and generated reports to image builds.

## Environment Templates

`.env.production.example` now includes production placeholders for:

- domain and browser origins.
- PostgreSQL and `DATABASE_URL`.
- Redis.
- private MinIO/S3 settings.
- JWT/cookie/session/CSRF secret placeholders.
- support, copyright, and abuse inboxes.
- worker and media limits.

The backend production config now rejects placeholder values such as `CHANGE_ME` and `example.com` before startup.

## Docker Build Context

- Frontend Docker build uses the repository root and excludes `backend/`, env files, reports, tests, and generated artifacts.
- Backend Docker build uses `./backend` and includes `backend/src/shared/musicGenres.json` plus `backend/src/constants/musicGenres.js`.
- CI verifies shared taxonomy files in the backend image.
- Worker uses the backend image, which installs FFmpeg/FFprobe.

## CI

`.github/workflows/public-beta.yml` now provides these explicit jobs:

- `forbidden-files-scan`
- `frontend-lint`
- `frontend-test`
- `frontend-build`
- `backend-test`
- `backend-unit-security`
- `playwright-e2e`
- `docker-build`

The CI includes a Prisma migration drift check and Docker image checks.

## Deployment Workflow

`.github/workflows/deploy-hostinger.yml` implements manual/tag-based SSH deploy to Hostinger. It requires:

- `HOSTINGER_HOST`
- `HOSTINGER_USER`
- `HOSTINGER_SSH_KEY`
- `HOSTINGER_KNOWN_HOSTS`
- `HOSTINGER_DEPLOY_PATH`
- `PRODUCTION_DOMAIN`
- optional `HOSTINGER_PORT`

Production secrets remain on the VPS in `.env.production`.

## Hostinger Documentation

Created runbooks:

- `NOIRSOUND_DNS_HOSTINGER_RUNBOOK.md`
- `NOIRSOUND_HOSTINGER_BACKUP_RUNBOOK.md`
- `NOIRSOUND_RELEASE_AND_ROLLBACK_RUNBOOK.md`

Created final deployment artifacts:

- `NOIRSOUND_GITHUB_TO_HOSTINGER_DEPLOYMENT_REPORT.md`
- `NOIRSOUND_HOSTINGER_DEPLOYMENT_CHECKLIST.md`
- `NOIRSOUND_GITHUB_SECRETS_CHECKLIST.md`
- `NOIRSOUND_DEPLOYMENT_FINAL_COMMANDS.md`
