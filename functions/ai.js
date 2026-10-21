/* الذكاء الاصطناعي للدوري (مجاني من Cloudflare Workers AI، بدون مفتاح، عن طريق الربط AI في wrangler.toml)
   POST /ai  بجسم JSON فيه task:
   - questions: يولّد أسئلة جديدة لبنك الأسئلة      { category, count, avoid: [نصوص أسئلة موجودة] }
   - grade:     يحكم هل إجابة المتسابق صحيحة         { q, answer, given }
   - voice:     جواب المتسابق بالصوت: يحوّله نص (Whisper)، يطلّع الجواب من كلامه، ويحكم   { q, answer, audio: WAV base64, stream? }
                مع stream: true الرد NDJSON على دفعتين: {"heard"} أول ما يخلص Whisper (نص مباشر عند المتسابق)، وبعدها {"final":true,...}
   - hear:      نص مباشر وقت الكلام (Whisper بس، بدون حكم)                                   { q, audio }
   - host:      جمل جديدة للمقدم في بداية الجولة     { round, matches: [{ p1, p2, ctx }] }
   - chat:      مساعد الموقع                         { messages: [{ role, content }], context }
   الحماية: بس صفحات موقع الدوري، وحد للطلبات لكل جهاز بالدقيقة، وكل المدخلات مقصوصة */

import { verifyFirebaseToken, bearer, jwksCount } from "../lib/firebase-auth.js";
import { MODEL, clip, run, runSmart, pickJSON, taskGrade, taskHear, taskVoice } from "../lib/grading.js";

const LIMIT_PER_MIN = { questions: 4, grade: 40, host: 4, chat: 12, voice: 30, hear: 20 };
const CATEGORIES = ["علوم", "ثقافة عامة", "دين", "تاريخ", "رياضة", "جغرافيا"];

const json = (status, obj) => new Response(JSON.stringify(obj), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

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

async function taskQuestions(env, b) {
  const category = CATEGORIES.indexOf(b.category) !== -1 ? b.category : "ثقافة عامة";
  const count = Math.max(1, Math.min(10, Number(b.count) || 5));
  const avoid = (Array.isArray(b.avoid) ? b.avoid : []).slice(-60).map(t => clip(t, 90)).filter(Boolean);
  const system = [
    "أنت معدّ أسئلة لمسابقة ثقافية عربية سعودية بنظام الجرس (أول واحد يضغط يجاوب كتابة).",
    "اكتب أسئلة بالعربية الفصحى، قصيرة وواضحة، ولها إجابة وحدة محددة وقصيرة (كلمة أو كلمتين أو رقم).",
    "الدقة أهم شي: اختر بس معلومات مشهورة جداً ومؤكدة ومتفق عليها، من اللي تلقاها في أي موسوعة. لا تكتب أي سؤال تشك في إجابته أو فيه خلاف.",
    "في أسئلة الدين: بس الثوابت المتفق عليها عند أهل السنة (أركان، سور، أنبياء ثابتة قصصهم بالقرآن، غزوات مشهورة، صحابة)، بدون مسائل فقهية خلافية ولا أشياء فيها أقوال.",
    "تجنب التفاصيل الصغيرة اللي سهل تغلط فيها: أعداد المحافظات والمراكز، الأرقام الدقيقة جداً، المدن الصغيرة، الأرقام القياسية اللي تتغير.",
    "لا تكتب أسئلة عن أحداث بعد سنة 2023، ولا أسئلة سياسية حساسة.",
    "في حقل answer حط الإجابة الصحيحة، وبعدها صيغ مقبولة ثانية مفصولة بعلامة | (مثل: 7|سبع|سبعة أو أبو بكر الصديق|ابو بكر).",
    "رد بـ JSON بس بهالشكل بالضبط، بدون أي كلام ثاني: {\"questions\":[{\"text\":\"...؟\",\"answer\":\"...\"}]}"
  ].join("\n");
  const ask = Math.min(14, count + 4);
  const user = `اكتب ${ask} أسئلة جديدة في تصنيف: ${category}. مستوى متوسط.` +
    (avoid.length ? `\nلا تكرر هذي الأسئلة ولا تسأل نفس المعلومة:\n- ${avoid.join("\n- ")}` : "");
  let arr = null;
  for (let i = 0; i < 2 && !arr; i++) {
    try { arr = pickJSON(await runSmart(env, system, user, 4000, 0.6), "{").questions || []; }
    catch (e) { if (i === 1) throw e; }
  }
  const seen = new Set(avoid);
  const drafts = arr.map(q => ({ text: clip(q && q.text, 160), answer: clip(q && q.answer, 120) }))
    .filter(q => q.text.length > 5 && q.answer && !seen.has(q.text))
    .map(q => (/[؟?]$/.test(q.text) ? q : { text: q.text + "؟", answer: q.answer }));
  const checked = await verifyQuestions(env, drafts);
  return { questions: checked.slice(0, count), category, dropped: drafts.length - checked.length };
}

/* المراجعة: مدقق ثاني يحكم على كل سؤال، ويشيل أي سؤال إجابته غلط أو فيه خلاف أو أكثر من إجابة */
async function verifyQuestions(env, qs) {
  if (!qs.length) return [];
  const system = [
    "أنت مدقق معلومات صارم لمسابقة ثقافية. قدامك أسئلة وإجاباتها.",
    "لكل سؤال: هل الإجابة الأولى (قبل علامة |) صحيحة 100% ومتفق عليها، والسؤال له إجابة وحدة بس؟",
    "لو فيه أي شك أو خلاف بين العلماء أو المصادر، أو المعلومة تتغير مع الوقت، أو السؤال يحتمل أكثر من إجابة: احكم بـ false.",
    "رد بـ JSON بس: {\"results\":[{\"i\":0,\"ok\":true}]}"
  ].join("\n");
  const user = qs.map((q, i) => `${i}. السؤال: ${q.text} | الإجابة: ${q.answer}`).join("\n");
  let res = null;
  for (let k = 0; k < 2 && !res; k++) {
    try { res = pickJSON(await runSmart(env, system, user, 2500, 0), "{").results; } catch (e) {}
  }
  if (!Array.isArray(res)) return [];          /* لو المراجعة فشلت ما نرجّع أسئلة ما انراجعت */
  const okSet = new Set(res.filter(r => r && r.ok === true).map(r => Number(r.i)));
  return qs.filter((q, i) => okSet.has(i));
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
    "رد بـ JSON بس: {\"open\":\"...\",\"intros\":[\"...\"],\"close\":\"...\",\"situ\":{\"streak\":[\"...\"],\"comeback\":[\"...\"],\"tie\":[\"...\"],\"lead\":[\"...\"]}}",
    "open: ترحيب بداية الجولة (جملتين بالكثير). intros: لكل مواجهة جملة تشويق وحدة قصيرة بعد ما ينذكر اسم المتسابقين (بدون ما تعيد أسماءهم). close: جملة ختام قصيرة بدون وداع (الوداع ينضاف لحاله).",
    "situ: جمل قصيرة جداً (أقل من 8 كلمات) يقولها المقدم بعد إجابة صحيحة حسب الموقف، جملتين لكل موقف: streak (جاوب 3 أسئلة ورا بعض)، comeback (رجع بعد ما كان متأخر بنقطتين)، tie (صار تعادل)، lead (صار متقدم). في streak و comeback و lead اكتب {p} مكان اسم المتسابق بالضبط، وفي tie بدون اسم."
  ].join("\n");
  const user = `الجولة ${round}، وفيها ${ms.length} مواجهات:\n` +
    ms.map((m, i) => `${i + 1}. ${m.p1} ضد ${m.p2}${m.ctx ? " (" + m.ctx + ")" : ""}`).join("\n");
  const raw = await run(env, system, user, 1000, 0.9);
  const o = pickJSON(raw, "{");
  const intros = (Array.isArray(o.intros) ? o.intros : []).slice(0, ms.length).map(t => clip(t, 160));
  /* جمل الموقف: جملتين بالكثير لكل موقف، والاسم مكانه {p} بس (ما نقبل أي قوس ثاني عشان bcFill ما يحط شي غريب) */
  const situ = {};
  const src = o.situ && typeof o.situ === "object" ? o.situ : {};
  for (const k of ["streak", "comeback", "tie", "lead"]) {
    const list = (Array.isArray(src[k]) ? src[k] : []).map(t => clip(t, 90)).filter(t => t && !/\{(?!p\})/.test(t) && (k === "tie" ? t.indexOf("{p}") === -1 : t.indexOf("{p}") !== -1)).slice(0, 2);
    if (list.length) situ[k] = list;
  }
  return { open: clip(o.open, 260), intros, close: clip(o.close, 200), situ };
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
    "الموقع: تحت فيه تبويبات: الرئيسية، الترتيب، المواجهات، التوقعات، الحساب، الغرفة (غرفة صوتية فيها مايكات وشات وألعاب).",
    "البث المباشر: المنظم يبدأ بث الجولة (أو يجدوله)، ويوصل إشعار للي مفعّل الجرس، ويطلع زر البث في الموقع. في البث فيه ترحيب، وبعدها كل مواجهة بدورها: المتسابقين يضغطون جاهز، ويتكلمون مع المنظم بالمايك، وبعدها تبدأ الأسئلة.",
    "طريقة اللعب: كل مواجهة 5 أسئلة. لما يطلع السؤال، أول واحد يضغط زر الجرس تطلع له خانة يكتب فيها الإجابة (عنده 15 ثانية). الصح نقطة، والغلط ينتقل السؤال للثاني. التعادل يحسمه سؤال ذهبي. والنتيجة تنحفظ بجدول الدوري لحالها: الفوز 3 نقاط والتعادل نقطة.",
    "التوقعات: الجمهور يتوقع نتيجة المواجهات، 5 نقاط للنتيجة الدقيقة و3 للفائز.",
    "لا تخترع أزرار أو خطوات أو ميزات غير المذكورة هنا، ولا أرقام أو نتائج ما هي موجودة في السياق. وإذا ما تعرف شي قل ما أعرف.",
    "اكتب نص عادي بدون تنسيق (لا نجوم ولا عناوين ولا جداول).",
    "لا تساعد أحد يغش: لو أحد سألك عن إجابة سؤال وهو في نص مواجهة، اعتذر بلطف.",
    "سياق الدوري الحالي:\n" + clip(b.context, 2500)
  ].join("\n");
  const reply = await runSmart(env, system, msgs, 1500, 0.5);
  /* نشيل أي تنسيق Markdown لأن الدردشة تعرض نص عادي */
  const plain = String(reply).replace(/\*\*|__|`/g, "").replace(/^\s*#+\s*/gm, "").trim();
  return { reply: plain.slice(0, 1500) };
}

const TASKS = { questions: taskQuestions, grade: taskGrade, voice: taskVoice, hear: taskHear, host: taskHost, chat: taskChat };

/* الجواب الصوتي على دفعتين (NDJSON): النص أول، والحكم بعده. الخطأ يطلع سطر {"final":true,"error"} */
function streamVoice(context, env, b) {
  const { readable, writable } = new TransformStream();
  const w = writable.getWriter(), enc = new TextEncoder();
  const line = o => w.write(enc.encode(JSON.stringify(o) + "\n"));
  context.waitUntil((async () => {
    try {
      const r = await taskVoice(env, b, heard => line({ heard }));
      await line(Object.assign({ final: true }, r));
    } catch (e) {
      await line({ final: true, error: String((e && e.message) || e).slice(0, 200) }).catch(() => {});
    }
    await w.close().catch(() => {});
  })());
  return new Response(readable, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const from = request.headers.get("Origin") || request.headers.get("Referer") || "";
  try { if (!from || new URL(from).host !== url.host) return json(403, { error: "forbidden" }); } catch (e) { return json(403, { error: "forbidden" }); }
  if (!env.AI) return json(503, { error: "AI not configured" });
  /* بس المستخدمين المسجلين (توكن Firebase)، لأن فحص Origin ينتجاوز ويخلص الحصة المجانية */
  if (!(await verifyFirebaseToken(bearer(request)))) return json(401, { error: "سجّل دخول عشان تستخدم الذكاء الاصطناعي" });

  let b;
  try { b = await request.json(); } catch (e) { return json(400, { error: "bad body" }); }
  const fn = TASKS[b && b.task];
  if (!fn) return json(400, { error: "unknown task" });
  if (await overLimit(request, url, b.task)) return json(429, { error: "كثرت الطلبات، جرّب بعد دقيقة" });

  if (b.task === "voice" && b.stream === true) return streamVoice(context, env, b);
  try {
    return json(200, await fn(env, b));
  } catch (e) {
    return json(502, { error: String((e && e.message) || e).slice(0, 200) });
  }
}

/* فحص سريع إن الخدمة شغالة (بدون ما يصرف شي) */
export async function onRequestGet(context) {
  /* authKeys: عدد مفاتيح Firebase العامة اللي يتحقق فيها من تسجيل الدخول (لازم أكثر من 0) */
  return json(200, { ok: !!context.env.AI, model: MODEL, authKeys: await jwksCount() });
}
