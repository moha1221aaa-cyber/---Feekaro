/* أداة اختبار البث محلياً بدون أي كتابة في القاعدة الحقيقية:
   - الموقع نفسه (index.html و js/ و css/) من سيرفر محلي
   - Firebase بديل (fake-firebase.js) وكل الأجهزة تشترك بقاعدة وحدة هنا (مع تأخير شبكة وهمي)
   - أجورا بديل (fake-agora.js) والمايك من Chromium الوهمي (--use-file-for-fake-audio-capture)
   - /ai و /time و /tts و /agora-token و /answer ردود محلية (stubs) يحددها كل اختبار */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch (e) { pw = require("/opt/node22/lib/node_modules/playwright"); }
export const { chromium } = pw;

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "..", "..");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".json": "application/json", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };

export const PORT = Number(process.env.HARNESS_PORT) || 8787;   /* HARNESS_PORT لو 8787 مشغول */
export function serve(port) {
    port = PORT;
    const srv = http.createServer((req, res) => {
        let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
        if (p === "/") p = "/index.html";
        const f = path.join(ROOT, p);
        if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("nf"); }
        res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
        fs.createReadStream(f).pipe(res);
    });
    return new Promise(r => srv.listen(port, () => r(srv)));
}

/* ===== القاعدة المشتركة ===== */
export class FakeDB {
    constructor(latency) { this.docs = new Map(); this.subs = new Map(); this.latency = latency == null ? 60 : latency; this.log = []; }
    static setPath(o, key, v) {
        const ks = key.split("."); let c = o;
        for (let i = 0; i < ks.length - 1; i++) { if (!c[ks[i]] || typeof c[ks[i]] !== "object") c[ks[i]] = {}; c = c[ks[i]]; }
        if (v && v.__fv === "del") delete c[ks[ks.length - 1]]; else c[ks[ks.length - 1]] = v;
    }
    static fv(v) {
        if (Array.isArray(v)) return v.map(FakeDB.fv);
        if (v && typeof v === "object") {
            if (v.__fv === "ts") return { __ts: Date.now() };
            const o = {}; for (const k in v) o[k] = FakeDB.fv(v[k]); return o;
        }
        return v;
    }
    get(p) { const r = this.docs.get(p); return r ? JSON.parse(JSON.stringify(r)) : null; }
    data(p) { const r = this.docs.get(p); return r ? r.data : null; }
    write(w) {
        const cur = this.docs.get(w.path);
        if (w.op === "delete") this.docs.delete(w.path);
        else if (w.op === "set") {
            const base = w.merge && cur ? cur.data : {};
            const d = FakeDB.fv(w.data);
            /* set مع merge في Firestore يدمج الخرائط المتداخلة (والمصفوفات تنستبدل) */
            const deep = (o, x) => { for (const k in x) { const v = x[k]; if (v && v.__fv === "del") delete o[k]; else if (w.merge && v && typeof v === "object" && !Array.isArray(v) && o[k] && typeof o[k] === "object" && !Array.isArray(o[k])) { o[k] = Object.assign({}, o[k]); deep(o[k], v); } else o[k] = v; } return o; };
            const out = deep(w.merge ? JSON.parse(JSON.stringify(base)) : {}, d);
            this.docs.set(w.path, { data: out, ver: (cur ? cur.ver : 0) + 1 });
        } else if (w.op === "update") {
            if (!cur) { const e = new Error("not-found"); e.code = "not-found"; throw e; }
            const d = JSON.parse(JSON.stringify(cur.data));
            const upd = w.data;
            for (const k in upd) FakeDB.setPath(d, k, upd[k] && upd[k].__fv === "del" ? upd[k] : FakeDB.fv(upd[k]));
            this.docs.set(w.path, { data: d, ver: cur.ver + 1 });
        }
        this.log.push({ at: Date.now(), path: w.path, op: w.op, keys: Object.keys(w.data || {}) });
        this.changed(w.path);
    }
    list(col) {
        const out = [];
        for (const [p, r] of this.docs) if (p.slice(0, p.lastIndexOf("/")) === col) out.push({ path: p, rec: JSON.parse(JSON.stringify(r)) });
        return out;
    }
    changed(p) {
        const parent = p.slice(0, p.lastIndexOf("/"));
        for (const [k, s] of this.subs) {
            if (s.kind === "doc" && s.path === p) this.push(s, this.get(p));
            if (s.kind === "col" && s.path === parent) this.push(s, this.list(parent));
        }
    }
    push(s, payload) {
        /* page.__extraLat: جهاز نته أبطأ (التحديثات توصله متأخرة) */
        setTimeout(() => { s.page.evaluate(([id, pl]) => window.__dbPush && window.__dbPush(id, pl), [s.id, payload]).catch(() => {}); }, this.latency + (s.page.__extraLat || 0));
    }
    async op(page, op, a) {
        await new Promise(r => setTimeout(r, this.latency));
        switch (op) {
            case "get": return this.get(a.path);
            case "list": return this.list(a.path);
            case "set": return this.write({ op: "set", path: a.path, data: a.data, merge: a.merge });
            case "update": return this.write({ op: "update", path: a.path, data: a.data });
            case "delete": return this.write({ op: "delete", path: a.path });
            case "sub": {
                const s = { page, id: a.id, path: a.path, kind: a.kind };
                this.subs.set(page.__hid + ":" + a.id, s);
                this.push(s, a.kind === "doc" ? this.get(a.path) : this.list(a.path));
                return true;
            }
            case "unsub": this.subs.delete(page.__hid + ":" + a.id); return true;
            case "commit": {
                for (const r of a.reads) { const c = this.docs.get(r.path); if ((c ? c.ver : 0) !== r.ver) return false; }
                for (const w of a.writes) this.write(w);
                return true;
            }
        }
        throw new Error("op " + op);
    }
}

/* ===== بيانات تجريبية ===== */
export const QUESTIONS = [
    { text: "ما عاصمة السعودية؟", answer: "الرياض" },
    { text: "ما أكبر كوكب في المجموعة الشمسية؟", answer: "المشتري" },
    { text: "كم عدد قارات العالم؟", answer: "7|سبع|سبعة" },
    { text: "ما عاصمة اليابان؟", answer: "طوكيو" },
    { text: "ما أسرع حيوان بري؟", answer: "الفهد" }
];
export function seed(db, scene, extra) {
    const now = Date.now();
    db.docs.set("league/current", { ver: 1, data: {
        playersList: ["سعد", "فهد", "خالد", "ناصر"],
        matches: [
            { p1: "سعد", p2: "خالد", s1: "3", s2: "1", round: 1 }, { p1: "فهد", p2: "ناصر", s1: "2", s2: "2", round: 1 },
            { p1: "سعد", p2: "فهد", s1: "", s2: "", round: 2 }, { p1: "خالد", p2: "ناصر", s1: "", s2: "", round: 2 }
        ],
        playerLinks: { "سعد": "u_p1", "فهد": "u_p2" }
    } });
    for (const [uid, name] of [["u_host", "محمد"], ["u_p1", "سعد"], ["u_p2", "فهد"]]) db.docs.set("users/" + uid, { ver: 1, data: { name, email: uid + "@t" } });
    db.docs.set("room/main", { ver: 1, data: { qbank: QUESTIONS.slice(), mics: {}, chat: [] } });
    const order = [
        { p1: "سعد", p2: "فهد", uid1: "u_p1", uid2: "u_p2", av1: "", av2: "", s1: 0, s2: 0, state: "pending", applied: false },
        { p1: "خالد", p2: "ناصر", uid1: "", uid2: "", av1: "", av2: "", s1: 0, s2: 0, state: "pending", applied: false }
    ];
    db.docs.set("room/main/liveMatches/round_2", { ver: 1, data: Object.assign({
        ready1: false, ready2: false, qIndex: 0, phase: "wait", buzzer: 0, answerer: 0, tried1: false, tried2: false, passed: false,
        lastAnswer: null, outcome: 0, deadline: 0, s1: 0, s2: 0, log: [-1, -1, -1, -1, -1], fb1: 0, fb2: 0, bh1: 0, bh2: 0, qAt: 0, golden: 0,
        aiLines: null, type: "round", round: 2, status: "live", scene: scene || "intro", cur: 0, order,
        startAt: now, startedAt: now, hostUid: "u_host", hostName: "محمد", hostAv: "",
        questions: QUESTIONS.slice(), usedQ: [], sceneAt: now - 60000, hostSeen: now, v: 1
    }, extra || {}) });
}

/* ===== تشغيل الأجهزة ===== */
export async function launch(opts) {
    opts = opts || {};
    const args = ["--autoplay-policy=no-user-gesture-required", "--use-fake-device-for-media-stream"];
    if (opts.wav) args.push("--use-file-for-fake-audio-capture=" + path.join(HERE, "audio", opts.wav));
    if (opts.allowMic !== false) args.push("--use-fake-ui-for-media-stream");
    const browser = await chromium.launch({ args, headless: true });
    return browser;
}

export async function device(browser, db, who, opts) {
    opts = opts || {};
    const ctx = await browser.newContext({
        viewport: opts.viewport || { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: "ar-SA",
        permissions: opts.allowMic === false ? [] : ["microphone"], reducedMotion: opts.reducedMotion || "no-preference",
        recordVideo: opts.video ? { dir: opts.video, size: { width: 390, height: 844 } } : undefined
    });
    let hid = 0;
    await ctx.exposeBinding("__db", (src, op, a) => db.op(src.page, op, a));
    const fakeFb = fs.readFileSync(path.join(HERE, "fake-firebase.js"), "utf8");
    const fakeAg = fs.readFileSync(path.join(HERE, "fake-agora.js"), "utf8");
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => {
        const u = r.request().url();
        if (u.includes("firebase-app-compat")) return r.fulfill({ contentType: "text/javascript", body: fakeFb });
        if (u.includes("firebasejs")) return r.fulfill({ contentType: "text/javascript", body: "" });
        if (u.includes("AgoraRTC")) return r.fulfill({ contentType: "text/javascript", body: fakeAg });
        if (r.request().resourceType() === "image") return r.fulfill({ contentType: "image/png", body: fs.readFileSync(path.join(ROOT, "icon-192.png")) });
        return r.abort();
    });
    const api = opts.api || {};
    await ctx.route(/\/(time|tts|agora-token|ai|answer)(\?|$)/, async r => {
        const u = new URL(r.request().url());
        const name = u.pathname.slice(1);
        if (name === "time") return r.fulfill({ contentType: "application/json", body: JSON.stringify({ t: Date.now() }) });
        if (name === "agora-token") return r.fulfill({ contentType: "application/json", body: JSON.stringify({ token: "007test" }) });
        const h = api[name];
        if (!h) return r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "off" }) });
        let body = {}; try { body = r.request().postDataJSON() || {}; } catch (e) {}
        const out = await h(body, { who, url: u, headers: r.request().headers() });
        if (out && out.raw) return r.fulfill(out.raw);
        return r.fulfill({ status: (out && out.status) || 200, contentType: "application/json", body: JSON.stringify(out && out.json !== undefined ? out.json : out) });
    });
    await ctx.addInitScript(() => { try { localStorage.setItem("bcVoiceOn", "1"); } catch (e) {} });
    const page = await ctx.newPage();
    page.__hid = who + (++hid);
    page.__logs = [];
    page.on("console", m => page.__logs.push(m.type() + ": " + m.text()));
    page.on("pageerror", e => page.__logs.push("PAGEERROR: " + e.message));
    page.on("dialog", d => d.accept());
    await page.goto(`${opts.base || "http://127.0.0.1:" + PORT}/index.html?as=${who}&live=${opts.live || "round_2"}`);
    return page;
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function until(fn, ms, step) {
    const t0 = Date.now();
    for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > (ms || 10000)) return null; await sleep(step || 50); }
}
export function liveDoc(db) { return db.data("room/main/liveMatches/round_2"); }
