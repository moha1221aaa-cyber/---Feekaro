import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { cairo } from "../fonts";
import { goldGlow, goldText } from "../goldText";
import { Particles } from "../Particles";
import { RevealText } from "../RevealText";
import type { TeaserColors } from "../schema";

// مشهد 1: شاشة سوداء + جزيئات ذهبية + فلاش خفيف + "استعدّوا..."
export const IntroScene: React.FC<{ colors: TeaserColors; text: string }> = ({
  colors,
  text,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill
        style={{
          scale: String(interpolate(frame, [0, durationInFrames], [1, 1.12])),
        }}
      >
        <Particles
          count={90}
          gold={colors.gold}
          goldLight={colors.goldLight}
          seed="intro"
        />
      </AbsoluteFill>
      {/* فلاش ضوئي */}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle at 50% 45%, #fff8e0 0%, ${colors.goldLight}88 25%, transparent 60%)`,
          opacity: interpolate(
            frame,
            [0.4 * fps, 0.6 * fps, 1.4 * fps],
            [0, 0.75, 0],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.quad),
            },
          ),
          mixBlendMode: "screen",
        }}
      />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <RevealText
          delay={1 * fps}
          style={{
            fontFamily: cairo,
            fontWeight: 900,
            fontSize: 150,
            lineHeight: 1.4,
          }}
        >
          <span style={{ ...goldText(colors), filter: goldGlow(colors) }}>
            {text}
          </span>
        </RevealText>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
