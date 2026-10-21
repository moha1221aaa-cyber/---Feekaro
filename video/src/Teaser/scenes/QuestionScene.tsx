import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { cairo } from "../fonts";
import { goldGlow, goldText } from "../goldText";
import { RevealText } from "../RevealText";
import type { TeaserColors } from "../schema";

// مشهد 2: علامة استفهام ذهبية ضخمة تدور ببطء مع توهج
export const QuestionScene: React.FC<{
  colors: TeaserColors;
  text: string;
}> = ({ colors, text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 70 } });
  const pulse = 0.75 + 0.25 * Math.sin(frame / 8);

  return (
    <AbsoluteFill>
      {/* هالة التوهج */}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle at 50% 42%, ${colors.gold}66 0%, ${colors.gold}22 22%, transparent 45%)`,
          opacity: enter * pulse,
          scale: String(interpolate(enter, [0, 1], [0.4, 1])),
        }}
      />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          perspective: 1600,
        }}
      >
        <div
          style={{
            fontFamily: cairo,
            fontWeight: 900,
            fontSize: 980,
            lineHeight: 1,
            marginTop: -320,
            opacity: interpolate(enter, [0, 0.5], [0, 1], {
              extrapolateRight: "clamp",
            }),
            scale: String(interpolate(enter, [0, 1], [0.3, 1])),
            rotate: `y ${Math.sin(frame / 28) * 38 + interpolate(enter, [0, 1], [-180, 0])}deg`,
          }}
        >
          <span
            style={{
              ...goldText(colors, 135),
              filter: goldGlow(colors, 50 * pulse),
            }}
          >
            ؟
          </span>
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 330,
        }}
      >
        <RevealText
          delay={0.9 * fps}
          style={{
            fontFamily: cairo,
            fontWeight: 900,
            fontSize: 112,
            color: "#fff",
            lineHeight: 1.4,
            padding: "0 80px",
          }}
        >
          <span style={{ filter: `drop-shadow(0 0 24px ${colors.gold}aa)` }}>
            {text}
          </span>
        </RevealText>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
