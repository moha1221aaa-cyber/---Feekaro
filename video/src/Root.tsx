import { Composition } from "remotion";
import { Opening } from "./Opening";
import { Bumper } from "./Bumper";

/* عمودي 1080×1920 لأن البث يتشاف من الجوال. الريندر: .github/workflows/league-video.yml (يحط الملفات في media/) */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="Opening" component={Opening} durationInFrames={150} fps={30} width={1080} height={1920} />
      <Composition id="Bumper" component={Bumper} durationInFrames={66} fps={30} width={1080} height={1920} />
    </>
  );
};
