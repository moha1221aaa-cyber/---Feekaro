/* جوال ضعيف: المعالج أبطأ 6 مرات (CDP)، ونقيس في وقت السؤال: نسبة الإطارات البطيئة (> 50ms)، والمهام الطويلة،
   وزمن الرد المحلي للجرس. مرة بالشكل الكامل (?lite=0) ومرة بالخفيف (?lite=1)، وبعدها الكشف التلقائي (بدون lite).
   node tests/harness/perf.mjs [مجلد] */
import { serve, FakeDB, seed, launch, device, until, sleep } from "./harness.mjs";
import fs from "node:fs";

const out = process.argv[2] || "/tmp/harness-perf";
fs.mkdirSync(out, { recursive: true });
const srv = await serve(8787);
let ok = true;
const check = (name, v, extra) => { if (!v) ok = false; console.log((v ? "PASS " : "FAIL ") + name + (extra !== undefined ? " " + JSON.stringify(extra) : "")); };
const res = {};
for (const mode of ["lite=0", "lite=1", "auto"]) {
    const db = new FakeDB(60);
    const now = Date.now();
    seed(db, "playing", { phase: "buzz", qIndex: 0, qAt: now + 4000, deadline: now + 60000, ready1: true, ready2: true });
    const browser = await launch({ wav: "silence.wav" });
    try {
        const p1 = await device(browser, db, "p1", { api: { ai: async () => ({ ok: false }) }, query: mode === "auto" ? "" : mode });
        const cdp = await p1.context().newCDPSession(p1);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
        await until(() => p1.$("#lvBell"), 20000);
        await sleep(6000);   /* الكشف التلقائي ياخذ أول 5 ث */
        const m = await p1.evaluate(() => new Promise(done => {
            let last = performance.now(), n = 0, slow = 0, long = 0;
            const t0 = last;
            try { new PerformanceObserver(l => { for (const e of l.getEntries()) long += e.duration; }).observe({ type: "longtask" }); } catch (e) {}
            const step = ts => { const dt = ts - last; last = ts; n++; if (dt > 50) slow++; if (ts - t0 < 4000) requestAnimationFrame(step); else done({ frames: n, slowPct: Math.round(slow / n * 100), longMs: Math.round(long), lite: bcLite, cls: document.getElementById("liveScreen").classList.contains("bc-lite"), video: (() => { const v = document.getElementById("stVideo"); return v ? (v.paused ? "paused" : "playing") : "none"; })() }); };
            requestAnimationFrame(step);
        }));
        await p1.evaluate(() => {
            window.__rt = []; const o = bcPerfRender; bcPerfRender = ms => { window.__rt.push(Math.round(ms)); o(ms); };
            /* السبب الجذري (void offsetWidth يرتّب الصفحة كاملة على طول): نعد أي قراءة له بعد الجرس */
            window.__reflow = 0;
            const d = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
            Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get() { window.__reflow++; return d.get.call(this); } });
        });
        const bell = await p1.evaluate(() => new Promise(r => {
            const b = document.getElementById("lvBell");
            const ev = new PointerEvent("pointerdown", { bubbles: true, cancelable: true });
            b.dispatchEvent(ev);
            /* تجهيز التسجيل بعد أول رسم للجرس (كان داخل الضغطة ويأخّر الرد ~300ms على أندرويد 10) */
            window.__armSync = !!(VA.arm || VA.rec);
            setTimeout(() => { window.__armLater = !!(VA.arm || VA.rec); }, 600);
            requestAnimationFrame(() => r(Math.round(performance.now() - ev.timeStamp)));
        }));
        await sleep(2500);   /* بعد الجرس: الوثيقة تتغير (answer) والشاشة ترسم من جديد */
        Object.assign(m, await p1.evaluate(() => ({ armSync: window.__armSync, armLater: window.__armLater })));
        const pf = await p1.evaluate(() => ({ afterBuzz: window.__rt, reflows: window.__reflow, renderMax: Math.round(BC_PERF.renderMax), renders: BC_PERF.renders, longMs: Math.round(BC_PERF.longMs), tapMax: Math.round(BC_PERF.tapMax) }));
        Object.assign(m, { perf: pf });
        await p1.screenshot({ path: `${out}/${mode.replace("=", "")}.png` });
        res[mode] = Object.assign(m, { bellMs: bell, errors: p1.__logs.filter(l => /PAGEERROR/.test(l)) });
        console.log(mode, JSON.stringify(res[mode]));
    } catch (e) { ok = false; console.log(e); }
    await browser.close();
}
check("lite mode: video paused, class on", res["lite=1"] && res["lite=1"].cls && res["lite=1"].video === "paused");
/* Chromium هنا بدون H.264 فـ studio.mp4 ما يشتغل أصلاً، فنتأكد بس إن الكامل ما يشغّل الخفيف */
check("full mode stays full (?lite=0 wins over auto-detect)", res["lite=0"] && !res["lite=0"].cls && !res["lite=0"].lite);
check("auto mode: this 4-core box is detected as weak", res.auto && res.auto.lite === true, res.auto && res.auto.lite);
check("lite is not slower than full on a slow CPU (5% margin)", res["lite=1"] && res["lite=0"] && res["lite=1"].slowPct <= res["lite=0"].slowPct + 5, [res["lite=0"] && res["lite=0"].slowPct, res["lite=1"] && res["lite=1"].slowPct]);
/* السبب الجذري: ولا قراءة offsetWidth (ترتيب إجباري للصفحة) بعد الجرس. والوقت يختلف حسب الجهاز اللي يشغّل الاختبار
   (كان 113-176ms قبل الإصلاح، وصار 27-51ms على نفس الجهاز)، فحده هنا شبكة أمان بس */
check("no forced layout (offsetWidth) after the buzz", Object.values(res).every(r => r.perf && r.perf.reflows === 0), Object.values(res).map(r => r.perf && r.perf.reflows));
/* الوقت نفسه يتغير مع جهاز الاختبار (نفس الكود طلع 49-170ms بين تشغيلة وثانية)، فيطلع للقراءة بس */
console.log("INFO render after the buzz (ms, 6x slower CPU):", JSON.stringify(Object.values(res).map(r => r.perf && r.perf.afterBuzz)));
check("recording set up after the first paint, not inside the press", Object.values(res).every(r => r.armSync === false && r.armLater === true), Object.values(res).map(r => [r.armSync, r.armLater]));
check("no page errors", Object.values(res).every(r => !r.errors.length));
fs.writeFileSync(out + "/perf.json", JSON.stringify(res, null, 1));
srv.close();
process.exit(ok ? 0 : 1);
