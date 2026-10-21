/* أدوات اختبار دوال Cloudflare محلياً: توكن Firebase موقّع بمفتاح تجريبي (fetch لمفاتيح Google يرجّع مفتاحنا)،
   وكاش و Workers AI وهميين. ما فيه أي اتصال بالخدمات الحقيقية. */
import { webcrypto } from "node:crypto";
const subtle = webcrypto.subtle;
const b64u = buf => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function setupAuth() {
    const kp = await subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
    const jwk = await subtle.exportKey("jwk", kp.publicKey);
    const realFetch = globalThis.fetch;
    const routes = [];
    globalThis.fetch = async (url, init) => {
        const u = String(url && url.url || url);
        if (u.includes("securetoken@system.gserviceaccount.com")) return new Response(JSON.stringify({ keys: [Object.assign({ kid: "k1", alg: "RS256", use: "sig" }, jwk)] }), { headers: { "Cache-Control": "max-age=3600" } });
        for (const r of routes) if (r.match(u)) return r.handle(u, init);
        throw new Error("blocked fetch in test: " + u);
    };
    async function token(uid, email) {
        const now = Math.floor(Date.now() / 1000);
        const h = b64u(JSON.stringify({ alg: "RS256", kid: "k1", typ: "JWT" }));
        const p = b64u(JSON.stringify({ iss: "https://securetoken.google.com/masro7league", aud: "masro7league", sub: uid, email: email || uid + "@t", iat: now, exp: now + 3600, auth_time: now }));
        const sig = await subtle.sign("RSASSA-PKCS1-v1_5", kp.privateKey, new TextEncoder().encode(h + "." + p));
        return h + "." + p + "." + b64u(sig);
    }
    return { token, routes, restore: () => { globalThis.fetch = realFetch; } };
}

export function fakeCaches() {
    const m = new Map();
    globalThis.caches = { default: { match: async k => m.has(k.url) ? new Response(m.get(k.url)) : undefined, put: async (k, r) => { m.set(k.url, await r.text()); }, delete: async k => m.delete(k.url) } };
}

export function ctxFor(request, env) {
    const pending = [];
    return { request, env, waitUntil: p => pending.push(p), pending };
}

/* يشغّل الدالة ويستنى شغلها الخلفي (waitUntil) قبل ما يرجّع، مثل طلب حقيقي خلص */
export async function runFn(fn, request, env) {
    const c = ctxFor(request, env);
    const res = await fn(c);
    const body = await res.text();
    await Promise.all(c.pending);
    return new Response(body, { status: res.status, headers: res.headers });
}

export async function readNdjson(res) {
    const t = await res.text();
    return t.split("\n").filter(Boolean).map(l => JSON.parse(l));
}

let failed = 0;
export function check(name, cond, extra) { console.log((cond ? "PASS " : "FAIL ") + name + (extra !== undefined && !cond ? " → " + JSON.stringify(extra) : "")); if (!cond) failed++; }
export function done() { if (failed) { console.log(failed + " failed"); process.exit(1); } console.log("all passed"); }
