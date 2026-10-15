/* صوت المذيع: يحوّل نص السؤال لصوت بشري
   - الأساسي: ElevenLabs (سر ELEVEN_KEY في Cloudflare Pages، والصوت من ELEVEN_VOICE أو الافتراضي تحت)
   - احتياط: Google Text-to-Speech لو انضاف سر TTS_KEY
   - كل جملة تنحفظ في كاش Cloudflare 30 يوم، فنفس السؤال ما ينحسب من الرصيد مرتين */

const MAX_CHARS = 300;
const DEFAULT_ELEVEN_VOICE = "pNInz6obpgDQGcFmaJgB"; /* يتغيّر بعد ما يختار محمد الصوت */
const ELEVEN_MODEL = "eleven_multilingual_v2";

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

  const engine = env.ELEVEN_KEY ? "el:" + (env.ELEVEN_VOICE || DEFAULT_ELEVEN_VOICE) : (env.TTS_KEY ? "g:" + (env.TTS_VOICE || "") : "");
  if (!engine) return err(503, "TTS not configured");

  const cache = caches.default;
  const cacheKey = new Request(url.origin + "/tts-cache?e=" + encodeURIComponent(engine) + "&t=" + encodeURIComponent(text));
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  try {
    const audio = env.ELEVEN_KEY ? await eleven(env, text) : await google(env, text, url.origin);
    const res = new Response(audio, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=2592000" }
    });
    context.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  } catch (e) {
    return err(502, String((e && e.message) || e));
  }
}
