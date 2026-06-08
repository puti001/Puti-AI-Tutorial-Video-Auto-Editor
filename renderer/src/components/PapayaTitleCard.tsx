import React from "react";
import { spring, interpolate } from "remotion";

interface MappedSegment {
  finalStartFrame: number;
  durationFrames: number;
  title?: string | null;
}

interface PapayaTitleCardProps {
  mappedSegments: MappedSegment[];
  frame: number;
  fps: number;
  knowledgePointsCount?: number;
}

export const PapayaTitleCard: React.FC<PapayaTitleCardProps> = ({
  mappedSegments,
  frame,
  fps,
  knowledgePointsCount = 0,
}) => {
  // 找出當前影格落在哪個 segment，且該 segment 必須有 title
  const currentSegIndex = mappedSegments.findIndex(
    (seg) =>
      frame >= seg.finalStartFrame &&
      frame < seg.finalStartFrame + seg.durationFrames
  );

  const currentSeg = currentSegIndex !== -1 ? mappedSegments[currentSegIndex] : null;

  if (!currentSeg || !currentSeg.title) {
    return null;
  }

  // 尋找此步驟在所有有 title 的 segment 中的序號
  const titledSegments = mappedSegments.filter(s => s.title);
  const stepNumber = titledSegments.findIndex(s => s.finalStartFrame === currentSeg.finalStartFrame) + 1;
  const totalSteps = knowledgePointsCount || titledSegments.length || 1;

  const localFrame = frame - currentSeg.finalStartFrame;
  const introDuration = 90; // 顯示 3 秒 (30fps)

  if (localFrame > introDuration) {
    return null;
  }

  // 進場動畫 (從上方滑入)
  const springValue = spring({
    frame: localFrame,
    fps,
    config: {
      damping: 15,
      stiffness: 100,
    },
  });

  // 退場動畫 (最後 15 影格退場，往上滑出)
  const exitValue = spring({
    frame: localFrame - (introDuration - 15),
    fps,
    config: {
      damping: 20,
    },
  });

  // 計算 Y 軸位移 (從頂部 -150px 滑入到 0px)
  const translateY = interpolate(springValue, [0, 1], [-150, 0]);
  // 退場時往上滑出且淡出
  const exitTranslateY = interpolate(exitValue, [0, 1], [0, -80]);
  const opacity = interpolate(exitValue, [0, 1], [1, 0]);

  // 進度條動畫 (從 0% 到 100%)
  const progressPercent = Math.min(100, (localFrame / introDuration) * 100);

  return (
    <div
      style={{
        position: "absolute",
        top: 80, // 移動至螢幕上方
        left: 80,
        transform: `translateY(${translateY + exitTranslateY}px)`,
        opacity,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        zIndex: 50,
      }}
    >
      <div
        style={{
          // 高對比亮白色背景
          background: "linear-gradient(135deg, rgba(255, 255, 255, 0.96) 0%, rgba(243, 244, 246, 0.92) 100%)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(15, 23, 42, 0.15)",
          padding: "20px 32px",
          borderRadius: "24px",
          // 與深色背景對比的軟陰影
          boxShadow: "0 20px 40px -10px rgba(15, 23, 42, 0.25), 0 0 30px rgba(37, 99, 235, 0.08)",
          color: "#0f172a", // 深靛藍文字
          fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          minWidth: "340px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* 卡片底部的藍色進度條 */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            height: "5px",
            width: `${progressPercent}%`,
            background: "linear-gradient(to right, #2563eb, #3b82f6)",
            boxShadow: "0 0 8px rgba(37, 99, 235, 0.3)",
            transition: "width 0.05s linear",
          }}
        />

        {/* 步驟標題卡頂部：序號與標籤 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              fontWeight: 800,
              color: "#2563eb", // 深藍色
              letterSpacing: "3px",
              textTransform: "uppercase",
            }}
          >
            教學步驟 Step
          </span>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#475569",
              background: "rgba(15, 23, 42, 0.08)", // 灰色背景
              padding: "4px 10px",
              borderRadius: "12px",
              letterSpacing: "1px",
            }}
          >
            {stepNumber.toString().padStart(2, "0")} / {totalSteps.toString().padStart(2, "0")}
          </span>
        </div>

        {/* 步驟名稱 (深靛藍高質感漸層) */}
        <h2
          style={{
            margin: 0,
            fontSize: "32px",
            fontWeight: 800,
            letterSpacing: "-0.5px",
            background: "linear-gradient(to right, #0f172a, #334155)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            lineHeight: "1.25",
          }}
        >
          {currentSeg.title}
        </h2>
      </div>
    </div>
  );
};
