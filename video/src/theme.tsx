import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { loadFont as loadReem } from "@remotion/google-fonts/ReemKufi";
import { loadFont as loadTajawal } from "@remotion/google-fonts/Tajawal";

export const reem = loadReem("normal", {
  weights: ["700"],
  subsets: ["arabic", "latin"],
}).fontFamily;
export const tajawal = loadTajawal("normal", {
  weights: ["500", "800"],
  subsets: ["arabic", "latin"],
}).fontFamily;

export const COLORS = {
  night: "#02061A",
  navy: "#061237",
  royal: "#0E2A7A",
  gold: "#D4AF37",
  goldLight: "#F7E08A",
  goldDeep: "#8C6A12",
};

export const CLAMP = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

// Gold text: gradient fill + glow. No letterSpacing so Arabic letters stay joined.
export const goldText: React.CSSProperties = {
  backgroundImage: `linear-gradient(180deg, ${COLORS.goldLight} 0%, ${COLORS.gold} 50%, ${COLORS.goldDeep} 100%)`,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  filter: `drop-shadow(0 0 18px rgba(212,175,55,0.55))`,
};

export const RoyalBackground: React.FC<{ glow?: number }> = ({
  glow = 1,
}) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 70% 45% at 50% 50%, rgba(14,42,122,${0.9 * glow}) 0%, ${COLORS.navy} 55%, ${COLORS.night} 100%)`,
    }}
  />
);

// Deterministic drifting gold dust.
export const GoldDust: React.FC<{ count?: number; opacity?: number }> = ({
  count = 60,
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity, pointerEvents: "none" }}>
      {new Array(count).fill(0).map((_, i) => {
        const x = random(`x${i}`) * 1080;
        const speed = 0.4 + random(`s${i}`) * 1.4;
        const y = (random(`y${i}`) * 2100 - frame * speed + 4000) % 2100 - 90;
        const size = 2 + random(`r${i}`) * 6;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(frame / 14 + i));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: "50%",
              background: COLORS.goldLight,
              boxShadow: `0 0 ${size * 3}px ${COLORS.gold}`,
              opacity: tw,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.75) 100%)",
    }}
  />
);

export const useFlash = (at: number, len = 8) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [at, at + 2, at + len], [0, 1, 0], CLAMP);
};
