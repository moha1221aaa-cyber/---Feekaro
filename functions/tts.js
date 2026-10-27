/* صوت المذيع: يحوّل نص السؤال لصوت بشري
   - الأساسي: ElevenLabs (سر ELEVEN_KEY)، صوت محمد المنصاري السعودي (يتغير بـ ELEVEN_VOICE). لو الرصيد خلص يجرب اللي بعده
   - بعده: Gemini TTS (سر GEMINI_API_KEY، مجاني من Google AI Studio)، صوت Alnilam (اختاره محمد 27 أكتوبر 2026 من عينات
     gemini-tts-samples.yml، يتغير بـ GEMINI_TTS_VOICE) بأسلوب مقدم برنامج مسابقات. يرجع WAV 24kHz. الباقة المجانية طلباتها قليلة
     باليوم، بس كل جملة تنحفظ في الكاش
   - بعده: Azure Speech (سر AZURE_TTS_KEY و AZURE_TTS_REGION في Cloudflare Pages)، صوت حامد السعودي ar-SA-HamedNeural
     (يتغير بـ AZURE_TTS_VOICE). الباقة المجانية F0 فيها 500 ألف حرف بالشهر
   - بعده: Google Text-to-Speech لو انضاف سر TTS_KEY
   - لو محرك فشل (مثلاً الرصيد خلص) يجرب اللي بعده
   - كل جملة تنحفظ في كاش Cloudflare 30 يوم، فنفس السؤال ما ينحسب من الرصيد مرتين */

import { verifyFirebaseToken, bearer } from "../lib/firebase-auth.js";

const MAX_CHARS = 300;
const DEFAULT_ELEVEN_VOICE = "2bnoa3wtrtcUW41TrSJM"; /* Mohammed Almansari (لهجة سعودية): اختاره محمد مذيع للدوري، 20 أكتوبر 2026 */
const ELEVEN_MODEL = "eleven_multilingual_v2";
const DEFAULT_AZURE_VOICE = "ar-SA-HamedNeural";
const DEFAULT_GEMINI_VOICE = "Alnilam";
const GEMINI_MODEL = "gemini-3.8-flash-tts";
/* عينات 27 أكتوبر: الطلب ياخذ ~5 ث، ومرة علّق 120 ث بدون رد. فلو ما رد خلال 10 ث نكمّل للمحرك اللي بعده بدل ما المذيع يتأخر */
const GEMINI_TIMEOUT_MS = 10000;
const GEMINI_STYLE = "an energetic Arabic TV quiz show host, clear and confident, natural Gulf delivery";

const err = (status, msg) => new Response(JSON.stringify({ error: msg }), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
});

async function eleven(env, text) {
  const voice = (env.ELEVEN_VOICE || DEFAULT_ELEVEN_VOICE).trim();
  const r = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(voice) + "?output_format=mp3_44100_64", {
    method: "POST",
    headers: { "xi-api-key": env.ELEVEN_KEY.trim(), "Content-Type": "application/json", "Accept": "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: ELEVEN_MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true }
    })
  });
  if (!r.ok) {
    let m = String(r.status);
    try { const d = await r.json(); m = (d.detail && (d.detail.message || d.detail.status || JSON.stringify(d.detail))) || m; } catch (e) {}
    throw new Error("ElevenLabs: " + m);
  }
  return new Uint8Array(await r.arrayBuffer());
}

/* Gemini (Interactions API): الرد فيه الصوت base64 (WAV) داخل steps[].content[] بنوع audio. ندوّر عليه بأي مكان في الرد */
function findAudio(o) {
  if (Array.isArray(o)) { for (const v of o) { const r = findAudio(v); if (r) return r; } return null; }
  if (!o || typeof o !== "object") return null;
  if (o.type === "audio" && typeof o.data === "string") return o.data;
  const inl = o.inlineData || o.inline_data;
  if (inl && typeof inl.data === "string") return inl.data;
  for (const k in o) { const r = findAudio(o[k]); if (r) return r; }
  return null;
}
async function gemini(env, text) {
  const voice = (env.GEMINI_TTS_VOICE || DEFAULT_GEMINI_VOICE).trim();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), GEMINI_TIMEOUT_MS);
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    signal: ctl.signal,
    headers: { "x-goog-api-key": env.GEMINI_API_KEY.trim(), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      input: [{ type: "user_input", content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style: GEMINI_STYLE }] }] }],
      response_format: { type: "audio", mime_type: "audio/wav" },
      generation_config: { speech_config: [{ voice }] }
    })
  }).catch(e => { throw new Error("Gemini: " + (e && e.name === "AbortError" ? "timeout " + GEMINI_TIMEOUT_MS + "ms" : (e && e.message) || e)); });
  let d;
  try {
    if (!r.ok) throw new Error("Gemini: " + r.status + " " + (await r.text().catch(() => "")).slice(0, 200));
    d = await r.json();
  } finally { clearTimeout(timer); }
  const b64 = findAudio(d);
  if (!b64) throw new Error("Gemini: no audio");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

const xmlEsc = (t) => t.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));

async function azure(env, text) {
  const region = (env.AZURE_TTS_REGION || "").trim();
  const voice = (env.AZURE_TTS_VOICE || DEFAULT_AZURE_VOICE).trim();
  const ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='ar-SA'>" +
    "<voice name='" + xmlEsc(voice) + "'><prosody rate='-6%'>" + xmlEsc(text) + "</prosody></voice></speak>";
  const r = await fetch("https://" + encodeURIComponent(region) + ".tts.speech.microsoft.com/cognitiveservices/v1", {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": env.AZURE_TTS_KEY.trim(),
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "masro7-league"
    },
    body: ssml
  });
  if (!r.ok) throw new Error("Azure: " + r.status + " " + (await r.text().catch(() => "")).slice(0, 200));
  return new Uint8Array(await r.arrayBuffer());
}

async function google(env, text, origin) {
  const r = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize?key=" + encodeURIComponent(env.TTS_KEY.trim()), {
    method: "POST",
    headers: { "Content-Type": "application/json", "Referer": origin + "/" },
    body: JSON.stringify({ input: { text }, voice: { languageCode: "ar-XA", name: env.TTS_VOICE || "ar-XA-Wavenet-B" }, audioConfig: { audioEncoding: "MP3" } })
  });
  const d = await r.json();
  if (!d.audioContent) throw new Error("Google: " + ((d.error && d.error.message) || r.status));
  return Uint8Array.from(atob(d.audioContent), (c) => c.charCodeAt(0));
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  /* بس صفحات موقع الدوري تقدر تطلب صوت (عشان ما يستخدمه غيرنا ويخلص الرصيد) */
  const from = request.headers.get("Origin") || request.headers.get("Referer") || "";
  try { if (from && new URL(from).host !== url.host) return err(403, "forbidden"); } catch (e) { return err(403, "forbidden"); }

  const text = (url.searchParams.get("t") || "").trim().slice(0, MAX_CHARS);
  if (!text) return err(400, "no text");

  /* المحركات المتوفرة بالترتيب. كل محرك له مفتاح كاش لحاله، فلو تغيّر المحرك ما يطلع الصوت القديم */
  const engines = [];
  if (env.ELEVEN_KEY) engines.push({ key: "el:" + (env.ELEVEN_VOICE || DEFAULT_ELEVEN_VOICE), run: () => eleven(env, text) });
  if (env.GEMINI_API_KEY) engines.push({ key: "gm:" + (env.GEMINI_TTS_VOICE || DEFAULT_GEMINI_VOICE), type: "audio/wav", run: () => gemini(env, text) });
  if (env.AZURE_TTS_KEY && env.AZURE_TTS_REGION) engines.push({ key: "az:" + (env.AZURE_TTS_VOICE || DEFAULT_AZURE_VOICE), run: () => azure(env, text) });
  if (env.TTS_KEY) engines.push({ key: "g:" + (env.TTS_VOICE || ""), run: () => google(env, text, url.origin) });
  if (!engines.length) return err(503, "TTS not configured");

  const cache = caches.default;
  const keyFor = (e) => new Request(url.origin + "/tts-cache?e=" + encodeURIComponent(e.key) + "&t=" + encodeURIComponent(text));

  /* كل محرك بالترتيب: كاشه أول، وبعدين يولّد. فالمحرك الأول يغلب صوت المحرك القديم المحفوظ،
     وكاش اللي بعده يُستخدم بس لو الأول فشل.
     جملة جديدة تصرف من الرصيد: لازم مستخدم مسجّل دخول (توكن Firebase).
     فحص Origin بروحه ينتجاوز بأي أداة، والجمل المحفوظة في الكاش مجانية فتطلع للكل */
  let authed = null, waited = false;
  const errors = [];
  /* ننتظر لين 2.4 ث إن الجملة توصل الكاش من جهاز ثاني (جهاز المنظم يولّدها)، بدون أي صرف من الرصيد */
  const pollCache = async (list) => {
    for (let i = 0; i < 6; i++) {
      await new Promise(r => setTimeout(r, 400));
      for (const e of list) { const hit = await cache.match(keyFor(e)); if (hit) return hit; }
    }
    return null;
  };
  /* w=1: الجهاز مو جهاز المنظم، فينتظر توليد المنظم أول بدل ما يولّدها مرة ثانية بنفس اللحظة (رصيد مرتين وتأخير) */
  const waitFirst = url.searchParams.get("w") === "1";
  for (const e of engines) {
    let hit = await cache.match(keyFor(e));
    if (hit) return hit;
    if (authed === null) authed = !!(await verifyFirebaseToken(bearer(request)));
    if (authed && waitFirst && !waited) { waited = true; hit = await pollCache([e]); if (hit) return hit; }
    if (!authed) continue;
    try {
      const audio = await e.run();
      const res = new Response(audio, {
        headers: { "Content-Type": e.type || "audio/mpeg", "Cache-Control": "public, max-age=2592000", "X-TTS-Engine": e.key.split(":")[0] }
      });
      context.waitUntil(cache.put(keyFor(e), res.clone()));
      return res;
    } catch (x) {
      errors.push(String((x && x.message) || x));
    }
  }
  if (!authed) {
    /* زائر بدون حساب طلب الجملة بنفس اللحظة اللي جهاز المنظم يولّدها فيها: كان يرجع 401 والمذيع يسكت عنده */
    const hit = await pollCache(engines);
    return hit || err(401, "login required");
  }
  return err(502, errors.join(" | "));
}
