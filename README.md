# Puti-AI教學影片自動化剪輯技能包 (Puti-AI Tutorial Video Auto-Editor Skill Pack)

這是一個結合 **Gemini 2.5 Flash** (語意理解與動作偵測)、**FFmpeg** (影片與音訊預處理)、以及 **Remotion** (React 影片渲染) 的全自動化教學影片剪輯與視覺特效生成工具。

本技能包專為**軟體教學影片**設計，仿照了 *Papaya 電腦教室* 的剪輯風格，旨在讓軟體操作與教學影片看起來更直覺、明瞭且精緻。

---

## 🌟 核心特色
- **教學影片特製**：自動產出教學步驟大綱卡片（頂部）、滑鼠點擊動態波紋、鍵盤操作按鍵視覺提示，極度適合軟體操作教學。
- **尋軌不卡頓**：自動將 MP4 轉碼為 **GOP=1 (All-I-Frame)**，徹底解決 Remotion 逐影格 Headless 渲染時的抖動與不順暢。
- **AI 步驟大綱與動作提示**：自動切割 4-8 個大綱步驟（保留完整影片），並在畫面頂部以對比色展示教學卡片與按鍵/滑鼠操作提示。
- **自適應點擊波紋**：點擊波紋特效會依據影片背景深淺度自動切換顏色（淺背景藍色、深背景白色）。
- **單行聲軌對齊字幕**：從影片音軌/原生字幕提取 SRT，自動平滑切分為每行最大 20 字，並重構為無底色、大字體白字配 3px 粗黑描邊，任何背景下皆清晰易讀。

---

## 🛠️ 事前準備

在使用此工具前，請確保您的系統已安裝並配置以下環境：

1. **FFmpeg**：
   - 必須將 `ffmpeg` 加入系統環境變數中，以便 Python 與 Remotion 呼叫。
2. **Node.js**：
   - 用於 Remotion 影片渲染（推薦 Node.js 18+）。
3. **Python 3.10+**：
   - 用於執行 AI 分析流水線與字幕處理。
4. **Google Gemini API Key**：
   - 申請連結：[Google AI Studio](https://aistudio.google.com/)
   - 點擊 "Get API Key" 並點按 "Create API Key" 生成您的金鑰。

---

## 🚀 快速一鍵安裝與運行

本專案已為 **AI Agent** (如 Open Code Codex, Cursor 等) 與**開發者**設計了根目錄一鍵執行入口 `run_pipeline.py`。

### 1. 配置環境變數
在 Windows PowerShell 中設定您的 API key：
```powershell
$env:GEMINI_API_KEY="您的_GEMINI_API_KEY"
```

### 2. 準備原始檔案
- 將原始 MP4 影片放入專案根目錄，例如命名為 `input.mp4`。
- 如果有原生字幕，請命名為 `output_subs.srt` 放置於根目錄下。

### 3. 一鍵啟動剪輯與渲染
```powershell
python run_pipeline.py "input.mp4"
```
*(此指令會自動初始化虛擬環境、下載後端與前端依賴、完成 GOP=1 轉碼、執行 AI 分析、同步字幕，並進行最終 Remotion 渲染)*

最終渲染好的影片將保存在 `backend/auto_edited_output.mp4`。
