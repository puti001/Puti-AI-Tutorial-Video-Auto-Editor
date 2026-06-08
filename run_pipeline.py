import os
import sys
import shutil
import subprocess

def run_cmd(cmd, cwd=None):
    print(f"[RUNNING] {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    res = subprocess.run(cmd, cwd=cwd, shell=True)
    if res.returncode != 0:
        print(f"[ERROR] 執行失敗，Exit Code: {res.returncode}")
        sys.exit(res.returncode)

def check_system_dependencies():
    """
    檢查系統環境是否已安裝必要工具：FFmpeg, Node.js, npm
    """
    missing = []
    for tool in ["ffmpeg", "node", "npm"]:
        if shutil.which(tool) is None:
            missing.append(tool)
            
    if missing:
        print("\n" + "="*60)
        print("[ERROR] 您的本機系統缺少必要的環境套件，無法執行自動剪輯！")
        print("請先安裝以下工具並加入系統環境變數 (PATH) 中：")
        print("="*60)
        for m in missing:
            if m == "ffmpeg":
                print(" 📌 FFmpeg  -> 用於影片轉碼與音軌提取。")
                print("              下載路徑: https://ffmpeg.org/ 或是使用 Windows winget: `winget install Gyan.FFmpeg`\n")
            elif m in ["node", "npm"]:
                print(" 📌 Node.js -> 用於 Remotion 動畫渲染與合成。")
                print("              下載路徑: https://nodejs.org/ 或是使用 Windows winget: `winget install OpenJS.NodeJS`\n")
        print("="*60 + "\n")
        sys.exit(1)

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    renderer_dir = os.path.join(root_dir, "renderer")

    # 1. 檢查系統級別相依性 (FFmpeg, Node, npm)
    check_system_dependencies()

    # 2. 取得輸入影片路徑
    if len(sys.argv) < 2:
        print("[ERROR] 請提供原始影片的檔案路徑！")
        print("用法: python run_pipeline.py <原始影片路徑> [是否有SRT字幕，預設 True]")
        print("範例: python run_pipeline.py \"../my_video.mp4\"")
        sys.exit(1)
        
    video_path = sys.argv[1]
    use_srt = True
    if len(sys.argv) >= 3:
        use_srt = sys.argv[2].lower() in ["true", "1", "yes"]

    # 3. 檢查環境變數
    if "GEMINI_API_KEY" not in os.environ:
        print("[WARNING] 偵測到未設定 GEMINI_API_KEY 環境變數！")
        print("請確保您已設定 API 金鑰，否則分析流程將退回 Mock 測試模式。")

    # 4. 確保 Python 虛擬環境與依賴已安裝
    venv_dir = os.path.join(backend_dir, "venv")
    pip_exe = os.path.join(venv_dir, "Scripts", "pip") if os.name == "nt" else os.path.join(venv_dir, "bin", "pip")
    python_exe = os.path.join(venv_dir, "Scripts", "python") if os.name == "nt" else os.path.join(venv_dir, "bin", "python")

    if not os.path.exists(venv_dir):
        print("正在建立 Python 虛擬環境...")
        run_cmd([sys.executable, "-m", "venv", "venv"], cwd=backend_dir)
        print("正在安裝 Python 依賴套件...")
        run_cmd([pip_exe, "install", "-r", "requirements.txt"], cwd=backend_dir)
    
    # 5. 確保 Node.js 依賴已安裝
    if not os.path.exists(os.path.join(renderer_dir, "node_modules")):
        print("正在安裝 Remotion 依賴套件...")
        run_cmd(["npm", "install"], cwd=renderer_dir)

    # 6. 執行步驟一：影片轉碼與 Gemini 語意分析
    print("\n--- 步驟 1: 執行影片轉碼與 AI 語意分析 ---")
    run_cmd([python_exe, "gemini_pipeline.py", video_path], cwd=backend_dir)

    # 7. 執行步驟二：原生字幕提取與切分 (如果啟用且 output_subs.srt 存在)
    srt_path = os.path.join(root_dir, "output_subs.srt")
    if use_srt and os.path.exists(srt_path):
        print("\n--- 步驟 2: 提取並同步原生 SRT 字幕 ---")
        run_cmd([python_exe, "extract_srt_subtitles.py"], cwd=backend_dir)
    else:
        print("\n--- 步驟 2: 未偵測到 output_subs.srt，跳過 SRT 字幕覆蓋，將採用 Gemini 語音辨識字幕 ---")

    print("\n[SUCCESS] 教學影片自動剪輯與渲染流水線執行完畢！")
    print(f"成品已產出於: {os.path.join(backend_dir, 'auto_edited_output.mp4')}")

if __name__ == "__main__":
    main()
