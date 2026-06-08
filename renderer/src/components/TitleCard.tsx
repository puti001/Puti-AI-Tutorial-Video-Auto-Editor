import React from "react";
import { spring, interpolate } from "remotion";

interface MappedSegment {
  finalStartFrame: number;
  durationFrames: number;
  title?: string | null;
}

interface TitleCardProps {
  mappedSegments: MappedSegment[];
  frame: number;
  fps: number;
}

export const TitleCard: React.FC<TitleCardProps> = ({
  mappedSegments,
  frame,
  fps,
}) => {
  // 找出當前影格落在哪個 segment
  const currentSeg = mappedSegments.find(
    (seg) =>
      frame >= seg.finalStartFrame &&
      frame < seg.finalStartFrame + seg.durationFrames
  );

  if (!currentSeg || !currentSeg.title) {
    return null;
  }

  const localFrame = frame - currentSeg.finalStartFrame;
  const introDuration = 90; // 顯示 3 秒 (30fps)

  if (localFrame > introDuration) {
    return null;
  }

  // 進場與退場動畫
  const springValue = spring({
    frame: localFrame,
    fps,
    config: {
      damping: 15,
      stiffness: 100,
    },
  });

  const exitValue = spring({
    frame: localFrame - (introDuration - 15), // 最後 15 影格退場
    fps,
    config: {
      damping: 20,
    },
  });

  // 計算 X 軸位移 (從 -400px 滑入到 0px)
  const translateX = interpolate(springValue, [0, 1], [-450, 0]);
  // 計算退場 Opacity (淡出)
  const opacity = interpolate(exitValue, [0, 1], [1, 0]);

  return (
    <div
      style={{
        position: "absolute",
        top: 60,
        left: 60,
        transform: `translateX(${translateX}px)`,
        opacity,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.85) 0%, rgba(168, 85, 247, 0.85) 100%)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          padding: "16px 32px",
          borderRadius: "20px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          color: "#ffffff",
        }}
      >
        <span
          style={{
            fontSize: "16px",
            textTransform: "uppercase",
            letterSpacing: "3px",
            color: "rgba(255, 255, 255, 0.7)",
            fontFamily: "system-ui, sans-serif",
            fontWeight: 700,
            display: "block",
            marginBottom: "4px",
          }}
        >
          當前步驟 Step
        </span>
        <h2
          style={{
            margin: 0,
            fontSize: "42px",
            fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
            fontWeight: 800,
            letterSpacing: "-0.5px",
            background: "linear-gradient(to right, #ffffff, #e0e7ff)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {currentSeg.title}
        </h2>
      </div>
    </div>
  );
};
