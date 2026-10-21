import {
  AbsoluteFill,
  random,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// جزيئات ذهبية تطفو ببطء لفوق وتلمع
export const Particles: React.FC<{
  count: number;
  gold: string;
  goldLight: string;
  seed: string;
  opacity?: number;
}> = ({ count, gold, goldLight, seed, opacity = 1 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ opacity, pointerEvents: "none" }}>
      {new Array(count).fill(0).map((_, i) => {
        const r = (k: string) => random(`${seed}-${i}-${k}`);
        const size = 3 + r("s") * 9;
        const speed = 0.4 + r("v") * 1.4;
        const startY = r("y") * (height + 200);
        const y =
          ((((startY - frame * speed) % (height + 200)) + height + 200) %
            (height + 200)) -
          100;
        const x =
          r("x") * width + Math.sin(frame / (40 + r("w") * 60) + i) * 30;
        const twinkle =
          0.35 + 0.65 * Math.abs(Math.sin(frame / (12 + r("t") * 25) + i));
        const color = r("c") > 0.5 ? goldLight : gold;
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
              backgroundColor: color,
              opacity: twinkle,
              filter: size > 8 ? "blur(2px)" : undefined,
              boxShadow: `0 0 ${size * 2.5}px ${color}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
