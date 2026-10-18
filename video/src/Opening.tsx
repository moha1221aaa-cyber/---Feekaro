import { Audio } from "@remotion/media";
import { AbsoluteFill, interpolate, Sequence, staticFile, Track, useVideoConfig } from "remotion";
import { CLAMP, COLORS } from "./theme";
import { Countdown, Finale, Ignition, LogoReveal, Symbols, Tagline } from "./scenes/Scenes";

const Sfx: React.FC<{ at: number; file: string; volume?: number; name: string }> = ({ at, file, volume = 0.8, name }) => (
  <Sequence from={at} name={name} layout="none">
    <Audio src={staticFile(`audio/${file}`)} volume={volume} />
  </Sequence>
);

export const Opening = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: COLORS.night }}>
      <Track name="Scenes">
        <Ignition name="1 Ignition" durationInFrames={4 * fps} />
        <Tagline name="2 Tagline" from={4 * fps} durationInFrames={5 * fps} />
        <Symbols name="3 Symbols" from={9 * fps} durationInFrames={6 * fps} />
        <Countdown name="4 Countdown" from={15 * fps} durationInFrames={6 * fps} />
        <LogoReveal name="5 Logo" from={21 * fps} durationInFrames={6 * fps} />
        <Finale name="6 Finale" from={27 * fps} durationInFrames={3 * fps} />
      </Track>

      {/* Music beds */}
      <Sequence name="Suspense bed" durationInFrames={21 * fps} layout="none">
        <Audio
          src={staticFile("audio/decider.mp3")}
          volume={(f) => interpolate(f, [0, 2 * fps, 19.5 * fps, 21 * fps], [0, 0.55, 0.55, 0], CLAMP)}
        />
      </Sequence>
      <Sequence name="Logo theme" from={21 * fps} durationInFrames={9 * fps} layout="none">
        <Audio
          src={staticFile("audio/show_intro.mp3")}
          volume={(f) => interpolate(f, [0, 0.3 * fps, 7.5 * fps, 9 * fps], [0, 0.75, 0.75, 0], CLAMP)}
        />
      </Sequence>

      {/* Hits */}
      <Sfx name="Riser" at={1 * fps} file="riser.mp3" volume={0.7} />
      <Sfx name="Braam" at={4 * fps} file="braam.mp3" volume={0.85} />
      <Sfx name="Whoosh 1" at={9 * fps} file="whoosh.mp3" />
      <Sfx name="Whoosh 2" at={10 * fps} file="whoosh.mp3" />
      <Sfx name="Whoosh 3" at={11 * fps} file="whoosh.mp3" />
      <Sfx name="Whoosh 4" at={13 * fps} file="whoosh.mp3" />
      <Sfx name="Slam 3" at={15 * fps} file="slam.mp3" />
      <Sfx name="Beat 3" at={15 * fps} file="heartbeat.mp3" volume={0.9} />
      <Sfx name="Slam 2" at={17 * fps} file="slam.mp3" />
      <Sfx name="Beat 2" at={17 * fps} file="heartbeat.mp3" volume={0.9} />
      <Sfx name="Slam 1" at={19 * fps} file="slam.mp3" />
      <Sfx name="Beat 1" at={19 * fps} file="heartbeat.mp3" volume={0.9} />
      <Sfx name="Reveal" at={21 * fps} file="reveal.mp3" volume={0.9} />
      <Sfx name="Fireworks" at={26 * fps} file="fireworks.mp3" volume={0.35} />
      <Sfx name="Applause" at={27 * fps} file="applause.mp3" volume={0.6} />
    </AbsoluteFill>
  );
};
