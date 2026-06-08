import React from "react";
import { spring, interpolate } from "remotion";

export interface KnowledgePoint {
  time: number;
  title: string;
  type?: string;
  sticker?: string | null;
}

interface DashboardProps {
  knowledgePoints?: KnowledgePoint[];
  frame: number;
  fps: number;
}

export const Dashboard: React.FC<DashboardProps> = ({
  knowledgePoints = [],
  frame,
  fps,
}) => {
  const currentTime = frame / fps;

  // 排序知識點（確保時間由小到大）
  const sortedKps = [...knowledgePoints].sort((a, b) => a.time - b.time);

  // 找出當前播放中的知識點索引
  let activeIndex = -1;
  for (let i = 0; i < sortedKps.length; i++) {
    if (currentTime >= sortedKps[i].time) {
      activeIndex = i;
    }
  }

  // 取得當前的知識點
  const activeKp = activeIndex !== -1 ? sortedKps[activeIndex] : null;

  // 計算動態動畫 (Glow pulse 效果，利用 frame/fps 來做週期性放大縮小)
  const pulseScale = interpolate(
    Math.sin((frame / fps) * Math.PI * 1.5),
    [-1, 1],
    [0.92, 1.08]
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "rgba(10, 15, 30, 0.65)",
        backdropFilter: "blur(20px) saturate(190%)",
        WebkitBackdropFilter: "blur(20px) saturate(190%)",
        borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
        padding: "40px 28px",
        display: "flex",
        flexDirection: "column",
        gap: "36px",
        boxSizing: "border-box",
        color: "#ffffff",
        fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
      }}
    >
      {/* 標題欄 (Dashboard Header) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          paddingBottom: "16px",
        }}
      >
        <div>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 800,
              letterSpacing: "3px",
              color: "#38bdf8",
              textTransform: "uppercase",
              display: "block",
            }}
          >
            AI Assistant
          </span>
          <h2
            style={{
              margin: "4px 0 0 0",
              fontSize: "22px",
              fontWeight: 700,
              letterSpacing: "-0.5px",
            }}
          >
            教學狀態儀表板
          </h2>
        </div>
        
        {/* 動態狀態燈 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(56, 189, 248, 0.1)",
            padding: "6px 12px",
            borderRadius: "20px",
            border: "1px solid rgba(56, 189, 248, 0.2)",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#38bdf8",
              boxShadow: "0 0 8px #38bdf8",
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "#38bdf8",
              letterSpacing: "1px",
            }}
          >
            PLAYING
          </span>
        </div>
      </div>

      {/* 當前步驟大字卡 (Active Step Card) */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "20px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          boxShadow: "0 10px 25px -10px rgba(0, 0, 0, 0.3)",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 800,
            color: "rgba(255, 255, 255, 0.4)",
            letterSpacing: "2px",
            textTransform: "uppercase",
          }}
        >
          Current active node / 當前焦點
        </span>
        <div
          style={{
            fontSize: "20px",
            fontWeight: 700,
            lineHeight: "28px",
            background: "linear-gradient(to right, #ffffff, #e2e8f0)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            minHeight: "56px",
            display: "flex",
            alignItems: "center",
          }}
        >
          {activeKp ? activeKp.title : "準備開始教學..."}
        </div>
      </div>

      {/* 教學步驟時間軸 (Timeline) */}
      <div style={{ flex: 1, overflowY: "auto", paddingRight: "4px" }}>
        <h4
          style={{
            margin: "0 0 20px 0",
            fontSize: "13px",
            fontWeight: 700,
            color: "rgba(255, 255, 255, 0.5)",
            letterSpacing: "1px",
            textTransform: "uppercase",
          }}
        >
          Timeline / 教學大綱步驟
        </h4>

        {sortedKps.length === 0 ? (
          <div style={{ color: "rgba(255, 255, 255, 0.3)", fontSize: "14px", padding: "10px" }}>
            無步驟資料
          </div>
        ) : (
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "28px" }}>
            
            {/* 時間軸垂直中心連線 */}
            <div
              style={{
                position: "absolute",
                left: "11px",
                top: "12px",
                bottom: "12px",
                width: "2px",
                background: "rgba(255, 255, 255, 0.08)",
                zIndex: 0,
              }}
            />

            {/* 時間軸已完成部分的彩色進度線 */}
            {activeIndex !== -1 && (
              <div
                style={{
                  position: "absolute",
                  left: "11px",
                  top: "12px",
                  height: `${(activeIndex / (sortedKps.length - 1)) * 100}%`,
                  width: "2px",
                  background: "linear-gradient(to bottom, #10b981, #38bdf8)",
                  zIndex: 0,
                  transition: "height 0.3s ease-out",
                }}
              />
            )}

            {/* 節點清單 */}
            {sortedKps.map((kp, idx) => {
              const isFinished = idx < activeIndex;
              const isActive = idx === activeIndex;
              const isUpcoming = idx > activeIndex;

              // 樣式變數
              let nodeColor = "rgba(255, 255, 255, 0.15)";
              let nodeBorder = "2px solid rgba(255, 255, 255, 0.1)";
              let nodeShadow = "none";
              let titleColor = "rgba(255, 255, 255, 0.35)";
              let titleWeight = 400;

              if (isFinished) {
                nodeColor = "#10b981";
                nodeBorder = "2px solid #10b981";
                titleColor = "rgba(255, 255, 255, 0.85)";
              } else if (isActive) {
                nodeColor = "#38bdf8";
                nodeBorder = "2px solid #38bdf8";
                nodeShadow = "0 0 14px #38bdf8";
                titleColor = "#ffffff";
                titleWeight = 700;
              }

              return (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "18px",
                    zIndex: 1,
                    opacity: isUpcoming ? 0.45 : 1,
                    transition: "opacity 0.3s ease",
                  }}
                >
                  {/* 節點圓點 */}
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      background: isFinished ? "#10b981" : isActive ? "#0f172a" : "#0f172a",
                      border: nodeBorder,
                      boxShadow: nodeShadow,
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      boxSizing: "border-box",
                      transform: isActive ? `scale(${pulseScale})` : "scale(1)",
                      transition: "transform 0.1s linear, background-color 0.3s, border-color 0.3s",
                    }}
                  >
                    {isFinished ? (
                      // 勾選 icon
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      // 內圈圓點
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: isActive ? "#38bdf8" : "rgba(255,255,255,0.2)",
                        }}
                      />
                    )}
                  </div>

                  {/* 節點文字與時間 */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: titleWeight,
                        color: titleColor,
                        transition: "color 0.3s",
                      }}
                    >
                      {kp.title}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        color: isFinished ? "#10b981" : isActive ? "#38bdf8" : "rgba(255, 255, 255, 0.3)",
                        fontWeight: 600,
                      }}
                    >
                      {Math.floor(kp.time / 60)}:{(kp.time % 60).toString().padStart(2, "0")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
