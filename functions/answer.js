/* أجوبة البث في السيرفر (SECURITY-PLAN.md الخطوة 1): الجواب الصحيح ما يطلع في وثيقة البث العامة، والتصحيح يصير هنا.
   POST /answer بجسم JSON فيه action:
   - seal:   المنظم بس (توكن Firebase بإيميله). يختم أجوبة الجولة قبل البث          { id, items: [{ text, answer }] } ← { items: [{ text, seal }] }
             وبعدها يختم أسئلة كل مواجهة كـ "صندوق" (عشان نص الأسئلة نفسه ما يتقرا من بداية البث)   { id, boxes: [json] } ← { boxes: [seal] }
   - open:   المنظم بس: يفتح صندوق أسئلة المواجهة الجاية (بدون أجوبة)   { id, m } ← { qs: [{ text, seal }], gold: [...] }
             (كان لغيره والمنظم غايب للطيار الآلي، والطيار انشال 23 أكتوبر، وشروطه من الوثيقة المفتوحة ممكن تتزوّر: فحص 25 أكتوبر البند 22)
   - grade:  انشال (410). من 23 أكتوبر المقدم يحكم، والتصحيح الصوتي كان يشغّل Whisper و ElevenLabs Scribe لأي متسابق مسجّل
             ويصرف من رصيد صوت المذيع (فحص 25 أكتوبر البند 20). lib/grading.js باقي لو رجع التصحيح الآلي.
   - reveal: المنظم بس (احتياط لو ما عنده liveSecrets). كان للكل حسب مرحلة البث، بس الوثيقة مفتوحة للكتابة فأي أحد يغيّر
             المرحلة ويفتح كل الأجوبة (تدقيق 21 أكتوبر). الحين جهاز المنظم يكتب الجواب في الوثيقة وقت الكشف (shown).   { id } ← { answers }
   GET /answer: هل الختم شغال (بدون أسرار).
   لو الختم مو متاح (ما فيه سر)، seal يرجع 503 والبث يكمل بالطريقة القديمة. */

import { verifyFirebaseToken, bearer } from "../lib/firebase-auth.js";
import { sealKey, seal, unseal } from "../lib/seal.js";
import { readPublicDoc } from "../lib/firestore-public.js";
import { clip } from "../lib/grading.js";

const ADMIN_EMAIL = "moha1221aaa@gmail.com"; /* نفسه في js/app.js و firestore.rules */
const LIMIT = { seal: 10, grade: 30, reveal: 90, open: 20 };
const ID_RE = /^round_[A-Za-z0-9_-]{1,40}$/;

const json = (status, obj, extra) => new Response(JSON.stringify(obj), {
  status, headers: Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, extra || {})
});

async function overLimit(request, url, action, who) {
  const slot = Math.floor(Date.now() / 60000);
  const key = new Request(url.origin + "/answer-rl/" + action + "/" + encodeURIComponent(who) + "/" + slot);
  const hit = await caches.default.match(key);
  const n = hit ? Number(await hit.text()) || 0 : 0;
  if (n >= (LIMIT[action] || 10)) return true;
  await caches.default.put(key, new Response(String(n + 1), { headers: { "Cache-Control": "max-age=70" } }));
  return false;
}

const liveDoc = (id, f) => readPublicDoc("room/main/liveMatches/" + id, f);

/* ===== seal ===== */
async function doSeal(env, b, user) {
  if (!user || String(user.email || "").toLowerCase() !== ADMIN_EMAIL) return json(403, { error: "للمنظم بس" });
  const key = await sealKey(env);
  if (!key) return json(503, { error: "الختم مو مضبوط في السيرفر" });
  if (!ID_RE.test(String(b.id || ""))) return json(400, { error: "bad id" });
  if (Array.isArray(b.boxes)) {
    const boxes = [];
    for (let i = 0; i < Math.min(b.boxes.length, 60); i++) {
      const t = String(b.boxes[i] || "");
      if (!t || t.length > 20000) return json(400, { error: "bad box" });
      boxes.push(await seal(key, b.id, "\u0001box" + i, t));
    }
    return json(200, { boxes });
  }
  const items = Array.isArray(b.items) ? b.items.slice(0, 300) : [];
  const out = [];
  for (const it of items) {
    const text = clip(it && it.text, 200), answer = clip(it && it.answer, 160);
    if (!text || !answer) return json(400, { error: "سؤال بدون نص أو جواب" });
    out.push({ text, seal: await seal(key, b.id, text, answer) });
  }
  return json(200, { items: out });
}

/* ===== open ===== */
async function doOpen(env, b, user) {
  const id = String(b.id || ""), m = Number(b.m);
  if (!ID_RE.test(id) || !(m >= 0 && m < 40)) return json(400, { error: "bad id" });
  const d = await liveDoc(id);
  if (!d || d.status !== "live") return json(409, { error: "البث مو شغال" });
  const order = Array.isArray(d.order) ? d.order : [];
  const it = order[m];
  if (!it || !(it.box || it.boxed)) return json(404, { error: "ما فيه صندوق" });
  if (String(user.email || "").toLowerCase() !== ADMIN_EMAIL) return json(403, { error: "للمنظم بس" });
  const key = await sealKey(env);
  /* الصناديق في room/main/liveBoxes/<id> (وثيقة البث فيها boxed بس)، والوثائق القديمة فيها box نفسه */
  let sealed = it.box;
  if (!sealed) { const bd = await readPublicDoc("room/main/liveBoxes/" + id); sealed = bd && Array.isArray(bd.boxes) ? bd.boxes[m] : null; }
  if (!sealed) return json(404, { error: "ما فيه صندوق" });
  const raw = key ? await unseal(key, id, "\u0001box" + m, sealed) : null;
  if (!raw) return json(500, { error: "ما قدرت أفتح الأسئلة" });
  let box; try { box = JSON.parse(raw); } catch (e) { return json(500, { error: "bad box" }); }
  return json(200, { qs: box.qs || [], gold: box.gold || [] });
}

/* ===== reveal ===== */
async function doReveal(context, env, b, user) {
  if (!user || String(user.email || "").toLowerCase() !== ADMIN_EMAIL) return json(403, { error: "للمنظم بس" });
  const id = String(b.id || "");
  if (!ID_RE.test(id)) return json(400, { error: "bad id" });
  const d = await liveDoc(id);
  if (!d) return json(404, { error: "ما فيه بث" });
  const qs = Array.isArray(d.questions) ? d.questions : [];
  const qi = Number(d.qIndex) || 0;
  /* السؤال الحالي ينكشف بعد مرحلة الكشف أو نهاية المواجهة، واللي قبله منكشف أصلاً */
  const curOpen = (d.scene === "playing" && d.phase === "reveal") || d.scene === "result" || d.scene === "closing" || d.status === "ended" || d.phase === "done";
  const key = await sealKey(env);
  const answers = {};
  for (let i = 0; i < qs.length; i++) {
    if (i > qi || (i === qi && !curOpen)) continue;
    const q = qs[i] || {};
    let a = typeof q.answer === "string" ? q.answer : "";
    if (!a && q.seal && key) a = (await unseal(key, id, q.text || "", q.seal)) || "";
    if (a) answers[i] = a.split("|")[0];
  }
  return json(200, { answers, qIndex: qi });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const from = request.headers.get("Origin") || request.headers.get("Referer") || "";
  try { if (!from || new URL(from).host !== url.host) return json(403, { error: "forbidden" }); } catch (e) { return json(403, { error: "forbidden" }); }
  let b;
  try { b = await request.json(); } catch (e) { return json(400, { error: "bad body" }); }
  const action = b && b.action;
  if (["seal", "grade", "reveal", "open"].indexOf(action) === -1) return json(400, { error: "unknown action" });
  if (action === "grade") return json(410, { error: "التصحيح الآلي انشال: المقدم يحكم" });
  const user = await verifyFirebaseToken(bearer(request));
  if (!user) return json(401, { error: "سجّل دخول" });
  const who = user.uid;
  if (await overLimit(request, url, action, who)) return json(429, { error: "كثرت الطلبات، جرّب بعد دقيقة" });
  try {
    if (action === "seal") return await doSeal(env, b, user);
    if (action === "open") return await doOpen(env, b, user);
    return await doReveal(context, env, b, user);
  } catch (e) {
    return json(502, { error: String((e && e.message) || e).slice(0, 200) });
  }
}

export async function onRequestGet(context) {
  return json(200, { ok: true, sealing: !!(await sealKey(context.env)) });
}
