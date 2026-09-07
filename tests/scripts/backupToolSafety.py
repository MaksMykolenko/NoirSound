"""Destructive-operation guards exercised without Docker or real databases."""
import gzip
import hashlib
import io
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys
import time
import tracemalloc
import tarfile
import tempfile
import unittest
from unittest.mock import patch
sys.dont_write_bytecode = True
spec=importlib.util.spec_from_file_location('backup_tool',Path(__file__).resolve().parents[2]/'scripts/backup-tool.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
RUN='a'*24

class FakeClients:
    live_db='production';live_bucket='production-audio';compose=['stub']
    user='postgres';project='noirsound-test'
    def __init__(self):
        self.calls=[];self.db=None;self.owner=None;self.bucket=None;self.marker=None
        self.existing_db=False;self.existing_bucket=False;self.fail_restore=False;self.fail_create=False;self.changed_owner=False
        self.inventory=[{'key':'track.txt','size':15,'etag':'"fixture"','last_modified':'2026-09-07T00:00:00.000Z'}]
        self.live_counts={t:1 for t in m.COUNT_TABLES}
    def pg(self,sql,db=None):
        self.calls.append(('pg',sql,db))
        if 'SELECT 1 FROM pg_database' in sql:return '1' if self.existing_db else ''
        if 'CREATE DATABASE' in sql:
            if self.fail_create:raise m.BackupError('create failed')
            self.db=sql.split('"')[1];return ''
        if 'COMMENT ON DATABASE' in sql:self.marker=f'noirsound-restore:{RUN}';return ''
        if 'shobj_description' in sql:return 'unrelated' if self.changed_owner else self.marker
        if 'DROP DATABASE' in sql:
            assert self.db.endswith('_restore_test') and self.db!=self.live_db
            self.db=None;return ''
        if 'count(*)' in sql:return '\n'.join(json.dumps({'table':t,'count':self.live_counts[t] if db is None else 1}) for t in m.COUNT_TABLES)
        if 'json_agg' in sql:return '[]'
        raise AssertionError(sql)
    def s3(self,action,bucket=None,owner=None):
        self.calls.append(('s3',action,bucket))
        if action=='buckets':return [f'ns-{RUN}-restore-test'] if self.existing_bucket else [self.live_bucket]
        if action=='list':return [dict(item) for item in self.inventory]
        if action=='create':self.bucket=bucket;return {'created':True}
        if action=='tag':self.owner=owner;return {'owner':owner}
        if action=='owner':return {'owner':'unrelated' if self.changed_owner else self.owner}
        if action=='remove-owned':
            if self.changed_owner:raise m.BackupError('owner changed')
            assert self.owner==owner and bucket!=self.live_bucket
            self.bucket=None;return {'removed':True}
        raise AssertionError(action)
    def mirror(self,directory,bucket,restore=False):
        self.calls.append(('mirror',bucket,restore))
        if self.fail_restore:raise m.BackupError('restore failed')
        if not restore:Path(directory,'track.txt').write_text('owned test data')

class RestoreSafety(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.directory=Path(self.tmp.name)
        self.pg=self.directory/'postgres_fixture.dump.gz';self.pg.write_bytes(gzip.compress(b'PGDMPfixture'))
        self.storage=self.directory/'storage_fixture.tar.gz';src=self.directory/'source';src.mkdir();(src/'track.txt').write_text('owned test data')
        with tarfile.open(self.storage,'w:gz') as t:t.add(src,arcname='.')
        self.manifest=self.directory/'manifest_fixture.txt'
        m.write_json(self.manifest,{'archives':{p.name:{'sha256':m.digest(p),'bytes':p.stat().st_size} for p in [self.pg,self.storage]},'storage_objects':m.archive_manifest(self.storage),'source_storage_inventory':FakeClients().inventory,'applied_migrations_observed_at_backup':[],'table_counts':{t:1 for t in m.COUNT_TABLES}})
        self.environment=patch.dict(os.environ,{'NOIRSOUND_RESTORE_TEST':'1','DRILL_POSTGRES_BACKUP':str(self.pg),'DRILL_STORAGE_BACKUP':str(self.storage),'DRILL_MANIFEST':str(self.manifest)},clear=True);self.environment.start()
        self.random=patch.object(m.secrets,'token_hex',return_value=RUN);self.random.start()
        self.client_command=patch.object(m,'gzip_command',return_value=None);self.client_command.start()
        self.c=FakeClients()
    def tearDown(self):
        self.client_command.stop();self.random.stop();self.environment.stop();self.tmp.cleanup()
    def no_mutations(self):
        self.assertFalse(any(x[0]=='pg' and ('CREATE DATABASE' in x[1] or 'DROP DATABASE' in x[1]) or x[0]=='s3' and x[1] in ['create','tag','remove-owned'] for x in self.c.calls))
    def test_no_optin(self):
        os.environ.pop('NOIRSOUND_RESTORE_TEST')
        with self.assertRaises(m.BackupError):m.restore(self.c,self.directory)
        self.no_mutations()
    def test_arbitrary_and_production_overrides_rejected(self):
        for key in ['DRILL_DATABASE_URL','DRILL_S3_BUCKET','RESTORE_DATABASE_URL','RESTORE_S3_BUCKET','NOIRSOUND_ALLOW_PROD_RESTORE']:
            with self.subTest(key=key),patch.dict(os.environ,{key:'production'}):
                with self.assertRaises(m.BackupError):m.restore(self.c,self.directory)
                self.no_mutations()
    def test_live_identifier_collision_rejected(self):
        self.c.live_db=f'ns_{RUN}_restore_test'
        with self.assertRaises(m.BackupError):m.restore(self.c,self.directory)
        self.no_mutations()
    def test_preexisting_database(self):
        self.c.existing_db=True
        with self.assertRaises(m.BackupError):m.restore(self.c,self.directory)
        self.no_mutations()
    def test_preexisting_bucket(self):
        self.c.existing_bucket=True
        with self.assertRaises(m.BackupError):m.restore(self.c,self.directory)
        self.no_mutations()
    def test_tampered_archive(self):
        self.pg.write_bytes(gzip.compress(b'other data'))
        with self.assertRaises(m.BackupError):m.restore(self.c,self.directory)
        self.no_mutations()
    def test_failed_creation_never_grants_cleanup(self):
        self.c.fail_create=True
        with self.assertRaises(m.BackupError):m.restore(self.c,self.directory)
        self.assertFalse(any(x[0]=='pg' and 'DROP DATABASE' in x[1] for x in self.c.calls))
    def test_cleanup_after_transfer_failure_only_owned_resources(self):
        self.c.fail_restore=True
        with self.assertRaises(m.BackupError):m.restore(self.c,self.directory)
        self.assertIsNone(self.c.db);self.assertIsNone(self.c.bucket)
    def test_changed_ownership_refuses_cleanup(self):
        self.c.changed_owner=True
        with self.assertRaises(m.BackupError):m.restore(self.c,self.directory)
        self.assertIsNotNone(self.c.db);self.assertIsNotNone(self.c.bucket)
    def test_success_hashes_readback_and_removes_owned_targets(self):
        r=m.restore(self.c,self.directory)
        self.assertEqual(r['restore'],'VERIFIED');self.assertEqual(r['cleanup'],'VERIFIED')
        self.assertEqual(r['production_unchanged'],'VERIFIED')
        self.assertEqual(r['storage_object_count'],1);self.assertIsNone(self.c.db);self.assertIsNone(self.c.bucket)
    def test_restored_count_mismatch_fails_and_cleans_only_owned_targets(self):
        data=json.loads(self.manifest.read_text());data['table_counts']['User']=2;m.write_json(self.manifest,data)
        with self.assertRaises(m.BackupError):m.restore(self.c,self.directory)
        self.assertIsNone(self.c.db);self.assertIsNone(self.c.bucket)
    def test_missing_archive_manifest_fails_before_creation(self):
        self.manifest.unlink()
        with self.assertRaises(m.BackupError):m.restore(self.c,self.directory)
        self.no_mutations()
    def test_archive_traversal_rejected(self):
        import io
        bad=self.directory/'bad.tar.gz'
        with tarfile.open(bad,'w:gz') as t:
            member=tarfile.TarInfo('../production');member.size=1;t.addfile(member,io.BytesIO(b'x'))
        with self.assertRaises(m.BackupError):m.archive_manifest(bad)
    def test_permission_defaults(self):
        secure=m.secure_dir(self.directory/'private');p=secure/'manifest';m.write_json(p,{'safe':True})
        self.assertEqual(secure.stat().st_mode&0o777,0o700);self.assertEqual(p.stat().st_mode&0o777,0o600)
    def test_source_object_change_fails_receipt_after_owned_cleanup(self):
        transfer=self.c.mirror
        def changed(*args,**kwargs):
            transfer(*args,**kwargs);self.c.inventory[0]['etag']='"same-size-overwrite"'
        with patch.object(self.c,'mirror',side_effect=changed):
            with self.assertRaises(m.BackupError):m.restore(self.c,self.directory)
        self.assertIsNone(self.c.db);self.assertIsNone(self.c.bucket)
        receipt=json.loads((self.directory/f'restore_{RUN}.json').read_text())
        self.assertEqual(receipt['restore'],'FAILED');self.assertIn('cause not established',receipt['production_unchanged'])
    def test_source_count_change_fails_after_owned_cleanup(self):
        transfer=self.c.mirror
        def changed(*args,**kwargs):
            transfer(*args,**kwargs);self.c.live_counts['User']=2
        with patch.object(self.c,'mirror',side_effect=changed):
            with self.assertRaises(m.BackupError):m.restore(self.c,self.directory)
        self.assertIsNone(self.c.db);self.assertIsNone(self.c.bucket)

class BackupSafety(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.directory=Path(self.tmp.name);self.c=FakeClients()
        self.environment=patch.dict(os.environ,{},clear=True);self.environment.start()
    def tearDown(self):self.environment.stop();self.tmp.cleanup()
    def test_storage_backup_requires_complete_source_inventory(self):
        self.c.inventory.append({'key':'missing.txt','size':4,'etag':'"second"','last_modified':'2026-09-07T00:00:00.000Z'})
        with self.assertRaises(m.BackupError):m.backup(self.c,self.directory,'storage')
        self.assertEqual(list(self.directory.glob('manifest_*.txt')),[])
        self.assertEqual(list(self.directory.glob('storage_*.tar.gz')),[])
    def test_storage_backup_rejects_same_size_overwrite(self):
        mirror=self.c.mirror
        def changed(*args,**kwargs):mirror(*args,**kwargs);self.c.inventory[0]['etag']='"changed"'
        with patch.object(self.c,'mirror',side_effect=changed):
            with self.assertRaises(m.BackupError):m.backup(self.c,self.directory,'storage')
        self.assertEqual(list(self.directory.glob('manifest_*.txt')),[])
    def test_storage_backup_rejects_modified_time_drift(self):
        mirror=self.c.mirror
        def changed(*args,**kwargs):mirror(*args,**kwargs);self.c.inventory[0]['last_modified']='2026-09-07T00:01:00.000Z'
        with patch.object(self.c,'mirror',side_effect=changed):
            with self.assertRaises(m.BackupError):m.backup(self.c,self.directory,'storage')
    def test_storage_backup_records_stable_source_and_content_hash(self):
        _,storage,manifest=m.backup(self.c,self.directory,'storage')
        actual=json.loads(manifest.read_text())
        self.assertEqual(actual['source_storage_inventory'],self.c.inventory)
        self.assertEqual(actual['storage_objects'],m.archive_manifest(storage))
    def test_ambiguous_source_keys_rejected(self):
        for key in ['../live','/absolute','a//b','folder/']:
            with self.subTest(key=key):
                self.c.inventory[0]['key']=key
                with self.assertRaises(m.BackupError):m.source_inventory(self.c)
    def make_pair(self,number,age_days=30):
        stamp=f'20260101T000000{number:08x}Z';manifest=self.directory/f'manifest_{stamp}.txt'
        paths=[self.directory/f'postgres_{stamp}.dump.gz',self.directory/f'storage_{stamp}.tar.gz']
        for path in paths:path.write_bytes(f'archive {number}'.encode())
        m.write_json(manifest,{'version':1,'archives':{p.name:{'sha256':m.digest(p),'bytes':p.stat().st_size} for p in paths}})
        when=m.dt.datetime.now().timestamp()-age_days*86400+number;os.utime(manifest,(when,when))
        return manifest,paths
    def test_retention_cannot_delete_newest_pair_through_old_manifest(self):
        newest,protected=self.make_pair(9)
        self.make_pair(8);self.make_pair(7)
        malicious,_=self.make_pair(1)
        malicious.write_text(newest.read_text());os.utime(malicious,(1,1))
        m.prune_backups(self.directory,14)
        self.assertTrue(newest.exists());self.assertTrue(all(path.exists() for path in protected))
        self.assertTrue(malicious.exists())
    def test_retention_rejects_changed_archive_and_preserves_three_valid_sets(self):
        invalid,changed=self.make_pair(1);changed[0].write_bytes(b'tampered')
        protected=[self.make_pair(n) for n in [2,3,4]]
        m.prune_backups(self.directory,14)
        self.assertTrue(invalid.exists());self.assertTrue(all(p.exists() for p in changed))
        self.assertTrue(all(manifest.exists() and all(p.exists() for p in paths) for manifest,paths in protected))
    def test_retention_only_removes_complete_same_run_pair_after_three_newer(self):
        old,paths=self.make_pair(1)
        protected=[self.make_pair(n) for n in [2,3,4]]
        m.prune_backups(self.directory,14)
        self.assertFalse(old.exists());self.assertTrue(all(not p.exists() for p in paths))
        self.assertTrue(all(manifest.exists() and all(p.exists() for p in items) for manifest,items in protected))
    def test_retention_rejects_symlink_archive(self):
        manifest,paths=self.make_pair(1);target=self.directory/'unrelated';paths[0].rename(target);paths[0].symlink_to(target)
        self.assertIsNone(m.verified_archive_pair(manifest));self.assertTrue(target.exists())

class ArchiveStreaming(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.directory=Path(self.tmp.name)
    def tearDown(self):self.tmp.cleanup()
    def test_noisy_export_cannot_deadlock_on_stderr_and_preserves_dump_bytes(self):
        archive=self.directory/'dump.gz'
        child="import sys;sys.stderr.buffer.write(b'private-error'*262144);sys.stderr.flush();sys.stdout.buffer.write(b'PGDMP'+b'fixture'*262144)"
        with gzip.open(archive,'wb') as target:
            m.stream_command([sys.executable,'-c',child],target=target,timeout=3)
        self.assertEqual(gzip.decompress(archive.read_bytes()),b'PGDMP'+b'fixture'*262144)
    def test_large_gzip_is_decompressed_in_bounded_memory_for_each_consumer(self):
        archive=self.directory/'large.gz';block=b'PGDMP-controlled-fixture-'*2730;expected=hashlib.sha256()
        with gzip.open(archive,'wb') as output:
            for _ in range(1024):output.write(block);expected.update(block)
        child="import hashlib,sys;h=hashlib.sha256();n=0\nwhile True:\n b=sys.stdin.buffer.read(65536)\n if not b:break\n h.update(b);n+=len(b)\nopen(sys.argv[1],'w').write(str(n)+' '+h.hexdigest())"
        tracemalloc.start()
        try:
            for number in range(2):
                receipt=self.directory/f'consumer-{number}'
                m.gzip_command([sys.executable,'-c',child,str(receipt)],archive,label='Fixture consumer')
                self.assertEqual(receipt.read_text(),f'{len(block)*1024} {expected.hexdigest()}')
            _,peak=tracemalloc.get_traced_memory()
        finally:tracemalloc.stop()
        self.assertLess(peak,8*1024*1024,'A whole decompressed dump must never be materialized')
    def test_stalled_input_and_output_timeout_and_reap_the_client(self):
        for direction in ['input','output']:
            with self.subTest(direction=direction):
                pidfile=self.directory/direction
                child="import os,sys,time;open(sys.argv[1],'w').write(str(os.getpid()));time.sleep(60)"
                kwargs={'source':io.BytesIO(b'x'*1048576)} if direction=='input' else {'target':io.BytesIO()}
                started=time.monotonic()
                with self.assertRaises(m.BackupError):m.stream_command([sys.executable,'-c',child,str(pidfile)],timeout=0.25,**kwargs)
                self.assertLess(time.monotonic()-started,2)
                with self.assertRaises(ProcessLookupError):os.kill(int(pidfile.read_text()),0)
    def test_client_failure_does_not_expose_raw_stderr(self):
        child="import sys;sys.stderr.write('fixture-private-secret');sys.exit(7)"
        with self.assertRaises(m.BackupError) as failure:
            m.stream_command([sys.executable,'-c',child],source=io.BytesIO(b'PGDMP'),timeout=2)
        self.assertNotIn('fixture-private-secret',str(failure.exception))
    def test_early_successful_consumer_still_checks_the_gzip_trailer(self):
        archive=self.directory/'corrupted.gz'
        damaged=bytearray(gzip.compress(b'PGDMP'+b'x'*1048576));damaged[-8]^=1;archive.write_bytes(damaged)
        with self.assertRaises(gzip.BadGzipFile):
            m.gzip_command([sys.executable,'-c','import sys;sys.stdin.buffer.read(1)'],archive,label='Fixture early reader')
    def test_failed_database_export_never_publishes_a_complete_archive_or_manifest(self):
        c=FakeClients();c.compose=[sys.executable,'-c',"import sys;sys.stdout.buffer.write(b'PGDMP-partial');sys.exit(7)"]
        with self.assertRaises(m.BackupError):m.backup(c,self.directory,'postgres')
        self.assertEqual(list(self.directory.glob('postgres_*.dump.gz')),[])
        self.assertEqual(list(self.directory.glob('manifest_*.txt')),[])
        self.assertEqual(len(list(self.directory.glob('*.partial'))),1)

class StorageBinding(unittest.TestCase):
    def setUp(self):
        self.settings={'S3_ENDPOINT':'http://verified-minio:9000','S3_BUCKET':'verified-bucket','S3_ACCESS_KEY_ID':'fixture-id','S3_SECRET_ACCESS_KEY':'fixture-secret'}
    def test_rejects_wrong_endpoint_bucket_credentials_region_and_path_without_values(self):
        for key in m.STORAGE_KEYS:
            with self.subTest(key=key):
                wrong=dict(self.settings);wrong[key]='false' if key=='S3_FORCE_PATH_STYLE' else 'different-sensitive-value'
                with self.assertRaises(m.BackupError) as failure:m.bind_storage(self.settings,wrong)
                self.assertNotIn('different-sensitive-value',str(failure.exception));self.assertNotIn('fixture-secret',str(failure.exception))
    def test_dotenv_rejects_inherited_storage_override(self):
        with tempfile.TemporaryDirectory() as directory:
            envfile=Path(directory)/'environment';envfile.write_text('S3_SECRET_ACCESS_KEY=fixture-secret\n')
            with patch.dict(os.environ,{'NOIRSOUND_ENV_FILE':str(envfile),'S3_SECRET_ACCESS_KEY':'stale-secret'},clear=True):
                with self.assertRaises(m.BackupError):m.load_env()
    def test_sdk_and_mirror_both_use_frozen_verified_storage_despite_later_env_override(self):
        c=object.__new__(m.Clients);c.compose=['docker','compose'];c.backend_cid='verified-backend';c.storage_env=m.bind_storage(self.settings,self.settings)
        with patch.dict(os.environ,{'S3_ENDPOINT':'http://wrong-store:9000','S3_SECRET_ACCESS_KEY':'wrong-secret'},clear=True):
            with patch.object(m,'command',return_value=b'[]') as sdk:
                c.s3('list','verified-bucket')
                self.assertEqual(json.loads(sdk.call_args.kwargs['data'])['storage'],c.storage_env)
                self.assertEqual(sdk.call_args.args[0][:4],['docker','exec','-i','verified-backend'])
            with patch.object(m.subprocess,'run') as run:
                run.return_value.returncode=0;c.mirror('/temporary-fixture','verified-bucket')
                actual=run.call_args.kwargs['env']
                self.assertEqual(actual['S3_ENDPOINT'],self.settings['S3_ENDPOINT'])
                self.assertEqual(actual['S3_SECRET_ACCESS_KEY'],self.settings['S3_SECRET_ACCESS_KEY'])

if __name__=='__main__':unittest.main()
