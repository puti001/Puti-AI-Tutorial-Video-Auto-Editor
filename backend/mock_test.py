import os
import subprocess
import json

def run_mock_test():
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(backend_dir)
    renderer_dir = os.path.join(root_dir, "renderer")
    
    input_video = os.path.join(renderer_dir, "public", "test_input.mp4")
    output_video = os.path.join(backend_dir, "output_mock.mp4")
    props_path = os.path.join(renderer_dir, "src", "input-props.json")

    print("=== Step 1: 產生 15 秒帶計時器的測試影片 ===")
    if not os.path.exists(input_video):
        # 使用 ffmpeg 產生帶時間碼的測試影片，方便驗證跳剪
        cmd_ffmpeg = [
            "ffmpeg", "-y",
            "-f", "lavfi",
            "-i", "testsrc=duration=15:size=1920x1080:rate=30",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            input_video
        ]
        try:
            print("執行 FFmpeg 產生影片中...")
            subprocess.run(cmd_ffmpeg, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            print(f"成功產生測試影片: {input_video}")
        except Exception as e:
            print(f"無法產生測試影片，請確保已安裝 ffmpeg。錯誤: {str(e)}")
            return
    else:
        print("測試影片已存在，跳過產生步驟。")

    print("\n=== Step 2: 建立 Mock EDL (Edit Decision List) ===")
    # 總長 15 秒，我們要剪掉中間 5~10 秒
    mock_edl = [
        {
            "start": 0.0,
            "end": 5.0,
            "type": "keep",
            "subtitle": "第一階段：這是前 5 秒的影片，我們可以看到計時器在跑。",
            "title": "測試開始",
            "sticker": "info"
        },
        {
            "start": 5.0,
            "end": 10.0,
            "type": "cut", # 這段將被剪掉
            "subtitle": None,
            "title": None,
            "sticker": None
        },
        {
            "start": 10.0,
            "end": 15.0,
            "type": "keep",
            "subtitle": "第二階段：我們成功跳過了中間 5 秒的等待時間！",
            "title": "剪輯成功",
            "sticker": "success"
        }
    ]

    print("寫入 Remotion input-props.json...")
    with open(props_path, "w", encoding="utf-8") as f:
        json.dump({
            "videoPath": "test_input.mp4", # 使用相對 public 的路徑
            "edl": mock_edl
        }, f, ensure_ascii=False, indent=2)

    print("\n=== Step 3: 啟動 Remotion 渲染 ===")
    cmd_render = [
        "npx", "remotion", "render",
        "HelloWorld",
        output_video.replace("\\", "/"),
        f"--props={props_path.replace('\\', '/')}"
    ]
    
    try:
        print(f"開始渲染最終剪輯影片，輸出路徑: {output_video}")
        # 在 Windows 上執行 npx 需要 shell=True
        subprocess.run(cmd_render, cwd=renderer_dir, shell=True, check=True)
        print("\n[SUCCESS] 影片渲染成功！")
        print(f"請播放 {output_video} 觀看效果，你會發現時間碼在 5 秒處直接跳到 10 秒，且帶有精美的字幕與字卡。")
    except Exception as e:
        print(f"Remotion 渲染失敗。請確保已在 renderer 目錄跑過 npm install。錯誤: {str(e)}")

if __name__ == "__main__":
    run_mock_test()
