#!/usr/bin/env python3
"""Local production-image HTTP routing check. DB/storage are explicit fixtures.
Run after docker build -t noirsound-landing-web:local . and
 docker build -t noirsound-landing-backend:local ./backend.
No database/service credentials or environment files are used.
"""
import json, re, subprocess, tempfile, time, urllib.error, urllib.parse, urllib.request, uuid
from pathlib import Path

root = Path(__file__).resolve().parents[2]
out = root / 'artifacts/landing/production-http'
out.mkdir(parents=True, exist_ok=True)
token = uuid.uuid4().hex[:12]
network = f'noirsound-landing-http-{token}'
web = f'{network}-web'
backend = f'{network}-backend'
evidence = {'scope': 'Production Docker images and Caddy routing with explicit DB/storage fixtures; no persistence verification', 'checks': []}

def command(*args):
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode: raise RuntimeError(f'{args[0]} {args[1]} failed: {result.stderr}')
    return result.stdout.strip()

def check(condition, label):
    if not condition: raise AssertionError(label)
    evidence['checks'].append({'check': label, 'status': 'PASS'})

fixture = """const crypto = require('node:crypto');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.COOKIE_SECRET = crypto.randomBytes(32).toString('hex');
process.env.FRONTEND_ORIGIN = 'https://noirsound-preview.example.invalid';
const buildServer = require('/app/src/index');
const track = { id: 'http-track', title: 'HTTP routing fixture release', status: 'PUBLISHED', isPublic: true, artist: { user: { displayName: 'HTTP fixture creator' } } };
const artist = { id: 'http-artist', user: { displayName: 'HTTP fixture artist' } };
const playlist = { id: 'http-playlist', name: 'HTTP fixture playlist', creator: { displayName: 'HTTP fixture creator' } };
const model = value => ({findFirst: async () => value, findMany: async () => []});
const app = buildServer({ prisma: {track:model(track),artistProfile:model(artist),playlist:model(playlist)}, storage: {getObjectMetadata:async()=>({exists:false})}, audioQueue:{}, rateLimitRedis:null });
app.listen({host:'0.0.0.0',port:3000}).catch(error=>{console.error(error.message);process.exit(1)});
"""
try:
    with tempfile.TemporaryDirectory(prefix='noirsound-http-') as scratch:
        fixture_path = Path(scratch) / 'server.cjs'
        fixture_path.write_text(fixture)
        command('docker','network','create',network)
        command('docker','run','--detach','--rm','--name',backend,'--network',network,'--network-alias','backend','--mount',f'type=bind,source={fixture_path},target=/tmp/http-fixture.cjs,readonly','noirsound-landing-backend:local','node','/tmp/http-fixture.cjs')
        command('docker','run','--detach','--rm','--name',web,'--network',network,'--network-alias','web','--publish','127.0.0.1::80','noirsound-landing-web:local')
        port = command('docker','port',web,'80/tcp').rsplit(':',1)[1]
        base = f'http://127.0.0.1:{port}'
        evidence['baseUrl'] = base
        def get(path):
            with urllib.request.urlopen(base+path, timeout=10) as response:
                return response.status, dict(response.headers), response.read()
        for attempt in range(30):
            try:
                status, headers, body = get('/')
                if b'/assets/' in body: break
            except Exception:
                time.sleep(0.3)
        else: raise RuntimeError('Docker HTTP listener did not become ready')
        root_html = body.decode()
        (out/'root.html').write_text(root_html)
        check(status == 200 and headers.get('X-Noirsound-Ssr') == '1', 'Root is served through the backend metadata renderer')
        check('<h1>Your sound.</h1>' in root_html and 'href="/upload"' in root_html and 'href="/discover?content=BEAT"' in root_html, 'Initial root HTML includes readable main content and real CTAs without JavaScript')
        check(root_html.count('<title>') == 1 and root_html.count('rel="canonical"') == 1 and root_html.count('property="og:title"') == 1 and root_html.count('name="twitter:title"') == 1, 'Root metadata has no duplicate managed tags')
        check('<title>NoirSound — your sound</title>' in root_html, 'Root landing title is correct')
        assets = list(dict.fromkeys(re.findall(r'(?:src|href)="(/assets/[^"]+)"',root_html)))
        check(bool(assets), 'Root points at the production hashed web build')
        for asset in assets:
            asset_status, asset_headers, content = get(asset)
            check(asset_status == 200 and content and b'<!doctype html>' not in content[:100].lower(), f'Built asset resolves: {asset}')
        evidence['assets'] = assets
        for path, expected in [('/discover?content=MUSIC','Music — Discover | NoirSound'),('/discover?content=BEAT','Beats — Discover | NoirSound'),('/track/http-track','HTTP routing fixture release'),('/artist/http-artist','HTTP fixture artist'),('/playlist/http-playlist','HTTP fixture playlist'),('/terms','Terms of Service — NoirSound')]:
            status, headers, body = get(path)
            html = body.decode()
            check(status == 200 and headers.get('X-Noirsound-Ssr') == '1' and expected in html and 'landing-initial' not in html, f'Correct metadata, current shell, and no landing content: {path}')
            check(all(asset in html for asset in assets), f'Current bundle preserved: {path}')
        for path in ['/home','/upload?landingDraft=1','/upload/batch','/profile?tab=settings','/admin']:
            status, headers, body = get(path)
            check(status == 200 and 'landing-initial' not in body.decode() and all(asset in body.decode() for asset in assets), f'SPA deep link refresh resolves: {path}')
        status, headers, body = get('/og/noirsound-cover.png')
        check(status == 200 and body.startswith(bytes.fromhex('89504e470d0a1a0a')), 'Root OG image is publicly accessible PNG data')
        status, headers, body = get('/robots.txt')
        check(status == 200 and b'Sitemap:' in body, 'robots.txt remains available')
        status, headers, body = get('/sitemap.xml')
        check(status == 200 and b'<urlset' in body and b'/discover</loc>' in body, 'Dynamic public sitemap remains available')
        status, headers, body = get('/api/tracks/showcase')
        check(status == 200 and json.loads(body) == {'data': {'MUSIC': [], 'BEAT': []}}, 'Same-origin showcase API returns an honest empty fixture catalog')
        check(headers.get('X-Content-Type-Options') == 'nosniff' and headers.get('X-Frame-Options') == 'DENY', 'Existing security headers remain applied')
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, request, fp, code, message, headers, new_url):
                return None
        redirect_reader = urllib.request.build_opener(NoRedirect)
        for intent in ['/\n/redirect.example.invalid', '/\r/redirect.example.invalid', '/\t/redirect.example.invalid', '/upload?landingDraft=1']:
            # Read the redirect response without following it to another host.
            try:
                redirect_reader.open(base+'/api/auth/google?'+urllib.parse.urlencode({'returnTo':intent}),timeout=10)
                raise AssertionError('Expected OAuth redirect response')
            except urllib.error.HTTPError as response:
                target = urllib.parse.urlsplit(response.headers.get('Location',''))
                expected_path = '/upload' if intent.startswith('/upload') else '/'
                check(response.code == 302 and target.scheme == 'https' and target.netloc == 'noirsound-preview.example.invalid' and target.path == expected_path, f'Built backend OAuth return stays on configured origin: {intent!r}')
        # Simulate an atomically replaced web build shell in this disposable
        # container. The real Caddy ETag must invalidate the backend cache now,
        # without waiting for the former 60-second TTL or restarting the API.
        source_shell = command('docker','exec',web,'cat','/srv/index.html')
        original_script = re.search(r'<script[^>]+src="(/assets/[^\"]+\.js)"',source_shell).group(1)
        refreshed_script = '/assets/http-refreshed-bundle.js'
        command('docker','exec',web,'cp',f'/srv{original_script}',f'/srv{refreshed_script}')
        refreshed_shell = Path(scratch)/'index.html'
        refreshed_shell.write_text(source_shell.replace(original_script,refreshed_script))
        command('docker','cp',str(refreshed_shell),f'{web}:/srv/index.html')
        status, headers, body = get('/')
        check(status == 200 and refreshed_script in body.decode() and original_script not in body.decode(), 'Changed web shell is used immediately through real Caddy ETag revalidation')
        check(get(refreshed_script)[0] == 200, 'Revalidated shell bundle URL remains accessible')
        evidence['status'] = 'PASS'
finally:
    for name in [web, backend]:
        subprocess.run(['docker','stop','--time','3',name],capture_output=True)
    subprocess.run(['docker','network','rm',network],capture_output=True)
    evidence.setdefault('status','FAIL')
    (out/'summary.json').write_text(json.dumps(evidence,indent=2)+'\n')
    print(json.dumps(evidence,indent=2))
