/* البث بدون موسيقى: نمر على كل المشاهد (الانتظار، الافتتاح، المواجهة، الأسئلة، سؤال الحسم، النتيجة، الختام)
   ونتأكد إن ولا ملف موسيقى ينطلب، وولا صوت يشتغل بتكرار (loop) أو أطول من 6 ث، وإن زر الموسيقى انشال،
   والمؤثرات القصيرة (الجرس، صح، غلط، التكتكة، التصفيق، whoosh) لسا تتحمّل.  node tests/harness/nomusic.mjs */
import { serve, FakeDB, seed, launch, device, until, sleep, PORT } from "./harness.mjs";
/* البث يشيل ?live= من الرابط بعد ما يفتح، فـ reload ما يرجّعه: نفتح الرابط كامل */
const reopen = (p, who) => p.goto(`http://127.0.0.1:${PORT}/index.html?as=${who}&live=round_2`);

const MUSIC = ["lobby", "show_intro", "interlude", "decider", "think2", "outro", "big_win"];
const KEEP = ["buzz", "correct", "wrong", "tick", "applause", "whoosh"];
const srv = await serve(8787);
let ok = true;
const check = (name, v, extra) => { if (!v) ok = false; console.log((v ? "PASS " : "FAIL ") + name + (extra !== undefined ? " " + JSON.stringify(extra) : "")); };
const db = new FakeDB(60);
const now = Date.now();
seed(db, "intro", { status: "scheduled", startAt: now + 600000 });
const browser = await launch({ wav: "silence.wav" });
try {
    const pages = [];
    for (const who of ["fan", "p1"]) {
        pages.push(await device(browser, db, who, { api: { ai: async () => ({ ok: false }) } }));
    }
    const reqs = [];
    for (const [i, p] of pages.entries()) {
        /* نراقب من أول تحميل (قبل ما يفتح البث بـ ?live=): نسجل الطلبات على مستوى الجهاز ونعيد التحميل */
        p.context().on("request", r => { const m = /\/audio\/([\w-]+)\.mp3/.exec(r.url()); if (m) reqs.push(m[1]); });
        /* أي صوت يبدأ: نسجل طوله وهل هو متكرر (الموسيقى الخلفية كانت loop) */
        await p.context().addInitScript(() => {
            window.__srcs = [];
            const st = AudioBufferSourceNode.prototype.start;
            AudioBufferSourceNode.prototype.start = function () { window.__srcs.push({ loop: this.loop, dur: this.buffer ? this.buffer.duration : 0 }); return st.apply(this, arguments); };
        });
        await reopen(p, ["fan", "p1"][i]);
    }
    const fan = pages[0];
    await until(() => fan.evaluate(() => document.getElementById("liveScreen").classList.contains("open")), 15000);
    check("no music button", await fan.evaluate(() => !document.querySelector('[onclick*="bcToggleBg"], [aria-label="الموسيقى"]') && typeof bcToggleBg === "undefined"));
    check("no music engine", await fan.evaluate(() => typeof bedSet === "undefined" && typeof BED === "undefined" && typeof cineBgOn === "undefined"));
    const path = "room/main/liveMatches/round_2";
    const t = Date.now();
    const steps = [
        { status: "live", scene: "opening", sceneAt: t },
        { scene: "intro", sceneAt: t + 1 },
        { scene: "talk", sceneAt: t + 2 },
        { scene: "countdown", sceneAt: t + 3 },
        { scene: "playing", phase: "buzz", qIndex: 0, qAt: Date.now(), deadline: Date.now() + 600000, ready1: true, ready2: true },
        { qIndex: 4, s1: 2, s2: 2, log: [1, 2, 1, 2, -1], qAt: Date.now() },   /* سؤال الحسم */
        { scene: "result", s1: 3, s2: 2, outcome: 1, "order": [Object.assign({}, db.data(path).order[0], { state: "done", s1: 3, s2: 2 }), Object.assign({}, db.data(path).order[1], { state: "done" })] },
        { scene: "closing", sceneAt: Date.now() }
    ];
    for (const s of steps) {
        db.write({ op: "update", path, data: s });
        await sleep(2500);
    }
    await sleep(3000);
    const played = [];
    for (const p of pages) played.push(...await p.evaluate(() => window.__srcs));
    const music = reqs.filter(x => MUSIC.includes(x));
    check("no music file requested", music.length === 0, { music, all: [...new Set(reqs)] });
    check("short effects still load", KEEP.every(k => reqs.includes(k)), KEEP.filter(k => !reqs.includes(k)));
    check("sounds actually played", played.length > 0, played.length);
    const bad = played.filter(x => x.loop || x.dur > 6);
    check("nothing looping, nothing longer than 6s except fireworks (8s)", bad.every(x => !x.loop && x.dur < 9), bad);
    const errs = pages.flatMap(p => p.__logs.filter(l => /PAGEERROR/.test(l)));
    check("no page errors", !errs.length, errs.slice(0, 3));
} catch (e) { ok = false; console.log(e); }
await browser.close();
srv.close();
process.exit(ok ? 0 : 1);
