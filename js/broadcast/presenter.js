/* مذيع البث وصوته */
/* =====================================================================
   مذيع البث + مكتبة الأصوات
   - المذيع: صوت بشري (Google) يقرا السؤال والإجابة ويقدّم المواجهات، وإذا ما توفر يستخدم صوت الجوال
   - مكتبة الأصوات: المنظم يضغط صوت فيسمعه كل اللي في البث بنفس اللحظة
   ===================================================================== */
const BC_AR_NUM = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];
let bcVoiceOn = true;
try { bcVoiceOn = localStorage.getItem("bcVoiceOn") !== "0"; } catch (e) {}
let bcTtsServerOk = true;          /* يتعطل لو السيرفر قال ما هو مضبوط، ونرجع لصوت الجوال */
const bcTtsBuf = {};               /* النص ← Promise<AudioBuffer> */
let bcSpeechSrc = null;
let bcLastSpokenKey = "";

function bcTtsUrl(text) { return "/tts?t=" + encodeURIComponent(text); }

/* نحمّل الصوت مسبقاً عشان يطلع على كل الأجهزة بنفس اللحظة تقريباً */
function bcTtsLoad(text) {
    if (!text || !bcTtsServerOk) return Promise.reject(new Error("off"));
    if (!bcTtsBuf[text]) {
        bcTtsBuf[text] = authHeaders().then(h => fetch(bcTtsUrl(text), { headers: h }))
            .then(r => {
                if (r.status === 503) bcTtsServerOk = false;
                if (!r.ok || (r.headers.get("Content-Type") || "").indexOf("audio") === -1) throw new Error("tts " + r.status);
                return r.arrayBuffer();
            })
            .then(ab => new Promise((res, rej) => liveCtx().decodeAudioData(ab, res, rej)))
            .catch(e => { delete bcTtsBuf[text]; throw e; });
    }
    return bcTtsBuf[text];
}

function bcStopSpeech() {
    try { if (bcSpeechSrc) bcSpeechSrc.stop(); } catch (e) {}
    bcSpeechSrc = null;
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
    bedDuck(false);
}

/* صوت الجوال كاحتياط: نختار أحسن صوت عربي موجود */
function bcBrowserSpeak(text) {
    try {
        if (!window.speechSynthesis) return;
        const vs = speechSynthesis.getVoices().filter(v => /^ar/i.test(v.lang));
        const score = v => (/natural|neural|online|google|hamed|zariyah|majed/i.test(v.name) ? 2 : 0) + (/sa/i.test(v.lang) ? 1 : 0);
        vs.sort((a, b) => score(b) - score(a));
        const u = new SpeechSynthesisUtterance(text);
        u.lang = vs[0] ? vs[0].lang : "ar-SA";
        if (vs[0]) u.voice = vs[0];
        u.rate = 0.95;
        u.onstart = () => bedDuck(true);
        u.onend = u.onerror = () => bedDuck(false);
        speechSynthesis.speak(u);
    } catch (e) {}
}

function bcSpeak(text) {
    if (!bcVoiceOn || !text) return;
    bcStopSpeech();
    const c = liveCtx();
    try { if (c.state === "suspended") c.resume(); } catch (e) {}
    bcTtsLoad(text).then(buf => {
        bcStopSpeech();
        const src = c.createBufferSource();
        const g = c.createGain(); g.gain.value = 1.0;
        src.buffer = buf; src.connect(g); g.connect(c.destination);
        src.onended = () => { if (bcSpeechSrc === src) bedDuck(false); };
        src.start();
        bcSpeechSrc = src;
        bedDuck(true);
    }).catch(() => bcBrowserSpeak(text));
}

function bcToggleVoice() {
    bcVoiceOn = !bcVoiceOn;
    try { localStorage.setItem("bcVoiceOn", bcVoiceOn ? "1" : "0"); } catch (e) {}
    if (!bcVoiceOn) bcStopSpeech();
    liveLastSig = ""; renderLiveScreen();
}

/* أول ما تبدأ المواجهة، جهاز المنظم بس يجهّز أصوات الأسئلة مسبقاً (تنحفظ في الكاش)،
   وبعدها كل الأجهزة تاخذها من الكاش. كذا كل جملة تنحسب من رصيد الأصوات مرة وحدة بس */
function bcPrefetchVoice(d) {
    if (!bcVoiceOn || !bcTtsServerOk || !bcInMatch(d) || !amBcHost(d)) return;
    (d.questions || []).forEach((q, i) => {
        bcTtsLoad(bcQText(d, i, true)).catch(() => {});
        bcTtsLoad(bcRevealText(d, i, true)).catch(() => {});
    });
}

/* المقدم يتكلم حسب اللحظة في البث */
function bcAnnouncer(d) {
    if (!d || d.status !== "live") return;
    const o = bcCur(d);
    let key = "", text = "", delay = 150;
    if (d.scene === "opening") {
        key = "open"; delay = 2500;
        /* aiLines: جمل جديدة كتبها الذكاء الاصطناعي لهذي الجولة (js/ai.js)، وإذا ما فيه نرجع للثابتة */
        const ai = d.aiLines || {};
        text = ai.open || bcFill(bcPick(BC_HOST.open, "o" + d.round), { r: d.round, n: (d.order || []).length });
    } else if (d.scene === "intro" && o) {
        key = "intro" + d.cur; delay = 4400;
        const ctx = bcMatchContext(d), k = "i" + d.round + ":" + d.cur;
        const aiTail = ((d.aiLines || {}).intros || [])[d.cur];
        text = bcFill(bcPick(BC_HOST.intro, k), { ord: BC_AR_NUM_F[d.cur] || (d.cur + 1), p1: o.p1, p2: o.p2 }) + " " + (aiTail || (ctx ? ctx.t : bcPick(BC_HOST.introTail, k + "t")));
        bcPrefetchVoice(d);
    } else if (d.scene === "playing" && d.phase === "buzz") {
        key = "q" + d.cur + "_" + d.qIndex; text = bcQText(d, d.qIndex);
        if (bcIsDecider(d)) delay = 600;
    } else if (d.scene === "playing" && d.phase === "reveal") {
        key = "a" + d.cur + "_" + d.qIndex; delay = 1750;   /* بعد لحظة التشويق */
        text = bcRevealText(d, d.qIndex);
    } else if (d.scene === "result" && o) {
        key = "res" + d.cur; delay = 2000; text = bcResultText(d);
    } else if (d.scene === "closing") {
        key = "close"; delay = 2500; text = bcCloseText(d);
    }
    if (!key || key === bcLastSpokenKey) return;
    const first = bcLastSpokenKey === "";
    bcLastSpokenKey = key;
    /* لو فتحت البث في نص سؤال، ما نقرا شي قديم إلا السؤال الحالي */
    if (first && key !== "open" && key[0] !== "q") return;
    setTimeout(() => bcSpeak(text), delay);
}
