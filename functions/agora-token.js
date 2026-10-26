/* توليد Token أجورا على Cloudflare Pages (بديل دالة Netlify)
   نفس صيغة مكتبة agora-token الرسمية (AccessToken2 / 007) لكن بأدوات Cloudflare نفسها */

import { verifyFirebaseToken, bearer } from "../lib/firebase-auth.js";

const CHANNELS = ["masro7_main_room", "masro7_live_round", "masro7_live_rehearsal"];   /* rehearsal: البث الخاص (بروفة المنظم لحاله) */
const DEFAULT_APP_ID = "6affdf8140bb4004b2ec1ba75d202bbc";
const TTL_SECONDS = 60 * 60 * 24;
const HEX32 = /^[0-9a-fA-F]{32}$/;

const clean = (v) => String(v || "").replace(/[\s​-‏‪-‮⁦-⁩﻿]/g, "");
const json = (status, obj) => new Response(JSON.stringify(obj), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
});

const enc = new TextEncoder();
const u16 = (v) => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, true); return b; };
const u32 = (v) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0, true); return b; };
const cat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const bytes = (b) => cat(u16(b.length), b);
const str = (s) => bytes(enc.encode(s));

async function hmac(key, msg) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, msg));
}

async function deflate(data) {
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function b64(u8) {
  let s = "";
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

/* مثل RtcTokenBuilder.buildTokenWithUid(appId, cert, channel, 0, PUBLISHER أو SUBSCRIBER, ttl, ttl)
   publisher=false: دخول بس (استماع)، وهذا اللي ياخذه الضيف */
export async function buildRtcToken(appId, appCertificate, channel, ttl, issueTs, salt, publisher) {
  if (publisher === undefined) publisher = true;
  issueTs = issueTs || Math.floor(Date.now() / 1000);
  salt = salt || (Math.floor(Math.random() * 99999999) + 1);

  let signing = await hmac(u32(issueTs), enc.encode(appCertificate));
  signing = await hmac(u32(salt), signing);

  /* خدمة RTC: النوع 1 + الصلاحيات (دخول، صوت، فيديو، بيانات) + القناة + uid فاضي (= أي رقم) */
  const privileges = publisher
    ? cat(u16(4), u16(1), u32(ttl), u16(2), u32(ttl), u16(3), u32(ttl), u16(4), u32(ttl))
    : cat(u16(1), u16(1), u32(ttl));
  const service = cat(u16(1), privileges, str(channel), str(""));

  const signingInfo = cat(str(appId), u32(issueTs), u32(ttl), u32(salt), u16(1), service);
  const signature = await hmac(signing, signingInfo);
  const content = cat(bytes(signature), signingInfo);
  return "007" + b64(await deflate(content));
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const q = url.searchParams.get("channel");
  const channel = CHANNELS.indexOf(q) !== -1 ? q : CHANNELS[0];

  const env = context.env || {};
  const appId = clean(env.AGORA_APP_ID) || DEFAULT_APP_ID;
  const appCertificate = clean(env.AGORA_APP_CERTIFICATE);

  if (!appCertificate) return json(500, { error: "متغير AGORA_APP_CERTIFICATE غير مضاف في Cloudflare" });
  if (!HEX32.test(appId)) return json(500, { error: "قيمة AGORA_APP_ID غير صحيحة: طولها " + appId.length + " والمطلوب 32" });
  if (!HEX32.test(appCertificate)) return json(500, { error: "قيمة AGORA_APP_CERTIFICATE غير صحيحة: طولها " + appCertificate.length + " والمطلوب 32" });

  try {
    /* المسجّل دخول (توكن Firebase سليم) ياخذ صلاحية المايك، والضيف استماع بس */
    const user = await verifyFirebaseToken(bearer(context.request));
    const token = await buildRtcToken(appId, appCertificate, channel, TTL_SECONDS, 0, 0, !!user);
    return json(200, { token, role: user ? "publisher" : "subscriber" });
  } catch (err) {
    return json(500, { error: String((err && err.message) || err) });
  }
}
