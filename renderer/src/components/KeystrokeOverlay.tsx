import React from "react";
import { spring, interpolate } from "remotion";
import { ClickRipple } from "./ClickRipple";
import { MagicPen } from "./MagicPen";

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
  const showDuration = 150; // 顯示 5.0 秒 (30fps)

  // 逆向尋找最後一個已經開始的 action，以支援新動作立即打斷並覆蓋舊動作
  const activeAction = [...actions].reverse().find((action) => {
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
  
  // 判斷是否為提示/解說引導動作，觸發黃色魔法筆消失墨水特效
  const isGuideAction = displayText.includes("提示") || displayText.includes("解說") || text.includes("💡") || text.includes("⚠️");
  
  // 根據動作內容智慧對應畫面上的坐標 (1920x1080)
  let rippleX = 960;
  let rippleY = 540;
  
  if (displayText.includes("啟動")) {
    rippleX = 960;
    rippleY = 565;
  } else if (displayText.includes("選擇資料夾") || displayText.includes("選擇Open Code")) {
    rippleX = 400;
    rippleY = 320; // 左上選擇資料夾區域
  } else if (displayText.includes("分析")) {
    rippleX = 600;
    rippleY = 320; // 分析按鈕區域
  } else if (displayText.includes("篩選") || displayText.includes("下拉選單")) {
    rippleX = 850;
    rippleY = 320; // 篩選下拉選單區域
  } else if (displayText.includes("勾選") || displayText.includes("多個檔案")) {
    rippleX = 1350;
    rippleY = 400; // 右側大檔案列表區域
  } else if (displayText.includes("刪除")) {
    rippleX = 1450;
    rippleY = 700; // 右下刪除按鈕區域
  } else if (displayText.includes("確認關閉") || displayText.includes("二次確認")) {
    rippleX = 960;
    rippleY = 600; // 彈出對話框確定按鈕區域
  } else if (displayText.includes("返回上一層")) {
    rippleX = 320;
    rippleY = 320; // 返回上一層按鈕區域
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

      {/* 智慧特效：黃色魔法筆消失墨水軌跡 */}
      {isGuideAction && (
        <MagicPen
          localFrame={localFrame}
          fps={fps}
          x={rippleX}
          y={rippleY}
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
