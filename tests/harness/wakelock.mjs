/* الشاشة ما تطفي وقت البث وفي الغرفة (Screen Wake Lock):
   - ينطلب أول ما يفتح البث، وينفك لما يطلع منه. نفس الشي للغرفة الصوتية. والاثنين مفتوحين: يظل لين يطلع منهم كلهم.
   - الموقع يروح للخلفية (القفل يروح لحاله) ← يرجع للواجهة ← ينطلب من جديد.
   - متصفح بدون wakeLock (آيفون قديم): الفيديو الصامت الصغير يشتغل وقت البث ويوقف بعده.
   navigator.wakeLock و visibilityState وهميين (Chromium بدون شاشة ما يعطي القفل).  node tests/harness/wakelock.mjs */
import { serve, FakeDB, seed, launch, device, until, sleep, PORT } from "./harness.mjs";
/* البث يشيل ?live= من الرابط بعد ما يفتح، فـ reload ما يرجّعه: نفتح الرابط كامل */
const reopen = (p, who) => p.goto(`http://127.0.0.1:${PORT}/index.html?as=${who}&live=round_2`);

const srv = await serve(8787);
let ok = true;
const check = (name, v, extra) => { if (!v) ok = false; console.log((v ? "PASS " : "FAIL ") + name + (extra !== undefined ? " " + JSON.stringify(extra) : "")); };

/* support=false: متصفح ما يدعم wakeLock */
function fakeEnv(support) {
    let vis = "visible";
    Object.defineProperty(document, "visibilityState", { get: () => vis, configurable: true });
    Object.defineProperty(document, "hidden", { get: () => vis !== "visible", configurable: true });
    window.__wl = { req: 0, released: 0, active: null, plays: 0 };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { if (this.id === "wakeVideo") window.__wl.plays++; return play.apply(this, arguments); };
    if (!support) { Object.defineProperty(Navigator.prototype, "wakeLock", { get: () => undefined, configurable: true }); }
    else {
        const mk = () => {
            const l = new EventTarget();
            l.type = "screen"; l.released = false;
            l.release = async () => { if (l.released) return; l.released = true; window.__wl.released++; if (window.__wl.active === l) window.__wl.active = null; l.dispatchEvent(new Event("release")); };
            return l;
        };
        const wl = { request: async () => {
            if (vis !== "visible") throw new DOMException("not visible", "NotAllowedError");
            const h0 = window.__wl.hides || 0;
            await new Promise(r => setTimeout(r, window.__wl.delay || 30));
            /* راح للخلفية والطلب معلّق: المتصفح يرفضه */
            if ((window.__wl.hides || 0) !== h0) throw new DOMException("hidden while pending", "NotAllowedError");
            window.__wl.req++;
            const l = mk(); window.__wl.active = l; return l;
        } };
        Object.defineProperty(Navigator.prototype, "wakeLock", { get: () => wl, configurable: true });
    }
    /* المتصفح يفك القفل لحاله لما الصفحة تختفي */
    window.__setVis = v => { vis = v; if (v !== "visible") window.__wl.hides = (window.__wl.hides || 0) + 1; if (v !== "visible" && window.__wl.active) window.__wl.active.release(); document.dispatchEvent(new Event("visibilitychange")); };
}
const held = p => p.evaluate(() => !!window.__wl.active && !window.__wl.active.released);
const wl = p => p.evaluate(() => ({ req: window.__wl.req, released: window.__wl.released, held: !!window.__wl.active, plays: window.__wl.plays }));

const db = new FakeDB(60);
seed(db, "intro", { status: "scheduled", startAt: Date.now() + 600000 });
const browser = await launch({ wav: "silence.wav" });
try {
    /* ===== متصفح يدعم wakeLock ===== */
    const p = await device(browser, db, "fan", { api: { ai: async () => ({ ok: false }) } });
    await p.context().addInitScript(fakeEnv, true);
    await reopen(p, "fan");
    await until(() => p.evaluate(() => document.getElementById("liveScreen").classList.contains("open")), 15000);
    check("live open: lock requested", await until(() => held(p), 3000), await wl(p));
    check("live open: one request only", (await wl(p)).req === 1, await wl(p));
    await p.evaluate(() => closeLiveScreen(true));
    check("live closed: lock released", await until(async () => !(await held(p)), 3000), await wl(p));
    /* الخلفية والرجوع */
    await p.evaluate(() => openLiveScreen("round_2"));
    check("live reopened: lock requested again", await until(() => held(p), 3000), await wl(p));
    const r0 = (await wl(p)).req;
    await p.evaluate(() => window.__setVis("hidden"));
    await sleep(300);
    check("background: lock gone, no request while hidden", !(await held(p)) && (await wl(p)).req === r0, await wl(p));
    await p.evaluate(() => window.__setVis("visible"));
    check("foreground again: lock re-requested", await until(() => held(p), 3000) && (await wl(p)).req === r0 + 1, await wl(p));
    await p.evaluate(() => closeLiveScreen(true));
    await until(async () => !(await held(p)), 3000);
    await p.evaluate(() => window.__setVis("hidden"));
    await p.evaluate(() => window.__setVis("visible"));
    await sleep(300);
    check("closed + foreground: no new request", !(await held(p)) && (await wl(p)).req === r0 + 1, await wl(p));
    /* الغرفة الصوتية */
    await p.evaluate(() => openRoomScreen(true));
    check("room open: lock requested", await until(() => held(p), 3000), await wl(p));
    const r1 = (await wl(p)).req;
    await p.evaluate(() => window.__setVis("hidden"));
    await p.evaluate(() => window.__setVis("visible"));
    check("room: foreground again re-requests", await until(() => held(p), 3000) && (await wl(p)).req === r1 + 1, await wl(p));
    /* الغرفة والبث مع بعض: يطلع من وحدة والقفل يظل */
    await p.evaluate(() => openLiveScreen("round_2"));
    await sleep(200);
    await p.evaluate(() => closeLiveScreen(true));
    await sleep(300);
    check("live closed but room still open: lock kept", await held(p), await wl(p));
    await p.evaluate(() => closeRoomScreen(true));
    check("room closed: lock released", await until(async () => !(await held(p)), 3000), await wl(p));
    /* النظام فك القفل والموقع قدام: ينطلب من جديد */
    await p.evaluate(() => openLiveScreen("round_2"));
    await until(() => held(p), 3000);
    const r2 = (await wl(p)).req;
    await p.evaluate(() => window.__wl.active.release());
    check("system release while visible: lock re-requested", await until(async () => (await held(p)) && (await wl(p)).req === r2 + 1, 4000), await wl(p));
    await p.evaluate(() => closeLiveScreen(true));
    await until(async () => !(await held(p)), 3000);
    /* خلفية ثم واجهة والطلب لسا معلّق: ينطلب مرة ثانية (مو الفيديو) */
    await p.evaluate(() => { window.__wl.delay = 600; openLiveScreen("round_2"); window.__setVis("hidden"); window.__setVis("visible"); });
    check("hidden+visible while request pending: lock re-requested", await until(() => held(p), 4000), await wl(p));
    await p.evaluate(() => { window.__wl.delay = 30; closeLiveScreen(true); });
    await until(async () => !(await held(p)), 3000);
    check("no fallback video when wakeLock works", (await wl(p)).plays === 0, await wl(p));

    /* ===== متصفح بدون wakeLock: الفيديو الصامت ===== */
    const q = await device(browser, db, "p2", { api: { ai: async () => ({ ok: false }) } });
    await q.context().addInitScript(fakeEnv, false);
    await reopen(q, "p2");
    await until(() => q.evaluate(() => document.getElementById("liveScreen").classList.contains("open")), 15000);
    const vid = () => q.evaluate(() => { const v = document.getElementById("wakeVideo"); return v ? { paused: v.paused, muted: v.muted, loop: v.loop, src: v.currentSrc.split("/").pop(), w: v.getBoundingClientRect().width, err: v.error && v.error.code } : null; });
    check("no wakeLock: muted looping fallback video plays while live is open", await until(async () => { const v = await vid(); return v && !v.paused && v.muted && v.loop; }, 4000), await vid());
    await q.evaluate(() => closeLiveScreen(true));
    check("no wakeLock: fallback video paused after leaving", await until(async () => { const v = await vid(); return v && v.paused; }, 3000), await vid());
    await q.evaluate(() => openRoomScreen(true));
    await q.evaluate(() => window.__setVis("hidden"));
    check("no wakeLock: paused in background", await until(async () => (await vid()).paused, 3000), await vid());
    await q.evaluate(() => window.__setVis("visible"));
    check("no wakeLock: plays again in room on foreground", await until(async () => !(await vid()).paused, 3000), await vid());
    await q.evaluate(() => closeRoomScreen(true));
    check("no wakeLock: paused after leaving room", await until(async () => (await vid()).paused, 3000), await vid());

    const errs = [p, q].flatMap(x => x.__logs.filter(l => /PAGEERROR/.test(l)));
    check("no page errors", !errs.length, errs.slice(0, 3));
} catch (e) { ok = false; console.log(e); }
await browser.close();
srv.close();
process.exit(ok ? 0 : 1);
