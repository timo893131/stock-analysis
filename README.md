# Stockroom 股研社

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

## 免設定的全台股研究入口

使用者不必輸入 Worker 網址或網站存取碼。部署流程使用既有 Cloudflare Secrets 自動部署，將公開網址寫入 `service-config/api.json`，網站自動讀取；舊的本機存取碼會清除。金鑰仍只在 GitHub Secrets 與 Worker Secrets 中。

- 全台股名錄可依名稱／代碼搜尋；選取後按需載入日收盤、技術分析及虛擬練習。資料不足、休市過久或額度不足時會提示。名錄可能含歷史標的，不代表全部目前可交易。
- 首頁「全市場 AI 速覽」採官方整批收盤統計及價量初選候選解說；不是每檔都已完成歷史／財報深度 AI，也不包含即時新聞或報酬預測。顯示有效數／總數、來源日期及實際送模型的候選，資料相同時共用 24 小時快取。
- 單檔 AI 與摘要共用後端每日 10 次 AI 請求；資料 API 共用每日 120 次。持久計數先扣額度再呼叫，失敗也計次，不自動重試或回退付費模型。GitHub 原有排程的 API 用量另外計算。
- 免密碼表示所有訪客共用額度；Origin 限制是瀏覽器來源限制，不是身份驗證。配額用完會停止新增請求，既有行情與快取仍可使用。沒有無限次或一定免費的承諾，仍須遵守服務商帳號方案。
- 主選單為「總覽、找股票、虛擬練習、設定」。設定頁只顯示服務狀態與說明；不再要求連線密碼。個股以走勢、AI／金額、財報、回測、消息分類。原有帳戶與收藏保留。

[管理者部署說明](docs/cloudflare-setup.md)。GitHub 單檔工作流程保留作為備用，不是一般網站操作的必要步驟。

### 新手白話導引

新增不呼叫模型的 `coach.js`：首頁依待成交委託、成交紀錄及最近查看標的提供下一步；個股先顯示白話趨勢、資料日期及研究動作，進階技術數字預設收合。示範／過期資料停用個股練習入口。1,000／3,000／5,000 元按鈕只試算虛擬股數（含費用與預留限制），不足一股不會硬買一股，仍由使用者確認送出。學習頁提供可展開名詞、30 秒委託狀態問答與實作入口。AI 原文按走向、風險、查證分段，保留原始時間；多份既有解讀預設展開第一份，其他按需閱讀。白話導引與問答不呼叫 AI，也不更改帳戶初始資金或成交規則。

### 站內 AI 地區錯誤修復

站內個股與綜合摘要改用 Cloudflare Workers AI binding（`@cf/meta/llama-3.1-8b-instruct-fast`），不再從 Workers 請求 Gemini；GitHub 排程與單檔工作流程仍使用 Gemini。保留每日全站 10 次、失敗也計次及快取限制，單次輸入最多 20,000 字元／輸出 1,200 tokens，不自動重試或轉向付費模型。Workers AI 有每日免費 neurons 額度，與帳戶其他服務共用；實際用量與方案以 Cloudflare 控制台為準，程式不升級付費方案。模型輸出須通過三欄 JSON 檢查才顯示，並保留模型名稱與時間。原有每日計數不會因部署而重置。

### AI 買入參考與第一筆試算

Workers AI 新版回應含 action（consider/wait/avoid/insufficient）及簡短 reason。個股先呈現「可考慮小額分批／先觀察／暫不建議／資料不足」，完整原文收合。舊報告沒有 action 時不補造 AI 建議。金額由瀏覽器公式計算，輸入資金不傳給模型：單檔上限 10%、風險額度 1%、假設停損 8%，首筆只取計算股數上限的 30%，含費稅及滑價。不符合 consider、報告過期超過 24 小時、行情日期或代碼不符均試算為零；不足一股不強迫買入。不依 AI 推測報酬或保證停損成交，也不自動下單。

### 全站操作與金額輸入修正

`advice-ui.js` 將每份試算綁定畫面正在顯示的行情與 AI 報告，避免使用另一份全域報告或刷新清掉輸入。提供輸入／change／明確送出按鈕、萬元快捷鍵與虛擬餘額。接受千分位、全形與 NT$ 金額。輸入框旁顯示即時結果；按計算後收起鍵盤並捲至完整結果，零股數與錯誤都有原因。當次資金只保留在記憶體，不寫入網站或模型服務。

`interface.css` 統一狀態色與文字：綠為符合所述條件、黃為留意／等待、藍為資訊、灰為待資料；底色不是漲跌。頁面可展開圖例，漲跌加上明確文字。手機股票清單改為卡片，個股分類保留固定選單，進階風險公式收合；財報、回測、消息、練習與設定統一字級及操作尺寸。

瀏覽器回歸測試：先以 `python3 export_site.py --demo --output /tmp/stockroom-interface-site` 匯出並在 8002 埠啟動靜態伺服器，再安裝／提供 Playwright，執行 `node tests/browser/interface.cjs`。可用 `PLAYWRIGHT_MODULE` 指定模組路徑及 `TEST_SITE_URL` 指定本機測試網址；使用模擬行情，不呼叫真實 AI。

### 上市／上櫃／ETF 整批收盤快照

`full_market.py` 每次每日發布流程各呼叫一次 TWSE `STOCK_DAY_ALL` 與 TPEx `tpex_mainboard_daily_close_quotes` 官方公開端點，過濾本站支援的一般股票／ETF 代碼，保留日期、收盤、漲跌及成交量；這些快照沒有歷史，與 20 檔研究清單分開。ROC／西元日期正規化，未成交或缺價保留 null，不能假裝零元或拿來回測。來源失敗保留已發布的該市場原日期與取得時間，標記 cached／unavailable，不把缺漏當成完整更新。來源回傳不足 100 筆視為異常，實際涵蓋數與日期顯示於網站。

「找股票」預設顯示全市場快照，可分上市／上櫃／ETF、名稱代碼搜尋、漲跌與成交量排序及每頁 30 檔瀏覽。瀏覽快照不消耗 Workers 每日 120 次逐檔資料額度。開啟非研究清單標的的完整歷史／財報／AI 仍需按需載入及既有額度；一鍵 AI 速覽使用全市場收盤統計與價量候選，仍不是逐檔深度掃描。官方快照成功時併入搜尋名錄，API 金鑰不進靜態檔。

### 研究日記與全市場收藏

參考取捨見 [工具比較](docs/tool-comparison.md)。全市場卡片現在可直接收藏，市場篩選選「我的收藏」即可查看，沿用既有收藏欄位。沒有額外收藏 API。

`journal.js`／`journal-ui.js` 新增前瞻研究日記：在全市場按「記錄觀察」，或於 AI 解析按「保存這次判斷」，填入自己的理由及下次要確認的證據。保存當時收盤、日期、來源與可匹配的 AI 原文；後來的報告不覆寫原文。首頁可寫回顧、下載／合併備份，上限 100 筆；損壞資料停止一般寫入，先保留原始備份，確認後才可用有效備份還原。跨分頁寫入會先比對儲存版本，避免靜默覆蓋。紀錄及文字只存在本機，與虛擬帳戶分開，不會送給 AI。

價格比較只用已下載且有效的真實行情，必須為記錄時間之後的新收盤，排除未來、示範、缺價及過期觀察。僅顯示日期與參考價變化，不計勝率或假裝是投資報酬；未調整股利、拆股及交易成本。基準是當時已知的收盤，不是記錄當下即時成交價。匯入紀錄標記使用者資料，不聲稱外部驗證或不可竄改。沒有新查價或模型呼叫。

### 懶人速覽：全市場價量初選 → 深度複核

`static/screener.js` 同時供瀏覽器與 Worker 使用同一組透明規則，從官方整批快照篩選，與既有 20 檔研究清單分開。採最新同一收盤日、來源成功、有效價格／漲跌／成交量；排除過期與未更新來源。候選條件為至少 100 萬股、實際成交金額至少 3,000 萬元、當日漲跌 −1% 至 +3%，排除依名稱及 L/R 代碼辨識的槓桿／反向商品。依成交金額排序，每頁列 6 檔，可翻頁查看該類全部候選。這些是未經效益驗證的初選參數，不是估值、趨勢或買入評分；不符合就沒有候選。金融股併在股票價量篩選，之後仍需產業專屬複核。

AI `/brief` scopeVersion=3 讀取全部有效快照統計，連同股票與 ETF 各最多 4 檔候選送模型，清楚揭露有效數／總數及實際候選；不是全市場逐檔深度 AI。沿用每日共用 10 次限制。舊 20 檔快取不再作為全市場摘要；模型失敗時全市場規則仍可用，既有個股原文只放在明確標記的備用區。未自動載入所有歷史與財報；按複核才使用既有資料 API 額度。發布後以正常額度做一次全市場 AI 實測，不重試、不重置額度，額度不足不阻止靜態頁發布。

全站共用的每日 AI／資料額度以 UTC 日期計數，於臺北時間每日 08:00 重置；部署及升級不重置用量。

### 虛擬委託跨日檢查與自動補載

沿用 `stockroom-paper-v2` 帳戶欄位，不清空或強制轉成持倉。委託依「建立日之後第一個交易日收盤」及限價檢查，成交後仍保留委託紀錄，持倉另行顯示。`pendingInfo` 區分等待後續收盤、等待日收盤發布、缺完整歷史、可檢查結算與裝置日期異常。最早日期只是下一平日提示，遇休市順延；不是交易所日曆承諾。平日臺北 18:20／22:20 為發布排程，未保證準時完成。

開頁、進入虛擬練習及更新資料時，優先檢查持倉／待成交股票，補載缺少的完整歷史。避免重點清單以外的股票重開頁後永遠找不到歷史，無法結算。一次最多 5 檔，單頁自動補載最多 5 檔，其餘用「更新並結算委託」繼續；不查詢所有瀏覽過的股票，不呼叫 AI。仍受共用資料 API 額度限制，失敗顯示具體原因，保留現金、持倉與委託；不拿單日全市場快照冒充完整交易序列。

限價未符時顯示檢查日、收盤與含滑價試算價，轉失效並釋放預留；已知首次後續日零成交量不模擬成交。不把後來符合價格的某天挑成成交日，也不重複執行已成交委託。既有已成交／失效結果不重寫。資料僅存在使用者原本的瀏覽器，部署端無法直接讀取個人帳戶；使用原手機／瀏覽器重新整理後才執行本機檢查。

### 應用程式外殼與 PWA

手機底部分頁、平板導覽列、桌面側欄共用四個主入口。頂部全站搜尋支援 Ctrl／⌘ K、/、方向鍵及 Enter；收藏與最近 8 檔可快速開啟。最近查看只記錄代碼／名稱到本機，不上傳。設定頁提供安裝步驟；支援的瀏覽器可安裝至主畫面，以獨立視窗開啟。iOS Safari 需由分享選單加入主畫面，部分瀏覽器不提供原生安裝提示。

`export_site.py` 產生程式碼版本與精確資產預快取清單，輸出可用的 `sw.js`；PWA 適用於匯出的 HTTPS 靜態網站（含 localhost 測試），一般 WSGI 模式不註冊未編譯的 worker。行情資料不納入應用程式版本，因此每日更新不會反覆提示軟體升級。更新準備好時由使用者套用；未儲存表單會先確認。快取清理只處理應用程式自身的 CacheStorage，不清除帳戶、收藏或研究筆記的 localStorage。

僅預快取應用程式檔案與公開的同源 data/*.json 六種資料；公開資料使用網路優先、成功且格式符合才更新快取。離線或關鍵資料失敗時，回退到原日期的公開快照，明確顯示離線狀態。暫停新增虛擬委託、AI 請求及自動結算，恢復連線後重新取得資料；取消本機委託、筆記與備份仍可操作。不快取跨來源 API、金鑰或私人帳戶，不排隊重送任何 POST。安裝版與瀏覽器資料是否共用依平台而異，安裝前可先備份，首次開啟應確認原帳戶。

PWA 真實瀏覽器測試：`PLAYWRIGHT_MODULE=... TEST_SITE_DIR=/tmp/stockroom-app-site node tests/browser/app-shell.cjs`，需先以該目錄啟動本機靜態伺服器。測試含 service worker 實際安裝、離線重新載入、錯誤資料回退、恢復連線、未儲存輸入保護與更新後資料保留。其他模擬來源的 UI 測試停用 service worker，避免攔截 fixture 路由。

### 未成交委託與重新試算

已結束但未成交的委託統一顯示「未成交」，白話說明限價與結算試算價的差額；買入沒有扣款、賣出沒有賣出持股，預留已釋放。舊 `expired` 紀錄保留，原始結算訊息收合可查。重新試算僅開啟草稿，保留股數／理由，依已取得日收盤重設限價（買入 102%、賣出 98%，可自行改價），不自動送單或追溯成交。有更新快照時先補載歷史，來源失敗不沿用過時資料；離線、同標的待成交及帳戶鎖定時阻擋重複操作。新委託仍須確認，並等新委託日之後首個交易日收盤檢查。

### Hallmark 工作台與練習計畫（2026-11-11）

使用 [Hallmark](https://github.com/nutlope/hallmark) 的應用程式改版流程，保留四大導覽及原有行情／帳戶邏輯，將共用顏色、字體、間距、焦點、觸控與減少動畫規則集中於 `tokens.css`／`base.css`／`workbench.css`。桌面改為橫向導覽，手機／平板採底部選單；刪除裝飾英文眉題，保留所有既有連結、欄位與圖表資訊。

參考 [The Day Trader skill](https://github.com/jakeschincariol/day-trader-skill) 的 trader-exit、trader-budget、trader-risk：新增「個股 → 練習計畫」與「虛擬練習 → 先算練習計畫」。依使用者自填的預算、可承受損失、買入／停損／目標與上限，計算四種股數限制（損失、既有部位、單筆上限、保留現金）。包含費用、賣出稅和假設滑價；以限價與已知收盤價較高者估風險，實際委託仍保留使用者限價。條件未符會說明原因，不自動放寬限制或改價。

試算與保存不會下單。只有使用者選擇帶入草稿並在原虛擬委託表單確認，才建立新的待成交紀錄；既有跨日收盤結算規則不變，停損／目標不會成為自動賣單。輸入或行情更新後重新檢查；此工具不是日內訊號、AI 推薦或最大損失保證。原專案以美股免費非官方盤中來源為主，本次保留股研社既有合法資料 API 路徑，不接入 Yahoo、Alpaca、券商或美股交易時段規則。

計畫獨立保存在 `stockroom-plans-v1`，上限 50 份；總覽顯示最近 5 份與記錄後收盤條件比較，非成交績效。提供下載、驗證後確認取代的匯入、移除確認及跨分頁寫入比對；損壞資料停止寫入且保留原始備份。計畫不送至模型，與原虛擬帳戶／研究日記備份分開。

原始碼／授權見 `THIRD_PARTY_NOTICES.md`；靜態站提供 `third-party-notices.txt`。設計檢查、範圍與限制見 `.hallmark/verification.md`。

### 新手首頁、完整金額與自由虛擬投資（2026-11-12）

手機首頁先顯示全市場價量候選與各股已存在的分析狀態，提供搜尋、全市場 AI、虛擬投資三個入口。前 3 檔只是候選預覽；完整初選仍按全市場資料運作，不以原 20 檔補空。

新增直接以已取得日收盤加不利滑價建立虛擬持倉的「快速」方式，明確區別練習時間與價格來源日；不是盤中即時成交。輸入金額會按整筆預算扣買入費用後換算最大整數股，顯示剩餘零頭，不再強制取單檔 10% 或首筆 30%。下一交易日模式仍可選，舊待成交委託沿用原本規則；不回溯改寫舊成交。

自由練習不受固定 100 萬現金額度限制：確認買入時，若可用現金不足才追加所需的虛擬資金。原帳戶 v2 與初始 100 萬保留；追加另記 `funding`（委託 ID、時間、金額），匯出／匯入一併驗證。累計淨盈虧扣除原始及追加本金，追加不當獲利，賣出不重設本金。取消／未成交時釋放預留，已追加的虛擬資金留在帳戶；有效數字、真實資料日期、持股與重複送出檢查仍保留，不提供虛擬放空。進階風險計畫是可選工具，不限制手動自由練習。

AI 買入判斷與手動金額分開：模型實際回覆 `action`、原因及 `allocationPct`（0/5/10/20/25），只有 consider 能給正比例；其他判斷必須為 0。前端用當地預算換算參考金額，不傳預算或個人帳戶給模型。舊 AI 缺比例就明說，不能套固定公式冒充 AI 建議。一鍵解析會讀取有效報告，缺少判斷／比例時才請求一次生成。`adviceVersion=3` 促使舊個股快取更新一次，不變更共用 10 次 AI／120 次資料預算、不重設額度。部署用一次 2330 個股檢查驗證新欄位，失敗不重試、不切付費模型。
