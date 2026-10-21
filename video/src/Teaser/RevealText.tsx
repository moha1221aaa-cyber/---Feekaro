import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

// نص يطلع بحركة Spring مع Blur خفيف
export const RevealText: React.FC<{
  children: React.ReactNode;
  delay: number;
  style?: React.CSSProperties;
}> = ({ children, delay, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({
    frame: frame - delay,
    fps,
    config: { damping: 18, stiffness: 90 },
  });

  return (
    <div
      style={{
        direction: "rtl",
        textAlign: "center",
        opacity: interpolate(p, [0, 0.6], [0, 1], {
          extrapolateRight: "clamp",
        }),
        filter: `blur(${interpolate(p, [0, 1], [14, 0])}px)`,
        scale: String(interpolate(p, [0, 1], [0.86, 1])),
        translate: `0px ${interpolate(p, [0, 1], [50, 0])}px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
