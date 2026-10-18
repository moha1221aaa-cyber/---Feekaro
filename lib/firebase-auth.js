/* التحقق من توكن Firebase (ID token) داخل دوال Cloudflare Pages بدون مكتبات
   حسب توثيق Firebase: RS256، والمفتاح من مفاتيح securetoken العامة (kid)،
   و iss = https://securetoken.google.com/<المشروع>، و aud = المشروع، و exp/iat/auth_time، و sub مو فاضي */

export const FIREBASE_PROJECT = "masro7league";
const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const SKEW = 300; /* سماحية 5 دقايق لفرق الساعة */

let keyCache = { at: 0, ttl: 0, keys: {} };

function b64urlBytes(s) {
  s = String(s).replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const b64urlJSON = (s) => JSON.parse(new TextDecoder().decode(b64urlBytes(s)));

async function getKey(kid, fetchImpl) {
  const now = Date.now();
  /* نجيب المفاتيح من جديد لو انتهت مدتها، أو لو kid جديد (Google يبدّل المفاتيح) بس مو أكثر من مرة بالدقيقة */
  const expired = now - keyCache.at > keyCache.ttl;
  const unknown = !keyCache.keys[kid] && now - keyCache.at > 60000;
  if (expired || unknown) {
    const r = await (fetchImpl || fetch)(JWKS_URL, { cf: { cacheTtl: 3600 } });
    if (!r.ok) throw new Error("jwks " + r.status);
    const m = /max-age=(\d+)/.exec(r.headers.get("Cache-Control") || "");
    const data = await r.json();
    const keys = {};
    for (const jwk of data.keys || []) {
      if (!jwk.kid || jwk.kty !== "RSA") continue;
      keys[jwk.kid] = await crypto.subtle.importKey("jwk", { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    }
    keyCache = { at: now, ttl: Math.min(Number(m && m[1]) || 3600, 21600) * 1000, keys };
  }
  return keyCache.keys[kid] || null;
}

/* يرجّع بيانات المستخدم { uid, email } لو التوكن سليم، أو null */
export async function verifyFirebaseToken(token, opts) {
  opts = opts || {};
  const project = opts.project || FIREBASE_PROJECT;
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return null;
    const header = b64urlJSON(parts[0]);
    const p = b64urlJSON(parts[1]);
    if (header.alg !== "RS256" || !header.kid) return null;
    const now = Math.floor((opts.now || Date.now()) / 1000);
    if (p.iss !== "https://securetoken.google.com/" + project) return null;
    if (p.aud !== project) return null;
    if (typeof p.sub !== "string" || !p.sub || p.sub.length > 128) return null;
    if (!(p.exp > now - SKEW)) return null;
    if (!(p.iat <= now + SKEW)) return null;
    if (!(p.auth_time <= now + SKEW)) return null;
    const key = await getKey(header.kid, opts.fetch);
    if (!key) return null;
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlBytes(parts[2]),
      new TextEncoder().encode(parts[0] + "." + parts[1]));
    return ok ? { uid: p.sub, email: p.email || "" } : null;
  } catch (e) {
    return null;
  }
}

/* التوكن من الهيدر Authorization: Bearer ... */
export function bearer(request) {
  const h = request.headers.get("Authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

/* فحص: كم مفتاح عام قدر السيرفر يجيبه من Google (لازم أكثر من 0) */
export async function jwksCount(fetchImpl) {
  try { await getKey("-", fetchImpl); return Object.keys(keyCache.keys).length; } catch (e) { return -1; }
}

/* للاختبار المحلي بس */
export function _resetKeys() { keyCache = { at: 0, ttl: 0, keys: {} }; }
