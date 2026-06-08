import React from "react";

interface MappedSegment {
  finalStartFrame: number;
  durationFrames: number;
  subtitle?: string | null;
}

interface SubtitleItem {
  start: number;
  end: number;
  text: string;
}

interface SubtitleOverlayProps {
  mappedSegments: MappedSegment[];
  subtitles?: SubtitleItem[];
  frame: number;
  fps: number;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
  mappedSegments = [],
  subtitles = [],
  frame,
  fps,
}) => {
  const currentTime = frame / fps;

  // 1. 優先以獨立字幕軌渲染
  if (subtitles && subtitles.length > 0) {
    const currentSubtitle = subtitles.find(
      (sub) => currentTime >= sub.start && currentTime < sub.end
    );
    if (!currentSubtitle) return null;
    return renderSubtitleBox(currentSubtitle.text);
  }

  // 2. 智慧動態拆分 segment 裡面的長字幕
  // 找出當前播放影格對應的 segment
  const currentSeg = mappedSegments.find(
    (seg) =>
      frame >= seg.finalStartFrame &&
      frame < seg.finalStartFrame + seg.durationFrames
  );

  if (!currentSeg || !currentSeg.subtitle) {
    return null;
  }

  const segStartFrame = currentSeg.finalStartFrame;
  const segDurationFrames = currentSeg.durationFrames;
  const segLocalFrame = frame - segStartFrame;
  
  // 智慧切分字串算法（每句不超過 20 字）
  const fullText = currentSeg.subtitle;
  const segmentsList = splitTextIntoPhrases(fullText, 20);

  if (segmentsList.length === 0) {
    return null;
  }

  // 計算所有短句的總字數
  const totalLength = segmentsList.reduce((sum, p) => sum + p.length, 0);

  // 根據字數比例，為每個短句分配影格數，並決定目前要顯示哪一句
  let accumulatedFrames = 0;
  let activePhrase = "";

  for (let i = 0; i < segmentsList.length; i++) {
    const phrase = segmentsList[i];
    // 此短句分配到的影格數
    const phraseDurationFrames = Math.round((phrase.length / totalLength) * segDurationFrames);
    
    // 確保最後一個句子拿完剩下的所有影格，避免四捨五入誤差
    const isLast = i === segmentsList.length - 1;
    const endFrame = isLast ? segDurationFrames : accumulatedFrames + phraseDurationFrames;

    if (segLocalFrame >= accumulatedFrames && segLocalFrame < endFrame) {
      activePhrase = phrase;
      break;
    }
    accumulatedFrames = endFrame;
  }

  if (!activePhrase) {
    return null;
  }

  return renderSubtitleBox(activePhrase);
};

// 渲染字幕框的共用函數
function renderSubtitleBox(text: string) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 80,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 40,
      }}
    >
      <div
        style={{
          color: "#ffffff",
          fontSize: "44px", // 字幕稍微放大
          fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
          fontWeight: 900, // 超粗體更醒目
          textAlign: "center",
          maxWidth: "95%",
          letterSpacing: "1.5px",
          whiteSpace: "nowrap", // 確保維持在單一行
          // 描邊字效果：白色文字描粗黑邊與陰影
          textShadow: `
            -3px -3px 0 #000,  
             3px -3px 0 #000,  
            -3px  3px 0 #000,  
             3px  3px 0 #000,  
             0px -3px 0 #000,  
             0px  3px 0 #000,  
            -3px  0px 0 #000,  
             3px  0px 0 #000,
             0 8px 16px rgba(0, 0, 0, 0.6)
          `,
        }}
      >
        {text}
      </div>
    </div>
  );
}

// 智慧文字切分函數
// 將一段長句子切分成一個個不超過 maxLen 字的短句，並保留語意完整性
function splitTextIntoPhrases(text: string, maxLen: number = 20): string[] {
  // 1. 先依據句子結束符號（。？！；）拆分成獨立句子，並保留標點
  const sentences = text.split(/([。？！；])/g);
  const rebuiltSentences: string[] = [];
  let currentSentence = "";
  
  for (let i = 0; i < sentences.length; i++) {
    const part = sentences[i];
    if (!part) continue;
    if (/^[。？！；]$/.test(part)) {
      currentSentence += part;
      rebuiltSentences.push(currentSentence);
      currentSentence = "";
    } else {
      if (currentSentence) {
        rebuiltSentences.push(currentSentence);
      }
      currentSentence = part;
    }
  }
  if (currentSentence) {
    rebuiltSentences.push(currentSentence);
  }

  const phrases: string[] = [];

  // 2. 對於每個句子，若長度超過 maxLen，則利用逗號、頓號或空白進一步拆分並重組
  for (const sentence of rebuiltSentences) {
    const trimmedSent = sentence.trim();
    if (!trimmedSent) continue;

    if (trimmedSent.length <= maxLen) {
      phrases.push(trimmedSent);
      continue;
    }

    // 長度大於 maxLen，用逗號、頓號或空白拆分
    const clauses = trimmedSent.split(/([，、\s+])/g);
    let currentPhrase = "";

    for (let i = 0; i < clauses.length; i++) {
      const clausePart = clauses[i];
      if (!clausePart) continue;

      const isMinorPunct = /^[，、\s]$/.test(clausePart);
      if (isMinorPunct) {
        currentPhrase += clausePart;
      } else {
        // 如果加上此子句會超過 maxLen，則先推入前一個積累的短句
        if (currentPhrase && currentPhrase.length + clausePart.length > maxLen) {
          phrases.push(currentPhrase.trim());
          currentPhrase = "";
        }

        // 若單一子句長度大於 maxLen，強制進行字數切分
        if (clausePart.length > maxLen) {
          let rem = clausePart;
          while (rem.length > 0) {
            const chunk = rem.substring(0, maxLen);
            phrases.push(chunk.trim());
            rem = rem.substring(maxLen);
          }
        } else {
          currentPhrase += clausePart;
        }
      }
    }
    if (currentPhrase.trim()) {
      phrases.push(currentPhrase.trim());
    }
  }

  // 過濾掉無效句（僅含標點符號的）
  return phrases.filter(p => p.replace(/[，。？！；、\s]/g, "").length > 0);
}
