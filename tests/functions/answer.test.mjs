/* functions/answer.js: الختم، والتصحيح في السيرفر (مين يحق له، والوقت، وأول حكم ينحسب)، والكشف بعد وقته بس.
   وثيقة البث من Firestore وهمية (fetch محلي)، والتوكن موقّع بمفتاح تجريبي. */
import { setupAuth, fakeCaches, ctxFor, runFn, readNdjson, check, done } from "./helpers.mjs";
import { onRequestPost, onRequestGet } from "../../functions/answer.js";
import { sealKey, unseal } from "../../lib/seal.js";

const auth = await setupAuth(); fakeCaches();
const env = { AGORA_APP_CERTIFICATE: "0123456789abcdef0123456789abcdef", AI: { run: async (model, input) => {
    if (model.includes("whisper")) return { text: "امم الرياض" };
    const sys = input.messages[0].content;
    if (sys.indexOf("طلّع أول جواب") !== -1) return { response: '{"said":"الرياض"}' };
    return { response: '{"ok":false}' };
} } };
const ID = "round_7";
let DOC = null;
/* وثيقة Firestore REST من object عادي */
const enc = v => v === null || v === undefined ? { nullValue: null } : typeof v === "string" ? { stringValue: v } : typeof v === "boolean" ? { booleanValue: v }
    : typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } }
    : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
let reads = 0;
auth.routes.push({ match: u => u.startsWith("https://firestore.googleapis.com/"), handle: async u => {
    reads++;
    if (!DOC || !u.includes("/liveMatches/" + ID + "?")) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify({ fields: enc(DOC).mapValue.fields }));
} });
const post = async (body, tok) => runFn(onRequestPost, (new Request("https://masro7-league.pages.dev/answer", { method: "POST",
    headers: Object.assign({ Origin: "https://masro7-league.pages.dev", "Content-Type": "application/json" }, tok ? { Authorization: "Bearer " + tok } : {}), body: JSON.stringify(body) })), env);
const admin = await auth.token("u_admin", "moha1221aaa@gmail.com"), p1 = await auth.token("u_p1"), p2 = await auth.token("u_p2");

/* --- seal --- */
check("GET reports sealing on", (await (await onRequestGet({ env })).json()).sealing === true);
check("GET sealing off without secret", (await (await onRequestGet({ env: {} })).json()).sealing === false);
check("seal: player refused (403)", (await post({ action: "seal", id: ID, items: [{ text: "س", answer: "ج" }] }, p1)).status === 403);
check("seal: no login (401)", (await post({ action: "seal", id: ID, items: [] })).status === 401);
const sr = await post({ action: "seal", id: ID, items: [{ text: "ما عاصمة السعودية؟", answer: "الرياض|رياض" }, { text: "كم عدد قارات العالم؟", answer: "7|سبعة" }] }, admin);
const sealed = (await sr.json()).items;
check("seal: admin gets sealed items", sr.status === 200 && sealed.length === 2 && sealed.every(x => /^v1\./.test(x.seal)));
check("seal: answer not in sealed output", !JSON.stringify(sealed).includes("الرياض"));
const key = await sealKey(env);
check("unseal roundtrip", await unseal(key, ID, sealed[0].text, sealed[0].seal) === "الرياض|رياض");
check("unseal: other question → null", await unseal(key, ID, sealed[1].text, sealed[0].seal) === null);
check("unseal: other broadcast → null", await unseal(key, "round_8", sealed[0].text, sealed[0].seal) === null);
const t = sealed[0].seal; const tampered = t.slice(0, -3) + (t.slice(-3) === "AAA" ? "BBB" : "AAA");
check("unseal: tampered → null", await unseal(key, ID, sealed[0].text, tampered) === null);
check("seal 503 without secret", (await onRequestPost(ctxFor(new Request("https://masro7-league.pages.dev/answer", { method: "POST", headers: { Origin: "https://masro7-league.pages.dev", Authorization: "Bearer " + admin }, body: JSON.stringify({ action: "seal", id: ID, items: [{ text: "a", answer: "b" }] }) }), {}))).status === 503);

/* --- grade --- */
const now = Date.now();
const base = () => ({ type: "round", status: "live", scene: "playing", phase: "answer", cur: 0, qIndex: 0, answerer: 1, passed: false, deadline: now + 10000,
    order: [{ p1: "سعد", p2: "فهد", uid1: "u_p1", uid2: "u_p2" }], questions: sealed.map(x => ({ text: x.text, seal: x.seal })) });
DOC = base();
check("grade: other player refused (403)", (await post({ action: "grade", id: ID, qIndex: 0, given: "الرياض" }, p2)).status === 403);
check("grade: wrong qIndex (409)", (await post({ action: "grade", id: ID, qIndex: 1, given: "الرياض" }, p1)).status === 409);
let r = await post({ action: "grade", id: ID, qIndex: 0, given: "جدة" }, p1);
let j = await r.json();
check("grade: wrong typed answer → ok:false (AI asked)", r.status === 200 && j.ok === false, j);
r = await post({ action: "grade", id: ID, qIndex: 0, given: "الرياض" }, p1); j = await r.json();
check("grade: second try in same turn returns first verdict", j.ok === false && j.repeat === true && j.given === "جدة", j);
DOC = Object.assign(base(), { answerer: 2, passed: true });
r = await post({ action: "grade", id: ID, qIndex: 0, given: "رياض" }, p2); j = await r.json();
check("grade: passed turn (p2) correct alt → ok:true", j.ok === true && !j.repeat, j);
DOC = Object.assign(base(), { phase: "buzz" });
check("grade: not answer phase (409)", (await post({ action: "grade", id: ID, qIndex: 0, given: "الرياض" }, p1)).status === 409);
DOC = Object.assign(base(), { deadline: now - 5000 });
check("grade: time over (409)", (await post({ action: "grade", id: ID, qIndex: 0, given: "الرياض" }, p1)).status === 409);
DOC = Object.assign(base(), { qIndex: 1, questions: [{ text: "x", seal: sealed[0].seal }, { text: "كم عدد قارات العالم؟", answer: "7|سبعة" }] });
r = await post({ action: "grade", id: ID, qIndex: 1, given: "سبعه" }, p1); j = await r.json();
check("grade: legacy plaintext doc still graded on server", j.ok === true, j);
/* متسابق ثالث (ما أخذ حكم على هالسؤال) يجاوب بالصوت */
const p3 = await auth.token("u_p3");
DOC = Object.assign(base(), { order: [{ uid1: "u_p3", uid2: "u_p2" }] });
const audio = Buffer.alloc(4000, 1).toString("base64");
const lines = await readNdjson(await post({ action: "grade", id: ID, qIndex: 0, audio, stream: true }, p3));
check("grade voice stream: heard then verdict", lines[0].heard === "امم الرياض" && lines[1].final && lines[1].ok === true && lines[1].said === "الرياض", lines);

/* المتسابق نفسه ما يقدر يجرّب مرة ثانية حتى لو انعبث بحقول الدور (passed/cur) */
DOC = Object.assign(base(), { passed: true, cur: 0, order: [{ uid1: "u_p1", uid2: "u_p2" }] });
r = await post({ action: "grade", id: ID, qIndex: 0, given: "الرياض" }, p1); j = await r.json();
check("grade: tampered turn fields don't reset the first verdict", j.repeat === true && j.ok === false, j);

/* --- reveal: للمنظم بس (الوثيقة مفتوحة، فمراحلها ما تنصدّق) --- */
DOC = Object.assign(base(), { qIndex: 1, phase: "reveal" });
check("reveal: guest refused (401)", (await post({ action: "reveal", id: ID })).status === 401);
check("reveal: player refused even if doc says reveal (403)", (await post({ action: "reveal", id: ID }, p1)).status === 403);
j = await (await post({ action: "reveal", id: ID }, admin)).json();
check("reveal: admin gets revealed answers (first alt)", j.answers["0"] === "الرياض" && j.answers["1"] === "7", j);

/* --- طول الختم ثابت مهما كان طول الجواب --- */
const sl = await (await post({ action: "seal", id: ID, items: [{ text: "ق1", answer: "7" }, { text: "ق2", answer: "عبدالرحمن بن عوف|عبد الرحمن بن عوف" }] }, admin)).json();
check("seal length doesn't leak answer length", sl.items[0].seal.length === sl.items[1].seal.length, sl.items.map(x => x.seal.length));

/* --- المحاولات المتوازية: وحدة بس تتصحح --- */
const p4 = await auth.token("u_p4");
DOC = Object.assign(base(), { order: [{ uid1: "u_p4", uid2: "u_p2" }] });
/* طلبات ورا بعض بفرق بسيط (اللي يجي والأول للحين يتصحح ينرفض). نفس اللحظة بالضبط ممكن يعدّي: يحتاج تخزين ذرّي (مكتوب في SECURITY-PLAN) */
let slowAI = env.AI.run; env.AI.run = async (m, i) => { await new Promise(r => setTimeout(r, 80)); return slowAI(m, i); };
const par = await Promise.all([0, 30, 60].map(ms => new Promise(r => setTimeout(r, ms)).then(() => post({ action: "grade", id: ID, qIndex: 0, given: "جدة" }, p4)).then(r => r.status)));
env.AI.run = slowAI;
check("staggered grading: one graded, the rest refused", par.filter(x => x === 200).length === 1 && par.filter(x => x === 409).length === 2, par);
/* --- open: صندوق أسئلة المواجهة الجاية --- */
const box = (await (await post({ action: "seal", id: ID, boxes: [JSON.stringify({ qs: [{ text: "م1", seal: "x" }], gold: [] }), JSON.stringify({ qs: [{ text: "م2 سؤال", seal: "y" }], gold: [{ text: "ذهبي", seal: "z" }] })] }, admin)).json()).boxes;
check("seal boxes (admin)", box.length === 2 && box.every(b => /^v1\./.test(b)) && !JSON.stringify(box).includes("م2"));
check("seal boxes refused for player", (await post({ action: "seal", id: ID, boxes: ["{}"] }, p1)).status === 403);
const od = (extra) => Object.assign({ type: "round", status: "live", scene: "result", cur: 0, hostSeen: Date.now() - 60000,
    order: [{ state: "done", box: box[0] }, { state: "pending", box: box[1] }] }, extra || {});
DOC = od();
j = await (await post({ action: "open", id: ID, m: 1 }, p1)).json();
check("open: autopilot (host gone, next match) gets texts", j.qs && j.qs[0].text === "م2 سؤال" && j.gold[0].text === "ذهبي", j);
DOC = od({ hostSeen: Date.now() - 2000 });
check("open: refused while host is present", (await post({ action: "open", id: ID, m: 1 }, p1)).status === 403);
DOC = od({ order: [{ state: "pending", box: box[0] }, { state: "pending", box: box[1] }], cur: -1, scene: "opening" });
check("open: refused for a match that is not next", (await post({ action: "open", id: ID, m: 1 }, p1)).status === 409);
DOC = od({ scene: "playing" });
check("open: refused mid-match", (await post({ action: "open", id: ID, m: 1 }, p1)).status === 409);
DOC = od({ hostSeen: Date.now(), scene: "playing" });
check("open: admin any time", (await (await post({ action: "open", id: ID, m: 1 }, admin)).json()).qs[0].text === "م2 سؤال");
check("open: guest refused (401)", (await post({ action: "open", id: ID, m: 1 })).status === 401);

check("bad origin refused", (await onRequestPost(ctxFor(new Request("https://masro7-league.pages.dev/answer", { method: "POST", headers: { Origin: "https://evil.example" }, body: "{}" }), env))).status === 403);
auth.restore(); done();
