import sys
sys.dont_write_bytecode = True
import http.client
import base64
import io
import plistlib
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

    def test_raster_assets_get_head_mime_and_query(self):
        image = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')
        for suffix, mime in app.IMAGE_TYPES.items():
            name = 'assets/card-media/nested/report' + suffix.upper()
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(image)
            for method in ('GET', 'HEAD'):
                conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port)
                conn.request(method, '/' + name + '?retry=1')
                response = conn.getresponse()
                self.assertEqual(response.status, 200)
                self.assertEqual(response.getheader('Content-Type'), mime)
                self.assertEqual(response.getheader('X-Content-Type-Options'), 'nosniff')
                self.assertEqual(int(response.getheader('Content-Length')), len(image))
                self.assertEqual(response.read(), image if method == 'GET' else b'')
                conn.close()

    def test_assets_cannot_expose_other_files_or_traverse(self):
        folder = self.root / 'assets/card-media'
        folder.mkdir(parents=True)
        for name in ('secret.txt', 'payload.svg', 'page.html', 'code.js', '.hidden.png'):
            (folder/name).write_text('must remain inaccessible')
        paths = ['assets/card-media/'+n for n in ('secret.txt','payload.svg','page.html','code.js','.hidden.png')]
        paths += ['assets/', 'assets/card-media/', 'assets/card-media/missing.png',
                  'assets/card-media/../../.git/HEAD', 'assets/%2e%2e/.git/HEAD',
                  'assets/%252e%252e/.git/HEAD', 'assets/card-media/../secret.png',
                  'assets/card-media/%2e%2e/secret.png', 'assets//secret.png',
                  'assets/card-media%5c..%5csecret.png', 'assets/card-media/a.png%00',
                  'assets/.git/HEAD.png']
        for path in paths:
            for method in ('GET','HEAD'):
                with self.subTest(path=path, method=method):
                    self.assertEqual(self.request('/'+path, method)[0],404)

    def test_asset_file_and_parent_symlinks_rejected(self):
        folder = self.root / 'assets/card-media'
        folder.mkdir(parents=True)
        (folder/'secret.png').symlink_to(self.root/'.git/HEAD')
        (self.root/'.git/hidden.png').write_text('private')
        (folder/'linked').symlink_to(self.root/'.git', target_is_directory=True)
        for path in ('/assets/card-media/secret.png', '/assets/card-media/linked/hidden.png'):
            self.assertEqual(self.request(path)[0],404)
        shutil.rmtree(self.root/'assets')
        (self.root/'assets').symlink_to(self.root/'.git', target_is_directory=True)
        self.assertEqual(self.request('/assets/hidden.png')[0],404)

    def test_optional_media_does_not_block_startup_or_http_verification(self):
        optional = self.root/'card-media.json'
        for content in (None, '', '{broken', 'null', '[]'):
            with self.subTest(content=content):
                if content is None:
                    optional.unlink()
                else:
                    optional.write_text(content)
                snapshot = app.runtime_snapshot(self.root)
                self.assertNotIn('card-media.json', snapshot)
                self.assertEqual(self.request('/')[0],200)
                opener = autostart.urllib.request.build_opener(autostart.urllib.request.ProxyHandler({}))
                autostart.verify_http(opener,self.root,self.server.server_port,snapshot)
                # Exercise the actual installation preflight without installing a task.
                with patch.object(autostart.sys, 'stdout') as output:
                    output.buffer = io.BytesIO()
                    autostart.install(self.root,18080,True)
                    self.assertIn('ProgramArguments',plistlib.loads(output.buffer.getvalue()))

    def test_optional_symlink_rejected_without_blocking_navigation(self):
        optional = self.root/'card-media.json'
        optional.unlink()
        optional.symlink_to(self.root/'.git/HEAD')
        app.runtime_snapshot(self.root)
        self.assertEqual(self.request('/card-media.json')[0],404)
        self.assertEqual(self.request('/')[0],200)

    def test_http_integrity_and_blocked_paths(self):
        opener=autostart.urllib.request.build_opener(autostart.urllib.request.ProxyHandler({}))
        expected=app.runtime_snapshot(self.root)
        autostart.verify_http(opener,self.root,self.server.server_port,expected)
        (self.root/'config.js').write_text('// changed after preflight')
        with self.assertRaises(RuntimeError): autostart.verify_http(opener,self.root,self.server.server_port,expected)


if __name__=='__main__': unittest.main()
