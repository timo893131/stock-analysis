"""Daily market data adapter and persistent cache; no provider requests on page views."""
import datetime as dt
import json
import math
import os
import sqlite3
import urllib.parse
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

STOCKS = {'2330.TW': '台積電', '2317.TW': '鴻海', '2454.TW': '聯發科', '2308.TW': '台達電', '2881.TW': '富邦金', '0050.TW': '元大台灣50'}
TZ = ZoneInfo('Asia/Taipei')

def connect():
    path = Path(os.environ.get('DATA_DIR', './data')) / 'market.sqlite3'
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=30)
    db.execute('PRAGMA journal_mode=WAL')
    db.executescript('''CREATE TABLE IF NOT EXISTS prices(symbol TEXT, day TEXT, close REAL, volume INTEGER, PRIMARY KEY(symbol,day));
    CREATE TABLE IF NOT EXISTS updates(symbol TEXT PRIMARY KEY, success TEXT, attempt TEXT, error TEXT);''')
    return db

class FinMindProvider:
    """Documented TaiwanStockPrice API; account/redistribution rights remain user responsibilities."""
    name = 'FinMind'
    def daily(self, symbol, start):
        query = urllib.parse.urlencode({'dataset': 'TaiwanStockPrice', 'data_id': symbol.split('.')[0], 'start_date': start})
        token = os.environ.get('FINMIND_TOKEN')
        headers = {'User-Agent': 'Stockroom/0.2', 'Accept': 'application/json'}
        if token:
            headers['Authorization'] = 'Bearer ' + token
        req = urllib.request.Request('https://api.finmindtrade.com/api/v4/data?' + query, headers=headers)
        with urllib.request.urlopen(req, timeout=30) as response:
            payload = json.load(response)
        if payload.get('status') != 200:
            raise ValueError('provider_rejected_request')
        rows = []
        for row in payload.get('data', []):
            if row.get('stock_id') != symbol.split('.')[0]:
                raise ValueError('unexpected_symbol')
            day = dt.date.fromisoformat(row['date'])
            price, volume = float(row['close']), int(row['Trading_Volume'])
            if not math.isfinite(price) or price <= 0 or volume < 0 or day > dt.datetime.now(TZ).date():
                raise ValueError('invalid_price_row')
            rows.append((day.isoformat(), price, volume))
        if not rows:
            raise ValueError('no_daily_data')
        return rows

def sync(provider=None):
    provider = provider or FinMindProvider()
    outcomes = {}
    with connect() as db:
        for symbol in STOCKS:
            latest = db.execute('SELECT MAX(day) FROM prices WHERE symbol=?', (symbol,)).fetchone()[0]
            start = (dt.date.fromisoformat(latest) - dt.timedelta(days=7) if latest else dt.datetime.now(TZ).date() - dt.timedelta(days=200)).isoformat()
            stamp = dt.datetime.now(dt.timezone.utc).isoformat()
            try:
                rows = provider.daily(symbol, start)
                db.executemany('INSERT INTO prices VALUES(?,?,?,?) ON CONFLICT(symbol,day) DO UPDATE SET close=excluded.close,volume=excluded.volume', [(symbol, *row) for row in rows])
                db.execute('INSERT INTO updates VALUES(?,?,?,NULL) ON CONFLICT(symbol) DO UPDATE SET success=excluded.success,attempt=excluded.attempt,error=NULL', (symbol, stamp, stamp))
                db.commit()
                outcomes[symbol] = 'ok'
            except Exception:
                db.rollback()
                db.execute('INSERT INTO updates VALUES(?,NULL,?,?) ON CONFLICT(symbol) DO UPDATE SET attempt=excluded.attempt,error=excluded.error', (symbol, stamp, 'sync_failed'))
                db.commit()
                outcomes[symbol] = 'sync_failed'
    return outcomes

def quotes():
    result = []
    with connect() as db:
        for symbol, name in STOCKS.items():
            rows = db.execute('SELECT day,close,volume FROM prices WHERE symbol=? ORDER BY day DESC LIMIT 130', (symbol,)).fetchall()[::-1]
            status = db.execute('SELECT success,attempt,error FROM updates WHERE symbol=?', (symbol,)).fetchone()
            if not rows:
                result.append({'symbol': symbol, 'error': '尚無已同步行情，請先執行每日更新。'})
                continue
            history = [{'time': int(dt.datetime.combine(dt.date.fromisoformat(day), dt.time(13,30), TZ).timestamp()), 'close': price, 'volume': volume} for day, price, volume in rows]
            price = rows[-1][1]
            previous = rows[-2][1] if len(rows)>1 else None
            result.append({'symbol': symbol, 'name': name, 'price': price, 'previous': previous, 'change': (price / previous - 1)*100 if previous else 0,
                'history': history, 'asOf': history[-1]['time'], 'tradeDate': rows[-1][0], 'currency': 'TWD', 'source': 'FinMind · 日收盤',
                'demo': False, 'dataKind': 'daily', 'tradable': False, 'analysisReady': len(rows)>=21, 'sync': {'lastSuccess': status[0] if status else None, 'lastAttempt': status[1] if status else None, 'error': status[2] if status else None}})
    return result
