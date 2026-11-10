import json
from pathlib import Path
import re
import struct
import tempfile
import unittest
from export_site import build

class PwaArtifacts(unittest.TestCase):
    def test_manifest_icons_scope_and_exported_worker_are_complete(self):
        with tempfile.TemporaryDirectory() as folder:
            build(folder,demo=True)
            root=Path(folder);manifest=json.loads((root/'manifest.webmanifest').read_text())
            self.assertEqual(manifest['display'],'standalone');self.assertEqual(manifest['scope'],'./');self.assertEqual(manifest['start_url'],'./#overview')
            for icon in manifest['icons']:
                content=(root/icon['src']).read_bytes();self.assertEqual(content[:8],b'\x89PNG\r\n\x1a\n');width,height=struct.unpack('>II',content[16:24]);self.assertEqual(icon['sizes'],f'{width}x{height}')
            worker=(root/'sw.js').read_text();self.assertNotIn('__STOCKROOM_',worker)
            files=json.loads(re.search(r'const FILES=(.*);',worker).group(1))
            for name in files:
                path=name.split('?')[0];self.assertTrue((root/(path if path!='./' else 'index.html')).is_file(),name)
            self.assertTrue(any(x.startswith('./shell.js?v=') for x in files));self.assertTrue(any(x.startswith('./shell.css?v=') for x in files));self.assertNotIn('https://', ''.join(files))
    def test_data_changes_do_not_masquerade_as_new_application_versions(self):
        with tempfile.TemporaryDirectory() as folder:
            build(folder,demo=True);first=(Path(folder)/'sw.js').read_text()
            (Path(folder)/'data/quotes.json').write_text('{"quotes": [{"symbol": "changed"}]}')
            build(folder,demo=True)
            self.assertEqual((Path(folder)/'sw.js').read_text(),first)
