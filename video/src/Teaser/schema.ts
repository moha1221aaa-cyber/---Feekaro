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
    voiceoverFile: z.string(),
    musicFile: z.string(),
    voiceoverVolume: z.number().min(0).max(1),
    musicVolume: z.number().min(0).max(1),
    sfxEnabled: z.boolean(),
    sfxVolume: z.number().min(0).max(1),
  }),
  // يعبّيها calculateMetadata: هل ملفات الصوت موجودة في public؟
  audioFound: z
    .object({ voiceover: z.boolean(), music: z.boolean() })
    .optional(),
});

export type TeaserProps = z.infer<typeof teaserSchema>;
export type TeaserColors = TeaserProps["colors"];
