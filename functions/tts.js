/* صوت المذيع: يحوّل نص السؤال لصوت بشري
   - الأساسي: Azure Speech (سر AZURE_TTS_KEY و AZURE_TTS_REGION في Cloudflare Pages)، صوت حامد السعودي ar-SA-HamedNeural
     (يتغير بـ AZURE_TTS_VOICE). الباقة المجانية F0 فيها 500 ألف حرف بالشهر
   - بعده: ElevenLabs (سر ELEVEN_KEY، والصوت من ELEVEN_VOICE أو الافتراضي تحت)
   - بعده: Google Text-to-Speech لو انضاف سر TTS_KEY
   - لو محرك فشل (مثلاً الرصيد خلص) يجرب اللي بعده
   - كل جملة تنحفظ في كاش Cloudflare 30 يوم، فنفس السؤال ما ينحسب من الرصيد مرتين */

import { verifyFirebaseToken, bearer } from "../lib/firebase-auth.js";

const MAX_CHARS = 300;
const DEFAULT_ELEVEN_VOICE = "nPczCjzI2devNBz1zQrb"; /* Brian: اختاره محمد مذيع للدوري */
const ELEVEN_MODEL = "eleven_multilingual_v2";
const DEFAULT_AZURE_VOICE = "ar-SA-HamedNeural";

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
  if (env.AZURE_TTS_KEY && env.AZURE_TTS_REGION) engines.push({ key: "az:" + (env.AZURE_TTS_VOICE || DEFAULT_AZURE_VOICE), run: () => azure(env, text) });
  if (env.ELEVEN_KEY) engines.push({ key: "el:" + (env.ELEVEN_VOICE || DEFAULT_ELEVEN_VOICE), run: () => eleven(env, text) });
  if (env.TTS_KEY) engines.push({ key: "g:" + (env.TTS_VOICE || ""), run: () => google(env, text, url.origin) });
  if (!engines.length) return err(503, "TTS not configured");

  const cache = caches.default;
  const keyFor = (e) => new Request(url.origin + "/tts-cache?e=" + encodeURIComponent(e.key) + "&t=" + encodeURIComponent(text));

  /* كل محرك بالترتيب: كاشه أول، وبعدين يولّد. فالمحرك الأول يغلب صوت المحرك القديم المحفوظ،
     وكاش اللي بعده يُستخدم بس لو الأول فشل.
     جملة جديدة تصرف من الرصيد: لازم مستخدم مسجّل دخول (توكن Firebase).
     فحص Origin بروحه ينتجاوز بأي أداة، والجمل المحفوظة في الكاش مجانية فتطلع للكل */
  let authed = null;
  const errors = [];
  for (const e of engines) {
    const hit = await cache.match(keyFor(e));
    if (hit) return hit;
    if (authed === null) authed = !!(await verifyFirebaseToken(bearer(request)));
    if (!authed) continue;
    try {
      const audio = await e.run();
      const res = new Response(audio, {
        headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=2592000", "X-TTS-Engine": e.key.split(":")[0] }
      });
      context.waitUntil(cache.put(keyFor(e), res.clone()));
      return res;
    } catch (x) {
      errors.push(String((x && x.message) || x));
    }
  }
  if (!authed) return err(401, "login required");
  return err(502, errors.join(" | "));
}
