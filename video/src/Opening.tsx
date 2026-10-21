/* افتتاح البث (5 ث): الأشرطة تمسح، والشعار واسم الدوري، وبعدها "بث مباشر" */
import { Track, useVideoConfig } from "remotion";
import { Bands } from "./Bands";
import { Mark } from "./Mark";
import { C } from "./theme";

export const Opening = () => {
  const { fps } = useVideoConfig();
  return (
    <Track name="Opening">
      <Bands name="Bands" durationInFrames={5 * fps} holdSeconds={3.6} style={{ backgroundColor: C.navy }} />
      <Mark name="League" from={0.35 * fps} durationInFrames={2.4 * fps} title="دوري بنو مسروح" sub="للنخبة" outSeconds={2} />
      <Mark name="Live" from={2.6 * fps} durationInFrames={2 * fps} title="بث مباشر" sub="الأسرع على الجرس يجاوب" outSeconds={1.6} />
    </Track>
  );
};
