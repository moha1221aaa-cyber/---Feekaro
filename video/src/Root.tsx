import { Composition } from "remotion";
import { calculateTeaserMetadata, Teaser } from "./Teaser/Teaser";
import { teaserSchema } from "./Teaser/schema";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="LeagueTeaser"
      component={Teaser}
      schema={teaserSchema}
      calculateMetadata={calculateTeaserMetadata}
      durationInFrames={900}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        colors: {
          royalBlue: "#0A1F5C",
          gold: "#D4AF37",
          goldLight: "#F5D77A",
        },
        texts: {
          intro: "استعدّوا...",
          question: "أسئلة تتحدى عقلك",
          categoriesLine: "ستة مجالات.. ومنافس واحد يكسب",
          countdown: "المنافسة أقوى من أي وقت",
          trophy: "مين بيرفع الكأس؟",
          leagueAr: "دوري بنو مسروح للنخبة",
          leagueEn: "MASRO7 LEAGUE",
          comingSoon: "المسابقة القادمة.. قريباً",
        },
        categories: ["علوم", "ثقافة عامة", "دين", "تاريخ", "رياضة", "جغرافيا"],
        audio: {
          voiceoverFile: "voiceover.mp3",
          musicFile: "music.mp3",
          voiceoverVolume: 1,
          musicVolume: 0.3,
        },
      }}
    />
  );
};
