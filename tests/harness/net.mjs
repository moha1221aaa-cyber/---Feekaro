/* انقطاع النت وسط المواجهة: صوت البث يرجع لحاله (يدخل القناة من جديد وينشر نفس المايك)، والتسجيل ما ينقطع.
   node tests/harness/net.mjs */
import { serve, FakeDB, seed, launch, device, until, sleep } from "./harness.mjs";

const srv = await serve(8787);
let ok = true;
const check = (name, v, extra) => { if (!v) ok = false; console.log((v ? "PASS " : "FAIL ") + name + (extra !== undefined ? " " + JSON.stringify(extra) : "")); };
const db = new FakeDB(60);
const now = Date.now();
seed(db, "playing", { phase: "buzz", qIndex: 0, qAt: now, deadline: now + 600000, ready1: true, ready2: true });
const browser = await launch({ wav: "speech.wav" });
try {
    const p1 = await device(browser, db, "p1", { api: { ai: async () => ({ ok: false }) } });
    check("mic published", await until(() => p1.evaluate(() => typeof bcTrack !== "undefined" && !!bcTrack && window.__agora.publishes === 1), 10000));
    const before = await p1.evaluate(() => ({ joins: window.__agora.joins, id: bcTrack.getMediaStreamTrack().id }));
    await p1.evaluate(() => window.__agora.emit("connection-state-change", "RECONNECTING", "CONNECTED"));
    check("reconnecting note shown", await until(() => p1.evaluate(() => /نرجع نوصل/.test(document.getElementById("liveScreen").innerText)), 3000));
    await p1.evaluate(() => window.__agora.emit("connection-state-change", "DISCONNECTED", "RECONNECTING", "NETWORK_ERROR"));
    check("rejoined after full disconnect", await until(() => p1.evaluate(j => window.__agora.joins > j, before.joins), 6000));
    check("same mic republished (not reopened)", await until(() => p1.evaluate(id => window.__agora.publishes === 2 && !!bcTrack && bcTrack.getMediaStreamTrack().id === id && bcTrack.getMediaStreamTrack().readyState === "live", before.id), 6000));
    await p1.evaluate(() => window.__agora.emit("connection-state-change", "CONNECTED", "CONNECTING"));
    await sleep(500);
    check("error note cleared", await p1.evaluate(() => !/انقطع صوت البث|نرجع نوصل/.test(document.getElementById("liveScreen").innerText)));
    const diag = db.data("room/main/liveDiag/round_2") || {};
    const net = ((diag.bcDiag || {}).u_p1 || {}).net || [];
    check("network events in liveDiag (not the live doc)", net.some(x => /rejoin:NETWORK_ERROR/.test(x.ev)) && !(db.data("room/main/liveMatches/round_2") || {}).bcDiag, net.map(x => x.ev));
    check("leave on LEAVE does not rejoin", await p1.evaluate(async () => { const j = window.__agora.joins; window.__agora.emit("connection-state-change", "DISCONNECTED", "CONNECTED", "LEAVE"); await new Promise(r => setTimeout(r, 2500)); return window.__agora.joins === j; }));
    /* إعادة النشر فشلت مرة: المايك ما يتقفل (التسجيل يكمل)، ويحاول بعدين */
    const pub0 = await p1.evaluate(() => { window.__agora.failPublish = 1; return window.__agora.publishes; });
    await p1.evaluate(() => { window.__agora.emit("connection-state-change", "CONNECTED", "CONNECTING"); window.__agora.emit("connection-state-change", "DISCONNECTED", "CONNECTED", "NETWORK_ERROR"); });
    check("failed republish keeps the mic track alive", await until(() => p1.evaluate(id => window.__agora.publishes >= 2 + 1 && !!bcTrack && bcTrack.getMediaStreamTrack().readyState === "live" && bcTrack.getMediaStreamTrack().id === id, before.id), 6000));
    check("retries and republishes after the failure", await until(() => p1.evaluate(n => window.__agora.publishes >= n + 2 && !bcRepub, pub0), 12000));
    check("banned: no rejoin loop", await p1.evaluate(async () => { window.__agora.emit("connection-state-change", "CONNECTED", "CONNECTING"); const j = window.__agora.joins; window.__agora.emit("connection-state-change", "DISCONNECTED", "CONNECTED", "UID_BANNED"); await new Promise(r => setTimeout(r, 4000)); return window.__agora.joins === j; }));
    const errs = p1.__logs.filter(l => /PAGEERROR/.test(l));
    check("no page errors", !errs.length, errs.slice(0, 3));
} catch (e) { ok = false; console.log(e); }
await browser.close();
srv.close();
process.exit(ok ? 0 : 1);
