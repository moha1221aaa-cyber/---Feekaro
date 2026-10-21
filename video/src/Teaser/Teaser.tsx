import { linearTiming, TransitionSeries } from "@remotion/transitions";
import {
  AbsoluteFill,
  type CalculateMetadataFunction,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Background } from "./Background";
import { Bokeh } from "./Bokeh";
import { fadeZoom } from "./fadeZoom";
import { FilmGrain } from "./FilmGrain";
import { LightLeak } from "./LightLeak";
import { Particles } from "./Particles";
import type { TeaserProps } from "./schema";
import { CategoriesScene } from "./scenes/CategoriesScene";
import { CountdownScene } from "./scenes/CountdownScene";
import { IntroScene } from "./scenes/IntroScene";
import { LogoScene } from "./scenes/LogoScene";
import { QuestionScene } from "./scenes/QuestionScene";
import { TrophyScene } from "./scenes/TrophyScene";
import { Shot } from "./Shot";
import { TeaserAudio } from "./TeaserAudio";
import { buildTimeline, T, totalFrames, type VoiceManifest } from "./timeline";

const FPS = 30; // نفس fps حق <Composition>

const fileExists = async (name: string) => {
  try {
    return (await fetch(staticFile(name), { method: "HEAD" })).ok;
  } catch {
    return false;
  }
};

// يقرا أطوال التعليق الصوتي (public/voiceover/manifest.json) ويطوّل المشاهد على قدها
export const calculateTeaserMetadata: CalculateMetadataFunction<
  TeaserProps
> = async ({ props }) => {
  let manifest: VoiceManifest | null = null;
  if (props.audio.voiceEnabled) {
    try {
      const res = await fetch(staticFile("voiceover/manifest.json"));
      if (res.ok) manifest = await res.json();
    } catch {
      manifest = null;
    }
  }
  const tl = buildTimeline(FPS, manifest);
  const customMusic = await fileExists(props.audio.musicFile);
  return {
    durationInFrames: totalFrames(tl),
    props: { ...props, computed: { ...tl, customMusic } },
  };
};

export const Teaser: React.FC<TeaserProps> = ({
  colors,
  texts,
  categories,
  audio,
  computed,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const tl = computed ?? buildTimeline(fps, null);
  const f = tl.sceneFrames;
  const cuts = tl.starts.slice(1).map((s) => s + T / 2);
  const fadeTiming = linearTiming({ durationInFrames: T });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Background royalBlue={colors.royalBlue} />
      <Bokeh gold={colors.gold} goldLight={colors.goldLight} />
      <Particles
        count={35}
        gold={colors.gold}
        goldLight={colors.goldLight}
        seed="global"
        opacity={0.5}
      />

      <TransitionSeries>
        <TransitionSeries.Sequence name="1 استعدوا" durationInFrames={f[0]}>
          <Shot frames={f[0]} to={1.1}>
            <IntroScene colors={colors} text={texts.intro} />
          </Shot>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fadeZoom()}
          timing={fadeTiming}
        />
        <TransitionSeries.Sequence
          name="2 علامة الاستفهام"
          durationInFrames={f[1]}
        >
          <Shot frames={f[1]}>
            <QuestionScene colors={colors} text={texts.question} />
          </Shot>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fadeZoom()}
          timing={fadeTiming}
        />
        <TransitionSeries.Sequence name="3 البطاقات" durationInFrames={f[2]}>
          <Shot frames={f[2]} to={1.05}>
            <CategoriesScene
              colors={colors}
              categories={categories}
              text={texts.categoriesLine}
            />
          </Shot>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fadeZoom()}
          timing={fadeTiming}
        />
        <TransitionSeries.Sequence
          name="4 العد التنازلي"
          durationInFrames={f[3]}
        >
          <Shot frames={f[3]} to={1.04}>
            <CountdownScene colors={colors} text={texts.countdown} />
          </Shot>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fadeZoom()}
          timing={fadeTiming}
        />
        <TransitionSeries.Sequence name="5 الكأس" durationInFrames={f[4]}>
          <Shot frames={f[4]} from={1.04} to={1}>
            <TrophyScene colors={colors} text={texts.trophy} />
          </Shot>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fadeZoom()}
          timing={fadeTiming}
        />
        <TransitionSeries.Sequence name="6 الشعار" durationInFrames={f[5]}>
          <Shot frames={f[5]} to={1.05}>
            <LogoScene
              colors={colors}
              leagueAr={texts.leagueAr}
              leagueEn={texts.leagueEn}
              comingSoon={texts.comingSoon}
            />
          </Shot>
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {/* Light leaks ذهبية على نقاط القطع */}
      {cuts.map((c, i) => (
        <Sequence
          key={i}
          name={`Light leak ${i + 1}`}
          from={c - 15}
          durationInFrames={30}
        >
          <LightLeak
            gold={colors.gold}
            goldLight={colors.goldLight}
            flip={i % 2 === 1}
          />
        </Sequence>
      ))}

      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(ellipse at center, transparent 50%, #000000d9 100%)",
          pointerEvents: "none",
        }}
      />
      <FilmGrain />
      {/* يطفي للأسود آخر نص ثانية */}
      <AbsoluteFill
        style={{
          backgroundColor: "#000",
          opacity: interpolate(
            frame,
            [durationInFrames - 0.5 * fps, durationInFrames - 1],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          ),
        }}
      />

      <TeaserAudio
        tl={tl}
        audio={audio}
        customMusic={computed?.customMusic ?? false}
      />
    </AbsoluteFill>
  );
};
