import io
import json
import os
import tempfile
import unittest
from unittest.mock import patch
import market
from wsgi import application

class Provider:
    def daily(self, symbol, start):
        return [('2026-01-05', 100, 1000), ('2026-01-06', 110, 2000)]

class MarketTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {'DATA_DIR': self.directory.name})
        self.env.start()
    def tearDown(self):
        self.env.stop()
        self.directory.cleanup()
    def test_sync_is_idempotent_and_persistent(self):
        market.sync(Provider()); market.sync(Provider())
        with market.connect() as db:
            self.assertEqual(db.execute('select count(*) from prices').fetchone()[0], 12)
        q = market.quotes()[0]
        self.assertAlmostEqual(q['change'], 10)
        self.assertFalse(q['tradable'])
        self.assertEqual(q['dataKind'], 'daily')
        self.assertFalse(q['analysisReady'])
    def test_failure_preserves_prices_and_exposes_error(self):
        market.sync(Provider())
        class Broken:
            def daily(self, symbol, start): raise ValueError('private provider details')
        market.sync(Broken())
        q = market.quotes()[0]
        self.assertEqual(q['price'], 110)
        self.assertEqual(q['sync']['error'], 'sync_failed')
        self.assertIsNotNone(q['sync']['lastSuccess'])
    def test_adapter_parses_documented_shape_and_rejects_wrong_symbol(self):
        payload = {'status':200,'data':[{'stock_id':'2330','date':'2026-01-05','close':100,'Trading_Volume':20}]}
        with patch('urllib.request.urlopen', return_value=io.BytesIO(json.dumps(payload).encode())):
            self.assertEqual(market.FinMindProvider().daily('2330.TW','2026-01-01'), [('2026-01-05',100,20)])
        payload['data'][0]['stock_id']='9999'
        with patch('urllib.request.urlopen', return_value=io.BytesIO(json.dumps(payload).encode())):
            with self.assertRaises(ValueError): market.FinMindProvider().daily('2330.TW','2026-01-01')
    def test_wsgi_no_network_reads_and_path_traversal(self):
        market.sync(Provider())
        statuses=[]
        with patch('urllib.request.urlopen',side_effect=AssertionError('Web must not query providers')):
            body=b''.join(application({'PATH_INFO':'/api/quotes','REQUEST_METHOD':'GET'}, lambda s,h:statuses.append(s)))
            self.assertEqual(len(json.loads(body)['quotes']),6)
        body=b''.join(application({'PATH_INFO':'/../market.py','REQUEST_METHOD':'GET'},lambda s,h:statuses.append(s)))
        self.assertEqual(statuses[-1],'404 Not Found')
    def test_empty_cache_is_not_fabricated(self):
        self.assertTrue(all('error' in q for q in market.quotes()))
