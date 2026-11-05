import os
import tempfile
import unittest
from unittest.mock import patch
from fundamentals import make_report, sync_financials, reports


def statement(day, **values):
    return [{'date':day,'type':key,'value':value} for key,value in values.items()]

def fixtures():
    return {'income':statement('2026-06-30',Revenue=100,GrossProfit=40,EPS=2),
        'balance':statement('2026-06-30',TotalAssets=200,Liabilities=50,CurrentAssets=80,CurrentLiabilities=40),
        'cash':statement('2026-06-30',CashFlowsFromOperatingActivities=-20),
        'revenue':[{'revenue_year':2025,'revenue_month':8,'revenue':100},{'revenue_year':2026,'revenue_month':8,'revenue':120}]}

class FinancialTests(unittest.TestCase):
    def test_ratios_use_same_period_and_month_yoy(self):
        report=make_report('2330.TW',fixtures());values={x['key']:x['value'] for x in report['metrics']}
        self.assertAlmostEqual(values['revenue_yoy'],20);self.assertEqual(values['gross_margin'],40)
        self.assertEqual(values['debt_ratio'],25);self.assertEqual(values['current_ratio'],2)
        self.assertEqual(values['operating_cash'],-1);self.assertEqual(report['coverage'],6)
        self.assertIsNone(report['publishedAt']);self.assertFalse(report['pointInTimeSafe'])
    def test_missing_new_period_does_not_reuse_old_denominator(self):
        data=fixtures();data['income']+=statement('2026-09-30',GrossProfit=55)
        report=make_report('2330.TW',data);metrics={x['key']:x for x in report['metrics']}
        self.assertIsNone(metrics['gross_margin']['value']);self.assertEqual(metrics['gross_margin']['period'],'2026-09-30')
    def test_missing_zero_nonfinite_and_conflicting_values_are_not_scores(self):
        data=fixtures();data['balance']=statement('2026-06-30',TotalAssets=0,Liabilities=50,CurrentAssets=80,CurrentLiabilities=0)
        data['income']+=statement('2026-06-30',EPS=3)
        data['cash']=statement('2026-06-30',CashFlowsFromOperatingActivities=float('nan'))
        values={x['key']:x['value'] for x in make_report('2330.TW',data)['metrics']}
        for key in ('eps','debt_ratio','current_ratio','operating_cash'):self.assertIsNone(values[key])
    def test_special_sectors_do_not_receive_generic_company_metrics(self):
        for symbol in ('2881.TW','0050.TW'):
            report=make_report(symbol,fixtures());self.assertEqual(report['status'],'not_applicable');self.assertEqual(report['metrics'],[])
    def test_cached_reports_and_partial_failure_are_explicit(self):
        with tempfile.TemporaryDirectory() as directory,patch.dict(os.environ,{'DATA_DIR':directory}):
            def provider(symbol,kind):
                if kind=='cash':raise RuntimeError('secret error text')
                return fixtures()[kind]
            sync_financials(provider)
            report=reports()[0];self.assertEqual(report['status'],'partial');self.assertEqual(report['errors'],{'cash':'unavailable'})
            self.assertNotIn('secret',str(report));self.assertIsNotNone(report['fetchedAt'])
    def test_negative_or_missing_prior_revenue_does_not_generate_growth(self):
        data=fixtures();data['revenue'][0]['revenue']=0
        self.assertIsNone(make_report('2330.TW',data)['metrics'][0]['value'])
