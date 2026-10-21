import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import {
  AbsoluteFill,
  type CalculateMetadataFunction,
  interpolate,
  Sequence,
  staticFile,
  useVideoConfig,
} from "remotion";
import { Background } from "./Background";
import { fadeZoom } from "./fadeZoom";
import { LightLeak } from "./LightLeak";
import { Particles } from "./Particles";
import { TeaserSfx } from "./TeaserSfx";
import type { TeaserProps } from "./schema";
import { CategoriesScene } from "./scenes/CategoriesScene";
import { CountdownScene } from "./scenes/CountdownScene";
import { IntroScene } from "./scenes/IntroScene";
import { LogoScene } from "./scenes/LogoScene";
import { QuestionScene } from "./scenes/QuestionScene";
import { TrophyScene } from "./scenes/TrophyScene";

// كل انتقال 16 فريم، وكل مشهد ينزاد بنص الانتقال من كل جهة
// عشان نقاط القطع تطلع بالضبط على 4، 9، 15، 21، 26 ثانية والمجموع 30 ث
const T = 16;

const fileExists = async (name: string) => {
  try {
    const res = await fetch(staticFile(name), { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
};

export const calculateTeaserMetadata: CalculateMetadataFunction<
  TeaserProps
> = async ({ props }) => {
  const [voiceover, music] = await Promise.all([
    fileExists(props.audio.voiceoverFile),
    fileExists(props.audio.musicFile),
  ]);
  return { props: { ...props, audioFound: { voiceover, music } } };
};

export const Teaser: React.FC<TeaserProps> = ({
  colors,
  texts,
  categories,
  audio,
  audioFound,
}) => {
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Background royalBlue={colors.royalBlue} />
      <Particles
        count={35}
        gold={colors.gold}
        goldLight={colors.goldLight}
        seed="global"
        opacity={0.5}
      />

      <TransitionSeries>
        <TransitionSeries.Sequence
          name="1 استعدوا"
          durationInFrames={4 * fps + T / 2}
        >
          <IntroScene colors={colors} text={texts.intro} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fadeZoom()}
          timing={linearTiming({ durationInFrames: T })}
        />
        <TransitionSeries.Sequence
          name="2 علامة الاستفهام"
          durationInFrames={5 * fps + T}
        >
          <QuestionScene colors={colors} text={texts.question} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fadeZoom()}
          timing={linearTiming({ durationInFrames: T })}
        />
        <TransitionSeries.Sequence
          name="3 البطاقات"
          durationInFrames={6 * fps + T}
        >
          <CategoriesScene
            colors={colors}
            categories={categories}
            text={texts.categoriesLine}
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fadeZoom()}
          timing={linearTiming({ durationInFrames: T })}
        />
        <TransitionSeries.Sequence
          name="4 العد التنازلي"
          durationInFrames={6 * fps + T}
        >
          <CountdownScene colors={colors} text={texts.countdown} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fadeZoom()}
          timing={linearTiming({ durationInFrames: T })}
        />
        <TransitionSeries.Sequence
          name="5 الكأس"
          durationInFrames={5 * fps + T}
        >
          <TrophyScene colors={colors} text={texts.trophy} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fadeZoom()}
          timing={linearTiming({ durationInFrames: T })}
        />
        <TransitionSeries.Sequence
          name="6 الشعار"
          durationInFrames={4 * fps + T / 2}
        >
          <LogoScene
            colors={colors}
            leagueAr={texts.leagueAr}
            leagueEn={texts.leagueEn}
            comingSoon={texts.comingSoon}
          />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {/* Light leaks ذهبية على نقاط القطع */}
      <Sequence name="Light leak 1" from={4 * fps - 12} durationInFrames={24}>
        <LightLeak gold={colors.gold} goldLight={colors.goldLight} />
      </Sequence>
      <Sequence name="Light leak 2" from={9 * fps - 12} durationInFrames={24}>
        <LightLeak gold={colors.gold} goldLight={colors.goldLight} flip />
      </Sequence>
      <Sequence name="Light leak 3" from={15 * fps - 12} durationInFrames={24}>
        <LightLeak gold={colors.gold} goldLight={colors.goldLight} />
      </Sequence>
      <Sequence name="Light leak 4" from={21 * fps - 12} durationInFrames={24}>
        <LightLeak gold={colors.gold} goldLight={colors.goldLight} flip />
      </Sequence>
      <Sequence name="Light leak 5" from={26 * fps - 12} durationInFrames={24}>
        <LightLeak gold={colors.gold} goldLight={colors.goldLight} />
      </Sequence>

      {/* Vignette سينمائي */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(ellipse at center, transparent 55%, #000000cc 100%)",
          pointerEvents: "none",
        }}
      />

      {audioFound?.music ? (
        <Audio
          name="Music"
          src={staticFile(audio.musicFile)}
          volume={(f) =>
            audio.musicVolume *
            interpolate(
              f,
              [0, fps, durationInFrames - 1.5 * fps, durationInFrames],
              [0, 1, 1, 0],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            )
          }
        />
      ) : null}
      {audio.sfxEnabled ? <TeaserSfx volume={audio.sfxVolume} /> : null}
      {audioFound?.voiceover ? (
        <Audio
          name="Voiceover"
          src={staticFile(audio.voiceoverFile)}
          volume={audio.voiceoverVolume}
        />
      ) : null}
    </AbsoluteFill>
  );
};
