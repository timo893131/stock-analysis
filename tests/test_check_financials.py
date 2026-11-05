import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from check_financials import inspect,summary
from fundamentals import DatasetError
from test_fundamentals import fixtures

class FinancialDiagnosticTests(unittest.TestCase):
    def provider(self,symbol,kind):
        rows=fixtures()[kind]
        return [dict(row,date=row.get('date','2026-09-10')) for row in rows]
    def test_valid_response_checks_schema_and_computed_coverage(self):
        result=inspect(self.provider)
        self.assertTrue(result['ready']);self.assertEqual(result['availableMetrics'],6)
        self.assertNotIn('value',summary(result))
    def test_secret_body_and_url_are_never_reported(self):
        def reject(*args):raise HTTPError('SECRET_URL',401,'SECRET_BODY',{},None)
        with patch.dict('os.environ',{'FINMIND_TOKEN':'PRIVATE_KEY'}):
            result=inspect(reject)
        output=summary(result)
        self.assertFalse(result['ready']);self.assertTrue(result['tokenConfigured'])
        for value in ('SECRET_URL','SECRET_BODY','PRIVATE_KEY'):self.assertNotIn(value,output)
    def test_provider_rejection_has_safe_status(self):
        def reject(*args):raise DatasetError('provider_402')
        self.assertIn('provider_402',summary(inspect(reject)))
    def test_missing_cash_field_is_not_success(self):
        def changed(symbol,kind):
            rows=self.provider(symbol,kind)
            return [dict(row,type='different_type') for row in rows] if kind=='cash' else rows
        result=inspect(changed)
        self.assertFalse(result['ready']);self.assertEqual(result['datasets']['cash']['status'],'schema_missing')
