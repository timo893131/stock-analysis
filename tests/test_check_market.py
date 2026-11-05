import unittest
from unittest.mock import patch
from urllib.error import HTTPError
import check_market

class DiagnosticTests(unittest.TestCase):
    def test_only_summary_is_returned(self):
        with patch('check_market.FinMindProvider.daily',return_value=[('2026-01-02',100,200)]):
            self.assertEqual(check_market.check(), {'status':'ok','symbol':'2330.TW','rows':1,'latestTradeDate':'2026-01-02'})
    def test_http_error_does_not_expose_response_or_url(self):
        with patch('check_market.FinMindProvider.daily', side_effect=HTTPError('secret-url',401,'secret-body',{},None)):
            self.assertEqual(check_market.check(), {'status':'failed','reason':'http_401'})
