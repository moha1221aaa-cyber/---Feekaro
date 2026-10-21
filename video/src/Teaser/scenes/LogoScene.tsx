import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { cairo, cinzel, tajawal } from "../fonts";
import { goldGlow } from "../goldText";
import { RevealText } from "../RevealText";
import type { TeaserColors } from "../schema";

// مشهد 6: الشعار الختامي مع لمعة تمر عليه
export const LogoScene: React.FC<{
  colors: TeaserColors;
  leagueAr: string;
  leagueEn: string;
  comingSoon: string;
}> = ({ colors, leagueAr, leagueEn, comingSoon }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines = spring({
    frame: frame - 0.4 * fps,
    fps,
    config: { damping: 200 },
  });
  // موقع اللمعة: تمر من اليمين لليسار
  const shine = interpolate(frame, [1.2 * fps, 2.4 * fps], [130, -30], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const shineText: React.CSSProperties = {
    backgroundImage: `linear-gradient(100deg, transparent ${shine - 8}%, #ffffffee ${shine}%, transparent ${shine + 8}%), linear-gradient(180deg, ${colors.goldLight} 0%, ${colors.gold} 50%, #8a6a12 80%, ${colors.goldLight} 100%)`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  };

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle at 50% 46%, ${colors.gold}44 0%, transparent 42%)`,
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          padding: "0 80px",
        }}
      >
        <RevealText
          delay={0}
          style={{
            fontFamily: cairo,
            fontWeight: 900,
            fontSize: 118,
            lineHeight: 1.35,
          }}
        >
          <span style={{ ...shineText, filter: goldGlow(colors, 36) }}>
            {leagueAr}
          </span>
        </RevealText>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              height: 3,
              width: 90 * lines,
              backgroundImage: `linear-gradient(90deg, transparent, ${colors.gold})`,
            }}
          />
          <div
            style={{
              fontFamily: cinzel,
              fontWeight: 700,
              fontSize: 60,
              letterSpacing: 8,
              whiteSpace: "nowrap",
              direction: "ltr",
              opacity: lines,
              ...shineText,
            }}
          >
            {leagueEn}
          </div>
          <div
            style={{
              height: 3,
              width: 90 * lines,
              backgroundImage: `linear-gradient(270deg, transparent, ${colors.gold})`,
            }}
          />
        </div>
        <RevealText
          delay={1.6 * fps}
          style={{
            fontFamily: tajawal,
            fontWeight: 700,
            fontSize: 60,
            color: "#fff",
            marginTop: 70,
            lineHeight: 1.5,
          }}
        >
          {comingSoon}
        </RevealText>
      </div>
    </AbsoluteFill>
  );
};
