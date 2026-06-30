# NoirSound DNS And Hostinger Runbook

## Goal

Point the production domain to the Hostinger VPS without exposing storage directly.

## DNS Records

For `noirsound.co` or the configured production domain:

```txt
A      @      <VPS_IPV4>
A      www    <VPS_IPV4>
```

Optional, only if the app is intentionally split by subdomain:

```txt
A      api    <VPS_IPV4>
```

Do not create a public MinIO or storage subdomain unless the storage architecture is redesigned for public object access.

## Propagation

DNS propagation can take minutes to hours depending on TTL and registrar caching.

Check the apex domain:

```bash
dig +short noirsound.co
```

Check `www`:

```bash
dig +short www.noirsound.co
```

Expected result: the VPS IP appears in the answer.

## HTTP And HTTPS Verification

After the DNS record resolves to the VPS and Caddy is running:

```bash
curl -I http://noirsound.co
curl -I https://noirsound.co
curl -fsS https://noirsound.co/api/ready
```

Expected:

- HTTP redirects or upgrades to HTTPS.
- HTTPS has a valid certificate from Caddy.
- `/api/ready` returns HTTP 200 after all dependencies are healthy.

## Troubleshooting

- If `dig` does not show the VPS IP, wait for DNS propagation or verify the registrar zone.
- If HTTP works but HTTPS does not, check ports 80 and 443 in Hostinger firewall and `ufw`.
- If `/api/ready` fails, run `docker compose -f docker-compose.production.yml --env-file .env.production ps` on the VPS and inspect redacted service logs.
