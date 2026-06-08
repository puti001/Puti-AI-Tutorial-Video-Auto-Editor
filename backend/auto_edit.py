import os
import sys
import subprocess
import json
from pydub import AudioSegment
from pydub.silence import detect_nonsilent

def analyze_and_edit(video_path: str):
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(backend_dir)
    renderer_dir = os.path.join(root_dir, "renderer")
    
    if not os.path.exists(video_path):
        print(f"[ERROR] 找不到輸入影片: {video_path}")
        return

    # 複製影片到 Remotion public 資料夾以避開 Chromium 本地資源安全性限制
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

    # 1. 抽取音訊檔
    print("\n=== Step 1: 正在提取影片音訊 ===")
    temp_audio = os.path.join(backend_dir, "temp_voice.wav")
    cmd_audio = [
        "ffmpeg", "-y",
        "-i", target_video_path, # 使用複製後的影片進行音訊分離
        "-vn",
        "-acodec", "pcm_s16le",
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

    # 2. 本地音訊分析 (靜音偵測)
    print("\n=== Step 2: 正在進行靜音片段偵測 (Offline Silence Detection) ===")
    try:
        sound = AudioSegment.from_wav(temp_audio)
        
        # 偵測非靜音區間 (參數可調：無聲超過 1000ms，音量低於 -40dBFS)
        # detect_nonsilent 回傳毫秒單位的 list of [start, end]
        min_silence_len = 1000  # 1 秒
        silence_thresh = -40    # -40 dBFS
        
        print(f"正在偵測無聲區間 (閾值: {silence_thresh}dBFS, 最小長度: {min_silence_len}ms)...")
        nonsilent_ranges = detect_nonsilent(
            sound, 
            min_silence_len=min_silence_len, 
            silence_thresh=silence_thresh
        )
        
        total_duration_sec = len(sound) / 1000.0
        print(f"影片總長度: {total_duration_sec:.2f} 秒")
        print(f"偵測到非靜音段落數量: {len(nonsilent_ranges)}")
        
    except Exception as e:
        print(f"分析音訊失敗: {str(e)}")
        if os.path.exists(temp_audio):
            os.remove(temp_audio)
        return

    # 3. 將非靜音段落轉換為 EDL JSON
    # 邏輯：
    # - 任何在 nonsilent_ranges 裡的區間都標為 "keep"
    # - 區間之間的空隙都標為 "cut"
    print("\n=== Step 3: 建立 EDL 剪輯決策 ===")
    edl = []
    last_end = 0.0

    for idx, (start_ms, end_ms) in enumerate(nonsilent_ranges):
        start_sec = start_ms / 1000.0
        end_sec = end_ms / 1000.0

        # 如果跟上一個 keep 之間有空隙，那段空隙也保留 (型態設為 keep)
        if start_sec > last_end:
            edl.append({
                "start": last_end,
                "end": start_sec,
                "type": "keep",
                "subtitle": None,
                "title": None,
                "sticker": None
            })

        # 這一片是 keep
        # 自動為 keep 加上基本的字幕提示（例如當講者在說話時）
        edl.append({
            "start": start_sec,
            "end": end_sec,
            "type": "keep",
            "subtitle": f"說話片段 #{idx + 1}",
            "title": f"步驟 {idx + 1}" if idx % 3 == 0 else None,
            "sticker": "info" if idx % 4 == 0 else None
        })
        last_end = end_sec

    # 處理最後剩餘的影片結尾，同樣保留
    if last_end < total_duration_sec:
        edl.append({
            "start": last_end,
            "end": total_duration_sec,
            "type": "keep",
            "subtitle": None,
            "title": None,
            "sticker": None
        })

    # 清理臨時音訊檔
    if os.path.exists(temp_audio):
        os.remove(temp_audio)

    # 4. 寫入 Remotion Props 並且包含 knowledgePoints 欄位
    knowledge_points = []
    for seg in edl:
        if seg.get("title"):
            knowledge_points.append({
                "time": seg["start"],
                "title": seg["title"],
                "sticker": seg.get("sticker")
            })
            
    props_path = os.path.join(renderer_dir, "src", "input-props.json")
    print("寫入 Remotion input-props.json...")
    with open(props_path, "w", encoding="utf-8") as f:
        json.dump({
            "videoPath": target_video_name,
            "edl": edl,
            "knowledgePoints": knowledge_points
        }, f, ensure_ascii=False, indent=2)

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
        print("\n[SUCCESS] 自動剪輯影片成功！")
        print(f"請播放影片觀看效果: {output_video}")
    except Exception as e:
        print(f"渲染失敗: {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("請傳入影片檔案路徑。例如: python auto_edit.py 'D:/video.mp4'")
    else:
        analyze_and_edit(sys.argv[1])
