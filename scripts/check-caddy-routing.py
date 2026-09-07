#!/usr/bin/env python3
"""Functional production Caddy routing checks using only generated local containers."""
import json
import os
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
import urllib.request
import urllib.error

root=Path(__file__).resolve().parent.parent
prefix='noirsound-caddy-test-'+secrets.token_hex(5)
image=os.environ.get('CADDY_TEST_IMAGE','caddy:2.11.4-alpine')
created=[];network=False

def cmd(args):return subprocess.check_output(args,stderr=subprocess.PIPE,text=True).strip()
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):return None

def request(port,path,host='noirsound.test'):
    r=urllib.request.Request(f'http://127.0.0.1:{port}{path}',headers={'Host':host})
    try:
        with urllib.request.build_opener(NoRedirect).open(r,timeout=5) as response:return response.status,dict(response.headers),response.read().decode()
    except urllib.error.HTTPError as response:return response.code,dict(response.headers),response.read().decode()

try:
    with tempfile.TemporaryDirectory(prefix=prefix) as folder:
        p=Path(folder);(p/'assets').mkdir();(p/'assets/test.js').write_text('window.test=true;');(p/'index.html').write_text('<!doctype html><html><body>SPA shell</body></html>')
        source=(root/'Caddyfile').read_text().replace('www.{$DOMAIN:localhost} {','http://www.noirsound.test {').replace('{$DOMAIN::80} {','http://noirsound.test {')
        (p/'Caddyfile').write_text(source)
        (p/'Backend').write_text('''{
 admin off
}
:3000 {
 @api path /api/*
 handle @api {
  header Content-Type application/json
  header Content-Security-Policy "default-src 'none'; frame-ancestors 'none'"
  respond `{ "error":"Unauthorized" }` 401
 }
 handle {
  header Content-Type text/html
  respond "<html>SSR route</html>" 200
 }
}
''')
        cmd(['docker','network','create',prefix]);network=True
        cmd(['docker','run','-d','--rm','--name',prefix+'-backend','--network',prefix,'--network-alias','backend','-v',str(p/'Backend')+':/etc/caddy/Caddyfile:ro',image]);created.append(prefix+'-backend')
        cmd(['docker','run','-d','--rm','--name',prefix+'-web','--network',prefix,'-p','127.0.0.1::80','-e','DOMAIN=noirsound.test','-e','S3_BUCKET=noirsound-audio','-v',str(p/'Caddyfile')+':/etc/caddy/Caddyfile:ro','-v',str(p)+':/srv:ro',image]);created.append(prefix+'-web')
        port=cmd(['docker','port',prefix+'-web','80/tcp']).rsplit(':',1)[1]
        for _ in range(30):
            try:request(port,'/home');break
            except OSError:time.sleep(.1)
        results=[]
        for path in ['/.env','/.git/config','/docker-compose.production.yml','/backup.sql','/private.pem','/reports/private.md','/backups/db.tar.gz']:
            status,headers,body=request(port,path);assert status==404,(path,status);assert 'SPA shell' not in body;results.append([path,status])
        for path in ['/home','/admin/reports','/assets/test.js']:
            status,headers,body=request(port,path);assert status==200,(path,status);results.append([path,status])
        status,headers,body=request(port,'/api/reports');assert status==401;assert headers.get('Content-Security-Policy')=="default-src 'none'; frame-ancestors 'none'";results.append(['/api/reports',status])
        for path in ['/','/home','/admin/reports','/robots.txt','/sitemap.xml']:
            status,headers,body=request(port,path);assert status==200;assert 'script-src' in headers.get('Content-Security-Policy',''),(path,headers)
        status,headers,body=request(port,'/creator-rules?from=test','www.noirsound.test');assert status==308;assert headers.get('Location')=='https://noirsound.test/creator-rules?from=test';results.append(['www preserve path/query',status])
        # A legitimate media path reaches its upstream (absent fixture upstream
        # yields502). It must not be intercepted by the sensitive-file404 rule.
        status,_,_=request(port,'/noirsound-audio/test.wav');assert status==502;results.append(['storage .wav reaches proxy',status])
        print(json.dumps({'result':'PASS','checks':results,'html_csp':'present','api_csp':'preserved','production_mutation':False}))
finally:
    for name in reversed(created):
        subprocess.run(['docker','stop',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=False)
    if network:subprocess.run(['docker','network','rm',prefix],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=False)
