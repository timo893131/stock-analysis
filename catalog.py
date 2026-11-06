"""Fetch FinMind's instrument directory once per build, not per search."""
import datetime as dt
import json
import os
from pathlib import Path
import re
import urllib.request
from universe import FOCUS


def normalize(rows):
    result={}
    for row in rows:
        code=str(row.get('stock_id',''))
        market=str(row.get('type','')).lower()
        if market not in ('twse','tpex') or not (re.fullmatch(r'\d{4}',code) or re.fullmatch(r'00\d{3,4}[A-Z]?',code)):
            continue
        name=row.get('stock_name')
        if not isinstance(name,str) or not name.strip():continue
        symbol=code+('.TW' if market=='twse' else '.TWO')
        record={'symbol':symbol,'name':name[:80],'market':'上市' if market=='twse' else '上櫃','industry':str(row.get('industry_category',''))[:80],'date':str(row.get('date',''))}
        if symbol not in result or record['date']>result[symbol]['date']:result[symbol]=record
    return sorted(result.values(),key=lambda x:x['symbol'])


def fallback():
    return {'status':'focus_only','source':'本站研究清單','items':[{'symbol':s,'name':n,'market':'上櫃' if s.endswith('.TWO') else '上市','industry':sector} for s,n,sector in FOCUS]}


def sync():
    headers={'User-Agent':'Stockroom/0.4'}
    if os.environ.get('FINMIND_TOKEN'):headers['Authorization']='Bearer '+os.environ['FINMIND_TOKEN']
    try:
        req=urllib.request.Request('https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInfo',headers=headers)
        with urllib.request.urlopen(req,timeout=30) as response:payload=json.load(response)
        if payload.get('status')!=200:raise ValueError('provider_rejected')
        items=normalize(payload['data'])
        if len(items)<100:raise ValueError('incomplete_directory')
        result={'status':'ready','source':'FinMind TaiwanStockInfo','updatedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'items':items}
    except Exception:result=fallback()
    path=Path(os.environ.get('DATA_DIR','./data'))/'catalog.json';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(result,ensure_ascii=False))
    print(json.dumps({'catalogStatus':result['status'],'count':len(result['items'])}))
    return result


def stored():
    try:return json.loads((Path(os.environ.get('DATA_DIR','./data'))/'catalog.json').read_text())
    except (OSError,ValueError):return fallback()

if __name__=='__main__':sync()
