/* شاشة البث الكاملة: الرسم، المشاهد، الدخول الناعم، الانتقالات */
/* ===== الشاشة الكاملة للبث ===== */
function openLiveScreen(id) {
    if (!id) return;
    const scr = document.getElementById("liveScreen");
    if (!scr) return;
    if (!openLiveId) {
        try { window.history.pushState({ liveOpen: id }, ""); } catch (e) {}
    }
    openLiveId = id;
    liveLastSig = "";
    { const b = document.getElementById("liveScreenBody"); if (b) b.__bcR = null; }   /* الرسم الجزئي يبدأ من جديد مع كل فتح */
    livePrevView = null;
    bcPrevKey = null;
    bcLastSpokenKey = "";
    bcAutoFx.prev = null;
    bcRxSeenN = null;
    bcTickerSig = "";
    bcEnterScene = ""; bcEnterPhase = "";
    TV.boardKey = ""; TV.sec = -1;
    /* فيديو الاستوديو الحقيقي (من Google Flow) خلفية ثابتة للبث */
    if (!document.getElementById("stVideo")) {
        const v = document.createElement("video");
        v.id = "stVideo"; v.className = "st-video";
        v.src = "media/studio.mp4"; v.poster = "media/studio.jpg";
        v.muted = true; v.loop = true; v.autoplay = !bcLite; v.playsInline = true;
        v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("preload", bcLite ? "none" : "auto");   /* الخفيف: صورة poster بس */
        scr.insertBefore(v, scr.firstChild);
    }
    /* لقطات الاستوديو الثانية (صور من Google Flow بحركة كاميرا بطيئة) */
    if (!document.getElementById("stShots")) {
        const w = document.createElement("div");
        w.id = "stShots"; w.className = "st-shots";
        w.innerHTML = BC_SHOTS.map(k => `<img data-shot="${k}" src="media/shot_${k}.jpg" alt="" decoding="async">`).join("");
        const v = document.getElementById("stVideo");
        scr.insertBefore(w, v ? v.nextSibling : scr.firstChild);
    }
    scr.classList.add("open");
    try { const v = document.getElementById("stVideo"); if (v && v.paused && !bcLite) v.play().catch(() => {}); } catch (e) {}
    bcApplyLite();
    bcWatchFrames();
    document.body.classList.add("live-open");
    try { liveCtx(); if (liveAudioCtx.state === "suspended") liveAudioCtx.resume(); } catch (e) {}
    cineLoadSamples(CINE_CORE);
    cineLoadSamples(cineNeedFor(liveMatchesCache[id]));
    bcLoadSecret(id);
    renderLiveScreen();
    bcSyncAudio();
    if (!liveTickTimer) liveTickTimer = setInterval(liveTick, 200);
}

function closeLiveScreen(fromPop) {
    if (!openLiveId) return;
    { const ub = document.getElementById("bcUnlock"); if (ub) ub.remove(); }
    const d = liveMatchesCache[openLiveId];
    if (!fromPop && bcTrack && d && d.status === "live" && !confirm("مايكك مفتوح في البث، إذا طلعت بيتقفل. متأكد؟")) return;
    if (!fromPop && window.history.state && window.history.state.liveOpen) {
        window.history.back();
        return;
    }
    openLiveId = null;
    const scr = document.getElementById("liveScreen");
    if (scr) scr.classList.remove("open");
    document.body.classList.remove("live-open");
    if (liveTickTimer) { clearInterval(liveTickTimer); liveTickTimer = null; }
    bcStopSpeech();
    cineCloseAll();
    bedSet("");
    bcTicker(null);
    { const l3 = document.getElementById("stL3"); if (l3) l3.remove(); BC_L3.key = ""; }
    { const tb = document.getElementById("tvBoard"); if (tb) tb.remove(); if (scr) scr.classList.remove("tv-final"); }
    if (scr) { delete scr.dataset.scene; delete scr.dataset.shot; }
    bcSyncAudio();
}

function liveTick() {
    const d = liveMatchesCache[openLiveId];
    if (!d) return;
    if (d.status === "scheduled") { bcTickClock(d); return; }
    const left = Math.max(0, (d.deadline || 0) - bcNow());
    if (d.scene === "countdown") {
        const el = document.getElementById("lvCount");
        const n = Math.max(1, Math.ceil((left - 500) / 1000));
        if (el && el.textContent !== String(n)) {
            el.textContent = n;
            cinePlay("heartbeat", 0.9);
            if (el.getAnimations) el.getAnimations().forEach(a => { a.cancel(); a.play(); });
        }
    } else if (d.scene === "playing") {
        const total = d.phase === "buzz" ? LIVE_BUZZ_MS : (d.phase === "answer" ? LIVE_ANSWER_MS : LIVE_REVEAL_MS);
        const ringEl = document.getElementById("lvRing");
        const num = document.getElementById("lvTimerNum");
        const pct = Math.max(0, Math.min(100, (left / total) * 100));
        if (ringEl) {
            ringEl.style.strokeDashoffset = (119.4 * (1 - pct / 100)).toFixed(1);
            ringEl.style.stroke = pct > 50 ? "#4ade80" : (pct > 25 ? "#facc15" : "#ef4444");
        }
        if (num) { const t = String(Math.ceil(left / 1000)); if (num.textContent !== t) num.textContent = t; }
        const rv = document.getElementById("stReveal");
        if (rv && rv.classList.contains("hold") && bcNow() >= bcRevealAt(d)) rv.classList.remove("hold");
    }
    bcAirClock(d);
    bcHostHeartbeat(d);
    bcAutoPilot(d);
    bcTickMics();
    bcLowerThird(d);
    tvTick(d);
    showTick(d);
    if (typeof bcSetLocalQuiet === "function") bcSetLocalQuiet();
    bcPerfTick(d);
    liveAdvanceIfDue();
}

/* عداد البث المجدول: ساعات:دقايق:ثواني، وآخر 10 ثواني تكتكة ونبض */
let bcClockLast = -1;
function bcTickClock(d) {
    const left = Math.max(0, (d.startAt || 0) - bcNow());
    const sec = Math.ceil(left / 1000);
    const el = document.getElementById("bcClock");
    if (el && sec !== bcClockLast) {
        bcClockLast = sec;
        const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), x = sec % 60;
        const p = n => String(n).padStart(2, "0");
        el.innerHTML = `<div><b>${p(h)}</b><i>ساعة</i></div><span>:</span><div><b>${p(m)}</b><i>دقيقة</i></div><span>:</span><div><b class="sec">${p(x)}</b><i>ثانية</i></div>`;
        el.classList.toggle("final", sec <= 10 && sec > 0);
        if (sec <= 10 && sec > 0) cinePlay(sec <= 3 ? "heartbeat" : "tick", sec <= 3 ? 0.9 : 0.6);
        if (sec === 0) {
            el.innerHTML = `<div class="now">الحين!</div>`;
            const lb = document.getElementById("bcWaitNote");
            if (lb) lb.textContent = "جاري بدء البث...";
        }
    }
    if (left <= 0 && currentUser) bcGoLive(false);
}

/* لقطة انتقالية بين المشاهد (ستينجر) */
function bcStinger(title, sub, at) {
    const scr = document.getElementById("liveScreen");
    if (!scr) return;
    const late = at ? bcNow() - at : 0;
    if (late > 1500) return;
    const old = scr.querySelector(".bc-stinger");
    if (old) old.remove();
    const el = document.createElement("div");
    el.className = "bc-stinger";
    el.innerHTML = `<div class="bc-st-band"></div><div class="bc-st-txt"><div class="t">${escapeHTML(title)}</div>${sub ? `<div class="s">${escapeHTML(sub)}</div>` : ""}</div>`;
    scr.appendChild(el);
    showSync(el, at);
    showSound(at, "whoosh", 0.6);
    setTimeout(() => el.remove(), Math.max(0, 1700 - Math.max(0, late)));
}

function bcSceneEffects(d) {
    const key = d.status + ":" + d.scene + ":" + d.cur;
    const prev = bcPrevKey;
    bcPrevKey = key;
    /* لو فتحت البث متأخر، نعرض المشهد السينمائي بس إذا بدأ قبل لحظات */
    const fresh = ms => Math.abs(bcNow() - (d.sceneAt || 0)) < ms;
    if (prev === null) {
        if (d.status === "live" && d.scene === "opening") { if (fresh(8000)) cineOpening(d); }
        else if (d.status === "live" && d.scene === "intro" && fresh(5000)) cineMatchIntro(d);
        return;
    }
    if (prev === key || d.status !== "live") return;
    const o = bcCur(d);
    const prevScene = prev.split(":")[1];
    if (d.scene === "opening") {
        cineOpening(d);
    } else if (d.scene === "intro" && o) {
        /* فاصل بين المواجهات (أشرطة الدوري ونتايج الجولة) وبعده مشهد المواجهة */
        if (prevScene === "result") tvBumper(d, () => { const x = liveMatchesCache[openLiveId]; if (x && x.scene === "intro" && x.cur === d.cur) cineMatchIntro(x); });
        else cineMatchIntro(d);
    } else if (d.scene === "talk") {
        bcTransition("talk", Number(d.sceneAt) || 0);
    } else if (d.scene === "countdown") {
        bcTransition("count", (Number(d.deadline) || 0) - LIVE_COUNT_MS);
    } else if (d.scene === "playing" && prevScene === "countdown") {
        cineGo(Number(d.qAt) || 0);
    } else if (d.scene === "result") {
        tvWarm();
        const sAt = (Number(d.sceneAt) || bcNow()) + 900;
        setTimeout(() => bcStinger("نهاية المواجهة", o ? `${o.p1} ${d.s1 || 0} - ${d.s2 || 0} ${o.p2}` : "", sAt), Math.max(0, sAt - bcNow()));
        cineResult(d);
    } else if (d.scene === "closing") {
        cineCloseAll();
        bcStinger(`ختام الجولة ${d.round}`, "ملخص النتائج", Number(d.sceneAt) || 0);
        cineClosing();
    }
}

/* ===== دخول ناعم للعناصر: كل مشهد جديد تدخل عناصره وحدة ورا الثانية =====
   تغيير المشهد = دخول كامل، تغيير المرحلة داخل نفس المشهد (الجرس/الإجابة/الكشف) = دخول خفيف */
let bcEnterScene = "", bcEnterPhase = "";
function bcEntrance(body, d) {
    const sk = d.status + ":" + d.scene + ":" + d.cur;
    const pk = sk + ":" + (d.phase || "") + ":" + (d.qIndex || 0) + ":" + (d.answerer || 0);
    const stage = body.querySelector(".lv-stage");
    const pods = body.querySelector(".st-pods");
    if (sk !== bcEnterScene) {
        const wasPods = bcEnterScene && bcEnterScene.split(":")[1];
        bcEnterScene = sk; bcEnterPhase = pk;
        if (stage) { stage.classList.add("enter"); [...stage.children].forEach((el, i) => el.style.setProperty("--i", Math.min(i, 8))); }
        /* المنصات تدخل من الجنبين أول ما تطلع (مع فقرة الترحيب) */
        if (pods && !/^(talk|countdown|playing|result)$/.test(wasPods || "")) pods.classList.add("enter");
        const host = body.querySelector(".st-hostrow");
        if (host && !wasPods) host.classList.add("enter");
    } else if (pk !== bcEnterPhase) {
        bcEnterPhase = pk;
        if (stage) { stage.classList.add("soft"); [...stage.children].forEach((el, i) => el.style.setProperty("--i", Math.min(i, 6))); }
    }
}

/* ===== لقطات انتقال بين المشاهد ===== */
function bcTransition(kind, at) {
    const scr = document.getElementById("liveScreen");
    if (!scr) return;
    const late = at ? bcNow() - at : 0;
    if (late > 1500) return;   /* خلص عند الكل */
    scr.querySelectorAll(".st-trans").forEach(e => e.remove());
    const el = document.createElement("div");
    el.className = "st-trans " + kind;
    if (kind === "talk") {
        el.innerHTML = `<i class="bloom"></i><i class="ring"></i><i class="ring two"></i><div class="lbl">${ic("mic")}<b>الترحيب بالمتسابقين</b><span>المايكات مفتوحة</span></div>`;
        showSound(at, "whoosh", 0.35);
        if (late < 350) setTimeout(() => cinePlay("impact", 0.25), 350 - Math.max(0, late));
    } else if (kind === "count") {
        el.innerHTML = `<i class="iris"></i><div class="lbl"><b>المواجهة تبدأ</b></div>`;
        showSound(at, "riser", 0.45, { tail: 1.1 });
    } else {
        el.innerHTML = `<i class="sweep"></i>`;
        showSound(at, "whoosh", 0.3);
    }
    scr.appendChild(el);
    showSync(el, at);
    setTimeout(() => el.remove(), Math.max(0, 1700 - Math.max(0, late)));
}

/* القياس (bcPerf في cinema.js): كم ياخذ رسم الشاشة كل مرة */
function renderLiveScreen() {
    const t0 = performance.now();
    if (renderLiveScreenNow()) bcPerfRender(performance.now() - t0);
}
function renderLiveScreenNow() {
    const body = document.getElementById("liveScreenBody");
    if (!body || !openLiveId) return;
    const d = liveMatchesCache[openLiveId];
    const me = d ? myLiveNum(d) : 0;
    bcBuzzSeen(d);
    bcDiagPanel(d);
    if (d && d.scene === "playing" && d.phase === "reveal") bcPublishShown(d);
    if (d && d.pend) bcHostJudge(d);

    /* نعيد الرسم فقط إذا تغيّر شي مهم (عشان ما ينمسح اللي تكتبه في خانة الإجابة) */
    const applied = d ? (d.order || []).map(o => o.state + (o.applied ? 1 : 0)).join(",") : "";
    const sig = d ? [d.v, d.status, d.scene, d.cur, d.phase, d.qIndex, d.answerer, d.ready1, d.ready2, d.s1, d.s2, applied, me, isAdmin,
        bcTrack ? 1 : 0, bcSelfMuted ? 1 : 0, bcMicErr, bcAudioErr, bcJoined ? 1 : 0, bcConnState, bcNetQ >= 5 ? 1 : 0, bcVoiceOn ? 1 : 0, cineBgOn ? 1 : 0, bcDiagOpen ? 1 : 0, bcAnswerOf(d, d.qIndex) ? 1 : 0, bcPredSig(d)].join("|") : "none";
    if (sig === liveLastSig) return false;
    liveLastSig = sig;

    if (!d) {
        body.__bcR = null;
        body.innerHTML = `
<div class="lv-top"><button class="rs-back" onclick="closeLiveScreen()">${ic("chevron-right")} خروج</button></div>
<div class="lv-stage"><div class="lv-muted">جاري تحميل البث...</div></div>`;
        return;
    }

    const scrEl = document.getElementById("liveScreen");
    if (scrEl) {
        scrEl.dataset.scene = d.status === "live" ? (d.scene || "") : (d.status === "scheduled" ? "waiting" : "ended");
        if (bcIsDecider(d)) scrEl.dataset.decider = "1"; else delete scrEl.dataset.decider;
    }
    bcDirector(d);
    cineLoadSamples(cineNeedFor(d));
    bcTicker(d);
    bcClockLast = -1;
    bcSceneEffects(d);
    bedSet(bedMoodFor(d));
    bcAnnouncer(d);
    bcAutoFx(d);
    if (d.scene === "countdown" || d.scene === "playing") liveSoundsOnChange(d);
    else livePrevView = null;

    const live = d.status === "live";
    const sched = d.status === "scheduled";
    const o = bcCur(d);
    const total = (d.order || []).length;
    const R = {};
    R.wave = sched ? `<div class="bc-wavebg"><svg class="w1" viewBox="0 0 1200 120" preserveAspectRatio="none"><path d="M0 60 C150 0 300 120 450 60 S750 0 900 60 1050 120 1200 60 V120 H0Z"/></svg><svg class="w2" viewBox="0 0 1200 120" preserveAspectRatio="none"><path d="M0 60 C150 120 300 0 450 60 S750 120 900 60 1050 0 1200 60 V120 H0Z"/></svg><svg class="w3" viewBox="0 0 1200 120" preserveAspectRatio="none"><path d="M0 70 C200 20 400 110 600 60 S1000 20 1200 70 V120 H0Z"/></svg></div>` : "";
    R.top = `
<div class="lv-top">
<button class="rs-back" onclick="closeLiveScreen()">${ic("chevron-right")} خروج</button>
<span class="lv-badge ${live ? "" : (sched ? "soon" : "off")}"><span class="dot"></span>${live ? `على الهواء <b id="bcAirClock" class="st-air">00:00</b>` : (sched ? "قريباً" : "انتهى البث")}</span>
<span class="lv-round">الجولة ${escapeHTML(String(d.round || ""))}${live ? ` · ${ic("users")} <b id="bcListeners">…</b>` : ""}</span>
${isAdmin && (live || sched) ? `<button class="bc-endbtn" onclick="bcEnd()">${ic("power")} ${sched ? "إلغاء" : "إنهاء البث"}</button>` : ""}
</div>`;

    R.host = live ? `<div class="st-hostrow">${bcHostHTML(d)}${bcSideCtlHTML()}</div>` : "";
    R.pods = "";
    if (live && o && (d.scene === "talk" || d.scene === "countdown" || d.scene === "playing" || d.scene === "result")) {
        /* منصات المتسابقين: تنور منصة اللي ضغط الجرس */
        const lit = (d.scene === "playing" && d.phase === "answer") ? d.answerer : 0;
        const nq = (d.questions || []).length || LIVE_Q_COUNT;
        const pod = n => `
<div class="st-pod ${lit === n ? "lit" : ""} ${me === n ? "me" : ""} ${lit && lit !== n ? "dim" : ""}" ${(n === 1 ? o.uid1 : o.uid2) ? `data-bcuid="${escapeHTML(n === 1 ? o.uid1 : o.uid2)}"` : ""}>
<i class="st-cone"></i>
<img src="${safeSrc(bcAv(o, n))}" alt="">
<div class="nm">${escapeHTML(n === 1 ? o.p1 : o.p2)}</div>
<div class="st-desk">${showScoreHTML(d, n)}<i>نقاط</i></div>
</div>`;
        const mid = d.scene === "talk" ? `الترحيب<small>قبل البداية</small>` : d.scene === "playing" ? (d.qIndex >= LIVE_Q_COUNT ? `ذهبي<small>سؤال الحسم</small>` : `السؤال ${d.qIndex + 1}<small>من ${LIVE_Q_COUNT}</small>`) : (d.scene === "result" ? "النتيجة" : "استعدوا");
        const mc = (d.scene === "talk" || d.scene === "countdown" || d.scene === "playing") ? bcMicCtlHTML(d) : "";
        R.pods = `
${mc ? `<div class="st-microw">${mc}</div>` : ""}
<div class="st-pods">
${pod(1)}
<div class="st-mid"><div class="st-qn">${mid}</div><div class="st-ml">المواجهة ${d.cur + 1} من ${total}</div></div>
${pod(2)}
</div>`;
    }

    R.stage = `<div class="lv-stage bc-scene" data-scene="${escapeHTML(d.scene || "")}">` + bcStageHTML(d, me) + `</div>`;

    bcPatchRegions(body, R);
    showAfterRender(body, d);
    bcEntrance(body, d);

    const qc = body.querySelector(".st-qcard");
    /* still بس للوحة جديدة لنفس السؤال (انعاد بناء المشهد)، مو للوحة نفسها اللي للحين تتحرك (الرسم الجزئي ما يعيد بناءها) */
    if (qc && !qc.dataset.seen) { qc.dataset.seen = "1"; if (qc.dataset.q === bcLastQAnim) qc.classList.add("still"); bcLastQAnim = qc.dataset.q; }
    const inp = document.getElementById("lvAnswerInput");
    if (inp) setTimeout(() => inp.focus(), 60);
    liveTick();
    return true;
}

/* الشاشة 5 أجزاء ثابتة (display:contents فالشكل ما يتغير)، وكل جزء ينعاد رسمه بس لو تغيّر.
   كان كل تحديث يعيد بناء الشاشة كاملة: 200ms على معالج أبطأ 6 مرات، ولحظة الجرس على كل الجوالات */
const BC_REGIONS = ["wave", "top", "host", "pods", "stage"];
/* إعادة بناء كاملة: بعد تعديل مباشر في الصفحة (الجرس "ضغطت!"، مربع التسجيل) أو فتح الشاشة من جديد */
function bcRedrawAll() {
    const body = document.getElementById("liveScreenBody");
    if (body) body.__bcR = null;
    liveLastSig = "";
    setTimeout(renderLiveScreen, 0);
}
function bcPatchRegions(body, R) {
    if (!body.__bcR || !body.__bcR.stage || !body.__bcR.stage.isConnected) {
        body.innerHTML = BC_REGIONS.map(k => `<div class="bc-r" data-r="${k}"></div>`).join("");
        body.__bcR = {}; body.__bcHtml = {};
        [...body.children].forEach(el => { body.__bcR[el.dataset.r] = el; });
    }
    for (const k of BC_REGIONS) {
        const h = R[k] || "";
        if (body.__bcHtml[k] !== h) { body.__bcR[k].innerHTML = h; body.__bcHtml[k] = h; }
    }
}

function liveSoundsOnChange(d) {
    const view = { scene: d.scene, phase: d.phase, q: d.qIndex, ans: d.answerer, out: d.outcome };
    const p = livePrevView;
    livePrevView = view;
    if (!p) return;
    if (view.phase === "answer" && (p.phase !== "answer" || p.ans !== view.ans)) tvBuzzMoment(d);
    if (view.phase === "answer" && (p.phase !== "answer" || p.ans !== view.ans) && !d.passed && bcLocalBuzzQ !== openLiveId + "|" + d.cur + "|" + d.qIndex) cinePlay("buzz", 0.7);
    if (view.phase === "answer" && d.passed && p.ans !== view.ans) cinePlay("wrong", 0.5);
    if (view.phase === "buzz" && p.phase !== "buzz" && view.q > 0) cinePlay("whoosh", 0.4);
    if (view.phase === "reveal" && p.phase !== "reveal") {
        /* طبول تشويق تخلص بالضبط لحظة الكشف، وبعدها صح + تصفيق أو غلط + "آه" */
        const wait = Math.max(0, bcRevealAt(d) - bcNow());
        cinePlay("reveal", 0.75, { tail: Math.max(0.4, wait / 1000 + 0.15) });
        setTimeout(() => {
            if (view.out) { cinePlay("correct", 0.7); cinePlay("applause", 0.4, { dur: 3 }); }
            else cinePlay("wrong", 0.55);
        }, wait);
    }
}

/* المنظم فوق (صورته واسمه)، والمتسابقين تحته في المشهد نفسه */
function bcHostHTML(d) {
    const av = cdnThumb(d.hostAv || getPlayerAvatar(d.hostName || "م").url);
    const micOn = d.scene === "talk" || d.scene === "countdown" || d.scene === "playing";
    return `
<div class="st-host" ${d.hostUid ? `data-bcuid="${escapeHTML(d.hostUid)}"` : ""}>
<div class="ring"><img src="${safeSrc(av)}" alt=""><span class="mi">${ic("mic")}</span></div>
<div class="tx"><b>${escapeHTML(d.hostName || "المنظم")}</b><span>${micOn ? `<i class="bc-st">المايك مقفل</i>` : "مقدم البرنامج"}</span></div>
</div>`;
}
/* أزرار صغيرة على جنب الشاشة: التفاعلات، المقدم، الخلفية */
function bcSideCtlHTML() {
    return `<div class="st-side">
${BC_RX.map((e, i) => `<button onclick="bcReact(${i})" aria-label="تفاعل">${e}</button>`).join("")}
<i class="sep"></i>
<button onclick="bcShare()" aria-label="رابط البث">${ic("share")}</button>
<button class="${bcVoiceOn ? "" : "off"}" onclick="bcToggleVoice()" aria-label="صوت المقدم">${ic(bcVoiceOn ? "volume-2" : "volume-x")}</button>
<button class="${cineBgOn ? "" : "off"}" onclick="bcToggleBg()" aria-label="الموسيقى">${ic("music")}</button>
${isAdmin ? `<button class="${bcDiagOpen ? "" : "off"}" onclick="bcToggleDiag()" aria-label="التشخيص">${ic("chart")}</button>` : ""}
</div>`;
}
/* تحكم مايكي: يطلع بس في صفحة بداية المواجهة */
function bcMicCtlHTML(d) {
    const net = bcConnState === "RECONNECTING" ? `<div class="bc-note">${ic("alert")} النت تقطّع، نرجع نوصل الصوت...</div>`
        : (bcNetQ >= 5 && bcTrack ? `<div class="bc-note">${ic("alert")} النت عندك ضعيف، صوتك ممكن يتقطع</div>` : "");
    if (bcTrack) return net + `<button class="bc-mybtn ${bcSelfMuted ? "muted" : ""}" onclick="bcToggleSelfMute()">${ic(bcSelfMuted ? "mic-off" : "mic")} ${bcSelfMuted ? "مايكك مكتوم · اضغط للفتح" : "مايكك مفتوح · اضغط للكتم"}</button>`;
    if (bcShouldPublish(d)) return bcMicErr
        ? `<button class="bc-mybtn err" onclick="bcToggleSelfMute()">${ic("alert")} ${escapeHTML(bcMicErr)} · اضغط للمحاولة</button>`
        : `<div class="bc-note">${ic("hourglass")} جاري فتح مايكك...</div>`;
    return bcAudioErr ? `<div class="bc-note">${ic("alert")} ${escapeHTML(bcAudioErr)}</div>` : net;
}

function bcFixturesHTML(d, withScores) {
    return (d.order || []).map((o, i) => {
        let mid = `<span class="vs">VS</span>`;
        let cls = "";
        if (withScores && o.state === "done") mid = `<span class="sc">${o.s1 || 0} - ${o.s2 || 0}</span>`;
        else if (o.state === "skipped") { mid = `<span class="vs">مؤجلة</span>`; cls = "skip"; }
        if (i === d.cur && bcInMatch(d)) cls += " cur";
        return `
<div class="bc-fx ${cls}" style="animation-delay:${0.25 + i * 0.12}s">
<div class="p"><img src="${safeSrc(bcAv(o, 1))}" alt=""><span>${escapeHTML(o.p1)}</span></div>
${mid}
<div class="p r"><span>${escapeHTML(o.p2)}</span><img src="${safeSrc(bcAv(o, 2))}" alt=""></div>
</div>`;
    }).join("");
}

function bcStageHTML(d, me) {
    const o = bcCur(d);
    const total = (d.order || []).length;
    const adminBar = btns => isAdmin ? `<div class="bc-admin">${btns}<button class="lv-link" onclick="bcEnd()">إنهاء البث</button></div>` : "";

    if (d.status === "scheduled") {
        return `
<div class="bc-wait">
<img src="logo.png" class="bc-wait-logo" alt="">
<div class="bc-wait-k">دوري بنو مسروح للنخبة</div>
<div class="bc-title">بث الجولة ${escapeHTML(String(d.round))}</div>
<div class="bc-wait-t">يبدأ البث بعد</div>
<div class="bc-clock" id="bcClock"></div>
<div class="bc-wait-at">${ic("hourglass")} الساعة ${escapeHTML(bcTimeLabel(d.startAt || 0))}</div>
<div class="lv-muted" id="bcWaitNote">البث يبدأ لحاله أول ما يخلص العداد</div>
<button class="bc-ghost" onclick="bcShare()">${ic("share")} أرسل رابط البث في الواتساب</button>
</div>
<div class="bc-fixtures">${bcFixturesHTML(d, false)}</div>
${isAdmin ? `<div class="bc-admin"><button class="bc-go" onclick="bcGoLive(true)">${ic("zap")} ابدأ البث الحين</button></div>` : ""}`;
    }

    if (d.status !== "live") {
        const done = (d.order || []).filter(x => x.state === "done").length;
        return `
<div class="bc-title" style="color:#94a3b8;">انتهى بث الجولة ${escapeHTML(String(d.round))}</div>
<div class="lv-muted">تلعبت ${done} من ${total} مواجهات</div>
<div class="bc-fixtures">${bcFixturesHTML(d, true)}</div>
<button onclick="closeLiveScreen()" style="width:min(280px,100%);">رجوع للمواجهات</button>`;
    }

    if (d.scene === "opening") {
        return `
<div class="bc-open">
<div class="bc-onair-tag">ON AIR</div>
<img src="logo.png" class="bc-logo" alt="">
<div class="bc-title">بث الجولة ${escapeHTML(String(d.round))}</div>
<div class="bc-sub">دوري بنو مسروح للنخبة · ${total} مواجهات · المنظم: ${escapeHTML(d.hostName || "")}</div>
</div>
<div class="bc-fixtures">${bcFixturesHTML(d, false)}</div>
${isAdmin ? "" : `<div class="lv-muted">أول مواجهة تبدأ بعد شوي...</div>`}
${adminBar(`<button class="bc-go" onclick="bcNext(false)">${ic("zap")} ابدأ المواجهة الأولى</button>`)}`;
    }

    if (d.scene === "intro" && o) {
        const tab = bcStandings();
        const ctx = bcMatchContext(d);
        const side = n => {
            const ok = !!d["ready" + n];
            const uid = n === 1 ? o.uid1 : o.uid2;
            const inf = bcPlayerInfo(n === 1 ? o.p1 : o.p2, tab);
            const form = inf.last.length ? inf.last.map(r => `<i class="${r}">${r === "w" ? "ف" : (r === "l" ? "خ" : "ت")}</i>`).join("") : `<em>أول مواجهة</em>`;
            return `
<div class="bc-side ${n === 1 ? "l" : "r"} ${me === n ? "me" : ""}" ${uid ? `data-bcuid="${escapeHTML(uid)}"` : ""}>
<div class="ring"><img src="${safeSrc(bcAv(o, n))}" alt=""><span class="mi">${ic("mic")}</span></div>
<div class="nm">${escapeHTML(n === 1 ? o.p1 : o.p2)}</div>
<div class="st-card"><div><b>${inf.pts > 0 || inf.played ? "#" + inf.rank : "—"}</b><small>الترتيب</small></div><div><b>${inf.w}</b><small>فوز</small></div><div><b>${inf.pts}</b><small>نقاط</small></div></div>
<div class="st-form" title="آخر 3 نتائج">${form}</div>
${uid ? `<div class="bc-st">المايك مقفل</div>` : `<div class="bc-st warn">غير موثّق</div>`}
<span class="lv-pill ${ok ? "ok" : ""}">${ok ? ic("check") + " جاهز" : ic("hourglass") + " بانتظاره"}</span>
</div>`;
        };
        let action;
        if (me && !d["ready" + me]) action = `<button class="lv-ready-btn" onclick="liveSetReady()">${ic("check-circle")} جاهز</button>`;
        else if (me) action = `<div class="lv-muted">${ic("hourglass")} أنت جاهز، بانتظار خصمك...</div>`;
        else action = `<div class="lv-muted">بانتظار المتسابقين يضغطون "جاهز"، وبعدها تبدأ فقرة الترحيب بالمايكات</div>`;
        return `
<div class="bc-mlabel big">المواجهة ${d.cur + 1} من ${total}</div>
<div class="bc-vs">${side(1)}<div class="bc-vsx">VS</div>${side(2)}</div>
${ctx ? `<div class="st-ctx ${ctx.k}">${ic(ctx.k === "revenge" ? "zap" : "trophy")} ${escapeHTML(ctx.t)}</div>` : ""}
${bcPredHTML(d, o)}
<div class="bc-note">${ic("mic-off")} المايكات تفتح أول ما يضغطون الاثنين "جاهز"</div>
${action}
<div class="lv-rules">${LIVE_Q_COUNT} أسئلة · أسرع واحد يضغط الجرس يجاوب · إذا غلط أو خلص وقته ينتقل السؤال للثاني</div>
${adminBar(`<button class="bc-go" onclick="bcToTalk()">${ic("mic")} الترحيب بالمتسابقين الحين</button><button class="bc-ghost" onclick="bcNext(true)">تخطي المواجهة</button>`)}`;
    }

    if (d.scene === "talk" && o) {
        return `
<div class="st-talk">
<div class="ic-wrap">${ic("mic")}</div>
<div class="t">الترحيب بالمتسابقين</div>
<div class="s">المايكات مفتوحة الحين للمنظم و${escapeHTML(o.p1)} و${escapeHTML(o.p2)}</div>
</div>
${isAdmin ? "" : `<div class="lv-muted">المنظم يرحّب بالمتسابقين، والأسئلة تبدأ بعد شوي...</div>`}
${adminBar(`<button class="bc-go" onclick="bcForceStart()">${ic("rocket")} ابدأ المواجهة</button><button class="bc-ghost" onclick="bcNext(true)">تخطي المواجهة</button>`)}`;
    }

    if (d.scene === "countdown") {
        return `<div class="lv-muted">استعدوا!</div><div class="lv-count" id="lvCount">3</div><div class="lv-muted">السؤال الأول جاي...</div>`;
    }

    if (d.scene === "playing") return bcQuizHTML(d, me) + (isAdmin ? `<div class="bc-admin"><button class="lv-link" onclick="bcNext(true)">إيقاف المواجهة وتخطيها</button></div>` : "");

    if (d.scene === "result" && o) {
        const s1 = d.s1 || 0, s2 = d.s2 || 0;
        const winner = s1 > s2 ? o.p1 : (s2 > s1 ? o.p2 : "");
        const wAv = s1 > s2 ? bcAv(o, 1) : (s2 > s1 ? bcAv(o, 2) : "");
        const it = (d.order || [])[d.cur] || {};
        const nextIdx = (d.order || []).findIndex((x, i) => x.state === "pending" && i > d.cur);
        const nx = nextIdx !== -1 ? d.order[nextIdx] : (d.order || []).find(x => x.state === "pending");
        let sum = "";
        (d.questions || []).forEach((q, i) => {
            const w = (d.log || [])[i];
            sum += `<div><span>${i + 1}. ${escapeHTML(q.text)}</span><span style="color:${w === 1 ? "#facc15" : (w === 2 ? "#38bdf8" : "#64748b")}">${w === 1 ? escapeHTML(o.p1) : (w === 2 ? escapeHTML(o.p2) : "—")}</span></div>`;
        });
        const kind = bcWinKind(Object.assign({}, it, { s1, s2, bh1: d.bh1, bh2: d.bh2 }));
        const nq = (d.questions || []).length || LIVE_Q_COUNT;
        const pc = x => Math.round((x / nq) * 100) + "%";
        const fb = x => x > 0 ? bcSec(x) + " ث" : "—";
        const fb1 = d.fb1 || 0, fb2 = d.fb2 || 0;
        const fastest = fb1 && (!fb2 || fb1 <= fb2) ? 1 : (fb2 ? 2 : 0);
        return `
<div class="lv-final ${kind}">
${kind ? `<div class="st-kind">${kind === "big" ? "فوز ساحق!" : "عودة تاريخية!"}</div>` : ""}
${wAv ? `<img class="bc-win-av" src="${safeSrc(wAv)}" alt="">` : `<div class="tro">${ic("trophy")}</div>`}
<div class="w">${winner ? "الفوز لـ " + escapeHTML(winner) : "تعادل!"}</div>
</div>
<div class="st-stats">
<div class="h"><span>${escapeHTML(o.p1)}</span><span></span><span>${escapeHTML(o.p2)}</span></div>
<div><b class="${s1 > s2 ? "hi" : ""}">${s1}</b><span>إجابات صحيحة</span><b class="${s2 > s1 ? "hi" : ""}">${s2}</b></div>
<div><b>${pc(s1)}</b><span>نسبة النجاح</span><b>${pc(s2)}</b></div>
<div><b class="${fastest === 1 ? "hi" : ""}">${fb(fb1)}</b><span>أسرع ضغطة جرس</span><b class="${fastest === 2 ? "hi" : ""}">${fb(fb2)}</b></div>
</div>
${(() => { const c = bcPredCounts(d, d.cur); if (!c.t || !winner) return ""; const wn = s1 > s2 ? c.a : c.b; return `<div class="lv-muted">${ic("target")} ${wn} من ${c.t} توقعوا فوز ${escapeHTML(winner)}</div>`; })()}
<div class="lv-applied ${it.applied ? "" : "wait"}">${it.applied ? ic("check-circle") + " تم تسجيل النتيجة في جدول الدوري" : ic("hourglass") + " جاري تسجيل النتيجة في الجدول..."}</div>
<div class="lv-sum">${sum}</div>
${nx ? `<div class="bc-next">التالي: <b>${escapeHTML(nx.p1)}</b> ضد <b>${escapeHTML(nx.p2)}</b></div>` : `<div class="bc-next">هذي كانت آخر مواجهة في الجولة</div>`}

${adminBar(`<button class="bc-go" onclick="bcNext(false)">${ic("zap")} ${nx ? "المواجهة التالية" : "ختام الجولة"}</button>`)}`;
    }

    if (d.scene === "closing") {
        return `
<div class="bc-open">
<div class="tro" style="color:#facc15;">${ic("trophy")}</div>
<div class="bc-title">ختام الجولة ${escapeHTML(String(d.round))}</div>
<div class="bc-sub">ملخص نتائج الجولة</div>
</div>
${(() => {
    const bm = bcBestMoment(d);
    if (!bm.fast && !bm.big) return "";
    return `<div class="st-best"><div class="t">${ic("zap")} أفضل لحظات الجولة</div>${bm.fast ? `<div>أسرع ضغطة جرس: <b>${escapeHTML(bm.fast.name)}</b> في ${bcSec(bm.fast.ms)} ثانية</div>` : ""}${bm.big ? `<div>أكبر فوز: <b>${escapeHTML(bm.big.w)}</b> ${bm.big.a} - ${bm.big.b}</div>` : ""}</div>`;
})()}
${(() => { const b = bcPredBoard(d); if (!b.length) return ""; return `<div class="st-best"><div class="t">${ic("target")} أفضل المتوقعين</div>${b.map((x, i) => `<div>${i + 1}. <b>${escapeHTML(x.name)}</b> · ${x.ok} من ${x.all} صح</div>`).join("")}</div>`; })()}
<div class="bc-fixtures">${bcFixturesHTML(d, true)}</div>
${isAdmin ? "" : `<div class="lv-muted">شكراً لمتابعتكم، المنظم يختم البث...</div>`}
${adminBar(`<button class="bc-go" onclick="bcEnd()">${ic("power")} إنهاء البث</button>`)}`;
    }
    return `<div class="lv-muted">...</div>`;
}

function bcQuizHTML(d, me) {
    const q = (d.questions || [])[d.qIndex] || { text: "", answer: "" };
    const log = d.log || [];
    let dots = "";
    for (let i = 0; i < (d.questions || []).length; i++) {
        let cls = "";
        if (i === d.qIndex && d.phase !== "reveal") cls = "cur";
        else if (log[i] === 1) cls = "w1";
        else if (log[i] === 2) cls = "w2";
        else if (log[i] === 0) cls = "w0";
        dots += `<span class="${cls}"></span>`;
    }
    const decider = bcIsDecider(d);
    const ring = d.phase === "reveal" ? "" : `<div class="st-ring"><svg viewBox="0 0 44 44"><circle class="bg" cx="22" cy="22" r="19"/><circle class="fg" id="lvRing" cx="22" cy="22" r="19"/></svg><b id="lvTimerNum"></b></div>`;
    let html = `
<div class="lv-dots">${dots}</div>
${decider ? `<div class="st-decider ${bcIsGolden(d) ? "gold" : ""}">${ic(bcIsGolden(d) ? "crown" : "zap")} ${bcIsGolden(d) ? "السؤال الذهبي · أول إجابة صحيحة تفوز" : "سؤال الحسم"}</div>` : ""}
<div class="st-qcard ${decider ? "decider" : ""}" data-q="${d.cur}-${d.qIndex}">
<div class="st-qhead"><span>${d.qIndex >= LIVE_Q_COUNT ? "السؤال الذهبي" : `السؤال ${d.qIndex + 1} من ${LIVE_Q_COUNT}`}</span>${ring}</div>
<div class="lv-qtext tv-words">${showWordsHTML(q.text)}</div>
</div>`;

    const last = d.lastAnswer;
    const lastHTML = (last && last.by && !last.correct)
        ? `<div class="lv-last">${last.timeout ? ic("alarm") + " انتهى وقت " + escapeHTML(livePlayerName(d, last.by)) : ic("x-circle") + " " + escapeHTML(livePlayerName(d, last.by)) + " جاوب: «" + escapeHTML(last.text) + "» غلط"}</div>`
        : "";

    if (d.phase === "buzz") {
        const canBuzz = !!me;
        /* ضغطت الجرس وننتظر السيرفر: الجرس يظل مضغوط والتسجيل ظاهر لو انعاد الرسم */
        if (canBuzz && typeof VA !== "undefined" && VA.arm && VA.arm.id === openLiveId && VA.arm.qIndex === d.qIndex) {
            return html + `<button class="lv-bell rung" id="lvBell" disabled>${ic("bell")}<span>ضغطت!</span></button>` + vaHTML();
        }
        html += `
<button class="lv-bell ${canBuzz ? "" : "idle"}" id="lvBell" ${canBuzz ? `onpointerdown="event.preventDefault();liveBuzz(event)"` : "disabled"}>${ic("bell")}<span>${canBuzz ? "اضغط!" : "الجرس"}</span></button>
<div class="lv-muted">${canBuzz ? "أسرع واحد يضغط الجرس هو اللي يجاوب" : "بانتظار أحد المتسابقين يضغط الجرس"}</div>`;
    } else if (d.phase === "answer") {
        const nm = escapeHTML(livePlayerName(d, d.answerer));
        html += `
${lastHTML}
<div class="lv-turn">${d.passed ? ic("chevron-right") + " انتقل السؤال إلى " + nm : ic("bell") + " " + nm + " ضغط الجرس أول"}</div>`;
        if (me && me === d.answerer) {
            /* الجواب بالصوت (js/broadcast/voice-answer.js)، والكتابة احتياط */
            vaSync(d);
            html += vaHTML();
        } else {
            vaStop(false);
            html += `<div class="lv-muted">${nm} يجاوب الحين...</div>`;
        }
    } else if (d.phase === "reveal") {
        vaStop(false);
        /* لحظة تشويق قبل كشف الإجابة */
        const w = d.outcome;
        const hold = bcNow() < bcRevealAt(d);
        const okLast = last && last.correct ? `<div class="lv-last ok">${ic("check-circle")} «${escapeHTML(last.text)}»</div>` : lastHTML;
        html += `
<div class="st-reveal ${hold ? "hold" : ""}" id="stReveal">
<div class="st-wait">والإجابة الصحيحة هي<span>.</span><span>.</span><span>.</span><i class="tv-drum" style="animation-delay:${-Math.max(0, 1600 - Math.max(0, bcRevealAt(d) - bcNow()))}ms"></i></div>
<div class="lv-reveal ${w ? "" : "none"}">
<div class="t">${w ? ic("check-circle") + " " + escapeHTML(livePlayerName(d, w)) + " جاوب صح! +1" : ic("x-circle") + " محد جاوب صح"}</div>
<div class="lv-muted">الإجابة الصحيحة</div>
<div class="a">${escapeHTML(String(bcAnswerOf(d, d.qIndex) || "…").split("|")[0])}</div>
</div>
${okLast}
</div>
<div class="lv-muted">${d.qIndex + 1 >= (d.questions || []).length ? "نهاية المواجهة بعد لحظات..." : "السؤال التالي بعد لحظات..."}</div>`;
    }
    return html;
}
/* وقت كشف الإجابة: بعد 1.6 ثانية من بداية لحظة الكشف */
function bcRevealAt(d) { return (d.deadline || 0) - LIVE_REVEAL_MS + 1600; }

/* ===== لوحة التشخيص (للمنظم): زمن الجرس وآخر محاولات الجواب الصوتي لكل متسابق ===== */
let bcDiagOpen = false;
let bcDiagDoc = null, bcDiagSub = null, bcDiagSubId = "";
function bcToggleDiag() { bcDiagOpen = !bcDiagOpen; liveLastSig = ""; renderLiveScreen(); }
/* اللوحة مفتوحة بس: نسمع liveDiag/<id> (برا وثيقة البث) */
function bcDiagListen(id) {
    if (bcDiagSubId === id) return;
    if (bcDiagSub) { bcDiagSub(); bcDiagSub = null; }
    bcDiagSubId = id || ""; bcDiagDoc = null;
    if (!id || !firebaseDB) return;
    bcDiagSub = liveDiagRef(id).onSnapshot(s => { bcDiagDoc = s.exists ? s.data() : null; const d = liveMatchesCache[openLiveId]; if (d) bcDiagPanel(d); }, () => {});
}
function bcDiagPanel(d) {
    let el = document.getElementById("bcDiag");
    if (!bcDiagOpen || !isAdmin || !d || !openLiveId) { if (el) el.remove(); bcDiagListen(""); return; }
    bcDiagListen(openLiveId);
    const dd = bcDiagDoc || d;   /* وثائق قديمة: التشخيص كان داخل وثيقة البث */
    const o = bcCur(d) || {};
    const diag = dd.bcDiag || {};
    const ms = v => v > 0 ? v + "ms" : (v < 0 ? "فشل" : "—");
    const ql = q => { const p = String(q || "").split("_"); return p.length === 2 ? "م" + (+p[0] + 1) + " س" + (+p[1] + 1) : escapeHTML(String(q || "")); };
    const who = [[o.uid1, o.p1], [o.uid2, o.p2]].filter(x => x[0]);
    const rows = who.map(([uid, name]) => {
        const x = diag[uid] || {};
        const bz = (x.buzz || []).slice().reverse().map(b => `<tr><td>${ql(b.q)}</td><td>${ms(b.local)}</td><td>${ms(b.tx)}</td><td>${ms(b.seen)}</td><td>${b.won ? "فاز" : "سُبق"}</td></tr>`).join("");
        const vd = (dd.vaDiag || {})[uid];
        const va = (Array.isArray(vd) ? vd : []).slice().reverse().map(v => `<li><b>${ql(v.q)}</b> ${escapeHTML((v.steps || []).join(" ← "))}${v.said ? " · «" + escapeHTML(String(v.said)) + "»" : ""}${v.ok != null ? (v.ok ? " ✓" : " ✗") : ""}${v.speechMs != null ? ` · كلام ${v.speechMs}ms` : ""}${v.via ? " · " + escapeHTML(String(v.via)) : ""}${v.ms ? ` · الحكم بعد ${v.ms}ms` : ""}${v.srv ? ` (Whisper ${+v.srv.stt || 0} · ${escapeHTML(String(v.srv.path || ""))})` : ""}</li>`).join("");
        /* أداء جواله وانقطاع النت (آخر قياس) */
        const pf = (x.perf || []).filter(q => q && q.renders != null).slice(-1)[0];
        const nt = (x.net || []).slice(-3).map(q => escapeHTML(String(q.ev || ""))).join("، ");
        const perf = pf ? `<div class="bd-e">جواله: رسم أقصى ${+pf.renderMax || 0}ms · مهام طويلة ${+pf.longMs || 0}ms · لمسة ${+pf.tapMax || 0}ms${pf.lite ? " · خفيف" : ""}</div>` : "";
        const net = nt ? `<div class="bd-e">النت: ${nt}</div>` : "";
        return `<div class="bd-p"><div class="bd-n">${escapeHTML(name || "")}</div>${perf}${net}
${bz ? `<table><tr><th>السؤال</th><th>محلي</th><th>السيرفر</th><th>وصل</th><th></th></tr>${bz}</table>` : `<div class="bd-e">ما ضغط الجرس للحين</div>`}
${va ? `<ul>${va}</ul>` : ""}</div>`;
    }).join("");
    if (!el) { el = document.createElement("div"); el.id = "bcDiag"; el.className = "bc-diag"; document.getElementById("liveScreen").appendChild(el); }
    const html = `<div class="bd-h">${ic("chart")} التشخيص <button onclick="bcToggleDiag()" aria-label="إغلاق">${ic("x")}</button></div>${rows || `<div class="bd-e">ما فيه متسابقين مربوطين في هالمواجهة</div>`}`;
    if (el.dataset.sig !== html) { el.dataset.sig = html; el.innerHTML = html; }
}
