/* تثبيت الجواب بعد ما ينتهي الوقت (27 أكتوبر 2026، طلب محمد): المتسابق جاوب صح بس المقدم ما لحق يضغط "صح"
   فانتقل السؤال للثاني (أو انكشف بدون فائز). المقدم يشوف زر "ثبّت جواب ... صح" ← نقطة له والكشف.
   (1) وقت الأول خلص ← دور الثاني ← المقدم يثبّت الأول. (2) الاثنين خلص وقتهم ← الكشف بدون فائز ← يثبّت الثاني.
   node tests/harness/late.mjs */
import { serve, FakeDB, seed, launch, device, until, sleep, liveDoc } from "./harness.mjs";

const srv = await serve(8787);
let ok = true;
const check = (name, v, extra) => { if (!v) ok = false; console.log((v ? "PASS " : "FAIL ") + name + (extra !== undefined ? " " + JSON.stringify(extra) : "")); };
const browser = await launch({ wav: "silence.wav" });
for (const label of ["first", "both"]) {
    const db = new FakeDB(40);
    const now = Date.now();
    seed(db, "playing", { phase: "answer", qIndex: 1, buzzer: 1, answerer: 1, tried1: true, tried2: false, passed: false, s1: 1, s2: 0, log: [1, -1, -1, -1, -1], qAt: now - 6000, ansAt: now - 5500, deadline: now + 1500, ready1: true, ready2: true, hostSeen: now });
    const host = await device(browser, db, "host", {});
    try {
        const passed = await until(() => { const d = liveDoc(db); return d.phase === "answer" && d.answerer === 2 ? d : null; }, 12000);
        check(label + ": time over → passes to p2 with the timeout mark", passed && passed.to1 === "0_1", passed && { to1: passed.to1 });
        check(label + ": host sees the late button for p1 only", await until(() => host.evaluate(() => { const b = [...document.querySelectorAll(".bc-late button")]; return b.length === 1 && /سعد/.test(b[0].textContent); }), 8000));
        if (label === "first") {
            await host.click(".bc-late button");
            const d = await until(() => { const x = liveDoc(db); return x.phase === "reveal" ? x : null; }, 8000);
            check("first: p1 gets the point (reveal, 2-0)", d && d.outcome === 1 && d.s1 === 2 && d.s2 === 0 && d.log[1] === 1 && d.lastAnswer && d.lastAnswer.late === 1, d && { o: d.outcome, s1: d.s1, log: d.log, last: d.lastAnswer });
            check("first: screen says p1 correct", await until(() => host.evaluate(() => /سعد جاوب صح/.test(document.getElementById("liveScreen").innerText)), 8000));
            check("first: no late button after", await until(() => host.evaluate(() => !document.querySelector(".bc-late")), 5000));
        } else {
            const d0 = await until(() => { const x = liveDoc(db); return x.phase === "reveal" ? x : null; }, 15000);
            check("both: p2 time over → reveal with no winner", d0 && d0.outcome === 0 && d0.to2 === "0_1" && d0.s1 === 1, d0 && { o: d0.outcome, to2: d0.to2 });
            check("both: host sees two late buttons in reveal", await until(() => host.evaluate(() => document.querySelectorAll(".bc-late button").length === 2), 8000));
            await host.click(".bc-late button:nth-of-type(2)");
            const d = await until(() => { const x = liveDoc(db); return x.outcome === 2 ? x : null; }, 8000);
            check("both: p2 gets the point (1-1)", d && d.s1 === 1 && d.s2 === 1 && d.log[1] === 2 && d.phase === "reveal", d && { s1: d.s1, s2: d.s2, log: d.log });
            check("both: next-question button still there", await until(() => host.$(".bc-nextq"), 8000));
        }
        const errs = host.__logs.filter(l => /PAGEERROR/.test(l));
        check(label + ": no page errors", !errs.length, errs.slice(0, 3));
    } catch (e) { ok = false; console.log(e); }
    await host.context().close();
}
await browser.close();
srv.close();
process.exit(ok ? 0 : 1);
