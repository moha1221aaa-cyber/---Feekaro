/* الأسئلة الصعبة للبث (GET /qbank): للمنظم بس، عشان أجوبتها ما تكون في ملف عام يحفظه المتسابقين قبل البث (فحص 25 أكتوبر، البند 19).
   الملف في lib/qbank-hard.js (ما ينتشر للعامة)، و bcLoadHard في js/broadcast/engine.js يطلبها وقت بداية البث */
import { verifyFirebaseToken, bearer } from "../lib/firebase-auth.js";
import HARD from "../lib/qbank-hard.js";

const ADMIN_EMAIL = "moha1221aaa@gmail.com"; /* نفسه في js/app.js و firestore.rules و functions/answer.js */
const json = (status, obj) => new Response(JSON.stringify(obj), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

export async function onRequestGet(context) {
  const user = await verifyFirebaseToken(bearer(context.request));
  if (!user) return json(401, { error: "سجّل دخول" });
  if (String(user.email || "").toLowerCase() !== ADMIN_EMAIL) return json(403, { error: "للمنظم بس" });
  return json(200, HARD);
}
