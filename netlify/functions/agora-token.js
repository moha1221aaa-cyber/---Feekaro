const { RtcTokenBuilder, RtcRole } = require("agora-token");

const CHANNEL = "masro7_main_room";
const TTL_SECONDS = 60 * 60 * 24;
const HEX32 = /^[0-9a-fA-F]{32}$/;

const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

const clean = (v) =>
  String(v || "").replace(/[\s\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "");

const fail = (message) => ({
  statusCode: 500,
  headers,
  body: JSON.stringify({ error: message })
});

exports.handler = async () => {
  const appId = clean(process.env.AGORA_APP_ID);
  const appCertificate = clean(process.env.AGORA_APP_CERTIFICATE);

  if (!appId || !appCertificate) {
    return fail("متغيرات البيئة AGORA_APP_ID / AGORA_APP_CERTIFICATE غير مضافة في Netlify");
  }
  if (!HEX32.test(appId)) {
    return fail("قيمة AGORA_APP_ID غير صحيحة: طولها " + appId.length + " والمطلوب 32");
  }
  if (!HEX32.test(appCertificate)) {
    return fail("قيمة AGORA_APP_CERTIFICATE غير صحيحة: طولها " + appCertificate.length + " والمطلوب 32");
  }

  try {
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      CHANNEL,
      0,
      RtcRole.PUBLISHER,
      TTL_SECONDS,
      TTL_SECONDS
    );
    if (!token) {
      return fail("تعذّر توليد Token: تحقق من قيم أجورا");
    }
    return { statusCode: 200, headers, body: JSON.stringify({ token }) };
  } catch (err) {
    return fail(String((err && err.message) || err));
  }
};
