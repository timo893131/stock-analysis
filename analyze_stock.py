"""Owner-triggered single-stock research. Secrets stay in Actions; results are public."""
import datetime as dt
import json
import os
from pathlib import Path
import re
from zoneinfo import ZoneInfo
from catalog import sync as sync_catalog
from market import FinMindProvider
from fundamentals import fetch_statement, make_report
from ai_analysis import generate


def resolve(value, items):
    value=value.strip().upper()
    if not re.fullmatch(r'(?:\d{4}|00\d{3,4}[A-Z]?)(?:\.TW|\.TWO)?',value):
        raise ValueError('請輸入有效台股代碼，例如 2603 或 6488.TWO')
    matches=[x for x in items if x['symbol']==value or x['symbol'].split('.')[0]==value]
    if len(matches)!=1:raise ValueError('名錄找不到唯一標的，請輸入完整代號並確認上市櫃狀態')
    return matches[0]


def quote(item, rows, now=None):
    now=now or dt.datetime.now(dt.timezone.utc)
    rows=sorted({r[0]:r for r in rows}.values())[-130:]
    if len(rows)<60:raise ValueError('有效歷史不足 60 日，暫不生成解析')
    history=[{'time':int(dt.datetime.combine(dt.date.fromisoformat(day),dt.time(13,30),ZoneInfo('Asia/Taipei')).timestamp()),'close':close,'volume':volume} for day,close,volume in rows]
    age=now.timestamp()-history[-1]['time']
    if not 0<=age<=7*86400:raise ValueError('行情過期或日期異常，暫不生成解析')
    return {'symbol':item['symbol'],'name':item['name'],'price':rows[-1][1],'asOf':history[-1]['time'],'tradeDate':rows[-1][0],'history':history,'demo':False,'source':'FinMind · 日收盤'}


def run(value,output):
    token=os.environ.get('GEMINI_API_KEY')
    if not token:raise ValueError('尚未設定 GEMINI_API_KEY')
    directory=sync_catalog()
    if directory['status']!='ready':raise ValueError('無法確認完整台股名錄，請稍後再試')
    item=resolve(value,directory['items'])
    now=dt.datetime.now(dt.timezone.utc)
    q=quote(item,FinMindProvider().daily(item['symbol'],(now.date()-dt.timedelta(days=220)).isoformat()),now)
    path=Path(output)/(item['symbol']+'.json');path.parent.mkdir(parents=True,exist_ok=True)
    try:
        old=json.loads(path.read_text())
        age=now.timestamp()-dt.datetime.fromisoformat(old['ai']['generatedAt']).timestamp()
        if old['ai']['status']=='ready' and old['ai']['asOf']==q['asOf'] and 0<=age<86400:
            print('同一行情日的解析仍在 24 小時快取內，未呼叫 AI。');return
    except (OSError,ValueError,KeyError,TypeError):pass
    special=item['symbol'].startswith('00') or any(x in item.get('industry','') for x in ('金融','保險','ETF','受益'))
    if special:
        financial={'symbol':item['symbol'],'status':'not_applicable','metrics':[],'reason':'ETF／金融業不套用一般企業財報比率，需另核對持股或產業專屬指標。'}
    else:
        data={};errors={}
        for kind in ('income','balance','cash','revenue'):
            try:data[kind]=fetch_statement(item['symbol'],kind)
            except Exception:errors[kind]='unavailable'
        financial=make_report(item['symbol'],data,errors)
    ai=generate(q,financial,token,os.environ.get('GEMINI_MODEL') or 'gemini-2.5-flash')
    path.write_text(json.dumps({'quote':q,'financial':financial,'ai':ai},ensure_ascii=False,allow_nan=False))
    print(item['symbol']+' 解析完成；不是即時行情或自動買入指令。')

if __name__=='__main__':
    import urllib.error
    try:run(os.environ.get('REQUEST_SYMBOL',''),os.environ.get('REPORT_DIR','research-data/reports'))
    except urllib.error.HTTPError as e:
        print('解析未發布：API HTTP '+str(e.code)+'；不重試、不切換付費模型。');raise SystemExit(1)
    except Exception as e:
        # Do not print provider payloads, credentials, or arbitrary exception details.
        print('解析未發布：'+(str(e) if isinstance(e,ValueError) else '資料來源或服務暫不可用'));raise SystemExit(1)
