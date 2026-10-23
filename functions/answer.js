/* أجوبة البث في السيرفر (SECURITY-PLAN.md الخطوة 1): الجواب الصحيح ما يطلع في وثيقة البث العامة، والتصحيح يصير هنا.
   POST /answer بجسم JSON فيه action:
   - seal:   المنظم بس (توكن Firebase بإيميله). يختم أجوبة الجولة قبل البث          { id, items: [{ text, answer }] } ← { items: [{ text, seal }] }
             وبعدها يختم أسئلة كل مواجهة كـ "صندوق" (عشان نص الأسئلة نفسه ما يتقرا من بداية البث)   { id, boxes: [json] } ← { boxes: [seal] }
   - open:   يفتح صندوق أسئلة المواجهة الجاية (بدون أجوبة). للمنظم دايماً، ولغيره بس والمنظم غايب (الطيار الآلي)
             والمواجهة هي فعلاً الجاية حسب الوثيقة   { id, m } ← { qs: [{ text, seal }], gold: [...] }
   - grade:  المتسابق اللي عليه الدور بس. السيرفر يقرا وثيقة البث بنفسه (Firestore REST، قراءة عامة) ويتأكد:
             البث شغال، المرحلة جواب، رقم السؤال نفسه، والتوكن لنفس المتسابق اللي ضغط الجرس (أو انتقل له السؤال)، والوقت ما خلص.
             بعدها يفتح الختم ويصحح: كتابة (مطابقة ثم ذكاء اصطناعي) أو صوت (Whisper ثم استخراج الجواب ثم الحكم)
             { id, qIndex, given } أو { id, qIndex, audio, stream? } ← { ok, heard?, said? }
             أول حكم هو اللي ينحسب: كل متسابق ياخذ حكم واحد لكل سؤال (يرجع نفسه لو انعاد)، عشان محد يجرّب أجوبة لين يصيب.
   - reveal: المنظم بس (احتياط لو ما عنده liveSecrets). كان للكل حسب مرحلة البث، بس الوثيقة مفتوحة للكتابة فأي أحد يغيّر
             المرحلة ويفتح كل الأجوبة (تدقيق 21 أكتوبر). الحين جهاز المنظم يكتب الجواب في الوثيقة وقت الكشف (shown).   { id } ← { answers }
   GET /answer: هل الختم شغال (بدون أسرار).
   لو الختم مو متاح (ما فيه سر)، seal يرجع 503 والبث يكمل بالطريقة القديمة. */

import { verifyFirebaseToken, bearer } from "../lib/firebase-auth.js";
import { sealKey, seal, unseal } from "../lib/seal.js";
import { readPublicDoc } from "../lib/firestore-public.js";
import { clip, answerMatches, taskGrade, audioOf, taskVoice } from "../lib/grading.js";

const ADMIN_EMAIL = "moha1221aaa@gmail.com"; /* نفسه في js/app.js و firestore.rules */
const LIMIT = { seal: 10, grade: 30, reveal: 90, open: 20 };
const ID_RE = /^round_[A-Za-z0-9_-]{1,40}$/;
const GRACE_MS = 3000; /* سماحية بعد نهاية الوقت (الشبكة) */

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
const cur = d => (Array.isArray(d.order) && d.cur >= 0 ? d.order[d.cur] : null) || null;

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

/* ===== grade ===== */
async function doGrade(context, env, b, user) {
  const id = String(b.id || "");
  if (!user) return json(401, { error: "سجّل دخول" });
  if (!ID_RE.test(id)) return json(400, { error: "bad id" });
  /* قفل سريع قبل أي شي (قبل قراءة الوثيقة) عشان الطلبات ورا بعض ما تتصحح كلها. كاش Cloudflare ما فيه "اكتب لو ما هو موجود"،
     فطلبين بنفس اللحظة بالضبط ممكن يعدّون. القفل الكامل يحتاج Durable Object أو KV (SECURITY-PLAN) */
  const lock = new Request(new URL(context.request.url).origin + "/answer-lock/" + [id, Number(b.qIndex) || 0, user.uid].map(encodeURIComponent).join("/"));
  if (await caches.default.match(lock)) return json(409, { error: "جوابك قيد التصحيح" });
  await caches.default.put(lock, new Response("1", { headers: { "Cache-Control": "max-age=12" } }));
  try { return await doGradeLocked(context, env, b, user, id); }
  finally { context.waitUntil(caches.default.delete(lock)); }
}
async function doGradeLocked(context, env, b, user, id) {
  const d = await liveDoc(id);
  const now = Date.now();
  if (!d || d.status !== "live" || d.scene !== "playing" || d.phase !== "answer") return json(409, { error: "مو وقت جواب" });
  if (Number(b.qIndex) !== d.qIndex) return json(409, { error: "سؤال ثاني" });
  const o = cur(d), n = d.answerer;
  if (!o || !(n === 1 || n === 2) || o["uid" + n] !== user.uid) return json(403, { error: "مو دورك" });
  if (now > Number(d.deadline || 0) + GRACE_MS) return json(409, { error: "خلص الوقت" });
  const q = (Array.isArray(d.questions) ? d.questions : [])[d.qIndex] || {};
  /* المختوم أول: لو فيه ختم ما نصدّق أي answer في الوثيقة (ممكن أحد حطه) */
  let answer = "";
  if (q.seal) {
    const key = await sealKey(env);
    answer = key ? (await unseal(key, id, q.text || "", q.seal)) || "" : "";
  } else if (typeof q.answer === "string") answer = q.answer;
  if (!q.text || !answer) return json(500, { error: "ما قدرت أفتح جواب السؤال" });

  /* أول حكم ينحسب: لكل متسابق حكم واحد لكل سؤال (بنص السؤال، مو بحقول الدور اللي ممكن تتغير في الوثيقة المفتوحة)،
     محفوظ في كاش Cloudflare 10 دقايق. الكاش لكل مركز بيانات، فهذي حماية تخفف التجريب مو تمنعه 100% */
  const qh = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(q.text)))).slice(0, 12).map(x => x.toString(16).padStart(2, "0")).join("");
  const turn = new Request(new URL(context.request.url).origin + "/answer-turn/" + [id, qh, user.uid].map(encodeURIComponent).join("/"));
  const prev = await caches.default.match(turn);
  if (prev) {
    const r = await prev.json();
    if (r.pending) return json(409, { error: "جوابك قيد التصحيح" });
    if (b.stream === true && b.audio) return ndjson([Object.assign({ final: true, repeat: true }, r)]);
    return json(200, Object.assign({ repeat: true }, r));
  }
  /* نعلّم إن فيه تصحيح شغال قبل ما نسأل الذكاء الاصطناعي، عشان الطلبات المتوازية ما تعدّي كلها */
  await caches.default.put(turn, new Response(JSON.stringify({ pending: true }), { headers: { "Cache-Control": "max-age=30" } }));
  const remember = r => {
    if (r && (r.said || r.given)) context.waitUntil(caches.default.put(turn, new Response(JSON.stringify(r), { headers: { "Cache-Control": "max-age=600" } })));
    else context.waitUntil(caches.default.delete(turn));   /* ما انقال جواب (سكوت أو ما فهم): يقدر يكتب */
    return r;
  };

  try { return await gradeNow(context, env, b, q, answer, remember); }
  catch (e) { context.waitUntil(caches.default.delete(turn)); throw e; }
}
async function gradeNow(context, env, b, q, answer, remember) {
  if (typeof b.given === "string" && !b.audio) {
    const given = clip(b.given, 80);
    if (!given) return json(400, { error: "جواب فاضي" });
    let ok = answerMatches(given, answer);
    if (!ok) { try { ok = (await taskGrade(env, { q: q.text, answer, given })).ok === true; } catch (e) { ok = false; } }
    return json(200, remember({ ok, given }));
  }
  if (!audioOf(b)) return json(400, { error: "ما فيه صوت" });
  if (!env.AI) return json(503, { error: "AI not configured" });
  const body = { q: q.text, answer, audio: b.audio };
  if (b.stream === true) {
    const { readable, writable } = new TransformStream();
    const w = writable.getWriter(), te = new TextEncoder();
    const line = x => w.write(te.encode(JSON.stringify(x) + "\n"));
    context.waitUntil((async () => {
      try {
        const r = remember(await taskVoice(env, body, heard => line({ heard })));
        await line(Object.assign({ final: true }, r));
      } catch (e) { await line({ final: true, error: String((e && e.message) || e).slice(0, 200) }).catch(() => {}); }
      await w.close().catch(() => {});
    })());
    return new Response(readable, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
  }
  return json(200, remember(await taskVoice(env, body)));
}
function ndjson(lines) {
  return new Response(lines.map(x => JSON.stringify(x)).join("\n") + "\n", { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

/* ===== open ===== */
const HOST_GONE_MS = 25000; /* نفسه في engine.js (BC_HOST_GONE_MS) */
async function doOpen(env, b, user) {
  const id = String(b.id || ""), m = Number(b.m);
  if (!ID_RE.test(id) || !(m >= 0 && m < 40)) return json(400, { error: "bad id" });
  const d = await liveDoc(id);
  if (!d || d.status !== "live") return json(409, { error: "البث مو شغال" });
  const order = Array.isArray(d.order) ? d.order : [];
  const it = order[m];
  if (!it || !(it.box || it.boxed)) return json(404, { error: "ما فيه صندوق" });
  const admin = String(user.email || "").toLowerCase() === ADMIN_EMAIL;
  if (!admin) {
    /* الطيار الآلي: المنظم غايب، ومشهد يقدر ينتقل منه، والمواجهة هي الجاية فعلاً */
    if (!(Date.now() - Number(d.hostSeen || 0) > HOST_GONE_MS)) return json(403, { error: "المنظم موجود" });
    if (d.scene !== "opening" && d.scene !== "result") return json(409, { error: "مو وقت الانتقال" });
    let next = order.findIndex((o, i) => o && o.state === "pending" && i > d.cur);
    if (next === -1) next = order.findIndex((o, i) => o && o.state === "pending" && i !== d.cur);
    if (next !== m) return json(409, { error: "مو المواجهة الجاية" });
  }
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
  const user = await verifyFirebaseToken(bearer(request));
  if (!user) return json(401, { error: "سجّل دخول" });
  const who = user.uid;
  if (await overLimit(request, url, action, who)) return json(429, { error: "كثرت الطلبات، جرّب بعد دقيقة" });
  try {
    if (action === "seal") return await doSeal(env, b, user);
    if (action === "grade") return await doGrade(context, env, b, user);
    if (action === "open") return await doOpen(env, b, user);
    return await doReveal(context, env, b, user);
  } catch (e) {
    return json(502, { error: String((e && e.message) || e).slice(0, 200) });
  }
}

export async function onRequestGet(context) {
  return json(200, { ok: true, sealing: !!(await sealKey(context.env)) });
}
