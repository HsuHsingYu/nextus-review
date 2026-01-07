# Nexus Review | 年度數位足跡整合復盤工具

**Nexus Review** 是一個隱私優先的個人年度復盤工具。它能將散落在各個平台（ChatGPT, GitHub, Claude, Notion 等）的數位足跡整合在一起，並利用 **Google Gemini** 強大的 AI 分析能力，為你生成每個月的深度成長故事與年度回顧。

![Nexus Review Dashboard](https://img.shields.io/badge/Status-Beta-blue) ![License](https://img.shields.io/badge/License-MIT-green) ![Tech](https://img.shields.io/badge/Built%20With-React%20%2B%20Vite-61DAFB)

## 🔐 資安與隱私聲明 (Security First)

本專案採用 **Client-Side Only (純客戶端)** 架構，這是現代 Web3 與隱私應用常見的設計模式：

1.  **沒有後端資料庫**：我們沒有伺服器來儲存您的 API Key 或對話紀錄。
2.  **直接連線**：您的瀏覽器直接向 Google Gemini API 發送請求，不經過任何中間人。
3.  **開源透明**：所有程式碼公開，您可以檢查 Network 請求，確認 Key 沒有被傳送到 Google 以外的地方。
4.  **高安全性模式**：在輸入 API Key 時，您可以勾選「高安全性模式」，Key 將只存在於記憶體中 (SessionStorage)，**關閉分頁即自動清除**，防止硬碟存取風險。

## ✨ 主要功能

*   **多源匯入**：支援從多種 AI 工具、筆記軟體與開發平台匯入歷史資料。
*   **AI 智能分析**：使用 Google Gemini 模型分析對話意圖，自動判斷活動發生的實際日期與脈絡。
*   **月度故事生成**：自動將破碎的對話紀錄轉化為有溫度的月度復盤文章（包含關鍵事件、人際互動、學習成長）。
*   **視覺化儀表板**：提供年度活動熱力圖、類別分佈與影響力趨勢分析。

## 🔌 支援資料來源

Nexus Review 支援匯入以下平台的匯出檔案 (ZIP/JSON/CSV) 或直接輸入：

| 類別 | 支援平台 | 格式說明 |
| :--- | :--- | :--- |
| **AI 助手** | **ChatGPT** | 官方匯出的 ZIP (包含 `conversations.json`) |
| | **Claude** | 官方匯出的 ZIP/JSON |
| | **Gemini** | JSON 格式 |
| | **NotebookLM** | 文字或 CSV |
| | **Perplexity** | JSON 匯出 |
| **筆記軟體** | **Notion** | CSV / HTML 匯出檔 |
| | **Heptabase** | CSV / JSON |
| **開發工具** | **GitHub** | 輸入 Username 自動抓取公開動態 |
| | **Cursor** | 支援匯入 `state.vscdb` (SQLite) 本地紀錄 |

## 🚀 快速開始 (本地開發)

### 前置需求
*   Node.js (v18 或更高版本)
*   Google Gemini API Key (可至 [Google AI Studio](https://aistudio.google.com/) 免費申請)

### 安裝步驟

1.  **複製專案**
    ```bash
    git clone https://github.com/your-username/nexus-review.git
    cd nexus-review
    ```

2.  **安裝套件**
    ```bash
    npm install
    ```

3.  **啟動開發伺服器**
    ```bash
    npm run dev
    ```

4.  打開瀏覽器前往 `http://localhost:5173` 即可開始使用。

## 🌍 部署指南 (Vercel)

本專案為純前端應用 (SPA)，非常適合部署在 Vercel 上。

1.  將程式碼上傳至你的 **GitHub** Repository。
2.  前往 [Vercel Dashboard](https://vercel.com/dashboard) 點擊 **Add New Project**。
3.  選擇剛剛上傳的 Repository。
4.  **Framework Preset** 選擇 `Vite`。
5.  點擊 **Deploy**。
6.  等待約 1 分鐘，你的專案就上線了！

## 🛠️ 技術棧

*   [React 19](https://react.dev/)
*   [Vite](https://vitejs.dev/)
*   [TypeScript](https://www.typescriptlang.org/)
*   [Tailwind CSS](https://tailwindcss.com/)
*   [Google GenAI SDK](https://www.npmjs.com/package/@google/genai)
*   [Recharts](https://recharts.org/) (圖表繪製)
*   [sql.js](https://sql.js.org/) (解析 Cursor 資料庫)

## 🤝 貢獻

歡迎提交 Issue 或 Pull Request！這是一個開源專案，旨在幫助大家更好地回顧自己的數位生活。

---
Created with ❤️ by Nexus Review Team
