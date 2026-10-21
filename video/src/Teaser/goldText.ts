import type { TeaserColors } from "./schema";

// ذهب معدني: تدرج بعدة طبقات، و sheen (0..1) يحرّك اللمعة
export const goldText = (
  c: TeaserColors,
  angle = 180,
  sheen = 0.5,
): React.CSSProperties => ({
  backgroundImage: `linear-gradient(${angle}deg, #fff3c4 0%, ${c.goldLight} 18%, ${c.gold} 42%, #9a7414 58%, ${c.gold} 74%, ${c.goldLight} 92%, #fff3c4 100%)`,
  backgroundSize: "100% 220%",
  backgroundPosition: `0% ${sheen * 100}%`,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
});

export const goldGlow = (c: TeaserColors, px = 30) =>
  `drop-shadow(0 0 ${px}px ${c.gold}80) drop-shadow(0 6px 4px #000000aa)`;
