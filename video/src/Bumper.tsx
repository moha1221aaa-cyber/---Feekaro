/* فاصل بين المواجهات (2 ث): نفس الأشرطة والشعار، بدون نص (النص الحي يطلع فوقه من tv.js) */
import { Track, useVideoConfig } from "remotion";
import { Bands } from "./Bands";
import { Mark } from "./Mark";
import { C } from "./theme";

export const Bumper = () => {
  const { fps } = useVideoConfig();
  return (
    <Track name="Bumper">
      <Bands name="Bands" durationInFrames={2.2 * fps} holdSeconds={1.1} style={{ backgroundColor: C.navy }} />
      <Mark name="Logo" from={0.25 * fps} durationInFrames={1.6 * fps} title="" sub="" outSeconds={1.2} />
    </Track>
  );
};
