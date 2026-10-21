import {
  AbsoluteFill,
  interpolate,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { cairo, tajawal } from "../fonts";
import { goldText } from "../goldText";
import { RevealText } from "../RevealText";
import type { TeaserColors } from "../schema";

const CARD_W = 410;
const CARD_H = 250;

// مشهد 3: بطاقات الأسئلة تطير وتتقلب وتستقر في شبكة 2×3
export const CategoriesScene: React.FC<{
  colors: TeaserColors;
  categories: string[];
  text: string;
}> = ({ colors, categories, text }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ perspective: 1800 }}>
        {categories.slice(0, 6).map((cat, i) => {
          const col = i % 2; // RTL: أول بطاقة يمين
          const row = Math.floor(i / 2);
          const tx = width / 2 + (col === 0 ? 225 : -225) - CARD_W / 2;
          const ty = 400 + row * 300;
          const p = spring({
            frame: frame - (4 + i * 7),
            fps,
            config: { damping: 15, stiffness: 80 },
          });
          const fromX = (random(`cx${i}`) - 0.5) * 2400;
          const fromY = 1400 + random(`cy${i}`) * 900;
          const float = Math.sin((frame + i * 13) / 18) * 8 * p;
          const highlight =
            Math.max(0, Math.sin((frame - 70 - i * 10) / 9)) *
            (frame > 70 ? 1 : 0);

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: tx,
                top: ty,
                width: CARD_W,
                height: CARD_H,
                transformStyle: "preserve-3d",
                translate: `${interpolate(p, [0, 1], [fromX, 0])}px ${interpolate(p, [0, 1], [fromY, 0]) + float}px`,
                rotate: `y ${interpolate(p, [0, 1], [720 + 180, 0])}deg`,
                scale: String(interpolate(p, [0, 1], [0.5, 1])),
                opacity: interpolate(p, [0, 0.15], [0, 1], {
                  extrapolateRight: "clamp",
                }),
              }}
            >
              {/* الوجه */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backfaceVisibility: "hidden",
                  borderRadius: 28,
                  border: `3px solid ${colors.gold}`,
                  backgroundImage: `linear-gradient(160deg, ${colors.royalBlue} 0%, #050d2b 100%)`,
                  boxShadow: `0 0 ${30 + highlight * 50}px ${colors.gold}${highlight > 0.3 ? "aa" : "44"}, inset 0 0 40px #00000088`,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  direction: "rtl",
                }}
              >
                <div
                  style={{
                    fontFamily: tajawal,
                    fontWeight: 700,
                    fontSize: 34,
                    color: colors.goldLight,
                    opacity: 0.8,
                  }}
                >
                  {`سؤال ${i + 1}`}
                </div>
                <div
                  style={{
                    fontFamily: cairo,
                    fontWeight: 900,
                    fontSize: 76,
                    lineHeight: 1.3,
                    ...goldText(colors),
                  }}
                >
                  {cat}
                </div>
              </div>
              {/* الظهر */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backfaceVisibility: "hidden",
                  rotate: "y 180deg",
                  borderRadius: 28,
                  border: `3px solid ${colors.gold}`,
                  backgroundImage: `repeating-linear-gradient(45deg, ${colors.gold}22 0 12px, transparent 12px 24px), linear-gradient(160deg, #0b1a4d, #000)`,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: cairo,
                    fontWeight: 900,
                    fontSize: 170,
                    ...goldText(colors),
                  }}
                >
                  ؟
                </span>
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 250,
        }}
      >
        <RevealText
          delay={2 * fps}
          style={{
            fontFamily: cairo,
            fontWeight: 900,
            fontSize: 90,
            color: "#fff",
            lineHeight: 1.45,
            padding: "0 80px",
          }}
        >
          <span style={{ filter: `drop-shadow(0 0 22px ${colors.gold}aa)` }}>
            {text}
          </span>
        </RevealText>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
