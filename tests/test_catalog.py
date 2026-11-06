import unittest
from catalog import normalize,fallback
from universe import STOCKS,AI_SYMBOLS,SECTORS
class CatalogTests(unittest.TestCase):
    def test_latest_names_markets_and_supported_codes(self):
        rows=[{'stock_id':'2330','stock_name':'舊名','type':'twse','date':'2025-01-01'}, {'stock_id':'2330','stock_name':'台積電','type':'twse','date':'2026-01-01'}, {'stock_id':'6488','stock_name':'環球晶','type':'tpex'}, {'stock_id':'00878','stock_name':'ETF','type':'twse'}, {'stock_id':'123456','stock_name':'權證','type':'twse'}, {'stock_id':'1234','stock_name':'其他','type':'emerging'}]
        items=normalize(rows)
        self.assertEqual({x['symbol'] for x in items},{'2330.TW','6488.TWO','00878.TW'})
        self.assertEqual(next(x['name'] for x in items if x['symbol']=='2330.TW'),'台積電')
    def test_focus_and_ai_quota_stay_separate(self):
        self.assertEqual(len(STOCKS),20);self.assertEqual(len(AI_SYMBOLS),6)
        self.assertEqual(len(fallback()['items']),20)
        self.assertEqual(SECTORS['00878.TW'],'etf')
