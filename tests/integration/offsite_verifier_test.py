import copy
import importlib.util
from pathlib import Path
import os
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('offsite', Path(__file__).resolve().parents[2] / 'scripts/offsite-user-device.py')
offsite = importlib.util.module_from_spec(spec)
spec.loader.exec_module(offsite)


class OffsiteBoundaryTests(unittest.TestCase):
    def test_acks_bind_nonce_release_checksum_and_complete_file_set(self):
        job = {'nonce': 'a' * 48, 'release_sha': 'b' * 40, 'checksum_sha256': 'c' * 64,
               'files': [{'name': 'backup', 'sha256': 'd' * 64, 'bytes': 8}]}
        ack = dict(job, destination=offsite.DESTINATION, private_storage_verified=True,
                   readback_verified=True, system='Darwin')
        offsite.validate_ack(job, ack)
        for key, wrong in [('nonce', 'e' * 48), ('release_sha', 'f' * 40),
                           ('checksum_sha256', '0' * 64), ('files', []),
                           ('private_storage_verified', False), ('readback_verified', False),
                           ('system', 'Linux'), ('destination', 'same-vps')]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                offsite.validate_ack(job, dict(ack, **{key: wrong}))
        mutated = copy.deepcopy(ack)
        mutated['files'][0]['sha256'] = '1' * 64
        with self.assertRaises(ValueError):
            offsite.validate_ack(job, mutated)

    def test_independent_hash_detects_changed_persisted_bytes(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d).resolve() / 'copy'
            p.write_bytes(b'original'); p.chmod(0o600)
            first = offsite.digest(p)
            p.write_bytes(b'changed')
            self.assertNotEqual(first, offsite.digest(p))

    def test_public_or_symlink_storage_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d).resolve() / 'copy'
            p.write_bytes(b'archive'); p.chmod(0o644)
            with self.assertRaises(ValueError):
                offsite.private(p)
            p.chmod(0o600)
            link = p.parent / 'link'; link.symlink_to(p)
            with self.assertRaises(ValueError):
                offsite.private(link)

    def test_old_and_path_traversal_requests_rejected(self):
        for nonce in ['../backup', 'a' * 47, 'A' * 48]:
            with self.subTest(nonce=nonce), self.assertRaises(ValueError):
                offsite.job_path(nonce)


if __name__ == '__main__':
    unittest.main()
