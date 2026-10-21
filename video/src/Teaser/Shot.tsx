import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

// حركة كاميرا بطيئة (push-in) طول المشهد
export const Shot: React.FC<{
  frames: number;
  from?: number;
  to?: number;
  children: React.ReactNode;
}> = ({ frames, from = 1, to = 1.07, children }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        scale: String(
          interpolate(frame, [0, frames], [from, to], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.inOut(Easing.sin),
          }),
        ),
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
