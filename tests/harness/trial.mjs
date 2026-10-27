/* المسابقة التجريبية المؤقتة: المنظم يبدأها بـ 6 أسماء (الدوري الأصلي ينحفظ في league/saved)، والبث فيها له معرّف لحاله،
   و"إنهاء التجربة" يرجّع الأصلي كامل ويحذف توقعات التجربة بس. ونتيجة بث التجربة ما تنكتب في الجدول الحقيقي.
   node tests/harness/trial.mjs */
import { serve, FakeDB, seed, launch, device, until, sleep } from "./harness.mjs";

const srv = await serve(8787);
let ok = true;
const check = (name, v, extra) => { if (!v) ok = false; console.log((v ? "PASS " : "FAIL ") + name + (extra !== undefined ? " " + JSON.stringify(extra) : "")); };
const db = new FakeDB(30);
seed(db, "intro", { status: "ended" });
const original = JSON.parse(JSON.stringify(db.data("league/current")));
db.docs.set("predictions/u_p1_r1_سعد_خالد", { ver: 1, data: { userId: "u_p1", matchId: "r1_سعد_خالد", s1: 2, s2: 1, updatedAt: { __ts: Date.now() - 86400000 } } });
const browser = await launch({ wav: "silence.wav" });
const NAMES = "احمد، مشاري، خلود، ياي، عبدالرحمن، سعود";
try {
    const host = await device(browser, db, "host", { live: "none" });
    host.removeAllListeners("dialog");
    const dialogs = [];
    host.on("dialog", d => { dialogs.push(d.message()); d.type() === "prompt" ? d.accept(NAMES) : d.accept(); });
    check("admin sees trial button", await until(() => host.evaluate(() => { const b = document.getElementById("trialBtn"); return b && b.offsetParent !== null && /تجريبية/.test(b.textContent); }), 10000));
    check("bcId normal before trial", await host.evaluate(() => bcId(1) === "round_1"));
    await host.click("#trialBtn");
    const cur = await until(() => { const c = db.data("league/current"); return c && c.trial ? c : null; }, 8000);
    check("trial started with 6 names", cur && cur.playersList.length === 6 && cur.playersList.join(",") === "احمد,مشاري,خلود,ياي,عبدالرحمن,سعود", cur && cur.playersList);
    check("trial matches: double round robin (30) with no results", cur && cur.matches.length === 30 && cur.matches.every(m => m.s1 === "" && m.s2 === ""), cur && cur.matches.length);
    const saved = db.data("league/saved");
    check("original league saved in full", saved && JSON.stringify(saved.playersList) === JSON.stringify(original.playersList) && JSON.stringify(saved.matches) === JSON.stringify(original.matches) && JSON.stringify(saved.playerLinks) === JSON.stringify(original.playerLinks) && saved.restoredAt === null);
    check("banner + button switch on", await until(() => host.evaluate(() => /مسابقة تجريبية/.test(document.getElementById("trialBanner").innerText) && /إنهاء التجربة/.test(document.getElementById("trialBtn").textContent)), 5000));
    check("table shows trial names", await until(() => host.evaluate(() => players.length === 6 && players.some(p => p.name === "ياي")), 5000));
    check("trial broadcast id is separate (one broadcast for all rounds)", await host.evaluate(() => bcId(1) === "round_trialall" && bcId(3) === "round_trialall"));
    check("one start button only (first round), for all rounds", await until(() => host.evaluate(() => { const b = [...document.querySelectorAll(".live-start-btn")]; return b.length >= 1 && b.every(x => /كل الجولات/.test(x.textContent)); }), 5000), await host.evaluate(() => [...document.querySelectorAll(".live-start-btn")].map(x => x.textContent)));
    /* إضافة وحذف متسابق وقت التجربة (27 أكتوبر 2026) */
    check("trial players button visible", await host.evaluate(() => document.getElementById("trialPlayersBtn").offsetParent !== null));
    await host.click("#trialPlayersBtn");
    await host.fill("#trialAddName", "فيصل");
    await host.click(".trial-players-add button");
    const c7 = await until(() => { const c = db.data("league/current"); return c.playersList.length === 7 ? c : null; }, 8000);
    const rr = c => { const pairs = new Set(c.matches.map(m => m.p1 + ">" + m.p2)); return c.playersList.every(a => c.playersList.every(b => a === b || pairs.has(a + ">" + b))) && pairs.size === c.matches.length; };
    check("add with no results → full new draw (42, every pair home and away)", c7 && c7.matches.length === 42 && rr(c7) && c7.trial.n === 7, c7 && c7.matches.length);
    /* نتيجة لمواجهة ثم إضافة: النتيجة تبقى، والجديد مواجهاته بدون ما يلعب مرتين بنفس الجولة */
    const ms = c7.matches.map((m, i) => i === 0 ? Object.assign({}, m, { s1: "3", s2: "1" }) : m);
    const keep = ms[0];
    db.write({ op: "update", path: "league/current", data: { matches: ms } });
    await until(() => host.evaluate(() => matches.some(m => m.s1 === "3")), 5000);
    await host.fill("#trialAddName", "نورة");
    await host.click(".trial-players-add button");
    const c8 = await until(() => { const c = db.data("league/current"); return c.playersList.length === 8 ? c : null; }, 8000);
    const noClash = c => { const seen = new Set(); return c.matches.every(m => [m.p1, m.p2].every(p => { const k = m.round + "|" + p; if (seen.has(k)) return false; seen.add(k); return true; })); };
    check("add with results → result kept, all pairs, nobody twice in a round", c8 && c8.matches.length === 56 && rr(c8) && noClash(c8) && c8.matches.some(m => m.p1 === keep.p1 && m.p2 === keep.p2 && m.round === keep.round && m.s1 === "3"), c8 && c8.matches.length);
    /* حذف اللي له نتيجة */
    host.removeAllListeners("dialog");
    host.on("dialog", d => { dialogs.push(d.message()); d.type() === "prompt" ? d.accept(NAMES) : d.accept(); });
    await until(() => host.evaluate(() => players.length === 8), 5000);
    await host.evaluate(n => trialRemovePlayer(n), keep.p1);
    const c7b = await until(() => { const c = db.data("league/current"); return c.playersList.length === 7 ? c : null; }, 8000);
    const rounds = c7b ? [...new Set(c7b.matches.map(m => m.round))].sort((a, b) => a - b) : [];
    check("remove → his matches gone (and the result), rounds without gaps", c7b && !c7b.playersList.includes(keep.p1) && c7b.matches.every(m => m.p1 !== keep.p1 && m.p2 !== keep.p1) && c7b.matches.length === 42 && rounds.every((r, i) => r === i + 1) && !c7b.matches.some(m => m.s1 === "3"), c7b && { n: c7b.matches.length, rounds });
    check("remove confirm mentions the played match", dialogs.some(x => /حذف/.test(x) && /1 مواجهة انلعبت/.test(x)), dialogs.slice(-2));
    check("modal lists 7 players", await until(() => host.evaluate(() => document.querySelectorAll(".trial-player").length === 7), 5000));
    await host.evaluate(() => goBackModal());
    /* توقع وقت التجربة + ربط حساب لاسم موجود في الأصلي */
    db.write({ op: "set", path: "predictions/u_p2_r1_احمد_مشاري", data: { userId: "u_p2", matchId: "r1_احمد_مشاري", s1: 1, s2: 0, updatedAt: { __fv: "ts" } } });
    db.write({ op: "update", path: "league/current", data: { "playerLinks": { "سعود": "u_new" } } });
    /* نتيجة بث تجربة ما تنكتب في الجدول الحقيقي بعد الرجوع: نجهّز بث (round_2 الأصلي) معلّم تجربة وفيه نتيجة */
    await sleep(500);
    dialogs.length = 0;
    await host.click("#trialBtn");
    const back = await until(() => { const c = db.data("league/current"); return c && !c.trial ? c : null; }, 8000);
    check("original league restored exactly", back && JSON.stringify(back.playersList) === JSON.stringify(original.playersList) && JSON.stringify(back.matches) === JSON.stringify(original.matches), back && back.playersList);
    check("links kept (original + none added for names not in league)", back && back.playerLinks["سعد"] === "u_p1" && !("سعود" in back.playerLinks), back && back.playerLinks);
    check("saved marked restored", !!(db.data("league/saved") || {}).restoredAt);
    check("trial prediction deleted, old prediction kept", await until(() => !db.data("predictions/u_p2_r1_احمد_مشاري"), 5000) && !!db.data("predictions/u_p1_r1_سعد_خالد"));
    check("done message mentions removed predictions", await until(() => dialogs.some(x => /رجع الدوري الأصلي/.test(x) && /1 توقع/.test(x)), 5000), dialogs);
    check("banner gone, bcId back to normal", await until(() => host.evaluate(() => !document.getElementById("trialBanner").innerText.trim() && bcId(1) === "round_1"), 5000));
    /* بث معلّم تجربة فيه نتيجة منتهية: ما ينكتب في الجدول الحقيقي */
    const lp = "room/main/liveMatches/round_2";
    const ld = db.data(lp);
    const order = ld.order.map((o, i) => i === 0 ? Object.assign({}, o, { state: "done", s1: 3, s2: 1, applied: false }) : o);
    db.write({ op: "update", path: lp, data: { trial: 1, order } });
    await sleep(2500);
    const m = () => db.data("league/current").matches.find(x => x.round === 2 && x.p1 === "سعد" && x.p2 === "فهد");
    check("trial broadcast result NOT applied to real league", m().s1 === "" && m().s2 === "", m());
    db.write({ op: "update", path: lp, data: { trial: 0 } });
    check("real broadcast result still applied", await until(() => m().s1 === "3" && m().s2 === "1", 8000), m());
    /* تجربة ثانية بعد الرجوع تشتغل عادي */
    await host.click("#trialBtn");
    check("can start a new trial after restore", await until(() => (db.data("league/current") || {}).trial, 8000));
    const errs = host.__logs.filter(l => /PAGEERROR/.test(l));
    check("no page errors", !errs.length, errs.slice(0, 3));
} catch (e) { ok = false; console.log(e); }
await browser.close();
srv.close();
process.exit(ok ? 0 : 1);
