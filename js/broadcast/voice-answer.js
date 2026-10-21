/* جواب المتسابق بالصوت: بعد ما يفوز بالجرس يقول جوابه بدل ما يكتبه.
   - التسجيل من نفس مايك البث (bcTrack في voice.js) عشان ما ينفتح المايك مرتين (الآيفون يكتم الأول).
   - يبدأ لحظة ضغط الجرس (vaArm) قبل ما يرد السيرفر، عشان أول كلمة ما تضيع، ولو فاز بالجرس يكمل نفس التسجيل.
   - أرضية الضجة تتحدث طول الوقت (تنزل بسرعة وتطلع ببطء) فالكلام ما يرفعها، والجواب ما يطول أكثر من 6 ث.
   - يوقف لحاله أول ما يسكت المتسابق بعد جوابه (0.8 ث)، أو قبل نهاية الوقت بـ 1.5 ث، وبعدها الوقت يتمدد للتحقق.
   - أول جواب هو اللي ينحسب (ما فيه تغيير)، وما فيه أزرار: كل شي تلقائي.
   - الصوت يروح لـ /ai (task: voice): Whisper يحوّله نص، والموديل يطلّع الجواب من كلامه ويحكم.
   - لو الصوت ما اشتغل (ما فيه مايك، ما سمع شي، السيرفر تعطل) يطلع مربع الكتابة احتياط. */

const VA_RATE = 16000;           /* Whisper يشتغل على 16 كيلوهرتز */
const VA_SILENCE_MS = 800;       /* سكوت بعد الكلام = خلص جوابه (أول جواب ينحسب، فما نستنى) */
const VA_MIN_SPEECH_MS = 400;    /* أقل كلام نعتبره جواب */
const VA_STOP_BEFORE_MS = 1500;  /* نوقف قبل نهاية الوقت بشوي */
const VA_EXTEND_MS = 10000;      /* وقت التحقق من الصوت (الوقت يتمدد له أول ما يخلص المتسابق) */
const VA_MAX_MS = 6000;          /* أطول جواب: بعد 6 ث من أول كلمة نوقف حتى لو فيه صوت (موسيقى أو ضجة) */
const VA_ARM_MS = 5000;          /* التسجيل المبكر ينلغى لو السيرفر ما أكد إني فزت بالجرس خلال 5 ث */

/* st: "" | "rec" (يسمع) | "think" (يتحقق) | "type" (الكتابة احتياط) | "done" */
const VA = { key: "", st: "", msg: "", heard: "", said: "", ok: false, ctx: null, rec: null, arm: null };

/* نسجّل على نفس AudioContext حق البث (liveCtx في engine.js) لأنه شغّال من لحظة فتح شاشة البث (ضغطة حقيقية).
   كان ينسوى واحد جديد وقت ضغطة الجرس (pointerdown)، واللمس ما يعتبر إذن تشغيل في الجوال، فيظل معلّق وما يسجّل شي */
function vaPrime() {
    try {
        VA.ctx = liveCtx();
        if (VA.ctx.state === "suspended") VA.ctx.resume().catch(() => {});
    } catch (e) {}
}

/* تشخيص: حالة الجواب الصوتي تنكتب في وثيقة البث (vaDiag.<uid>) عشان نعرف وش صار لو ما اشتغل */
function vaDiag(st, extra) {
    try {
        if (!openLiveId || !currentUser) return;
        const v = Object.assign({ st, at: bcNow(), ua: (navigator.userAgent || "").slice(0, 90), ctx: VA.ctx ? VA.ctx.state : "" }, extra || {});
        liveRef(openLiveId).update({ ["vaDiag." + currentUser.uid]: v }).catch(() => {});
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
        VA.key = k; VA.rec.key = k; VA.arm = null;
        return;
    }
    vaStop(false);
    VA.arm = null;
    Object.assign(VA, { key: k, st: "", msg: "", heard: "", said: "", ok: false });
    if (!currentUser || !(window.AudioContext || window.webkitAudioContext) || !window.MediaStream) { vaDiag("unsupported"); vaToType("المتصفح ما يدعم التسجيل، اكتب جوابك"); return; }
    vaStart(k);
}

/* تنادى من liveBuzz لحظة الضغط (قبل رد السيرفر) */
function vaArm(id, qIndex) {
    if (VA.rec || !currentUser || !(window.AudioContext || window.webkitAudioContext) || !window.MediaStream) return;
    const key = "arm|" + id + "|" + qIndex;
    Object.assign(VA, { key, st: "rec", msg: "", heard: "", said: "", ok: false, arm: { id, qIndex } });
    vaStart(key);
    /* الواجهة تتغير على طول تحت الجرس، بدون انتظار السيرفر */
    const hint = document.querySelector("#lvBell + .lv-muted");
    if (hint) hint.outerHTML = vaHTML();
}
/* السيرفر قال غيري سبقني (أو فشل الطلب): نلغي التسجيل المبكر */
function vaDisarm() {
    if (!VA.arm) return;
    VA.arm = null;
    if (VA.key.indexOf("arm|") === 0) { vaStop(false); VA.key = ""; VA.st = ""; }
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
    const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(2048, 1, 1);
    const mute = ctx.createGain(); mute.gain.value = 0;   /* ScriptProcessor يحتاج يوصل للمخرج، بس بدون صوت */
    const chunks = [];
    let noise = 0.006, peak = 0, speechMs = 0, lastVoiceAt = 0, firstVoiceAt = 0, frames = 0;
    const startedAt = performance.now();
    /* نهاية وقت الإجابة من الوثيقة نفسها (تتحدث لو الوقت تمدد)، وقبل التأكيد ما فيه نهاية */
    const stopAt = () => {
        const x = liveMatchesCache[openLiveId];
        return (x && x.phase === "answer") ? (x.deadline || 0) - VA_STOP_BEFORE_MS : Infinity;
    };

    const finish = (send) => {
        if (rec.stop === null) return;
        rec.stop = null;
        clearInterval(rec.timer);
        try { proc.disconnect(); src.disconnect(); mute.disconnect(); } catch (e) {}
        if (own) stream.getTracks().forEach(x => x.stop());
        if (unmuted && typeof bcTrack !== "undefined" && bcTrack && bcSelfMuted) bcTrack.setMuted(true).catch(() => {});
        if (VA.rec === rec) VA.rec = null;
        if (typeof bedApply === "function") bedApply();
        const key = rec.key;
        if (!send || VA.key !== key || key.indexOf("arm|") === 0) return;
        if (!frames) { vaDiag("no-audio"); vaToType("المايك ما وصل منه صوت، اكتب جوابك"); return; }
        /* لو الكشف ما تأكد من الكلام بس فيه صوت واضح، نرسله والسيرفر يحكم بدل ما نضيّع الجواب */
        if (speechMs < VA_MIN_SPEECH_MS && peak < 0.03) { vaDiag("no-speech", { frames, peak: +peak.toFixed(3) }); vaToType("ما سمعت جواب، اكتبه"); return; }
        vaDiag("sent", { frames, speechMs: Math.round(speechMs), peak: +peak.toFixed(3), noise: +noise.toFixed(4) });
        vaSend(key, chunks, ctx.sampleRate);
    };
    rec.stop = finish;

    proc.onaudioprocess = (ev) => {
        if (rec.stop === null) return;
        const buf = ev.inputBuffer.getChannelData(0);
        chunks.push(new Float32Array(buf));
        frames++;
        let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length), ms = buf.length / ctx.sampleRate * 1000, now = performance.now();
        if (rms > peak) peak = rms;
        /* أرضية الضجة: تنزل بسرعة مع الهدوء وتطلع ببطء شديد، فالكلام نفسه ما يرفعها (كانت تنقاس أول ثلث ثانية، والمتسابق غالباً يتكلم فيها) */
        noise = rms < noise ? noise * 0.6 + rms * 0.4 : noise * 0.997 + rms * 0.003;
        const talking = rms > Math.max(0.012, noise * 2.5);
        if (talking) { speechMs += ms; lastVoiceAt = now; if (!firstVoiceAt) firstVoiceAt = now; }
        /* المتسابق يشوف إن صوته واصل: المؤشر يتحرك والدائرة تكبر والنص يتغير */
        const level = Math.min(1, rms / 0.1);
        const bar = document.getElementById("vaLevel"); if (bar) bar.style.transform = "scaleX(" + Math.max(0.04, level).toFixed(2) + ")";
        const box = document.getElementById("vaBox");
        if (box) {
            const on = now - lastVoiceAt < 350;
            box.classList.toggle("talking", on);
            box.style.setProperty("--lvl", level.toFixed(2));
            const t = document.getElementById("vaT");
            const msg = on ? "أسمعك..." : (speechMs >= VA_MIN_SPEECH_MS ? "وصل صوتك" : "قل جوابك الحين");
            if (t && t.textContent !== msg) t.textContent = msg;
        }
    };
    /* الإيقاف بمؤقت مستقل (مو داخل onaudioprocess)، فلو الصوت ما وصل أبد ما يعلّق */
    rec.timer = setInterval(() => {
        const now = performance.now();
        if (rec.key.indexOf("arm|") === 0) {   /* لسا ما تأكد إني فزت بالجرس: نسجّل بس، وما نحكم */
            if (now - startedAt > VA_ARM_MS) { VA.arm = null; finish(false); }
            return;
        }
        if (!frames && now - startedAt > 1500) finish(true);
        else if (speechMs >= VA_MIN_SPEECH_MS && now - lastVoiceAt > VA_SILENCE_MS) finish(true);
        else if (firstVoiceAt && now - firstVoiceAt > VA_MAX_MS) finish(true);
        else if (bcNow() >= stopAt()) finish(true);
    }, 100);
    src.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
    vaDiag("rec", { via: own ? "getUserMedia" : "bcTrack", armed: key.indexOf("arm|") === 0 });
}

function vaStop(send) { if (VA.rec && VA.rec.stop) VA.rec.stop(send); }

/* WAV أحادي 16 كيلوهرتز (16 بت)، كل الموديلات تقراه */
function vaWav(chunks, rate) {
    let n = 0; chunks.forEach(c => n += c.length);
    const all = new Float32Array(n); let o = 0; chunks.forEach(c => { all.set(c, o); o += c.length; });
    const ratio = rate / VA_RATE, len = Math.floor(n / ratio);
    const view = new DataView(new ArrayBuffer(44 + len * 2));
    const w = (p, s) => { for (let i = 0; i < s.length; i++) view.setUint8(p + i, s.charCodeAt(i)); };
    w(0, "RIFF"); view.setUint32(4, 36 + len * 2, true); w(8, "WAVE"); w(12, "fmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, VA_RATE, true); view.setUint32(28, VA_RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    w(36, "data"); view.setUint32(40, len * 2, true);
    for (let i = 0; i < len; i++) {
        const a = Math.floor(i * ratio), b = Math.min(n, Math.floor((i + 1) * ratio));
        let s = 0; for (let j = a; j < b; j++) s += all[j];
        const v = Math.max(-1, Math.min(1, s / Math.max(1, b - a)));
        view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    }
    return new Uint8Array(view.buffer);
}
function vaB64(bytes) {
    let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
}

async function vaSend(key, chunks, rate) {
    const id = openLiveId, d0 = liveMatchesCache[id] || {};
    const q0 = (d0.questions || [])[d0.qIndex] || {};
    VA.st = "think"; vaRefresh();
    /* المتسابق خلص كلامه: نمدد الوقت لين يجي الحكم (التحويل والتصحيح ياخذون من 2 إلى 8 ث)، مرة وحدة بالدور */
    vaExtend();
    let res = null;
    try {
        res = await aiCall("voice", { q: q0.text || "", answer: q0.answer || "", audio: vaB64(vaWav(chunks, rate)) }, VA_EXTEND_MS - 800);
    } catch (e) { res = null; }
    if (VA.key !== key) return;
    vaDiag(res ? "result" : "server-error", res ? { heard: (res.heard || "").slice(0, 60), said: res.said || "", ok: res.ok === true } : {});
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
<div class="va-sub">أول جواب تقوله هو اللي ينحسب</div>
</div>`;
    }
    if (VA.st === "think") return `<div class="va-box"><div class="va-spin"></div><div class="va-t">وصل جوابك، يتحقق...</div></div>`;
    return `<div class="va-box ${VA.ok ? "ok" : "no"}"><div class="va-res">${ic(VA.ok ? "check-circle" : "x-circle")} ${VA.ok ? "صح" : "غلط"}</div><div class="va-t">«${escapeHTML(VA.said || VA.heard)}»</div></div>`;
}
