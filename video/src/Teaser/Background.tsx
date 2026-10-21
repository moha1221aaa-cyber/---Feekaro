import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// خلفية متدرجة من الأزرق الملكي للأسود، تتحرك ببطء طول الفيديو
export const Background: React.FC<{ royalBlue: string }> = ({ royalBlue }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const x = 50 + Math.sin(frame / 90) * 18;
  const y = interpolate(frame, [0, durationInFrames], [30, 55]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000",
        backgroundImage: `radial-gradient(120% 80% at ${x}% ${y}%, ${royalBlue} 0%, #06123a 38%, #020617 70%, #000 100%)`,
      }}
    />
  );
};
