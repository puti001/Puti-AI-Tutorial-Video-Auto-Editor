import React from "react";
import { spring, interpolate } from "remotion";
import { ClickRipple } from "./ClickRipple";

export interface ActionItem {
  time: number;
  text: string;
  background?: "dark" | "light"; // 智慧亮/暗背景亮度屬性
}

interface KeystrokeOverlayProps {
  actions?: ActionItem[];
  frame: number;
  fps: number;
}

export const KeystrokeOverlay: React.FC<KeystrokeOverlayProps> = ({
  actions = [],
  frame,
  fps,
}) => {
  const currentTime = frame / fps;
  const showDuration = 75; // 顯示 2.5 秒 (30fps)

  // 尋找當前應該顯示的 action
  const activeAction = actions.find((action) => {
    const actionFrame = Math.round(action.time * fps);
    return frame >= actionFrame && frame < actionFrame + showDuration;
  });

  if (!activeAction) {
    return null;
  }

  const actionStartFrame = Math.round(activeAction.time * fps);
  const localFrame = frame - actionStartFrame;

  // 彈出進場動畫 (Pop-in)
  const springValue = spring({
    frame: localFrame,
    fps,
    config: {
      damping: 12,
      stiffness: 120,
      mass: 0.8,
    },
  });

  // 縮回退場動畫
  const exitValue = spring({
    frame: localFrame - (showDuration - 12), // 最後 12 影格退場
    fps,
    config: {
      damping: 15,
    },
  });

  // 計算縮放 (從 0.2 彈到 1)
  const scale = interpolate(springValue, [0, 1], [0.2, 1]);
  // 退場時縮小與淡出
  const exitScale = interpolate(exitValue, [0, 1], [1, 0.7]);
  const opacity = interpolate(exitValue, [0, 1], [1, 0]);

  // 區分是滑鼠還是鍵盤圖示，便於排版
  const text = activeAction.text.trim();
  const isMouse = text.includes("🖱️");
  const isKeyboard = text.includes("⌨️");
  
  // 清理符號以分離圖示與文字
  const displayIcon = isMouse ? "🖱️" : isKeyboard ? "⌨️" : "💡";
  const displayText = text.replace("🖱️", "").replace("⌨️", "").replace("💡", "").trim();

  // 判斷是否需要繪製滑鼠點擊波紋
  const isClickAction = isMouse && displayText.includes("點擊");
  
  // 根據點擊文字智慧對應畫面上的坐標 (1920x1080)
  let rippleX = 960;
  let rippleY = 540;
  if (displayText.includes("啟動")) {
    rippleX = 960;
    rippleY = 565; // "啟動 Gemini Spark" 按鈕
  } else if (displayText.includes("測驗答案")) {
    rippleX = 600;
    rippleY = 730; // 簡報測驗選項位置
  } else if (displayText.includes("AI搜尋")) {
    rippleX = 720;
    rippleY = 620; // AI 搜尋按鈕
  }

  return (
    <>
      {/* 4特效之一：滑鼠點擊波紋 (ClickRipple) */}
      {isClickAction && (
        <ClickRipple
          localFrame={localFrame}
          fps={fps}
          x={rippleX}
          y={rippleY}
          background={activeAction.background}
        />
      )}

      {/* 頂部動作提示 Overlay */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: "50%",
          transform: `translateX(-50%) scale(${scale * exitScale})`,
          opacity,
          pointerEvents: "none",
          zIndex: 60,
        }}
      >
        <div
          style={{
            // 高對比亮白色背景
            background: "linear-gradient(to bottom, #ffffff, #f8fafc)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "2px solid rgba(37, 99, 235, 0.3)",
            boxShadow: "0 20px 40px -10px rgba(15, 23, 42, 0.2), 0 0 20px rgba(37, 99, 235, 0.05)",
            padding: "16px 28px",
            borderRadius: "20px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            color: "#0f172a",
            fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
          }}
        >
          {/* 擬真亮色按鍵外框樣式 */}
          <div
            style={{
              fontSize: "24px",
              background: "linear-gradient(to bottom, #f1f5f9, #e2e8f0)",
              border: "1px solid rgba(15, 23, 42, 0.15)",
              borderBottom: "4px solid rgba(15, 23, 42, 0.25)",
              padding: "8px 14px",
              borderRadius: "12px",
              boxShadow: "inset 0 2px 4px #ffffff, 0 4px 6px rgba(0,0,0,0.1)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              color: "#0f172a",
            }}
          >
            {displayIcon}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                color: "#2563eb",
                letterSpacing: "1.5px",
                textTransform: "uppercase",
              }}
            >
              ACTION / 操作提示
            </span>
            <span
              style={{
                fontSize: "20px",
                fontWeight: 700,
                letterSpacing: "-0.3px",
                color: "#0f172a",
              }}
            >
              {displayText}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};
