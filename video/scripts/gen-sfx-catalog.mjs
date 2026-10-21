// يولّد src/sfx/catalog.ts من ملفات public/sfx (شغّله بعد إضافة أو حذف أي صوت)
import { readdirSync, writeFileSync } from "node:fs";

const root = new URL("../public/sfx/", import.meta.url);
const packs = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

let out = "// ملف مولّد: npm run sfx:catalog\nexport const SFX_CATALOG = {\n";
let total = 0;
for (const pack of packs) {
  const names = readdirSync(new URL(`${pack}/`, root))
    .filter((f) => f.endsWith(".ogg"))
    .map((f) => f.slice(0, -4))
    .sort();
  total += names.length;
  out += `  ${JSON.stringify(pack)}: [\n${names.map((n) => `    ${JSON.stringify(n)},`).join("\n")}\n  ],\n`;
}
out += "} as const;\n";
writeFileSync(new URL("../src/sfx/catalog.ts", import.meta.url), out);
console.log(`${total} sounds in ${packs.length} packs`);
