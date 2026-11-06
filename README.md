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

## 走向解讀、部位試算與選用 AI

個股下方新增研究輔助區：以真實收盤資料的 MA20/MA60、乖離與波動提供透明的規則標籤。標籤不是 AI、上漲機率或個人化買入建議。輸入可用資金、單筆損失比例、假設停損距離與單檔上限，即時計算整股數及成本，取現金／部位上限／損失額度中最小值。停損只是模型假設，不是委託或損失保證。表單資金不送往 AI。

選用 Gemini AI 解讀：在 GitHub Actions Secrets 設 GEMINI_API_KEY；Variables 設 AI_ANALYSIS_ENABLED=true，可另設 GEMINI_MODEL（預設 gemini-2.5-flash，需確認帳戶可用模型及價格）。這些設定需配合真實行情發布，AI 每次工作流程最多處理六檔股票，不是每次開網頁或輸入金額都呼叫。API 免費額度、資料處理條款與費用依供應商帳戶方案，不保證免費。程式不自動購買方案。

`ai_analysis.py` 僅將公開股票資料交給模型，要求輸出走向解說、風險、待查事項；不給模型使用者帳戶、金額或交易紀錄，不要求它生成目標價、勝率或買入金額。輸出通過結構檢查後綁定行情 asOf；前端只顯示相同時間的解讀。未配置／模型失敗／資料不一致時顯示尚未提供，規則計算維持可用。未接即時新聞，AI 仍可能產生錯誤。本機單元測試使用模擬 API 回應，真實模型連線需在設定金鑰後檢查 Actions 摘要。

## 擴充台股覆蓋

`universe.py` 定義 20 檔每日研究清單（上市、上櫃與股票 ETF），所有標的同步歷史行情並支援規則分析、回測與虛擬練習。一般企業取得財報；金融與 ETF 不套用通用財務比率。`AI_SYMBOLS` 維持六檔，避免自動擴大 Gemini 免費額度消耗。

清單依不同產業與研究用途選取，不是以預測勝率、估值或經過驗證的績效排名選出，不能視為值得買入的推薦。

`catalog.py` 每次真實資料建置額外呼叫一次 TaiwanStockInfo，建立可依代號／名稱搜尋的上市、上櫃股票與 00 開頭 ETF 名錄。來源可能包含歷史或已下市名稱，不保證目前全部可交易。名錄搜尋不會逐檔呼叫 API；未納入重點清單的標的只提供官方查詢連結，不偽造行情。失敗時明確退回 20 檔名錄。

日常呼叫量會增加為 20 檔行情及一般企業財報（每家四資料集），AI 仍最多六檔。請依 FinMind 方案額度使用。GitHub Pages 是靜態網站，尚未提供訪客即時查詢任意代號的後端；欲納入深入分析需更新研究清單並重新部署。

### 單檔 AI 解析與懶人速覽

- 名錄中的每檔股票都有「AI 解析」按鈕，可讀取已生成的報告。GitHub Pages 沒有後端，不能安全地在公開網頁直接使用儲存庫的 API 金鑰，因此本版採擁有者觸發：複製代碼 → 開啟 `Analyze one Taiwan stock (free quota)` → `Run workflow` → 填入 `symbol`（如 `2603` 或 `6488.TWO`）→ 完成後回網站「重新讀取」。需要儲存庫寫入權限；一般訪客只能閱讀報告。
- 沿用 `FINMIND_TOKEN`、`GEMINI_API_KEY` 與既有三個授權／啟用 Variables，無需新增金鑰。每次只解析一檔、最多一次 Gemini 呼叫；同一行情日且生成未滿 24 小時時重用報告。每日例行 AI 仍維持六檔，避免全名錄輪詢消耗免費額度。服務商配額以帳號當下規則為準，429 不重試、不切換模型。
- `analyze_stock.py` 重新核對名錄、取得至少 60 筆歷史收盤與可取得的財報；過期行情停止。ETF／金融業不套一般企業財報。報告公開存放 `ai-research` 分支的 `reports/<symbol>.json`，網站透過 GitHub raw 讀取；有快取傳播延遲時稍後再讀取。失敗保留原報告並保留原日期，不會假裝新資料。歷史名錄或資料不足標的可能無法生成。單檔解析不會自動加入每日 20 檔行情或虛擬交易範圍。
- 首頁「懶人速覽」只評比已同步研究清單，不代表全台股市場。一般企業以趨勢 40、波動及距月線 35、三項財報 25 分排序；ETF／金融股以技術面 75 分單獨比較。公式、門檻與資料日期在介面公開。示範、過期行情排除；財報不足或過期不列一般企業優先研究。高分不是勝率、報酬預測或買入指令，也不代表估值便宜。
