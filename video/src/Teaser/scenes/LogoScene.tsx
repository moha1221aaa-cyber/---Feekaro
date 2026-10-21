import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { cairo, cinzel, tajawal } from "../fonts";
import { goldGlow } from "../goldText";
import { LensFlare } from "../LensFlare";
import { WordReveal } from "../WordReveal";
import type { TeaserColors } from "../schema";

export const LOGO_SHINE = 1.2; // ث، اللمعة على الشعار (مربوطة بالمؤثرات)

// إكليل غار وتاج فوق الشعار
const Emblem: React.FC<{ colors: TeaserColors; p: number }> = ({
  colors,
  p,
}) => {
  const leaves = 8;
  const R = 100;
  const cx = 160;
  const cy = 150;
  // ورقة على قوس الإكليل: phi من 18° (تحت) إلى 150° (فوق)، والورقة باتجاه القوس
  const leaf = (side: 1 | -1, i: number) => {
    const phi = ((18 + (i / (leaves - 1)) * 132) * Math.PI) / 180;
    const off = i % 2 ? 13 : -13;
    const x = cx + side * (R + off) * Math.sin(phi);
    const y = cy + (R + off) * Math.cos(phi);
    const rot = side * (-(phi * 180) / Math.PI - 90 + (i % 2 ? 28 : -28));
    return (
      <ellipse
        key={`${side}${i}`}
        cx={x}
        cy={y}
        rx={9}
        ry={23}
        fill="url(#emb)"
        transform={`rotate(${rot} ${x} ${y})`}
        opacity={interpolate(p * leaves, [i, i + 1], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}
      />
    );
  };
  const stem = (side: 1 | -1) => {
    const pts = new Array(12).fill(0).map((_, k) => {
      const phi = ((10 + (k / 11) * 140) * Math.PI) / 180;
      return `${cx + side * R * Math.sin(phi)},${cy + R * Math.cos(phi)}`;
    });
    return (
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="url(#emb)"
        strokeWidth={4}
        strokeLinecap="round"
        opacity={p}
      />
    );
  };
  return (
    <svg
      width={320}
      height={260}
      viewBox="0 0 320 260"
      style={{ filter: goldGlow(colors, 20) }}
    >
      <defs>
        <linearGradient id="emb" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={colors.goldLight} />
          <stop offset="0.6" stopColor={colors.gold} />
          <stop offset="1" stopColor="#8a6a12" />
        </linearGradient>
      </defs>
      {stem(1)}
      {stem(-1)}
      {new Array(leaves).fill(0).map((_, i) => leaf(1, i))}
      {new Array(leaves).fill(0).map((_, i) => leaf(-1, i))}
      {/* التاج */}
      <path
        d="M110 150 L120 95 L145 125 L160 80 L175 125 L200 95 L210 150 Z"
        fill="url(#emb)"
        opacity={interpolate(p, [0.6, 1], [0, 1], { extrapolateLeft: "clamp" })}
        transform={`translate(0 ${interpolate(p, [0.6, 1], [-30, 0], { extrapolateLeft: "clamp" })})`}
      />
      <rect
        x={110}
        y={152}
        width={100}
        height={12}
        rx={3}
        fill="url(#emb)"
        opacity={interpolate(p, [0.6, 1], [0, 1], { extrapolateLeft: "clamp" })}
      />
    </svg>
  );
};

// مشهد 6: الشعار الختامي مع إكليل ولمعة تمر عليه
export const LogoScene: React.FC<{
  colors: TeaserColors;
  leagueAr: string;
  leagueEn: string;
  comingSoon: string;
}> = ({ colors, leagueAr, leagueEn, comingSoon }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const emblem = interpolate(frame, [0, 1.1 * fps], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const lines = spring({
    frame: frame - 0.5 * fps,
    fps,
    config: { damping: 200 },
  });
  const shine = interpolate(
    frame,
    [LOGO_SHINE * fps, (LOGO_SHINE + 1.1) * fps],
    [130, -30],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const flare = interpolate(
    frame,
    [LOGO_SHINE * fps, (LOGO_SHINE + 0.5) * fps, (LOGO_SHINE + 1.2) * fps],
    [0, 0.8, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const shineText: React.CSSProperties = {
    backgroundImage: `linear-gradient(100deg, transparent ${shine - 8}%, #ffffffee ${shine}%, transparent ${shine + 8}%), linear-gradient(180deg, #fff3c4 0%, ${colors.goldLight} 20%, ${colors.gold} 50%, #8a6a12 80%, ${colors.goldLight} 100%)`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  };

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle at 50% 44%, ${colors.gold}44 0%, transparent 44%)`,
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          padding: "0 80px",
          marginTop: -80,
        }}
      >
        <Emblem colors={colors} p={emblem} />
        <WordReveal
          text={leagueAr}
          delay={0.2 * fps}
          stagger={3}
          style={{
            fontFamily: cairo,
            fontWeight: 900,
            fontSize: 116,
            lineHeight: 1.35,
          }}
          wordStyle={{ ...shineText, filter: goldGlow(colors, 36) }}
        />
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
              letterSpacing: 8 + (1 - lines) * 20,
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
        <WordReveal
          text={comingSoon}
          delay={1.8 * fps}
          style={{
            fontFamily: tajawal,
            fontWeight: 700,
            fontSize: 62,
            color: "#fff",
            marginTop: 60,
            lineHeight: 1.5,
          }}
        />
      </div>
      <LensFlare y={50} x={shine} intensity={flare} color={colors.goldLight} />
    </AbsoluteFill>
  );
};
