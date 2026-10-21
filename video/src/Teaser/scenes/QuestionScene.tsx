import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { cairo } from "../fonts";
import { goldGlow, goldText } from "../goldText";
import { WordReveal } from "../WordReveal";
import type { TeaserColors } from "../schema";

// مشهد 2: علامة استفهام ذهبية ضخمة تدور ببطء مع توهج وحلقات مدارية
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
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle at 50% 38%, ${colors.gold}66 0%, ${colors.gold}1f 24%, transparent 46%)`,
          opacity: enter * pulse,
          scale: String(interpolate(enter, [0, 1], [0.4, 1])),
        }}
      />
      {/* حلقات مدارية */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          perspective: 1400,
        }}
      >
        {[0, 1].map((k) => (
          <div
            key={k}
            style={{
              position: "absolute",
              top: 300 + k * 30,
              width: 860 - k * 160,
              height: 860 - k * 160,
              borderRadius: "50%",
              border: `2px solid ${colors.gold}${k ? "55" : "88"}`,
              boxShadow: `0 0 30px ${colors.gold}44`,
              rotate: `x ${72 - k * 8}deg`,
              scale: String(enter),
              opacity: enter,
              translate: `0px ${Math.sin(frame / 30 + k) * 12}px`,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: colors.goldLight,
                boxShadow: `0 0 24px ${colors.goldLight}`,
                translate: `${Math.cos(frame / (14 + k * 6)) * (430 - k * 80) - 9}px ${Math.sin(frame / (14 + k * 6)) * (430 - k * 80) - 9}px`,
              }}
            />
          </div>
        ))}
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", perspective: 1600 }}>
        <div
          style={{
            marginTop: 180,
            fontFamily: cairo,
            fontWeight: 900,
            fontSize: 900,
            lineHeight: 1,
            opacity: interpolate(enter, [0, 0.5], [0, 1], {
              extrapolateRight: "clamp",
            }),
            scale: String(interpolate(enter, [0, 1], [0.3, 1])),
            rotate: `y ${Math.sin(frame / 28) * 38 + interpolate(enter, [0, 1], [-180, 0])}deg`,
          }}
        >
          <span
            style={{
              ...goldText(colors, 135, frame / 90),
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
          paddingBottom: 400,
        }}
      >
        <WordReveal
          text={text}
          delay={0.8 * fps}
          style={{
            fontFamily: cairo,
            fontWeight: 900,
            fontSize: 108,
            color: "#fff",
            lineHeight: 1.4,
            padding: "0 90px",
          }}
          wordStyle={{ filter: `drop-shadow(0 0 22px ${colors.gold}aa)` }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
