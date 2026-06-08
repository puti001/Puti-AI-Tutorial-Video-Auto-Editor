import "./index.css";
import { Composition } from "remotion";
import { EditorVideo, EditSegment } from "./EditorVideo";
import { z } from "zod";

// 定義 Zod Schema 以驗證傳入的 props
export const editorSchema = z.object({
  videoPath: z.string(),
  edl: z.array(
    z.object({
      start: z.number(),
      end: z.number(),
      type: z.enum(["keep", "cut"]),
      subtitle: z.string().nullable().optional(),
      title: z.string().nullable().optional(),
      sticker: z.string().nullable().optional(),
    })
  ),
  knowledgePoints: z.array(
    z.object({
      time: z.number(),
      title: z.string(),
      type: z.string().optional(),
      sticker: z.string().nullable().optional(),
    })
  ).optional(),
  actions: z.array(
    z.object({
      time: z.number(),
      text: z.string(),
      background: z.enum(["dark", "light"]).optional(),
    })
  ).optional(),
  subtitles: z.array(
    z.object({
      start: z.number(),
      end: z.number(),
      text: z.string(),
    })
  ).optional(),
});

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HelloWorld" // 後端 FastAPI 預設會呼叫 HelloWorld，我們保留此 ID
        component={EditorVideo as any}
        fps={30}
        width={1920}
        height={1080}
        schema={editorSchema}
        defaultProps={{
          videoPath: "",
          edl: [] as EditSegment[],
          knowledgePoints: [] as { time: number; title: string; type?: string; sticker?: string | null }[],
          actions: [] as { time: number; text: string }[],
          subtitles: [] as { start: number; end: number; text: string }[],
        }}
        // 動態計算影片長度：總 Frames = 所有 keep 片段總秒數 * fps
        calculateMetadata={async (args) => {
          try {
            const props: any = args.props || args.inputProps || {};
            const edl = (props.edl as EditSegment[]) || [];
            const fps = 30;
            const keepSegments = edl.filter((s) => s.type === "keep");
            const totalDurationSec = keepSegments.reduce(
              (sum, s) => sum + (s.end - s.start),
              0
            );
            const durationInFrames = Math.max(
              30, // 至少 1 秒
              Math.round(totalDurationSec * fps)
            );
            return {
              durationInFrames,
            };
          } catch (err: any) {
            console.error("calculateMetadata Error:", err);
            return {
              durationInFrames: 30,
            };
          }
        }}
      />
    </>
  );
};
