#!/usr/bin/env python3
"""Production backup and run-owned restore drill. Standard library, existing Compose clients.

Never accepts a restore URL/database/bucket from the caller. No production restore
mode exists. Raw client errors and object names are not emitted to the terminal.
"""
import datetime as dt
import fcntl
import gzip
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import secrets
import selectors
import subprocess
import sys
import tarfile
import tempfile
import time

ROOT = Path(__file__).resolve().parent.parent
os.umask(0o077)
STORAGE_KEYS = ['S3_ENDPOINT','S3_REGION','S3_FORCE_PATH_STYLE','S3_BUCKET','S3_ACCESS_KEY_ID','S3_SECRET_ACCESS_KEY']

class BackupError(Exception):
    pass

def need(ok, message):
    if not ok:
        raise BackupError(message)

def secure_dir(path):
    path = Path(path)
    need(not path.is_symlink(), 'Directory must not be a symlink.')
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    path.chmod(0o700)
    return path

def command(args, *, data=None, label='Client operation', timeout=3600):
    p = subprocess.run(args, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    need(p.returncode == 0, f'{label} failed (exit {p.returncode}); no success receipt was issued.')
    return p.stdout

def stream_command(args, *, source=None, target=None, label='Archive operation', timeout=3600):
    """Bounded-memory pipe transport; never expose or leave an unread stderr pipe.

    GzipFile.fileno() points at compressed bytes, so explicitly decompress in
    fixed chunks before writing stdin. The deadline covers pipe I/O as well as
    process exit; a timeout or copy failure kills and reaps the local client.
    """
    need((source is None) != (target is None), 'Exactly one archive stream required.')
    deadline = time.monotonic() + timeout
    def remaining():
        value = deadline - time.monotonic()
        need(value > 0, f'{label} timed out; no success receipt was issued.')
        return value
    proc = subprocess.Popen(args, stdin=subprocess.PIPE if source is not None else subprocess.DEVNULL,
                            stdout=subprocess.PIPE if target is not None else subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL, bufsize=0)
    pipe = proc.stdin if source is not None else proc.stdout
    try:
        os.set_blocking(pipe.fileno(), False)
        with selectors.DefaultSelector() as selector:
            selector.register(pipe, selectors.EVENT_WRITE if source is not None else selectors.EVENT_READ)
            pending = b''
            while True:
                if source is not None and not pending:
                    remaining()
                    pending = source.read(65536)
                    if not pending: break
                need(selector.select(remaining()), f'{label} timed out; no success receipt was issued.')
                try:
                    if source is not None:
                        pending = pending[os.write(pipe.fileno(), pending):]
                    else:
                        chunk = os.read(pipe.fileno(), 65536)
                        if not chunk: break
                        target.write(chunk)
                except BlockingIOError:
                    continue
                except BrokenPipeError:
                    # pg_restore --list can finish before EOF. Still validate the
                    # complete gzip trailer without buffering the remaining dump.
                    need(proc.wait(timeout=remaining()) == 0, f'{label} failed; no success receipt was issued.')
                    while source.read(65536): remaining()
                    break
        pipe.close()
        need(proc.wait(timeout=remaining()) == 0, f'{label} failed; no success receipt was issued.')
    except subprocess.TimeoutExpired:
        raise BackupError(f'{label} timed out; no success receipt was issued.') from None
    finally:
        if proc.poll() is None: proc.kill()
        proc.wait()
        pipe.close()

def gzip_command(args, archive, *, label):
    with gzip.open(archive, 'rb') as source:
        stream_command(args, source=source, label=label)

def load_env():
    path = Path(os.environ.get('NOIRSOUND_ENV_FILE', str(ROOT / '.env.production')))
    need(path.is_file(), 'Explicit production environment file is required.')
    # dotenv literals only. No source/eval, command substitution or shell execution.
    values = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        m = re.fullmatch(r'(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)', line)
        need(m is not None, 'Unsupported environment-file syntax.')
        value = m[2].strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        value = re.sub(r'\$\{([A-Za-z_][A-Za-z0-9_]*)\}', lambda x: values.get(x[1], os.environ.get(x[1], '')), value)
        values[m[1]] = value
    caller_project = os.environ.get('COMPOSE_PROJECT_NAME')
    need(not (caller_project and values.get('COMPOSE_PROJECT_NAME') and caller_project != values['COMPOSE_PROJECT_NAME']), 'Conflicting Compose project identities.')
    for key in STORAGE_KEYS:
        need(key not in os.environ or key not in values or os.environ[key] == values[key], 'Conflicting caller/file storage configuration; values omitted.')
    for key, value in values.items():
        os.environ.setdefault(key, value)
    return path

def storage_settings(values):
    result = {key:values.get(key, '') for key in STORAGE_KEYS}
    result['S3_REGION'] = result['S3_REGION'] or 'us-east-1'
    result['S3_FORCE_PATH_STYLE'] = 'false' if result['S3_FORCE_PATH_STYLE'] == 'false' else 'true'
    need(all(isinstance(value,str) and value for value in result.values()), 'Explicit storage endpoint, bucket and credentials required; values omitted.')
    return result

def bind_storage(configured, running):
    expected, actual = storage_settings(configured), storage_settings(running)
    need(expected == actual, 'Running backend storage configuration differs from the explicit environment; values omitted.')
    return actual

S3_JS = r'''
const fs = require('node:fs');
const sdk = require('@aws-sdk/client-s3');
const q = JSON.parse(fs.readFileSync(0, 'utf8'));
const e = q.storage;
const s3 = new sdk.S3Client({endpoint:e.S3_ENDPOINT,region:e.S3_REGION,forcePathStyle:e.S3_FORCE_PATH_STYLE!=='false',credentials:{accessKeyId:e.S3_ACCESS_KEY_ID,secretAccessKey:e.S3_SECRET_ACCESS_KEY}});
(async()=>{
 const bucket=q.bucket;
 const tag=async()=> (await s3.send(new sdk.GetBucketTaggingCommand({Bucket:bucket}))).TagSet?.find(t=>t.Key==='noirsound-restore-owner')?.Value;
 let result;
 if(q.action==='buckets') result=(await s3.send(new sdk.ListBucketsCommand({}))).Buckets.map(b=>b.Name);
 else if(q.action==='create') {
   await s3.send(new sdk.CreateBucketCommand({Bucket:bucket})); result={created:true};
 } else if(q.action==='tag') {
   await s3.send(new sdk.PutBucketTaggingCommand({Bucket:bucket,Tagging:{TagSet:[{Key:'noirsound-restore-owner',Value:q.owner}]}}));
   result={owner:await tag()};
 } else if(q.action==='owner') result={owner:await tag()};
 else if(q.action==='list') {
   let token; result=[];
   do {const r=await s3.send(new sdk.ListObjectsV2Command({Bucket:bucket,ContinuationToken:token})); result.push(...(r.Contents||[]).map(o=>({key:o.Key,size:o.Size,etag:o.ETag,last_modified:o.LastModified?.toISOString()})));token=r.IsTruncated?r.NextContinuationToken:undefined;}while(token);
 } else if(q.action==='remove-owned') {
   if(await tag()!==q.owner) throw Error('Ownership mismatch');
   let token;
   do {const r=await s3.send(new sdk.ListObjectsV2Command({Bucket:bucket,ContinuationToken:token})); if(r.Contents?.length){const deleted=await s3.send(new sdk.DeleteObjectsCommand({Bucket:bucket,Delete:{Objects:r.Contents.map(o=>({Key:o.Key}))}}));if(deleted.Errors?.length)throw Error('Object cleanup failed');}token=r.IsTruncated?r.NextContinuationToken:undefined;}while(token);
   await s3.send(new sdk.DeleteBucketCommand({Bucket:bucket}));result={removed:true};
 } else throw Error('Unknown operation');
 console.log(JSON.stringify(result));
})().catch(()=>{console.error('Storage operation failed; values omitted');process.exit(1)}).finally(()=>s3.destroy());
'''

class Clients:
    def __init__(self):
        envfile = load_env()
        os.environ['APP_ENV_FILE'] = str(envfile)
        project = os.environ.get('COMPOSE_PROJECT_NAME', '')
        need(re.fullmatch(r'[a-z0-9][a-z0-9_-]*', project), 'Explicit existing COMPOSE_PROJECT_NAME required.')
        composefile = Path(os.environ.get('COMPOSE_FILE', str(ROOT / 'docker-compose.production.yml'))).resolve()
        self.compose = ['docker', 'compose', '--project-name', project, '-f', str(composefile), '--env-file', str(envfile)]
        self.project = project
        self.user = os.environ.get('POSTGRES_USER', '')
        self.live_db = os.environ.get('POSTGRES_DB', '')
        self.live_bucket = os.environ.get('S3_BUCKET', '')
        need(re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]{0,62}', self.user), 'Invalid PostgreSQL user identifier.')
        need(re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]{0,62}', self.live_db), 'Invalid production database identifier.')
        need(self.live_bucket, 'Production bucket must be explicitly identified.')
        # Do not create a second project or silently point at another database.
        for service in ['postgres', 'backend', 'minio']:
            cid = command(self.compose + ['ps', '-q', service], label='Existing service lookup').decode().strip()
            need(cid and '\n' not in cid, 'Exactly one running existing service required.')
            actual = command(['docker', 'inspect', '-f', '{{index .Config.Labels "com.docker.compose.project"}}', cid]).decode().strip()
            need(actual == project, 'Existing container project identity mismatch.')
            if service == 'backend': self.backend_cid = cid
        db_actual=command(self.compose+['exec','-T','postgres','printenv','POSTGRES_DB'],label='Live database identity').decode().strip()
        user_actual=command(self.compose+['exec','-T','postgres','printenv','POSTGRES_USER'],label='Live database role').decode().strip()
        # Capture only the required tuple privately. Freeze it for both SDK and mc;
        # a later caller override or replacement container cannot select a new store.
        selector = 'JSON.stringify(Object.fromEntries(' + json.dumps(STORAGE_KEYS) + '.map(k=>[k,process.env[k]||""])))'
        running_storage = json.loads(command(['docker','exec',self.backend_cid,'node','-p',selector],label='Live storage identity'))
        self.storage_env = bind_storage(os.environ, running_storage)
        need(db_actual==self.live_db and user_actual==self.user,'Live identifiers differ from the explicit environment; refusing backup/restore.')


    def pg(self, sql, db=None):
        return command(self.compose + ['exec', '-T', 'postgres', 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', self.user, '-d', db or self.live_db, '-At'], data=sql.encode(), label='PostgreSQL query').decode().strip()

    def s3(self, action, bucket=None, owner=None):
        return json.loads(command(['docker','exec','-i',self.backend_cid,'node','-e',S3_JS], data=json.dumps({'action':action,'bucket':bucket,'owner':owner,'storage':self.storage_env}).encode(), label='Storage operation'))

    def mirror(self, directory, bucket, restore=False):
        # Existing image only, same Compose project/network; no public MinIO port.
        script = 'set -eu; mc alias set --path "$MC_PATH_STYLE" ns "$S3_ENDPOINT" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" >/dev/null; '
        script += 'mc mirror --quiet /transfer "ns/$TRANSFER_BUCKET"' if restore else 'mc mirror --quiet "ns/$TRANSFER_BUCKET" /transfer'
        env = dict(os.environ, **self.storage_env, TRANSFER_BUCKET=bucket, MC_PATH_STYLE='off' if self.storage_env['S3_FORCE_PATH_STYLE']=='false' else 'on')
        args = self.compose + ['run', '--rm', '--no-deps', '--pull', 'never', '-T', '-e', 'S3_ENDPOINT', '-e', 'S3_ACCESS_KEY_ID', '-e', 'S3_SECRET_ACCESS_KEY', '-e', 'MC_PATH_STYLE', '-e', 'TRANSFER_BUCKET', '-v', f'{directory}:/transfer' + (':ro' if restore else ''), '--entrypoint', '/bin/sh', 'minio-create-bucket', '-c', script]
        result = subprocess.run(args, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=3600)
        need(result.returncode == 0, 'Storage transfer failed; object names omitted.')


def digest(path):
    with Path(path).open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest() if hasattr(hashlib, 'file_digest') else hashlib.sha256(f.read()).hexdigest()

def archive_manifest(path):
    result = []
    with tarfile.open(path, 'r:gz') as archive:
        for item in archive:
            name = PurePosixPath(item.name)
            need(not name.is_absolute() and '..' not in name.parts and not item.issym() and not item.islnk(), 'Unsafe storage archive member.')
            need(item.isdir() or item.isfile(), 'Non-file storage archive member rejected.')
            if item.isfile():
                stream = archive.extractfile(item)
                result.append({'key':str(name), 'size':item.size, 'sha256':hashlib.sha256(stream.read()).hexdigest()})
    need(len({item['key'] for item in result}) == len(result), 'Duplicate storage archive member.')
    return sorted(result, key=lambda x:x['key'])

def source_inventory(clients):
    result = clients.s3('list',clients.live_bucket)
    need(isinstance(result,list), 'Invalid source storage inventory.')
    for item in result:
        key = item.get('key')
        need(isinstance(key,str) and key and str(PurePosixPath(key))==key and not PurePosixPath(key).is_absolute() and '..' not in PurePosixPath(key).parts, 'Storage key cannot be represented safely in a backup; values omitted.')
        need(type(item.get('size')) is int and item['size']>=0 and isinstance(item.get('etag'),str) and isinstance(item.get('last_modified'),str), 'Incomplete source storage inventory.')
    need(len({item['key'] for item in result})==len(result),'Duplicate source inventory key.')
    return sorted(result,key=lambda item:item['key'])

def verify_storage_snapshot(before, after, objects):
    need(before == after,'Source objects changed during backup; retry a quiet snapshot.')
    expected = [{'key':item['key'],'size':item['size']} for item in before]
    actual = [{'key':item['key'],'size':item['size']} for item in objects]
    need(actual == expected,'Storage archive differs from the verified source key/size inventory.')

def write_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2) + '\n')
    Path(path).chmod(0o600)

COUNT_TABLES = ['User','ArtistProfile','CreatorRegistration','Track','Upload','Report','_prisma_migrations']

def table_counts(clients, db=None):
    # One READ ONLY transaction gives the aggregate set one database snapshot.
    query = "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;\n" + "\n".join(f'SELECT json_build_object(\'table\',\'{t}\',\'count\',count(*)) FROM "{t}";' for t in COUNT_TABLES) + "\nCOMMIT;"
    result = clients.pg(query, db)
    return {x['table']:x['count'] for line in result.splitlines() if line.startswith('{') for x in [json.loads(line)]}

def verify_offsite(directory, manifest, archives):
    hook = os.environ.get('OFFSITE_BACKUP_VERIFY_SCRIPT', '')
    if not hook:
        print(json.dumps({'offsite':'BLOCKED — PROVIDER/DESTINATION NOT AUTHORIZED'}))
        return
    executable = Path(hook)
    need(executable.is_absolute() and executable.is_file() and not executable.is_symlink() and os.access(executable,os.X_OK), 'Configured offsite verifier must be an explicit executable file.')
    need(executable.stat().st_uid == os.geteuid() and executable.stat().st_mode & 0o022 == 0, 'Offsite verifier must be operator-owned and not group/world writable.')
    release = os.environ.get('RELEASE_SHA', '')
    if not release:
        source_root = os.environ.get('NOIRSOUND_SOURCE_ROOT',str(ROOT))
        release = command(['git','-C',source_root,'rev-parse','HEAD'], label='Backup source identity').decode().strip()
    need(re.fullmatch('[0-9a-f]{40}',release), 'Exact source release identity required for offsite receipt.')
    sums = directory / (manifest.stem + '.sha256')
    sums.write_text(''.join(f'{digest(p)}  {p.name}\n' for p in [*archives,manifest]))
    checksum_hash=digest(sums)
    receipt = directory / (manifest.stem + '.offsite.txt')
    private_log = directory / (manifest.stem + '.offsite.log')
    env = dict(os.environ,RELEASE_SHA=release)
    with private_log.open('xb') as output:
        status=subprocess.run([str(executable),str(directory),str(sums),str(receipt)],stdout=output,stderr=output,env=env,timeout=3600).returncode
    need(status == 0 and receipt.is_file(), 'Configured private offsite verification failed; local archives retained.')
    lines=receipt.read_text().splitlines()
    expected=['version=1','release_sha='+release,'checksum_sha256='+checksum_hash,'offsite_verified=true','private_storage_verified=true']
    need(len(lines)==6 and all(lines.count(x)==1 for x in expected) and sum(bool(re.fullmatch('backup_reference=[A-Za-z0-9][A-Za-z0-9._-]{0,127}',x)) for x in lines)==1,'Offsite receipt did not attest this exact private backup.')
    need(digest(sums)==checksum_hash,'Checksum manifest changed during offsite verification.')
    for path in [*archives,manifest]:
        need(f'{digest(path)}  {path.name}' in sums.read_text().splitlines(),'Backup changed during offsite verification.')
    print(json.dumps({'offsite':'VERIFIED','receipt':receipt.name}))

def verified_archive_pair(manifest):
    """Legacy, incomplete, cross-run, changed and symlink sets have no deletion authority."""
    match = re.fullmatch(r'manifest_([0-9]{8}T[0-9]{6}[0-9a-f]{8}Z)\.txt',manifest.name)
    if not match or manifest.is_symlink() or not manifest.is_file(): return None
    try:
        data = json.loads(manifest.read_text())
        names = [f'postgres_{match[1]}.dump.gz',f'storage_{match[1]}.tar.gz']
        if data.get('version') != 1 or set(data.get('archives',{})) != set(names): return None
        paths = [manifest.parent/name for name in names]
        for path in paths:
            expected = data['archives'][path.name]
            if path.is_symlink() or not path.is_file() or expected.get('bytes') != path.stat().st_size or expected.get('sha256') != digest(path): return None
        return paths
    except (ValueError, OSError, TypeError, AttributeError):
        return None

def prune_backups(directory, days):
    need(7 <= days <= 3650, 'Retention must be 7..3650 days.')
    # Classify complete verified pairs BEFORE protecting the newest three. An
    # incomplete or forged manifest can neither displace them nor name their files.
    candidates = [(p,verified_archive_pair(p)) for p in directory.glob('manifest_*.txt')]
    candidates = sorted(((p,paths) for p,paths in candidates if paths),key=lambda item:item[0].stat().st_mtime,reverse=True)
    for old,paths in candidates[3:]:
        if old.stat().st_mtime >= dt.datetime.now().timestamp() - days * 86400: continue
        if verified_archive_pair(old) != paths: continue
        for path in paths: path.unlink()
        for suffix in ['.offsite.txt','.offsite.log','.sha256']:
            sibling=directory/(old.stem+suffix)
            if sibling.is_file() and not sibling.is_symlink(): sibling.unlink()
        old.unlink()

def backup(clients, directory, kind='all'):
    directory = secure_dir(directory)
    stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S') + secrets.token_hex(4) + 'Z'
    # Unique name plus O_EXCL makes concurrent calls unable to overwrite archives.
    pg = directory / f'postgres_{stamp}.dump.gz'
    storage = directory / f'storage_{stamp}.tar.gz'
    manifest = directory / f'manifest_{stamp}.txt'
    paths = []
    expected_counts = table_counts(clients) if kind in ['all','postgres'] else {}
    need(not expected_counts or len(expected_counts)==len(COUNT_TABLES),'Incomplete source aggregate snapshot.')
    if kind in ['all', 'postgres']:
        partial = Path(str(pg)+'.partial')
        with partial.open('xb') as raw:
            with gzip.GzipFile(fileobj=raw, mode='wb') as compressed:
                stream_command(clients.compose + ['exec', '-T', 'postgres', 'pg_dump', '--format=custom', '--no-owner', '--no-privileges', '-U', clients.user, clients.live_db], target=compressed, label='Database archive export')
        gzip_command(clients.compose + ['exec', '-T', 'postgres', 'pg_restore', '--list'], partial, label='Database archive readability')
        need(table_counts(clients)==expected_counts,'Source aggregate counts changed during database backup; retry a quiet snapshot.')
        partial.rename(pg); paths.append(pg)
    objects = []
    inventory = []
    if kind in ['all', 'storage']:
        inventory = source_inventory(clients)
        with tempfile.TemporaryDirectory(prefix='noirsound-backup-', dir=directory) as staging:
            clients.mirror(staging, clients.live_bucket)
            partial = Path(str(storage)+'.partial')
            with tarfile.open(partial, 'x:gz') as archive:
                archive.add(staging, arcname='.', recursive=True)
            objects = archive_manifest(partial)
            verify_storage_snapshot(inventory,source_inventory(clients),objects)
            partial.rename(storage); paths.append(storage)
    migration_sql = '''SELECT COALESCE(json_agg(m),'[]'::json) FROM (SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at) m;'''
    migrations = json.loads(clients.pg(migration_sql)) if kind in ['all', 'postgres'] else []
    result = {'version':1,'timestamp_utc':dt.datetime.now(dt.timezone.utc).isoformat(),'compose_project':clients.project,'applied_migrations_observed_at_backup':migrations,'archives':{p.name:{'sha256':digest(p),'bytes':p.stat().st_size} for p in paths},'storage_objects':objects,'storage_object_count':len(objects),'source_storage_inventory':inventory,'table_counts':expected_counts}
    write_json(manifest, result)
    for path in paths: path.chmod(0o600)
    print(json.dumps({'backup':'VERIFIED_ARCHIVES','reference':stamp,'archive_count':len(paths),'storage_object_count':len(objects),'permissions':'0700/0600'}))
    if kind=='all': verify_offsite(directory,manifest,paths)
    prune_backups(directory,int(os.environ.get('NOIRSOUND_BACKUP_RETENTION_DAYS', '14')))
    return pg, storage, manifest


def validate_targets(run_id, db, bucket, live_db, live_bucket):
    need(re.fullmatch(r'[0-9a-f]{24}', run_id), 'Generated restore run identity required.')
    need(db == f'ns_{run_id}_restore_test' and db != live_db, 'Unsafe or non-generated restore database.')
    need(bucket == f'ns-{run_id}-restore-test' and bucket != live_bucket, 'Unsafe or non-generated restore bucket.')

def restore(clients, directory):
    need(os.environ.get('NOIRSOUND_RESTORE_TEST') == '1', 'Explicit NOIRSOUND_RESTORE_TEST=1 required.')
    # Legacy arbitrary restore overrides are rejected, never interpreted.
    need(not any(os.environ.get(k) for k in ['DRILL_DATABASE_URL','DRILL_S3_BUCKET','RESTORE_DATABASE_URL','RESTORE_S3_BUCKET','NOIRSOUND_ALLOW_PROD_RESTORE']), 'Arbitrary or production restore override rejected.')
    pg = Path(os.environ.get('DRILL_POSTGRES_BACKUP', ''))
    storage = Path(os.environ.get('DRILL_STORAGE_BACKUP', ''))
    manifest = Path(os.environ.get('DRILL_MANIFEST', ''))
    need(pg.is_file() and storage.is_file() and manifest.is_file(), 'Explicit fresh archive pair and integrity manifest required.')
    meta = json.loads(manifest.read_text())
    for path in [pg, storage]:
        expected = meta.get('archives',{}).get(path.name,{})
        need(expected.get('sha256') == digest(path) and expected.get('bytes') == path.stat().st_size, 'Backup integrity manifest mismatch.')
    objects = archive_manifest(storage)
    need(objects == meta.get('storage_objects'), 'Storage manifest mismatch.')
    inventory = meta.get('source_storage_inventory')
    need(isinstance(inventory,list),'Verified source storage inventory is required; take a new backup.')
    verify_storage_snapshot(inventory,inventory,objects)
    gzip_command(clients.compose + ['exec','-T','postgres','pg_restore','--list'], pg, label='Archive preflight')
    run_id = secrets.token_hex(12)
    db, bucket = f'ns_{run_id}_restore_test', f'ns-{run_id}-restore-test'
    validate_targets(run_id, db, bucket, clients.live_db, clients.live_bucket)
    need(clients.pg(f"SELECT 1 FROM pg_database WHERE datname='{db}';") == '', 'Pre-existing restore database rejected.')
    need(bucket not in clients.s3('buckets'), 'Pre-existing restore bucket rejected.')
    live_counts_before, live_inventory_before = table_counts(clients), source_inventory(clients)
    need(len(live_counts_before)==len(COUNT_TABLES),'Incomplete production aggregate snapshot before restore.')
    receipt = secure_dir(directory) / f'restore_{run_id}.json'
    db_created = bucket_created = False
    result = {'run_id':run_id,'database':db,'bucket':bucket,'restore':'FAILED','cleanup':'NOT RUN','production_unchanged':'NOT VERIFIED'}
    error = None
    try:
        clients.pg(f'CREATE DATABASE "{db}";')
        db_created = True
        clients.pg(f"COMMENT ON DATABASE \"{db}\" IS 'noirsound-restore:{run_id}';")
        created = clients.s3('create',bucket,run_id)
        need(created.get('created') is True, 'Restore bucket creation failed.')
        bucket_created = True
        tagged = clients.s3('tag',bucket,run_id)
        need(tagged.get('owner') == run_id, 'Restore bucket ownership attestation failed.')
        gzip_command(clients.compose+['exec','-T','postgres','pg_restore','--exit-on-error','--no-owner','--no-privileges','-U',clients.user,'-d',db],pg,label='Isolated database restore')
        counts = table_counts(clients,db)
        need(counts==meta.get('table_counts') and len(counts)==len(COUNT_TABLES),'Restored aggregates do not match verified backup snapshot.')
        migrations = json.loads(clients.pg('SELECT COALESCE(json_agg(m),\'[]\'::json) FROM (SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at) m;',db))
        need(migrations == meta['applied_migrations_observed_at_backup'], 'Restored migration metadata differs from backup observation.')
        with tempfile.TemporaryDirectory(prefix='noirsound-restore-',dir=secure_dir(directory)) as staging:
            with tarfile.open(storage,'r:gz') as archive:
                # archive_manifest already rejects links, absolute paths and traversal.
                archive.extractall(staging, members=archive.getmembers())
            need(clients.s3('owner',bucket).get('owner') == run_id, 'Restore ownership changed before transfer.')
            clients.mirror(staging,bucket,restore=True)
            # Read restored objects back and hash content, not only object count.
            with tempfile.TemporaryDirectory(prefix='noirsound-readback-',dir=directory) as readback:
                clients.mirror(readback,bucket)
                actual = sorted([{'key':p.relative_to(readback).as_posix(),'size':p.stat().st_size,'sha256':digest(p)} for p in Path(readback).rglob('*') if p.is_file()],key=lambda x:x['key'])
                need(actual == objects, 'Restored storage content mismatch.')
        result.update(restore='VERIFIED',table_counts=counts,migration_count=len(migrations),storage_object_count=len(objects))
    except Exception as exc:
        error = exc
    finally:
        clean = True
        if bucket_created:
            try: clients.s3('remove-owned',bucket,run_id)
            except Exception: clean=False
        if db_created:
            try:
                marker=clients.pg(f"SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname='{db}';")
                need(marker == f'noirsound-restore:{run_id}', 'Database ownership changed; cleanup refused.')
                validate_targets(run_id,db,bucket,clients.live_db,clients.live_bucket)
                clients.pg(f'DROP DATABASE "{db}";')
            except Exception: clean=False
        result['cleanup']='VERIFIED' if clean else 'FAILED — owned resources may remain'
        try:
            live_counts_after, live_inventory_after = table_counts(clients), source_inventory(clients)
            unchanged = live_counts_before==live_counts_after and live_inventory_before==live_inventory_after
            result['production_unchanged']='VERIFIED' if unchanged else 'FAILED — source changed during drill; cause not established'
            result['production_storage_object_count_before']=len(live_inventory_before)
            result['production_storage_object_count_after']=len(live_inventory_after)
            result['production_table_counts_before']=live_counts_before
            result['production_table_counts_after']=live_counts_after
        except Exception:
            unchanged=False
            result['production_unchanged']='FAILED — source recheck unavailable'
        if not unchanged: result['restore']='FAILED'
        write_json(receipt,result)
        print(json.dumps(result))
        need(clean,'Restore cleanup failed; inspect private receipt and run-owned resources.')
        need(unchanged,'Production aggregates or object inventory changed/unavailable during drill; no overall restore success attested.')
    if error: raise error
    return result


def main():
    need(len(sys.argv)==2,'Only a named operation is accepted; arbitrary restore destinations are forbidden.')
    action = sys.argv[1]
    need(action in ['all','postgres','storage','restore'], 'Unknown backup action.')
    # Restore opt-in/override rejection occurs before any external service command.
    if action == 'restore':
        need(os.environ.get('NOIRSOUND_RESTORE_TEST') == '1', 'Explicit NOIRSOUND_RESTORE_TEST=1 required.')
        need(not any(os.environ.get(k) for k in ['DRILL_DATABASE_URL','DRILL_S3_BUCKET','RESTORE_DATABASE_URL','RESTORE_S3_BUCKET','NOIRSOUND_ALLOW_PROD_RESTORE']), 'Arbitrary or production restore override rejected.')
    clients=Clients()
    directory=secure_dir(os.environ.get('NOIRSOUND_BACKUP_DIR',str(ROOT/'backups')))
    # All entry points and scheduled/deploy calls share one lock outside per-run dirs.
    explicit_lock=os.environ.get('NOIRSOUND_BACKUP_LOCK')
    lockpath=Path(explicit_lock) if explicit_lock else secure_dir(ROOT/'backups')/'.operation.lock'
    with lockpath.open('a') as lock:
        try: fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError: raise BackupError('Another backup/restore holds the lock.')
        if action=='restore':restore(clients,directory)
        else:backup(clients,directory,action)

if __name__=='__main__':
    try:main()
    except (BackupError, ValueError, OSError, subprocess.SubprocessError) as exc:
        # Operational errors may include sensitive command args/URLs: only our
        # explicitly safe validation messages are emitted.
        print('ERROR: '+(str(exc) if isinstance(exc,BackupError) else type(exc).__name__+'; details omitted'),file=sys.stderr)
        sys.exit(1)
