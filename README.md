# Stockroom 股研室

台股新手研究網站；每日收盤資料、透明技術訊號、收藏與虛擬帳戶。

## Run locally

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
python3 server.py
```

`server.py` is development-only. Production: `.venv/bin/gunicorn --bind 127.0.0.1:8000 wsgi:application` behind an HTTPS proxy.

## Daily data

`python3 sync_market.py` fetches FinMind TaiwanStockPrice into `DATA_DIR/market.sqlite3` (default `./data`). FINMIND_TOKEN is optional in code but may be required by the selected provider plan. Credentials are backend-only. Review current provider terms for storage and public display rights before publication. The former unofficial Yahoo endpoint and Google News RSS retrieval have been removed. News currently links to official resources until a licensed news API is selected.

Quotes are read from the database; visitor requests never consume provider quota. Sync preserves the last successful data on provider failure and exposes date and error state. The Google Cloud timer runs weekday evenings in Taipei; no browser is needed. No missing trading days are invented. Initial backfill is 200 calendar days, with a seven-day overlap on subsequent updates. Corporate actions are not adjusted by this cache; do not treat it as a validated total-return data set.

## Google Cloud

See [deployment instructions](deploy/GOOGLE_CLOUD.md). Includes systemd services/timer and a dedicated-VM bootstrap. Cloud resources, HTTPS, backup automation, and real provider connectivity have not been deployed/verified. Public deployment needs project authorization, domain configuration and appropriate API rights.

## Validation

```sh
python3 -m unittest discover -s tests -p 'test_*.py'
node tests/trading.test.cjs
node --check static/app.js
```

## Current boundaries

- Daily prices are labelled and cannot be used as instant paper fills. The paper account remains browser-local; no login/cloud account synchronization yet.
- 20-day moving average signals and historical volatility scenarios are research aids, not validated forecasts or investment recommendations.
- No strategy backtest engine yet. Plan next: corporate-action-aware data, next-bar execution, transaction costs, benchmark comparison and out-of-sample evaluation.
- Source adapter: `market.py`; scheduler: `sync_market.py`; web: `wsgi.py`; UI: `static/`.
