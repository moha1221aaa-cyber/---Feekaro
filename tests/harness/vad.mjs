/* يجرب كاشف الكلام (vaVadCreate في js/broadcast/va-worklet.js) بدون متصفح على:
   - ملفات المايك الوهمي الخام (audio/*.wav من gen.py): الكلام 1.15 ث كل 4 ث
   - نفس الملفات بعد معالجة مايك Chromium (audio/captured من capture.mjs) لو موجودة، وهذي الأقرب للجوال
   المعيار: كل دورة كلام تنلقط (نسمح بدورة وحدة عند الحواف)، وبدايتها خلال 0.4 ث، ونهايتها خلال 1.2 ث بعد الكلام،
   وما فيه أي مقطع في السكوت. الموسيقى بروحها بعد رفع الصوت التلقائي: مقطع واحد مسموح (معروف، والسيرفر يحمي)
   node tests/harness/vad.mjs */
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
        if (id === "data") { const n = Math.floor(Math.min(sz, b.length - o - 8) / 2); data = new Float32Array(n); for (let i = 0; i < n; i++) data[i] = b.readInt16LE(o + 8 + i * 2) / 32768; break; }
        o += 8 + sz;
    }
    return { rate, data };
}
/* وين يبدأ الكلام في التسجيل (التسجيل من المتصفح يبدأ من نقطة عشوائية في الملف) */
function offsetOf(x, rate) {
    const F = Math.round(rate / 100), fr = Math.floor(x.length / F), E = new Float32Array(fr);
    for (let i = 0; i < fr; i++) { let s = 0; for (let j = i * F; j < (i + 1) * F; j++) s += x[j] * x[j]; E[i] = Math.sqrt(s / F); }
    let best = -1e9, off = 0;
    for (let o = 0; o < 400; o++) { let sc = 0; for (let i = 0; i < fr; i++) { const t = ((i / 100 - o / 100) % 4 + 4) % 4; sc += (t < 1.15 ? 1 : -0.35) * E[i]; } if (sc > best) { best = sc; off = o / 100; } }
    return off;
}

const NAMES = { speech: true, speech_music: true, silence: false, music_only: false, phone: true, phone_quiet: true, phone_music: true, phone_music_only: false };
const runs = [];
for (const [n, sp] of Object.entries(NAMES)) {
    runs.push({ f: path.join(HERE, "audio", n + ".wav"), name: n, sp, cap: false });
    const c = path.join(HERE, "audio", "captured", n + ".wav");
    if (fs.existsSync(c)) runs.push({ f: c, name: "captured/" + n, sp, cap: true });
}
let ok = true;
for (const r of runs) {
    if (!fs.existsSync(r.f)) { console.log("SKIP " + r.name + " (شغّل gen.py أو capture.mjs)"); continue; }
    const { rate, data } = readWav(r.f);
    const off = r.sp && r.cap ? offsetOf(data, rate) : 0;
    const v = ctx.vaVadCreate(rate);
    const segs = []; let cur = null;
    for (let i = 0; i + v.N <= data.length; i += v.N) {
        const t = v.frame(data.subarray(i, i + v.N)), at = i / rate;
        if (t && !cur) cur = { from: at };
        if (!t && cur) { cur.to = at; segs.push(cur); cur = null; }
    }
    const cycles = new Set(); let fa = 0, longTail = 0;
    for (const s of segs) {
        if (r.cap && s.from < 1.5) continue;   /* أول 1.5 ث من التسجيل المعالج: الأرضية تتعلم */
        if (!r.sp) { fa++; continue; }
        const rel = ((s.from - off) % 4 + 4) % 4;
        if (rel <= 0.4 || rel >= 3.9) { cycles.add(Math.round((s.from - rel) / 4)); if (s.to - (s.from - rel) > 1.15 + 1.2) longTail++; } else fa++;
    }
    const total = r.sp ? Math.floor((data.length / rate - (r.cap ? 1.5 : 0) - off) / 4) : 0;
    const missed = r.sp ? Math.max(0, total - 1 - cycles.size) : 0;
    const allowFa = (!r.sp && r.cap && /music/.test(r.name)) ? 1 : 0;
    const pass = missed === 0 && fa <= allowFa && longTail === 0;
    if (!pass) ok = false;
    console.log(`${pass ? "PASS" : "FAIL"} ${r.name}: كلام ${cycles.size}${r.sp ? "/" + total : ""}، ناقص ${missed}، غلط ${fa}، نهاية متأخرة ${longTail}`);
}
process.exit(ok ? 0 : 1);
