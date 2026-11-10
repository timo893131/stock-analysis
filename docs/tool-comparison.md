# 參考與本次設計取捨

檢視日期：2026-11-10。依本機參考副本 README 與可讀取授權整理；不是即時市調，也不據此宣稱其他工具沒有某功能。這次沒有複製第三方程式碼。

| 參考 | 文件呈現的強項 | 在股研社的應用方向 |
| --- | --- | --- |
| [daily_stock_analysis](https://github.com/ZhuLinsen/daily_stock_analysis)（MIT） | 多市場 AI、歷史報告、工作台、持倉及回測 | 保存分析當時的原文與生成時間，讓新手可回頭看原來的依據 |
| [stock-analysis-plugin](https://github.com/Weaxs/stock-analysis-plugin)（MIT） | 因子研究、訊號驗證、部位試算、回測資料口徑與限制 | 把研究、價格變化、實際投資報酬分開；記錄之後才出現的收盤才可拿來比較 |
| [stock-strategies-only](https://github.com/kevin801221/stock-strategies-only)（README 標示 MIT） | 台股選股、觀察清單、Google Sheet 紀錄與排程 | 全市場直接收藏，加上不需新服務或新 API 的本機研究日記 |

這輪實作的價值：建立「當時理由 → 下次要確認的證據 → 後續收盤 → 手動回顧」的流程。價格變化不當成策略勝率，未模擬費稅、股利與拆股；沒有買入也可以記錄觀察。資料只在本機，需備份，並非不可竄改或券商認證紀錄。未新增推播、追蹤 API 或額外模型呼叫。

參考副本版本：

- daily_stock_analysis: a52c325fb1389303de23b9826ec1e0190fa309c0
- stock-analysis-plugin: 4aeb5e8993c3f51eac18ffcc6c5fd53bb86f258d
- stock-strategies-only: b1110f5b8cdfe3adbffb3c7556095ac3e49f213c
