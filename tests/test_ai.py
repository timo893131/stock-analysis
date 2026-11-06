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
        answer={'summary':'僅供研究','risks':'資料不完整','checks':'核對財報'}
        response={'candidates':[{'content':{'parts':[{'text':json.dumps(answer)}]}}]}
        q={'symbol':'2330.TW','name':'台積電','price':100,'asOf':123,'history':[{'close':100}]*60}
        with patch('urllib.request.urlopen',return_value=io.BytesIO(json.dumps(response).encode())) as call:
            r=generate(q,None,'SECRET','gemini-2.5-flash')
        request=call.call_args.args[0]
        self.assertNotIn('SECRET',request.full_url);self.assertNotIn('SECRET',request.data.decode())
        self.assertEqual(r['asOf'],123);self.assertEqual(r['summary'],answer['summary'])
