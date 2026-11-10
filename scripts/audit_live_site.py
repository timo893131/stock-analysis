"""Audit the public Pages deployment. Store metadata only, never financial values."""
import datetime as dt
import json
import math
import os
import urllib.request
from pathlib import Path

BASE = 'https://timo893131.github.io/stock-analysis/'
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from universe import STOCKS, SECTORS, AI_SYMBOLS
SYMBOLS = list(STOCKS)


def fetch(path):
    with urllib.request.urlopen(urllib.request.Request(BASE+path,headers={'User-Agent':'Stockroom-Public-Site-Audit/1.0','Cache-Control':'no-cache'}),timeout=30) as response:
        return response.read().decode('utf-8')


def audit(loader=fetch):
    now=dt.datetime.now(dt.timezone.utc)
    result={'checkedAt':now.isoformat(),'url':BASE,'errors':[],'warnings':[],'assets':{},'quotes':[],'financials':[]}
    for path in ('','style.css','app.js','backtest.js','paper.js','research.js','coach.js','advice-ui.js','interface.css'):
        try:
            body=loader(path)
            if not body.strip():raise ValueError()
            if path=='' and ('window.STOCKROOM_STATIC=true' not in body or 'financial-results' not in body or 'backtest-results' not in body):
                result['errors'].append('首頁不是預期的靜態財報／回測版本')
            if path=='':result['features']={'paperTrading': 'src="./paper.js' in body and 'paper-symbol' in body, 'mobileViewport':'viewport-fit=cover' in body, 'decisionAssist':'id="decision-panel"' in body, 'quickResearch':'id="quick-panel"' in body, 'onDemandAI':'id="ai-dialog"' in body, 'inSiteAPI':'id="api-settings"' in body and 'id="ai-generate"' in body, 'simpleMenu':'data-tab="market"' in body and 'data-tab="settings"' in body, 'publicBrief':'id="brief-run"' in body and 'id="api-key"' not in body, 'clearCalculator':'src="./advice-ui.js' in body and 'id="status-guide"' in body, 'beginnerGuide':'id="plain-insight"' in body and 'data-practice-budget="1000"' in body}
            if path=='' and not all(result['features'].values()):
                result['errors'].append('首頁缺少預期的新功能入口')
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
            if SECTORS.get(symbol) in ('finance','etf'):
                if r.get('status')!='not_applicable':result['errors'].append(symbol+' 應使用特殊產業說明')
            else:
                if count!=6 or r.get('status')!='ready':result['warnings'].append(symbol+f' 財務指標僅 {count}/6 項可用')
                if not r.get('fetchedAt'):result['warnings'].append(symbol+' 尚無財報抓取時間，可能未啟用來源')
                if r.get('errors'):result['warnings'].append(symbol+' 部分財報 API 取得失敗')
                if r.get('pointInTimeSafe') is not False:result['errors'].append(symbol+' 缺少公告日限制標示')
    except Exception:
        result['errors'].append('財報 JSON 無法解析或驗證')
    try:
        ai=json.loads(loader('data/ai.json'))['reports']
        qtimes={q['symbol']:q.get('asOf') for q in quotes}
        result['ai']=[{'symbol':r.get('symbol'),'status':r.get('status'),'reason':r.get('reason'),
            'model':r.get('model'),'generatedAt':r.get('generatedAt'),
            'matchesQuote':r.get('asOf')==qtimes.get(r.get('symbol')),
            'hasText':all(isinstance(r.get(k),str) and bool(r[k].strip()) for k in ('summary','risks','checks'))} for r in ai]
        result['aiReadyCount']=sum(r['status']=='ready' and r['matchesQuote'] and r['hasText'] for r in result['ai'])
        if result['aiReadyCount']<len(AI_SYMBOLS):result['warnings'].append('AI 解讀可用 '+str(result['aiReadyCount'])+'/'+str(len(AI_SYMBOLS))+' 檔（選用功能）')
    except Exception:
        result['aiReadyCount']=0
        result['warnings'].append('AI 解讀尚未提供或格式不符（選用功能）')
    token=os.environ.get('AUDIT_GITHUB_TOKEN')
    if token:
        try:
            def gh(path):
                req=urllib.request.Request('https://api.github.com/repos/timo893131/stock-analysis/'+path,headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','User-Agent':'Stockroom-Audit'})
                with urllib.request.urlopen(req,timeout=20) as response:return json.load(response)
            runs=gh('actions/workflows/pages.yml/runs?per_page=1')['workflow_runs']
            if runs:
                run=runs[0]
                result['latestDeployment']={k:run.get(k) for k in ('id','head_sha','status','conclusion','html_url')}
                jobs=gh('actions/runs/'+str(run['id'])+'/jobs')['jobs']
                result['latestDeployment']['jobs']=[{'name':j['name'],'conclusion':j['conclusion'],'steps':[{'name':x['name'],'conclusion':x['conclusion'],'status':x['status']} for x in j.get('steps',[])]} for j in jobs]
            backend=gh('actions/workflows/deploy-api.yml/runs?per_page=1')['workflow_runs']
            if backend:
                run=backend[0]
                result['backendDeployment']={k:run.get(k) for k in ('id','head_sha','status','conclusion','html_url')}
                jobs=gh('actions/runs/'+str(run['id'])+'/jobs')['jobs']
                result['backendDeployment']['jobs']=[{'name':j['name'],'conclusion':j['conclusion'],'steps':[{'name':x['name'],'conclusion':x['conclusion'],'status':x['status']} for x in j.get('steps',[])]} for j in jobs]
        except Exception:result['deploymentStatusUnavailable']=True
    try:
        catalog=json.loads(loader('data/catalog.json'))
        result['catalog']={'status':catalog.get('status'),'count':len(catalog.get('items',[])),'updatedAt':catalog.get('updatedAt')}
        if catalog.get('status')!='ready':result['warnings'].append('全市場名錄暫時僅提供重點清單')
    except Exception:result['warnings'].append('名錄無法讀取')
    # Inspect only the public API response schema, never provider credentials or raw logs.
    try:
        req=urllib.request.Request('https://stockroom-api.livecap-worker.workers.dev/brief',data=b'{"readOnly":true}',headers={'Content-Type':'application/json','Origin':'https://timo893131.github.io','User-Agent':'Stockroom-Website-Check/1.0'},method='POST')
        try:
            with urllib.request.urlopen(req,timeout=90) as response:
                payload=json.load(response)
                result['publicAPI']={'httpStatus':response.status,'apiRevision':payload.get('apiRevision'),'ready':payload.get('ai',{}).get('status')=='ready' or (payload.get('mode')=='published' and len(payload.get('items',[]))>0),'mode':payload.get('mode'),'fallbackReason':payload.get('reason'),'count':payload.get('count'),'generatedAt':payload.get('ai',{}).get('generatedAt')}
        except urllib.error.HTTPError as error:
            raw=error.read(4096).decode('utf-8',errors='replace')
            try:message=json.loads(raw).get('error','unknown')
            except Exception:message='non_json_response'
            import re
            title=re.search(r'<title>([^<]+)</title>',raw,re.I)
            result['publicAPI']={'httpStatus':error.code,'revision':error.headers.get('X-Stockroom-Revision'),'error':str(message)[:300],'server':error.headers.get('Server'),'contentType':error.headers.get('Content-Type'),'mitigation':error.headers.get('cf-mitigated'),'pageTitle':title.group(1)[:160] if title else None,'plainError':raw[:300] if error.headers.get('Content-Type','').startswith('text/plain') else None}

    except Exception:result['publicAPI']={'error':'network_unavailable'}
    try:
        req=urllib.request.Request('https://stockroom-api.livecap-worker.workers.dev/research',data=b'{"symbol":"2603.TW","ai":false}',headers={'Content-Type':'application/json','Origin':'https://timo893131.github.io','User-Agent':'Stockroom-Website-Check/1.0'},method='POST')
        try:
            with urllib.request.urlopen(req,timeout=140) as response:
                payload=json.load(response);q=payload.get('quote',{})
                result['publicStock']={'httpStatus':response.status,'symbol':q.get('symbol'),'tradeDate':q.get('tradeDate'),'historyCount':len(q.get('history',[])),'verified':q.get('marketVerified'),'financialCoverage':payload.get('financial',{}).get('coverage')}
        except urllib.error.HTTPError as error:
            try:message=json.load(error).get('error','unknown')
            except Exception:message='non_json_response'
            result['publicStock']={'httpStatus':error.code,'error':str(message)[:300]}
    except Exception:result['publicStock']={'error':'network_unavailable'}
    result['status']='failed' if result['errors'] else 'warning' if result['warnings'] else 'passed'
    return result


if __name__=='__main__':
    result=audit()
    Path('live-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps(result,ensure_ascii=False,indent=2))
