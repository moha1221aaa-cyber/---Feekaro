/* طبقة الإخراج الثانية (21 أكتوبر 2026، بعد "انقله نقلة نوعية"): كل شي هنا transform و opacity بس، وله بديل في prefers-reduced-motion
   1) التزامن: كل انتقال أو شريط يبدأ بوقت اللحظة في الوثيقة (بساعة السيرفر)، والجوال اللي وصله التحديث متأخر
      يقفز لنفس الإطار اللي عند الباقين (showSync). لو فات وقته كامل ما يطلع أبد، والصوت ما يطلع لو متأخر أكثر من 0.35 ث
   2) السؤال يطلع كلمة كلمة مع صوت المذيع (بساعة السيرفر)، والجوال المتأخر يشوف نفس الكلمات اللي عند الباقين
   3) شريط الموقف وقت الكشف: سلسلة، تعادل، رجوع، صدارة جديدة (نفس bcSituKind حق المذيع)
   4) شريط السؤال الذهبي وسؤال الحسم
   5) إضاءة الاستوديو حسب اللحظة: هدوء، توتر (آخر 5 ثواني والجواب)، احتفال (جواب صح والنتيجة)
   6) النقاط على المنصات تتدحرج لما تتغير
   ===================================================================== */
const SHOW = { situKey: "", goldKey: "", mood: "", scores: {} };
const SHOW_SOUND_LATE = 350;

/* يقدّم كل حركات العنصر (وعناصره) بقدر التأخير، فكل الجوالات تكون بنفس الإطار. يرجّع التأخير بالـ ms */
function showSync(el, at) {
    const late = at ? bcNow() - at : 0;
    if (!el || late <= 0 || !el.getAnimations) return Math.max(0, late);
    try { el.getAnimations({ subtree: true }).forEach(a => { try { a.currentTime = (Number(a.currentTime) || 0) + late; } catch (e) {} }); } catch (e) {}
    return late;
}
/* صوت الانتقال يطلع بس لو الجهاز ما تأخر (صوت متأخر أسوأ من بدون صوت) */
function showSound(at, id, v, o) { if (!at || bcNow() - at < SHOW_SOUND_LATE) cinePlay(id, v, o); }

/* ===== 2) السؤال كلمة كلمة ===== */
function showWordsHTML(text) {
    const ws = String(text || "").split(/\s+/).filter(Boolean);
    return ws.map((w, i) => `<span class="tv-w" style="--w:${i}">${escapeHTML(w)}</span>`).join(" ");
}
/* السؤال يطلع مع صوت المذيع (23 أكتوبر 2026، كان يطلع كامل بثانية): كل كلمة لها وقتها بساعة السيرفر.
   أول شي تقدير (المذيع يبدأ بعد qAt بـ 150ms، والمقدمة "السؤال الأول." قبل نص السؤال، وكل حرف ~75ms)،
   وأول ما يبدأ صوت المذيع فعلاً على هالجهاز (showSpeechAt من bcSpeak) نعرف بدايته ومدته، فتتوزع الكلمات على صوته بالضبط.
   الكلمة اللي طلعت ما ترجع تختفي، وأي رسم جديد للوحة ياخذ نفس الأوقات (فاللي فات يطلع على طول) */
const SHOW_MS_PER_CHAR = 75;
SHOW.qt = {};   /* مفتاح السؤال ← { t: [وقت كل كلمة], src: "est" أو "voice" } */
function showQKey(d) { return openLiveId + ":" + d.cur + "_" + d.qIndex; }
/* وقت كل كلمة: البداية + نسبة مكان الكلمة (بالحروف) من مدة نص السؤال */
function showWordTimes(q, start, span) {
    const ws = String(q || "").split(/\s+/).filter(Boolean), len = ws.join(" ").length || 1, t = [];
    let pos = 0;
    ws.forEach(w => { t.push(Math.round(start + span * (pos / len))); pos += w.length + 1; });
    return t;
}
function showEstimate(d) {
    const q = ((d.questions || [])[d.qIndex] || {}).text || "";
    const spoken = typeof bcQText === "function" ? bcQText(d, d.qIndex) : q;
    const pre = Math.max(0, spoken.lastIndexOf(q));
    const at = (Number(d.qAt) || bcNow()) + (bcIsDecider(d) ? 600 : 150) + 300;
    return showWordTimes(q, at + pre * SHOW_MS_PER_CHAR, q.length * SHOW_MS_PER_CHAR);
}
/* المذيع بدأ جملة على هالجهاز: zero بداية الصوت بساعة السيرفر، dur مدته بالثواني */
function showSpeechAt(text, zero, dur) {
    const d = liveMatchesCache[openLiveId];
    if (!d || d.scene !== "playing" || d.phase !== "buzz") return;
    const q = ((d.questions || [])[d.qIndex] || {}).text || "";
    const pos = q ? String(text || "").lastIndexOf(q) : -1;
    if (pos < 0 || !(dur > 0.5)) return;
    /* سكوت قصير في أول وآخر ملف الصوت */
    const len = text.length, use = Math.max(0.3, dur - 0.35) * 1000;
    const fresh = showWordTimes(q, zero + 120 + use * (pos / len), use * (q.length / len));
    const k = showQKey(d), old = SHOW.qt[k], now = bcNow();
    /* اللي طلع يظل طالع */
    SHOW.qt[k] = { src: "voice", t: fresh.map((x, i) => old && old.t[i] <= now ? old.t[i] : Math.max(x, now)) };
    showApplyWords(document.querySelector("#liveScreenBody .lv-qtext.tv-words"), d);
}
function showApplyWords(qt, d) {
    if (!qt || !d) return;
    const k = showQKey(d);
    if (!SHOW.qt[k]) SHOW.qt[k] = { src: "est", t: showEstimate(d) };
    const t = SHOW.qt[k].t, now = bcNow(), all = d.phase !== "buzz";
    qt.querySelectorAll(".tv-w").forEach((w, i) => w.style.setProperty("--wd", (all ? -10000 : (t[i] != null ? t[i] - now : 0)) + "ms"));
}
function showAfterRender(body, d) {
    const qt = body.querySelector(".lv-qtext.tv-words");
    if (qt && !qt.dataset.synced) { qt.dataset.synced = "1"; showApplyWords(qt, d); }
}

/* ===== 3 + 4 + 5) تنادى من liveTick كل 200ms ===== */
function showTick(d) {
    const scr = document.getElementById("liveScreen");
    if (!scr || !d) return;
    showLight(scr, d);
    if (d.status !== "live") return;
    const o = bcCur(d);
    if (!o) return;
    /* السؤال الذهبي / سؤال الحسم: شريط أول ما يبدأ السؤال */
    if (d.scene === "playing" && d.phase === "buzz" && bcIsDecider(d)) {
        const k = openLiveId + ":" + d.cur + "_" + d.qIndex;
        if (SHOW.goldKey !== k) {
            SHOW.goldKey = k;
            const gold = bcIsGolden(d);
            showBand(scr, gold ? "gold" : "decider", ic(gold ? "crown" : "alarm"), gold ? "السؤال الذهبي" : "سؤال الحسم", gold ? "أول إجابة صحيحة تفوز بالمواجهة" : "هذا السؤال يحسم المواجهة", Number(d.qAt) || 0);
        }
    }
    /* شريط الموقف: بعد قلب لوحة الجواب، وقبل لوحة النتيجة */
    if (d.scene === "playing" && d.phase === "reveal" && d.outcome) {
        const k = openLiveId + ":" + d.cur + "_" + d.qIndex, at = bcRevealAt(d) + 600;
        if (SHOW.situKey !== k && bcNow() >= at - 100) {
            SHOW.situKey = k;
            const kind = typeof bcSituKind === "function" ? bcSituKind(d) : "";
            const name = d.outcome === 1 ? o.p1 : o.p2;
            const t = { streak: [ic("zap"), "سلسلة نارية", name + " ما يوقفه أحد"], tie: [ic("target"), "تعادل!", "المواجهة رجعت من أولها"],
                comeback: [ic("rocket"), "عودة!", name + " يرجع للمواجهة"], lead: [ic("medal"), "صدارة جديدة", name + " يتقدم"] }[kind];
            if (t) showBand(scr, "situ " + kind, t[0], t[1], t[2], at);
        }
    }
}

/* شريط عريض يقطع الشاشة (يطلع ويختفي في 1.8 ث) */
function showBand(scr, kind, icon, title, sub, at) {
    const late = at ? bcNow() - at : 0;
    if (late > 1500) return;
    scr.querySelectorAll(".tv-band").forEach(e => e.remove());
    const el = document.createElement("div");
    el.className = "tv-band " + kind;
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `<i class="tv-bd-bar"></i><i class="tv-bd-glint"></i><div class="tv-bd-in"><span class="tv-bd-ic">${icon}</span><div><b>${escapeHTML(title)}</b><small>${escapeHTML(sub)}</small></div></div>`;
    scr.appendChild(el);
    showSync(el, at);
    showSound(at, /gold|decider/.test(kind) ? "riser" : "impact", 0.45, /gold|decider/.test(kind) ? { tail: 1 } : undefined);
    setTimeout(() => el.remove(), Math.max(0, 1800 - Math.max(0, late)));
}

/* الإضاءة: 3 طبقات ثابتة تحت الشاشة، وتتبدل بالشفافية بس */
function showMood(d) {
    if (!d || d.status !== "live") return "calm";
    const now = bcNow();
    if (d.scene === "result" && now - (Number(d.sceneAt) || 0) < 5000) return "party";
    if (d.scene === "countdown") return "tense";
    if (d.scene !== "playing") return "calm";
    if (d.phase === "reveal") return d.outcome && now >= bcRevealAt(d) && now < bcRevealAt(d) + 2600 ? "party" : "calm";
    if (d.phase === "answer") return "tense";
    const left = (d.deadline || 0) - now;
    return left > 0 && left <= 5000 ? "tense" : "calm";
}
function showLight(scr, d) {
    let el = document.getElementById("tvLight");
    if (!el) {
        el = document.createElement("div");
        el.id = "tvLight"; el.className = "tv-light"; el.setAttribute("aria-hidden", "true");
        el.innerHTML = `<i class="calm"></i><i class="tense"></i><i class="party"></i>`;
        const body = document.getElementById("liveScreenBody");
        scr.insertBefore(el, body || null);
    }
    const m = showMood(d);
    if (SHOW.mood !== m) { SHOW.mood = m; el.dataset.mood = m; }
}

/* ===== 6) نقاط المنصة: الرقم القديم يطلع لفوق والجديد يدخل ===== */
function showScoreHTML(d, n) {
    const v = n === 1 ? (d.s1 || 0) : (d.s2 || 0);
    const k = openLiveId + ":" + d.cur + ":" + n;
    /* نفس الكود لين يتغير الرقم مرة ثانية، عشان أي رسم ثاني للمنصة ما يعيد الحركة ولا يشيلها */
    const st = SHOW.scores[k];
    if (!st) { SHOW.scores[k] = { v, from: v, at: 0 }; return `<b>${v}</b>`; }
    if (st.v !== v) { st.from = st.v; st.v = v; st.at = bcNow(); }
    /* التدحرج بس أول 1.5 ث بعد التغيير (المنصة ينعاد رسمها مع كل مرحلة، فما يتكرر) */
    return st.from === v || bcNow() - st.at > 1500 ? `<b>${v}</b>` : `<b class="tv-roll"><span>${st.from}</span><span>${v}</span></b>`;
}

/* ===== شريط الأخبار: إحصائيات المواجهة الحية ===== */
function showStats(d) {
    const o = bcCur(d), out = [];
    if (!o || !(d.scene === "playing" || d.scene === "result")) return out;
    const fb = [Number(d.fb1) || 0, Number(d.fb2) || 0];
    const best = fb[0] && (!fb[1] || fb[0] <= fb[1]) ? 1 : (fb[1] ? 2 : 0);
    if (best) out.push(`${ic("bell")} أسرع جرس: ${escapeHTML(best === 1 ? o.p1 : o.p2)} <b>${(fb[best - 1] / 1000).toFixed(1)} ث</b>`);
    const log = (d.log || []).filter(x => x >= 0);
    if (log.length) {
        const a = log.filter(x => x === 1).length, b = log.filter(x => x === 2).length;
        out.push(`${ic("check-circle")} الإجابات الصحيحة: ${escapeHTML(o.p1)} <b>${a}</b> · ${escapeHTML(o.p2)} <b>${b}</b> من ${log.length}`);
    }
    if (typeof bcPredCounts === "function") {
        const c = bcPredCounts(d, d.cur);
        if (c.t) out.push(`${ic("users")} توقعات الجمهور: ${escapeHTML(o.p1)} <b>${Math.round(c.a / c.t * 100)}%</b> · ${escapeHTML(o.p2)} <b>${Math.round(c.b / c.t * 100)}%</b>`);
    }
    return out;
}
