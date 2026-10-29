import sys
sys.dont_write_bytecode = True
import http.client
import json
from pathlib import Path
import shutil
import tempfile
import threading
import unittest
from unittest.mock import patch
import portal_server as app
import autostart


class ServerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='portal test ')
        self.root = Path(self.temp.name)
        for name in app.RUNTIME_FILES:
            shutil.copy2(Path(__file__).parent / name, self.root / name)
        (self.root / '.git').mkdir()
        (self.root / '.git' / 'HEAD').write_text('private metadata')
        (self.root / 'README.md').write_text('not a web asset')
        (self.root / '.env').write_text('not a web asset')
        self.server = app.make_server(self.root, 0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join()
        self.temp.cleanup()

    def request(self, path, method='GET'):
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port)
        conn.request(method, path)
        res = conn.getresponse(); data = res.read(); status = res.status
        conn.close(); return status, data

    def test_all_runtime_files_and_query(self):
        for name in app.RUNTIME_FILES:
            self.assertEqual(self.request('/'+name), (200, (self.root/name).read_bytes()))
        self.assertEqual(self.request('/?space=shares')[0], 200)
        self.assertEqual(self.request('/index.html','HEAD'), (200,b''))

    def test_denies_git_traversal_metadata_and_directory_listing(self):
        for path in ('/.git/HEAD','/.git/config','/.git/logs/HEAD','/%2egit/HEAD','/%2Egit/HEAD',
                     '/%252egit/HEAD','/../.git/HEAD','/%2e%2e/.git/HEAD','/x/../index.html',
                     '/README.md','/.env','/autostart.py','/portal_server.py','/skills/','//.git/HEAD',
                     '/index.html/','/%00index.html'):
            with self.subTest(path=path):
                self.assertEqual(self.request(path)[0],404)
                self.assertEqual(self.request(path,'HEAD')[0],404)

    def test_symlink_in_allowlist_rejected(self):
        (self.root/'config.js').unlink()
        (self.root/'config.js').symlink_to(self.root/'.git'/'HEAD')
        self.assertEqual(self.request('/config.js')[0],404)
        with self.assertRaises((ValueError,OSError)): app.runtime_snapshot(self.root)

    def test_missing_script_rejected_before_launchctl(self):
        (self.root/'bootstrap.js').unlink()
        with patch.object(autostart,'launchctl') as command:
            with self.assertRaises(OSError): autostart.install(self.root,18080,False)
            command.assert_not_called()

    def test_broken_json_and_missing_artwork_rejected(self):
        (self.root/'services.json').write_text('{broken')
        with self.assertRaises(ValueError): app.runtime_snapshot(self.root)
        shutil.copy2(Path(__file__).parent/'services.json', self.root/'services.json')
        (self.root/'artwork.json').write_text('{}')
        with self.assertRaises(ValueError): app.runtime_snapshot(self.root)

    def test_http_integrity_and_blocked_paths(self):
        opener=autostart.urllib.request.build_opener(autostart.urllib.request.ProxyHandler({}))
        expected=app.runtime_snapshot(self.root)
        autostart.verify_http(opener,self.root,self.server.server_port,expected)
        (self.root/'config.js').write_text('// changed after preflight')
        with self.assertRaises(RuntimeError): autostart.verify_http(opener,self.root,self.server.server_port,expected)


if __name__=='__main__': unittest.main()
