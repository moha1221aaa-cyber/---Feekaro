import {
  AbsoluteFill,
  random,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// دوائر ضوء ذهبية كبيرة ومموّهة (عمق سينمائي) تتحرك ببطء بطبقتين
export const Bokeh: React.FC<{
  gold: string;
  goldLight: string;
  count?: number;
}> = ({ gold, goldLight, count = 16 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen" }}>
      {new Array(count).fill(0).map((_, i) => {
        const r = (k: string) => random(`bokeh-${i}-${k}`);
        const near = r("d") > 0.6; // الطبقة القريبة أكبر وأسرع وأكثر تمويه
        const size = near ? 160 + r("s") * 200 : 50 + r("s") * 90;
        const speed = near ? 0.9 : 0.35;
        const x =
          r("x") * width + Math.sin(frame / (70 + r("w") * 50) + i) * 40;
        const y =
          ((((r("y") * (height + 400) - frame * speed) % (height + 400)) +
            height +
            400) %
            (height + 400)) -
          200;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - size / 2,
              top: y - size / 2,
              width: size,
              height: size,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${r("c") > 0.5 ? goldLight : gold}55 0%, ${gold}1a 45%, transparent 68%)`,
              opacity: 0.35 + 0.35 * Math.abs(Math.sin(frame / 50 + i)),
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
