/* طبقة الإخراج الثانية (js/broadcast/show.js): جهازين، واحد التحديثات توصله متأخرة 0.9 ث
   - السؤال كلمة كلمة بسرعة كلام المذيع (مو كامل بثانية): نفس عدد الكلمات ظاهر على الجهازين بنفس اللحظة
   - أول ما أحد يضغط الجرس السؤال يختفي، ويرجع كامل وقت الكشف
   - شريط الموقف (سلسلة) وقت الكشف بنفس الإطار على الجهازين (الفرق أقل من 150ms)
   - شريط السؤال الذهبي، والإضاءة (توتر وقت الجواب، احتفال بعد الجواب الصح)، والنقاط تتدحرج، وإحصائيات الشريط
   - جهاز متأخر أكثر من 1.5 ث ما يطلع له شريط خلص وقته
   node tests/harness/show.mjs [مجلد] */
import { serve, FakeDB, seed, launch, device, until, sleep, liveDoc } from "./harness.mjs";
import fs from "node:fs";

const out = process.argv[2] || "/tmp/harness-show";
fs.mkdirSync(out, { recursive: true });
const srv = await serve(8787);
let ok = true;
const check = (name, v, extra) => { if (!v) ok = false; console.log((v ? "PASS " : "FAIL ") + name + (extra !== undefined ? " " + JSON.stringify(extra) : "")); };
const P = "room/main/liveMatches/round_2";
const upd = (db, data) => { const d = liveDoc(db); db.write({ op: "update", path: P, data: Object.assign({ v: (d.v || 0) + 1 }, data) }); };
/* كم كلمة ظاهرة (شفافيتها فوق النص) */
const words = p => p.evaluate(() => [...document.querySelectorAll(".lv-qtext .tv-w")].filter(w => +getComputedStyle(w).opacity > 0.5).length);
/* وين وصلت حركة الشريط (ms من بدايته) */
const bandPos = p => p.evaluate(() => { const b = document.querySelector(".tv-band .tv-bd-in"); const a = b && b.getAnimations()[0]; return a ? Math.round(Number(a.currentTime)) : null; });

for (const mode of ["full", "reduced"]) {
    const dir = out + "/" + mode; fs.mkdirSync(dir, { recursive: true });
    const db = new FakeDB(40);
    const now = Date.now();
    seed(db, "playing", { phase: "buzz", qIndex: 0, qAt: now - 9000, deadline: now + 60000, ready1: true, ready2: true, outcome: 0, log: [-1, -1, -1, -1, -1] });
    { const d = liveDoc(db); d.questions[1] = Object.assign({}, d.questions[1], { text: "ما اسم أطول نهر في قارة أفريقيا ويمر في عدة دول عربية منها مصر والسودان؟" }); }
    const browser = await launch({ wav: "silence.wav" });
    const opts = { api: { ai: async () => ({ ok: false }) }, reducedMotion: mode === "reduced" ? "reduce" : "no-preference" };
    const fan = await device(browser, db, "fan", opts);
    const late = await device(browser, db, "fan", opts);
    late.__extraLat = 900;
    try {
        await until(() => fan.$(".st-qcard"), 15000);
        await sleep(1500);
        /* 1) سؤال جديد: الكلمات */
        const q1 = Date.now() + 100;
        upd(db, { phase: "buzz", qIndex: 1, qAt: q1, deadline: q1 + 15000, outcome: 0, lastAnswer: null });
        await until(() => late.evaluate(() => liveMatchesCache[openLiveId].qIndex === 1), 4000);
        const total = await fan.evaluate(() => document.querySelectorAll(".lv-qtext .tv-w").length);
        if (mode === "full") {
            await sleep(Math.max(0, q1 + 1300 - Date.now()));
            check("no words before the presenter reaches the question text", (await words(fan)) === 0);
            await sleep(Math.max(0, q1 + 3200 - Date.now()));
            const [wa, wb] = await Promise.all([words(fan), words(late)]);
            check("question words appear at speaking pace (part of it after 3.2 s)", wa > 0 && wa < total * 0.6, { wa, total });
            check("late device shows the same words at the same moment (±1)", Math.abs(wa - wb) <= 1, { fan: wa, late: wb });
            await fan.screenshot({ path: dir + "/1-question-words.png" });
        }
        check("all words visible once the presenter finishes", await until(async () => (await words(fan)) === total && (await words(late)) === total, 9000));
        /* 2) الجرس: إضاءة توتر، والسؤال يختفي */
        upd(db, { phase: "answer", buzzer: 1, answerer: 1, tried1: true, deadline: Date.now() + 15000 });
        check("light: tense while answering", await until(() => fan.evaluate(() => document.getElementById("tvLight").dataset.mood === "tense"), 3000));
        check("question hidden after the buzzer", await until(() => fan.evaluate(() => !document.querySelector(".lv-qtext .tv-w") && !!document.querySelector(".lv-qtext.lv-qhidden")), 3000));
        /* 3) الكشف: سعد جاوب صح للمرة الثالثة (سلسلة) */
        const r = Date.now() + 100;
        upd(db, { phase: "reveal", outcome: 1, s1: 3, s2: 0, log: [1, 1, 1, -1, -1], qIndex: 2, deadline: r + 6500, lastAnswer: { by: 1, text: "طوكيو", correct: true } });
        check("streak band on time", await until(() => fan.$(".tv-band.situ.streak"), 5000));
        check("question shown complete again at the reveal", await until(async () => (await fan.evaluate(() => document.querySelectorAll(".lv-qtext .tv-w").length)) > 0 && (await words(fan)) === (await fan.evaluate(() => document.querySelectorAll(".lv-qtext .tv-w").length)), 3000));
        check("streak band on the late device too", await until(() => late.$(".tv-band.situ.streak"), 3000));
        const [ba, bb] = await Promise.all([bandPos(fan), bandPos(late)]);
        if (mode === "full") check("band in the same frame on both (< 150ms apart)", ba != null && bb != null && Math.abs(ba - bb) < 150, { fan: ba, late: bb });
        await sleep(250);
        await fan.screenshot({ path: dir + "/2-streak-band.png" });
        check("light: party after a correct answer", await until(() => fan.evaluate(() => document.getElementById("tvLight").dataset.mood === "party"), 3000));
        check("podium score rolls", await fan.evaluate(() => !!document.querySelector(".st-desk .tv-roll")));
        await sleep(600);
        await fan.screenshot({ path: dir + "/3-party-light.png" });
        /* 4) السؤال الذهبي */
        await sleep(2500);
        const d0 = liveDoc(db), g = Date.now() + 100;
        const qs = (d0.questions || []).slice(0, 5).concat([Object.assign({}, d0.questions[0], { text: "سؤال ذهبي: ما عاصمة اليابان؟" })]);
        upd(db, { phase: "buzz", qIndex: 5, golden: 1, questions: qs, qAt: g, deadline: g + 15000, outcome: 0, s1: 2, s2: 2, log: [1, 2, 1, 2, 0] });
        check("golden band", await until(() => fan.$(".tv-band.gold"), 4000));
        await sleep(300);
        await fan.screenshot({ path: dir + "/4-golden-band.png" });
        /* 5) الشريط فيه إحصائيات المواجهة */
        const tk = await fan.evaluate(() => (document.getElementById("stTicker") || {}).innerText || "");
        check("ticker has live stats (correct answers)", /الإجابات الصحيحة/.test(tk), tk.slice(0, 120));
        /* 6) جهاز متأخر 2 ث: الشريط اللي خلص ما يطلع له */
        late.__extraLat = 2000;
        const r2 = Date.now() + 100;
        upd(db, { phase: "reveal", outcome: 2, s2: 3, log: [1, 2, 1, 2, 2], deadline: r2 + 6500, lastAnswer: { by: 2, text: "طوكيو", correct: true } });
        await until(() => fan.$(".tv-band.situ"), 4000);
        await sleep(2600);
        check("very late device skips a finished band", !(await late.$(".tv-band.situ")));
        const errs = [fan, late].flatMap(p => p.__logs.filter(l => /PAGEERROR/.test(l)));
        check("no page errors", !errs.length, errs.slice(0, 3));
    } catch (e) { ok = false; console.log(e.stack || e); }
    await browser.close();
}
srv.close();
process.exit(ok ? 0 : 1);
