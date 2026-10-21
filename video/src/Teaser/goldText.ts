import type { TeaserColors } from "./schema";

// نص بتدرج ذهبي (بيستخدم background-clip)
export const goldText = (
  c: TeaserColors,
  angle = 180,
): React.CSSProperties => ({
  backgroundImage: `linear-gradient(${angle}deg, ${c.goldLight} 0%, ${c.gold} 45%, #8a6a12 75%, ${c.goldLight} 100%)`,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
});

export const goldGlow = (c: TeaserColors, px = 30) =>
  `drop-shadow(0 0 ${px}px ${c.gold}88) drop-shadow(0 4px 2px #00000099)`;
