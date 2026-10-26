/* أوراق لعبة السوم في الغرفة الصوتية (js/som.js): السيرفر يخلط ويوزع، والأوراق تنحفظ مختومة في وثيقة اللعبة العامة،
   فمحد يقدر يشوف ورق غيره من أدوات المطور (room/** مفتوحة للقراءة والكتابة).
   POST /som بجسم JSON فيه action:
   - deal:   المنظم بس. يخلط 32 ورقة (8 أنواع × 4) ويعطي كل لاعب 4، ويرجّع الختم (يكتبه جهاز المنظم في الوثيقة) وأوراق المنظم نفسه لو يلعب
             { gid, round, uids } ← { deal, hand }
   - hand:   أي لاعب. السيرفر يقرا الوثيقة بنفسه ويفتح الختم ويرجّع أوراق صاحب التوكن بس   { gid, round } ← { hand }
   - reveal: المنظم بس، ووقت الكشف بس (phase showdown). يرجّع أوراق اللي داقشوا (show في الوثيقة)   { gid, round } ← { hands }
   الختم مربوط برقم اللعبة والجولة (AAD)، فختم جولة ما ينفع لجولة ثانية، وما ينعدّل بدون ما ينكشف. */

import { verifyFirebaseToken, bearer } from "../lib/firebase-auth.js";
import { sealKey, seal, unseal } from "../lib/seal.js";
import { readPublicDoc } from "../lib/firestore-public.js";

const ADMIN_EMAIL = "moha1221aaa@gmail.com"; /* نفسه في js/app.js و firestore.rules */
const DOC = "room/main/games/som";
const LIMIT = { deal: 30, hand: 60, reveal: 30 };
const GID_RE = /^s[a-z0-9]{6,24}$/;
const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const DECK = 32, PER = 4, MAX_P = 8;

const json = (status, obj) => new Response(JSON.stringify(obj), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});
const isAdmin = u => !!u && String(u.email || "").toLowerCase() === ADMIN_EMAIL;

async function overLimit(url, action, who) {
  const slot = Math.floor(Date.now() / 60000);
  const key = new Request(url.origin + "/som-rl/" + action + "/" + encodeURIComponent(who) + "/" + slot);
  const hit = await caches.default.match(key);
  const n = hit ? Number(await hit.text()) || 0 : 0;
  if (n >= (LIMIT[action] || 10)) return true;
  await caches.default.put(key, new Response(String(n + 1), { headers: { "Cache-Control": "max-age=70" } }));
  return false;
}

/* رقم عشوائي منصف من 0 لين n-1 (بدون انحياز الباقي) */
function randBelow(n) {
  const lim = Math.floor(0x100000000 / n) * n, b = new Uint32Array(1);
  for (;;) { crypto.getRandomValues(b); if (b[0] < lim) return b[0] % n; }
}
export function shuffledDeck() {
  const d = Array.from({ length: DECK }, (_, i) => i);
  for (let i = d.length - 1; i > 0; i--) { const j = randBelow(i + 1); const t = d[i]; d[i] = d[j]; d[j] = t; }
  return d;
}

const sealId = gid => "som_" + gid;
const sealText = round => "r" + round;
async function openDeal(env, gid, round, sealed) {
  const key = await sealKey(env);
  if (!key) return null;
  const raw = await unseal(key, sealId(gid), sealText(round), sealed);
  if (!raw) return null;
  try { const o = JSON.parse(raw); return o && o.h ? o : null; } catch (e) { return null; }
}
function ids(b) {
  const gid = String(b.gid || ""), round = Number(b.round);
  if (!GID_RE.test(gid) || !(Number.isInteger(round) && round >= 1 && round <= 200)) return null;
  return { gid, round };
}

async function doDeal(env, b, user) {
  if (!isAdmin(user)) return json(403, { error: "للمنظم بس" });
  const id = ids(b);
  if (!id) return json(400, { error: "bad id" });
  const uids = Array.isArray(b.uids) ? b.uids.map(String) : [];
  if (uids.length < 2 || uids.length > MAX_P || new Set(uids).size !== uids.length || !uids.every(u => UID_RE.test(u))) return json(400, { error: "bad players" });
  const key = await sealKey(env);
  if (!key) return json(503, { error: "الختم مو مضبوط في السيرفر" });
  const deck = shuffledDeck(), h = {};
  uids.forEach((u, i) => { h[u] = deck.slice(i * PER, i * PER + PER); });
  const deal = await seal(key, sealId(id.gid), sealText(id.round), JSON.stringify({ h, by: user.uid }));
  return json(200, { deal, hand: h[user.uid] || null });
}

async function gameDoc(id) {
  const d = await readPublicDoc(DOC);
  if (!d || d.gid !== id.gid || Number(d.round) !== id.round || typeof d.deal !== "string") return null;
  return d;
}

async function doHand(env, b, user) {
  const id = ids(b);
  if (!id) return json(400, { error: "bad id" });
  const d = await gameDoc(id);
  if (!d) return json(409, { error: "مو هذي الجولة" });
  const o = await openDeal(env, id.gid, id.round, d.deal);
  if (!o) return json(500, { error: "ما قدرت أفتح الأوراق" });
  const hand = o.h[user.uid];
  if (!hand) return json(403, { error: "ما أنت في هالجولة" });
  return json(200, { hand });
}

async function doReveal(env, b, user) {
  if (!isAdmin(user)) return json(403, { error: "للمنظم بس" });
  const id = ids(b);
  if (!id) return json(400, { error: "bad id" });
  const d = await gameDoc(id);
  if (!d) return json(409, { error: "مو هذي الجولة" });
  if (d.phase !== "showdown") return json(409, { error: "مو وقت الكشف" });
  const o = await openDeal(env, id.gid, id.round, d.deal);
  if (!o) return json(500, { error: "ما قدرت أفتح الأوراق" });
  const show = Array.isArray(d.show) ? d.show.map(String) : [];
  if (show.length < 2 || !show.every(u => o.h[u])) return json(409, { error: "قائمة الكشف غلط" });
  const hands = {};
  show.forEach(u => { hands[u] = o.h[u]; });
  return json(200, { hands });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const from = request.headers.get("Origin") || request.headers.get("Referer") || "";
  try { if (!from || new URL(from).host !== url.host) return json(403, { error: "forbidden" }); } catch (e) { return json(403, { error: "forbidden" }); }
  let b;
  try { b = await request.json(); } catch (e) { return json(400, { error: "bad body" }); }
  const action = b && b.action;
  if (["deal", "hand", "reveal"].indexOf(action) === -1) return json(400, { error: "unknown action" });
  const user = await verifyFirebaseToken(bearer(request));
  if (!user) return json(401, { error: "سجّل دخول" });
  if (await overLimit(url, action, user.uid)) return json(429, { error: "كثرت الطلبات، جرّب بعد دقيقة" });
  try {
    if (action === "deal") return await doDeal(env, b, user);
    if (action === "hand") return await doHand(env, b, user);
    return await doReveal(env, b, user);
  } catch (e) {
    return json(502, { error: String((e && e.message) || e).slice(0, 200) });
  }
}
