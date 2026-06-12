import React from "react";
import { spring, interpolate } from "remotion";

interface MappedSegment {
  finalStartFrame: number;
  durationFrames: number;
  sticker?: string | null;
}

interface StickerOverlayProps {
  mappedSegments: MappedSegment[];
  frame: number;
  fps: number;
}

export const StickerOverlay: React.FC<StickerOverlayProps> = ({
  mappedSegments,
  frame,
  fps,
}) => {
  // 逆向尋找最後一個符合的 segment，以支援重疊時顯示最新的
  const currentSeg = [...mappedSegments].reverse().find(
    (seg) =>
      frame >= seg.finalStartFrame &&
      frame < seg.finalStartFrame + seg.durationFrames
  );

  if (!currentSeg || !currentSeg.sticker) {
    return null;
  }

  const localFrame = frame - currentSeg.finalStartFrame;
  const displayDuration = 150; // 顯示 5 秒 (30fps)

  if (localFrame > displayDuration) {
    return null;
  }

  // 彈跳動畫
  const scaleValue = spring({
    frame: localFrame,
    fps,
    config: {
      damping: 12,
      stiffness: 120,
    },
  });

  const exitValue = spring({
    frame: localFrame - (displayDuration - 15),
    fps,
    config: {
      damping: 15,
    },
  });

  const scale = interpolate(scaleValue, [0, 1], [0, 1]);
  const opacity = interpolate(exitValue, [0, 1], [1, 0]);

  // 定義貼紙樣式
  let stickerText = "";
  let stickerBg = "";
  let stickerBorder = "";
  let emoji = "";

  const stickerType = currentSeg.sticker.toLowerCase();
  if (stickerType === "warning") {
    stickerText = "⚠️ 注意操作";
    stickerBg = "rgba(245, 158, 11, 0.2)";
    stickerBorder = "1px solid rgba(245, 158, 11, 0.4)";
  } else if (stickerType === "success") {
    stickerText = "✅ 執行完成";
    stickerBg = "rgba(16, 185, 129, 0.2)";
    stickerBorder = "1px solid rgba(16, 185, 129, 0.4)";
  } else {
    stickerText = "💡 提示說明";
    stickerBg = "rgba(59, 130, 246, 0.2)";
    stickerBorder = "1px solid rgba(59, 130, 246, 0.4)";
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 60,
        right: 60,
        transform: `scale(${scale})`,
        opacity,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          background: stickerBg,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: stickerBorder,
          padding: "12px 24px",
          borderRadius: "16px",
          color: "#ffffff",
          fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
          fontSize: "24px",
          fontWeight: 700,
          boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.3)",
          letterSpacing: "0.5px",
        }}
      >
        {stickerText}
      </div>
    </div>
  );
};
