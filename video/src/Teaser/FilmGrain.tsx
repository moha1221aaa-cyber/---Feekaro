import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";

// حبيبات فيلم خفيفة: 4 صور ضوضاء جاهزة (public/fx) تتبدل كل فريم. أسرع بكثير من feTurbulence
export const FilmGrain: React.FC<{ opacity?: number }> = ({
  opacity = 0.07,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{ opacity, mixBlendMode: "overlay", pointerEvents: "none" }}
    >
      <Img
        src={staticFile(`fx/grain-${frame % 4}.png`)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          scale: frame % 2 ? "1.05" : "1",
        }}
      />
    </AbsoluteFill>
  );
};
