import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { cairo } from "../fonts";
import { goldGlow, goldText } from "../goldText";
import { Particles } from "../Particles";
import { RevealText } from "../RevealText";
import type { TeaserColors } from "../schema";
import { Trophy } from "../Trophy";

// مشهد 5: كأس ذهبي يطلع من تحت مع أشعة ضوء خلفه
export const TrophyScene: React.FC<{ colors: TeaserColors; text: string }> = ({ colors, text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame, fps, config: { damping: 16, stiffness: 50 } });

  return (
    <AbsoluteFill>
      {/* أشعة الضوء */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            width: 2600,
            height: 2600,
            marginTop: -300,
            borderRadius: "50%",
            backgroundImage: `repeating-conic-gradient(from 0deg, ${colors.goldLight}55 0deg 6deg, transparent 6deg 18deg)`,
            maskImage: "radial-gradient(circle, #000 0%, #000 12%, transparent 48%)",
            WebkitMaskImage: "radial-gradient(circle, #000 0%, #000 12%, transparent 48%)",
            rotate: `${frame * 0.35}deg`,
            opacity: interpolate(rise, [0.2, 1], [0, 1], { extrapolateLeft: "clamp" }),
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle at 50% 38%, ${colors.gold}77 0%, transparent 35%)`,
          opacity: rise,
        }}
      />
      <Particles count={40} gold={colors.gold} goldLight={colors.goldLight} seed="trophy" opacity={rise} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            marginTop: -330,
            translate: `0px ${interpolate(rise, [0, 1], [1400, 0])}px`,
            scale: String(interpolate(rise, [0, 1], [0.7, 1]) + Math.sin(frame / 20) * 0.01),
            filter: goldGlow(colors, 45),
          }}
        >
          <Trophy
            colors={colors}
            shine={interpolate(frame, [1.6 * fps, 2.6 * fps], [-0.2, 1.2], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}
          />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 300 }}>
        <RevealText
          delay={1.4 * fps}
          style={{ fontFamily: cairo, fontWeight: 900, fontSize: 120, lineHeight: 1.4, padding: "0 80px" }}
        >
          <span style={{ ...goldText(colors), filter: goldGlow(colors) }}>{text}</span>
        </RevealText>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
