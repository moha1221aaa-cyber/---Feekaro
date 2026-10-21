/* يجرب كاشف الكلام (vaVadCreate في js/broadcast/va-worklet.js) على ملفات المايك الوهمي بدون متصفح:
   الكلام الحقيقي في الملفات: 1.15 ث كل 4 ث. node tests/harness/vad.mjs */
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(HERE, "../../js/broadcast/va-worklet.js"), "utf8"), ctx);

function readWav(f) {
    const b = fs.readFileSync(f);
    let o = 12, rate = 48000, data = null;
    while (o < b.length) {
        const id = b.toString("ascii", o, o + 4), sz = b.readUInt32LE(o + 4);
        if (id === "fmt ") rate = b.readUInt32LE(o + 12);
        if (id === "data") { data = new Float32Array(sz / 2); for (let i = 0; i < data.length; i++) data[i] = b.readInt16LE(o + 8 + i * 2) / 32768; break; }
        o += 8 + sz;
    }
    return { rate, data };
}

const cases = { "speech.wav": true, "speech_music.wav": true, "silence.wav": false, "music_only.wav": false };
let ok = true;
for (const [f, hasSpeech] of Object.entries(cases)) {
    const { rate, data } = readWav(path.join(HERE, "audio", f));
    const v = ctx.vaVadCreate(rate);
    const segs = []; let cur = null;
    for (let i = 0; i + v.N <= data.length; i += v.N) {
        const t = v.frame(data.subarray(i, i + v.N)), at = i / rate;
        if (t && !cur) cur = { from: at };
        if (!t && cur) { cur.to = at; segs.push(cur); cur = null; }
    }
    /* الكلام يطلع خلال أول 0.3 ث من بداية كل مقطع، ويخلص خلال 0.6 ث من نهايته */
    let hits = 0, false_ = 0;
    for (const s of segs) {
        const k = Math.round(s.from / 4) * 4;
        if (hasSpeech && s.from >= k - 0.05 && s.from <= k + 0.3 && s.to <= k + 1.15 + 0.6) hits++; else false_++;
    }
    const pass = hasSpeech ? (hits >= 7 && false_ === 0) : segs.length === 0;
    if (!pass) ok = false;
    console.log(`${pass ? "PASS" : "FAIL"} ${f}: ${segs.length} مقطع، صح ${hits}، غلط ${false_}، أول مقطع ${segs[0] ? segs[0].from.toFixed(2) + "-" + segs[0].to.toFixed(2) : "-"} ث`);
}
process.exit(ok ? 0 : 1);
