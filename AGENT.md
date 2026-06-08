# 🤖 Puti-AI教學影片自動化剪輯技能包 - AI Agent 操作指南

本專案是一個**教學影片自動化剪輯的技能包**。如果你是正在讀取此專案的 AI Agent（例如 Open Code Codex、Antigravity、Cursor 或 Windsurf 等），你可以直接調用本專案根目錄的 **`run_pipeline.py`** 腳本，來幫使用者完成教學影片的一鍵剪輯與視覺渲染。

---

## 🛠️ 你的一鍵任務

當使用者對你說「幫我剪影片」、「自動剪輯」時，請直接在專案根目錄的終端機執行以下命令：

```powershell
python run_pipeline.py "[原始影片檔案路徑]"
```
> 例如：`python run_pipeline.py "Puti-AI HTML互動式簡報產生器-01成果介紹.mp4"`

### 腳本在背後為你自動處理的步驟：
1. **建立環境**：檢查並安裝 Python 的 `venv` 虛擬環境、`requirements.txt` 及前端 `npm install`。
2. **影片轉碼**：使用 `ffmpeg` 將影片轉為 `GOP=1 (All-I-Frame)` 格式以解決 Remotion 渲染抖動。
3. **AI 語意分析**：調用 Gemini 2.5 Flash 提取教學大綱（置於頂部）與偵測滑鼠/鍵盤點擊動作（點擊時產生自適應背景色的波紋特效）。
4. **字幕切分與對齊**：自動將根目錄下的 `output_subs.srt` 提取並切分成每行最大 20 字的白字粗黑描邊字幕。
5. **Remotion 渲染**：自動調用 Remotion Headless 渲染最終成品至 `backend/auto_edited_output.mp4`。

---

## ⚙️ 技術架構說明
- 影片順暢度：必須轉碼為 GOP=1 (All-I-Frame)，解決 `seek` 尋格卡頓。
- 視覺特效：點擊波紋會依據背景色自動切換，大綱卡片在畫面頂部對比顯示。
- 字幕樣式：無底色，大字白字配 3px 粗黑邊。
