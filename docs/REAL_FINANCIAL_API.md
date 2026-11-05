# 啟用真實財報 API

1. 到 https://finmindtrade.com/ 建立帳號或登入，依官方帳戶頁取得 API token。確認所選方案可使用 TaiwanStockFinancialStatements、TaiwanStockBalanceSheet、TaiwanStockCashFlowsStatement、TaiwanStockMonthRevenue；不預設免費帳戶包含所有資料或公開再散布權限。
2. 儲存庫 Settings → Secrets and variables → Actions → Secrets → New repository secret，名稱 FINMIND_TOKEN，值填入 token。若已存在，使用 Update；不要另建重複名稱或把值放到 Variables、原始碼、聊天。
3. Actions → Check real financial API (no publication) → Run workflow。首次新增此 workflow 的 push 也會自動觸發一次檢查。摘要只顯示狀態、日期、筆數及必要欄位，不發布財報數值。
4. 四個資料集成功且六項指標可計算後，另確認供應商允許公開展示，再設定 Actions Variables：MARKET_DATA_PUBLIC_DISPLAY=true、FUNDAMENTALS_PUBLIC_DISPLAY=true。
5. 執行 Publish Stockroom (free Pages)，取消 demo 勾選。發布成功後看財務健檢來源、期間與覆蓋率，不以頁面更新時間當作財報公告日。

檢查失敗時，將 Summary 貼給維護者即可，不要貼 token。沒有 token 不一定代表無法讀取；401/403/供應商錯誤也不能直接證明需要付費，應核對帳戶與官方限制。程式不購買任何 API 方案。

目前使用的是 FinMind 的財報資料 API，不是 Goodinfo HTML 爬蟲。財報期間截止日不等於公告日，因此未作為歷史選股回測輸入。ETF 與金融股不套用一般企業指標。
