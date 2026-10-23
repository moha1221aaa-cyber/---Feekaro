/* التعادل ينتهي تعادل (السؤال الذهبي انشال): آخر سؤال يخلص والنتيجة 2-2 ← المقدم يضغط نتيجة المواجهة ← مشهد النتيجة بدون سؤال زيادة،
   والنتيجة تنكتب في جدول الدوري 2-2 (تعادل = نقطة لكل واحد). وفوز عادي ما تغيّر.  node tests/harness/tie.mjs */
import { serve, FakeDB, seed, launch, device, until, sleep, liveDoc } from "./harness.mjs";

const srv = await serve(8787);
let ok = true;
const check = (name, v, extra) => { if (!v) ok = false; console.log((v ? "PASS " : "FAIL ") + name + (extra !== undefined ? " " + JSON.stringify(extra) : "")); };
const browser = await launch({ wav: "silence.wav" });
for (const [label, s1, s2] of [["tie", 2, 2], ["win", 3, 2]]) {
    const db = new FakeDB(40);
    const now = Date.now();
    seed(db, "playing", { phase: "reveal", qIndex: 4, s1, s2, log: [1, 2, 1, 2, s1 > s2 ? 1 : 0], qAt: now - 20000, deadline: now - 1000, ready1: true, ready2: true, hostSeen: now });
    const host = await device(browser, db, "host", {});
    try {
        /* من 23 أكتوبر 2026 المقدم يضغط "نتيجة المواجهة" بعد آخر سؤال (ولا شي ينتقل لحاله) */
        await until(() => host.$(".bc-nextq"), 15000);
        check(label + ": button says match result", /نتيجة المواجهة/.test(await host.evaluate(() => document.querySelector(".bc-nextq").textContent)));
        await host.click(".bc-nextq");
        check(label + ": match ends (result scene)", await until(() => (liveDoc(db) || {}).scene === "result", 12000), { scene: liveDoc(db).scene, q: liveDoc(db).qIndex });
        const d = liveDoc(db);
        check(label + ": no golden question added", !(d.golden > 0) && (d.questions || []).length === 5 && (d.log || []).length === 5, { golden: d.golden, qs: (d.questions || []).length });
        check(label + ": result saved in broadcast", d.order[0].state === "done" && d.order[0].s1 === s1 && d.order[0].s2 === s2, d.order[0]);
        const m = await until(() => { const x = (db.data("league/current").matches || []).find(x => x.round === 2 && x.p1 === "سعد" && x.p2 === "فهد"); return x && x.s1 !== "" ? x : null; }, 10000);
        check(label + ": applied to league table " + s1 + "-" + s2, m && m.s1 === String(s1) && m.s2 === String(s2), m);
        if (label === "tie") check("tie: screen says تعادل", await until(() => host.evaluate(() => /تعادل/.test(document.getElementById("liveScreen").innerText)), 8000));
        const errs = host.__logs.filter(l => /PAGEERROR/.test(l));
        check(label + ": no page errors", !errs.length, errs.slice(0, 3));
    } catch (e) { ok = false; console.log(e); }
    await host.context().close();
}
await browser.close();
srv.close();
process.exit(ok ? 0 : 1);
