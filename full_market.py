"""Two official bulk closing feeds. These snapshots never pretend to be history."""
import datetime as dt
import json
import math
import os
from pathlib import Path
import re
import urllib.request

SOURCES = {
    'twse': ('上市', 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'),
    'tpex': ('上櫃', 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes'),
}

def number(raw):
    try:
        value = float(str(raw).replace(',', '').strip())
        return value if math.isfinite(value) else None
    except (ValueError, TypeError):
        return None

def date(raw):
    text = str(raw).strip()
    parts = re.findall(r'\d+', text)
    if len(parts) == 1 and len(text) in (7, 8):
        parts = [text[:-4], text[-4:-2], text[-2:]]
    if len(parts) != 3:
        raise ValueError('invalid_date')
    year, month, day = map(int, parts)
    return dt.date(year + 1911 if year < 1911 else year, month, day).isoformat()

def normalize(rows, market, today=None):
    today = today or dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date()
    result = {}
    for row in rows:
        code = str(row.get('Code' if market == 'twse' else 'SecuritiesCompanyCode', '')).strip()
        if not (re.fullmatch(r'\d{4}', code) or re.fullmatch(r'00\d{3,4}[A-Z]?', code)):
            continue
        name = row.get('Name' if market == 'twse' else 'CompanyName')
        if not isinstance(name, str) or not name.strip():
            continue
        try:
            stamp = date(row.get('Date'))
        except ValueError:
            continue
        if stamp > today.isoformat():
            continue
        price = number(row.get('ClosingPrice' if market == 'twse' else 'Close'))
        if price is not None and price <= 0:
            price = None
        delta = number(row.get('Change'))
        previous = price - delta if price is not None and delta is not None else None
        change = delta / previous * 100 if previous is not None and previous > 0 else None
        volume = number(row.get('TradeVolume' if market == 'twse' else 'TradingShares'))
        symbol = code + ('.TW' if market == 'twse' else '.TWO')
        item = {'symbol':symbol, 'name':name.strip(), 'market':SOURCES[market][0],
                'kind':'etf' if code.startswith('00') else 'stock', 'price':price,
                'change':change, 'changeAmount':delta, 'volume':volume if volume is not None and volume >= 0 else None,
                'tradeDate':stamp, 'source':'TWSE OpenAPI' if market == 'twse' else 'TPEx OpenAPI',
                'status':'quoted' if price is not None else 'no_close'}
        if symbol not in result or stamp > result[symbol]['tradeDate']:
            result[symbol] = item
    return sorted(result.values(), key=lambda q:q['symbol'])

def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent':'Stockroom/0.6 (daily market research)', 'Accept':'application/json'})
    with urllib.request.urlopen(request, timeout=40) as response:
        return json.load(response)

def stored():
    try:
        return json.loads((Path(os.environ.get('DATA_DIR','./data')) / 'full-market.json').read_text())
    except (OSError, ValueError):
        return {'status':'unavailable','quotes':[],'markets':{}}

def sync(loader=fetch):
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    previous = stored()
    if not previous.get('quotes'):
        try:
            previous = loader('https://timo893131.github.io/stock-analysis/data/full-market.json')
        except Exception:
            previous = {}
    if not isinstance(previous,dict):previous = {}
    quotes, markets = [], {}
    for market, (label, url) in SOURCES.items():
        try:
            raw = loader(url)
            if not isinstance(raw,list):
                raise ValueError('source_not_array')
            items = normalize(raw,market)
            if len(items) < 100:
                raise ValueError('source_schema_or_coverage:'+','.join(sorted(raw[0].keys())) if raw and isinstance(raw[0],dict) else 'source_schema_or_coverage')
            # Feeds are daily snapshots; a malformed mixed-date response is not complete.
            latest = max(q['tradeDate'] for q in items)
            items = [q for q in items if q['tradeDate'] == latest]
            if len(items) < 100:
                raise ValueError('source_date_coverage')
            markets[market] = {'status':'ready','count':len(items),'tradeDate':latest,'fetchedAt':now,'url':url}
        except Exception as error:
            items = [q for q in previous.get('quotes',[]) if q.get('market') == label]
            meta = previous.get('markets',{}).get(market,{})
            markets[market] = {**meta,'status':'cached' if items else 'unavailable','count':len(items),'url':url,
                               'error':str(error) if isinstance(error,ValueError) else type(error).__name__}
        quotes.extend(items)
    ready = sum(m['status']=='ready' for m in markets.values())
    result = {'status':'ready' if ready == 2 else 'partial' if quotes else 'unavailable',
              'checkedAt':now,'markets':markets,'quotes':quotes,
              'notice':'官方整批日收盤快照；沒有逐筆報價或完整歷史。缺收盤價不以零元替代。快照收錄範圍與行情日期以來源為準。'}
    path = Path(os.environ.get('DATA_DIR','./data')) / 'full-market.json'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result,ensure_ascii=False,allow_nan=False))
    print(json.dumps({'fullMarket':{k:{'status':m['status'],'count':m['count'],'date':m.get('tradeDate'),'error':m.get('error')} for k,m in markets.items()}},ensure_ascii=False))
    return result

if __name__ == '__main__':
    sync()
