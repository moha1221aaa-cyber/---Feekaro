/* الجواب الصوتي بأكثر من محرك (lib/grading.js hearAll): Azure ar-SA و ElevenLabs Scribe و Whisper بنفس اللحظة.
   Azure و ElevenLabs ردود وهمية (fetch)، و Whisper من AI وهمي */
import { setupAuth, check, done } from "./helpers.mjs";
import { taskVoice } from "../../lib/grading.js";

const auth = await setupAuth();
const seen = [];
let azure = null, eleven = null;
auth.routes.push({ match: u => u.includes("stt.speech.microsoft.com"), handle: async (u, init) => { seen.push({ eng: "azure", u, h: init.headers }); return azure(); } });
auth.routes.push({ match: u => u.includes("api.elevenlabs.io/v1/speech-to-text"), handle: async (u, init) => { seen.push({ eng: "eleven", model: init.body.get("model_id"), lang: init.body.get("language_code") }); return eleven(); } });
const J = o => new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json" } });
const az = (...texts) => () => J({ RecognitionStatus: "Success", DisplayText: texts[0], NBest: texts.map(t => ({ Confidence: 0.8, Lexical: t, ITN: t, MaskedITN: t, Display: t })) });
const mkEnv = (whisper, extra) => {
    const llm = [];
    return { llm, env: Object.assign({ AZURE_TTS_KEY: "k", AZURE_TTS_REGION: "uaenorth", ELEVEN_KEY: "e", AI: { run: async (m, i) => {
        if (m.includes("whisper")) { if (whisper instanceof Error) throw whisper; return { text: whisper }; }
        llm.push(m); return { response: '{"ok":false,"said":""}' };
    } } }, extra || {}) };
};
const audio = Buffer.alloc(4000, 1).toString("base64");
const go = (env, q, answer) => taskVoice(env, { q, answer, audio });

{
    /* Whisper سمع غلط ("أمقارون")، و Azure سمع صح في الاحتمال الثاني */
    azure = az("انقرا ها", "أنقرة"); eleven = () => J({ text: "انكره" });
    const k = mkEnv("أمقارون");
    const r = await go(k.env, "ما عاصمة تركيا؟", "أنقرة|انقره");
    check("Azure n-best rescues a Whisper mishearing (fast, no LLM)", r.ok === true && r.t.path === "fast" && k.llm.length === 0 && r.said === "أنقرة", r);
    check("Azure called with ar-SA and 16k wav", seen.some(x => x.eng === "azure" && /language=ar-SA/.test(x.u) && /16000/.test(x.h["Content-Type"])));
    check("ElevenLabs called with scribe_v2 + ar", seen.some(x => x.eng === "eleven" && x.model === "scribe_v2" && x.lang === "ar"));
}
{
    /* كل المحركات سمعت جواب غلط: ما ينقبل، والنص من Azure (الأفضل بالسعودي) يروح للحكم */
    azure = az("جدة"); eleven = () => J({ text: "جده" });
    const k = mkEnv("جدة");
    const r = await go(k.env, "ما عاصمة السعودية؟", "الرياض");
    check("wrong answer on every engine → not ok, graded once from Azure text", r.ok === false && r.heard === "جدة" && r.t.by === "azure" && k.llm.length === 1, r);
}
{
    /* Azure و ElevenLabs فشلوا: Whisper لحاله زي قبل */
    azure = () => new Response("no", { status: 401 }); eleven = () => new Response("quota", { status: 429 });
    const k = mkEnv("الرياض");
    const r = await go(k.env, "ما عاصمة السعودية؟", "الرياض");
    check("other engines down → Whisper alone still works", r.ok === true && r.t.by === "whisper" && r.t.errs && r.t.errs.azure, r);
}
{
    /* Whisper طاح و Azure سمع: يكمل بدون خطأ */
    azure = az("الرياض"); eleven = () => new Response("x", { status: 500 });
    const k = mkEnv(new Error("stt down"));
    const r = await go(k.env, "ما عاصمة السعودية؟", "الرياض");
    check("Whisper down → Azure answer still accepted", r.ok === true && r.t.by === "azure", r);
}
{
    /* هلوسة من محرك ما تنحسب، وسكوت من الكل = ما سمع شي (الكتابة تطلع) */
    azure = () => J({ RecognitionStatus: "NoMatch" }); eleven = () => J({ text: "شكرا للمشاهدة" });
    const k = mkEnv("");
    const r = await go(k.env, "ما عاصمة السعودية؟", "الرياض");
    check("silence/hallucination on all engines → heard empty", r.ok === false && r.heard === "" && k.llm.length === 0, r);
}
{
    /* ELEVEN_STT=0 يوقف ElevenLabs */
    seen.length = 0; azure = az("الرياض"); eleven = () => J({ text: "الرياض" });
    const k = mkEnv("الرياض", { ELEVEN_STT: "0" });
    await go(k.env, "ما عاصمة السعودية؟", "الرياض");
    await new Promise(r => setTimeout(r, 50));
    check("ELEVEN_STT=0 skips ElevenLabs", !seen.some(x => x.eng === "eleven"));
}
auth.restore();
done();
