import os
import re
import json

def parse_srt_time(time_str):
    parts = time_str.strip().replace(',', '.').split(':')
    hours = float(parts[0])
    minutes = float(parts[1])
    seconds = float(parts[2])
    return hours * 3600 + minutes * 60 + seconds

def clean_chinese_spaces(text):
    text = text.strip()
    result = []
    i = 0
    while i < len(text):
        char = text[i]
        if char in [' ', '\u3000']:
            if i > 0 and i < len(text) - 1:
                prev_char = text[i-1]
                next_char = text[i+1]
                # 兩側是英數且為 ASCII 英數才保留空格
                if prev_char.isalnum() and next_char.isalnum():
                    if ord(prev_char) < 128 and ord(next_char) < 128:
                        result.append(' ')
        else:
            result.append(char)
        i += 1
    return "".join(result)

def split_long_text(text, start, end, max_len=20):
    text = clean_chinese_spaces(text)
    if not text:
        return []
    
    if len(text) <= max_len:
        return [{"start": start, "end": end, "text": text}]
    
    # 超過 max_len，按標點符號與空白拆分
    clauses = re.split(r'([，。？！；、\s+])', text)
    chunks = []
    current_chunk = ""
    for part in clauses:
        if not part:
            continue
        if part in ['，', '。', '？', '！', '；', '、', ' ']:
            current_chunk += part
        else:
            if current_chunk and len(current_chunk) + len(part) > max_len:
                chunks.append(current_chunk.strip())
                current_chunk = ""
            current_chunk += part
            
    if current_chunk.strip():
        chunks.append(current_chunk.strip())
        
    final_chunks = []
    for chunk in chunks:
        if len(chunk) <= max_len:
            final_chunks.append(chunk)
        else:
            rem = chunk
            while len(rem) > 0:
                final_chunks.append(rem[:max_len])
                rem = rem[max_len:]
                
    total_len = sum(len(c) for c in final_chunks)
    if total_len == 0:
        return []
        
    duration = end - start
    subtitles = []
    curr_start = start
    for chunk in final_chunks:
        chunk_dur = duration * (len(chunk) / total_len)
        subtitles.append({
            "start": round(curr_start, 2),
            "end": round(curr_start + chunk_dur, 2),
            "text": chunk
        })
        curr_start += chunk_dur
    return subtitles

def main():
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(backend_dir)
    srt_path = os.path.join(root_dir, "output_subs.srt")
    props_path = os.path.join(root_dir, "renderer", "src", "input-props.json")
    
    if not os.path.exists(srt_path):
        print(f"[ERROR] 找不到 SRT 字幕檔: {srt_path}")
        return
        
    if not os.path.exists(props_path):
        print(f"[ERROR] 找不到 input-props.json: {props_path}")
        return

    # 讀取 SRT 檔
    with open(srt_path, "r", encoding="utf-8-sig") as f:
        content = f.read()
        
    blocks = re.split(r'\n\s*\n', content.strip())
    subtitles_list = []
    
    for block in blocks:
        lines = [line.strip() for line in block.split('\n') if line.strip()]
        if len(lines) < 3:
            continue
        time_line = None
        text_lines = []
        for line in lines:
            if "-->" in line:
                time_line = line
            elif time_line:
                text_lines.append(line)
                
        if time_line and text_lines:
            time_parts = time_line.split("-->")
            start = parse_srt_time(time_parts[0])
            end = parse_srt_time(time_parts[1])
            text = " ".join(text_lines)
            
            split_subs = split_long_text(text, start, end, max_len=20)
            subtitles_list.extend(split_subs)

    # 讀取並更新 input-props.json
    with open(props_path, "r", encoding="utf-8") as f:
        props = json.load(f)
        
    props["subtitles"] = subtitles_list
    props["videoPath"] = "input_target.mp4" # 使用轉碼後的 GOP=1 影片
    
    with open(props_path, "w", encoding="utf-8") as f:
        json.dump(props, f, ensure_ascii=False, indent=2)
        
    print(f"[SUCCESS] 成功解析 {len(subtitles_list)} 條精確字幕並寫入 input-props.json！")

if __name__ == "__main__":
    main()
