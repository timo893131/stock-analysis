import io
import json
import unittest
from unittest.mock import patch
from ai_analysis import validate_text,generate
class AITests(unittest.TestCase):
    def test_rejects_unexpected_or_nontext_fields(self):
        for x in ({},{'summary':'x','risks':'x','checks':5},{'summary':'x','risks':'x','checks':'x','buy':True}):
            with self.assertRaises(ValueError):validate_text(x)
    def test_provider_call_keeps_key_in_header_and_only_supplied_facts(self):
        answer={'summary':'僅供研究','risks':'資料不完整','checks':'核對財報','action':'wait','reason':'先確認財報','allocationPct':0}
        response={'candidates':[{'content':{'parts':[{'text':json.dumps(answer)}]}}]}
        q={'symbol':'2330.TW','name':'台積電','price':100,'asOf':123,'history':[{'close':100}]*60}
        with patch('urllib.request.urlopen',return_value=io.BytesIO(json.dumps(response).encode())) as call:
            r=generate(q,None,'SECRET','gemini-2.5-flash')
        request=call.call_args.args[0]
        self.assertNotIn('SECRET',request.full_url);self.assertNotIn('SECRET',request.data.decode())
        self.assertEqual(r['asOf'],123);self.assertEqual(r['summary'],answer['summary'])
    def test_cache_never_relabels_an_old_quote_or_generation_time(self):
        import datetime as dt
        from ai_analysis import matching_cached,fingerprint
        stamp=dt.datetime.now(dt.timezone.utc).isoformat()
        r={'symbol':'2330.TW','asOf':123,'status':'ready','generatedAt':stamp,'summary':'研究','risks':'風險','checks':'查證'}
        self.assertEqual(matching_cached([r],{'symbol':'2330.TW','asOf':123})['generatedAt'],stamp)
        self.assertIsNone(matching_cached([r],{'symbol':'2330.TW','asOf':124}))
        q={'symbol':'2330.TW','asOf':123,'price':100,'history':[]}
        self.assertNotEqual(fingerprint(q,{}),fingerprint({**q,'price':101},{}))

    def test_allocation_is_explicit_and_matches_the_action(self):
        base={'summary':'研究','risks':'風險','checks':'查證','action':'consider','reason':'先核對證據','allocationPct':10}
        self.assertEqual(validate_text(base,require_advice=True)['allocationPct'],10)
        for item in [{**base,'allocationPct':0},{**base,'allocationPct':100},{**base,'allocationPct':True},{**base,'action':'wait'},{k:v for k,v in base.items() if k!='allocationPct'}]:
            with self.assertRaises(ValueError):validate_text(item,require_advice=True)
