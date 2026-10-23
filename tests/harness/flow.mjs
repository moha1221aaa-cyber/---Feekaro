/* طلبات محمد 23 أكتوبر 2026:
   - السؤال كلمة كلمة مع صوت المذيع (مدة ملف /tts الحقيقية، مو تقدير ثابت)
   - السؤال يختفي أول ما أحد يضغط الجرس (عند اللي ضغط على طول قبل رد السيرفر)
   - شارة البداية (الشعار واسم الدوري ونغمة ident) بين "جاهز" والترحيب، وبعدها لقطة الترحيب
   - ولا انتقال لحاله: البث المجدول ما يبدأ لما يخلص العداد، والمنظم الغايب ما يخلّي المشاهد تمشي
   - الجوال (لمس) يشتغل عليه وضع التبريد (bc-lite) لحاله
   node tests/harness/flow.mjs [مجلد] */
import { serve, FakeDB, seed, launch, device, until, sleep, liveDoc } from "./harness.mjs";
import fs from "node:fs";

const out = process.argv[2] || "/tmp/harness-flow";
fs.mkdirSync(out, { recursive: true });
const srv = await serve(8787);
let ok = true;
const check = (name, v, extra) => { if (!v) ok = false; console.log((v ? "PASS " : "FAIL ") + name + (extra !== undefined ? " " + JSON.stringify(extra) : "")); };
const P = "room/main/liveMatches/round_2";
const upd = (db, data) => { const d = liveDoc(db); db.write({ op: "update", path: P, data: Object.assign({ v: (d.v || 0) + 1 }, data) }); };
const words = p => p.evaluate(() => [...document.querySelectorAll(".lv-qtext .tv-w")].filter(w => +getComputedStyle(w).opacity > 0.5).length);
/* ملف صوت صامت بمدة معروفة (المذيع "يتكلم" 10 ث) */
function wav(sec) {
    const rate = 16000, n = rate * sec, b = Buffer.alloc(44 + n * 2);
    b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
    b.write("data", 36); b.writeUInt32LE(n * 2, 40);
    return b;
}
const TTS_SEC = 10;
const api = { ai: async () => ({ ok: false }), tts: async () => ({ raw: { status: 200, contentType: "audio/wav", body: wav(TTS_SEC) } }) };
const browser = await launch({ wav: "silence.wav" });
try {
    /* ===== 1) الكلمات مع الصوت + الجرس يخفي السؤال ===== */
    {
        const db = new FakeDB(40);
        const now = Date.now();
        seed(db, "playing", { phase: "reveal", qIndex: 0, qAt: now - 20000, deadline: now + 60000, ready1: true, ready2: true, outcome: 0, log: [0, -1, -1, -1, -1] });
        liveDoc(db).questions[1] = { text: "ما اسم أطول نهر في قارة أفريقيا ويمر في مصر والسودان؟", answer: "النيل" };
        const fan = await device(browser, db, "fan", { api });
        const p1 = await device(browser, db, "p1", { api });
        await until(() => fan.$(".st-qcard"), 15000);
        await until(() => p1.$(".st-qcard"), 15000);
        check("phone gets the cool (lite) mode by itself", await fan.evaluate(() => bcLite === true && document.getElementById("liveScreen").classList.contains("bc-lite")));
        await sleep(1500);
        const q1 = Date.now() + 100;
        upd(db, { phase: "buzz", qIndex: 1, qAt: q1, deadline: q1 + 15000, outcome: 0, lastAnswer: null });
        await until(() => fan.$('.st-qcard[data-q="0-1"] .lv-qtext .tv-w'), 4000);
        const total = await fan.evaluate(() => document.querySelectorAll(".lv-qtext .tv-w").length);
        const src = await until(() => fan.evaluate(() => (SHOW.qt[showQKey(liveMatchesCache[openLiveId])] || {}).src === "voice" && "voice"), 5000);
        check("word times follow the presenter audio once it plays", src === "voice");
        await sleep(Math.max(0, q1 + 5500 - Date.now()));
        const mid = await words(fan);
        /* التقدير الثابت كان يخلّص هالسؤال قبل 5.5 ث، والصوت مدته 10 ث: لازم نكون بالنص */
        check("at 5.5 s of a 10 s reading only part of the question is out", mid > 0 && mid < total, { mid, total });
        await fan.screenshot({ path: out + "/1-words-with-voice.png" });
        check("whole question out by the end of the reading", await until(async () => (await words(fan)) === total, 7000));
        /* الجرس: عند اللي ضغط يختفي على طول */
        await p1.evaluate(() => { const qt = document.querySelector(".lv-qtext.tv-words"); liveBuzz(); window.__hid = qt && getComputedStyle(qt).visibility === "hidden"; });
        check("question hidden instantly on the presser's phone", await p1.evaluate(() => window.__hid === true));
        check("question hidden for viewers once the buzz lands", await until(() => fan.evaluate(() => !!document.querySelector(".lv-qtext.lv-qhidden") && !document.querySelector(".lv-qtext .tv-w")), 4000));
        await fan.screenshot({ path: out + "/2-hidden-after-buzz.png" });
        const errs = [fan, p1].flatMap(p => p.__logs.filter(l => /PAGEERROR/.test(l)));
        check("no page errors (words/buzz)", !errs.length, errs.slice(0, 3));
        await fan.context().close(); await p1.context().close();
    }
    /* ===== 1ب) الترتيب على شاشة قصيرة (صور محمد 23 أكتوبر: لوحة السؤال انضغطت، شريط الاسم غطى مربع الجواب، الصفحة كبرت) ===== */
    {
        const db = new FakeDB(40);
        const now = Date.now();
        seed(db, "playing", { phase: "buzz", qIndex: 0, qAt: now - 20000, deadline: now + 60000, ready1: true, ready2: true });
        liveDoc(db).questions[0] = { text: "ما اسم أطول نهر في قارة أفريقيا ويمر في عدة دول عربية منها مصر والسودان؟", answer: "النيل" };
        const vp = { width: 412, height: 640 };
        const p1 = await device(browser, db, "p1", { api, viewport: vp });
        const host = await device(browser, db, "host", { api, viewport: vp });
        await until(() => p1.$(".st-qcard .tv-w"), 15000); await sleep(1500);
        const card = p => p.evaluate(() => { const q = document.querySelector(".st-qcard"); return q ? Math.round(q.getBoundingClientRect().height) >= q.scrollHeight - 1 : false; });
        check("short screen: question card not squeezed (buzz)", await card(p1) && await card(host));
        check("no zoom inside the broadcast (touch-action pan-y)", await p1.evaluate(() => getComputedStyle(document.getElementById("liveScreen")).touchAction === "pan-y"));
        upd(db, { phase: "answer", buzzer: 1, answerer: 1, tried1: true, deadline: Date.now() + 15000 });
        await until(() => p1.$(".va-box"), 5000); await sleep(1200);
        check("short screen: question card not squeezed (answer)", await card(p1) && await card(host));
        check("no name strip over the answer box during questions", await p1.evaluate(() => { const l = document.getElementById("stL3"); return !l || !l.classList.contains("on"); }));
        await p1.screenshot({ path: out + "/1b-short-answer.png" });
        await p1.context().close(); await host.context().close();
    }
    /* ===== 2) شارة البداية ===== */
    {
        const db = new FakeDB(40);
        seed(db, "intro", { ready1: true, sceneAt: Date.now() - 5000 });
        const fan = await device(browser, db, "fan", { api });
        const reqs = [];
        fan.on("request", r => { if (/audio\/ident\.mp3/.test(r.url())) reqs.push(r.url()); });
        await until(() => fan.$(".bc-vs"), 15000);
        await sleep(1200);
        check("ident jingle preloaded on the ready page", await until(() => fan.evaluate(() => !!CINE_BUF.ident), 5000));
        upd(db, { ready2: true, scene: "talk", sceneAt: Date.now() });
        check("ident sting shows when both are ready", await until(() => fan.$(".cine.ident"), 3000));
        await sleep(1600);
        check("sting has the logo and the league name", await fan.evaluate(() => { const el = document.querySelector(".cine.ident"); return !!el && !!el.querySelector(".cine-logo.on") && /دوري بنو مسروح/.test(el.textContent); }));
        await fan.screenshot({ path: out + "/3-ident.png" });
        check("welcome transition after the sting", await until(() => fan.$(".st-trans.talk"), 6000));
        check("sting gone after it ends", await until(async () => !(await fan.$(".cine.ident")), 1500));
        await fan.context().close();
    }
    /* ===== 3) ولا شي ينتقل لحاله ===== */
    {
        const db = new FakeDB(40);
        seed(db, "intro", { status: "scheduled", startAt: Date.now() + 1500 });
        const fan = await device(browser, db, "fan", { api });
        await until(() => fan.$("#bcClock"), 15000);
        await sleep(6000);
        check("scheduled broadcast does not start by itself at zero", liveDoc(db).status === "scheduled", liveDoc(db).status);
        check("waiting page says the organizer starts it", /المنظم/.test(await fan.evaluate(() => (document.getElementById("bcWaitNote") || {}).textContent || "")));
        await fan.context().close();
    }
    for (const scene of ["opening", "intro", "talk", "result"]) {
        const db = new FakeDB(40);
        const old = Date.now() - 10 * 60000;
        seed(db, scene, { sceneAt: old, hostSeen: old, ready1: scene !== "intro", ready2: scene !== "intro" });
        if (scene === "result") liveDoc(db).order[0].state = "done";
        const p1 = await device(browser, db, "p1", { api });
        await until(() => p1.$(".lv-stage"), 15000);
        await sleep(7000);
        const d = liveDoc(db);
        check(`host away: "${scene}" stays until the organizer presses`, d.scene === scene && d.cur === 0, { scene: d.scene, cur: d.cur });
        await p1.context().close();
    }
} catch (e) { ok = false; console.log(e.stack || e); }
await browser.close();
srv.close();
process.exit(ok ? 0 : 1);
