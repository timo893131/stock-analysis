"""Audit the public Pages deployment. Store metadata only, never financial values."""
import datetime as dt
import json
import math
import urllib.request
from pathlib import Path

BASE = 'https://timo893131.github.io/stock-analysis/'
SYMBOLS = ['2330.TW','2317.TW','2454.TW','2308.TW','2881.TW','0050.TW']


def fetch(path):
    with urllib.request.urlopen(urllib.request.Request(BASE+path,headers={'User-Agent':'Stockroom-Public-Site-Audit/1.0','Cache-Control':'no-cache'}),timeout=30) as response:
        return response.read().decode('utf-8')


def audit(loader=fetch):
    now=dt.datetime.now(dt.timezone.utc)
    result={'checkedAt':now.isoformat(),'url':BASE,'errors':[],'warnings':[],'assets':{},'quotes':[],'financials':[]}
    for path in ('','style.css','app.js','backtest.js','paper.js'):
        try:
            body=loader(path)
            if not body.strip():raise ValueError()
            if path=='' and ('window.STOCKROOM_STATIC=true' not in body or 'financial-results' not in body or 'backtest-results' not in body):
                result['errors'].append('首頁不是預期的靜態財報／回測版本')
            if path=='':result['features']={'paperTrading': 'src="./paper.js"' in body and 'paper-symbol' in body, 'mobileViewport':'viewport-fit=cover' in body}
            result['assets'][path or 'index.html']='ok'
        except Exception:
            result['assets'][path or 'index.html']='failed'
            result['errors'].append('網頁檔案無法讀取：'+(path or 'index.html'))
    try:
        quotes=json.loads(loader('data/quotes.json'))['quotes']
        if not isinstance(quotes,list):raise ValueError()
        if sorted(x.get('symbol','') for x in quotes)!=sorted(SYMBOLS):
            result['errors'].append('行情清單缺漏、重複或仍是空的示範版')
        for q in quotes:
            symbol=q.get('symbol','unknown')
            h=q.get('history',[])
            row={'symbol':symbol,'demo':q.get('demo'),'date':q.get('tradeDate'),'historyRows':len(h),'source':q.get('source'),'syncError':q.get('sync',{}).get('error')}
            result['quotes'].append(row)
            if q.get('demo') is not False or q.get('error') or q.get('dataKind')!='daily':result['errors'].append(symbol+' 不是真實日收盤資料')
            price=q.get('price')
            if not isinstance(price,(int,float)) or not math.isfinite(price) or price<=0:result['errors'].append(symbol+' 價格無效')
            times=[x.get('time') for x in h]
            if len(h)<21 or any(not isinstance(t,(int,float)) for t in times) or times!=sorted(set(times)):
                result['errors'].append(symbol+' 歷史日期或筆數不符')
            if any(not isinstance(x.get('close'),(int,float)) or not math.isfinite(x['close']) or x['close']<=0 for x in h):result['errors'].append(symbol+' 歷史價格無效')
            stamp=q.get('asOf')
            if not isinstance(stamp,(int,float)) or stamp>now.timestamp()+60:result['errors'].append(symbol+' 行情日期異常')
            elif now.timestamp()-stamp>7*86400:result['warnings'].append(symbol+' 行情已超過 7 天，需查核休市或更新中斷')
            if row['syncError']:result['warnings'].append(symbol+' 最近行情同步失敗')
    except Exception:
        result['errors'].append('行情 JSON 無法解析或驗證')
    try:
        reports=json.loads(loader('data/fundamentals.json'))['reports']
        if not isinstance(reports,list):raise ValueError()
        if sorted(x.get('symbol','') for x in reports)!=sorted(SYMBOLS):result['errors'].append('財報清單缺漏或重複')
        for r in reports:
            symbol=r.get('symbol','unknown')
            metrics=r.get('metrics',[])
            count=sum(isinstance(m.get('value'),(int,float)) and math.isfinite(m['value']) for m in metrics)
            result['financials'].append({'symbol':symbol,'status':r.get('status'),'coverage':count,'total':r.get('total'),
                'fetchedAt':r.get('fetchedAt'),'periods':{m.get('key'):m.get('period') for m in metrics},'datasetErrors':r.get('errors',{})})
            if symbol in ('2881.TW','0050.TW'):
                if r.get('status')!='not_applicable':result['errors'].append(symbol+' 應使用特殊產業說明')
            else:
                if count!=6 or r.get('status')!='ready':result['warnings'].append(symbol+f' 財務指標僅 {count}/6 項可用')
                if not r.get('fetchedAt'):result['warnings'].append(symbol+' 尚無財報抓取時間，可能未啟用來源')
                if r.get('errors'):result['warnings'].append(symbol+' 部分財報 API 取得失敗')
                if r.get('pointInTimeSafe') is not False:result['errors'].append(symbol+' 缺少公告日限制標示')
    except Exception:
        result['errors'].append('財報 JSON 無法解析或驗證')
    result['status']='failed' if result['errors'] else 'warning' if result['warnings'] else 'passed'
    return result


if __name__=='__main__':
    result=audit()
    Path('live-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps(result,ensure_ascii=False,indent=2))
