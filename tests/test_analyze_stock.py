import datetime as dt
import unittest
from analyze_stock import resolve,quote
class DemandTests(unittest.TestCase):
    def test_symbol_allowlist_and_no_shell_values(self):
        items=[{'symbol':'2603.TW','name':'長榮'}]
        self.assertEqual(resolve('2603',items),items[0])
        for value in ('../../token','2603;env','9999','$(cat .env)'):
            with self.assertRaises(ValueError):resolve(value,items)
    def test_old_or_short_history_cannot_generate(self):
        now=dt.datetime(2026,11,6,tzinfo=dt.timezone.utc)
        rows=[((now.date()-dt.timedelta(days=90-i)).isoformat(),100,100) for i in range(60)]
        with self.assertRaises(ValueError):quote({'symbol':'2603.TW','name':'長榮'},rows,now)
        with self.assertRaises(ValueError):quote({},[],now)
    def test_non_focus_stock_generates_once_and_reuses_cache(self):
        import tempfile,json
        from pathlib import Path
        from unittest.mock import patch
        from analyze_stock import run
        from zoneinfo import ZoneInfo
        now=dt.datetime.now(dt.timezone.utc)
        last=now.astimezone(ZoneInfo('Asia/Taipei')).date()-dt.timedelta(days=1)
        rows=[((last-dt.timedelta(days=65-i)).isoformat(),100,1000) for i in range(66)]
        item={'symbol':'2603.TW','name':'長榮','industry':'航運'}
        def generated(q,*args):return {'symbol':q['symbol'],'asOf':q['asOf'],'status':'ready','generatedAt':now.isoformat(),'summary':'研究','risks':'風險','checks':'查證'}
        with tempfile.TemporaryDirectory() as directory,patch.dict('os.environ',{'GEMINI_API_KEY':'test'}),patch('analyze_stock.sync_catalog',return_value={'status':'ready','items':[item]}),patch('analyze_stock.FinMindProvider.daily',return_value=rows),patch('analyze_stock.fetch_statement',return_value=[]) as financial,patch('analyze_stock.generate',side_effect=generated) as ai:
            run('2603',directory);run('2603',directory)
            self.assertEqual(ai.call_count,1)
            self.assertEqual(financial.call_count,4)
            self.assertEqual(json.loads((Path(directory)/'2603.TW.json').read_text())['quote']['symbol'],'2603.TW')
