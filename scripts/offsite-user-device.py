#!/usr/bin/env python3
"""Existing private user-device backups over pinned SSH; no new storage service.

VPS hook: offsite-user-device.py BACKUP_DIR CHECKSUM_FILE RECEIPT
Mac agent: offsite-user-device.py agent --host ... --identity ... --destination ...
The trusted operator's SSH authentication authorizes acknowledgements. The agent
must independently read every local copy, verify owner/mode and exact hashes.
No receipt is issued while the device is offline, for old jobs or changed files.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import secrets
import shlex
import stat
import subprocess
import sys
import time

QUEUE = Path('/opt/noirsound/offsite-verification')
REMOTE_SCRIPT = '/opt/noirsound/operations/offsite-user-device.py'
DESTINATION = 'user-device-private-backups/noirsound'
REFERENCE = r'[0-9]{8}T[0-9]{6}[0-9a-f]{8}Z'
os.umask(0o077)


def need(ok, message):
    if not ok:
        raise ValueError(message)


def private(path, directory=False):
    path = Path(path)
    need(path.is_absolute() and path.resolve() == path, 'Noncanonical or symlink path rejected')
    s = path.lstat()
    need(s.st_uid == os.geteuid() and s.st_mode & 0o077 == 0,
         'Operator ownership and private permissions required')
    need(stat.S_ISDIR(s.st_mode) if directory else stat.S_ISREG(s.st_mode), 'Regular private path required')
    return path


def digest(path):
    with private(path).open('rb') as f:
        h = hashlib.sha256()
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def write_new(path, data):
    with Path(path).open('x') as f:
        f.write(data)


def backup_set(directory, sums):
    directory = private(directory, True)
    need(directory.is_relative_to(Path('/opt/noirsound/release-records'))
         or directory == Path('/opt/noirsound/NoirSound/backups'), 'Unapproved backup source')
    sums = private(sums)
    need(sums.parent == directory, 'Checksum file must belong to this backup directory')
    rows = sums.read_text().splitlines()
    need(len(rows) == 3, 'Exactly two fresh archives and their integrity manifest required')
    files = []
    for row in rows:
        m = re.fullmatch(r'([0-9a-f]{64})  ((?:postgres|storage|manifest)_[A-Za-z0-9.]+)', row)
        need(m is not None, 'Unsupported checksum entry')
        p = private(directory / m[2])
        need(digest(p) == m[1] and p.stat().st_size > 0, 'Backup checksum mismatch')
        files.append({'name': p.name, 'sha256': m[1], 'bytes': p.stat().st_size})
    refs = [re.fullmatch(r'postgres_(' + REFERENCE + r')\.dump\.gz', f['name']) for f in files]
    refs = [m[1] for m in refs if m]
    need(len(refs) == 1, 'Fresh PostgreSQL backup reference required')
    reference = refs[0]
    need({f['name'] for f in files} == {f'postgres_{reference}.dump.gz', f'storage_{reference}.tar.gz', f'manifest_{reference}.txt'}, 'Cross-run or duplicate backup set')
    files.append({'name': sums.name, 'sha256': digest(sums), 'bytes': sums.stat().st_size})
    return reference, files


def job_path(nonce):
    need(re.fullmatch('[0-9a-f]{48}', nonce), 'Invalid request identity')
    return private(QUEUE / nonce, True)


def load_job(nonce):
    job = json.loads(private(job_path(nonce) / 'request.json').read_text())
    need(job['nonce'] == nonce and time.time() < job['expires'], 'Expired or mismatched request')
    return job


def validate_ack(job, ack):
    need(ack == {'nonce': job['nonce'], 'release_sha': job['release_sha'],
                 'checksum_sha256': job['checksum_sha256'], 'files': job['files'],
                 'destination': DESTINATION, 'private_storage_verified': True,
                 'readback_verified': True, 'system': 'Darwin'}, 'Exact private-device readback proof required')


def broker(mode, args):
    need(os.geteuid() == 0 and platform.system() == 'Linux', 'VPS operator required')
    private(QUEUE, True)
    if mode == 'pending':
        jobs = []
        for p in sorted(QUEUE.iterdir()):
            if not re.fullmatch('[0-9a-f]{48}', p.name):
                continue
            try:
                j = load_job(p.name)
                if not (p / 'ack.json').exists():
                    jobs.append(j)
            except (ValueError, FileNotFoundError):
                pass
        print(json.dumps(jobs))
    elif mode == 'read':
        nonce, name = args
        j = load_job(nonce)
        need(name in {f['name'] for f in j['files']}, 'File outside exact request')
        p = private(Path(j['directory']) / name)
        expected = next(f for f in j['files'] if f['name'] == name)
        need(digest(p) == expected['sha256'], 'Source changed during transfer')
        with p.open('rb') as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b''):
                sys.stdout.buffer.write(chunk)
    elif mode == 'ack':
        nonce, = args
        j = load_job(nonce)
        ack = json.loads(sys.stdin.read(32768))
        validate_ack(j, ack)
        # Recheck the live source; an agent cannot acknowledge an obsolete set.
        reference, files = backup_set(Path(j['directory']), Path(j['directory']) / j['sums'])
        need(files == j['files'] and reference == j['reference'], 'Source changed after copy')
        write_new(job_path(nonce) / 'ack.json', json.dumps(ack))
    else:
        directory, sums, receipt = map(Path, args)
        release = os.environ.get('RELEASE_SHA', '')
        need(re.fullmatch('[0-9a-f]{40}', release), 'Exact release SHA required')
        reference, files = backup_set(directory, sums)
        receipt_parent = private(receipt.parent, True)
        need(receipt_parent == directory or receipt_parent == directory.parent,
             'Receipt must belong to this backup/release record')
        need(not receipt.exists() and not receipt.is_symlink(), 'Old receipt rejected')
        nonce = secrets.token_hex(24)
        p = QUEUE / nonce
        p.mkdir(mode=0o700)
        job = {'nonce': nonce, 'release_sha': release, 'reference': reference,
               'directory': str(directory), 'sums': sums.name, 'files': files,
               'checksum_sha256': digest(sums), 'expires': time.time() + 900}
        write_new(p / 'request.json', json.dumps(job))
        while time.time() < job['expires']:
            if (p / 'ack.json').exists():
                ack = json.loads(private(p / 'ack.json').read_text())
                validate_ack(job, ack)
                new_reference, new_files = backup_set(directory, sums)
                need(new_reference == reference and new_files == files, 'Backup changed during offsite verification')
                write_new(receipt, '\n'.join(['version=1', 'release_sha=' + release,
                    'checksum_sha256=' + job['checksum_sha256'], 'offsite_verified=true',
                    'private_storage_verified=true', 'backup_reference=' + reference]) + '\n')
                print('Exact backup copied and independently read back on the existing private user device.')
                return
            time.sleep(2)
        raise ValueError('Private device unavailable or readback unverified; no receipt issued')


def agent(args):
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', required=True)
    parser.add_argument('--identity', required=True)
    parser.add_argument('--destination', required=True)
    parser.add_argument('--minutes', type=int, default=180)
    a = parser.parse_args(args)
    need(platform.system() == 'Darwin', 'Approved Mac offsite device required')
    destination = private(Path(a.destination), True)
    need(destination == Path.home() / '.codex/private-backups/noirsound', 'Existing approved destination required')
    private(destination.parent, True)
    ssh = ['ssh', '-i', str(Path(a.identity)), '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes',
           '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15', a.host]
    def remote(mode, *values, **kwargs):
        command = ' '.join(shlex.quote(x) for x in [REMOTE_SCRIPT, mode, *values])
        result = subprocess.run([*ssh, command], stderr=subprocess.DEVNULL, timeout=600, **kwargs)
        need(result.returncode == 0, 'Pinned SSH offsite operation failed')
        return result
    deadline = time.monotonic() + a.minutes * 60
    while time.monotonic() < deadline:
        jobs = json.loads(remote('pending', stdout=subprocess.PIPE).stdout)
        for j in jobs:
            need(re.fullmatch('[0-9a-f]{48}', j['nonce']) and re.fullmatch('[0-9a-f]{40}', j['release_sha']), 'Invalid broker request')
            copy = destination / ('external-' + j['nonce'])
            need(not copy.exists(), 'Existing destination copy rejected')
            copy.mkdir(mode=0o700)
            for f in j['files']:
                need(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,127}', f['name']), 'Invalid backup filename')
                path = copy / f['name']
                with path.open('xb') as output:
                    remote('read', j['nonce'], f['name'], stdout=output)
                    output.flush()
                    os.fsync(output.fileno())
            # This is a separate complete read of each persisted copy, not upload hashes.
            private(copy, True)
            for f in j['files']:
                path = private(copy / f['name'])
                need(digest(path) == f['sha256'] and path.stat().st_size == f['bytes'], 'Offsite readback mismatch')
            ack = {'nonce': j['nonce'], 'release_sha': j['release_sha'],
                   'checksum_sha256': j['checksum_sha256'], 'files': j['files'],
                   'destination': DESTINATION, 'private_storage_verified': True,
                   'readback_verified': True, 'system': platform.system()}
            validate_ack(j, ack)
            write_new(copy / 'readback.json', json.dumps(ack, indent=2) + '\n')
            remote('ack', j['nonce'], input=json.dumps(ack).encode(), stdout=subprocess.DEVNULL)
            print('Verified private offsite copy for release ' + j['release_sha'], flush=True)
        time.sleep(5)


if __name__ == '__main__':
    try:
        need(len(sys.argv) >= 2, 'Mode or hook arguments required')
        if sys.argv[1] == 'agent':
            agent(sys.argv[2:])
        elif sys.argv[1] in ('pending', 'read', 'ack'):
            broker(sys.argv[1], sys.argv[2:])
        else:
            need(len(sys.argv) == 4, 'Hook requires directory, checksum file and receipt')
            broker('verify', sys.argv[1:])
    except Exception as e:
        print('Offsite verification failed: ' + (str(e) if isinstance(e, ValueError) else type(e).__name__), file=sys.stderr)
        sys.exit(1)
