import { AbsoluteFill } from "remotion";

// وهج عدسة أنامورفيك: خط أفقي طويل ونواة ضوء. intensity من 0 إلى 1
export const LensFlare: React.FC<{
  x?: number;
  y: number;
  intensity: number;
  color: string;
}> = ({ x = 50, y, intensity, color }) => {
  if (intensity <= 0.01) return null;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        mixBlendMode: "screen",
        opacity: intensity,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: `${x}%`,
          top: `${y}%`,
          width: 2400,
          height: 10,
          translate: "-50% -50%",
          background: `linear-gradient(90deg, transparent, ${color}66 30%, #fffbe8 50%, ${color}66 70%, transparent)`,
          filter: "blur(3px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: `${x}%`,
          top: `${y}%`,
          width: 1400,
          height: 90,
          translate: "-50% -50%",
          background: `radial-gradient(ellipse, ${color}55 0%, transparent 70%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: `${x}%`,
          top: `${y}%`,
          width: 260,
          height: 260,
          translate: "-50% -50%",
          borderRadius: "50%",
          background: `radial-gradient(circle, #ffffff 0%, ${color}aa 18%, transparent 65%)`,
        }}
      />
    </AbsoluteFill>
  );
};
