import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { cairo } from "../fonts";
import { goldGlow, goldText } from "../goldText";
import { RevealText } from "../RevealText";
import type { TeaserColors } from "../schema";

const NUMBERS = ["٣", "٢", "١"];

// مشهد 4: عدّاد 3..2..1 مع نبضة ضوء على كل رقم واهتزاز خفيف
export const CountdownScene: React.FC<{
  colors: TeaserColors;
  text: string;
}> = ({ colors, text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beat = Math.round(1.5 * fps);
  const start = Math.round(0.3 * fps);
  const local = frame - start;
  const idx = Math.min(
    NUMBERS.length - 1,
    Math.max(0, Math.floor(local / beat)),
  );
  const t = local - idx * beat; // الفريمات من بداية الرقم الحالي
  const active = local >= 0;
  const hit = active ? Math.exp(-t / 6) : 0; // قوة النبضة تخف بسرعة
  const shakeX = Math.sin(frame * 2.7) * 14 * hit + Math.sin(frame / 5) * 2;
  const shakeY = Math.cos(frame * 3.1) * 10 * hit + Math.cos(frame / 6) * 2;
  const p = spring({ frame: t, fps, config: { damping: 11, stiffness: 160 } });

  return (
    <AbsoluteFill style={{ translate: `${shakeX}px ${shakeY}px` }}>
      {/* نبضة الضوء */}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle at 50% 42%, ${colors.goldLight}cc 0%, ${colors.gold}55 25%, transparent 60%)`,
          opacity: active ? 0.25 + hit * 0.75 : 0,
          mixBlendMode: "screen",
        }}
      />
      {/* حلقة تتمدد مع كل رقم */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            width: 560,
            height: 560,
            marginTop: -220,
            borderRadius: "50%",
            border: `6px solid ${colors.gold}`,
            opacity: active
              ? interpolate(t, [0, beat * 0.8], [0.9, 0], {
                  extrapolateRight: "clamp",
                })
              : 0,
            scale: String(
              interpolate(t, [0, beat], [0.6, 1.9], {
                easing: Easing.out(Easing.cubic),
                extrapolateRight: "clamp",
              }),
            ),
            boxShadow: `0 0 60px ${colors.gold}, inset 0 0 60px ${colors.gold}`,
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            fontFamily: cairo,
            fontWeight: 900,
            fontSize: 680,
            lineHeight: 1,
            marginTop: -220,
            opacity: active
              ? interpolate(
                  t,
                  [0, 3, beat - 6, beat],
                  [0, 1, 1, idx === NUMBERS.length - 1 ? 1 : 0],
                  { extrapolateRight: "clamp" },
                )
              : 0,
            scale: String(interpolate(p, [0, 1], [2.2, 1])),
            filter: `blur(${interpolate(p, [0, 1], [12, 0])}px)`,
          }}
        >
          <span
            style={{
              ...goldText(colors),
              filter: goldGlow(colors, 40 + hit * 60),
            }}
          >
            {NUMBERS[idx]}
          </span>
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 300,
        }}
      >
        <RevealText
          delay={0.6 * fps}
          style={{
            fontFamily: cairo,
            fontWeight: 900,
            fontSize: 96,
            color: "#fff",
            lineHeight: 1.45,
            padding: "0 80px",
          }}
        >
          <span style={{ filter: `drop-shadow(0 0 22px ${colors.gold}aa)` }}>
            {text}
          </span>
        </RevealText>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
