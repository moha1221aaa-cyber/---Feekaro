/* أسئلة جديدة لكل بث (23 أكتوبر 2026، "الأسئلة صارت معروفة وتتكرر"):
   - pickLiveQuestions ياخذ الجديدة (الذكاء الاصطناعي) أول، وبعدها اللي ما انسأل، وآخر شي الأقدم في السجل
   - bcFreshQuestions يشيل أي سؤال انسأل قبل (ولو بصياغة فيها تشكيل) والأجوبة المكررة
   - السجل ينحفظ في liveDiag/_qhistory ويرجع ينقرا
   node tests/harness/questions.mjs */
import { serve, FakeDB, seed, launch, device, until, sleep } from "./harness.mjs";
const srv = await serve();
let ok = true;
const check = (name, v, extra) => { if (!v) ok = false; console.log((v ? "PASS " : "FAIL ") + name + (extra !== undefined ? " " + JSON.stringify(extra) : "")); };
const db = new FakeDB(30);
seed(db, "result", { sceneAt: Date.now() - 60000 });
db.docs.set("room/main", { ver: 1, data: { qbank: [], mics: {}, chat: [] } });
const browser = await launch({ wav: "silence.wav" });
const asked = [];
const api = { ai: async b => {
    if (b.task !== "questions") return { ok: false };
    asked.push(b);
    return { questions: [
        { text: "ما عاصمة اليابان؟", answer: "طوكيو" },                 /* انسأل قبل */
        { text: "ما عاصِمة اليابان؟", answer: "طوكيو" },                /* نفسه بتشكيل */
        { text: "ما أطول جبل في " + b.category + "؟", answer: "جبل " + b.category },
        { text: "سؤال جديد " + b.category + " 1؟", answer: "ج1 " + b.category },
        { text: "سؤال جديد " + b.category + " 2؟", answer: "ج2 " + b.category }
    ] };
} };
try {
    const host = await device(browser, db, "host", { api });
    await until(() => host.$(".lv-stage"), 15000); await sleep(1000);
    const r = await host.evaluate(async () => {
        bcQHist = ["ما عاصمة اليابان؟"].concat(LIVE_FALLBACK_QUESTIONS.slice(0, -7).map(q => q.text));
        bcFreshPool = [];
        const left = LIVE_FALLBACK_QUESTIONS.slice(-7).map(q => q.text);
        const p1 = pickLiveQuestions([]);
        const fresh = await bcFreshQuestions(10);
        bcFreshPool = fresh;
        const p2 = pickLiveQuestions([]);
        bcSaveQHistory(p2.map(q => q.text));
        return { left, p1: p1.map(q => q.text), fresh: fresh.map(q => q.text), p2: p2.map(q => q.text), hist: bcQHist.length };
    });
    check("no AI: picks only questions never asked before", r.p1.length === 5 && r.p1.every(t => r.left.includes(t)), r.p1);
    check("AI questions: already-asked ones (even with tashkeel) are dropped", r.fresh.length > 0 && !r.fresh.some(t => /اليابان/.test(t)), r.fresh);
    check("3 categories asked in parallel for 10 questions (rate limit is 4/min)", asked.length === 2 || asked.length === 3, asked.map(a => a.category));
    check("avoid list sent to the generator", asked.every(a => Array.isArray(a.avoid) && a.avoid.includes("ما عاصمة اليابان؟")));
    check("fresh AI questions come first", r.p2.every(t => r.fresh.includes(t)), r.p2);
    await sleep(500);
    const saved = (db.data("room/main/liveDiag/_qhistory") || {}).texts || [];
    check("history saved in liveDiag/_qhistory", r.p2.every(t => saved.includes(t)) && saved.length === r.hist, saved.length);
    const all = await host.evaluate(() => {
        bcQHist = LIVE_FALLBACK_QUESTIONS.map(q => q.text); bcFreshPool = [];
        return pickLiveQuestions([]).map(q => q.text);
    });
    check("everything asked before: still 5 questions", all.length === 5, all);
    const oldest = await host.evaluate(() => { const first5 = LIVE_FALLBACK_QUESTIONS.slice(0, 5).map(q => q.text); return pickLiveQuestions([]).every(q => first5.includes(q.text)); });
    check("…and they are exactly the 5 oldest", oldest);
    const errs = host.__logs.filter(l => /PAGEERROR/.test(l));
    check("no page errors", !errs.length, errs.slice(0, 3));
} catch (e) { ok = false; console.log(e.stack || e); }
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
