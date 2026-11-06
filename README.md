# Stockroom 股研室

台股新手研究網站；每日收盤資料、透明技術訊號、收藏與虛擬帳戶。

## 免費網站部署

使用 [GitHub Pages + Actions](deploy/FREE_PAGES.md)。推送 main 的介面更新會自動建置；行情公開展示尚未啟用時發布示範版，已啟用則先同步資料，失敗時保留原網站。

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
node --test --test-isolation=none tests/*.test.cjs
node --check static/app.js
```

## Current boundaries

- Daily prices are labelled and cannot be used as instant paper fills. The paper account remains browser-local; no login/cloud account synchronization yet.
- 20-day moving average signals and historical volatility scenarios are research aids, not validated forecasts or investment recommendations.
- Educational backtest: 20/60-day MA signals, next-trading-day close execution, 20/50/100% cash allocation, fees/tax/slippage, same-allocation buy-and-hold benchmark, drawdown and trade log. No corporate-action adjustments or out-of-sample validation yet; historical results are not forecasts.
- Source adapter: `market.py`; scheduler: `sync_market.py`; web: `wsgi.py`; UI: `static/`.

## 財務健檢

`fundamentals.py` 提供一般企業的月營收年增率、毛利率、來源 EPS、負債比率、流動比率與營業現金流方向。各指標顯示來源期間、公式、缺漏原因，不合成買入分數；ETF、金融股明確標為不適用。現金流只呈現正負方向，避免混用單季與累計金額。

在確認 FinMind 財報資料方案與公開展示權限後，於 GitHub Actions Variables 設 `FUNDAMENTALS_PUBLIC_DISPLAY=true`；配合既有 `MARKET_DATA_PUBLIC_DISPLAY=true`，真實行情部署時才同步財報。這不會購買方案。金鑰沿用 `FINMIND_TOKEN` secret。未啟用、來源拒絕或欄位缺漏時呈現待資料，不生成示範財報。增加四個一般企業各四資料集的請求，需留意供應商額度。

本機同步：`python fundamentals.py`。資料保存在既有 SQLite，網站端只讀取快取；Pages 匯出 `data/fundamentals.json`。來源欄位仍須以實際 API 回應驗證，目前自動測試使用可控資料。財報日期是期間截止日，未取得公告日，不用於歷史選股回測。未實作 ROE、自由現金流或產業常模評分。

## 手機虛擬交易練習（v2）

- 手機底部導覽、可點選股票清單、個股快速跳轉、底部委託面板與持倉卡片。
- 獨立 100 萬元虛擬帳戶，存於 `stockroom-paper-v2`；舊 `stockroom-account` 保留不覆寫。
- 只允許真實且 7 天內的日收盤資料建立委託，不提供放空或槓桿。每個標的最多一筆待成交委託。
- 買入預留「最高買價 × 股數 + 費用」，賣出預留股數。可取消，取消後釋放預留。
- 只檢查臺北委託日期之後第一個有資料的交易日收盤；雙向 0.1% 不利滑價後符合最高買價／最低賣價才成交，不符即失效。這不是盤中觸價限價單。
- 新行情發布後，開啟同一瀏覽器或按更新才會處理待成交委託，不是伺服器常駐撮合。重複重新整理不會重複成交。離線過久使委託參考日超出歷史窗口，則失效，不捏造補成交。
- 手續費 0.1425%，賣出股票稅 0.3%、0050 稅 0.1%；未模擬最低手續費、交易所價格跳動單位、成交量、漲跌停或停牌限制，沒有股利／拆股調整。
- JSON 匯出／匯入可將帳戶移到另一瀏覽器；匯入前驗證格式並要求確認取代。損壞帳戶停止寫入並允許原始備份。不同分頁會檢查舊狀態避免覆蓋。
