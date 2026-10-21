/* المذيع: جمل الموقف (سلسلة، رجوع، تعادل، تقدّم) وكم مرة ينطلب كل نص من /tts (= رصيد ElevenLabs)
   1) bcSituKind على حالات معروفة (بدون متصفح)
   2) 3 أجهزة: جهاز المنظم يجهّز جملة الجواب مسبقاً وجملة الموقف أول ما تصير، والأجهزة الثانية تطلب نفس النص (كاش)،
      وما فيه أي speechSynthesis.   node tests/harness/announcer.mjs [مجلد] */
import fs from "node:fs";
import vm from "node:vm";
import { serve, FakeDB, seed, launch, device, until, sleep, liveDoc, ROOT } from "./harness.mjs";

let ok = true;
const check = (name, v, extra) => { console.log((v ? "PASS " : "FAIL ") + name + (extra !== undefined ? " " + JSON.stringify(extra) : "")); if (!v) ok = false; };

/* ===== 1) الموقف ===== */
const ctx = { LIVE_Q_COUNT: 5, location: { search: "" }, players: [], matches: [], console };
ctx.bcCur = d => (d.order || [])[d.cur] || null;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(ROOT + "/js/broadcast/studio.js", "utf8"), ctx);
const base = { status: "live", scene: "playing", phase: "reveal", cur: 0, round: 3, order: [{ p1: "سعد", p2: "فهد" }], questions: [{}, {}, {}, {}, {}] };
const cases = [
    ["streak", { outcome: 1, qIndex: 2, s1: 3, s2: 0, log: [1, 1, 1, -1, -1] }],
    ["tie", { outcome: 2, qIndex: 1, s1: 1, s2: 1, log: [1, 2, -1, -1, -1] }],
    ["comeback", { outcome: 2, qIndex: 4, s1: 2, s2: 2, bh2: 2, log: [1, 1, 2, 2, 2] }],
    ["lead", { outcome: 1, qIndex: 0, s1: 1, s2: 0, log: [1, -1, -1, -1, -1] }],
    ["", { outcome: 1, qIndex: 3, s1: 3, s2: 1, log: [1, 2, 1, 1, -1] }],
    ["", { outcome: 0, qIndex: 3, s1: 1, s2: 1, log: [1, 2, 0, 0, -1] }]
];
for (const [want, x] of cases) {
    const d = Object.assign({}, base, x);
    check("situ " + (want || "none"), ctx.bcSituKind(d) === want, { got: ctx.bcSituKind(d), text: ctx.bcSituText(d) });
}
/* جمل نهاية المواجهة ما تتأثر (كانت بنفس أسماء المفاتيح) */
const res = Object.assign({}, base, { scene: "result", s1: 2, s2: 2, order: [{ p1: "سعد", p2: "فهد" }] });
check("result tie line intact", /نهاية المواجهة بالتعادل، 2 مقابل 2/.test(ctx.bcResultText(res)), ctx.bcResultText(res));
const cb = Object.assign({}, res, { s1: 2, s2: 3, bh2: 2 });
check("result comeback line intact", /عودة تاريخية! فهد/.test(ctx.bcResultText(cb)), ctx.bcResultText(cb));
const ai = Object.assign({}, base, cases[0][1], { aiLines: { situ: { streak: ["{p} نار ولعت!"] } } });
check("ai situ line used with name", ctx.bcSituText(ai) === "سعد نار ولعت!", ctx.bcSituText(ai));

/* ===== 2) الأجهزة والرصيد ===== */
const out = process.argv[2] || "/tmp/harness-announcer";
fs.mkdirSync(out, { recursive: true });
const wav = (() => {   /* 3 ث سكوت (WAV) بدل الصوت الحقيقي */
    const n = 48000, b = Buffer.alloc(44 + n * 2);
    b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
    b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40); return b;
})();
const tts = [];
const api = { tts: async (b, info) => { tts.push({ who: info.who, text: info.url.searchParams.get("t"), at: Date.now() }); return { raw: { status: 200, contentType: "audio/wav", body: wav } }; } };
const srv = await serve(8787);
const db = new FakeDB(40);
seed(db, "intro");
const browser = await launch({ wav: "silence.wav" });
const spy = () => {
    window.__synth = 0; try { if (window.speechSynthesis) { speechSynthesis.speak = () => { window.__synth++; }; } } catch (e) {}
    /* كل تشغيل مقطع: متى بيكون أول المقطع بساعة السيرفر (لو بدأ من نصه نرجع بقدر اللي انقفز) */
    window.__starts = [];
    const orig = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when, offset) {
        const c = this.context, w = when && when > c.currentTime ? (when - c.currentTime) * 1000 : 0;
        window.__starts.push({ zero: Math.round(bcNow() + w - (offset || 0) * 1000), dur: this.buffer ? this.buffer.duration : 0, seek: offset || 0 });
        return orig.apply(this, arguments);
    };
};
try {
    const devs = {};
    for (const who of ["host", "p1", "fan"]) { devs[who] = await device(browser, db, who, { api }); await devs[who].evaluate(spy); }
    await until(() => tts.some(t => t.who === "host"), 8000);
    await sleep(1500);
    const prefetched = new Set(tts.filter(t => t.who === "host").map(t => t.text));
    /* نقفز للسؤال الثالث وسعد جاوب صح للمرة الثالثة ورا بعض (سلسلة) */
    const now = Date.now(), d0 = liveDoc(db);
    db.write({ op: "update", path: "room/main/liveMatches/round_2", data: { scene: "playing", phase: "reveal", qIndex: 2, outcome: 1, s1: 3, s2: 0, log: [1, 1, 1, -1, -1], ready1: true, ready2: true, deadline: now + 6500, qAt: now - 9000, v: (d0.v || 0) + 5, lastAnswer: { by: 1, text: "طوكيو", correct: true } } });
    await until(() => tts.filter(t => t.who === "fan").length >= 2, 9000);
    await sleep(800);
    const reveal = "والإجابة الصحيحة هي: كذا";
    const fanTexts = tts.filter(t => t.who === "fan" && t.at >= now).map(t => t.text);   /* بعد الكشف (قبله المشجع يجهّز أصوات الأسئلة من الكاش) */
    const situ = fanTexts.find(t => /نار|يوقفه/.test(t));
    /* جملة الجواب ما تنطلب قبل الكشف (كاش /tts عام = يكشف الجواب لو انطلبت قبل)، وجهاز المنظم يطلبها أول وقت الكشف */
    const qTexts = (d0.questions || []).map(q => q.text).filter(Boolean);
    const revealLine = fanTexts.find(t => !/نار|يوقفه/.test(t) && !qTexts.some(q => t.includes(q)));   /* مو قراءة سؤال (المشجع يجهّزها من الكاش) */
    check("reveal line NOT requested before the reveal", !!revealLine && !prefetched.has(revealLine), { revealLine });
    const hr = tts.find(t => t.who === "host" && t.text === revealLine), fr = tts.find(t => t.who === "fan" && t.text === revealLine);
    check("host requested the reveal line first at reveal time", hr && fr && hr.at <= fr.at, { host: hr && hr.at, fan: fr && fr.at });
    check("situ line spoken (streak)", !!situ, situ);
    const hostSitu = tts.find(t => t.who === "host" && t.text === situ), fanSitu = tts.find(t => t.who === "fan" && t.text === situ);
    check("host requested situ first (others hit the cache)", hostSitu && fanSitu && hostSitu.at <= fanSitu.at, { host: hostSitu && hostSitu.at, fan: fanSitu && fanSitu.at });
    /* التزامن: جهاز المشجع التحديثات توصله متأخرة 0.9 ث، والمذيع لازم يبدأ السؤال عنده بنفس لحظة المنظم */
    devs.fan.__extraLat = 900;
    await sleep(1000);
    const nq = Date.now(), d1 = liveDoc(db);
    for (const p of Object.values(devs)) await p.evaluate(() => { window.__starts = []; });
    db.write({ op: "update", path: "room/main/liveMatches/round_2", data: { scene: "playing", phase: "buzz", qIndex: 4, outcome: 0, lastAnswer: null, deadline: nq + 15000, qAt: nq, v: (d1.v || 0) + 1 } });
    await sleep(3500);
    const sh = await devs.host.evaluate(() => window.__starts), sf = await devs.fan.evaluate(() => window.__starts);
    const zh = sh.find(x => x.dur > 2), zf = sf.find(x => x.dur > 2);
    check("question line starts together on a late device (< 150 ms apart)", zh && zf && Math.abs(zh.zero - zf.zero) < 150, { host: zh, fan: zf, diff: zh && zf ? zf.zero - zh.zero : null });
    check("late device joined mid-line (seek), not from the start", zf && zf.seek > 0.5, zf);
    devs.fan.__extraLat = 0;
    const unique = new Set(tts.map(t => t.text)).size;
    check("no speechSynthesis anywhere", (await Promise.all(Object.values(devs).map(p => p.evaluate(() => window.__synth)))).every(n => !n));
    fs.writeFileSync(out + "/tts.json", JSON.stringify({ unique, requests: tts.length, byText: [...new Set(tts.map(t => t.text))].map(t => ({ t, who: tts.filter(x => x.text === t).map(x => x.who) })) }, null, 1));
    console.log("tts unique texts:", unique, "requests:", tts.length);
} catch (e) { ok = false; console.log(e.stack || e); }
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
