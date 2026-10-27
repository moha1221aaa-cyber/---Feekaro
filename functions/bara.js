/* لعبة "برا السالفة" في الغرفة الصوتية (js/bara.js): السيرفر يختار الكلمة واللي برا السالفة، والخطة تنحفظ مختومة
   في وثيقة اللعبة العامة (room/main/games/bara)، فمحد يعرف الكلمة ولا مين برا السالفة من أدوات المطور.
   POST /bara بجسم JSON فيه action:
   - deal:   المنظم بس. يختار التصنيف (أو عشوائي) والكلمة واللاعب اللي برا السالفة و8 خيارات للتخمين، ويختمها (يكتبها جهاز المنظم)
             { gid, round, cat, pids } ← { plan, cat, catName, role } (role: دور المنظم نفسه لو يلعب)
   - role:   أي لاعب في الجولة. السيرفر يقرا الوثيقة ويفتح الختم ويرجّع دوره هو بس   { gid, round } ← { out, cat, catName, word? }
   - reveal: المنظم بس، بعد ما يبدأ التصويت. اللي برا السالفة والكلمة والخيارات، ولو معه receipt يحكم على التخمين
             { gid, round, receipt? } ← { out, word, opts, verdict? }
   - guess:  اللي برا السالفة بس، وقت التخمين. يرجّع إيصال مختوم بتخمينه (بدون ما يقول صح أو غلط، عشان ما يعرف الكلمة
             ويغيّر تخمينه)، وأول تخمين هو اللي ينحسب. جهازه يحط الإيصال في baraVotes/<uid> والمنظم يحكم فيه بـ reveal
             { gid, round, choice } ← { receipt }
   الختم مربوط برقم اللعبة والجولة (AAD)، فختم جولة ما ينفع لجولة ثانية، وما ينعدّل بدون ما ينكشف. */

import { verifyFirebaseToken, bearer } from "../lib/firebase-auth.js";
import { sealKey, seal, unseal } from "../lib/seal.js";
import { readPublicDoc } from "../lib/firestore-public.js";
import { BARA_WORDS, BARA_CAT_IDS } from "../lib/bara-words.js";

const ADMIN_EMAIL = "moha1221aaa@gmail.com"; /* نفسه في js/app.js و firestore.rules */
const DOC = "room/main/games/bara";
const LIMIT = { deal: 30, role: 60, reveal: 30, guess: 10 };
const GID_RE = /^b[a-z0-9]{6,24}$/;
const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const MIN_P = 3, MAX_P = 10, OPTS = 8;

const json = (status, obj) => new Response(JSON.stringify(obj), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});
const isAdmin = u => !!u && String(u.email || "").toLowerCase() === ADMIN_EMAIL;

async function overLimit(url, action, who) {
  const slot = Math.floor(Date.now() / 60000);
  const key = new Request(url.origin + "/bara-rl/" + action + "/" + encodeURIComponent(who) + "/" + slot);
  const hit = await caches.default.match(key);
  const n = hit ? Number(await hit.text()) || 0 : 0;
  if (n >= (LIMIT[action] || 10)) return true;
  await caches.default.put(key, new Response(String(n + 1), { headers: { "Cache-Control": "max-age=70" } }));
  return false;
}

/* رقم عشوائي منصف من 0 لين n-1 */
function randBelow(n) {
  const lim = Math.floor(0x100000000 / n) * n, b = new Uint32Array(1);
  for (;;) { crypto.getRandomValues(b); if (b[0] < lim) return b[0] % n; }
}
function shuffle(a) {
  const d = a.slice();
  for (let i = d.length - 1; i > 0; i--) { const j = randBelow(i + 1); const t = d[i]; d[i] = d[j]; d[j] = t; }
  return d;
}
/* الكلمة + 7 من نفس التصنيف، بترتيب عشوائي */
export function pickRound(cat, pids) {
  const c = cat === "random" ? BARA_CAT_IDS[randBelow(BARA_CAT_IDS.length)] : cat;
  const words = BARA_WORDS[c].w;
  const w = words[randBelow(words.length)];
  const opts = shuffle([w].concat(shuffle(words.filter(x => x !== w)).slice(0, OPTS - 1)));
  return { c, w, o: pids[randBelow(pids.length)], opts };
}

const sealId = gid => "bara_" + gid;
async function openSealed(env, gid, text, sealed) {
  const key = await sealKey(env);
  if (!key) return null;
  const raw = await unseal(key, sealId(gid), text, sealed);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}
function ids(b) {
  const gid = String(b.gid || ""), round = Number(b.round);
  if (!GID_RE.test(gid) || !(Number.isInteger(round) && round >= 1 && round <= 50)) return null;
  return { gid, round };
}
async function roundDoc(id) {
  const d = await readPublicDoc(DOC);
  if (!d || d.active !== true || d.gid !== id.gid || Number(d.round) !== id.round || typeof d.plan !== "string") return null;
  return d;
}
async function plan(env, id, d) {
  const p = await openSealed(env, id.gid, "r" + id.round, d.plan);
  return p && p.w && Array.isArray(p.ids) ? p : null;
}
const roleOf = (p, uid) => p.o === uid
  ? { out: true, cat: p.c, catName: BARA_WORDS[p.c].n }
  : { out: false, cat: p.c, catName: BARA_WORDS[p.c].n, word: p.w };

async function doDeal(env, b, user) {
  if (!isAdmin(user)) return json(403, { error: "للمنظم بس" });
  const id = ids(b);
  if (!id) return json(400, { error: "bad id" });
  const cat = String(b.cat || "random");
  if (cat !== "random" && !BARA_WORDS[cat]) return json(400, { error: "تصنيف غلط" });
  const pids = Array.isArray(b.pids) ? b.pids.map(String) : [];
  if (pids.length < MIN_P || pids.length > MAX_P || new Set(pids).size !== pids.length || !pids.every(u => UID_RE.test(u))) return json(400, { error: "bad players" });
  const key = await sealKey(env);
  if (!key) return json(503, { error: "الختم مو مضبوط في السيرفر" });
  const r = pickRound(cat, pids);
  const p = Object.assign(r, { ids: pids, by: user.uid });
  const sealed = await seal(key, sealId(id.gid), "r" + id.round, JSON.stringify(p));
  return json(200, { plan: sealed, cat: p.c, catName: BARA_WORDS[p.c].n, role: pids.indexOf(user.uid) !== -1 ? roleOf(p, user.uid) : null });
}

async function doRole(env, b, user) {
  const id = ids(b);
  if (!id) return json(400, { error: "bad id" });
  const d = await roundDoc(id);
  if (!d || d.phase === "lobby") return json(409, { error: "مو هذي الجولة" });
  const p = await plan(env, id, d);
  if (!p) return json(500, { error: "ما قدرت أفتح الجولة" });
  if (p.ids.indexOf(user.uid) === -1) return json(403, { error: "ما أنت في هالجولة" });
  return json(200, roleOf(p, user.uid));
}

async function doReveal(env, b, user) {
  if (!isAdmin(user)) return json(403, { error: "للمنظم بس" });
  const id = ids(b);
  if (!id) return json(400, { error: "bad id" });
  const d = await roundDoc(id);
  if (!d) return json(409, { error: "مو هذي الجولة" });
  if (["vote", "guess", "result"].indexOf(d.phase) === -1) return json(409, { error: "التصويت ما بدأ" });
  const p = await plan(env, id, d);
  if (!p) return json(500, { error: "ما قدرت أفتح الجولة" });
  const out = { out: p.o, word: p.w, opts: p.opts, cat: p.c };
  if (b.receipt) {
    const g = await openSealed(env, id.gid, "g" + id.round, String(b.receipt));
    out.verdict = g && g.u === p.o ? { choice: g.c, ok: g.c === p.w } : null;
  }
  return json(200, out);
}

async function doGuess(context, env, b, user) {
  const id = ids(b);
  if (!id) return json(400, { error: "bad id" });
  const d = await roundDoc(id);
  if (!d || d.phase !== "guess") return json(409, { error: "مو وقت التخمين" });
  const p = await plan(env, id, d);
  if (!p) return json(500, { error: "ما قدرت أفتح الجولة" });
  if (p.o !== user.uid) return json(403, { error: "التخمين للي برا السالفة بس" });
  const choice = String(b.choice || "");
  if (p.opts.indexOf(choice) === -1) return json(400, { error: "اختار من الخيارات" });
  /* أول تخمين ينحسب: نفس الإيصال يرجع لو انعاد (كاش Cloudflare، حماية تخفف التجريب). والإيصال ما يقول صح أو غلط أصلاً */
  const lock = new Request(new URL(context.request.url).origin + "/bara-guess/" + [id.gid, id.round, user.uid].map(encodeURIComponent).join("/"));
  const prev = await caches.default.match(lock);
  if (prev) return json(200, { receipt: await prev.text(), repeat: true });
  const key = await sealKey(env);
  const receipt = await seal(key, sealId(id.gid), "g" + id.round, JSON.stringify({ u: user.uid, c: choice }));
  await caches.default.put(lock, new Response(receipt, { headers: { "Cache-Control": "max-age=3600" } }));
  return json(200, { receipt });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const from = request.headers.get("Origin") || request.headers.get("Referer") || "";
  try { if (!from || new URL(from).host !== url.host) return json(403, { error: "forbidden" }); } catch (e) { return json(403, { error: "forbidden" }); }
  let b;
  try { b = await request.json(); } catch (e) { return json(400, { error: "bad body" }); }
  const action = b && b.action;
  if (["deal", "role", "reveal", "guess"].indexOf(action) === -1) return json(400, { error: "unknown action" });
  const user = await verifyFirebaseToken(bearer(request));
  if (!user) return json(401, { error: "سجّل دخول" });
  if (await overLimit(url, action, user.uid)) return json(429, { error: "كثرت الطلبات، جرّب بعد دقيقة" });
  try {
    if (action === "deal") return await doDeal(env, b, user);
    if (action === "role") return await doRole(env, b, user);
    if (action === "reveal") return await doReveal(env, b, user);
    return await doGuess(context, env, b, user);
  } catch (e) {
    return json(502, { error: String((e && e.message) || e).slice(0, 200) });
  }
}
