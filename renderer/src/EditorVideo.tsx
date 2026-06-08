import React from "react";
import { AbsoluteFill, Video, useCurrentFrame, useVideoConfig, staticFile, spring, interpolate } from "remotion";
import { StickerOverlay } from "./components/StickerOverlay";
import { PapayaTitleCard } from "./components/PapayaTitleCard";
import { KeystrokeOverlay, ActionItem } from "./components/KeystrokeOverlay";
import { SubtitleOverlay, SubtitleItem } from "./components/SubtitleOverlay";

export interface EditSegment {
  start: number;       // 秒
  end: number;         // 秒
  type: "keep" | "cut";
  subtitle?: string | null;
  title?: string | null;
  sticker?: string | null;
}

export interface EditorVideoProps {
  videoPath: string;
  edl: EditSegment[];
  knowledgePoints?: { time: number; title: string; type?: string; sticker?: string | null }[];
  actions?: ActionItem[];
  subtitles?: SubtitleItem[];
}

export const EditorVideo: React.FC<EditorVideoProps> = ({ videoPath, edl, knowledgePoints, actions, subtitles }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 1. 篩選需要保留的片段 (全片保留)
  const keepSegments = edl.filter((s) => s.type === "keep");

  // 2. 計算每個保留片段在最終影片中的時間軸位置
  let currentAccumulatedFrame = 0;
  const mappedSegments = keepSegments.map((segment) => {
    const durationSec = segment.end - segment.start;
    const durationFrames = Math.round(durationSec * fps);
    const startFrame = currentAccumulatedFrame;
    
    currentAccumulatedFrame += durationFrames;

    return {
      ...segment,
      finalStartFrame: startFrame,
      durationFrames,
      originalStartFrame: Math.round(segment.start * fps),
      originalEndFrame: Math.round(segment.end * fps),
    };
  });

  // 3. 智慧局部變焦 (SmartZoom) 特效計算 (4特效之一)
  const currentSegIndex = mappedSegments.findIndex(
    (seg) =>
      frame >= seg.finalStartFrame &&
      frame < seg.finalStartFrame + seg.durationFrames
  );

  const currentSeg = currentSegIndex !== -1 ? mappedSegments[currentSegIndex] : null;

  // 判斷是否為複雜操作步驟，需要自動變焦放大
  const shouldZoom = currentSegIndex === 1 || currentSegIndex === 3;

  let zoomFrame = 0;
  if (shouldZoom && currentSeg) {
    const entryFrame = frame - currentSeg.finalStartFrame;
    const exitThreshold = currentSeg.durationFrames - 30;
    if (entryFrame > exitThreshold) {
      zoomFrame = Math.max(0, 30 - (entryFrame - exitThreshold));
    } else {
      zoomFrame = entryFrame;
    }
  }

  // 變焦 spring 動畫
  const zoomSpring = spring({
    frame: zoomFrame,
    fps,
    config: {
      damping: 18,
      stiffness: 80,
    },
  });

  const zoomProgress = Math.max(0, Math.min(1, zoomSpring));

  // 局部放大 1.15 倍，並往上平滑偏移 30px
  const videoScale = interpolate(zoomProgress, [0, 1], [1, 1.15]);
  const videoTranslateY = interpolate(zoomProgress, [0, 1], [0, -30]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {/* 滿版影片播放區域 (100% 流暢播放) */}
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Video
          src={videoPath.startsWith("http") || videoPath.startsWith("/") ? videoPath : staticFile(videoPath)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            transform: `scale(${videoScale}) translateY(${videoTranslateY}px)`,
          }}
        />
      </AbsoluteFill>

      {/* Papaya 風格字卡與動作熱鍵提示疊加 (頂部) */}
      <PapayaTitleCard
        mappedSegments={mappedSegments}
        frame={frame}
        fps={fps}
        knowledgePointsCount={knowledgePoints?.length}
      />
      
      <KeystrokeOverlay 
        actions={actions} 
        frame={frame} 
        fps={fps} 
      />
      
      <StickerOverlay 
        mappedSegments={mappedSegments} 
        frame={frame} 
        fps={fps} 
      />

      {/* 底部字幕疊加元件 */}
      <SubtitleOverlay
        mappedSegments={mappedSegments}
        subtitles={subtitles}
        frame={frame}
        fps={fps}
      />
    </AbsoluteFill>
  );
};
