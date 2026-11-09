# 啟用全台股站內行情與 AI（一次設定）

目前網站仍可用原本 GitHub Pages；按需服務須先部署 Worker，完成前不會宣稱已連線。

1. 登入 Cloudflare，選擇 Workers 免費方案。記下 **Account ID**。
2. 在個人帳號 API Tokens 建立 **Edit Cloudflare Workers** 範本 Token，限定自己的 Account；保留範本中的 Workers Scripts 等必要權限，不需提供 Global API Key。
3. 到 [GitHub Actions Secrets](https://github.com/timo893131/stock-analysis/settings/secrets/actions)，新增：
   - `CLOUDFLARE_API_TOKEN`：剛建立的 Token。
   - `CLOUDFLARE_ACCOUNT_ID`：自己的 Account ID。
   - `STOCKROOM_ACCESS_KEY`：自訂至少 24 字元的隨機網站存取碼；與 API 金鑰不同。僅供自己在網站登入後端，勿公開。
   - 既有 `FINMIND_TOKEN`、`GEMINI_API_KEY` 沿用，不用在網站輸入。
4. 開啟 [Deploy free Taiwan research API](https://github.com/timo893131/stock-analysis/actions/workflows/deploy-api.yml)，按 Run workflow，分支 main。部署流程會將上述供應商金鑰及存取碼寫入 Worker Secrets。若 Cloudflare 要求建立 workers.dev 子網域，先到 Workers & Pages 完成，再重跑。
5. 成功後從 Cloudflare Workers & Pages → stockroom-api 複製 HTTPS `workers.dev` 網址。
6. 在股研室找到頁面上方「全台股站內服務設定」，填 Worker 網址及 **網站存取碼**，儲存。搜尋 `2603`，點「載入看盤」，再點 AI 解析 →「在網站產生／更新 AI 解析」。之後不用到 GitHub 逐檔執行。

存取碼僅存本次瀏覽器工作階段，網址存本機。公開網站訪客沒有存取碼時不能消耗你的服務配額；不要把存取碼寫進網頁或公開 repo。這是私人工作台存取控制，不是多人會員系統。

## 免費用量與目前範圍

- 使用 Cloudflare Worker 與 SQLite Durable Object；帳號是否符合免費方案及實際限制以 Cloudflare 為準。沒有設定付費升級或付費模型回退。資料／AI 供應商授權仍需涵蓋用途。
- 每 UTC 日上限：120 次 FinMind 請求、10 次 Gemini 請求。Durable Object 在請求前持久化計數，重啟不會重置；失敗也計一次，無自動重試。網站既有排程用量另外計算，這不是整個 Gemini 帳戶的總配額。
- 行情與財報快取 6 小時，AI 在行情快取未更新時保留最多 24 小時。重新取得行情後會重新分析；有效性仍受 7 天行情門檻限制。更新財報不會偽造公告日。
- 依名錄驗證上市／上櫃／ETF，載入至少 60 日歷史收盤與成交量。不是即時行情、不是全市場自動批量掃描；資料不足、歷史名錄、停牌或配額不足時不能保證載入。
- 按需版一般企業先提供營收年增、EPS、現金流三項，其他三項顯示未提供；ETF／金融業不套一般企業比率。沒有盤中 K 線、即時新聞或公司行動調整。
- 新載入標的加入本次頁面的技術分析、懶人評比與虛擬交易；重開網頁後按「更新已載入／持有的其他股票」重新取得行情。原本 20 檔仍定時更新，額外標的不會每分鐘自動消耗 API。
- 虛擬委託只用之後第一筆收盤資料結算。股票型 ETF 稅率 0.1%；以代碼 B 識別的債券 ETF 模型到 2026-12-31 免徵，之後暫按 0.1%，應隨法規更新。未實作券商下單。

驗收：確認長榮載入、資料日期合理、AI 有真實生成時間、虛擬委託沒有當日成交；清除存取碼後確認無法呼叫後端。Worker 日誌不要記錄金鑰、存取碼或持倉資料。
