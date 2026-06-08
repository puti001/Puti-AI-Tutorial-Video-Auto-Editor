import os
import shutil
import subprocess
import json
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from typing import List, Optional

# 初始化 FastAPI
app = FastAPI(title="AI Video Editor Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 設定 Gemini API Key
# 優先自環境變數取得
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if not GEMINI_API_KEY:
    # 嘗試從 Windows 系統/使用者環境變數取得
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

class EditSegment(BaseModel):
    start: float  # 秒
    end: float    # 秒
    type: str     # "keep" (保留) 或 "cut" (剪掉)
    subtitle: Optional[str] = None
    title: Optional[str] = None  # 字卡標題
    sticker: Optional[str] = None  # 貼紙類型，如 "warning", "info"

class EDLResponse(BaseModel):
    segments: List[EditSegment]

@app.get("/")
def read_root():
    return {"status": "AI Video Editor API is running"}

@app.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    """
    上傳原始影片，並產出低解析度 Proxy (以利上傳 Gemini)
    """
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # 產出 Proxy 音訊 (Gemini 讀取音訊即可進行高精準度的語意剪輯)
    base_name, _ = os.path.splitext(file.filename)
    audio_path = os.path.join(UPLOAD_DIR, f"{base_name}.mp3")
    
    # 使用 ffmpeg 抽取音訊
    try:
        cmd = [
            "ffmpeg", "-y",
            "-i", file_path,
            "-vn", # 只要音訊
            "-acodec", "libmp3lame",
            "-ar", "16000", # 16kHz 適合語音辨識
            "-ac", "1",     # 單聲道
            audio_path
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except subprocess.CalledProcessError as e:
        return {"filename": file.filename, "file_path": file_path, "warning": "Failed to extract audio. Make sure ffmpeg is installed."}

    return {
        "filename": file.filename,
        "file_path": file_path,
        "audio_path": audio_path
    }

@app.post("/analyze")
async def analyze_video(audio_path: str):
    """
    將音訊上傳至 Gemini API 進行語意分析與剪輯決策。
    如果未設定 GEMINI_API_KEY，將自動退回 Mock 測試模式。
    """
    if not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    if not GEMINI_API_KEY:
        print("[WARNING] GEMINI_API_KEY 未設定，進入 MOCK 模擬剪輯模式。")
        # 模擬產生剪輯決策：保留前 5 秒，剪掉 5~10 秒，保留 10 秒之後的片段
        # 這裡的邏輯可以使用本機的簡單規則（例如 librosa 偵測到的前 5 秒音量）
        return {
            "segments": [
                {
                    "start": 0.0,
                    "end": 5.0,
                    "type": "keep",
                    "subtitle": "這是 Mock 模式：未設定 API Key。我們保留了前 5 秒。",
                    "title": "Mock 階段一",
                    "sticker": "info"
                },
                {
                    "start": 5.0,
                    "end": 10.0,
                    "type": "keep",
                    "subtitle": "這是 Mock 模式：無聲或等待片段同樣保留。",
                    "title": None,
                    "sticker": None
                },
                {
                    "start": 10.0,
                    "end": 60.0,  # 假定影片較長，先給個 60 秒上限，Remotion 會自動對齊實際長度
                    "type": "keep",
                    "subtitle": "這是 Mock 模式：維持影片完整長度！",
                    "title": "Mock 階段二",
                    "sticker": "success"
                }
            ]
        }

    try:
        # 讀取音訊為二進位數據，避開 File API 限流/認證問題
        print(f"Reading {audio_path} for inline Gemini API call...")
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()

        model = genai.GenerativeModel("gemini-2.5-flash")
        
        prompt = """
        你是一個專業的影片教學語音轉字幕與操作分析器。這是軟體教學影片的音軌。
        請認真聆聽語音內容，做以下任務並輸出 JSON 格式：
        1. 根據講者說話內容的語意變化，將影片切分成 4 到 8 個有意義的「教學步驟/知識點」區間，標記精確的秒數時間戳 (start 和 end)。
        2. 請將所有的片段標記為 type = "keep"，維持影片原本的完整長度，不要做任何剪裁或剔除（整部影片的 start 到 end 必須是連續且完整的，加起來等於總長度）。
        3. 為每一個 keep 片段賦予一個有意義的「步驟名稱/知識點標題」寫在 "title" 欄位中（例如：「開啟專案資料夾」、「點擊右鍵以瀏覽器打開」、「介紹 index.html 結構」等）。請絕對不要使用「步驟 1」、「說話片段 2」這種沒有內容的流水號名稱！
        4. 在適合的地方加上貼紙（sticker 設為 "warning"、"info" 或 "success"）。
        5. 當講者提到任何的滑鼠操作（如滾輪滾動、點擊、拖曳）、鍵盤敲擊或與系統互動的動作時，自動偵測出對應的精確秒數 (time) 與動作描述 (text)，並判斷背景深淺色 (background 可為 "dark" 或 "light")。
           - 滑鼠操作必須以 🖱️ 開頭，例如：「🖱️ 滾動滑鼠滾輪」、「🖱️ 點擊啟動按鈕」、「🖱️ 滑鼠滾輪演示」。
           - 鍵盤操作必須以 ⌨️ 開頭，例如：「⌨️ 鍵盤按上一頁」、「⌨️ 按下一頁」、「⌨️ 按 Esc 鍵」。
           - 其他提示動作以 💡 或 ⚠️ 開頭。
        6. 請進行「精確的逐句聽寫」，輸出一個完整的字幕軌 "subtitles"：
           - 每個字幕項格式為 {"start": 開始秒數, "end": 結束秒數, "text": "字幕文字"}。
           - **重要**：每句字幕（"text"）的長度必須限制在 20 個字元以內！如果原本的長句超過 20 字，必須將其拆分成多個短句，並為每個短句對齊精確的語音時間戳 (start 與 end)。
           - 請確保字幕軌 "subtitles" 的時間戳與講者實際說出該段文字的時刻「精確吻合」。話說得快的地方，時間戳區間就短；有停頓的地方，時間戳就避開。
           - 字幕必須包含講者說出的所有話語，不要漏字，也不要自己編造內容，統一使用繁體中文。
        
        JSON 輸出格式必須完全符合以下結構，不要包含 markdown 標籤：
        {
          "segments": [
            {
              "start": 0.0,
              "end": 15.2,
              "type": "keep",
              "subtitle": "大家好，今天我們來介紹如何初始化一個 React 專案。",
              "title": "初始化專案大綱介紹",
              "sticker": "info"
            }
          ],
          "subtitles": [
            {
              "start": 0.0,
              "end": 3.2,
              "text": "大家好，今天我們來介紹"
            },
            {
              "start": 3.2,
              "end": 7.0,
              "text": "如何初始化一個 React 專案。"
            }
          ],
          "actions": [
            {
              "time": 8.5,
              "text": "🖱️ 點擊啟動按鈕",
              "background": "dark"
            }
          ]
        }
        
        請注意：
        - title 和 text 必須使用繁體中文，且一定要有實質的操作或知識點說明。
        - 所有的 subtitle 必須使用繁體中文。
        """
        
        import time
        from google.api_core.exceptions import ResourceExhausted

        response = None
        max_retries = 3
        retry_delay = 25
        
        for attempt in range(max_retries):
            try:
                print(f"Calling Gemini API (Attempt {attempt + 1}/{max_retries})...")
                response = model.generate_content(
                    [
                        {"mime_type": "audio/mp3", "data": audio_bytes},
                        prompt
                    ],
                    generation_config={"response_mime_type": "application/json"}
                )
                break
            except ResourceExhausted as re:
                print(f"[WARNING] 429 Quota Exceeded. Retrying in {retry_delay}s...")
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                else:
                    raise re
            except Exception as e:
                print(f"[WARNING] API Error: {str(e)}")
                if attempt < max_retries - 1:
                    time.sleep(10)
                else:
                    raise e
        
        result = json.loads(response.text)
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/render")
async def render_video(original_video_path: str, edl_data: EDLResponse):
    """
    呼叫 Remotion 進行 headless 渲染，將 EDL 轉換為最終影片
    """
    renderer_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../renderer"))
    props_path = os.path.join(renderer_dir, "src", "input-props.json")
    
    # 從 EDL 段落中自動提取含有標題的知識點節點
    segments = edl_data.model_dump()["segments"]
    knowledge_points = []
    for seg in segments:
        if seg.get("title"):
            knowledge_points.append({
                "time": seg["start"],
                "title": seg["title"],
                "sticker": seg.get("sticker")
            })
            
    with open(props_path, "w", encoding="utf-8") as f:
        json.dump({
            "videoPath": original_video_path,
            "edl": segments,
            "knowledgePoints": knowledge_points
        }, f, ensure_ascii=False, indent=2)
        
    output_video_path = os.path.join(UPLOAD_DIR, "output_final.mp4")
    
    try:
        # 執行 remotion render
        cmd = [
            "npx", "remotion", "render",
            "HelloWorld", # Remotion Composition Name
            output_video_path,
            f"--props={props_path}"
        ]
        
        # 在 Windows 上，需要 shell=True
        subprocess.run(cmd, cwd=renderer_dir, shell=True, check=True)
        
        return {"output_video": output_video_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to render video: {str(e)}")
