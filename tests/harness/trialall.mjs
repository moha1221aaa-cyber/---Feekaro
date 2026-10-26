/* طلبات محمد 23 أكتوبر 2026:
   - المسابقة التجريبية: كل الجولات في بث واحد (round_trialall)، وكل مواجهة نتيجتها تنكتب في جولتها
   - المايك يفتح بعد شارة البداية (مو أول ما يبدأ الترحيب)، عشان صوت المايك ما يدخل على الشارة
   node tests/harness/trialall.mjs */
import { serve, FakeDB, seed, launch, device, until, sleep, liveDoc } from "./harness.mjs";
const srv = await serve();
let ok = true;
const check = (name, v, extra) => { if (!v) ok = false; console.log((v ? "PASS " : "FAIL ") + name + (extra !== undefined ? " " + JSON.stringify(extra) : "")); };
const browser = await launch({ wav: "silence.wav" });
try {
    /* ===== 1) بث التجربة فيه كل الجولات ===== */
    {
        const db = new FakeDB(30);
        seed(db, "result", { sceneAt: Date.now() - 60000 });
        const cur = db.data("league/current");
        cur.matches.push({ p1: "سعد", p2: "ناصر", s1: "", s2: "", round: 3 }, { p1: "فهد", p2: "خالد", s1: "", s2: "", round: 3 });
        cur.trial = { startedAt: Date.now(), n: 4 };
        db.docs.set("league/current", { ver: 2, data: cur });
        const host = await device(browser, db, "host", { live: "none" });
        await until(() => host.evaluate(() => !!leagueTrial && matches.length === 6), 15000);
        const btns = await until(() => host.evaluate(() => { const b = [...document.querySelectorAll(".live-start-btn")].map(x => x.textContent); return b.length ? b : null; }), 8000);
        check("trial: start buttons are all 'all rounds'", btns && btns.every(t => /كل الجولات/.test(t)), btns);
        await host.evaluate(() => { bcAskStart = async () => ({ at: 0 }); aiHostLines = async () => null; bcFreshQuestions = async () => []; bcStartRound(3); });
        const d = await until(() => db.data("room/main/liveMatches/round_trialall"), 20000);
        check("one broadcast round_trialall", !!d);
        check("all unplayed matches of every round, in round order", d && d.order.length === 4 && d.order.map(o => o.round).join(",") === "2,2,3,3", d && d.order.map(o => o.p1 + "-" + o.p2 + "@" + o.round));
        check("labelled as the trial round and marked trial", d && d.round === "التجريبية" && d.trial === 1, d && [d.round, d.trial]);
        /* نتيجة مواجهة من الجولة 3 تنكتب في الجولة 3 */
        db.write({ op: "update", path: "room/main/liveMatches/round_trialall", data: { order: d.order.map((o, i) => i === 2 ? Object.assign({}, o, { state: "done", s1: 3, s2: 1 }) : o) } });
        await sleep(500);
        await host.evaluate(() => bcApplyResults("round_trialall"));
        const m = await until(() => { const x = db.data("league/current").matches.find(x => x.round === 3 && x.p1 === "سعد" && x.p2 === "ناصر"); return x && x.s1 !== "" ? x : null; }, 8000);
        check("result of a round-3 match saved in round 3", m && m.s1 === "3" && m.s2 === "1", m);
        const errs = host.__logs.filter(l => /PAGEERROR/.test(l));
        check("no page errors (trial)", !errs.length, errs.slice(0, 3));
        await host.context().close();
    }
    /* ===== 2) المايك بعد الشارة ===== */
    {
        const db = new FakeDB(30);
        seed(db, "intro", { ready1: true, ready2: false, sceneAt: Date.now() - 5000 });
        const p1 = await device(browser, db, "p1", {});
        await until(() => p1.$(".bc-vs"), 15000); await sleep(1500);
        const t0 = Date.now();
        db.write({ op: "update", path: "room/main/liveMatches/round_2", data: { ready2: true, scene: "talk", sceneAt: t0, v: 9 } });
        await until(() => p1.$(".cine.ident"), 4000);
        await sleep(2500);
        /* 26 أكتوبر 2026: المايك منشور مكتوم من صفحة المواجهة (stability.mjs)، فالمقياس: مكتوم وقت الشارة، وينفتح بعدها */
        check("mic stays closed during the opening sting", await p1.evaluate(() => !bcShouldPublish(liveMatchesCache[openLiveId]) && !bcMicOpen() && (!bcTrack || window.__micMuted)));
        const at = await until(() => p1.evaluate(() => bcMicOpen()).then(v => v ? Date.now() : 0), 9000);
        check("mic opens by itself right after the sting (~5.6 s)", at && at - t0 >= 5500 && at - t0 < 8500, at && at - t0);
        await p1.context().close();
    }
} catch (e) { ok = false; console.log(e.stack || e); }
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
