const { RtcTokenBuilder, RtcRole } = require("agora-token");

const CHANNEL = "masro7_main_room";
const TTL_SECONDS = 60 * 60 * 24;

const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

exports.handler = async () => {
  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;

  if (!appId || !appCertificate) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "متغيرات البيئة AGORA_APP_ID / AGORA_APP_CERTIFICATE غير مضافة في Netlify" })
    };
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
    return { statusCode: 200, headers, body: JSON.stringify({ token }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(err && err.message || err) }) };
  }
};
