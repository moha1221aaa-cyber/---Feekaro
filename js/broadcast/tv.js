/* الإخراج التلفزيوني (21 أكتوبر 2026): لحظات برامج المسابقات الكبيرة فوق شاشة البث
   - لحظة الجرس: شريط ذهبي يقطع الشاشة باسم المتسابق وصورته (والأزرق لما ينتقل السؤال)
   - العداد الأخير: آخر 5 ثواني الحلقة والرقم ينبضون، وأطراف الشاشة تحمر، وتكتكة خفيفة وقت الجرس بس (وقت الجواب لا، عشان ما تدخل مايك المتسابق)
   - كشف الجواب: شريط تشويق يتعبّى لين لحظة الكشف، وبعدها لوحة الجواب تنقلب لقدام مع لمعة ذهبية (css)
   - لوحة النتيجة بين الأسئلة: بعد الكشف بثانيتين، والرقم اللي تغيّر يتدحرج مثل العداد
   - الفاصل بين المواجهات: أشرطة ألوان الدوري تمسح الشاشة، ونتايج الجولة للحين، وبعدها مشهد المواجهة
   كل الحركة transform و opacity بس، ومع prefers-reduced-motion تصير ظهور واختفاء بدون حركة (css) */

function tvLayer(id, cls) {
    const scr = document.getElementById("liveScreen");
    if (!scr) return null;
    let el = document.getElementById(id);
    if (!el) { el = document.createElement("div"); el.id = id; el.className = cls; scr.appendChild(el); }
    return el;
}

/* ===== لحظة الجرس ===== */
function tvBuzzMoment(d) {
    const o = bcCur(d), n = d.answerer;
    if (!o || !n) return;
    const scr = document.getElementById("liveScreen");
    if (!scr) return;
    scr.querySelectorAll(".tv-buzz").forEach(e => e.remove());
    const el = document.createElement("div");
    el.className = "tv-buzz " + (d.passed ? "pass" : "gold") + (n === 2 ? " p2" : " p1");
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `<i class="tv-bz-band"></i><i class="tv-bz-shine"></i>
<div class="tv-bz-in"><img src="${safeSrc(bcAv(o, n))}" alt=""><div><b>${escapeHTML(n === 1 ? o.p1 : o.p2)}</b><span>${d.passed ? "انتقل له السؤال" : "ضغط الجرس!"}</span></div></div>`;
    scr.appendChild(el);
    /* لحظة الجرس = بداية وقت الإجابة (deadline - LIVE_ANSWER_MS)، فالشريط بنفس الإطار على كل الجوالات */
    const at = (Number(d.deadline) || 0) - LIVE_ANSWER_MS, late = at > 0 ? bcNow() - at : 0;
    if (late > 1500) { el.remove(); return; }
    showSync(el, at > 0 ? at : 0);
    setTimeout(() => el.remove(), Math.max(0, 1700 - Math.max(0, late)));
}

/* ===== العداد الأخير + لوحة النتيجة (تنادى من liveTick كل 200ms) ===== */
const TV = { sec: -1, boardKey: "" };
function tvTick(d) {
    const scr = document.getElementById("liveScreen");
    if (!scr) return;
    const playing = d && d.status === "live" && d.scene === "playing";
    const left = playing ? Math.max(0, (d.deadline || 0) - bcNow()) : 0;
    const final = playing && (d.phase === "buzz" || d.phase === "answer") && left > 0 && left <= 5000;
    if (final) tvLayer("tvVig", "tv-vig");
    scr.classList.toggle("tv-final", final);
    const ring = document.querySelector(".st-ring");
    if (ring) ring.classList.toggle("final", final);
    const sec = final ? Math.ceil(left / 1000) : -1;
    if (sec !== TV.sec) {
        TV.sec = sec;
        if (sec > 0) {
            const num = document.getElementById("lvTimerNum");
            bcRestartAnim(num, "beat");
            if (d.phase === "buzz") cinePlay("tick", sec <= 3 ? 0.45 : 0.3);
        }
    }
    tvBoard(d);
}

function tvBoard(d) {
    const el = document.getElementById("tvBoard");
    const o = d && bcCur(d);
    const show = !!(o && d.status === "live" && d.scene === "playing" && d.phase === "reveal" &&
        bcNow() >= bcRevealAt(d) + 2200 && bcNow() < (d.deadline || 0) - 250);
    if (!show) { if (el) el.classList.remove("on"); return; }
    const key = d.cur + "_" + d.qIndex;
    const b = tvLayer("tvBoard", "tv-board");
    if (TV.boardKey !== key) {
        TV.boardKey = key;
        const [p1, p2] = bcPreScores(d), s1 = d.s1 || 0, s2 = d.s2 || 0;
        const nq = (d.questions || []).length;
        const left = nq - d.qIndex - 1;
        const num = (a, z) => a === z ? `<b class="tv-n">${z}</b>` : `<b class="tv-n roll"><span>${a}</span><span>${z}</span></b>`;
        const dots = (d.log || []).slice(0, nq).map((w, i) => `<i class="${w === 1 ? "w1" : w === 2 ? "w2" : (i <= d.qIndex ? "w0" : "")}"></i>`).join("");
        const lead = s1 === s2 ? "تعادل" : (s1 > s2 ? o.p1 : o.p2) + " متقدم";
        b.innerHTML = `
<div class="tv-bd-row">
<div class="tv-bd-p ${d.outcome === 1 ? "up" : ""}"><img src="${safeSrc(bcAv(o, 1))}" alt=""><span class="nm">${escapeHTML(o.p1)}</span>${num(p1, s1)}</div>
<div class="tv-bd-mid"><div class="tv-bd-dots">${dots}</div><small>${left > 0 ? `باقي ${left} ${left === 1 ? "سؤال" : "أسئلة"}` : "آخر سؤال انتهى"}</small></div>
<div class="tv-bd-p r ${d.outcome === 2 ? "up" : ""}">${num(p2, s2)}<span class="nm">${escapeHTML(o.p2)}</span><img src="${safeSrc(bcAv(o, 2))}" alt=""></div>
</div>
<div class="tv-bd-lead">${escapeHTML(lead)}</div>`;
        bcRestartAnim(b, "on", () => TV.boardKey === key, true);
        return;
    }
    b.classList.add("on");
}

/* ===== الفاصل بين المواجهات: يسبق مشهد المواجهة الجاية ===== */
/* نحمّل فيديو الفاصل مبكر (وقت مشهد النتيجة) عشان يبدأ على طول */
let tvWarmed = false;
function tvWarm() {
    if (tvWarmed || CINE_REDUCED) return;
    tvWarmed = true;
    const v = document.createElement("video");
    const webm = v.canPlayType && v.canPlayType('video/mp4; codecs="avc1.42E01E"') === "" && v.canPlayType("video/webm") !== "";
    fetch("media/bumper." + (webm ? "webm" : "mp4")).catch(() => { tvWarmed = false; });
}
function tvBumper(d, then) {
    const scr = document.getElementById("liveScreen");
    if (!scr) { if (then) then(); return; }
    scr.querySelectorAll(".tv-bump").forEach(e => e.remove());
    const total = (d.order || []).length, done = (d.order || []).filter(x => x.state === "done");
    const el = document.createElement("div");
    el.className = "tv-bump";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `<i class="b1"></i><i class="b2"></i><i class="b3"></i>
<div class="tv-bp-in">
<img src="logo.png" alt="">
<b>المواجهة ${escapeHTML(BC_AR_NUM_F[d.cur] || String(d.cur + 1))}</b>
<span>${d.cur + 1} من ${total} · الجولة ${escapeHTML(String(d.round || ""))}</span>
${done.length ? `<div class="tv-bp-res">${done.slice(-3).map(x => `<div>${escapeHTML(x.p1)} <em>${x.s1 || 0} - ${x.s2 || 0}</em> ${escapeHTML(x.p2)}</div>`).join("")}</div>` : ""}
</div>`;
    scr.appendChild(el);
    /* الأشرطة والشعار من فيديو Remotion (media/bumper.mp4)، والنص الحي فوقه. لو الفيديو ما اشتغل تظل أشرطة css */
    const v = cineVideo(el, "media/bumper.mp4");
    if (v) {
        /* النص يستنى الفيديو يبدأ (أو 0.4 ث بالكثير) عشان يطلعون مع بعض */
        el.classList.add("wait");
        const go = () => el.classList.remove("wait");
        v.addEventListener("playing", () => { el.classList.add("vid"); go(); });
        v.addEventListener("error", go);
        setTimeout(go, 400);
    }
    cinePlay("whoosh", 0.55);
    setTimeout(() => cinePlay("impact", 0.35), 380);
    setTimeout(() => { if (then) then(); }, 1500);
    setTimeout(() => el.remove(), 2300);
}
