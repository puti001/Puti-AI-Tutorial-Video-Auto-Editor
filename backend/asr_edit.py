import os
import sys
import subprocess
import json
import tempfile
from pydub import AudioSegment
from pydub.silence import detect_nonsilent
import speech_recognition as sr

def run_asr_edit(video_path: str):
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(backend_dir)
    renderer_dir = os.path.join(root_dir, "renderer")
    
    if not os.path.exists(video_path):
        print(f"[ERROR] 找不到輸入影片: {video_path}")
        return

    # Step 0: 複製影片至 Remotion 靜態目錄
    print("=== Step 0: 複製影片至 Remotion 靜態目錄 ===")
    public_dir = os.path.join(renderer_dir, "public")
    os.makedirs(public_dir, exist_ok=True)
    target_video_name = "input_target.mp4"
    target_video_path = os.path.join(public_dir, target_video_name)
    
    try:
        print(f"正在複製影片至 {target_video_path} ...")
        import shutil
        shutil.copy2(video_path, target_video_path)
        print("影片複製成功。")
    except Exception as e:
        print(f"複製影片失敗: {str(e)}")
        return

    # Step 1: 提取 WAV 音訊
    print("\n=== Step 1: 正在提取音訊進行 ASR 分析 ===")
    temp_wav = os.path.join(backend_dir, "temp_asr_voice.wav")
    cmd_audio = [
        "ffmpeg", "-y",
        "-i", target_video_path,
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        temp_wav
    ]
    try:
        subprocess.run(cmd_audio, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print("音訊提取成功。")
    except Exception as e:
        print(f"提取音訊失敗，請確保 ffmpeg 安裝正確: {str(e)}")
        return

    # Step 2: 載入音訊並切分有聲片段進行 ASR
    print("\n=== Step 2: 正在進行繁體中文語音辨識 (Google ASR) ===")
    subtitles = []
    try:
        sound = AudioSegment.from_wav(temp_wav)
        total_duration = len(sound) / 1000.0
        
        # 偵測有聲段落，這樣可以分段進行 ASR，提高辨識成功率並獲得時間戳
        min_silence_len = 800  # 800ms
        silence_thresh = -40   # -40 dBFS
        
        print("偵測有聲段落中...")
        nonsilent_ranges = detect_nonsilent(
            sound, 
            min_silence_len=min_silence_len, 
            silence_thresh=silence_thresh
        )
        
        recognizer = sr.Recognizer()
        
        for idx, (start_ms, end_ms) in enumerate(nonsilent_ranges):
            start_sec = start_ms / 1000.0
            end_sec = end_ms / 1000.0
            
            # 擷取該有聲段落
            chunk = sound[start_ms:end_ms]
            
            # 建立臨時 WAV 檔以便 SpeechRecognition 讀取
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_chunk_file:
                temp_chunk_path = temp_chunk_file.name
            
            try:
                chunk.export(temp_chunk_path, format="wav")
                
                with sr.AudioFile(temp_chunk_path) as source:
                    audio_data = recognizer.record(source)
                
                # 呼叫 Google Speech-to-Text API (免 API Key)
                print(f"正在辨識區間 {start_sec:.2f}s - {end_sec:.2f}s ...")
                text = recognizer.recognize_google(audio_data, language="zh-TW")
                print(f" ├ 辨識結果: {text}")
                
                subtitles.append({
                    "start": start_sec,
                    "end": end_sec,
                    "text": text
                })
            except sr.UnknownValueError:
                print(" ├ 辨識結果: [無法辨識的語音]")
            except sr.RequestError as e:
                print(f" ├ API 請求錯誤: {str(e)}")
            finally:
                if os.path.exists(temp_chunk_path):
                    os.remove(temp_chunk_path)
                    
    except Exception as e:
        print(f"ASR 分析發生錯誤: {str(e)}")
        if os.path.exists(temp_wav):
            os.remove(temp_wav)
        return

    # 清理臨時音訊檔
    if os.path.exists(temp_wav):
        os.remove(temp_wav)

    # Step 3: 建立 EDL (維持原長度，不剪除任何片段)
    print("\n=== Step 3: 建立全片保留 (不剪除) 的 EDL 決策 ===")
    edl = [
        {
            "start": 0.0,
            "end": total_duration,
            "type": "keep",
            "subtitle": None,
            "title": "軟體教學影片",
            "sticker": None
        }
    ]

    # 寫入 Props JSON
    props_path = os.path.join(renderer_dir, "src", "input-props.json")
    print("寫入 Remotion input-props.json...")
    with open(props_path, "w", encoding="utf-8") as f:
        json.dump({
            "videoPath": target_video_name,
            "edl": edl,
            "subtitles": subtitles
        }, f, ensure_ascii=False, indent=2)

    # Step 4: 渲染影片
    print("\n=== Step 4: 呼叫 Remotion 進行最終影片渲染 ===")
    output_video = os.path.join(backend_dir, "auto_asr_output.mp4")
    cmd_render = [
        "npx", "remotion", "render",
        "HelloWorld",
        output_video.replace("\\", "/"),
        f"--props={props_path.replace('\\', '/')}"
    ]
    
    try:
        print(f"開始渲染，輸出路徑: {output_video}")
        subprocess.run(cmd_render, cwd=renderer_dir, shell=True, check=True)
        print("\n[SUCCESS] 語音辨識與字幕渲染成功！")
        print(f"請播放影片觀看效果: {output_video}")
    except Exception as e:
        print(f"渲染失敗: {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("請提供影片路徑")
    else:
        run_asr_edit(sys.argv[1])
