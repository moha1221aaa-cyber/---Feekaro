import { zColor } from "@remotion/zod-types";
import { z } from "zod";

export const teaserSchema = z.object({
  colors: z.object({
    royalBlue: zColor(),
    gold: zColor(),
    goldLight: zColor(),
  }),
  texts: z.object({
    intro: z.string(),
    question: z.string(),
    categoriesLine: z.string(),
    countdown: z.string(),
    trophy: z.string(),
    leagueAr: z.string(),
    leagueEn: z.string(),
    comingSoon: z.string(),
  }),
  categories: z.array(z.string()),
  audio: z.object({
    voiceEnabled: z.boolean(),
    voiceVolume: z.number().min(0).max(1),
    // موسيقى خاصة في public (اختيارية). لو موجودة تحل محل موسيقى البرنامج
    musicFile: z.string(),
    musicVolume: z.number().min(0).max(1),
    sfxEnabled: z.boolean(),
    sfxVolume: z.number().min(0).max(1),
  }),
  // يعبّيها calculateMetadata
  computed: z
    .object({
      sceneFrames: z.array(z.number()),
      starts: z.array(z.number()),
      voice: z.array(
        z.object({
          id: z.string(),
          from: z.number(),
          durationInFrames: z.number(),
        }),
      ),
      customMusic: z.boolean(),
    })
    .optional(),
});

export type TeaserProps = z.infer<typeof teaserSchema>;
export type TeaserColors = TeaserProps["colors"];
