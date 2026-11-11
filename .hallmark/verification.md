# Hallmark 與 Day Trader 升級驗證（2026-11-11）

範圍：股研社六個 app views，保留四個主導覽。素材是現有應用程式；本機截圖／瀏覽器測試使用明確的示範或測試資料，不能當作真實股價證據。

## 使用來源

- hallmark: `7e213cb6feb4ef82733bd66a0600b2e54ca0994c`
- day-trader-skill: `3d0f4ef6986f4984b7c6bd46f7ff4f87744c3abd`

Hallmark 依 app scope / full redesign 工作：保留品牌與操作鉤子、從 brand scaffold 建立共用 tokens/base、記錄 before、執行官方 sloplint 的真實 Chromium render 與 kept 檢查。Codex harness 的設計複核在主執行緒進行，未宣稱另有獨立 reviewer。

Day Trader 使用 trader-budget / trader-risk / trader-exit 的方法，依現有台股日收盤與費稅規則重新實作。未移植美股盤中訊號、Alpaca、Yahoo 擷取或美股交易時段；沒有聲稱已接入原專案全部 11 套工具。

## 機器檢查

{
  "fails": 0,
  "reflex": 0,
  "warns": 0,
  "waived": 0,
  "rejected": 0,
  "answered": 3,
  "dismissed": 1,
  "notes": 0,
  "files": 6,
  "render": "ran",
  "kept": "kept: links 6/6, fields 23/23, headings 36/36, figures 5/5; before 311 FAIL, 236 REFLEX, now 0 FAIL, 0 REFLEX"
}

原頁面保留對照：6/6 連結、23/23 欄位、36/36 標題、5/5 圖表數值物件。新增的練習計畫為功能需求，不屬於被移除的舊欄位。

靜態全目錄另掃描 static/index.html 與所有 CSS。資料及按鈕新功能另用 Playwright 執行，不以靜態檢查代替功能測試。

4 項初始提醒逐項複核：全市場是帶真實股價與來源日期的報價列，不是裝飾圖示格（3）；舊 primary selector 保留相同作用且實際色彩統一（F4）；無框數字列與原生輸入控制採相同樣式以維持操作一致性（F7 兩項）。這些是提醒，不是放棄必要的對比、手機或資料正確性門檻。

## 功能證據

- 69 項 Node 與 33 項 Python 測試通過，包含風險／現金／部位／委託上限、費稅、較高參考價、ETF 稅、原始計畫凍結、後續日期比較與 PWA 檔案完整性。
- Playwright：interface、full-market、market-quick、journal、paper-settlement、planner、app-shell 全部通過。
- 新計畫覆蓋 320/360/390/768/1024/1280/1440/1920 寬度；保存不下單，草稿不扣款，行情變更保留輸入並失效舊試算，無效備份／損壞帳戶不覆寫，重開頁保留計畫。
- 真實 service worker 的離線重開、離線阻擋委託、線上恢復、更新確認與帳戶／研究紀錄保存通過。

## 人工設計複核

較舊版改善：移除裝飾眉題、統一對比與間距，桌面用橫向導覽提供更寬資料區，手機保留固定底部導覽。以帶日期的股票內容與四種可解釋的部位限制作為工作台重心；沒有添加照片、虛構績效或空白裝飾圖。

舊版優點保留：四個熟悉目的地、搜尋與返回、背景色文字說明、原 API 與資料日期、獨立備份。桌面改用頂部導覽會多占一列高度，換得較寬的表格及計畫區；手機沒有增加主選單數量。

本機對照：`.hallmark/compare.html`（before/shots/compare 為本機產物，不納入發布）。

## 限制

所有行情仍是來源所標示的日收盤，並非即時盤中交易。保存計畫與其收盤條件比較不代表已成交、不代表投資報酬，不會建立自動停損單。虛擬帳戶 v2、研究日記 v1 未遷移；計畫另用 stockroom-plans-v1。此更新不增加免費後端限額或模型自動呼叫次數。
