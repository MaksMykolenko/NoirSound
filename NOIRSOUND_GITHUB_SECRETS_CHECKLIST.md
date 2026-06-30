# NoirSound GitHub Secrets Checklist

## Required Repository Secrets

Configure these in GitHub repository settings before using the Hostinger deploy workflow:

```txt
HOSTINGER_HOST
HOSTINGER_USER
HOSTINGER_SSH_KEY
HOSTINGER_KNOWN_HOSTS
HOSTINGER_DEPLOY_PATH
PRODUCTION_DOMAIN
```

Optional:

```txt
HOSTINGER_PORT
```

## Rules

- Do not store `.env.production` as one giant GitHub secret.
- Do not store database URLs, MinIO keys, JWT secrets, cookie secrets, or SMTP passwords in GitHub unless a future workflow genuinely requires them.
- Keep production secrets on the VPS in `/opt/noirsound/.env.production`.
- Use a dedicated deploy SSH key with the minimum access needed for the deploy user.
- Set `HOSTINGER_KNOWN_HOSTS` from a host key verified through the Hostinger console or another trusted channel.

## Validation

Before first deploy:

```bash
npm run check:forbidden
```

In GitHub Actions, run the workflow from the `main` branch:

```txt
Actions -> Deploy to Hostinger VPS -> Run workflow
```

For a release tag, push a `public-beta-*` tag and let the tag trigger deploy the exact tagged commit.
