/* مذيع البث وصوته */
/* =====================================================================
   مذيع البث + مكتبة الأصوات
   - المذيع: صوت بشري (functions/tts.js: ElevenLabs ثم Azure) يقرا السؤال والإجابة ويقدّم المواجهات.
     لو السيرفر ما رد يسكت (ممنوع أي صوت من المتصفح، فما فيه speechSynthesis)
   - جمل الموقف (سلسلة، تعادل، رجوع، تقدّم) مقطع لحاله بعد جملة الجواب: جملة الجواب نفسها تتجهز مسبقاً من جهاز المنظم،
     وجملة الموقف يطلبها جهاز المنظم أول ما يصير الموقف، فالأجهزة الثانية تاخذها من الكاش (كل جملة تنحسب من الرصيد مرة)
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
    bcSpeakSeq++;
    try { if (bcSpeechSrc) bcSpeechSrc.stop(); } catch (e) {}
    bcSpeechSrc = null;
    bedDuck(false);
}

/* يقرا جملة أو أكثر ورا بعض (الجواب ثم الموقف). أي جملة ما توصل من السيرفر تنتخطى بصمت */
let bcSpeakSeq = 0;
function bcSpeak(text, then) {
    const list = (Array.isArray(text) ? text : [text]).filter(Boolean);
    if (!bcVoiceOn || !list.length) return;
    bcStopSpeech();
    const seq = ++bcSpeakSeq;
    const c = liveCtx();
    try { if (c.state === "suspended") c.resume(); } catch (e) {}
    const loads = list.map(t => bcTtsLoad(t).catch(() => null));
    const playAt = i => {
        if (i >= loads.length || seq !== bcSpeakSeq) { if (seq === bcSpeakSeq) bedDuck(false); return; }
        loads[i].then(buf => {
            if (seq !== bcSpeakSeq) return;
            if (!buf) return playAt(i + 1);
            const src = c.createBufferSource();
            const g = c.createGain(); g.gain.value = 1.0;
            src.buffer = buf; src.connect(g); g.connect(c.destination);
            src.onended = () => { if (bcSpeechSrc === src) { bcSpeechSrc = null; setTimeout(() => playAt(i + 1), 250); } };
            src.start();
            bcSpeechSrc = src;
            bedDuck(true);
        });
    };
    playAt(0);
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
    /* الأسئلة بس. جملة الجواب ما تتجهز قبل وقتها: كاش /tts عام، فلو انطلبت قبل الكشف أي أحد يقدر يجرّب
       "والإجابة الصحيحة هي: ..." ويعرف من الكاش (200) إن تخمينه صح. تنطلب من جهاز المنظم أول ما يبدأ الكشف (تحت) */
    (d.questions || []).forEach((q, i) => { bcTtsLoad(bcQText(d, i, true)).catch(() => {}); });
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
    } else if (d.scene === "playing" && d.phase === "answer") {
        /* أحد ضغط الجرس: المذيع يسكت على طول، عشان صوته ما يدخل مايك اللي يجاوب ويخرب جوابه الصوتي */
        bcStopSpeech();
        return;
    } else if (d.scene === "playing" && d.phase === "reveal") {
        key = "a" + d.cur + "_" + d.qIndex; delay = 1750;   /* بعد لحظة التشويق */
        /* جملة الجواب (متجهزة مسبقاً) وبعدها جملة الموقف لو فيه موقف. جهاز المنظم يطلبها الحين عشان تكون في الكاش للكل */
        const situ = bcSituText(d);
        text = [bcRevealText(d, d.qIndex, true), situ];
        /* جهاز المنظم يطلب جملة الجواب والموقف أول ما يبدأ الكشف (الجواب صار علني)، والأجهزة الثانية تقراها بعد 1.75 ث من الكاش */
        if (amBcHost(d) && key !== bcLastSpokenKey && bcVoiceOn && bcTtsServerOk) [text[0], situ].forEach(t => { if (t) bcTtsLoad(t).catch(() => {}); });
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
    setTimeout(() => {
        /* سؤال انضغط جرسه قبل ما يبدأ المذيع يقراه: ما نقراه */
        const x = liveMatchesCache[openLiveId];
        if (key[0] === "q" && x && x.phase !== "buzz") return;
        /* الجواب المختوم: نستنى السيرفر يكشفه، وبعدها نقرا جملة الجواب (نفس النص اللي جهّزه المنظم) وجملة الموقف */
        if (key[0] === "a" && Array.isArray(text) && !text[0]) {
            /* ننتظر جهاز المنظم يكتب الجواب (shown) لين 3 ث، وبعدها نقرا */
            let n = 0;
            const wait = () => {
                const x = liveMatchesCache[openLiveId];
                const t0 = x && x.cur === d.cur && x.qIndex === d.qIndex ? bcRevealText(x, d.qIndex, true) : "";
                if (t0 || ++n > 15) { if (bcLastSpokenKey === key && (t0 || text[1])) bcSpeak([t0, text[1]]); return; }
                setTimeout(wait, 200);
            };
            wait();
            return;
        }
        bcSpeak(text);
    }, delay);
}
