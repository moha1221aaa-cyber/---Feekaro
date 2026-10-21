import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";
import { AbsoluteFill, interpolate } from "remotion";

type Props = Record<string, never>;

// انتقال Fade + Zoom: المشهد الطالع يكبر ويختفي، والداخل يكبر من 0.9 ويبان
const FadeZoom: React.FC<TransitionPresentationComponentProps<Props>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
}) => {
  const entering = presentationDirection === "entering";
  return (
    <AbsoluteFill
      style={{
        opacity: entering ? p : 1 - p,
        scale: String(entering ? interpolate(p, [0, 1], [0.9, 1]) : interpolate(p, [0, 1], [1, 1.18])),
        filter: `blur(${entering ? (1 - p) * 10 : p * 10}px)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const fadeZoom = (): TransitionPresentation<Props> => ({
  component: FadeZoom,
  props: {},
});
