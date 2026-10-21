import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

// النص يطلع كلمة كلمة (من اليمين) بحركة Spring و Blur
export const WordReveal: React.FC<{
  text: string;
  delay: number;
  stagger?: number;
  style?: React.CSSProperties;
  wordStyle?: React.CSSProperties;
}> = ({ text, delay, stagger = 4, style, wordStyle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ").filter(Boolean);

  return (
    <div
      style={{
        direction: "rtl",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        columnGap: "0.28em",
        textAlign: "center",
        ...style,
      }}
    >
      {words.map((w, i) => {
        const p = spring({
          frame: frame - delay - i * stagger,
          fps,
          config: { damping: 16, stiffness: 110 },
        });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: interpolate(p, [0, 0.5], [0, 1], {
                extrapolateRight: "clamp",
              }),
              filter: `blur(${interpolate(p, [0, 1], [12, 0])}px)`,
              translate: `0px ${interpolate(p, [0, 1], [40, 0])}px`,
              scale: String(interpolate(p, [0, 1], [0.9, 1])),
              ...wordStyle,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};
