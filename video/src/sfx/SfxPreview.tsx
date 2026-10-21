import { Audio } from "@remotion/media";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { SFX_CATALOG, sfx, type SfxPack } from ".";

export const sfxPreviewSchema = z.object({
  pack: z.enum(Object.keys(SFX_CATALOG) as [SfxPack, ...SfxPack[]]),
  name: z.string(),
});

// لتجربة أي صوت من المكتبة في Studio: غيّر pack و name من Props
export const SfxPreview: React.FC<z.infer<typeof sfxPreviewSchema>> = ({
  pack,
  name,
}) => {
  const names: readonly string[] = SFX_CATALOG[pack];
  const valid = names.includes(name);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0A1F5C",
        color: "#F5D77A",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "monospace",
        fontSize: 44,
        textAlign: "center",
        padding: 60,
      }}
    >
      <div>{pack}</div>
      <div style={{ fontSize: 56, color: valid ? "#fff" : "#ff6b6b" }}>
        {valid ? name : `${name} (غير موجود)`}
      </div>
      <div style={{ fontSize: 28, opacity: 0.7, marginTop: 30 }}>
        {names.length} صوت في هذي الحزمة
      </div>
      {valid ? <Audio src={sfx(pack, name as never)} /> : null}
    </AbsoluteFill>
  );
};
