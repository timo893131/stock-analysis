import datetime as dt
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import full_market as F

class FullMarketTests(unittest.TestCase):
    def test_dates_symbols_and_missing_prices(self):
        today=dt.date(2026,11,10)
        rows=[{'Code':'2330','Name':'台積電','Date':'1151110','ClosingPrice':'1,200.5','Change':'+2.5','TradeVolume':'10,000'},
              {'Code':'00679B','Name':'債券ETF','Date':'20261110','ClosingPrice':'--','Change':'X0.00'},
              {'Code':'123456','Name':'權證','Date':'1151110','ClosingPrice':'1'},
              {'Code':'2379','Name':'未來','Date':'1151111','ClosingPrice':'745'}]
        result=F.normalize(rows,'twse',today)
        self.assertEqual({q['symbol'] for q in result},{'2330.TW','00679B.TW'})
        stock=next(q for q in result if q['symbol']=='2330.TW')
        self.assertEqual(stock['volume'],10000)
        self.assertAlmostEqual(stock['change'],2.5/1198*100)
        missing=next(q for q in result if q['symbol']=='00679B.TW')
        self.assertEqual(missing['kind'],'etf');self.assertIsNone(missing['price']);self.assertIsNone(missing['change'])
        self.assertEqual(F.date('115/11/10'),'2026-11-10')
        self.assertEqual(F.date('2026-11-10'),'2026-11-10')
    def test_otc_fields_and_latest_date_dedup(self):
        row={'SecuritiesCompanyCode':'8069','CompanyName':'元太','Date':'115/11/09','Close':'300','Change':'-5','TradingShares':'2,000'}
        newer={**row,'Date':'115/11/10','Close':'302'}
        result=F.normalize([row,newer],'tpex',dt.date(2026,11,10))
        self.assertEqual(len(result),1);self.assertEqual(result[0]['symbol'],'8069.TWO');self.assertEqual(result[0]['price'],302)
    def test_one_source_failure_preserves_original_cached_date_and_time(self):
        day=dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date().strftime('%Y%m%d')
        old={'status':'ready','markets':{'tpex':{'tradeDate':'2026-11-01','fetchedAt':'old'}},'quotes':[{'symbol':'8069.TWO','market':'上櫃','tradeDate':'2026-11-01'}]}
        def loader(url):
            if url.endswith('full-market.json'):return old
            if 'tpex.org' in url:raise TimeoutError()
            return [{'Code':str(1000+i),'Name':f'股票{i}','Date':day,'ClosingPrice':'10','Change':'1'} for i in range(101)]
        with tempfile.TemporaryDirectory() as folder,patch.dict(os.environ,{'DATA_DIR':folder}):
            result=F.sync(loader)
            self.assertEqual(result['status'],'partial');self.assertEqual(result['markets']['twse']['count'],101)
            self.assertEqual(result['markets']['tpex']['status'],'cached');self.assertEqual(result['markets']['tpex']['fetchedAt'],'old')
            self.assertEqual(result['quotes'][-1]['tradeDate'],'2026-11-01')
            self.assertEqual(json.loads((Path(folder)/'full-market.json').read_text())['status'],'partial')
    def test_malformed_source_does_not_publish_empty_as_complete(self):
        with tempfile.TemporaryDirectory() as folder,patch.dict(os.environ,{'DATA_DIR':folder}):
            result=F.sync(lambda url:[])
            self.assertEqual(result['status'],'unavailable');self.assertFalse(result['quotes'])
