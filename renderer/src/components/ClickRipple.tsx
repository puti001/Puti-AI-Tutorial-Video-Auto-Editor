import React from "react";
import { spring, interpolate } from "remotion";

interface ClickRippleProps {
  localFrame: number;
  fps: number;
  x?: number; // 螢幕絕對座標 X (1920 基準)
  y?: number; // 螢幕絕對座標 Y (1080 基準)
  background?: "dark" | "light"; // 畫面背景亮度
}

export const ClickRipple: React.FC<ClickRippleProps> = ({
  localFrame,
  fps,
  x = 960,
  y = 540,
  background = "dark", // 預設深色簡報背景，渲染白色波紋
}) => {
  const duration = 25; // 點擊波紋動畫持續 25 影格 (約 0.8 秒)

  if (localFrame < 0 || localFrame > duration) {
    return null;
  }

  // 1. 滑鼠指針進入與點擊時的輕微縮放動畫
  const clickSpring = spring({
    frame: localFrame,
    fps,
    config: {
      damping: 10,
      stiffness: 200,
    },
  });

  // 指標縮放 (從 0.8 稍微壓一下到 1.0)
  const cursorScale = interpolate(clickSpring, [0, 0.2, 1], [0.8, 1.1, 1]);

  // 2. 波紋 1 動畫
  const ripple1Progress = spring({
    frame: localFrame,
    fps,
    config: {
      damping: 15,
      stiffness: 80,
    },
  });

  const ripple1Scale = interpolate(ripple1Progress, [0, 1], [0.3, 2.5]);
  const ripple1Opacity = interpolate(ripple1Progress, [0, 0.8, 1], [1, 0.8, 0]);

  // 3. 波紋 2 動畫 (延遲 4 影格)
  const ripple2Progress = spring({
    frame: Math.max(0, localFrame - 4),
    fps,
    config: {
      damping: 15,
      stiffness: 80,
    },
  });

  const ripple2Scale = interpolate(ripple2Progress, [0, 1], [0.3, 2.0]);
  const ripple2Opacity = interpolate(ripple2Progress, [0, 0.8, 1], [1, 0.7, 0]);

  // 根據背景亮暗決定雙色波紋配色
  // 背景深色 -> 白色波紋；背景淺色 -> 藍色波紋
  const isDarkBg = background === "dark";
  const ripple1Color = isDarkBg ? "#ffffff" : "#1d4ed8";
  const ripple1Glow = isDarkBg ? "#ffffff" : "#2563eb";
  const ripple2Color = isDarkBg ? "#e2e8f0" : "#3b82f6";
  const ripple2Glow = isDarkBg ? "#cbd5e1" : "#60a5fa";

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-20px, -20px)",
        zIndex: 100,
        pointerEvents: "none",
      }}
    >
      {/* 同心圓波紋 1 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          border: `3px solid ${ripple1Color}`,
          boxShadow: `0 0 12px ${ripple1Glow}`,
          transform: `scale(${ripple1Scale})`,
          opacity: ripple1Opacity,
          boxSizing: "border-box",
        }}
      />

      {/* 同心圓波紋 2 */}
      <div
        style={{
          position: "absolute",
          left: 5,
          top: 5,
          width: "30px",
          height: "30px",
          borderRadius: "50%",
          border: `2px solid ${ripple2Color}`,
          boxShadow: `0 0 8px ${ripple2Glow}`,
          transform: `scale(${ripple2Scale})`,
          opacity: ripple2Opacity,
          boxSizing: "border-box",
        }}
      />

      {/* 精緻滑鼠指針圖標 */}
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        style={{
          transform: `scale(${cursorScale})`,
          filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.4))",
        }}
      >
        <path
          d="M4 3l14 10.5-5.5.8L17 20l-3 1.5-4.5-5.7L6 17V3z"
          fill="#ffffff"
          stroke="#000000"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
