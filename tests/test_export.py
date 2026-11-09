import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from export_site import build
from universe import STOCKS

class ExportTests(unittest.TestCase):
    def test_pages_demo_includes_backtest_and_relative_assets(self):
        with tempfile.TemporaryDirectory() as directory:
            build(directory, demo=True)
            root=Path(directory)
            html=(root/'index.html').read_text()
            self.assertIn('window.STOCKROOM_STATIC=true', html)
            self.assertIn('src="./backtest.js?v=',html)
            import hashlib
            for name in ('app.js','style.css','universe.js'):
                digest=hashlib.sha256((root/name).read_bytes()).hexdigest()[:12]
                self.assertIn(name+'?v='+digest,html)
            self.assertTrue((root/'backtest.js').is_file())
            self.assertTrue((root/'paper.js').is_file())
            self.assertIn('src="./paper.js?v=', html)
            financials=json.loads((root/'data/fundamentals.json').read_text())
            self.assertEqual(len(financials['reports']),len(STOCKS))
            self.assertTrue(all(m['value'] is None for r in financials['reports'] for m in r['metrics']))
            self.assertEqual(json.loads((root/'data/quotes.json').read_text()), {'quotes':[]})
    def test_failed_sync_cannot_overwrite_existing_site(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'index.html').write_text('existing')
            with patch('export_site.quotes',return_value=[{'error':'no data'}]):
                with self.assertRaises(ValueError):build(directory)
            self.assertEqual((root/'index.html').read_text(),'existing')
