import importlib.util
from pathlib import Path
import plistlib
import socket
import sys
sys.dont_write_bytecode = True
import unittest

spec = importlib.util.spec_from_file_location('autostart', Path(__file__).with_name('autostart.py'))
app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)


class AutostartTests(unittest.TestCase):
    def test_independent_identity(self):
        self.assertNotEqual(app.identity(Path('/tmp/one')), app.identity(Path('/tmp/two')))
        self.assertTrue(app.identity(Path('/tmp/one')).startswith('org.personalportal.autostart.'))

    def test_paths_with_spaces_and_xml_characters(self):
        root = Path('/tmp/导航 & portal')
        config = app.configuration(root, 18080, Path('/tmp/Python Tools/python3'), Path('/tmp/user'))
        restored = plistlib.loads(plistlib.dumps(config))
        self.assertEqual(restored['ProgramArguments'][-1], str(root))
        self.assertEqual(restored['ProgramArguments'][0], '/tmp/Python Tools/python3')
        self.assertIn('127.0.0.1', restored['ProgramArguments'])
        self.assertTrue(app.owned(restored, root))
        self.assertFalse(app.owned(restored, Path('/tmp/unrelated')))

    def test_invalid_ports(self):
        for value in ('abc', '0', '1023', '65536', '-1'):
            with self.assertRaises(Exception):
                app.port_number(value)
        self.assertEqual(app.port_number('18080'), 18080)

    def test_occupied_port_is_not_stopped(self):
        with socket.socket() as server:
            server.bind(('127.0.0.1', 0))
            server.listen()
            port = server.getsockname()[1]
            with self.assertRaises(RuntimeError):
                app.free_port(port)
            self.assertEqual(server.getsockname()[1], port)


if __name__ == '__main__':
    unittest.main()
