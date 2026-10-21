/* ختم الأجوبة الصحيحة في وثيقة البث العامة (AES-GCM 256)، عشان محد يقدر يشوف الجواب من أدوات المطور.
   - المفتاح: سر LIVE_SEAL_KEY لو موجود في Cloudflare، وإلا يتشتق (HKDF-SHA256) من سر AGORA_APP_CERTIFICATE الموجود من قبل،
     فما يحتاج سر جديد. لو تغيّر السر، البثوث المختومة قبلها ما تنفتح (البث الجاي يختم من جديد).
   - كل ختم مربوط برقم البث ونص السؤال (AAD)، فما ينفع تنقل ختم من سؤال لسؤال أو من بث لبث.
   - الشكل: "v1." + base64url(iv 12 بايت + النص المشفّر). */

const enc = new TextEncoder(), dec = new TextDecoder();
const b64u = (bytes) => btoa(String.fromCharCode.apply(null, Array.from(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function unb64u(s) {
  s = String(s).replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const keyCache = new Map();
export async function sealKey(env) {
  const secret = String((env && (env.LIVE_SEAL_KEY || env.AGORA_APP_CERTIFICATE)) || "").trim();
  if (secret.length < 16) return null;
  if (keyCache.has(secret)) return keyCache.get(secret);
  const base = await crypto.subtle.importKey("raw", enc.encode(secret), "HKDF", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode("masro7-league"), info: enc.encode("live-answer-seal-v1") },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  keyCache.set(secret, key);
  return key;
}

const aad = (id, text) => enc.encode(String(id) + "\n" + String(text));

export async function seal(key, id, text, answer) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad(id, text) }, key, enc.encode(String(answer))));
  const all = new Uint8Array(12 + ct.length); all.set(iv); all.set(ct, 12);
  return "v1." + b64u(all);
}

/* يرجّع الجواب، أو null لو الختم غلط أو انعبث فيه أو لسؤال ثاني */
export async function unseal(key, id, text, sealed) {
  try {
    if (typeof sealed !== "string" || sealed.indexOf("v1.") !== 0 || sealed.length > 2000) return null;
    const all = unb64u(sealed.slice(3));
    if (all.length < 13) return null;
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: all.slice(0, 12), additionalData: aad(id, text) }, key, all.slice(12));
    return dec.decode(pt);
  } catch (e) { return null; }
}
