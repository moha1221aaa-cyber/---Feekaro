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
        /* بنك تجريبي 12 سؤال (الاحتياطي صار سؤال واحد بعد مراجعة محمد 24 أكتوبر) */
        roomState.qbank = Array.from({ length: 12 }, (_, i) => ({ text: "سؤال البنك رقم " + (i + 1) + "؟", answer: "ج" + (i + 1) }));
        bcQHist = ["ما عاصمة اليابان؟"].concat(roomState.qbank.slice(0, -7).map(q => q.text), LIVE_FALLBACK_QUESTIONS.map(q => q.text));
        bcFreshPool = [];
        const left = roomState.qbank.slice(-7).map(q => q.text);
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
        bcQHist = roomState.qbank.concat(LIVE_FALLBACK_QUESTIONS).map(q => q.text); bcFreshPool = [];
        return pickLiveQuestions([]).map(q => q.text);
    });
    check("everything asked before: still 5 questions", all.length === 5, all);
    const oldest = await host.evaluate(() => { const first5 = roomState.qbank.slice(0, 5).map(q => q.text); return pickLiveQuestions([]).every(q => first5.includes(q.text)); });
    check("…and they are exactly the 5 oldest", oldest);
    /* الـ500 الصعبة: تنحمّل، ما فيها تكرار ولا شي انسأل قبل، وتجي قبل أسئلة الذكاء الاصطناعي */
    const hard = await host.evaluate(async () => {
        const all = await bcLoadHard();
        const keys = all.map(q => bcQKey(q.text));
        bcQHist = []; bcFreshPool = [{ text: "سؤال من الذكاء؟", answer: "ذكاء" }];
        const p = pickLiveQuestions([]);
        const fb = new Set(LIVE_FALLBACK_QUESTIONS.map(q => bcQKey(q.text)));
        bcQHist = all.slice(0, all.length - 2).map(q => q.text);
        const p2 = pickLiveQuestions([]).map(q => q.text);
        return { n: all.length, uniq: new Set(keys).size, inFb: keys.filter(k => fb.has(k)).length, first: p.every(q => keys.includes(bcQKey(q.text))), p2, last2: all.slice(all.length - 2).map(q => q.text) };
    });
    check("hard questions loaded (184 after Mohammed's review), all unique, none from the fallback list", hard.n === 184 && hard.uniq === 184 && hard.inFb === 0, { n: hard.n, uniq: hard.uniq, inFb: hard.inFb });
    check("hard questions come first", hard.first);
    check("asked hard questions are not repeated (2 left → those 2 then others)", hard.last2.every(t => hard.p2.includes(t)), hard.p2);
    /* كل شي انسأل والبنك فاضي والاحتياطي سؤال واحد: لازم 5 أسئلة برضو (من الأقدم في الصعبة) */
    const short = await host.evaluate(() => { roomState.qbank = []; bcFreshPool = []; bcQHist = BC_HARD.concat(LIVE_FALLBACK_QUESTIONS).map(q => q.text); return pickLiveQuestions([]).length; });
    check("never fewer than 5 questions per match", short === 5, short);
    const errs = host.__logs.filter(l => /PAGEERROR/.test(l));
    check("no page errors", !errs.length, errs.slice(0, 3));
} catch (e) { ok = false; console.log(e.stack || e); }
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
