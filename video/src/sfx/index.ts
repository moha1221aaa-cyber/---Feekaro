import { staticFile } from "remotion";
import { SFX_CATALOG } from "./catalog";

export { SFX_CATALOG };
export type SfxPack = keyof typeof SFX_CATALOG;
export type SfxName<P extends SfxPack> = (typeof SFX_CATALOG)[P][number];

// sfx("impact", "impact-metal-heavy-000") ← رابط الملف في public/sfx
export const sfx = <P extends SfxPack>(pack: P, name: SfxName<P>) =>
  staticFile(`sfx/${pack}/${name}.ogg`);
