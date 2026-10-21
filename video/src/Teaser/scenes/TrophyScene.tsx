import {
  AbsoluteFill,
  interpolate,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { cairo } from "../fonts";
import { goldGlow, goldText } from "../goldText";
import { LensFlare } from "../LensFlare";
import { Particles } from "../Particles";
import { WordReveal } from "../WordReveal";
import type { TeaserColors } from "../schema";
import { Trophy } from "../Trophy";

export const TROPHY_SHINE = 1.6; // ث، لمعة الكأس (مربوطة بالمؤثرات)

// مشهد 5: كأس ذهبي يطلع من تحت مع أشعة ضوء، انعكاس على الأرض، وغبار ذهبي ينفجر
export const TrophyScene: React.FC<{ colors: TeaserColors; text: string }> = ({
  colors,
  text,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame, fps, config: { damping: 16, stiffness: 50 } });
  const shine = interpolate(
    frame,
    [TROPHY_SHINE * fps, (TROPHY_SHINE + 1) * fps],
    [-0.2, 1.2],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const burst = frame - 0.9 * fps;
  const flare = interpolate(
    frame,
    [
      TROPHY_SHINE * fps,
      (TROPHY_SHINE + 0.25) * fps,
      (TROPHY_SHINE + 1.2) * fps,
    ],
    [0, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const trophy = <Trophy colors={colors} shine={shine} />;

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center" }}>
        <div
          style={{
            marginTop: -660,
            width: 2600,
            height: 2600,
            borderRadius: "50%",
            backgroundImage: `repeating-conic-gradient(from 0deg, ${colors.goldLight}55 0deg 5deg, transparent 5deg 15deg)`,
            maskImage:
              "radial-gradient(circle, #000 0%, #000 10%, transparent 46%)",
            WebkitMaskImage:
              "radial-gradient(circle, #000 0%, #000 10%, transparent 46%)",
            rotate: `${frame * 0.3}deg`,
            opacity: interpolate(rise, [0.2, 1], [0, 0.9], {
              extrapolateLeft: "clamp",
            }),
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle at 50% 33%, ${colors.gold}77 0%, transparent 34%)`,
          opacity: rise,
        }}
      />
      {/* أرضية لامعة */}
      <AbsoluteFill
        style={{
          top: 1190,
          height: 40,
          background: `radial-gradient(ellipse at center, ${colors.gold}88 0%, transparent 60%)`,
          opacity: rise,
          filter: "blur(6px)",
        }}
      />
      <Particles
        count={40}
        gold={colors.gold}
        goldLight={colors.goldLight}
        seed="trophy"
        opacity={rise}
      />
      {/* غبار ذهبي ينفجر من الكأس */}
      {burst > 0 && (
        <AbsoluteFill>
          {new Array(60).fill(0).map((_, i) => {
            const a = random(`ba${i}`) * Math.PI * 2;
            const v = 8 + random(`bv${i}`) * 22;
            const d = v * burst * Math.exp(-burst / 40);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: 540 + Math.cos(a) * d,
                  top: 640 + Math.sin(a) * d + burst * burst * 0.02,
                  width: 6 + random(`bs${i}`) * 6,
                  height: 6 + random(`bs${i}`) * 6,
                  borderRadius: "50%",
                  background: colors.goldLight,
                  boxShadow: `0 0 12px ${colors.gold}`,
                  opacity: interpolate(burst, [0, 50], [1, 0], {
                    extrapolateRight: "clamp",
                  }),
                }}
              />
            );
          })}
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ alignItems: "center" }}>
        <div
          style={{
            marginTop: 300,
            translate: `0px ${interpolate(rise, [0, 1], [1500, 0])}px`,
            scale: String(
              interpolate(rise, [0, 1], [0.7, 1]) + Math.sin(frame / 20) * 0.01,
            ),
            filter: goldGlow(colors, 45),
          }}
        >
          {trophy}
        </div>
        {/* الانعكاس */}
        <div
          style={{
            marginTop: -50,
            scale: "1 -1",
            opacity: rise * 0.22,
            maskImage: "linear-gradient(to top, #000 0%, transparent 45%)",
            WebkitMaskImage:
              "linear-gradient(to top, #000 0%, transparent 45%)",
            filter: "blur(2px)",
          }}
        >
          {trophy}
        </div>
      </AbsoluteFill>
      <LensFlare y={28} intensity={flare} color={colors.goldLight} />
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 380,
        }}
      >
        <WordReveal
          text={text}
          delay={1.3 * fps}
          stagger={5}
          style={{
            fontFamily: cairo,
            fontWeight: 900,
            fontSize: 120,
            lineHeight: 1.4,
            padding: "0 90px",
          }}
          wordStyle={{
            ...goldText(colors, 180, frame / 80),
            filter: goldGlow(colors),
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
