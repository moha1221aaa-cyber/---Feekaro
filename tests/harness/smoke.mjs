/* مواجهة كاملة على 3 أجهزة (المنظم + متسابقين): جاهز ← الترحيب ← العد ← الجرس ← الجواب ← الكشف
   node tests/harness/smoke.mjs [ملف_المايك.wav] [مجلد_الصور] */
import { serve, FakeDB, seed, launch, device, until, sleep, liveDoc } from "./harness.mjs";
import fs from "node:fs";

const wav = process.argv[2] || "speech.wav";
const out = process.argv[3] || "/tmp/harness-out";
fs.mkdirSync(out, { recursive: true });
const srv = await serve(8787);
const db = new FakeDB(60);
seed(db, "intro");
const ai = [];
const api = {
    ai: async (b) => {
        ai.push({ task: b.task, bytes: (b.audio || "").length });
        if (b.task === "voice") { fs.writeFileSync(out + "/answer-" + ai.length + ".wav", Buffer.from(b.audio, "base64")); return { heard: "مساء الخير", said: "الرياض", ok: true }; }
        if (b.task === "grade") return { ok: false };
        return {};
    }
};
const browser = await launch({ wav });
const res = { ok: true, steps: [] };
const step = (name, v) => { res.steps.push({ name, ok: !!v }); if (!v) res.ok = false; console.log((v ? "PASS " : "FAIL ") + name); };
try {
    const host = await device(browser, db, "host", { api });
    const p1 = await device(browser, db, "p1", { api });
    const p2 = await device(browser, db, "p2", { api });
    step("intro rendered", await until(() => p1.$(".lv-ready-btn"), 15000));
    await p1.screenshot({ path: out + "/01-intro-p1.png" });
    await p1.click(".lv-ready-btn"); await p2.click(".lv-ready-btn");
    step("talk scene", await until(() => liveDoc(db).scene === "talk", 8000));
    await sleep(1200);
    await host.screenshot({ path: out + "/02-talk-host.png" });
    await host.click("button.bc-go");
    step("playing", await until(() => liveDoc(db).scene === "playing" && liveDoc(db).phase === "buzz", 12000));
    await sleep(2500);
    await p1.screenshot({ path: out + "/03-question-p1.png" });
    /* زمن الرد المحلي: من الضغطة لأول رسمة فيها الجرس مضغوط */
    const local = await p1.evaluate(() => new Promise(res => {
        const b = document.getElementById("lvBell");
        const ev = new PointerEvent("pointerdown", { bubbles: true, cancelable: true });
        b.dispatchEvent(ev);
        requestAnimationFrame(() => res({ ms: Math.round(performance.now() - ev.timeStamp), rung: b.classList.contains("rung") }));
    }));
    res.bellLocal = local;
    step("bell local < 100ms", local.rung && local.ms < 100);
    step("answer phase p1", await until(() => liveDoc(db).phase === "answer" && liveDoc(db).answerer === 1, 5000));
    await sleep(700);
    await p2.screenshot({ path: out + "/04-buzz-p2.png" });
    await p1.screenshot({ path: out + "/05-recording-p1.png" });
    step("buzz diag written", await until(() => { const x = (db.data("room/main/liveDiag/round_2") || {}).bcDiag; return x && x.u_p1 && x.u_p1.buzz && x.u_p1.buzz.length && x.u_p1.buzz[0].seen > 0; }, 8000));
    step("reveal", await until(() => liveDoc(db).phase === "reveal", 20000));
    await sleep(2200);
    await host.screenshot({ path: out + "/06-reveal-host.png" });
    /* السؤال الثاني: الاثنين يضغطون مع بعض، واحد بس يفوز (transaction) */
    step("q2 buzz", await until(() => liveDoc(db).qIndex === 1 && liveDoc(db).phase === "buzz", 15000));
    await sleep(800);
    const press = p => p.evaluate(() => { const b = document.getElementById("lvBell"); if (b) b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true })); });
    await Promise.all([press(p1), press(p2)]);
    step("one winner", await until(() => liveDoc(db).phase === "answer" && liveDoc(db).tried1 !== liveDoc(db).tried2, 5000));
    step("loser diag", await until(() => { const x = (db.data("room/main/liveDiag/round_2") || {}).bcDiag || {}; const all = [].concat((x.u_p1 || {}).buzz || [], (x.u_p2 || {}).buzz || []).filter(b => b.q === "0_1"); return all.length === 2 && all.filter(b => b.won).length === 1; }, 8000));
    await host.click('button[aria-label="التشخيص"]');
    await sleep(500);
    await host.screenshot({ path: out + "/07-diag-host.png" });
    res.doc = (({ s1, s2, lastAnswer }) => ({ s1, s2, lastAnswer }))(liveDoc(db)); res.diag = db.data("room/main/liveDiag/round_2");
    res.ai = ai;
    for (const [n, p] of [["host", host], ["p1", p1], ["p2", p2]]) {
        const errs = p.__logs.filter(l => /PAGEERROR|error:/i.test(l) && !/Failed to load resource|ERR_FAILED|net::/.test(l));
        if (errs.length) { res.ok = false; res["errors_" + n] = errs.slice(0, 10); }
    }
} catch (e) { res.ok = false; res.err = String(e.stack || e); }
console.log(JSON.stringify(res, null, 1));
await browser.close(); srv.close();
process.exit(res.ok ? 0 : 1);
