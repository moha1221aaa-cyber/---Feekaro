/* قراءة وثيقة عامة من Firestore (REST) بدون حساب خدمة: القواعد تسمح بقراءة room/** للكل،
   فالسيرفر يشوف نفس حالة البث اللي يشوفها المتسابقين (مين ضغط الجرس، المرحلة، الوقت) ويحكم عليها. */

export const FIRESTORE_BASE = "https://firestore.googleapis.com/v1/projects/masro7league/databases/(default)/documents/";
const API_KEY = "AIzaSyAHrRQENXrSZ6HxXRjNXrJTE7roG1a7m-4"; /* مفتاح Firebase العام (نفسه في js/config.js) */

/* قيم Firestore REST ({stringValue}، {integerValue}...) لقيم JS عادية */
export function fsValue(v) {
  if (!v || typeof v !== "object") return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return !!v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return Date.parse(v.timestampValue);
  if ("arrayValue" in v) return ((v.arrayValue && v.arrayValue.values) || []).map(fsValue);
  if ("mapValue" in v) return fsFields((v.mapValue && v.mapValue.fields) || {});
  return null;
}
export function fsFields(f) {
  const o = {};
  for (const k in f) o[k] = fsValue(f[k]);
  return o;
}

/* path مثل room/main/liveMatches/round_3 ← الوثيقة كـ object، أو null لو ما هي موجودة */
export async function readPublicDoc(path, fetchImpl) {
  if (!/^[A-Za-z0-9_\/-]{1,200}$/.test(path) || path.indexOf("..") !== -1) return null;
  const r = await (fetchImpl || fetch)(FIRESTORE_BASE + path + "?key=" + API_KEY, { headers: { Accept: "application/json" } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("firestore " + r.status);
  const j = await r.json();
  return fsFields(j.fields || {});
}
