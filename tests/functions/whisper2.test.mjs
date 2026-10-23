/* تحسين السمع على Whisper بدون Azure (23 أكتوبر 2026):
   - trimSpeechWav: يقص التسجيل على الكلام ويرفع الصوت (ملف كلام حقيقي من tests/harness/audio)، والسكوت ما يطلع منه شي
   - السماع الثاني (whisper2، beam 8 على المقطع المقصوص) ينقذ لو الأول غلط
   - الأرقام بالكلام: أمسا = 5، وسبعا ما تنحسب 9، والأرقام المتقاربة (اثنين/ستين) ما تتلخبط
   - الحكم يوصله السماع الثاني كنص بس */
import fs from "node:fs";
import { check, done } from "./helpers.mjs";
import { trimSpeechWav, taskVoice, numberMatch, NUMW } from "../../lib/grading.js";

const wavB64 = fs.readFileSync(new URL("../harness/audio/speech_clip.wav", import.meta.url)).toString("base64");
const silence = (() => { const n = 16000 * 3, b = Buffer.alloc(44 + n * 2); b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40); return b.toString("base64"); })();

{
    const t = trimSpeechWav(wavB64);
    check("trim: speech clip gives a smaller WAV", !!t && t.length < wavB64.length && Buffer.from(t, "base64").toString("latin1", 0, 4) === "RIFF", t && [t.length, wavB64.length]);
    check("trim: pure silence gives nothing", trimSpeechWav(silence) === null);
    check("trim: not a WAV gives nothing", trimSpeechWav(Buffer.alloc(4000, 1).toString("base64")) === null);
}
{
    /* الأول سمع غلط، والثاني (المقصوص، beam 8) سمع صح */
    const calls = [];
    const env = { AI: { run: async (m, i) => { calls.push({ m, i }); if (m.includes("whisper")) return { text: i.beam_size === 8 ? "انقرة" : "أمقارو نسي" }; return { response: '{"ok":false}' }; } } };
    const r = await taskVoice(env, { q: "ما عاصمة تركيا؟", answer: "أنقرة|انقره", audio: wavB64 });
    check("whisper2 (trimmed, beam 8) rescues a mishearing", r.ok === true && r.t.by === "whisper2" && calls.some(c => c.i && c.i.beam_size === 8), r);
}
{
    /* ما طابق ولا واحد: الحكم يوصله السماع الثاني */
    let user = "";
    const env = { STT_WHISPER1: "0", AI: { run: async (m, i) => { if (m.includes("whisper")) return { text: i.beam_size === 8 ? "يارو" : "غاريو" }; user = i.messages[i.messages.length - 1].content; return { response: '{"ok":false}' }; } } };
    const r = await taskVoice(env, { q: "ما الرمز الكيميائي للذهب؟", answer: "Au", audio: wavB64 });
    check("grader sees the second hearing as text", r.ok === false && /سماع ثاني/.test(user) && /يارو/.test(user), user);
}
{
    const ok = [["أمسا", "5"], ["خمسا", "5"], ["خمسة", "5"], ["ثلاثا", "3"], ["أربعا", "4"], ["سته", "6"], ["احد عشر", "11"]];
    const no = [["سبعا", "9"], ["تسعا", "7"], ["ستة", "7"], ["امسا", "4"], ["سنين", "60"]];
    check("numbers: near-miss spoken numbers accepted", ok.every(([h, a]) => numberMatch(h, a)), ok.filter(([h, a]) => !numberMatch(h, a)));
    check("numbers: other numbers refused", no.every(([h, a]) => !numberMatch(h, a)), no.filter(([h, a]) => numberMatch(h, a)));
    const keys = Object.keys(NUMW), col = [];
    for (const a of keys) for (const b of keys) if (a !== b) for (const w of NUMW[b].split("|")) if (numberMatch(w, a)) col.push(a + "<-" + w);
    check("numbers: no number word matches a different number", !col.length, col);
}
{
    /* الفلتر رمى الجواب (ثقة واطية، تجربة 23 أكتوبر): ينقبل بس لو طابق الجواب، وغير كذا ما يروح للحكم */
    const seg = (text, ns, lp) => ({ text, segments: [{ text, no_speech_prob: ns, avg_logprob: lp }] });
    let llm = 0;
    const mk = text => ({ STT_WHISPER1: "0", AI: { run: async (m, i) => { if (m.includes("whisper")) return seg(text, 0.95, -1.5); llm++; return { response: '{"ok":true}' }; } } });
    const r = await taskVoice(mk("المشتري"), { q: "ما أكبر كوكب في المجموعة الشمسية؟", answer: "المشتري", audio: wavB64 });
    check("low-confidence hearing that matches the answer is accepted (fast-weak)", r.ok === true && r.t.path === "fast-weak" && llm === 0, r);
    llm = 0;
    const w = await taskVoice(mk("زحل"), { q: "ما أكبر كوكب في المجموعة الشمسية؟", answer: "المشتري", audio: wavB64 });
    check("low-confidence hearing that does not match: empty, never graded", w.ok === false && w.heard === "" && llm === 0, { w, llm });
}
done();
