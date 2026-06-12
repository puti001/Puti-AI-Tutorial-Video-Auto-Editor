import React from "react";
import { spring, interpolate } from "remotion";

interface MagicPenProps {
  localFrame: number;
  fps: number;
  x?: number;
  y?: number;
}

export const MagicPen: React.FC<MagicPenProps> = ({
  localFrame,
  fps,
  x = 960,
  y = 540,
}) => {
  const duration = 90; // 3 秒 (30fps)

  if (localFrame < 0 || localFrame > duration) {
    return null;
  }

  // 1. 繪製進度 (前 45 影格繪製)
  const drawSpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: 60 },
  });
  
  // 用於繪製路徑的 stroke-dashoffset (從 150 變到 0)
  const strokeDashoffset = interpolate(drawSpring, [0, 0.5], [150, 0], {
    extrapolateRight: "clamp",
  });

  // 2. 消失進度 (後 45 影格淡出)
  const fadeFrame = Math.max(0, localFrame - 45);
  const fadeSpring = spring({
    frame: fadeFrame,
    fps,
    config: { damping: 15, stiffness: 50 },
  });
  const opacity = interpolate(fadeSpring, [0, 1], [0.8, 0]);

  // 3. 雷射筆尖的旋轉螺旋繞圈運動
  const angle = interpolate(localFrame, [0, 45], [0, 360 * 1.5], {
    extrapolateRight: "clamp",
  });
  const radians = (angle * Math.PI) / 180;
  const radius = interpolate(localFrame, [0, 45], [5, 40], {
    extrapolateRight: "clamp",
  });
  const dotX = Math.cos(radians) * radius;
  const dotY = Math.sin(radians) * radius;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50px, -50px)", // 對齊中心點
        width: "100px",
        height: "100px",
        zIndex: 99,
        pointerEvents: "none",
        opacity,
      }}
    >
      {/* 魔法筆發光螺旋線 */}
      <svg width="100" height="100" viewBox="0 0 100 100">
        <defs>
          <filter id="magic-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M 50,50 m -40,0 a 40,40 0 1,0 80,0 a 40,40 0 1,0 -80,0"
          fill="none"
          stroke="#facc15" // 亮黃色
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="150"
          strokeDashoffset={strokeDashoffset}
          filter="url(#magic-glow)"
          style={{
            opacity: 0.85,
          }}
        />
      </svg>

      {/* 模擬雷射畫筆的發光點 */}
      {localFrame < 45 && (
        <div
          style={{
            position: "absolute",
            left: 50 + dotX - 6,
            top: 50 + dotY - 6,
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            backgroundColor: "#fef08a",
            border: "2px solid #eab308",
            boxShadow: "0 0 10px #facc15, 0 0 20px #eab308",
          }}
        />
      )}
    </div>
  );
};
