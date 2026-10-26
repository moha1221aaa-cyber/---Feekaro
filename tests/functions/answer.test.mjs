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
let DOC = null, BOXES = null;
/* وثيقة Firestore REST من object عادي */
const enc = v => v === null || v === undefined ? { nullValue: null } : typeof v === "string" ? { stringValue: v } : typeof v === "boolean" ? { booleanValue: v }
    : typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } }
    : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
let reads = 0;
auth.routes.push({ match: u => u.startsWith("https://firestore.googleapis.com/"), handle: async u => {
    reads++;
    if (BOXES && u.includes("/liveBoxes/" + ID + "?")) return new Response(JSON.stringify({ fields: enc(BOXES).mapValue.fields }));
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

/* --- grade: انشال 26 أكتوبر 2026 (المقدم يحكم من 23 أكتوبر، وكان يصرف رصيد السمع لأي حساب: فحص 25 أكتوبر البند 20) --- */
const now = Date.now();
const base = () => ({ type: "round", status: "live", scene: "playing", phase: "answer", cur: 0, qIndex: 0, answerer: 1, passed: false, deadline: now + 10000,
    order: [{ p1: "سعد", p2: "فهد", uid1: "u_p1", uid2: "u_p2" }], questions: sealed.map(x => ({ text: x.text, seal: x.seal })) });
DOC = base();
let aiCalls = 0; const realRun = env.AI.run; env.AI.run = async (m, i) => { aiCalls++; return realRun(m, i); };
const readsBefore = reads;
const audio = Buffer.alloc(4000, 1).toString("base64");
let r = await post({ action: "grade", id: ID, qIndex: 0, given: "الرياض" }, p1);
check("grade: gone (410) for the player on turn", r.status === 410);
check("grade: voice gone too (410), nothing heard", (await post({ action: "grade", id: ID, qIndex: 0, audio, stream: true }, p1)).status === 410);
check("grade: gone even without login (410)", (await post({ action: "grade", id: ID, qIndex: 0, given: "x" })).status === 410);
check("grade: no AI and no Firestore read", aiCalls === 0 && reads === readsBefore, { aiCalls, reads: reads - readsBefore });
env.AI.run = realRun;
let j;

/* --- reveal: للمنظم بس (الوثيقة مفتوحة، فمراحلها ما تنصدّق) --- */
DOC = Object.assign(base(), { qIndex: 1, phase: "reveal" });
check("reveal: guest refused (401)", (await post({ action: "reveal", id: ID })).status === 401);
check("reveal: player refused even if doc says reveal (403)", (await post({ action: "reveal", id: ID }, p1)).status === 403);
j = await (await post({ action: "reveal", id: ID }, admin)).json();
check("reveal: admin gets revealed answers (first alt)", j.answers["0"] === "الرياض" && j.answers["1"] === "7", j);

/* --- طول الختم ثابت مهما كان طول الجواب --- */
const sl = await (await post({ action: "seal", id: ID, items: [{ text: "ق1", answer: "7" }, { text: "ق2", answer: "عبدالرحمن بن عوف|عبد الرحمن بن عوف" }] }, admin)).json();
check("seal length doesn't leak answer length", sl.items[0].seal.length === sl.items[1].seal.length, sl.items.map(x => x.seal.length));

/* --- open: صندوق أسئلة المواجهة الجاية --- */
const box = (await (await post({ action: "seal", id: ID, boxes: [JSON.stringify({ qs: [{ text: "م1", seal: "x" }], gold: [] }), JSON.stringify({ qs: [{ text: "م2 سؤال", seal: "y" }], gold: [{ text: "ذهبي", seal: "z" }] })] }, admin)).json()).boxes;
check("seal boxes (admin)", box.length === 2 && box.every(b => /^v1\./.test(b)) && !JSON.stringify(box).includes("م2"));
check("seal boxes refused for player", (await post({ action: "seal", id: ID, boxes: ["{}"] }, p1)).status === 403);
const od = (extra) => Object.assign({ type: "round", status: "live", scene: "result", cur: 0, hostSeen: Date.now() - 60000,
    order: [{ state: "done", box: box[0] }, { state: "pending", box: box[1] }] }, extra || {});
DOC = od();
/* البند 22 في فحص 25 أكتوبر: الطيار الآلي انشال، وشروطه (hostSeen و scene) من وثيقة مفتوحة للكتابة، فالمتسابق ما يفتح صندوق أبد */
check("open: player refused even when the doc says host gone + next match (403)", (await post({ action: "open", id: ID, m: 1 }, p1)).status === 403);
DOC = od({ hostSeen: Date.now() - 2000 });
check("open: player refused while host is present (403)", (await post({ action: "open", id: ID, m: 1 }, p1)).status === 403);
DOC = od({ hostSeen: Date.now(), scene: "playing" });
check("open: admin any time", (await (await post({ action: "open", id: ID, m: 1 }, admin)).json()).qs[0].text === "م2 سؤال");
check("open: guest refused (401)", (await post({ action: "open", id: ID, m: 1 })).status === 401);
/* الصناديق في وثيقة liveBoxes/<id> لحالها (وثيقة البث فيها boxed بس) */
BOXES = { boxes: box };
DOC = od({ order: [{ state: "done", boxed: true }, { state: "pending", boxed: true }] });
j = await (await post({ action: "open", id: ID, m: 1 }, admin)).json();
check("open: box from liveBoxes doc", j.qs && j.qs[0].text === "م2 سؤال", j);
BOXES = null;
check("open: boxed but no boxes doc → 404", (await post({ action: "open", id: ID, m: 1 }, admin)).status === 404);

check("bad origin refused", (await onRequestPost(ctxFor(new Request("https://masro7-league.pages.dev/answer", { method: "POST", headers: { Origin: "https://evil.example" }, body: "{}" }), env))).status === 403);
auth.restore(); done();
