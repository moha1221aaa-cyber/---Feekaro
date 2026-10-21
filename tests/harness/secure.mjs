/* الأجوبة المختومة من البداية للنهاية: الكود الحقيقي في 3 أجهزة + functions/answer.js الحقيقي (يشتغل هنا في Node)
   + قاعدة وهمية (Firestore REST للسيرفر يقرا من نفس القاعدة). ما فيه أي اتصال بالخدمات الحقيقية.
   يتأكد: الجواب ما يطلع في الوثيقة العامة ولا عند المشاهدين قبل الكشف، والتصحيح في السيرفر، والغش ينرفض.
   node tests/harness/secure.mjs [مجلد] */
import fs from "node:fs";
import { serve, FakeDB, seed, launch, device, until, sleep, liveDoc } from "./harness.mjs";
import { setupAuth, fakeCaches } from "../functions/helpers.mjs";
import { onRequestPost as answerPost } from "../../functions/answer.js";

const out = process.argv[2] || "/tmp/harness-secure";
fs.mkdirSync(out, { recursive: true });
let ok = true;
const check = (name, v, extra) => { console.log((v ? "PASS " : "FAIL ") + name + (extra !== undefined ? " " + JSON.stringify(extra).slice(0, 300) : "")); if (!v) ok = false; };

const auth = await setupAuth(); fakeCaches();
const db = new FakeDB(40);
seed(db, "intro");
db.docs.delete("room/main/liveMatches/round_2");   /* المنظم يبدأ البث بنفسه من الواجهة */
const enc = v => v === null || v === undefined ? { nullValue: null } : typeof v === "string" ? { stringValue: v } : typeof v === "boolean" ? { booleanValue: v }
    : typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } }
    : (v && typeof v.__ts === "number") ? { timestampValue: new Date(v.__ts).toISOString() }
    : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
auth.routes.push({ match: u => u.startsWith("https://firestore.googleapis.com/"), handle: async u => {
    const path = decodeURIComponent(u.split("/documents/")[1].split("?")[0]);
    const d = db.data(path);
    return d ? new Response(JSON.stringify({ fields: enc(d).mapValue.fields })) : new Response("{}", { status: 404 });
} });
const truth = {};   /* نص السؤال ← الجواب (من طلب الختم نفسه، عشان الذكاء الوهمي يعرف وش يقول) */
/* NO_SEAL=1: تجربة عكسية (بدون سر الختم = الطريقة القديمة)، لازم يفشل فحص التسريب */
const env = { AGORA_APP_CERTIFICATE: process.env.NO_SEAL ? "" : "test-secret-0123456789abcdef", AI: { run: async (model, input) => {
    if (model.includes("whisper")) return { text: "امم الجواب" };
    const m = /السؤال: (.*)\n/.exec(input.messages[1].content);
    const sys = input.messages[0].content;
    if (sys.indexOf("طلّع أول جواب") !== -1) return { response: JSON.stringify({ said: String(truth[m && m[1]] || "").split("|")[0] }) };
    return { response: '{"ok":false}' };
} } };
const tokens = { host: await auth.token("u_host", "moha1221aaa@gmail.com"), p1: await auth.token("u_p1"), p2: await auth.token("u_p2"), fan: await auth.token("u_fan") };
const calls = [];
async function callAnswer(body, who) {
    if (body.action === "seal") (body.items || []).forEach(x => { truth[x.text] = x.answer; });
    calls.push({ who, action: body.action });
    const pending = [];
    const req = new Request("http://127.0.0.1:8787/answer", { method: "POST", body: JSON.stringify(body),
        headers: Object.assign({ Origin: "http://127.0.0.1:8787", "Content-Type": "application/json" }, who && tokens[who] ? { Authorization: "Bearer " + tokens[who] } : {}) });
    const res = await answerPost({ request: req, env, waitUntil: p => pending.push(p) });
    const text = await res.text();
    await Promise.all(pending);
    return { status: res.status, contentType: res.headers.get("Content-Type"), body: text };
}
const api = {
    answer: async (b, info) => ({ raw: await callAnswer(b, info.headers.authorization ? info.who : "") }),
    ai: async b => (b.task === "host" ? { open: "", intros: [], close: "" } : { ok: false })
};
const srv = await serve(8787);
const browser = await launch({ wav: "speech.wav" });
try {
    const host = await device(browser, db, "host", { api, live: "none" });
    await until(() => host.evaluate(() => typeof bcStartRound === "function" && !!currentUser && isAdmin && matches.length > 0), 10000);
    await host.evaluate(() => { bcStartRound(2); });
    await until(() => host.$('.bc-ask [data-a="now"]'), 5000);
    await host.click('.bc-ask [data-a="now"]');
    check("broadcast created", await until(() => liveDoc(db) && liveDoc(db).status === "live", 10000));
    const d0 = liveDoc(db);
    const answers = Object.values(truth).flatMap(a => a.split("|")).filter(a => a.length >= 2);
    /* كلمة كاملة بس (عشان "ين" ما ينحسب داخل "المتسابقين"، و 206 داخل وقت)، والختم نفسه نشيله لأنه حروف عشوائية */
    const esc = a => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const leaks = doc => {
        const j = (typeof doc === "string" ? doc : JSON.stringify(doc)).replace(/\\?"seal\\?":\\?"[^"\\]*\\?"/g, "");
        return answers.filter(a => new RegExp("(^|[^\\p{L}\\p{N}])" + esc(a) + "([^\\p{L}\\p{N}]|$)", "u").test(j));
    };
    check("every match has 5 sealed + 3 golden", d0.order.every(o => o.qs && o.qs.length === 5 && o.gold && o.gold.length === 3 && o.qs.concat(o.gold).every(q => /^v1\./.test(q.seal) && !q.answer)));
    check("no answer anywhere in the public doc", leaks(d0).length === 0, leaks(d0));
    const sec = await until(() => db.data("liveSecrets/round_2"), 5000);
    check("host kept the answers in liveSecrets (admin-only)", !!sec && d0.order.every(o => o.qs.concat(o.gold).every(q => !!sec.answers[q.text])));
    await host.goto("http://127.0.0.1:8787/index.html?as=host&live=round_2");
    const p1 = await device(browser, db, "p1", { api }), p2 = await device(browser, db, "p2", { api }), fan = await device(browser, db, "fan", { api });
    await until(() => host.$("button.bc-go"), 8000);
    await host.click("button.bc-go");   /* ابدأ المواجهة الأولى */
    await until(() => p1.$(".lv-ready-btn"), 10000);
    await p1.click(".lv-ready-btn"); await p2.click(".lv-ready-btn");
    await until(() => liveDoc(db).scene === "talk", 6000);
    await sleep(800);
    await host.click("button.bc-go");
    check("question live", await until(() => liveDoc(db).scene === "playing" && liveDoc(db).phase === "buzz", 12000));
    await sleep(800);
    const fanCache = await fan.evaluate(() => JSON.stringify(liveMatchesCache));
    check("viewer device never has the answer during the question", leaks(fanCache).length === 0, leaks(fanCache));
    await p1.evaluate(() => document.getElementById("lvBell").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true })));
    await until(() => liveDoc(db).phase === "answer", 5000);
    /* غش: المتسابق الثاني يحاول يصحح جواب على دور غيره */
    const cheat = await p2.evaluate(() => answerPost({ action: "grade", id: "round_2", qIndex: 0, given: "أي شي" }).then(() => "accepted", e => String(e.status)));
    check("other player cannot grade (403)", cheat === "403", cheat);
    await fan.screenshot({ path: out + "/1-answering-viewer.png" });
    check("voice answer graded on server and committed", await until(() => liveDoc(db).phase === "reveal", 15000));
    const la = liveDoc(db).lastAnswer;
    check("server verdict: correct", la && la.correct === true, la);
    const qText = liveDoc(db).questions[0].text;
    check("voice went to /answer (not /ai)", calls.some(c => c.action === "grade" && c.who === "p1"));
    /* بعد ما انحكم: المتسابق يحاول يصحح مرة ثانية بجواب ثاني */
    const again = await p1.evaluate(() => answerPost({ action: "grade", id: "round_2", qIndex: 0, given: "غلط" }).then(r => r, e => ({ status: e.status })));
    check("no second grading after the turn ended", again.status === 409 || again.repeat === true, again);
    const shown = await until(() => fan.evaluate(() => { const a = document.querySelector(".st-reveal:not(.hold) .lv-reveal .a"); return a && a.textContent !== "…" ? a.textContent : ""; }), 6000);
    check("viewer sees the right answer after the reveal", shown === truth[qText].split("|")[0], { shown, want: truth[qText] });
    await sleep(300);
    await fan.screenshot({ path: out + "/2-reveal-viewer.png" });
    const errs = [host, p1, p2, fan].flatMap(p => p.__logs.filter(l => /PAGEERROR/.test(l)));
    check("no page errors", !errs.length, errs);
} catch (e) { ok = false; console.log(e.stack || e); }
await browser.close(); srv.close(); auth.restore();
process.exit(ok ? 0 : 1);
