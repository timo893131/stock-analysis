# 股研室開源專案評估

檢查日期：2026-11-05。已讀取 README、授權及代表性程式；未執行第三方專案、未重現其績效，亦未驗證上游資料的公開展示授權。本次沒有匯入第三方程式碼。

| 專案 | 檢查版本 | 程式授權 | 整合建議 |
|---|---|---|---|
| kevin801221/stock-strategies-only | b1110f5b8cdfe3adbffb3c7556095ac3e49f213c | MIT | 優先參考 FinMind 資料層、因子分層、規則理由、Actions 排程；先不導入 Google Sheets、Telegram、完整 Next.js/FastAPI |
| chengwesley/taiwan-stock-analysis | bd69040b835e03eaa93449f9ce5db4824a8235c8 | 檢查版本未找到授權檔 | 參考經營／獲利／健全度三維資訊架構；未獲授權前不複製模板與程式 |
| mlouielu/twstock | 942ea0a2558a9ff7693875fc097babeed2ec0112 | MIT 文字 | 可評估官方資料來源適配器；爬取仍有上游限制，非資料再散布授權 |
| ZhuLinsen/daily_stock_analysis | a52c325fb1389303de23b9826ec1e0190fa309c0 | MIT | 後續參考資料品質、報告與模型分離；台股日線仍依賴 yfinance，不能藉此解決合法行情授權 |
| Weaxs/stock-analysis-plugin | 4aeb5e8993c3f51eac18ffcc6c5fd53bb86f258d | MIT | 參考交易日曆、能力邊界、次日成交與回測規格；完整插件需宿主與多項相依，不直接放入 Pages |

## 重要核查結果

- stock-strategies-only README 首段仍列「TODO: 嚴謹回測機制」，進階 P3 回測引擎標記為規劃中。不能把規劃中的功能視為已完成。
- `stock_strategies/backtest.py` 使用次日開盤進場，但其 future 切片從 idx+2 開始，省略進場日的高低價。停利與停損由整段期間 max/min 判斷；若兩者皆觸及，無論前後順序都計為停損。未在此函式看到手續費／稅／滑價、共享資金或互斥部位計算。屬於歷史訊號統計，不等於可執行投組報酬。
- taiwan-stock-analysis 使用 Goodinfo HTML，第七個 table、CLIENT_KEY cookie 與特定表格結構。網站改版或存取限制會影響結果；程式可下載不代表其程式或 Goodinfo 資料可任意再利用。
- twstock README 提醒上游 request limit；套件來源為 TWSE/TPEX。不要將爬蟲套件描述為有 SLA 的授權行情 API。
- daily_stock_analysis 的 `docs/market-support.md` 明確列台股 .TW/.TWO 日線與基礎行情經 YfinanceFetcher；股票池種子、自動補全及部分大盤分析仍有限制。LLM 與新聞搜尋成本取決於選定服務，不等於 GitHub Actions 免費就全系統免費。
- stock-analysis-plugin README 列台股 yfinance 來源、交易日曆及預設次日開盤回測；部分策略標示 not_validated。這些是值得保留的品質標示，不宜轉成已驗證買入機率。

## 推薦落地順序

1. 完成現有 FinMind Actions 連線檢查與公開展示權限確認；保留日期、來源、失敗狀態與缺值。
2. 財務健檢：營收、EPS、ROE、負債與現金流；每項附財報期間、公布日期、公式及新手說明。金融股／ETF 使用不同適用規則，不能共用所有公司比率。
3. 建立自己的小型確定性回測：訊號日與成交日分離、逐日事件、交易成本、股利拆股處理、資金約束、最大回撤、基準與樣本外區間。所有數字由程式計算並附樣本數。
4. 最後才加 AI 白話解讀；AI 不產生價格或回測數字，缺資料時明示缺資料。

可維持 GitHub Actions 計算、Pages 展示 JSON 的免費架構。未來帳戶雲端同步、即時互動 LLM 與通知服務另行設計。若移植 MIT 程式，須保留作者與授權聲明並固定版本、測試行為。
