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
import { LensFlare } from "../LensFlare";
import { WordReveal } from "../WordReveal";
import type { TeaserColors } from "../schema";

const NUMBERS = ["٣", "٢", "١"];
export const COUNT_START = 0.3; // ث، أول رقم (مربوط بتوقيت التعليق والمؤثرات)
export const COUNT_BEAT = 1.5; // ث بين كل رقم

// مشهد 4: عدّاد 3..2..1 مع حلقة تنرسم، نبضة ضوء ووهج عدسة على كل رقم، واهتزاز خفيف
export const CountdownScene: React.FC<{
  colors: TeaserColors;
  text: string;
}> = ({ colors, text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beat = Math.round(COUNT_BEAT * fps);
  const local = frame - Math.round(COUNT_START * fps);
  const idx = Math.min(
    NUMBERS.length - 1,
    Math.max(0, Math.floor(local / beat)),
  );
  const t = local - idx * beat;
  const active = local >= 0;
  const hit = active ? Math.exp(-t / 6) : 0;
  const shakeX = Math.sin(frame * 2.7) * 16 * hit + Math.sin(frame / 5) * 2;
  const shakeY = Math.cos(frame * 3.1) * 12 * hit + Math.cos(frame / 6) * 2;
  const p = spring({ frame: t, fps, config: { damping: 11, stiffness: 160 } });
  const isLast = idx === NUMBERS.length - 1;
  const ring = active
    ? interpolate(t, [0, beat], [0, 1], {
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.cubic),
      })
    : 0;
  const R = 330;
  const C = 2 * Math.PI * R;

  return (
    <AbsoluteFill style={{ translate: `${shakeX}px ${shakeY}px` }}>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle at 50% 38%, ${colors.goldLight}cc 0%, ${colors.gold}55 25%, transparent 60%)`,
          opacity: active ? 0.2 + hit * 0.8 : 0,
          mixBlendMode: "screen",
        }}
      />
      {/* حلقة العد تنرسم */}
      <AbsoluteFill style={{ alignItems: "center" }}>
        <svg
          width={800}
          height={800}
          viewBox="0 0 800 800"
          style={{ marginTop: 330, rotate: "-90deg", opacity: active ? 1 : 0 }}
        >
          <circle
            cx={400}
            cy={400}
            r={R}
            fill="none"
            stroke={`${colors.gold}33`}
            strokeWidth={6}
          />
          <circle
            cx={400}
            cy={400}
            r={R}
            fill="none"
            stroke={colors.goldLight}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - (isLast && t > beat ? 1 : ring))}
            style={{ filter: `drop-shadow(0 0 14px ${colors.gold})` }}
          />
        </svg>
      </AbsoluteFill>
      {/* موجة تتمدد مع كل رقم */}
      <AbsoluteFill style={{ alignItems: "center" }}>
        <div
          style={{
            marginTop: 400,
            width: 660,
            height: 660,
            borderRadius: "50%",
            border: `5px solid ${colors.gold}`,
            opacity: active
              ? interpolate(t, [0, beat * 0.7], [0.8, 0], {
                  extrapolateRight: "clamp",
                })
              : 0,
            scale: String(
              interpolate(t, [0, beat], [0.7, 1.9], {
                easing: Easing.out(Easing.cubic),
                extrapolateRight: "clamp",
              }),
            ),
            boxShadow: `0 0 50px ${colors.gold}`,
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center" }}>
        <div
          style={{
            marginTop: 380,
            fontFamily: cairo,
            fontWeight: 900,
            fontSize: 600,
            lineHeight: 1.05,
            opacity: active
              ? interpolate(
                  t,
                  [0, 3, beat - 6, beat],
                  [0, 1, 1, isLast ? 1 : 0],
                  { extrapolateRight: "clamp" },
                )
              : 0,
            scale: String(interpolate(p, [0, 1], [2.2, 1])),
            filter: `blur(${interpolate(p, [0, 1], [12, 0])}px)`,
          }}
        >
          <span
            style={{
              ...goldText(colors, 180, frame / 60),
              filter: goldGlow(colors, 40 + hit * 60),
            }}
          >
            {NUMBERS[idx]}
          </span>
        </div>
      </AbsoluteFill>
      <LensFlare y={38} intensity={hit * 0.9} color={colors.goldLight} />
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 400,
        }}
      >
        <WordReveal
          text={text}
          delay={(COUNT_START + COUNT_BEAT * 3) * fps - 10}
          style={{
            fontFamily: cairo,
            fontWeight: 900,
            fontSize: 96,
            color: "#fff",
            lineHeight: 1.45,
            padding: "0 90px",
          }}
          wordStyle={{ filter: `drop-shadow(0 0 22px ${colors.gold}aa)` }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
