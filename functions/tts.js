/* صوت المذيع: يحوّل نص السؤال لصوت بشري (Google Text-to-Speech)
   - يحتاج سر GCP_SA (حساب خدمة Google بصيغة JSON) في Cloudflare Pages
   - كل جملة تنحفظ في كاش Cloudflare، فنفس السؤال ما ينطلب من Google مرتين */

const MAX_CHARS = 300;
const VOICES = ["ar-XA-Chirp3-HD-Charon", "ar-XA-Wavenet-B", "ar-XA-Standard-B"];

let cachedToken = null, tokenExp = 0;

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlStr = (s) => b64url(new TextEncoder().encode(s));

async function googleToken(sa) {
  if (cachedToken && Date.now() < tokenExp - 60000) return cachedToken;
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlStr(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64urlStr(JSON.stringify({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(header + "." + claim));
  const jwt = header + "." + claim + "." + b64url(sig);
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + jwt
  });
  const d = await r.json();
  if (!d.access_token) throw new Error("Google auth: " + (d.error_description || d.error || r.status));
  cachedToken = d.access_token;
  tokenExp = Date.now() + (d.expires_in || 3600) * 1000;
  return cachedToken;
}

const err = (status, msg) => new Response(JSON.stringify({ error: msg }), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
});

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  /* بس صفحات موقع الدوري تقدر تطلب صوت (عشان ما يستخدمه غيرنا ويستهلك الحصة) */
  const from = request.headers.get("Origin") || request.headers.get("Referer") || "";
  if (from && new URL(from).host !== url.host) return err(403, "forbidden");

  const text = (url.searchParams.get("t") || "").trim().slice(0, MAX_CHARS);
  if (!text) return err(400, "no text");

  const cache = caches.default;
  const cacheKey = new Request(url.origin + "/tts?t=" + encodeURIComponent(text) + "&v=" + (env.TTS_VOICE || VOICES[0]));
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  if (!env.GCP_SA) return err(503, "TTS not configured");
  let sa;
  try { sa = JSON.parse(env.GCP_SA); } catch (e) { return err(500, "bad GCP_SA"); }

  try {
    const token = await googleToken(sa);
    const voices = env.TTS_VOICE ? [env.TTS_VOICE].concat(VOICES) : VOICES;
    let last = "";
    for (const name of voices) {
      const r = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json", "x-goog-user-project": sa.project_id },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: "ar-XA", name },
          audioConfig: { audioEncoding: "MP3", speakingRate: 1.0 }
        })
      });
      const d = await r.json();
      if (d.audioContent) {
        const bin = Uint8Array.from(atob(d.audioContent), (c) => c.charCodeAt(0));
        const res = new Response(bin, {
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=2592000", "X-Voice": name }
        });
        context.waitUntil(cache.put(cacheKey, res.clone()));
        return res;
      }
      last = (d.error && d.error.message) || String(r.status);
      if (r.status !== 400 && r.status !== 404) break; /* الصوت موجود بس فيه مشكلة ثانية: لا نجرب غيره */
    }
    return err(502, "TTS: " + last);
  } catch (e) {
    return err(500, String((e && e.message) || e));
  }
}
