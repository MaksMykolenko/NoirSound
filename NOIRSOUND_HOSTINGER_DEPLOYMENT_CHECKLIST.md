# NoirSound Hostinger Deployment Checklist

## GitHub

- [ ] Push the repository to GitHub.
- [ ] Confirm `.github/workflows/public-beta.yml` passes.
- [ ] Add required deploy secrets from `NOIRSOUND_GITHUB_SECRETS_CHECKLIST.md`.
- [ ] Trigger deployment manually or push a `public-beta-*` tag.

## VPS

- [ ] Create or confirm `/opt/noirsound`.
- [ ] Clone the GitHub repository.
- [ ] Create `/opt/noirsound/.env.production` from `.env.production.example`.
- [ ] Replace every `CHANGE_ME` and `example.com` placeholder.
- [ ] Set `chmod 600 /opt/noirsound/.env.production`.
- [ ] Install Docker and Docker Compose plugin.
- [ ] Install `git`, `curl`, and `ufw`.
- [ ] Open only SSH, 80, and 443.
- [ ] Confirm MinIO, PostgreSQL, and Redis ports are not published publicly.

## Deploy

- [ ] Run `scripts/deploy-hostinger.sh`.
- [ ] Confirm `/api/ready` returns 200.
- [ ] Run `DOMAIN=https://noirsound.co scripts/smoke-production.sh`.
- [ ] Confirm Caddy issued HTTPS certificate.
- [ ] Confirm backup artifacts exist after deploying over an existing stack.

## Manual Launch Reminders

- [ ] Support inbox works.
- [ ] Copyright inbox works.
- [ ] Abuse inbox works.
- [ ] DNS `@` and `www` records point to VPS.
- [ ] Off-host backup copy is configured.
