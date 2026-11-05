"""Financial health facts, not a recommendation score or point-in-time backtest feed."""
import datetime as dt
import json
import math
import os
import urllib.parse
import urllib.request
from market import STOCKS, TZ, connect

DATASETS = {'income': 'TaiwanStockFinancialStatements', 'balance': 'TaiwanStockBalanceSheet',
            'cash': 'TaiwanStockCashFlowsStatement', 'revenue': 'TaiwanStockMonthRevenue'}


class DatasetError(ValueError):
    def __init__(self, reason):
        self.reason = reason
        super().__init__(reason)


def fetch_statement(symbol, kind):
    query = urllib.parse.urlencode({'dataset': DATASETS[kind], 'data_id': symbol.split('.')[0],
        'start_date': (dt.datetime.now(TZ).date()-dt.timedelta(days=800)).isoformat()})
    headers = {'User-Agent': 'Stockroom/0.3', 'Accept': 'application/json'}
    if os.environ.get('FINMIND_TOKEN'):
        headers['Authorization'] = 'Bearer ' + os.environ['FINMIND_TOKEN']
    with urllib.request.urlopen(urllib.request.Request('https://api.finmindtrade.com/api/v4/data?' + query, headers=headers), timeout=25) as response:
        payload = json.load(response)
    if payload.get('status') != 200:
        status = payload.get('status')
        raise DatasetError('provider_' + str(status) if isinstance(status, int) else 'provider_rejected')
    if not isinstance(payload.get('data'), list):
        raise DatasetError('invalid_schema')
    if not payload['data']:
        raise DatasetError('empty_dataset')
    for row in payload['data']:
        if row.get('stock_id') != symbol.split('.')[0]:
            raise ValueError('unexpected_symbol')
        day = dt.date.fromisoformat(row['date'])
        if day > dt.datetime.now(TZ).date():
            raise ValueError('future_date')
    return payload['data']


def number(value):
    try:
        n = float(value)
        return n if math.isfinite(n) else None
    except (TypeError, ValueError):
        return None


def at_period(rows):
    """Do not silently mix values from different periods or conflicting revisions."""
    if not rows:
        return None, {}
    day = max(row['date'] for row in rows)
    values = {}
    conflicts = set()
    for row in rows:
        if row['date'] != day:
            continue
        key, value = row.get('type'), number(row.get('value'))
        if key in values and values[key] != value:
            conflicts.add(key)
        values[key] = value
    for key in conflicts:
        values[key] = None
    return day, values


def make_report(symbol, data, errors=None):
    metrics = []
    def add(key, label, value, unit, period, formula, explanation):
        metrics.append({'key':key, 'label':label, 'value':value, 'unit':unit, 'period':period,
            'formula':formula, 'explanation':explanation, 'reason':None if value is not None else '資料不足、欄位缺漏或分母不適用'})
    if symbol == '0050.TW':
        return {'symbol':symbol, 'status':'not_applicable', 'reason':'ETF 是一籃子資產，不適用單一公司的財報比率；應另看持股、費用率與追蹤差異。', 'metrics':[]}
    if symbol == '2881.TW':
        return {'symbol':symbol, 'status':'not_applicable', 'reason':'金融業的負債與營收結構不同，本版不套用一般企業健檢；需另評估資本適足率、資產品質等指標。', 'metrics':[]}
    rev = data.get('revenue', [])
    months = {}
    for row in rev:
        try:
            key = (int(row['revenue_year']), int(row['revenue_month']))
            if not 1 <= key[1] <= 12:
                continue
            value = number(row.get('revenue'))
            # Reject ambiguous duplicate months instead of depending on response order.
            if key in months and months[key] != value:
                months[key] = None
            else:
                months[key] = value
        except (KeyError, TypeError, ValueError):
            continue
    current = max(months) if months else None
    now = months.get(current) if current else None
    prior = months.get((current[0]-1,current[1])) if current else None
    yoy = (now/prior-1)*100 if now is not None and prior is not None and prior>0 and now>=0 else None
    add('revenue_yoy','月營收年增率',yoy,'%',f'{current[0]}-{current[1]:02}' if current else None,
        '(本月營收 ÷ 去年同月營收 − 1) × 100%', '看生意是否成長；單月容易受淡旺季與出貨時間影響，不能只看一個月。')
    period, inc = at_period(data.get('income',[]))
    revenue, gross = inc.get('Revenue'), inc.get('GrossProfit')
    margin = gross/revenue*100 if gross is not None and revenue is not None and revenue>0 else None
    add('gross_margin','毛利率',margin,'%',period,'同一財報期間毛利 ÷ 營收 × 100%', '每一元營收扣掉直接成本後剩多少；應與同業及自身歷史比較。')
    add('eps','每股盈餘 EPS',inc.get('EPS'),'元／股',period,'採用來源 EPS，不自行年化或拼接季度', '每股分到多少盈餘；正值不代表股價便宜，單期數字也不等於全年。')
    period, balance = at_period(data.get('balance',[]))
    assets, liabilities = balance.get('TotalAssets'), balance.get('Liabilities')
    debt = liabilities/assets*100 if liabilities is not None and liabilities>=0 and assets is not None and assets>0 else None
    add('debt_ratio','負債比率',debt,'%',period,'同一時點負債總額 ÷ 資產總額 × 100%', '資產中有多少由負債支應；高低需配合產業、償債能力與現金流判讀。')
    ca, cl = balance.get('CurrentAssets'), balance.get('CurrentLiabilities')
    liquidity = ca/cl if ca is not None and ca>=0 and cl is not None and cl>0 else None
    add('current_ratio','流動比率',liquidity,'倍',period,'流動資產 ÷ 流動負債', '比較短期資產與短期負債；資產能否及時變現也很重要。')
    period, cash = at_period(data.get('cash',[]))
    ocf = cash.get('CashFlowsFromOperatingActivities')
    direction = None if ocf is None else 1 if ocf>0 else -1 if ocf<0 else 0
    add('operating_cash','營業現金流方向',direction,'direction',period,'來源營業活動現金流的正負方向，不混用單季與累計金額', '本業是否帶進現金；本版只看來源期間的方向，不推算自由現金流或跨期成長。')
    available = sum(m['value'] is not None for m in metrics)
    return {'symbol':symbol, 'status':'ready' if available==len(metrics) else 'partial' if available else 'unavailable',
        'metrics':metrics, 'coverage':available, 'total':len(metrics), 'source':'FinMind', 'errors':errors or {},
        'publishedAt':None, 'pointInTimeSafe':False,
        'notice':'財報期間截止日不是公告日；本版未取得可驗證公告日，不將這些資料用於歷史選股回測。'}


def init(db):
    db.execute('CREATE TABLE IF NOT EXISTS fundamentals(symbol TEXT PRIMARY KEY, payload TEXT, fetched_at TEXT)')


def sync_financials(fetcher=fetch_statement):
    results = {}
    with connect() as db:
        init(db)
        for symbol in STOCKS:
            data, errors = {}, {}
            if symbol not in ('0050.TW','2881.TW'):
                for kind in DATASETS:
                    try:
                        data[kind] = fetcher(symbol,kind)
                    except Exception:
                        errors[kind] = 'unavailable'
            report = make_report(symbol,data,errors)
            report['fetchedAt'] = dt.datetime.now(dt.timezone.utc).isoformat()
            # Missing fresh data is explicitly unavailable; never disguise an old report as fresh.
            db.execute('INSERT INTO fundamentals VALUES(?,?,?) ON CONFLICT(symbol) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at',
                (symbol,json.dumps(report,ensure_ascii=False,allow_nan=False),report['fetchedAt']))
            results[symbol] = report['status']
    return results


def reports():
    with connect() as db:
        init(db)
        cached = {symbol:json.loads(payload) for symbol,payload in db.execute('SELECT symbol,payload FROM fundamentals')}
    return [cached.get(symbol) or make_report(symbol,{}) for symbol in STOCKS]

if __name__ == '__main__':
    outcomes = sync_financials()
    print(json.dumps(outcomes))
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a') as out:
            out.write('## 財務健檢更新\n\n| 股票 | 狀態 | 可用指標 |\n|---|---|---|\n')
            for report in reports():
                out.write(f"| {report['symbol']} | {report['status']} | {report.get('coverage', 0)} / {report.get('total', 0)} |\n")
            out.write('\npartial / unavailable 表示資料缺漏，不代表公司財務不佳；不作為歷史回測輸入。\n')
