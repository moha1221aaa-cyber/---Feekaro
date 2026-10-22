/* جواب المتسابق بالصوت: بعد ما يفوز بالجرس يقول جوابه بدل ما يكتبه.
   - التسجيل من نفس مايك البث (bcTrack في voice.js) عشان ما ينفتح المايك مرتين (الآيفون يكتم الأول).
   - يبدأ لحظة ضغط الجرس (vaArm) قبل ما يرد السيرفر، عشان أول كلمة ما تضيع، ولو فاز بالجرس يكمل نفس التسجيل.
   - التسجيل على AudioWorklet (va-worklet.js، خيط الصوت نفسه)، ولو المتصفح قديم يرجع لـ ScriptProcessor.
   - كاشف الكلام (vaVadCreate في va-worklet.js): أرضية ضجة بأقل طاقة في آخر 1.5 ث، فالموسيقى المستمرة ما تنحسب كلام.
   - يوقف لحاله أول ما يسكت المتسابق بعد جوابه (0.55 ث)، أو بعد 6 ث من أول كلمة، أو قبل نهاية الوقت بـ 1.5 ث.
   - أول جواب هو اللي ينحسب (ما فيه تغيير)، وما فيه أزرار: كل شي تلقائي.
   - نص مباشر: لو الكلام طويل (1.2 ث) نرسل اللي انقال للحين لـ Whisper ونعرضه، وبعد ما يخلص السيرفر يرد على دفعتين:
     أول شي النص اللي سمعه (يطلع على طول)، وبعدها الحكم.
   - لو الصوت ما اشتغل (ما فيه مايك، ما سمع شي، السيرفر تعطل) يطلع مربع الكتابة احتياط.
   - التشخيص: آخر 5 محاولات في liveDiag/<id> → vaDiag.<uid> (كل محاولة: خطواتها، طريقة التسجيل، مدة الكلام، اللي انسمع، والحكم). */

const VA_RATE = 16000;           /* Whisper يشتغل على 16 كيلوهرتز */
const VA_SILENCE_MS = 550;       /* سكوت بعد الكلام = خلص جوابه (أول جواب ينحسب، فما نستنى). كان 800 ومحمد قال يتأخر */
const VA_MIN_SPEECH_MS = 300;    /* أقل كلام نعتبره جواب (الكاشف الجديد أدق، فنقبل كلمة قصيرة) */
const VA_STOP_BEFORE_MS = 1500;  /* نوقف قبل نهاية الوقت بشوي */
const VA_EXTEND_MS = 10000;      /* وقت التحقق من الصوت (الوقت يتمدد له أول ما يخلص المتسابق) */
const VA_MAX_MS = 6000;          /* أطول جواب: بعد 6 ث من أول كلمة نوقف حتى لو فيه صوت */
const VA_ARM_MS = 5000;          /* التسجيل المبكر ينلغى لو السيرفر ما أكد إني فزت بالجرس خلال 5 ث */
const VA_PARTIAL_MS = 1200;      /* كلام أطول من كذا: نعرض نص مباشر قبل ما يخلص */
const VA_PAD_MS = 300;           /* نخلي 0.3 ث قبل أول كلمة وبعد آخر كلمة في الملف المرسل */
const VA_LOUD = 0.08;            /* صوت أعلى من كذا بدون ما ينكشف كلام: ينرسل للسيرفر احتياط */
const VA_SOFT_MS = 250;          /* الكاشف الحساس (احتياط): كلام واطي أو مقطّع بهالطول ينرسل للسيرفر بدل الكتابة */
const VA_SOFT_IGNORE_MS = 500;   /* أول نص ثانية من الضغط: صوت الجرس ودقة الإصبع ما تنحسب للحساس */
const VA_QUIET_MS = 5000;        /* 5 ث بدون أي كلام من بداية الدور: نطلّع الكتابة بدل ما ننتظر نهاية الوقت */

/* st: "" | "rec" (يسمع) | "think" (يتحقق) | "type" (الكتابة احتياط) | "done" */
const VA = { key: "", st: "", msg: "", heard: "", said: "", ok: false, ctx: null, rec: null, arm: null, try: null, live: "" };

/* نسجّل على نفس AudioContext حق البث (liveCtx في engine.js) لأنه شغّال من لحظة فتح شاشة البث (ضغطة حقيقية).
   كان ينسوى واحد جديد وقت ضغطة الجرس (pointerdown)، واللمس ما يعتبر إذن تشغيل في الجوال، فيظل معلّق وما يسجّل شي */
function vaPrime() {
    try {
        VA.ctx = liveCtx();
        if (VA.ctx.state === "suspended") VA.ctx.resume().catch(() => {});
        vaWorkletReady(VA.ctx);   /* نحمّل معالج التسجيل مبكر عشان أول جواب ما يتأخر */
    } catch (e) {}
}

/* معالج AudioWorklet يتحمّل مرة وحدة لكل AudioContext */
let vaWorkletP = null, vaWorkletCtx = null;
function vaWorkletReady(ctx) {
    if (!ctx.audioWorklet || typeof AudioWorkletNode === "undefined") return Promise.resolve(false);
    if (vaWorkletCtx !== ctx) { vaWorkletCtx = ctx; vaWorkletP = ctx.audioWorklet.addModule("js/broadcast/va-worklet.js").then(() => true, () => false); }
    return vaWorkletP;
}

/* تشخيص: كل محاولة (دور) لها سجل، وآخر 5 محاولات تنكتب في liveDiag/<id> (vaDiag.<uid>) عشان نعرف وش صار لو ما اشتغل */
function vaDiag(st, extra) {
    try {
        if (!openLiveId || !currentUser) return;
        const d = liveMatchesCache[openLiveId] || {};
        if (!VA.try || VA.try.key !== VA.key) VA.try = { key: VA.key, at: bcNow(), q: d.cur + "_" + d.qIndex, steps: [], ua: (navigator.userAgent || "").slice(0, 90) };
        const t = VA.try;
        t.steps.push(st);
        Object.assign(t, extra || {}, { ctx: VA.ctx ? VA.ctx.state : "" });
        const k = openLiveId + "|va";
        const list = (bcDiagMine[k] || []).filter(x => x && x.at !== t.at);
        const entry = Object.assign({}, t); delete entry.key;
        list.push(entry);
        bcDiagMine[k] = list.slice(-5);
        bcDiagWrite(openLiveId, "vaDiag", bcDiagMine[k]);
    } catch (e) {}
}

/* بدون deadline لأن الوقت يتمدد وقت التحقق، والدور نفسه ما تغيّر */
function vaTurnKey(d) { return [openLiveId, d.qIndex, d.answerer, d.passed ? 1 : 0].join("|"); }

/* تنادى من رسم الشاشة لما يكون الدور على هالجهاز */
function vaSync(d) {
    const k = vaTurnKey(d);
    if (VA.key === k) return;
    /* التسجيل اللي بدأ لحظة ضغط الجرس: نكمّله لنفس السؤال بدل ما نبدأ من جديد */
    if (VA.arm && VA.rec && VA.arm.id === openLiveId && VA.arm.qIndex === d.qIndex && !d.passed) {
        if (VA.try && VA.try.key === VA.key) VA.try.key = k;
        VA.key = k; VA.rec.key = k; VA.arm = null;
        vaDiag("won");
        return;
    }
    vaStop(false);
    VA.arm = null;
    Object.assign(VA, { key: k, st: "", msg: "", heard: "", said: "", ok: false, live: "" });
    if (!currentUser || !(window.AudioContext || window.webkitAudioContext) || !window.MediaStream) { vaDiag("unsupported"); vaToType("المتصفح ما يدعم التسجيل، اكتب جوابك"); return; }
    vaStart(k);
}

/* تنادى من liveBuzz لحظة الضغط (قبل رد السيرفر) */
function vaArm(id, qIndex) {
    if (VA.rec || !currentUser || !(window.AudioContext || window.webkitAudioContext) || !window.MediaStream) return;
    const key = "arm|" + id + "|" + qIndex;
    Object.assign(VA, { key, st: "rec", msg: "", heard: "", said: "", ok: false, live: "", arm: { id, qIndex } });
    vaStart(key);
    /* الواجهة تتغير على طول تحت الجرس، بدون انتظار السيرفر */
    const hint = document.querySelector("#lvBell + .lv-muted");
    if (hint) hint.outerHTML = vaHTML();
}
/* السيرفر قال غيري سبقني (أو فشل الطلب): نلغي التسجيل المبكر */
function vaDisarm() {
    if (!VA.arm) return;
    VA.arm = null;
    if (VA.key.indexOf("arm|") === 0) { vaDiag("lost"); vaStop(false); VA.key = ""; VA.st = ""; }
    bcRedrawAll();   /* الجرس ومربع التسجيل تعدّلوا مباشرة في الصفحة، والرسم الجزئي ما يرجّعهم */
}

/* يمدد وقت الإجابة مرة وحدة (للتحقق من الصوت، أو عشان يلحق يكتب لو الصوت ما اشتغل) */
function vaExtend() {
    const id = openLiveId, d0 = liveMatchesCache[id] || {};
    liveTx(id, (d, now) => (d.status === "live" && d.phase === "answer" && d.answerer === myLiveNum(d) && d.qIndex === d0.qIndex && d.deadline - now < VA_EXTEND_MS)
        ? { deadline: now + VA_EXTEND_MS } : null).catch(() => {});
}

/* الرسم في الدورة الجاية، عشان ما نعيد رسم الشاشة وهي ترسم (vaSync تنادى من داخل الرسم) */
function vaRefresh() { setTimeout(() => { liveLastSig = ""; renderLiveScreen(); }, 0); }
function vaToType(msg) { VA.st = "type"; VA.msg = msg || ""; vaExtend(); vaRefresh(); }

/* يوصل المايك بمعالج التسجيل ويرجّع إطارات 20ms مع حكم الكاشف: AudioWorklet أول، و ScriptProcessor احتياط */
async function vaCapture(ctx, src, onFrame) {
    const mute = ctx.createGain(); mute.gain.value = 0;   /* المعالج يوصل للمخرج عشان يشتغل، بس بدون صوت */
    if (await vaWorkletReady(ctx)) {
        try {
            const node = new AudioWorkletNode(ctx, "va-capture", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1, channelCountMode: "explicit" });
            node.port.onmessage = ev => onFrame(ev.data);
            src.connect(node); node.connect(mute); mute.connect(ctx.destination);
            return { via: "worklet", stop() { try { node.port.postMessage("stop"); node.port.onmessage = null; src.disconnect(); node.disconnect(); mute.disconnect(); } catch (e) {} } };
        } catch (e) {}
    }
    const vad = vaVadCreate(ctx.sampleRate);
    const proc = ctx.createScriptProcessor(2048, 1, 1);
    let rest = new Float32Array(0);
    proc.onaudioprocess = ev => {
        const inp = ev.inputBuffer.getChannelData(0);
        const all = new Float32Array(rest.length + inp.length); all.set(rest); all.set(inp, rest.length);
        let o = 0;
        for (; o + vad.N <= all.length; o += vad.N) {
            const f = all.slice(o, o + vad.N), talking = vad.frame(f);
            onFrame({ pcm: f, talking, soft: vad.soft, softMs: vad.softMs, rms: vad.rms, e: vad.e, floor: vad.floor, speechMs: vad.speechMs, peak: vad.peak });
        }
        rest = all.slice(o);
    };
    src.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
    return { via: "script", stop() { try { proc.onaudioprocess = null; src.disconnect(); proc.disconnect(); mute.disconnect(); } catch (e) {} } };
}

async function vaStart(key) {
    VA.st = "rec"; VA.msg = "";
    const rec = { key, stop: null, timer: 0 };
    VA.rec = rec;
    if (typeof bedApply === "function") bedApply();
    let stream = null, own = false, unmuted = false;
    try {
        const t = (typeof bcTrack !== "undefined" && bcTrack && bcTrack.getMediaStreamTrack) ? bcTrack.getMediaStreamTrack() : null;
        if (t && t.readyState === "live") {
            if (bcSelfMuted) { await bcTrack.setMuted(false).catch(() => {}); unmuted = true; }
            stream = new MediaStream([t]);
        } else {
            stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
            own = true;
        }
    } catch (e) {
        if (VA.rec === rec) VA.rec = null;
        vaDiag("mic-error", { err: String((e && (e.name || e.message)) || e).slice(0, 80) });
        if (VA.key === rec.key && !VA.arm) vaToType("ما قدرت أفتح المايك، اكتب جوابك");
        return;
    }
    if (VA.rec !== rec) { if (own) stream.getTracks().forEach(x => x.stop()); return; }
    vaPrime();
    const ctx = VA.ctx;
    if (ctx.state === "suspended") { try { await ctx.resume(); } catch (e) {} }
    const frames = [];               /* كل إطار: { pcm, talking } */
    let speechMs = 0, peak = 0, floor = 0, lastVoiceAt = 0, firstVoiceAt = 0, firstIdx = -1, lastIdx = -1, partial = false;
    let eMax = 0, softMs = 0, softFirstAt = 0, softLastAt = 0, softFirstIdx = -1, softLastIdx = -1;
    const startedAt = performance.now();
    /* نهاية وقت الإجابة من الوثيقة نفسها (تتحدث لو الوقت تمدد)، وقبل التأكيد ما فيه نهاية */
    const stopAt = () => {
        const x = liveMatchesCache[openLiveId];
        return (x && x.phase === "answer") ? (x.deadline || 0) - VA_STOP_BEFORE_MS : Infinity;
    };
    /* الجزء اللي فيه كلام بس (مع هامش)، عشان الملف أصغر و Whisper ما يتخيّل كلام من السكوت */
    const clip = () => {
        const pad = Math.ceil(VA_PAD_MS / 20);
        const fi = firstIdx >= 0 ? firstIdx : softFirstIdx, li = lastIdx >= 0 ? lastIdx : softLastIdx;
        const a = fi >= 0 ? Math.max(0, fi - pad) : 0, b = li >= 0 ? Math.min(frames.length, li + pad + 1) : frames.length;
        return frames.slice(a, b).map(f => f.pcm);
    };

    let cap = null;
    const finish = (send) => {
        if (rec.stop === null) return;
        rec.stop = null;
        clearInterval(rec.timer);
        if (cap) cap.stop();
        if (own) stream.getTracks().forEach(x => x.stop());
        if (unmuted && typeof bcTrack !== "undefined" && bcTrack && bcSelfMuted) bcTrack.setMuted(true).catch(() => {});
        if (VA.rec === rec) VA.rec = null;
        if (typeof bedApply === "function") bedApply();
        const key = rec.key;
        if (!send || VA.key !== key || key.indexOf("arm|") === 0) return;
        const info = { frames: frames.length, speechMs: Math.round(speechMs), softMs: Math.round(softMs), eMax: +eMax.toFixed(4), peak: +peak.toFixed(3), noise: +floor.toFixed(4) };
        if (!frames.length) { vaDiag("no-audio", info); vaToType("المايك ما وصل منه صوت، اكتب جوابك"); return; }
        /* لو الكاشف لقط كلام قصير بس الصوت واضح، نرسله والسيرفر يحكم بدل ما نضيّع الجواب.
           وموسيقى أو ضجة بدون أي كلام ما تنرسل (Whisper يتخيّل منها كلام) */
        /* شبكة أمان (تجربة 21 أكتوبر: صوت واضح 0.13 وما انحسب كلام): صوت عالي بدون كلام مكشوف ينرسل كامل،
           والسيرفر يحكم (يرفض أي جواب ما هو من كلام المتسابق) */
        /* وتجربة 21 أكتوبر الثانية: كلام واطي (0.024) ومقطّع من إلغاء الصدى، الأساسي ما سمعه والحساس يسمعه */
        if (speechMs < VA_MIN_SPEECH_MS && softMs < VA_SOFT_MS && !(peak >= VA_LOUD || (peak >= 0.05 && firstIdx >= 0))) { vaDiag("no-speech", info); vaToType("ما سمعت جواب، اكتبه"); return; }
        /* رد فوري إن الجواب وصل قبل ما يرد السيرفر */
        if (typeof bcTap === "function") bcTap(document.getElementById("vaBox"), "tapped", "tick", 20);
        vaDiag("sent", info);
        vaSend(key, clip(), ctx.sampleRate, speechMs < VA_MIN_SPEECH_MS);
    };
    rec.stop = finish;

    const onFrame = (f) => {
        if (rec.stop === null) return;
        const now = performance.now();
        frames.push({ pcm: f.pcm, talking: f.talking });
        speechMs = f.speechMs; peak = f.peak; floor = f.floor; if (f.e > eMax) eMax = f.e;
        if (f.talking) { lastVoiceAt = now; lastIdx = frames.length - 1; if (!firstVoiceAt) { firstVoiceAt = now; firstIdx = frames.length - 1; } }
        /* الحساس ما يحسب نص الثانية الأولى، ولا وقت أي مؤثر صوتي شغّال عندي (الجرس 1 ث، الغلط 1.2 ث) */
        if (f.soft && now - startedAt > VA_SOFT_IGNORE_MS && now > ((typeof CINE !== "undefined" && CINE.fxUntil) || 0) + 150) {
            softMs += f.pcm.length / ctx.sampleRate * 1000; softLastAt = now; softLastIdx = frames.length - 1;
            if (!softFirstAt) { softFirstAt = now; softFirstIdx = frames.length - 1; }
        }
        /* نص مباشر: الكلام طويل، نعرض اللي انقال للحين (مرة وحدة، وبس بعد ما يتأكد إني فزت بالجرس) */
        if (!partial && f.talking && speechMs >= VA_PARTIAL_MS && rec.key.indexOf("arm|") !== 0) { partial = true; vaPartial(rec.key, clip(), ctx.sampleRate); }
        /* المتسابق يشوف إن صوته واصل: المؤشر يتحرك والدائرة تكبر والنص يتغير */
        const level = Math.min(1, f.rms / 0.1);
        const bar = document.getElementById("vaLevel"); if (bar) bar.style.transform = "scaleX(" + Math.max(0.04, level).toFixed(2) + ")";
        const box = document.getElementById("vaBox");
        if (box) {
            const on = now - Math.max(lastVoiceAt, softLastAt) < 350;
            box.classList.toggle("talking", on);
            box.style.setProperty("--lvl", level.toFixed(2));
            const t = document.getElementById("vaT");
            const msg = on ? "أسمعك..." : (speechMs >= VA_MIN_SPEECH_MS ? "وصل صوتك" : "قل جوابك الحين");
            if (t && t.textContent !== msg) t.textContent = msg;
        }
    };
    try { cap = await vaCapture(ctx, ctx.createMediaStreamSource(stream), onFrame); }
    catch (e) {
        if (VA.rec === rec) VA.rec = null;
        if (own) stream.getTracks().forEach(x => x.stop());
        /* لو فتحنا مايكه المكتوم عشان التسجيل، نرجّعه مكتوم (المايك ما يظل مفتوح بسبب خطأ) */
        if (unmuted && typeof bcTrack !== "undefined" && bcTrack && bcSelfMuted) bcTrack.setMuted(true).catch(() => {});
        if (typeof bedApply === "function") bedApply();
        vaDiag("capture-error", { err: String((e && (e.name || e.message)) || e).slice(0, 80) });
        if (VA.key === rec.key && !VA.arm) vaToType("ما قدرت أسجّل صوتك، اكتب جوابك");
        return;
    }
    if (rec.stop === null) { cap.stop(); return; }   /* انلغى وهو يجهز */
    /* الإيقاف بمؤقت مستقل (مو مع الإطارات)، فلو الصوت ما وصل أبد ما يعلّق */
    rec.timer = setInterval(() => {
        const now = performance.now();
        if (rec.key.indexOf("arm|") === 0) {   /* لسا ما تأكد إني فزت بالجرس: نسجّل بس، وما نحكم */
            if (now - startedAt > VA_ARM_MS) { VA.arm = null; finish(false); }
            return;
        }
        if (!frames.length && now - startedAt > 1500) finish(true);
        else if (!firstVoiceAt && !softFirstAt && now - startedAt > VA_QUIET_MS) finish(true);
        /* الأساسي ما سمع شي بس الحساس سمع كلام واطي أو مقطّع وسكت بعده 0.8 ث: نرسله (السيرفر يحكم) */
        else if (!firstVoiceAt && softMs >= VA_SOFT_MS + 100 && now - softLastAt > 1200) finish(true);
        else if (!firstVoiceAt && softFirstAt && now - softFirstAt > VA_MAX_MS) finish(true);
        else if (!firstVoiceAt && softFirstAt && softMs < VA_SOFT_MS && now - softLastAt > VA_QUIET_MS) finish(true);
        else if (speechMs >= VA_MIN_SPEECH_MS && lastVoiceAt && now - lastVoiceAt > VA_SILENCE_MS) finish(true);
        /* كلمة قصيرة قالها مع الجرس: ما ننتظر 5 ث. بس لازم 200ms كلام وآخره بعد 0.6 ث من الضغط،
           عشان صوت الجرس أو دقة الإصبع ما تنحسب جواب وتقفل التسجيل وهو للحين يفكر */
        else if (speechMs >= 200 && lastVoiceAt && lastVoiceAt - startedAt > 600 && now - lastVoiceAt > VA_SILENCE_MS * 2) finish(true);
        else if (firstVoiceAt && now - firstVoiceAt > VA_MAX_MS) finish(true);
        else if (bcNow() >= stopAt()) finish(true);
    }, 100);
    vaDiag("rec", { via: cap.via + (own ? "+getUserMedia" : "+bcTrack"), armed: key.indexOf("arm|") === 0 });
}

function vaStop(send) { if (VA.rec && VA.rec.stop) VA.rec.stop(send); }

/* WAV أحادي 16 كيلوهرتز (16 بت)، كل الموديلات تقراه */
function vaWav(chunks, rate) {
    let n = 0; chunks.forEach(c => n += c.length);
    const all = new Float32Array(n); let o = 0; chunks.forEach(c => { all.set(c, o); o += c.length; });
    const ratio = rate / VA_RATE, len = Math.floor(n / ratio);
    /* صوت واطي (جوال بدون رفع صوت تلقائي، أعلى إطار 0.024): نكبّره لين أعلى نقطة 0.7 (حد 16 مرة) عشان Whisper يسمعه زين */
    /* بس ما نكبّر الضجة: أوطى إطار (20ms) بعد التكبير يبقى تحت 0.01، وإلا Whisper يتخيّل كلام منها */
    let mx = 0; for (let i = 0; i < n; i++) { const a = Math.abs(all[i]); if (a > mx) mx = a; }
    const fl = Math.max(1, Math.round(rate * 0.02)); let lo = Infinity;
    for (let i = 0; i + fl <= n; i += fl) { let s = 0; for (let j = i; j < i + fl; j++) s += all[j] * all[j]; lo = Math.min(lo, Math.sqrt(s / fl)); }
    const gain = mx > 0 ? Math.max(1, Math.min(16, 0.7 / mx, lo > 0 && lo < Infinity ? 0.01 / lo : 16)) : 1;
    const view = new DataView(new ArrayBuffer(44 + len * 2));
    const w = (p, s) => { for (let i = 0; i < s.length; i++) view.setUint8(p + i, s.charCodeAt(i)); };
    w(0, "RIFF"); view.setUint32(4, 36 + len * 2, true); w(8, "WAVE"); w(12, "fmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, VA_RATE, true); view.setUint32(28, VA_RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    w(36, "data"); view.setUint32(40, len * 2, true);
    for (let i = 0; i < len; i++) {
        const a = Math.floor(i * ratio), b = Math.min(n, Math.floor((i + 1) * ratio));
        let s = 0; for (let j = a; j < b; j++) s += all[j];
        const v = Math.max(-1, Math.min(1, gain * s / Math.max(1, b - a)));
        view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    }
    return new Uint8Array(view.buffer);
}
function vaB64(bytes) {
    let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
}

/* نص مباشر وقت الكلام (Whisper بس، بدون حكم) */
function vaPartial(key, chunks, rate) {
    if (typeof aiCall !== "function") return;
    const q0 = ((liveMatchesCache[openLiveId] || {}).questions || [])[(liveMatchesCache[openLiveId] || {}).qIndex] || {};
    aiCall("hear", { q: q0.text || "", audio: vaB64(vaWav(chunks, rate)) }, 4000).then(r => {
        if (VA.key !== key || !r || !r.heard || VA.heard) return;
        VA.live = r.heard;
        const el = document.getElementById("vaLive"); if (el) el.textContent = "«" + r.heard + "»";
    }).catch(() => {});
}

/* الطلب للسيرفر: الرد يجي على دفعتين (سطر لكل دفعة): {heard} أول ما يخلص Whisper، وبعدها {said, ok} */
async function vaPost(body, onHeard, timeoutMs, path) {
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
    try {
        const r = await fetch(path || "/ai", {
            method: "POST",
            headers: Object.assign({ "Content-Type": "application/json" }, await authHeaders()),
            body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined
        });
        if (!r.ok) throw new Error("ai " + r.status);
        const type = r.headers.get("Content-Type") || "";
        if (type.indexOf("ndjson") === -1 || !r.body || !r.body.getReader) return await r.json();
        const rd = r.body.getReader(), dec = new TextDecoder();
        let buf = "", last = null;
        for (;;) {
            const { value, done } = await rd.read();
            if (value) buf += dec.decode(value, { stream: true });
            let i;
            while ((i = buf.indexOf("\n")) !== -1) {
                const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
                if (!line) continue;
                const x = JSON.parse(line);
                if (x.final) last = x; else if (x.heard && onHeard) onHeard(x.heard);
            }
            if (done) break;
        }
        if (!last) throw new Error("no result");
        return last;
    } finally { if (t) clearTimeout(t); }
}

async function vaSend(key, chunks, rate, softOnly) {
    const id = openLiveId, d0 = liveMatchesCache[id] || {};
    const q0 = (d0.questions || [])[d0.qIndex] || {};
    VA.st = "think"; vaRefresh();
    /* المتسابق خلص كلامه: نمدد الوقت لين يجي الحكم (التحويل والتصحيح ياخذون من 2 إلى 8 ث)، مرة وحدة بالدور */
    vaExtend();
    let res = null;
    const t0 = performance.now();
    try {
        /* السؤال المختوم: السيرفر (functions/answer.js) يتأكد إنه دوري ويفتح الجواب ويصحح. القديم: /ai بالجواب من الوثيقة */
        const audio = vaB64(vaWav(chunks, rate));
        const sealed = typeof bcSealed === "function" && bcSealed(q0);
        const body = sealed ? { action: "grade", stream: true, id, qIndex: d0.qIndex, audio } : { task: "voice", stream: true, q: q0.text || "", answer: q0.answer || "", audio };
        res = await vaPost(body, heard => {
            if (VA.key !== key) return;
            VA.live = heard;
            const el = document.getElementById("vaLive"); if (el) el.textContent = "«" + heard + "»";
            vaDiag("heard", { heard: heard.slice(0, 60), heardMs: Math.round(performance.now() - t0) });
        }, VA_EXTEND_MS - 800, sealed ? "/answer" : "/ai");
    } catch (e) { res = null; }
    if (VA.key !== key) return;
    vaDiag(res ? "result" : "server-error", res ? { heard: (res.heard || "").slice(0, 60), said: res.said || "", ok: res.ok === true, ms: Math.round(performance.now() - t0), srv: res.t || null } : {});
    /* انرسل من الكاشف الحساس بس و Whisper ما طلّع جواب: نطلّع الكتابة بدل ما نسجّل كلام (ممكن يكون ضجة أو أحد حوله) */
    if (res && softOnly && !res.said) { vaToType("ما فهمت الجواب، اكتبه بسرعة"); return; }
    if (!res || (!res.said && !res.heard)) { vaToType(res ? "ما فهمت الجواب، اكتبه بسرعة" : "تعذّر التحقق من صوتك، اكتب جوابك"); return; }
    VA.heard = res.heard || ""; VA.said = res.said || ""; VA.ok = res.ok === true;
    VA.st = "done"; vaRefresh();
    liveCommitAnswer(id, VA.said || VA.heard, res.ok === true, q0)
        .catch(err => { console.log("voice answer:", err); if (VA.key === key) vaToType("ما انحفظ جوابك، اكتبه"); });
}

/* واجهة الدور (تنرسم من screen.js) */
function vaHTML() {
    if (VA.st === "type" || VA.st === "") {
        return `${VA.msg ? `<div class="va-note">${ic("alert")} ${escapeHTML(VA.msg)}</div>` : ""}
<div class="lv-ans-row">
<input type="text" id="lvAnswerInput" placeholder="اكتب إجابتك..." autocomplete="off" onkeydown="if(event.key==='Enter'){event.preventDefault();liveSubmitAnswer();}">
<button onclick="liveSubmitAnswer()">إرسال</button>
</div>`;
    }
    if (VA.st === "rec") {
        return `<div class="va-box rec" id="vaBox">
<div class="va-mic">${ic("mic")}</div>
<div class="va-t" id="vaT">قل جوابك الحين</div>
<div class="va-meter"><i id="vaLevel"></i></div>
<div class="va-live" id="vaLive">${VA.live ? "«" + escapeHTML(VA.live) + "»" : ""}</div>
<div class="va-sub">أول جواب تقوله هو اللي ينحسب</div>
</div>`;
    }
    if (VA.st === "think") return `<div class="va-box" id="vaBox"><div class="va-spin"></div><div class="va-t">وصل جوابك، يتحقق...</div><div class="va-live" id="vaLive">${VA.live ? "«" + escapeHTML(VA.live) + "»" : ""}</div></div>`;
    return `<div class="va-box ${VA.ok ? "ok" : "no"}"><div class="va-res">${ic(VA.ok ? "check-circle" : "x-circle")} ${VA.ok ? "صح" : "غلط"}</div><div class="va-t">«${escapeHTML(VA.said || VA.heard)}»</div></div>`;
}
