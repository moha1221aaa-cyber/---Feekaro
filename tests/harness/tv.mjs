/* الإخراج التلفزيوني: صور لكل لحظة (الجرس، العداد الأخير، الكشف، لوحة النتيجة، الفاصل) من جهاز مشاهد ومتسابق،
   ونسخة prefers-reduced-motion، وفيديو من جهاز المتسابق الثاني.  node tests/harness/tv.mjs [مجلد] */
import { serve, FakeDB, seed, launch, device, until, sleep, liveDoc } from "./harness.mjs";
import fs from "node:fs";

const out = process.argv[2] || "/tmp/harness-tv";
fs.mkdirSync(out, { recursive: true });
const srv = await serve(8787);
const res = { ok: true, steps: [] };
const step = (name, v, extra) => { res.steps.push({ name, ok: !!v, extra }); if (!v) res.ok = false; console.log((v ? "PASS " : "FAIL ") + name + (extra ? " " + JSON.stringify(extra) : "")); };
const api = { ai: async b => b.task === "voice" ? { heard: "الرياض", said: "الرياض", ok: true } : { ok: false } };

/* أي حركة غير transform و opacity في الرسوم المتحركة الجديدة (tv-*) تعتبر غلط */
async function checkProps(page) {
    return page.evaluate(() => {
        const bad = [];
        for (const sh of document.styleSheets) {
            let rules; try { rules = sh.cssRules; } catch (e) { continue; }
            for (const r of rules) if (r.type === CSSRule.KEYFRAMES_RULE && /^(tv|bcTap|bcRipple)/.test(r.name)) {
                for (const k of r.cssRules) for (let i = 0; i < k.style.length; i++) { const p = k.style[i]; if (!/^(transform|opacity)$/.test(p)) bad.push(r.name + ":" + p); }
            }
        }
        return bad;
    });
}

for (const mode of ["full", "reduced"]) {
    const dir = out + "/" + mode; fs.mkdirSync(dir, { recursive: true });
    const db = new FakeDB(60);
    const now = Date.now();
    seed(db, "playing", { phase: "buzz", qIndex: 1, qAt: now, deadline: now + 9000, ready1: true, ready2: true, s1: 1, s2: 0, log: [1, -1, -1, -1, -1] });
    const browser = await launch({ wav: "speech.wav" });
    const opts = { api, reducedMotion: mode === "reduced" ? "reduce" : "no-preference" };
    const fan = await device(browser, db, "fan", opts);
    const p1 = await device(browser, db, "p1", opts);
    const p2 = await device(browser, db, "p2", Object.assign({ video: mode === "full" ? dir + "/video" : undefined }, opts));
    try {
        await until(() => p1.$("#lvBell"), 15000);
        if (mode === "full") step("only transform/opacity in new keyframes", (await checkProps(p1)).length === 0, await checkProps(p1));
        /* العداد الأخير: الوقت باقي 5 ث أو أقل */
        step("final countdown", await until(() => fan.evaluate(() => document.getElementById("liveScreen").classList.contains("tv-final")), 9000));
        await sleep(300);
        await fan.screenshot({ path: dir + "/1-final-countdown.png" });
        /* لحظة الجرس */
        await p1.evaluate(() => document.getElementById("lvBell").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true })));
        step("buzz band on viewer", await until(() => fan.$(".tv-buzz"), 3000));
        await sleep(450);
        await fan.screenshot({ path: dir + "/2-buzz-moment-viewer.png" });
        await p2.screenshot({ path: dir + "/2-buzz-moment-p2.png" });
        step("buzz band leaves", await until(async () => !(await fan.$(".tv-buzz")), 3000));
        /* الكشف: لوحة الجواب، ولوحة النتيجة بعد ثانيتين */
        step("reveal", await until(() => liveDoc(db).phase === "reveal", 15000));
        await sleep(500);
        await fan.screenshot({ path: dir + "/3-reveal-suspense.png" });
        await sleep(1500);
        await fan.screenshot({ path: dir + "/4-reveal-answer.png" });
        step("scoreboard", await until(() => fan.evaluate(() => { const b = document.getElementById("tvBoard"); return b && b.classList.contains("on"); }), 4000));
        await sleep(1100);
        await fan.screenshot({ path: dir + "/5-scoreboard.png" });
        res.board = await fan.evaluate(() => document.getElementById("tvBoard").innerText.replace(/\s+/g, " "));
        step("board hides before next q", await until(() => fan.evaluate(() => { const b = document.getElementById("tvBoard"); return !b.classList.contains("on"); }), 5000));
        /* الفاصل: ننهي المواجهة وننتقل للي بعدها */
        const d = liveDoc(db);
        db.write({ op: "update", path: "room/main/liveMatches/round_2", data: { scene: "result", phase: "done", sceneAt: Date.now(), order: d.order.map((o, i) => i === 0 ? Object.assign({}, o, { state: "done", s1: 3, s2: 1, applied: true }) : o) } });
        await sleep(1500);
        const d2 = liveDoc(db);
        db.write({ op: "update", path: "room/main/liveMatches/round_2", data: { scene: "intro", cur: 1, sceneAt: Date.now(), v: (d2.v || 0) + 1, ready1: false, ready2: false, s1: 0, s2: 0 } });
        step("bumper", await until(() => fan.$(".tv-bump"), 3000));
        await sleep(700);
        await fan.screenshot({ path: dir + "/6-bumper.png" });
        step("match intro after bumper", await until(() => fan.$(".cine"), 3000));
        await sleep(1800);
        await fan.screenshot({ path: dir + "/7-match-intro.png" });
        const errs = [fan, p1, p2].flatMap(p => p.__logs.filter(l => /PAGEERROR/.test(l)));
        step("no page errors", !errs.length, errs.slice(0, 5));
    } catch (e) { res.ok = false; res.err = String(e.stack || e); console.log(res.err); }
    await browser.close();
}
srv.close();
process.exit(res.ok ? 0 : 1);
