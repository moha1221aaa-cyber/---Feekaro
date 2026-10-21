import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { cairo } from "../fonts";
import { goldGlow, goldText } from "../goldText";
import { LensFlare } from "../LensFlare";
import { Particles } from "../Particles";
import { WordReveal } from "../WordReveal";
import type { TeaserColors } from "../schema";

// مشهد 1: شاشة سوداء + جزيئات ذهبية + فلاش ووهج عدسة + "استعدّوا..."
export const IntroScene: React.FC<{ colors: TeaserColors; text: string }> = ({
  colors,
  text,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flash = interpolate(
    frame,
    [0.4 * fps, 0.55 * fps, 1.6 * fps],
    [0, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    },
  );
  const line = interpolate(frame, [1.3 * fps, 2.4 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Particles
        count={110}
        gold={colors.gold}
        goldLight={colors.goldLight}
        seed="intro"
      />
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle at 50% 46%, #fff8e0 0%, ${colors.goldLight}88 22%, transparent 58%)`,
          opacity: flash * 0.8,
          mixBlendMode: "screen",
        }}
      />
      <LensFlare y={46} intensity={flash} color={colors.goldLight} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          gap: 30,
        }}
      >
        <WordReveal
          text={text}
          delay={0.9 * fps}
          style={{
            fontFamily: cairo,
            fontWeight: 900,
            fontSize: 170,
            lineHeight: 1.35,
          }}
          wordStyle={{
            ...goldText(colors, 180, frame / 120),
            filter: goldGlow(colors, 40),
          }}
        />
        <div
          style={{
            width: 520 * line,
            height: 3,
            background: `linear-gradient(90deg, transparent, ${colors.goldLight}, transparent)`,
            boxShadow: `0 0 18px ${colors.gold}`,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
