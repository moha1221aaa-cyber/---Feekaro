import { Audio } from "@remotion/media";
import { interpolate, staticFile, useVideoConfig } from "remotion";
import { sfx } from "../sfx";
import type { TeaserProps } from "./schema";
import { COUNT_BEAT, COUNT_START } from "./scenes/CountdownScene";
import { LOGO_SHINE } from "./scenes/LogoScene";
import { TROPHY_SHINE } from "./scenes/TrophyScene";
import { T, type Timeline } from "./timeline";

// كل صوت التيزر: التعليق، والموسيقى (تنخفض تحت الكلام)، والمؤثرات.
// التوقيت محسوب من بداية كل مشهد، فيضبط لحاله لو طال مشهد بسبب التعليق
export const TeaserAudio: React.FC<{
  tl: Timeline;
  audio: TeaserProps["audio"];
  customMusic: boolean;
}> = ({ tl, audio, customMusic }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const s = tl.starts;
  const cuts = s.slice(1).map((x) => x + T / 2);
  const voice = audio.voiceEnabled ? tl.voice : [];

  // 1 بدون كلام، 0.3 وقت الكلام، مع انتقال ناعم 8 فريم
  const duck = (abs: number) => {
    let level = 1;
    for (const c of voice) {
      const inside = interpolate(
        abs,
        [
          c.from - 8,
          c.from,
          c.from + c.durationInFrames,
          c.from + c.durationInFrames + 10,
        ],
        [0, 1, 1, 0],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        },
      );
      level = Math.min(level, 1 - inside * 0.7);
    }
    return level;
  };
  const fade = (abs: number, start: number, end: number, inF = 12, outF = 24) =>
    interpolate(abs, [start, start + inF, end - outF, end], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  const mv = audio.musicVolume;
  const fx = audio.sfxEnabled ? audio.sfxVolume : 0;
  const trophyBurst = s[4] + Math.round(0.9 * fps);

  return (
    <>
      {voice.map((c) => (
        <Audio
          key={c.id}
          name={`Voice: ${c.id}`}
          from={c.from}
          durationInFrames={c.durationInFrames}
          src={staticFile(`voiceover/${c.id}.mp3`)}
          volume={audio.voiceVolume}
        />
      ))}

      {customMusic ? (
        <Audio
          name="Music (custom)"
          src={staticFile(audio.musicFile)}
          volume={(f) =>
            mv * duck(f) * fade(f, 0, durationInFrames, fps, 1.5 * fps)
          }
        />
      ) : (
        <>
          {/* موسيقى البرنامج: توتر لين الكأس، ثم الختام */}
          <Audio
            name="Music: tension"
            durationInFrames={s[4] + 20}
            src={staticFile("show/think2.mp3")}
            loop
            volume={(f) => mv * duck(f) * fade(f, 0, s[4] + 20, fps, 30)}
          />
          <Audio
            name="Music: finale"
            from={s[4]}
            src={staticFile("show/outro.mp3")}
            volume={(f) =>
              mv *
              duck(f + s[4]) *
              fade(f + s[4], s[4], durationInFrames, 10, 1.2 * fps)
            }
          />
        </>
      )}

      {fx > 0 && (
        <>
          <Audio
            name="Braam (open)"
            from={Math.round(0.4 * fps)}
            src={staticFile("show/braam.mp3")}
            volume={0.75 * fx}
          />
          {cuts.map((c, i) => (
            <Audio
              key={i}
              name={`Whoosh ${i + 1}`}
              from={c - 12}
              src={staticFile("show/whoosh.mp3")}
              volume={0.55 * fx}
            />
          ))}
          {new Array(6).fill(0).map((_, i) => (
            <Audio
              key={i}
              name={`Card ${i + 1}`}
              from={s[2] + 16 + i * 7}
              src={sfx("interface", `glass-00${i + 1}` as "glass-001")}
              volume={0.45 * fx}
            />
          ))}
          {[0, 1, 2].map((k) => (
            <Audio
              key={k}
              name={`Count hit ${3 - k}`}
              from={s[3] + Math.round((COUNT_START + k * COUNT_BEAT) * fps)}
              src={staticFile(k === 2 ? "show/slam.mp3" : "show/impact.mp3")}
              volume={(k === 2 ? 0.8 : 0.65) * fx}
            />
          ))}
          <Audio
            name="Riser"
            from={trophyBurst - 2 * fps}
            src={staticFile("show/riser.mp3")}
            volume={0.4 * fx}
          />
          <Audio
            name="Braam (trophy)"
            from={trophyBurst}
            src={staticFile("show/braam.mp3")}
            volume={0.55 * fx}
          />
          <Audio
            name="Trophy shine"
            from={s[4] + Math.round(TROPHY_SHINE * fps)}
            src={staticFile("show/reveal.mp3")}
            volume={0.35 * fx}
          />
          <Audio
            name="Logo hit"
            from={s[5] + 2}
            src={staticFile("show/impact.mp3")}
            volume={0.6 * fx}
          />
          <Audio
            name="Logo shine"
            from={s[5] + Math.round(LOGO_SHINE * fps)}
            src={staticFile("show/reveal.mp3")}
            volume={0.45 * fx}
          />
        </>
      )}
    </>
  );
};
