/* المشاهد السينمائية والأصوات الحقيقية (مؤثرات قصيرة بس، بدون موسيقى) */
/* =====================================================================
   المشاهد السينمائية + الأصوات الحقيقية للبث
   - كل الأصوات تسجيلات حقيقية (mp3 في مجلد audio/ مولّدة بـ ElevenLabs)، وما فيه أي صوت من المتصفح
   - مشهد سينمائي بين كل مواجهة، "انطلق!"، احتفال النتيجة، ألعاب نارية في الختام
   - بدون موسيقى أبد (22 أكتوبر 2026): لا خلفية ولا مقاطع موسيقية طويلة في المشاهد، بس المؤثرات القصيرة
   - مكساج منظم: كل صوت له مستوى ثابت، وما يتراكب أكثر من صوتين بنفس اللحظة
   ===================================================================== */
const CINE_REDUCED = (() => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } })();
/* ===== الوضع الخفيف للجوالات الضعيفة =====
   فيديو الاستوديو المتكرر + لقطات بحركة كاميرا وفلاتر + زجاج (backdrop-filter) + جزيئات: على جوال ضعيف تاخذ المعالج كله،
   فالجرس يتأخر (قسنا 300ms على أندرويد 10) والصوت يتقطع. الوضع الخفيف يوقف الفيديو على صورة ثابتة ويشيل الحركة والزجاج،
   وشكل البث نفسه (الألوان والمنصات والنص) ما يتغير. يشتغل لحاله: جهاز ضعيف (4 أنوية أو أقل، أو ذاكرة 2GB أو أقل)
   أو لو الإطارات تتأخر أول ما يفتح البث. ?lite=1 أو ?lite=0 للتجربة.
   وضع التبريد (23 أكتوبر 2026، "الجوالات تسخن وخصوصاً الآيفون"): أي جوال أو تابلت (آيفون وأندرويد وآيباد) يشتغل عليه الخفيف دايماً.
   فيديو الاستوديو بفلتر وحركة الخلفية والزجاج كانت ترسم كل إطار طول البث (ساعة وأكثر)، فالمعالج والشاشة شغالين على الآخر.
   الكمبيوتر يظل بالشكل الكامل */
function bcIsPhone() {
    try {
        const ua = navigator.userAgent || "";
        if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
        /* الآيباد يقول إنه ماك: نعرفه من اللمس */
        return navigator.maxTouchPoints > 1 && matchMedia("(pointer: coarse)").matches;
    } catch (e) { return false; }
}
let bcLite = (() => {
    try {
        const q = new URLSearchParams(location.search).get("lite");
        if (q === "1") return true;
        if (q === "0") return false;
        if (bcIsPhone()) return true;
        return (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 2;
    } catch (e) { return false; }
})();
const BC_LITE_FORCED = (() => { try { return new URLSearchParams(location.search).has("lite"); } catch (e) { return false; } })();
function bcApplyLite() {
    const scr = document.getElementById("liveScreen");
    if (scr) scr.classList.toggle("bc-lite", bcLite);
    const v = document.getElementById("stVideo");
    if (v) { if (bcLite) { try { v.pause(); } catch (e) {} } else if (v.paused) v.play().catch(() => {}); }
}
function bcSetLite(on, why) {
    if (bcLite === on) return;
    bcLite = on;
    bcApplyLite();
    try { if (typeof bcDiagPush === "function") bcDiagPush("perf", { at: bcNow(), lite: on, why: String(why || "").slice(0, 40) }); } catch (e) {}
}
/* ===== قياس الأداء على الجهاز نفسه (يطلع في لوحة التشخيص، liveDiag → bcDiag.<uid>.perf) =====
   كل 30 ث وقت البث: أطول رسم للشاشة، والمهام الطويلة (longtask)، وأطول تأخير بين لمسة وأول رسم بعدها (Event Timing)،
   عشان نعرف بالأرقام وش اللي يثقّل الجوال الحقيقي */
const BC_PERF = { renderMax: 0, renders: 0, longMs: 0, longN: 0, tapMax: 0, last: 0, obs: false };
function bcPerfRender(ms) { BC_PERF.renders++; if (ms > BC_PERF.renderMax) BC_PERF.renderMax = ms; }
function bcPerfStart() {
    if (BC_PERF.obs || typeof PerformanceObserver === "undefined") return;
    BC_PERF.obs = true;
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) { BC_PERF.longMs += e.duration; BC_PERF.longN++; } }).observe({ type: "longtask", buffered: false }); } catch (e) {}
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.name === "pointerdown" && e.duration > BC_PERF.tapMax) BC_PERF.tapMax = e.duration; }).observe({ type: "event", durationThreshold: 16 }); } catch (e) {}
}
function bcPerfTick(d) {
    bcPerfStart();
    const now = bcNow();
    if (!BC_PERF.last) { BC_PERF.last = now; return; }
    if (now - BC_PERF.last < 30000 || !d || d.status !== "live") return;
    const p = BC_PERF;
    /* المتسابقين والمنظم بس (اللوحة تعرضهم)، وبس لو فيه شي جديد: كل مشاهد يكتب كل 30 ث = كتابات كثير على وثيقة وحدة */
    const sig = [Math.round(p.renderMax / 10), p.longN, Math.round(p.tapMax / 10), bcLite].join("|");
    if (!(isAdmin || myLiveNum(d)) || sig === p.sig) { p.renderMax = 0; p.renders = 0; p.longMs = 0; p.longN = 0; p.tapMax = 0; p.last = now; return; }
    p.sig = sig;
    try { if (typeof bcDiagPush === "function") bcDiagPush("perf", { at: now, scene: d.scene + (d.phase ? "/" + d.phase : ""), lite: bcLite, renderMax: Math.round(p.renderMax), renders: p.renders, longMs: Math.round(p.longMs), longN: p.longN, tapMax: Math.round(p.tapMax) }); } catch (e) {}
    p.renderMax = 0; p.renders = 0; p.longMs = 0; p.longN = 0; p.tapMax = 0; p.last = now;
}
/* أول 5 ث من البث: لو أكثر من ربع الإطارات تاخذ فوق 50ms، نشغّل الخفيف (وما نرجع، عشان ما يرمش) */
function bcWatchFrames() {
    if (bcLite || BC_LITE_FORCED || bcWatchFrames.on) return;
    bcWatchFrames.on = true;
    let last = performance.now(), n = 0, slow = 0;
    const t0 = last;
    const step = ts => {
        const dt = ts - last; last = ts; n++;
        if (dt > 50) slow++;
        if (ts - t0 < 5000 && !document.hidden) return requestAnimationFrame(step);
        bcWatchFrames.on = false;
        if (n > 20 && slow / n > 0.25) bcSetLite(true, "frames " + slow + "/" + n);
    };
    requestAnimationFrame(step);
}
const CINE = { c: null, bus: null };

function cineGraph() {
    const c = liveCtx();
    if (CINE.c === c) return CINE;
    /* ليمتر ناعم عشان ما يطلع أي صوت عالي فجأة */
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 10; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.3;
    const master = c.createGain(); master.gain.value = 0.9;
    comp.connect(master); master.connect(c.destination);
    const bus = c.createGain(); bus.connect(comp);
    Object.assign(CINE, { c, bus });
    return CINE;
}
function cineNow() { return cineGraph().c.currentTime + 0.02; }

/* ===== مكتبة الأصوات الحقيقية =====
   g: تسوية مستوى كل ملف (عشان كلها تطلع بنفس العلو تقريباً قبل ما نحدد مستواها في المشهد) */
const CINE_FILES = {
    braam: { g: 0.4 }, riser: { g: 0.65 }, impact: { g: 0.53 }, whoosh: { g: 1 }, slam: { g: 0.57 },
    heartbeat: { g: 1 }, fireworks: { g: 0.7 },
    buzz: { g: 1.3 }, correct: { g: 1 }, wrong: { g: 0.78 }, tick: { g: 1.4 }, timeout: { g: 0.85 },
    /* طابع برامج المسابقات (مؤثرات قصيرة). الموسيقى (lobby، show_intro، interlude، decider، think2، outro، big_win) انشالت */
    reveal: { g: 0.83 }, match_end: { g: 0.81 }, applause: { g: 1 }, start_q: { g: 0.87 },
    /* نغمة شارة البداية (5.8 ث، مقطوعة من show_intro بتلاشي): طلب محمد 23 أكتوبر 2026، قبل الترحيب بالمتسابقين */
    ident: { g: 0.55 }
};
const CINE_BUF = {};
const CINE_LOADING = {};
/* الأصوات تتحمل حسب الحاجة: المؤثرات الصغيرة أول ما يفتح البث، والألعاب النارية (أكبر ملف) لما يقرب الختام */
const CINE_CORE = ["buzz", "correct", "wrong", "tick", "timeout", "heartbeat", "whoosh", "riser", "braam", "slam", "impact", "start_q", "reveal", "match_end", "applause"];
function cineNeedFor(d) {
    if (!d || d.status !== "live") return [];
    const left = (d.order || []).filter((o, i) => o.state === "pending" && i !== d.cur).length;
    if (d.scene === "closing" || (d.scene === "result" && !left)) return ["fireworks"];
    if (d.scene === "intro") return ["ident"];
    return [];
}
function cineLoadSamples(ids) {
    let c;
    try { c = cineGraph().c; } catch (e) { return; }
    (ids || CINE_CORE).forEach(id => {
        if (!CINE_FILES[id]) return;
        if (CINE_BUF[id] || CINE_LOADING[id]) return;
        CINE_LOADING[id] = fetch("audio/" + id + ".mp3")
            .then(r => {
                if (!r.ok || (r.headers.get("Content-Type") || "").indexOf("audio") === -1) throw new Error("no file");
                return r.arrayBuffer();
            })
            .then(ab => new Promise((res, rej) => c.decodeAudioData(ab, res, rej)))
            .then(b => { CINE_BUF[id] = b; })
            .catch(() => setTimeout(() => { delete CINE_LOADING[id]; }, 30000));
    });
}
/* يشغّل صوت حقيقي بمستوى v (0..1)
   o.tail: نشغّل آخر جزء بس (الرايزر يخلص بالضبط لحظة الضربة)، o.dur: نقصّه بتلاشي ناعم */
function cineS(id, t, v, o) {
    const b = CINE_BUF[id];
    if (!b) return false;
    /* وقت جوابي بالصوت ما يطلع أي مؤثر عندي (إلا صوت جرسي لحظة الضغط، قبل ما يبدأ التسجيل) */
    if (typeof VA !== "undefined" && VA.rec && id !== "buzz") return false;
    try {
        const G = cineGraph(), c = G.c;
        try { if (c.state === "suspended") c.resume(); } catch (e) {}
        const src = c.createBufferSource(); src.buffer = b;
        /* متى يخلص آخر مؤثر صوتي (الكاشف الحساس في voice-answer.js ما يحسب صوته كلام) */
        CINE.fxUntil = Math.max(CINE.fxUntil || 0, performance.now() + (Math.max(0, t - c.currentTime) + b.duration) * 1000);
        const g = c.createGain();
        const vol = (v == null ? 1 : v) * ((CINE_FILES[id] || {}).g || 1);
        g.gain.value = vol;
        src.connect(g); g.connect(G.bus);
        const off = (o && o.tail) ? Math.max(0, b.duration - o.tail) : 0;
        src.start(t || cineNow(), off);
        if (o && o.dur) {
            const st = t || cineNow();
            g.gain.setValueAtTime(vol, st + Math.max(0, o.dur - 0.5));
            g.gain.linearRampToValueAtTime(0.0001, st + o.dur);
            src.stop(st + o.dur + 0.05);
        }
        return true;
    } catch (e) { return false; }
}
function cinePlay(id, v, o) { return cineS(id, cineNow(), v, o); }

/* ===== محرك الجسيمات (شرارات، جمر، قصاصات، ألعاب نارية) ===== */
const CP = { cv: null, x: null, w: 0, h: 0, parts: [], raf: 0, emb: 0, last: 0, fw: 0 };
const CP_GOLD = ["#facc15", "#fde68a", "#fbbf24", "#ffffff"];
function cpAttach(cv) {
    CP.cv = cv; CP.x = cv.getContext("2d"); CP.parts = []; CP.emb = 0; CP.fw = 0;
    cpResize();
    if (!CP.raf) { CP.last = 0; CP.raf = requestAnimationFrame(cpLoop); }
}
function cpResize() {
    if (!CP.cv) return;
    const r = CP.cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    CP.w = r.width || 360; CP.h = r.height || 640;
    CP.cv.width = Math.round(CP.w * dpr); CP.cv.height = Math.round(CP.h * dpr);
    CP.x.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function cpMax() { return CINE_REDUCED ? 60 : (bcLite ? 120 : 650); }
function cpSpark(x, y, n, colors, speed) {
    return;   /* الشرارات شلناها عشان البث يكون أقرب للتلفزيون */
    colors = colors || CP_GOLD;
    n = Math.min(n, cpMax() - CP.parts.length);
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = (speed || 380) * (0.3 + Math.random());
        CP.parts.push({ k: "s", x, y, px: x, py: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6 + Math.random() * 0.8, max: 1.4, c: colors[i % colors.length], w: 1 + Math.random() * 2 });
    }
}
function cpConfetti(n) {
    const cols = ["#facc15", "#fde68a", "#38bdf8", "#ffffff", "#f59e0b", "#60a5fa"];
    n = Math.min(n, cpMax() - CP.parts.length);
    for (let i = 0; i < n; i++) {
        CP.parts.push({ k: "c", x: Math.random() * CP.w, y: -20 - Math.random() * CP.h * 0.5, vx: (Math.random() - 0.5) * 80, vy: 90 + Math.random() * 120,
            r: Math.random() * 6, vr: (Math.random() - 0.5) * 10, sw: Math.random() * 6, life: 6, max: 6, c: cols[i % cols.length], w: 5 + Math.random() * 5, h: 8 + Math.random() * 7 });
    }
}
function cpRocket() {
    if (CP.parts.length > cpMax() - 80) return;
    const cols = [["#facc15", "#fde68a", "#fff"], ["#38bdf8", "#93c5fd", "#fff"], ["#f97316", "#facc15", "#fff"], ["#a78bfa", "#38bdf8", "#fff"]];
    CP.parts.push({ k: "r", x: CP.w * (0.15 + Math.random() * 0.7), y: CP.h + 10, px: 0, py: 0, vx: (Math.random() - 0.5) * 60, vy: -(CP.h * 0.85 + Math.random() * CP.h * 0.35), life: 3, max: 3, cols: cols[Math.floor(Math.random() * cols.length)] });
}
function cpLoop(ts) {
    if (!CP.cv || !CP.cv.isConnected) { CP.raf = 0; CP.cv = null; CP.parts = []; CP.emb = 0; CP.fw = 0; return; }
    const dt = CP.last ? Math.min(0.05, (ts - CP.last) / 1000) : 0.016;
    CP.last = ts;
    const x = CP.x, W = CP.w, H = CP.h;
    x.clearRect(0, 0, W, H);
    if (CP.emb && CP.parts.length < cpMax() && Math.random() < CP.emb) {
        CP.parts.push({ k: "e", x: Math.random() * W, y: H + 5, vx: (Math.random() - 0.5) * 20, vy: -(25 + Math.random() * 55), life: 4 + Math.random() * 4, max: 8, c: Math.random() < 0.8 ? "#facc15" : "#7dd3fc", w: 0.8 + Math.random() * 1.8, ph: Math.random() * 6 });
    }
    if (CP.fw && ts > CP.fw) { cpRocket(); CP.fw = ts + 450 + Math.random() * 650; }
    const keep = [];
    for (const p of CP.parts) {
        p.life -= dt;
        if (p.life <= 0) continue;
        if (p.k === "e") {
            p.x += p.vx * dt + Math.sin(ts / 600 + p.ph) * 0.3; p.y += p.vy * dt;
            const al = Math.min(1, p.life / 1.5) * (0.5 + 0.5 * Math.sin(ts / 120 + p.ph));
            x.globalCompositeOperation = "lighter"; x.globalAlpha = al; x.fillStyle = p.c;
            x.beginPath(); x.arc(p.x, p.y, p.w, 0, 6.283); x.fill();
            x.globalAlpha = al * 0.25; x.beginPath(); x.arc(p.x, p.y, p.w * 4, 0, 6.283); x.fill();
        } else if (p.k === "s") {
            p.px = p.x; p.py = p.y;
            p.vx *= 1 - 1.6 * dt; p.vy = p.vy * (1 - 1.6 * dt) + 320 * dt;
            p.x += p.vx * dt; p.y += p.vy * dt;
            x.globalCompositeOperation = "lighter"; x.globalAlpha = Math.min(1, p.life * 1.5);
            x.strokeStyle = p.c; x.lineWidth = p.w; x.lineCap = "round";
            x.beginPath(); x.moveTo(p.px - p.vx * dt * 2, p.py - p.vy * dt * 2); x.lineTo(p.x, p.y); x.stroke();
        } else if (p.k === "c") {
            p.r += p.vr * dt; p.sw += dt * 4;
            p.x += (p.vx + Math.sin(p.sw) * 40) * dt; p.y += p.vy * dt;
            x.globalCompositeOperation = "source-over"; x.globalAlpha = Math.min(1, p.life);
            x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.scale(1, Math.cos(p.sw));
            x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); x.restore();
            if (p.y > H + 20) continue;
        } else if (p.k === "r") {
            p.px = p.x; p.py = p.y;
            p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
            x.globalCompositeOperation = "lighter"; x.globalAlpha = 1; x.strokeStyle = "#fde68a"; x.lineWidth = 2;
            x.beginPath(); x.moveTo(p.px, p.py + 10); x.lineTo(p.x, p.y); x.stroke();
            if (p.vy > -40) { cpSpark(p.x, p.y, 70, p.cols, 260); continue; }
        }
        keep.push(p);
    }
    x.globalAlpha = 1; x.globalCompositeOperation = "source-over";
    CP.parts = keep;
    CP.raf = requestAnimationFrame(cpLoop);
}

/* ===== أدوات المشهد ===== */
function cineFlash(el, peak, ms, color) {
    if (!el || !el.animate) return;
    const f = document.createElement("div");
    f.className = "cine-flash"; f.style.background = color || "#fff";
    el.appendChild(f);
    const an = f.animate([{ opacity: peak || 0.85 }, { opacity: 0 }], { duration: ms || 450, easing: "ease-out" });
    an.onfinish = () => f.remove();
}
function cineShake(px) {
    return;   /* الاهتزاز يخلي البث يحس إنه لعبة، فشلناه */
    const kf = [];
    for (let i = 0; i < 9; i++) {
        const k = px * (1 - i / 9);
        kf.push({ transform: `translate(${(Math.random() - 0.5) * 2 * k}px,${(Math.random() - 0.5) * 2 * k}px)` });
    }
    kf.push({ transform: "none" });
    ["liveScreenBody"].map(id => document.getElementById(id)).concat([document.querySelector("#liveScreen .cine")])
        .forEach(el => { if (el && el.animate) el.animate(kf, { duration: 520, easing: "ease-out" }); });
}
function cineOverlay(cls, html, ms) {
    const scr = document.getElementById("liveScreen");
    if (!scr) return null;
    scr.querySelectorAll(".cine").forEach(e => e.remove());
    const el = document.createElement("div");
    el.className = "cine " + (cls || "");
    el.innerHTML = `<canvas class="cine-cv"></canvas>` + (html || "");
    el._timers = [];
    scr.appendChild(el);
    cpAttach(el.querySelector(".cine-cv"));
    if (ms) el._timers.push(setTimeout(() => cineClose(el), ms));
    if (!/fxonly/.test(cls || "")) el.addEventListener("click", () => cineClose(el, true));
    return el;
}
/* فيديو Remotion (video/ في المستودع) فوق المشهد: صامت وبدون مسار صوت، ولو ما اشتغل يبان المشهد المرسوم تحته */
function cineVideo(el, src) {
    if (CINE_REDUCED) return;
    const v = document.createElement("video");
    /* webm (VP8) للمتصفحات اللي ما فيها H.264 (Chromium)، و mp4 للباقي (الآيفون) */
    if (v.canPlayType && v.canPlayType('video/mp4; codecs="avc1.42E01E"') === "" && v.canPlayType("video/webm") !== "") src = src.replace(/\.mp4$/, ".webm");
    v.className = "cine-vid"; v.src = src; v.muted = true; v.playsInline = true; v.autoplay = true; v.preload = "auto";
    v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("aria-hidden", "true");
    v.addEventListener("error", () => v.remove());
    v.addEventListener("playing", () => el.classList.add("has-vid"));
    const skip = el.querySelector(".cine-skip");
    el.insertBefore(v, skip || null);
    v.play().catch(() => v.remove());
    return v;
}
function cineOn(el, sel) { el.querySelectorAll(sel).forEach(e => e.classList.add("on")); }
function cineAt(el, sec, fn) {
    el._timers.push(setTimeout(() => { if (el.isConnected && !el._closing) { try { fn(); } catch (e) {} } }, sec * 1000));
}
function cineClose(el, skipped) {
    if (!el || !el.isConnected || el._closing) return;
    el._closing = true;
    el._timers.forEach(clearTimeout);
    if (skipped) {
        /* تخطي: نسكّت المؤثرات اللي باقية بسرعة */
        const G = cineGraph(), t = G.c.currentTime;
        G.bus.gain.cancelScheduledValues(t); G.bus.gain.setValueAtTime(G.bus.gain.value, t);
        G.bus.gain.linearRampToValueAtTime(0, t + 0.15); G.bus.gain.setValueAtTime(1, t + 3);
    }
    el.classList.add("out");
    setTimeout(() => el.remove(), 600);
}
function cineCloseAll() {
    document.querySelectorAll("#liveScreen .cine").forEach(e => { if (e._timers) e._timers.forEach(clearTimeout); e.remove(); });
}
function cineReady() {
    try { const c = liveCtx(); if (c.state === "suspended") c.resume(); } catch (e) {}
    const G = cineGraph(); G.bus.gain.cancelScheduledValues(G.c.currentTime); G.bus.gain.setValueAtTime(1, G.c.currentTime);
}
const CINE_BOLT = `<svg viewBox="0 0 100 180" aria-hidden="true"><path d="M58 0 L22 92 L48 92 L30 180 L82 70 L54 70 L74 0 Z" fill="rgba(253,224,71,.85)" stroke="#fff" stroke-width="2" style="filter:drop-shadow(0 0 14px #facc15) drop-shadow(0 0 30px #38bdf8)"/></svg>`;

/* ===== مشهد الافتتاح (أول ما يبدأ البث) ===== */
function cineOpening(d) {
    cineReady();
    const el = cineOverlay("", `
<div class="cine-beam l"></div><div class="cine-beam r"></div><div class="cine-beam c"></div>
<div class="cine-bar t"></div><div class="cine-bar b"></div>
<div class="cine-kicker">بث مباشر · LIVE</div>
<img src="logo.png" class="cine-logo" alt="">
<div class="cine-big stay" style="top:22%"><span class="cine-gold">بث الجولة ${escapeHTML(String(d.round || ""))}</span></div>
<div class="cine-onair"><span>ON AIR</span></div>
<div class="cine-skip">اضغط للتخطي</div>`, 6000);
    if (!el) return;
    cineVideo(el, "media/opening.mp4");
    /* بدون موسيقى افتتاح: تصاعد قصير ثم ضربة الشعار */
    cineAt(el, 0, () => cinePlay("riser", 0.7, { tail: 1.5 }));
    cineAt(el, 1.5, () => { cineOn(el, ".cine-logo"); cinePlay("braam", 1); cineFlash(el, 0.85); cineShake(10); cpSpark(CP.w / 2, CP.h * 0.37, 90); });
    cineAt(el, 2.3, () => cineOn(el, ".cine-big"));
    cineAt(el, 3.3, () => cineOn(el, ".cine-onair"));
    cineAt(el, 5.3, () => cineFlash(el, 1, 650));
}

/* ===== المشهد السينمائي بين كل مواجهة ومواجهة =====
   ترتيب الأصوات (صوت واحد بكل لحظة): تصاعد ← براام ← ووش لكل متسابق ← رعد VS ← ووش للمشهد */
function cineMatchIntro(d) {
    const o = bcCur(d);
    if (!o) return;
    cineReady();
    const total = (d.order || []).length, n = d.cur + 1;
    const el = cineOverlay("", `
<div class="cine-beam l"></div><div class="cine-beam r"></div><div class="cine-beam c"></div>
<div class="cine-bar t"></div><div class="cine-bar b"></div>
<div class="cine-kicker">دوري بنو مسروح للنخبة · الجولة ${escapeHTML(String(d.round || ""))}</div>
<div class="cine-big"><span class="cine-gold">المواجهة ${escapeHTML(BC_AR_NUM_F[d.cur] || String(n))}</span></div>
<div class="cine-duel">
<div class="cine-p p1"><div class="av"><img src="${safeSrc(bcAv(o, 1))}" alt=""></div><b>${escapeHTML(o.p1)}</b></div>
<div class="cine-vs">${CINE_BOLT}VS<i class="rg"></i><i class="rg two"></i></div>
<div class="cine-p p2"><div class="av"><img src="${safeSrc(bcAv(o, 2))}" alt=""></div><b>${escapeHTML(o.p2)}</b></div>
</div>
<div class="cine-of">المواجهة ${n} من ${total} · ${LIVE_Q_COUNT} أسئلة</div>
<div class="cine-skip">اضغط للتخطي</div>`, 7000);
    if (!el) return;
    cineAt(el, 0, () => cinePlay("riser", 0.7, { tail: 1.5 }));
    cineAt(el, 1.5, () => { cineOn(el, ".cine-big"); cinePlay("braam", 1); cineFlash(el, 0.85); cineShake(11); cpSpark(CP.w / 2, CP.h * 0.5, 80); });
    cineAt(el, 3.1, () => { cineOn(el, ".cine-p.p1"); cinePlay("whoosh", 0.7); cpSpark(CP.w * 0.78, CP.h * 0.48, 30, ["#38bdf8", "#93c5fd", "#fff"]); });
    cineAt(el, 3.45, () => { cineOn(el, ".cine-p.p2"); cinePlay("whoosh", 0.7); cpSpark(CP.w * 0.22, CP.h * 0.48, 30, ["#38bdf8", "#93c5fd", "#fff"]); });
    cineAt(el, 4.0, () => {
        cineOn(el, ".cine-vs"); cinePlay("slam", 1);
        cineFlash(el, 0.95, 500); cineFlash(el, 0.5, 900, "#38bdf8"); cineShake(17);
        cpSpark(CP.w / 2, CP.h * 0.48, 140, null, 520);
    });
    cineAt(el, 4.4, () => cineOn(el, ".cine-of"));
    cineAt(el, 6.4, () => { cinePlay("whoosh", 0.6); cineFlash(el, 1, 650); });
}

/* ===== شارة البداية: أول ما يضغطون الاثنين "جاهز"، قبل الترحيب (مثل دخول البرنامج في التلفزيون) =====
   شعار الدوري واسمه (مرسوم، بدون فيديو عشان ما يتغطى النص)، ونغمة البداية، وبعدها أسماء المواجهة. at: لحظة المشهد بساعة السيرفر،
   فالجوال المتأخر يدخل من نفس المكان، ولو فاتت الشارة كلها ما تطلع. يرجّع مدتها المتبقية بالـ ms */
const CINE_IDENT_MS = 5600;
function cineIdent(d, at) {
    const o = bcCur(d);
    const late = Math.max(0, at ? bcNow() - at : 0);
    if (!o || late > CINE_IDENT_MS - 1500) return 0;
    cineReady();
    const el = cineOverlay("ident", `
<div class="cine-bar t"></div><div class="cine-bar b"></div>
<img src="logo.png" class="cine-logo" alt="">
<div class="cine-idname"><span class="cine-gold">دوري بنو مسروح للنخبة</span><small>MASRO7 LEAGUE</small></div>
<div class="cine-idmatch">المواجهة ${escapeHTML(BC_AR_NUM_F[d.cur] || String(d.cur + 1))}<b>${escapeHTML(o.p1)} <i>ضد</i> ${escapeHTML(o.p2)}</b></div>
<div class="cine-skip">اضغط للتخطي</div>`, CINE_IDENT_MS - late);
    if (!el) return 0;
    const at0 = s => Math.max(0, s - late / 1000);
    if (late < SHOW_SOUND_LATE) cinePlay("ident", 0.9) || cinePlay("braam", 0.8);
    cineAt(el, at0(0.25), () => { cineOn(el, ".cine-logo"); cineFlash(el, 0.7, 500); });
    cineAt(el, at0(1.1), () => cineOn(el, ".cine-idname"));
    cineAt(el, at0(2.6), () => { cineOn(el, ".cine-idmatch"); cinePlay("whoosh", 0.4); });
    cineAt(el, at0(5.0), () => cineFlash(el, 1, 550));
    return CINE_IDENT_MS - late;
}

/* ===== "انطلق!" لحظة بداية الأسئلة ===== */
function cineGo(at) {
    const late = at ? bcNow() - at : 0;
    if (late > 1200) return;   /* "انطلق!" خلصت عند الكل */
    cineReady();
    const el = cineOverlay("fxonly", `<div class="cine-go"><span class="cine-gold">انطلق!</span></div>`, Math.max(200, 1400 - Math.max(0, late)));
    if (!el) return;
    showSync(el, at);
    if (late < SHOW_SOUND_LATE) cinePlay("start_q", 0.8) || cinePlay("impact", 0.8);
    cineFlash(el, 0.6, 350); cineShake(9);
    setTimeout(() => cpSpark(CP.w / 2, CP.h * 0.45, 90, null, 450), 30);
}

/* ===== احتفال النتيجة: نغمة نهاية المواجهة ← تصفيق استوديو (أعلى واحتفال أكبر للفوز الساحق والعودة) ===== */
function cineResult(d) {
    cineReady();
    const it = d ? Object.assign({}, (d.order || [])[d.cur] || {}, { s1: d.s1 || 0, s2: d.s2 || 0, bh1: d.bh1, bh2: d.bh2 }) : {};
    const big = !!bcWinKind(it);
    cinePlay("match_end", 0.8);
    const el = cineOverlay("fxonly", "", big ? 8000 : 6500);
    if (!el) return;
    cineAt(el, 1.2, () => {
        cinePlay("applause", big ? 0.75 : 0.55);
        cineFlash(el, big ? 0.8 : 0.5, 500, "#facc15"); cineShake(big ? 14 : 8);
        cpConfetti(big ? 260 : 150); cpSpark(CP.w / 2, CP.h * 0.35, big ? 160 : 80);
    });
    cineAt(el, 2.4, () => cpConfetti(big ? 160 : 90));
    if (big) { cineAt(el, 3.2, () => { cpSpark(CP.w * 0.25, CP.h * 0.3, 90); cpSpark(CP.w * 0.75, CP.h * 0.3, 90); }); }
}

/* ===== ألعاب نارية في ختام الجولة ===== */
function cineClosing() {
    cineReady();
    const el = cineOverlay("fxonly", "", 9000);
    if (!el) return;
    cineAt(el, 0.6, () => { cinePlay("applause", 0.6); cinePlay("fireworks", 0.35); cpConfetti(120); CP.fw = performance.now() + 300; });
    cineAt(el, 7.5, () => { CP.fw = 0; });
}

/* مؤثرات تلقائية: صوت "انتهى الوقت" مرة وحدة لما يخلص وقت المتسابق */
function bcAutoFx(d) {
    const last = d.lastAnswer;
    const view = { lt: last && last.timeout ? (d.cur + "_" + d.qIndex + "_" + last.by) : "" };
    const p = bcAutoFx.prev;
    bcAutoFx.prev = view;
    if (!p || d.status !== "live") return;
    if (view.lt && view.lt !== p.lt) cinePlay("timeout", 0.5);
}
