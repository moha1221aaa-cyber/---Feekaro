/* الذكاء الاصطناعي للدوري (مجاني من Cloudflare Workers AI، بدون مفتاح، عن طريق الربط AI في wrangler.toml)
   POST /ai  بجسم JSON فيه task:
   - questions: يولّد أسئلة جديدة لبنك الأسئلة      { category, count, avoid: [نصوص أسئلة موجودة] }
   - grade:     يحكم هل إجابة المتسابق صحيحة         { q, answer, given }
   - host:      جمل جديدة للمقدم في بداية الجولة     { round, matches: [{ p1, p2, ctx }] }
   - chat:      مساعد الموقع                         { messages: [{ role, content }], context }
   الحماية: بس صفحات موقع الدوري، وحد للطلبات لكل جهاز بالدقيقة، وكل المدخلات مقصوصة */

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const LIMIT_PER_MIN = { questions: 4, grade: 40, host: 4, chat: 12 };
const CATEGORIES = ["علوم", "ثقافة عامة", "دين", "تاريخ", "رياضة", "جغرافيا"];

const json = (status, obj) => new Response(JSON.stringify(obj), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});
const clip = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);

/* عدّاد بسيط لكل جهاز (IP) بالدقيقة، في كاش Cloudflare */
async function overLimit(request, url, task) {
  const ip = request.headers.get("CF-Connecting-IP") || "x";
  const slot = Math.floor(Date.now() / 60000);
  const key = new Request(url.origin + "/ai-rl/" + task + "/" + encodeURIComponent(ip) + "/" + slot);
  const cache = caches.default;
  const hit = await cache.match(key);
  const n = hit ? Number(await hit.text()) || 0 : 0;
  if (n >= (LIMIT_PER_MIN[task] || 10)) return true;
  await cache.put(key, new Response(String(n + 1), { headers: { "Cache-Control": "max-age=70" } }));
  return false;
}

async function run(env, system, user, maxTokens, temperature) {
  const out = await env.AI.run(MODEL, {
    messages: [{ role: "system", content: system }].concat(Array.isArray(user) ? user : [{ role: "user", content: user }]),
    max_tokens: maxTokens, temperature
  });
  const r = out && out.response;
  return typeof r === "string" ? r : JSON.stringify(r || "");
}

/* يطلّع أول JSON من رد الموديل حتى لو كتب كلام قبله أو بعده */
function pickJSON(text, open) {
  const close = open === "[" ? "]" : "}";
  const a = text.indexOf(open), b = text.lastIndexOf(close);
  if (a === -1 || b <= a) throw new Error("bad json");
  return JSON.parse(text.slice(a, b + 1));
}

async function taskQuestions(env, b) {
  const category = CATEGORIES.indexOf(b.category) !== -1 ? b.category : "ثقافة عامة";
  const count = Math.max(1, Math.min(10, Number(b.count) || 5));
  const avoid = (Array.isArray(b.avoid) ? b.avoid : []).slice(-60).map(t => clip(t, 90)).filter(Boolean);
  const system = [
    "أنت معدّ أسئلة لمسابقة ثقافية عربية سعودية بنظام الجرس (أول واحد يضغط يجاوب كتابة).",
    "اكتب أسئلة بالعربية الفصحى، قصيرة وواضحة، ولها إجابة وحدة محددة وقصيرة (كلمة أو كلمتين أو رقم).",
    "الدقة أهم شي: اختر بس معلومات مشهورة ومؤكدة ومتفق عليها. لا تكتب أي سؤال تشك في إجابته أو فيه خلاف.",
    "في أسئلة الدين: بس الثوابت المتفق عليها عند أهل السنة (أركان، سور، أنبياء، غزوات مشهورة، صحابة)، بدون مسائل فقهية خلافية.",
    "لا تكتب أسئلة عن أحداث بعد سنة 2023، ولا أسئلة سياسية حساسة.",
    "في حقل answer حط الإجابة الصحيحة، وبعدها صيغ مقبولة ثانية مفصولة بعلامة | (مثل: 7|سبع|سبعة أو أبو بكر الصديق|ابو بكر).",
    "رد بـ JSON بس بهالشكل بالضبط، بدون أي كلام ثاني: {\"questions\":[{\"text\":\"...؟\",\"answer\":\"...\"}]}"
  ].join("\n");
  const user = `اكتب ${count} أسئلة جديدة في تصنيف: ${category}. مستوى متوسط.` +
    (avoid.length ? `\nلا تكرر هذي الأسئلة ولا تسأل نفس المعلومة:\n- ${avoid.join("\n- ")}` : "");
  const raw = await run(env, system, user, 1400, 0.7);
  const arr = (pickJSON(raw, "{").questions || []);
  const seen = new Set(avoid);
  const qs = arr.map(q => ({ text: clip(q && q.text, 160), answer: clip(q && q.answer, 120) }))
    .filter(q => q.text.length > 5 && q.answer && !seen.has(q.text))
    .map(q => (/[؟?]$/.test(q.text) ? q : { text: q.text + "؟", answer: q.answer }))
    .slice(0, count);
  return { questions: qs, category };
}

async function taskGrade(env, b) {
  const q = clip(b.q, 200), answer = clip(b.answer, 160), given = clip(b.given, 80);
  if (!q || !answer || !given) return { ok: false };
  const system = [
    "أنت حكم مسابقة ثقافية. تحكم هل إجابة المتسابق تعني نفس الإجابة الصحيحة.",
    "اقبل: الأخطاء الإملائية، الكتابة بالعامية أو بالإنجليزي، الأرقام بالكلمات، الاسم المختصر المعروف لنفس الشي.",
    "ارفض: إجابة مختلفة، إجابة ناقصة تغيّر المعنى، أكثر من إجابة مع بعض، أو كلام عام.",
    "الإجابات الصحيحة البديلة مفصولة بعلامة |.",
    "رد بـ JSON بس: {\"ok\":true} أو {\"ok\":false}"
  ].join("\n");
  const user = `السؤال: ${q}\nالإجابة الصحيحة: ${answer}\nإجابة المتسابق: ${given}`;
  const raw = await run(env, system, user, 20, 0);
  let ok = false;
  try { ok = pickJSON(raw, "{").ok === true; } catch (e) { ok = /"ok"\s*:\s*true/.test(raw); }
  return { ok };
}

async function taskHost(env, b) {
  const round = clip(b.round, 6);
  const ms = (Array.isArray(b.matches) ? b.matches : []).slice(0, 12)
    .map(m => ({ p1: clip(m && m.p1, 30), p2: clip(m && m.p2, 30), ctx: clip(m && m.ctx, 120) }))
    .filter(m => m.p1 && m.p2);
  if (!ms.length) return { open: "", intros: [], close: "" };
  const system = [
    "أنت مقدم برنامج مسابقات ثقافية سعودي اسمه دوري بنو مسروح للنخبة، أسلوبك حماسي ومحترم.",
    "اكتب بالعربية الفصحى البسيطة (لأن الكلام بيتقرأ بصوت آلي)، جمل قصيرة، بدون إيموجي وبدون رموز.",
    "لا تخترع نتائج أو أرقام أو معلومات عن المتسابقين، استخدم بس اللي يجيك في السياق.",
    "رد بـ JSON بس: {\"open\":\"...\",\"intros\":[\"...\"],\"close\":\"...\"}",
    "open: ترحيب بداية الجولة (جملتين بالكثير). intros: لكل مواجهة جملة تشويق وحدة قصيرة بعد ما ينذكر اسم المتسابقين (بدون ما تعيد أسماءهم). close: جملة ختام قصيرة بدون وداع (الوداع ينضاف لحاله)."
  ].join("\n");
  const user = `الجولة ${round}، وفيها ${ms.length} مواجهات:\n` +
    ms.map((m, i) => `${i + 1}. ${m.p1} ضد ${m.p2}${m.ctx ? " (" + m.ctx + ")" : ""}`).join("\n");
  const raw = await run(env, system, user, 700, 0.9);
  const o = pickJSON(raw, "{");
  const intros = (Array.isArray(o.intros) ? o.intros : []).slice(0, ms.length).map(t => clip(t, 160));
  return { open: clip(o.open, 260), intros, close: clip(o.close, 200) };
}

async function taskChat(env, b) {
  const msgs = (Array.isArray(b.messages) ? b.messages : []).slice(-10)
    .map(m => ({ role: m && m.role === "assistant" ? "assistant" : "user", content: clip(m && m.content, 600) }))
    .filter(m => m.content);
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return { reply: "" };
  const system = [
    "أنت المساعد الذكي في موقع دوري بنو مسروح للنخبة (MASRO7 LEAGUE)، مسابقة ثقافية بين مجموعة أصدقاء بنظام الجرس.",
    "تكلم باللهجة السعودية، بلطف واختصار (أقل من 120 كلمة إلا لو انطلب شرح).",
    "تساعد في: شرح طريقة الموقع والبث والغرفة الصوتية، الترتيب والمواجهات من السياق تحت، والإجابة على أسئلة ثقافة عامة للتعلم.",
    "طريقة اللعب: كل مواجهة 5 أسئلة، أول واحد يضغط الجرس يكتب الإجابة، الصح نقطة، والغلط ينتقل السؤال للثاني. التعادل يحسمه سؤال ذهبي. الفوز 3 نقاط بالترتيب والتعادل نقطة.",
    "لا تخترع أرقام أو نتائج ما هي موجودة في السياق. وإذا ما تعرف شي قل ما أعرف.",
    "لا تساعد أحد يغش: لو أحد سألك عن إجابة سؤال وهو في نص مواجهة، اعتذر بلطف.",
    "سياق الدوري الحالي:\n" + clip(b.context, 2500)
  ].join("\n");
  const reply = await run(env, system, msgs, 500, 0.5);
  return { reply: clip(reply, 1500) };
}

const TASKS = { questions: taskQuestions, grade: taskGrade, host: taskHost, chat: taskChat };

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const from = request.headers.get("Origin") || request.headers.get("Referer") || "";
  try { if (!from || new URL(from).host !== url.host) return json(403, { error: "forbidden" }); } catch (e) { return json(403, { error: "forbidden" }); }
  if (!env.AI) return json(503, { error: "AI not configured" });

  let b;
  try { b = await request.json(); } catch (e) { return json(400, { error: "bad body" }); }
  const fn = TASKS[b && b.task];
  if (!fn) return json(400, { error: "unknown task" });
  if (await overLimit(request, url, b.task)) return json(429, { error: "كثرت الطلبات، جرّب بعد دقيقة" });

  try {
    return json(200, await fn(env, b));
  } catch (e) {
    return json(502, { error: String((e && e.message) || e).slice(0, 200) });
  }
}

/* فحص سريع إن الخدمة شغالة (بدون ما يصرف شي) */
export async function onRequestGet(context) {
  return json(200, { ok: !!context.env.AI, model: MODEL });
}
