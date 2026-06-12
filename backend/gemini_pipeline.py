import os
import sys
import subprocess
import json
import google.genai as genai
from google.genai import types

def run_gemini_pipeline(video_path: str):
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(backend_dir)
    renderer_dir = os.path.join(root_dir, "renderer")
    
    if not os.path.exists(video_path):
        print(f"[ERROR] 找不到輸入影片: {video_path}")
        return

    # 0. 設定 API Key
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
    if not GEMINI_API_KEY:
        print("[ERROR] 找不到 GEMINI_API_KEY 環境變數，請確認是否設定！")
        return
    client = genai.Client(api_key=GEMINI_API_KEY)

    # 1. 複製影片並轉碼為高尋軌精度格式 (All-I-Frame) 以徹底解決播放卡頓與影格抖動
    print("=== Step 0: 複製並轉碼影片 ===")
    public_dir = os.path.join(renderer_dir, "public")
    os.makedirs(public_dir, exist_ok=True)
    target_video_name = "input_target.mp4"
    target_video_path = os.path.join(public_dir, target_video_name)
    
    temp_target_path = os.path.join(public_dir, "input_target_temp.mp4")
    try:
        import shutil
        shutil.copy2(video_path, temp_target_path)
        print("影片複製成功，正在進行轉碼以解決卡頓抖動問題...")
        # 轉碼為 GOP=1 (All-Keyframes), 關閉 B-Frames, 以實現無損尋軌
        cmd_transcode = [
            "ffmpeg", "-y",
            "-i", temp_target_path,
            "-c:v", "libx264",
            "-g", "1",
            "-bf", "0",
            "-crf", "18",
            "-c:a", "aac",
            target_video_path
        ]
        subprocess.run(cmd_transcode, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        os.remove(temp_target_path)
        print("影片轉碼完成（All-I-Frame 尋軌優化）。")
    except Exception as e:
        print(f"處理影片失敗: {str(e)}")
        if os.path.exists(temp_target_path):
            os.remove(temp_target_path)
        return

    # 2. 抽取音訊檔
    print("\n=== Step 1: 正在提取影片音訊 ===")
    temp_audio = os.path.join(backend_dir, "temp_voice.mp3")
    cmd_audio = [
        "ffmpeg", "-y",
        "-i", target_video_path,
        "-vn",
        "-acodec", "libmp3lame",
        "-ar", "16000",
        "-ac", "1",
        temp_audio
    ]
    try:
        subprocess.run(cmd_audio, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print("音訊提取成功。")
    except Exception as e:
        print(f"提取音訊失敗，請確保 ffmpeg 安裝正確: {str(e)}")
        return

    # 讀取音訊以取得精確影片總秒數
    try:
        from pydub import AudioSegment
        sound = AudioSegment.from_file(temp_audio)
        total_duration = len(sound) / 1000.0
        print(f"解析音訊成功。總長度: {total_duration:.2f} 秒")
    except Exception as e:
        print(f"[ERROR] 無會取得音訊長度: {str(e)}")
        if os.path.exists(temp_audio):
            os.remove(temp_audio)
        return

    # 3. 傳送音訊至 Gemini 進行智慧大綱識別 (使用 Inline 傳輸)
    print("\n=== Step 2: 讀取音訊檔案並傳送至 Gemini ===")
    try:
        print(f"正在讀取 {temp_audio} 為二進位數據...")
        with open(temp_audio, "rb") as f:
            audio_bytes = f.read()
        print("音訊檔案讀取成功。")

        print("正在呼叫 gemini-2.5-flash 模型...")
        
        prompt = f"""
        你是一個專業的影片教學語音轉字幕與操作分析器。這是軟體教學影片的音軌。
        這段影片的「總長度為 {total_duration:.2f} 秒」。
        請認真聆聽語音內容，做以下任務並輸出 JSON 格式：
        1. 根據講者說話內容的語意變化，將影片切分成 4 到 8 個有意義的「教學步驟/知識點」區間，標記精確的秒數時間戳 (start 和 end)。
        2. 請將所有的片段標記為 type = "keep"，維持影片原本的完整長度，不要做任何剪裁或剔除。
           - 注意：第一個區間的 start 必須是 0.0。
           - 注意：最後一個區間的 end 必須剛好等於影片總長度 {total_duration:.2f}。
           - 各個區間必須是無縫銜接的。
        3. 為每一個 keep 片段賦予一個有意義的「步驟名稱/知識點標題」寫在 "title" 欄位中（例如：「介紹HTML互動式簡報產生器」、「基本互動與導覽功能演示」、「AI模擬功能展示」等）。請絕對不要使用「步驟 1」、「說話片段 2」這種沒有內容的流水號名稱！
        4. 在適合的地方加上貼紙（sticker 設為 "warning"、"info" 或 "success"）。
        5. 當講者提到任何的滑鼠操作（如滾輪滾動、點擊、拖曳）、鍵盤敲擊或與系統互動的動作時，自動偵測出對應的精確秒數 (time) 與動作描述 (text)，並判斷背景深淺色 (background 可為 "dark" 或 "light")。
           - 滑鼠操作必須以 🖱️ 開頭，例如：「🖱️ 滾動滑鼠滾輪」、「🖱️ 點擊啟動按鈕」、「🖱️ 滑鼠滾輪演示」。
           - 鍵盤操作必須以 ⌨️ 開頭，例如：「⌨️ 鍵盤按上一頁」、「⌨️ 按下一頁」、「⌨️ 按 Esc 鍵」。
           - 其他提示動作以 💡 或 ⚠️ 開頭。
        6. 請進行「精確的逐句聽寫」，輸出一個完整的字幕軌 "subtitles"：
           - 每個字幕項格式為 {{"start": 開始秒數, "end": 結束秒數, "text": "字幕文字"}}。
           - **重要**：每句字幕（"text"）的長度必須限制在 20 個字元以內！如果原本的長句超過 20 字，必須將其拆分成多個短句，並為每個短句對齊精確的語音時間戳 (start 與 end)。
           - 請確保字幕軌 "subtitles" 的時間戳與講者實際說出該段文字的時刻「精確吻合」。話說得快的地方，時間戳區間就短；有停頓的地方，時間戳就避開。
           - 字幕必須包含講者說出的所有話語，不要漏字，也不要自己編造內容，統一使用繁體中文。
        
        JSON 輸出格式必須完全符合以下結構，不要包含 markdown 標籤：
        {{
          "segments": [
            {{
              "start": 0.0,
              "end": 15.2,
              "type": "keep",
              "subtitle": "大家好，今天我們來介紹如何初始化一個 React 專案。",
              "title": "初始化專案大綱介紹",
              "sticker": "info"
            }}
          ],
          "subtitles": [
            {{
              "start": 0.0,
              "end": 3.2,
              "text": "大家好，今天我們來介紹"
            }},
            {{
              "start": 3.2,
              "end": 7.0,
              "text": "如何初始化一個 React 專案。"
            }}
          ],
          "actions": [
            {{
              "time": 8.5,
              "text": "🖱️ 點擊啟動按鈕",
              "background": "dark"
            }}
          ]
        }}
        
        請注意：
        - title 和 text 必須使用繁體中文，且一定要有實質的操作或知識點說明。
        - 所有的 subtitle 必須使用繁體中文。
        """
        
        import time
        from google.genai.errors import APIError

        response = None
        max_retries = 3
        retry_delay = 25
        
        for attempt in range(max_retries):
            try:
                print(f"正在呼叫 gemini-2.5-flash 模型 (嘗試 {attempt + 1}/{max_retries})...")
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=[
                        types.Part.from_bytes(
                            data=audio_bytes,
                            mime_type="audio/mp3",
                        ),
                        prompt
                    ],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                    ),
                )
                break
            except APIError as e:
                # 判斷是否為 429
                if "429" in str(e) or e.code == 429:
                    print(f"[WARNING] 觸發 Gemini API 限流限制 (429): {str(e)}")
                    if attempt < max_retries - 1:
                        print(f"將在 {retry_delay} 秒後自動重試...")
                        time.sleep(retry_delay)
                    else:
                        raise e
                else:
                    print(f"[WARNING] 呼叫 Gemini 遭遇 API 錯誤: {str(e)}")
                    if attempt < max_retries - 1:
                        print(f"將在 10 秒後重試...")
                        time.sleep(10)
                    else:
                        raise e
            except Exception as e:
                print(f"[WARNING] 呼叫 Gemini 遭遇非預期錯誤: {str(e)}")
                if attempt < max_retries - 1:
                    print(f"將在 10 秒後重試...")
                    time.sleep(10)
                else:
                    raise e
        
        analysis_result = json.loads(response.text)
        print("Gemini 語意大綱識別結果成功取得！")
        
    except Exception as e:
        print(f"[ERROR] 呼叫 Gemini 失敗: {str(e)}")
        if 'response' in locals() and response and hasattr(response, 'text'):
            failed_log = os.path.join(backend_dir, "temp_failed_response.txt")
            try:
                with open(failed_log, "w", encoding="utf-8") as f_err:
                    f_err.write(response.text)
                print(f"[DEBUG] 已將原始 Response 寫入至 {failed_log}")
            except Exception as write_err:
                print(f"[DEBUG] 寫入 Response 失敗: {str(write_err)}")
        if os.path.exists(temp_audio):
            os.remove(temp_audio)
        sys.exit(1)

    # 清除本地臨時音訊
    if os.path.exists(temp_audio):
        os.remove(temp_audio)

    # 4. 寫入 Props 並進行嚴格的時間軸驗證 (Sanitization)
    print("\n=== Step 3: 寫入 Remotion input-props.json ===")
    raw_segments = analysis_result.get("segments", [])
    
    # 進行時間軸整理防呆
    def sanitize_segments(segments, total_dur):
        if not segments:
            return [{"start": 0.0, "end": total_dur, "type": "keep", "subtitle": None, "title": "教學影片", "sticker": None}]
        
        # 依 start 排序
        segments.sort(key=lambda x: float(x.get("start", 0.0)))
        
        sanitized = []
        current_time = 0.0
        
        for i, seg in enumerate(segments):
            start = max(0.0, float(seg.get("start", 0.0)))
            end = float(seg.get("end", 0.0))
            
            # 防呆：確保 end > start
            if end <= start:
                if i == len(segments) - 1:
                    end = total_dur
                else:
                    end = start + 5.0
            
            # 無縫連接上一個區間
            if start != current_time:
                start = current_time
                
            if start >= total_dur:
                break
                
            if end > total_dur:
                end = total_dur
                
            sanitized.append({
                "start": round(start, 3),
                "end": round(end, 3),
                "type": "keep",
                "subtitle": seg.get("subtitle"),
                "title": seg.get("title"),
                "sticker": seg.get("sticker")
            })
            current_time = end
            if current_time >= total_dur:
                break
                
        # 補滿剩餘長度
        if current_time < total_dur:
            sanitized.append({
                "start": round(current_time, 3),
                "end": round(total_dur, 3),
                "type": "keep",
                "subtitle": None,
                "title": None,
                "sticker": None
            })
            
        return sanitized

    segments = sanitize_segments(raw_segments, total_duration)
    
    # 提取知識點時間軸
    knowledge_points = []
    for seg in segments:
        if seg.get("title"):
            knowledge_points.append({
                "time": seg["start"],
                "title": seg["title"],
                "sticker": seg.get("sticker")
              })
              
    # 提取 actions 時間軸並做防呆排序
    raw_actions = analysis_result.get("actions", [])
    actions = []
    for act in raw_actions:
        try:
            t = float(act.get("time", 0.0))
            if 0.0 <= t <= total_duration:
                actions.append({
                    "time": round(t, 2),
                    "text": act.get("text", "").strip(),
                    "background": act.get("background", "dark").strip() # 智慧亮/暗背景
                })
        except Exception:
            continue
    actions.sort(key=lambda x: x["time"])

    # 提取精確的字幕列表
    raw_subtitles = analysis_result.get("subtitles", [])
    subtitles_list = []
    for sub in raw_subtitles:
        try:
            s_time = float(sub.get("start", 0.0))
            e_time = float(sub.get("end", 0.0))
            txt = sub.get("text", "").strip()
            if txt and s_time < e_time:
                subtitles_list.append({
                    "start": round(s_time, 2),
                    "end": round(e_time, 2),
                    "text": txt
                })
        except Exception:
            continue
    subtitles_list.sort(key=lambda x: x["start"])

    props_path = os.path.join(renderer_dir, "src", "input-props.json")
    with open(props_path, "w", encoding="utf-8") as f:
        json.dump({
            "videoPath": target_video_name,
            "edl": segments,
            "knowledgePoints": knowledge_points,
            "actions": actions,
            "subtitles": subtitles_list
        }, f, ensure_ascii=False, indent=2)
    print("寫入成功。")

    # 5. 渲染最終影片
    print("\n=== Step 4: 呼叫 Remotion 進行最終影片渲染 ===")
    output_video = os.path.join(backend_dir, "auto_edited_output.mp4")
    cmd_render = [
        "npx", "remotion", "render",
        "HelloWorld",
        output_video.replace("\\", "/"),
        f"--props={props_path.replace('\\', '/')}"
    ]
    
    try:
        print(f"開始渲染，輸出路徑: {output_video}")
        subprocess.run(cmd_render, cwd=renderer_dir, shell=True, check=True)
        print("\n[SUCCESS] AI 智慧剪輯與渲染成功！")
        print(f"請播放影片觀看效果: {output_video}")
    except Exception as e:
        print(f"渲染失敗: {str(e)}")
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("請傳入影片路徑")
    else:
        run_gemini_pipeline(sys.argv[1])
