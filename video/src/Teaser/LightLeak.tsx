import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Light leak ذهبي يمر على نقطة القطع بين مشهدين
export const LightLeak: React.FC<{
  gold: string;
  goldLight: string;
  flip?: boolean;
}> = ({ gold, goldLight, flip }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames;
  const x = interpolate(t, [0, 1], flip ? [110, -10] : [-10, 110]);

  return (
    <AbsoluteFill
      style={{
        mixBlendMode: "screen",
        pointerEvents: "none",
        opacity: interpolate(t, [0, 0.45, 0.55, 1], [0, 0.85, 0.85, 0]),
        backgroundImage: [
          `radial-gradient(40% 30% at ${x}% 35%, ${goldLight}cc 0%, transparent 70%)`,
          `radial-gradient(55% 45% at ${100 - x}% 70%, ${gold}99 0%, transparent 70%)`,
          `linear-gradient(${flip ? 120 : 60}deg, transparent 30%, ${gold}40 50%, transparent 70%)`,
        ].join(","),
      }}
    />
  );
};
