/* محرك بث الجولة: الحالة، وقت السيرفر، تحكم المنظم، الطيار الآلي، مطابقة الإجابة */
/* =====================================================================
   بث الجولة المباشر — بث صوتي واحد لكل مواجهات الجولة
   - المنظم (المسؤول) يبدأ بث الجولة، ومايكه مفتوح طول البث
   - أول ما تبدأ أي مواجهة ينفتح مايك للمتسابقين الاثنين تلقائياً
   - مشاهد وانتقالات: افتتاح ← تقديم المواجهة ← الأسئلة ← النتيجة ← المواجهة التالية ← ختام الجولة
   - المواجهة نفسها: 5 أسئلة بنظام الجرس
   ===================================================================== */
const LIVE_Q_COUNT = 5;
const LIVE_COUNT_MS = 3500;   /* العد التنازلي قبل البداية */
const LIVE_BUZZ_MS = 15000;   /* وقت ضغط الجرس */
const LIVE_ANSWER_MS = 7000;  /* وقت الجواب بعد الجرس (طلب محمد 23 أكتوبر 2026): المقدم يحكم قبلها، ولو خلص الوقت ينتقل للثاني */
const LIVE_REVEAL_MS = 6500;  /* عرض الإجابة قبل السؤال التالي */
const BC_CHANNEL = "masro7_live_round"; /* قناة صوت البث (منفصلة عن الغرفة الصوتية) */
const BC_MATCH_SCENES = ["intro", "talk", "countdown", "playing", "result"];

/* أسئلة احتياطية تُستخدم فقط إذا قاعدة الأسئلة ما تكفي */
const LIVE_FALLBACK_QUESTIONS = [
    { text: "ما عاصمة اليابان؟", answer: "طوكيو" },
    { text: "كم عدد قارات العالم؟", answer: "7|سبع|سبعة" },
    { text: "ما أكبر كوكب في المجموعة الشمسية؟", answer: "المشتري" },
    { text: "كم عدد سور القرآن الكريم؟", answer: "114|مئة واربعة عشر|مائة واربعة عشر" },
    { text: "ما أطول سورة في القرآن الكريم؟", answer: "البقرة|سورة البقرة" },
    { text: "من أول الخلفاء الراشدين؟", answer: "أبو بكر الصديق|ابو بكر|ابوبكر" },
    { text: "كم عدد أركان الإسلام؟", answer: "5|خمس|خمسة" },
    { text: "ما أول سورة في ترتيب المصحف؟", answer: "الفاتحة|سورة الفاتحة" },
    { text: "ما النبي الذي التقمه الحوت؟", answer: "يونس|يونس عليه السلام" },
    { text: "ما عاصمة أستراليا؟", answer: "كانبرا" },
    { text: "ما عاصمة كندا؟", answer: "أوتاوا|اوتاوا" },
    { text: "ما عاصمة تركيا؟", answer: "أنقرة|انقره" },
    { text: "ما أكبر محيط في العالم؟", answer: "الهادي|المحيط الهادي|الهادئ|المحيط الهادئ" },
    { text: "ما أعلى جبل في العالم؟", answer: "إيفرست|ايفرست|افرست" },
    { text: "ما أسرع حيوان بري؟", answer: "الفهد" },
    { text: "كم عدد عظام جسم الإنسان البالغ؟", answer: "206" },
    { text: "ما الرمز الكيميائي للذهب؟", answer: "Au" },
    { text: "ما الغاز الذي تمتصه النباتات لصنع غذائها؟", answer: "ثاني أكسيد الكربون|ثاني اكسيد الكربون|co2" },
    { text: "كم عدد لاعبي فريق كرة القدم داخل الملعب؟", answer: "11|احدى عشر|احد عشر" },
    { text: "ما عملة اليابان؟", answer: "الين|ين" },
    { text: "كم عدد أيام السنة الكبيسة؟", answer: "366" },
    { text: "كم عدد كواكب المجموعة الشمسية؟", answer: "8|ثمانية|ثمان" },
    { text: "ما أصغر دولة في العالم مساحة؟", answer: "الفاتيكان" },
    { text: "من فاز بكأس العالم لكرة القدم 2022؟", answer: "الأرجنتين|الارجنتين" },
    { text: "في أي عام أُعلن توحيد المملكة العربية السعودية ميلادياً؟", answer: "1932" },
    /* 23 أكتوبر 2026: احتياط أكبر (لو توليد الأسئلة فشل)، معلومات ثابتة بدون خلاف */
    { text: "ما عاصمة مصر؟", answer: "القاهرة|القاهره" },
    { text: "ما عاصمة فرنسا؟", answer: "باريس" },
    { text: "ما عاصمة إيطاليا؟", answer: "روما" },
    { text: "ما عاصمة ألمانيا؟", answer: "برلين" },
    { text: "ما عاصمة إسبانيا؟", answer: "مدريد" },
    { text: "ما عاصمة الإمارات العربية المتحدة؟", answer: "أبوظبي|ابوظبي|أبو ظبي|ابو ظبي" },
    { text: "ما عاصمة المغرب؟", answer: "الرباط" },
    { text: "ما عاصمة روسيا؟", answer: "موسكو" },
    { text: "ما عاصمة الصين؟", answer: "بكين" },
    { text: "ما عاصمة اليمن؟", answer: "صنعاء" },
    { text: "ما عاصمة العراق؟", answer: "بغداد" },
    { text: "ما عاصمة الأردن؟", answer: "عمّان|عمان" },
    { text: "ما عاصمة سلطنة عمان؟", answer: "مسقط" },
    { text: "ما عاصمة قطر؟", answer: "الدوحة|الدوحه" },
    { text: "ما عاصمة البحرين؟", answer: "المنامة|المنامه" },
    { text: "كم عدد أيام الأسبوع؟", answer: "7|سبعة|سبع" },
    { text: "كم عدد أشهر السنة؟", answer: "12|اثنا عشر|اثني عشر|اثنعش" },
    { text: "ما الكوكب الأقرب إلى الشمس؟", answer: "عطارد" },
    { text: "ما الكوكب الملقب بالكوكب الأحمر؟", answer: "المريخ" },
    { text: "ما أكبر قارة في العالم مساحة؟", answer: "آسيا|اسيا" },
    { text: "كم عدد ألوان قوس قزح؟", answer: "7|سبعة|سبع" },
    { text: "ما اللغة الرسمية في البرازيل؟", answer: "البرتغالية|البرتغالي|البرتغاليه" },
    { text: "كم عدد لاعبي فريق كرة السلة داخل الملعب؟", answer: "5|خمسة|خمس" },
    { text: "في أي مدينة يقع المسجد النبوي؟", answer: "المدينة المنورة|المدينة|المدينه" },
    { text: "كم عدد الصلوات المفروضة في اليوم والليلة؟", answer: "5|خمس|خمسة" },
    { text: "من النبي الذي رفع قواعد الكعبة مع ابنه إسماعيل؟", answer: "إبراهيم|ابراهيم" },
    { text: "ما الحيوان الملقب بسفينة الصحراء؟", answer: "الجمل|الإبل|الابل|البعير" },
    { text: "ما أكبر حيوان على وجه الأرض؟", answer: "الحوت الأزرق|الحوت الازرق" },
    { text: "كم عدد أرجل العنكبوت؟", answer: "8|ثمانية|ثمان|ثماني" },
    { text: "ما المعدن الوحيد السائل في درجة حرارة الغرفة؟", answer: "الزئبق" },
    { text: "ما الغاز الذي يحتاجه الإنسان للتنفس؟", answer: "الأكسجين|الاكسجين" },
    { text: "كم دقيقة في الساعة؟", answer: "60|ستين|ستون" },
    { text: "في أي قارة تقع مصر؟", answer: "أفريقيا|افريقيا|إفريقيا" },
    { text: "ما أكبر صحراء حارة في العالم؟", answer: "الصحراء الكبرى|الكبرى" },
    { text: "من أول إنسان مشى على سطح القمر؟", answer: "نيل آرمسترونغ|آرمسترونغ|ارمسترونغ|نيل ارمسترونج|ارمسترونج" },
    { text: "كم عدد أضلاع المثلث؟", answer: "3|ثلاثة|ثلاث" },
    { text: "ما العضو الذي يضخ الدم في جسم الإنسان؟", answer: "القلب" },
    { text: "في أي سنة هجرية كانت غزوة بدر الكبرى؟", answer: "2|الثانية|الثانيه|السنة الثانية" }
];

let liveMatchesCache = {};   /* بثوث الجولات فقط (type: "round") */
let liveListener = null;
let openLiveId = null;
let liveTickTimer = null;
let liveAdvanceBusy = false;
let liveLastAdvanceTry = 0;
let liveLastSig = "";
let liveMatchesSig = "";
let liveApplyTried = {};
let livePrevView = null;
let bcPrevKey = null;
let bcLocalBuzzQ = "";   /* السؤال اللي ضغطت جرسه من هالجهاز (صوت الجرس اشتغل محلياً، فما نعيده) */
const bcEndedStale = {};

function liveCol() { return firebaseDB.collection("room").doc("main").collection("liveMatches"); }
function liveRef(id) { return liveCol().doc(id); }
/* وثائق جنب وثيقة البث عشان تبقى صغيرة (كل تغيير فيها ينرسل كامل لكل جوال فاتح البث، وكانت 73KB):
   liveBoxes/<id> صناديق أسئلة المواجهات (السيرفر بس يقراها)، liveDiag/<id> التشخيص (المنظم يقراها لما يفتح اللوحة) */
function liveBoxesRef(id) { return firebaseDB.collection("room").doc("main").collection("liveBoxes").doc(id); }
function liveDiagRef(id) { return firebaseDB.collection("room").doc("main").collection("liveDiag").doc(id); }
/* وقت المسابقة التجريبية (leagueTrial في app.js) البث له معرّف لحاله (round_trialall)، عشان ما ينكتب فوق بث الجولة الحقيقية */
/* المسابقة التجريبية: بث واحد فيه كل الجولات (طلب محمد 23 أكتوبر 2026)، فمعرّفه واحد مهما كانت الجولة */
function bcId(r) { return leagueTrial ? "round_trialall" : "round_" + r; }
const BC_TRIAL_ROUND = "التجريبية";
/* ===== وقت السيرفر: فرق ساعة الجوال عن السيرفر، عشان المؤقتات تكون عادلة للكل ===== */
let bcClockOffset = 0, bcClockSynced = false;
try { bcClockOffset = Number(sessionStorage.getItem("bcClockOffset")) || 0; } catch (e) {}
function bcNow() { return Date.now() + bcClockOffset; }
async function bcSyncClock() {
    let best = null;
    for (let i = 0; i < 3; i++) {
        try {
            const t0 = Date.now();
            const r = await fetch("/time?_=" + t0, { cache: "no-store" });
            const t1 = Date.now();
            const j = await r.json();
            if (!j || !j.t) continue;
            const rtt = t1 - t0, off = j.t - (t0 + rtt / 2);
            if (!best || rtt < best.rtt) best = { rtt, off };
        } catch (e) {}
    }
    if (best && best.rtt < 3000) {
        bcClockOffset = Math.round(best.off); bcClockSynced = true;
        try { sessionStorage.setItem("bcClockOffset", String(bcClockOffset)); } catch (e) {}
    }
}
bcSyncClock();
setInterval(bcSyncClock, 5 * 60 * 1000);

/* بث معلّق: أكثر من 3 ساعات بدون أي تحديث (أو مجدول فات موعده بـ 3 ساعات) */
const BC_STALE_MS = 3 * 3600 * 1000;
function bcTsMs(t) { try { return t ? (typeof t.toMillis === "function" ? t.toMillis() : Number(t) || 0) : 0; } catch (e) { return 0; } }
function bcLastActivity(d) { return Math.max(bcTsMs(d.updatedAt), Number(d.sceneAt) || 0, Number(d.hostSeen) || 0, Number(d.startedAt) || 0, bcTsMs(d.createdAt)); }
function bcIsStale(d) {
    if (!d) return false;
    const now = bcNow();
    if (d.status === "scheduled") return now - (Number(d.startAt) || 0) > BC_STALE_MS;
    if (d.status === "live") { const last = bcLastActivity(d); return !!last && now - last > BC_STALE_MS; }
    return false;
}
function isLiveActive(d) { return !!d && (d.status === "live" || d.status === "scheduled") && !bcIsStale(d); }
/* وقت بداية البث المجدول بصيغة "10:30 م" */
function bcTimeLabel(ms) {
    const t = new Date(ms - bcClockOffset);
    let h = t.getHours(); const m = String(t.getMinutes()).padStart(2, "0");
    const pm = h >= 12; h = h % 12 || 12;
    const day = new Date(bcNow() - bcClockOffset).toDateString() === t.toDateString() ? "" : " (بكرة)";
    return `${h}:${m} ${pm ? "م" : "ص"}${day}`;
}
function bcCur(d) { return (d && d.order && d.cur >= 0) ? (d.order[d.cur] || null) : null; }
function bcInMatch(d) { return !!d && d.status === "live" && BC_MATCH_SCENES.indexOf(d.scene) !== -1 && !!bcCur(d); }

/* رقم المتسابق في المواجهة الحالية (1 أو 2) أو 0 */
function myLiveNum(d) {
    if (!currentUser || !d) return 0;
    const o = bcCur(d);
    if (!o) return 0;
    if (o.uid1 && o.uid1 === currentUser.uid) return 1;
    if (o.uid2 && o.uid2 === currentUser.uid) return 2;
    return 0;
}
function amBcHost(d) { return !!(currentUser && d && d.hostUid === currentUser.uid); }
function livePlayerName(d, n) { const o = bcCur(d) || {}; return n === 1 ? (o.p1 || "") : (n === 2 ? (o.p2 || "") : ""); }
function bcAv(o, n) { return cdnThumb((n === 1 ? o.av1 : o.av2) || getPlayerAvatar(n === 1 ? o.p1 : o.p2).url); }

function initLiveMatches() {
    if (!firebaseDB || liveListener) return;
    liveListener = liveCol().onSnapshot(snap => {
        const next = {};
        snap.forEach(doc => {
            const x = doc.data();
            if (x && x.type === "round") next[doc.id] = x;
            else if (x && x.type === "rx" && openLiveId && doc.id === "rx_" + openLiveId) bcOnRx(x);
        });
        bcNotifyChanges(liveMatchesCache, next);
        liveMatchesCache = next;

        const sig = Object.keys(next).sort().map(k => {
            const x = next[k];
            return k + ":" + x.status + ":" + x.scene + ":" + x.cur + ":" + (x.s1 || 0) + ":" + (x.s2 || 0);
        }).join("|");
        if (sig !== liveMatchesSig) {
            liveMatchesSig = sig;
            renderMatches();
            renderLiveBars();
        }
        if (openLiveId) { renderLiveScreen(); bcSyncAudio(); }
        if (bcDeepLink && next[bcDeepLink] && !openLiveId) {
            const id = bcDeepLink; bcDeepLink = null;
            try { history.replaceState(history.state, "", location.pathname); } catch (e) {}
            openLiveScreen(id);
        }
        Object.keys(next).forEach(id => bcApplyResults(id));
        if (isAdmin) Object.keys(next).forEach(id => {
            const x = next[id];
            if ((x.status === "live" || x.status === "scheduled") && bcIsStale(x) && !bcEndedStale[id]) {
                bcEndedStale[id] = 1;
                liveTx(id, (y, now) => (y.status === "live" || y.status === "scheduled") && bcIsStale(y) ? { status: "ended", phase: "done", endedAt: now, endReason: "stale" } : null).catch(() => {});
            }
        });
    }, err => {
        console.log("liveMatches listener:", err);
    });
}

/* إشعارات البث: بدأ، مجدول، دورك */
let bcNotifReady = false;
function bcNotifyChanges(prev, next) {
    if (!bcNotifReady) { bcNotifReady = true; return; }   /* أول تحميل: ما نرسل شي قديم */
    Object.keys(next).forEach(id => {
        const x = next[id], p = prev[id];
        if (!x || bcIsStale(x)) return;
        const mine = currentUser && x.hostUid === currentUser.uid;
        const url = "/?live=" + encodeURIComponent(id);
        if (x.status === "scheduled" && (!p || p.status !== "scheduled") && !mine)
            notify("بث جديد مجدول 📅", `بث الجولة ${x.round} يبدأ الساعة ${bcTimeLabel(x.startAt || 0)}`, "sch_" + id + "_" + x.startAt, url);
        if (x.status === "live" && (!p || p.status !== "live") && !mine)
            notify("البث بدأ 🔴", `بث الجولة ${x.round} من دوري بنو مسروح للنخبة مباشر الحين`, "live_" + id + "_" + (x.startedAt || x.sceneAt || ""), url);
        /* دورك: مواجهتك صارت الحالية في البث */
        const o = bcCur(x);
        if (currentUser && o && x.status === "live" && (o.uid1 === currentUser.uid || o.uid2 === currentUser.uid) && x.scene === "intro" && (!p || p.cur !== x.cur || p.scene !== "intro") && openLiveId !== id)
            notify("دورك الحين! 🎯", `مواجهتك ضد ${o.uid1 === currentUser.uid ? o.p2 : o.p1} بدأت في البث. ادخل واضغط جاهز`, "turn_" + id + "_" + x.cur, url);
    });
}

function renderLiveBars() {
    let html = "";
    Object.keys(liveMatchesCache).filter(id => isLiveActive(liveMatchesCache[id])).forEach(id => {
        const d = liveMatchesCache[id];
        const o = bcCur(d);
        let info = "الافتتاح";
        if (d.status === "scheduled") info = "يبدأ الساعة " + bcTimeLabel(d.startAt || 0);
        else if (d.scene === "closing") info = "ختام الجولة";
        else if (o && bcInMatch(d)) info = `<b>${escapeHTML(o.p1)}</b><span class="lb-sc">${d.s1 || 0} - ${d.s2 || 0}</span><b>${escapeHTML(o.p2)}</b>`;
        html += `
<div class="live-bar" data-id="${escapeHTML(id)}" onclick="openLiveScreen(this.dataset.id)">
<span class="dot"></span>
<span class="lb-txt">بث الجولة ${escapeHTML(String(d.round))} · ${info}</span>
<span class="lb-go">${ic("volume-2")} ${d.status === "scheduled" ? "ادخل" : "استمع"}</span>
</div>`;
    });
    ["liveMatchesBar", "liveMatchesBarHome"].forEach(bid => {
        const el = document.getElementById(bid);
        if (el) el.innerHTML = html;
    });
}

/* زر تحت عنوان الجولة: بدء بث الجولة (للمسؤول) أو الاستماع للبث (للكل) */
function buildRoundLiveRow(r) {
    const id = bcId(r);
    const d = liveMatchesCache[id];
    const row = document.createElement("div");
    row.className = "round-live-row";
    /* التجربة: زر واحد بس (عند أول جولة فيها مواجهات ما انلعبت) للبث اللي فيه كل الجولات */
    if (leagueTrial) {
        const left = matches.filter(m => m.s1 === "" || m.s2 === "").map(m => Number(m.round));
        if (!left.length || Number(r) !== Math.min.apply(null, left)) return null;
    }
    if (isLiveActive(d)) {
        const b = document.createElement("button");
        b.className = "live-watch-btn";
        b.innerHTML = d.status === "scheduled"
            ? `${ic("hourglass")} بث الجولة ${escapeHTML(String(d.round || r))} يبدأ الساعة ${escapeHTML(bcTimeLabel(d.startAt || 0))} — ادخل`
            : `<span class="dot" style="background:#fff;"></span> بث الجولة ${escapeHTML(String(d.round || r))} مباشر الآن — استمع`;
        b.onclick = () => openLiveScreen(id);
        row.appendChild(b);
        return row;
    }
    if (isAdmin) {
        const b = document.createElement("button");
        b.className = "live-start-btn";
        b.innerHTML = leagueTrial ? `${ic("megaphone")} بدء بث التجربة (كل الجولات في بث واحد)` : `${ic("megaphone")} بدء البث المباشر للجولة ${escapeHTML(String(r))}`;
        b.onclick = () => bcStartRound(r);
        row.appendChild(b);
        return row;
    }
    return null;
}

/* شارة "تُلعب الآن" على بطاقة المواجهة اللي عليها الدور في البث */
function buildMatchLiveRow(m) {
    if (!(m.s1 === "" || m.s2 === "")) return null;
    const id = bcId(m.round);
    const d = liveMatchesCache[id];
    if (!bcInMatch(d)) return null;
    const o = bcCur(d);
    if (!o || o.p1 !== m.p1.name || o.p2 !== m.p2.name) return null;
    const row = document.createElement("div");
    row.className = "match-live-row";
    const b = document.createElement("button");
    b.className = "live-watch-btn";
    b.innerHTML = `<span class="dot" style="background:#fff;"></span> تُلعب الآن في البث ${d.scene === "playing" ? `(${d.s1 || 0} - ${d.s2 || 0})` : ""} — استمع`;
    b.onclick = () => openLiveScreen(id);
    row.appendChild(b);
    return row;
}

/* ===== أسئلة جديدة لكل بث (23 أكتوبر 2026، "الأسئلة صارت معروفة وتتكرر") =====
   بنك الأسئلة كان فاضي، فكل بث ياخذ من نفس الأسئلة الاحتياطية، والتكرار ممنوع داخل البث الواحد بس.
   الحين: (1) سجل دائم لكل سؤال انسأل (liveDiag/_qhistory، آخر 1500)، وما ينعاد سؤال فيه إلا لو خلصت كل الأسئلة.
   (2) أول ما يبدأ المنظم بث جولة، الذكاء الاصطناعي يولّد أسئلة جديدة على قد المواجهات (تصنيفات مختلفة، ومدقق ثاني يراجعها)
   وتنحط قبل البنك والاحتياطي. لو تأخر أو فشل، البث يكمّل من البنك والاحتياطي (اللي ما انسأل أول، وبعدها الأقدم) */
const BC_QHIST_MAX = 1500;   /* أكبر من الـ500 الصعبة عشان ما تنعاد */
let bcFreshPool = [], bcQHist = [];
/* 500 سؤال صعب جاهز (طلب محمد 23 أكتوبر 2026، js/broadcast/qbank-hard.json): ينحمّل عند المنظم بس وقت بدء البث،
   وياخذ الأولوية قبل أسئلة الذكاء الاصطناعي. اللي انسأل منها ما ينعاد (bcQHist) */
let BC_HARD = [];
function bcLoadHard() {
    if (BC_HARD.length) return Promise.resolve(BC_HARD);
    return fetch("js/broadcast/qbank-hard.json").then(r => r.ok ? r.json() : []).then(a => {
        BC_HARD = (Array.isArray(a) ? a : []).filter(q => q && q.text && q.answer);
        return BC_HARD;
    }).catch(() => []);
}
function bcQHistRef() { return liveDiagRef("_qhistory"); }
function bcQKey(t) { return liveNormalize(String(t || "")).replace(/\s+/g, ""); }
async function bcLoadQHistory() {
    try { const s = await bcQHistRef().get(); bcQHist = s.exists && Array.isArray(s.data().texts) ? s.data().texts : []; } catch (e) {}
    return bcQHist;
}
function bcSaveQHistory(texts) {
    const seen = new Set(), all = bcQHist.concat(texts).reverse().filter(t => { const k = bcQKey(t); if (!k || seen.has(k)) return false; seen.add(k); return true; }).reverse();
    bcQHist = all.slice(-BC_QHIST_MAX);
    if (firebaseDB) bcQHistRef().set({ texts: bcQHist, at: bcNow() }).catch(() => {});
}
/* يطلب أسئلة جديدة من أكثر من تصنيف بنفس اللحظة (حد السيرفر 4 بالدقيقة، فـ 3 طلبات بالكثير) */
async function bcFreshQuestions(need) {
    if (typeof aiCall !== "function" || need <= 0) return [];
    const cats = ["ثقافة عامة", "جغرافيا", "تاريخ", "علوم", "دين", "رياضة"].map(c => [Math.random(), c]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const calls = Math.min(3, Math.max(1, Math.ceil(need / 7)));
    const avoid = bcQHist.slice(-60);
    const res = await Promise.allSettled(cats.slice(0, calls).map(category => aiCall("questions", { category, count: 10, avoid }, 70000)));
    const seen = new Set(bcQHist.map(bcQKey)), seenA = new Set(), out = [];
    res.forEach(r => (r.status === "fulfilled" && r.value && r.value.questions || []).forEach(q => {
        const k = bcQKey(q && q.text), a = bcQKey(String((q && q.answer) || "").split("|")[0]);
        if (!k || !q.answer || seen.has(k) || seenA.has(a)) return;
        seen.add(k); seenA.add(a); out.push({ text: String(q.text), answer: String(q.answer) });
    }));
    return out.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
}
function pickLiveQuestions(exclude) {
    const ex = new Set((exclude || []).map(bcQKey));
    const hist = new Map(bcQHist.map((t, i) => [bcQKey(t), i]));
    const shuffle = arr => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const bank = (roomState.qbank || []).filter(q => q && q.text && q.answer);
    let picked = [];
    const fill = (pool, order) => {
        if (picked.length >= LIVE_Q_COUNT) return;
        const used = new Set(picked.map(q => bcQKey(q.text)));
        const ok = pool.filter(q => !used.has(bcQKey(q.text)) && !ex.has(bcQKey(q.text)));
        picked = picked.concat((order ? order(ok) : shuffle(ok)).slice(0, LIVE_Q_COUNT - picked.length));
    };
    const fresh = q => !hist.has(bcQKey(q.text));
    fill(BC_HARD.filter(fresh));                                         /* الـ500 الصعبة اللي ما انسألت */
    fill(bcFreshPool.filter(fresh));                                     /* جديدة من الذكاء الاصطناعي */
    fill(bank.filter(fresh));                                            /* البنك: اللي ما انسأل */
    fill(LIVE_FALLBACK_QUESTIONS.filter(fresh));                         /* الاحتياطي: اللي ما انسأل */
    /* خلصت الأسئلة اللي ما انسألت: الأقدم في السجل أول */
    const oldest = arr => arr.slice().sort((a, b) => (hist.get(bcQKey(a.text)) || 0) - (hist.get(bcQKey(b.text)) || 0));
    fill(bank.concat(LIVE_FALLBACK_QUESTIONS), oldest);
    if (picked.length < LIVE_Q_COUNT) { ex.clear(); fill(bank.concat(LIVE_FALLBACK_QUESTIONS), oldest); }
    return picked.map(q => ({ text: String(q.text), answer: String(q.answer) }));
}

function bcQuizReset() {
    return {
        ready1: false, ready2: false, qIndex: 0, phase: "wait",
        buzzer: 0, answerer: 0, tried1: false, tried2: false, passed: false,
        lastAnswer: null, outcome: 0, deadline: 0, s1: 0, s2: 0,
        log: Array(LIVE_Q_COUNT).fill(-1), fb1: 0, fb2: 0, bh1: 0, bh2: 0, qAt: 0, golden: 0
    };
}

async function bcStartRound(r) {
    if (!firebaseDB || !isAdmin || !currentUser) return;
    const id = bcId(r);
    if (isLiveActive(liveMatchesCache[id])) return openLiveScreen(id);
    /* التجربة: كل المواجهات اللي ما انلعبت من كل الجولات بالترتيب، و round في الوثيقة اسم ("التجريبية") وجولة كل مواجهة في order[i].round */
    const allRounds = !!leagueTrial;
    const ms = matches.filter(m => (allRounds || Number(m.round) === Number(r)) && (m.s1 === "" || m.s2 === ""))
        .map((m, i) => [m, i]).sort((a, b) => (Number(a[0].round) - Number(b[0].round)) || (a[1] - b[1])).map(x => x[0]);
    if (ms.length) r = allRounds ? BC_TRIAL_ROUND : ms[0].round;
    if (!ms.length) return alert(allRounds ? "ما فيه مواجهات متبقية في التجربة." : "ما فيه مواجهات متبقية في هذي الجولة.");

    const unlinked = [];
    ms.forEach(m => [m.p1.name, m.p2.name].forEach(n => { if (!playerLinks[n] && unlinked.indexOf(n) === -1) unlinked.push(n); }));
    const choice = await bcAskStart(r, ms.length, unlinked);
    if (!choice) return;

    const myName = (currentUserDocData && currentUserDocData.name) || currentUser.displayName || "المنظم";
    const myAv = (currentUserDocData && currentUserDocData.photoURL) || getPlayerAvatar(myName).url;
    const order = ms.map(m => ({
        p1: m.p1.name, p2: m.p2.name, round: m.round,
        uid1: playerLinks[m.p1.name] || "", uid2: playerLinks[m.p2.name] || "",
        av1: getPlayerAvatar(m.p1.name).url, av2: getPlayerAvatar(m.p2.name).url,
        s1: 0, s2: 0, state: "pending", applied: false
    }));
    /* جمل جديدة للمقدم في هذي الجولة (js/ai.js)، ولو تأخرت أو فشلت يرجع للجمل الثابتة.
       وبنفس اللحظة: سجل الأسئلة اللي انسألت، وأسئلة جديدة من الذكاء الاصطناعي على قد المواجهات */
    roomToast("جاري تجهيز أسئلة جديدة للجولة...", "hourglass");
    await Promise.all([bcLoadQHistory(), bcLoadHard()]);
    /* الذكاء الاصطناعي يولّد بس اللي ناقص بعد الأسئلة الصعبة اللي ما انسألت */
    const asked = new Set(bcQHist.map(bcQKey));
    const need = Math.max(0, order.length * LIVE_Q_COUNT - BC_HARD.filter(q => !asked.has(bcQKey(q.text))).length);
    const [aiLines, fresh] = await Promise.all([
        typeof aiHostLines === "function" ? aiHostLines(r, order) : null,
        need ? bcFreshQuestions(need).catch(() => []) : []
    ]);
    bcFreshPool = fresh;
    /* أسئلة كل مواجهة تتجهز الحين وأجوبتها تنختم في السيرفر (الوثيقة العامة فيها السؤال والختم بس) */
    const secret = await bcSealRound(id, order);
    const data = Object.assign(bcQuizReset(), {
        aiLines: aiLines || null,
        type: "round", trial: leagueTrial ? 1 : 0, round: r, status: choice.at ? "scheduled" : "live", scene: choice.at ? "waiting" : "opening", cur: -1, order: order,
        startAt: choice.at || bcNow(),
        hostUid: currentUser.uid, hostName: myName, hostAv: myAv,
        questions: [], usedQ: [], sceneAt: bcNow(), hostSeen: bcNow(), v: 1,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    try {
        const wrote = await firebaseDB.runTransaction(async tx => {
            const snap = await tx.get(liveRef(id));
            if (snap.exists && isLiveActive(snap.data())) return false;
            tx.set(liveRef(id), data);
            if (secret && secret.boxes) tx.set(liveBoxesRef(id), { boxes: secret.boxes, at: bcNow() });
            return true;
        });
        if (secret && wrote) bcSaveSecret(id, secret);
        openLiveScreen(id);
        if (!secret) roomToast("تنبيه: الأجوبة ما انختمت (السيرفر ما رد)، فالبث شغال بالطريقة القديمة والأجوبة في الوثيقة", "alert");
    } catch (err) {
        console.log(err);
        alert("تعذّر بدء البث: " + (err.code === "permission-denied" ? "صلاحيات قاعدة البيانات ما تسمح بالكتابة على room/main/liveMatches" : err.message));
    }
}

/* تنفيذ تعديل على البث داخل Transaction (عشان أسرع ضغطة جرس هي اللي تفوز فعلاً) */
function liveTx(id, fn) {
    const ref = liveRef(id);
    return firebaseDB.runTransaction(async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists) return null;
        const d = snap.data();
        const upd = fn(d, bcNow());
        if (upd) {
            upd.v = (d.v || 0) + 1;
            upd.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            tx.update(ref, upd);
        }
        return upd;
    });
}

/* ===== الأجوبة المختومة (functions/answer.js، SECURITY-PLAN الخطوة 1) =====
   عند بداية البث: لكل مواجهة 5 أسئلة (بدون ذهبية: التعادل ينتهي تعادل)، وأجوبتها تنختم في السيرفر. الوثيقة العامة فيها { text, seal } بس،
   والأجوبة الأصلية في liveSecrets/<id> (المنظم بس يقراها: للمذيع يجهّز جملة الجواب مسبقاً).
   التصحيح في السيرفر (bcServerGrade). وقت الكشف جهاز المنظم يكتب الجواب في الوثيقة (shown.<مواجهة>_<سؤال>)، فالكل يشوفه.
   السيرفر ما يكشف الجواب لغير المنظم، لأن مراحل البث في الوثيقة المفتوحة ممكن أي أحد يغيّرها (تدقيق 21 أكتوبر).
   لو الختم ما اشتغل: البث يكمل بالطريقة القديمة (الجواب في الوثيقة والتصحيح في الجهاز). */
const bcSecrets = {};     /* id ← { qs: { text: answer } } (المنظم) */
const bcRevealed = {};    /* id ← { text: answer } (اللي انكشف) */
function bcSealed(q) { return !!(q && q.seal && !q.answer); }
function answerPost(body, timeoutMs) {
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), timeoutMs || 10000) : null;
    return authHeaders().then(h => fetch("/answer", {
        method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, h),
        body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined
    })).then(r => r.json().catch(() => ({})).then(d => { if (!r.ok) { const e = new Error(d.error || ("answer " + r.status)); e.status = r.status; throw e; } return d; }))
      .finally(() => { if (t) clearTimeout(t); });
}
async function bcSealRound(id, order) {
    try {
        let used = [];
        const plan = order.map(() => {
            const qs = pickLiveQuestions(used); used = used.concat(qs.map(q => q.text));
            const gold = [];   /* السؤال الذهبي انشال: التعادل ينتهي تعادل */
            return { qs, gold };
        });
        const items = [].concat(...plan.map(p => p.qs.concat(p.gold)));
        bcSaveQHistory(items.map(q => q.text));
        const res = await answerPost({ action: "seal", id, items }, 12000);
        const out = res.items || [];
        if (out.length !== items.length) throw new Error("seal count");
        const answers = {}, boxes = [];
        let k = 0;
        const mplan = plan.map(p => {
            const take = list => list.map(q => { const x = out[k++]; answers[x.text] = q.answer; return { text: x.text, seal: x.seal }; });
            return { qs: take(p.qs), gold: take(p.gold) };
        });
        /* نص أسئلة كل مواجهة نفسه مختوم (box): ما ينفتح إلا لما يجي دور المواجهة (bcOpenNext)، عشان محد يقرا أسئلته من بداية البث */
        const bx = await answerPost({ action: "seal", id, boxes: mplan.map(m => JSON.stringify(m)) }, 12000);
        if (!bx.boxes || bx.boxes.length !== order.length) throw new Error("box count");
        /* الصناديق في liveBoxes/<id> (تنكتب مع وثيقة البث بنفس الـ transaction)، والوثيقة فيها علامة بس */
        order.forEach(o => { o.boxed = true; });
        return { answers, plan: mplan, boxes: bx.boxes };
    } catch (e) {
        console.log("seal:", e && e.message);
        order.forEach(o => { delete o.box; delete o.boxed; });
        return null;
    }
}
function bcSaveSecret(id, secret) {
    bcSecrets[id] = secret.answers;
    bcPlans[id] = secret.plan;
    firebaseDB.collection("liveSecrets").doc(id).set({ answers: secret.answers, plan: JSON.stringify(secret.plan), at: bcNow() }).catch(err => console.log("liveSecrets:", err && err.code));
}
/* ===== فتح أسئلة المواجهة الجاية قبل الانتقال لها =====
   المنظم: من liveSecrets عنده. جهاز ثاني (الطيار الآلي والمنظم غايب): من السيرفر (open)، والسيرفر يتأكد إن المنظم غايب وإنها فعلاً الجاية */
const bcPlans = {};       /* id ← [{ qs, gold }] (المنظم) */
const bcOpened = {};      /* id ← { رقم المواجهة: { qs, gold } } */
function bcNextIndex(x) {
    const order = x.order || [];
    let n = order.findIndex((o, i) => o.state === "pending" && i > x.cur);
    if (n === -1) n = order.findIndex((o, i) => o.state === "pending" && i !== x.cur);
    return n;
}
function bcBoxed(o) { return !!(o && (o.boxed || o.box)); }   /* box: وثائق قبل 21 أكتوبر */
function bcOpenedFor(id, x, i) {
    const o = (x.order || [])[i] || {};
    if (!bcBoxed(o)) return null;
    return (bcOpened[id] || {})[i] || ((bcPlans[id] || [])[i]) || null;
}
async function bcOpenNext(id, skip) {
    const x = liveMatchesCache[id];
    if (!x) return;
    const tmp = Object.assign({}, x, { order: (x.order || []).map((o, i) => i === x.cur && skip && o.state === "pending" ? Object.assign({}, o, { state: "skipped" }) : o) });
    const n = bcNextIndex(tmp);
    if (n === -1 || !bcBoxed(tmp.order[n]) || bcOpenedFor(id, x, n)) return;
    if (isAdmin) { await bcLoadSecret(id, true); if (bcOpenedFor(id, x, n)) return; }
    try {
        const r = await answerPost({ action: "open", id, m: n }, 8000);
        if (r && Array.isArray(r.qs)) (bcOpened[id] || (bcOpened[id] = {}))[n] = { qs: r.qs, gold: r.gold || [] };
    } catch (e) { console.log("open:", e && e.message); }
}
/* المنظم يجيب الأجوبة الأصلية (لو فتح البث من جهاز ثاني أو بعد تحديث الصفحة) */
let bcSecretTry = {};
function bcLoadSecret(id, force) {
    if (!isAdmin || (bcSecrets[id] && bcPlans[id])) return Promise.resolve();
    if (bcSecretTry[id] && !force) return bcSecretTry[id];
    bcSecretTry[id] = firebaseDB.collection("liveSecrets").doc(id).get().then(s => {
        if (!s.exists) { delete bcSecretTry[id]; return; }   /* لسا ما انكتبت: نجرب مرة ثانية بعدين */
        const v = s.data() || {};
        bcSecrets[id] = v.answers || {};
        try { bcPlans[id] = JSON.parse(v.plan || "[]"); } catch (e) { bcPlans[id] = []; }
        liveLastSig = ""; renderLiveScreen();
    }).catch(() => { delete bcSecretTry[id]; });
    return bcSecretTry[id];
}
/* جواب السؤال i: من الوثيقة (الطريقة القديمة)، أو اللي انكشف، أو أجوبة المنظم */
function bcAnswerOf(d, i) {
    const q = (d && d.questions || [])[i];
    if (!q) return "";
    if (q.answer) return String(q.answer);
    const id = openLiveId;
    const shown = (d.shown || {})[d.cur + "_" + i];
    return shown || (bcRevealed[id] && bcRevealed[id][q.text]) || (bcSecrets[id] && bcSecrets[id][q.text]) || "";
}
/* المنظم وقت الكشف: يكتب الجواب (أول صيغة) في الوثيقة. لو غاب المنظم، الجواب ما يطلع (البث يكمل عادي) */
const bcShownSent = {};
function bcPublishShown(d) {
    const q = (d.questions || [])[d.qIndex];
    const k = openLiveId + "|" + d.cur + "_" + d.qIndex;
    if (!isAdmin || !q || !bcSealed(q) || bcShownSent[k] || ((d.shown || {})[d.cur + "_" + d.qIndex])) return;
    const a = (bcSecrets[openLiveId] || {})[q.text];
    if (!a) { bcRevealFetch(openLiveId); return; }
    bcShownSent[k] = 1;
    liveRef(openLiveId).update({ ["shown." + d.cur + "_" + d.qIndex]: String(a).split("|")[0] }).catch(() => { delete bcShownSent[k]; });
}
/* بعد الكشف: نجيب الجواب من السيرفر (السيرفر يتأكد من الوثيقة إن وقته جا) */
const bcRevealBusy = {};
function bcRevealFetch(id) {
    const d = liveMatchesCache[id];
    const q = d && (d.questions || [])[d.qIndex];
    if (!isAdmin || !q || !bcSealed(q) || bcAnswerOf(d, d.qIndex)) return Promise.resolve();   /* للمنظم بس (السيرفر يرفض غيره) */
    const k = id + "|" + d.cur + "|" + d.qIndex;
    if (!bcRevealBusy[k]) {
        bcRevealBusy[k] = answerPost({ action: "reveal", id }, 8000).then(res => {
            const qs = (liveMatchesCache[id] || d).questions || [];
            const m = bcRevealed[id] || (bcRevealed[id] = {});
            Object.keys(res.answers || {}).forEach(i => { if (qs[i]) m[qs[i].text] = res.answers[i]; });
            if (openLiveId === id) { liveLastSig = ""; renderLiveScreen(); }
        }).catch(() => { setTimeout(() => { delete bcRevealBusy[k]; }, 1500); });
    }
    return bcRevealBusy[k];
}
function liveQuestionUpd(i, now) {
    return { scene: "playing", qIndex: i, phase: "buzz", buzzer: 0, answerer: 0, tried1: false, tried2: false, passed: false, lastAnswer: null, outcome: 0, qAt: now, deadline: now + LIVE_BUZZ_MS };
}
function liveRevealUpd(d, winner, now, last) {
    const log = (d.log || Array(LIVE_Q_COUNT).fill(-1)).slice();
    log[d.qIndex] = winner;
    const u = { phase: "reveal", outcome: winner, log: log, deadline: now + LIVE_REVEAL_MS, pend: null };
    if (last !== undefined) u.lastAnswer = last;
    if (winner === 1) u.s1 = (d.s1 || 0) + 1;
    if (winner === 2) u.s2 = (d.s2 || 0) + 1;
    /* أكبر تأخر لكل متسابق (عشان نعرف العودة) */
    const s1 = u.s1 != null ? u.s1 : (d.s1 || 0), s2 = u.s2 != null ? u.s2 : (d.s2 || 0);
    u.bh1 = Math.max(d.bh1 || 0, s2 - s1);
    u.bh2 = Math.max(d.bh2 || 0, s1 - s2);
    return u;
}
/* الجواب ينتقل للمتسابق الثاني، وإذا الثاني جرّب قبل ينتهي السؤال وتظهر الإجابة */
function livePassUpd(d, n, now, last) {
    const o = n === 1 ? 2 : 1;
    if (!d["tried" + o]) {
        const u = { phase: "answer", answerer: o, passed: true, lastAnswer: last, deadline: now + LIVE_ANSWER_MS, ansAt: now, pend: null };
        u["tried" + o] = true;
        return u;
    }
    return liveRevealUpd(d, 0, now, last);
}
function liveNextStep(d, now) {
    if (d.status !== "live") return null;
    if (d.scene === "countdown" && now >= d.deadline) return liveQuestionUpd(0, now);
    if (d.scene !== "playing" || now < d.deadline) return null;
    if (d.phase === "buzz") return liveRevealUpd(d, 0, now, null);
    /* 23 أكتوبر 2026 (قرار محمد): الجواب بالمايك والمقدم يحكم (bcHostVerdict) خلال 7 ث، ولو ما حكم انتهى وقته وينتقل للثاني.
       والسؤال الجاي يبدأ بضغطة المقدم (bcHostNextQ) */
    if (d.phase === "answer" && d.answerer) return livePassUpd(d, d.answerer, now, { by: d.answerer, text: "", correct: false, timeout: true });
    return null;
}
/* بعد الكشف: السؤال الجاي، أو نهاية المواجهة بعد آخر سؤال (بضغطة المقدم) */
function liveRevealNext(d, now) {
    if (d.status !== "live" || d.scene !== "playing" || d.phase !== "reveal") return null;
    const next = (d.qIndex || 0) + 1;
    const qs = d.questions || [];
    if (next < qs.length) return liveQuestionUpd(next, now);
    /* صافرة النهاية (والتعادل ينتهي تعادل، الدوري يحسبه نقطة لكل واحد: السؤال الذهبي انشال 22 أكتوبر 2026): نحفظ نتيجة المواجهة داخل البث وننتقل لمشهد النتيجة */
    const order = (d.order || []).map(o => Object.assign({}, o));
    if (order[d.cur]) Object.assign(order[d.cur], { s1: d.s1 || 0, s2: d.s2 || 0, state: "done", applied: false, fb1: d.fb1 || 0, fb2: d.fb2 || 0, bh1: d.bh1 || 0, bh2: d.bh2 || 0 });
    return { scene: "result", phase: "done", order: order, deadline: 0, sceneAt: now };
}

/* سائق واحد للانتقالات بالوقت: كانت كل الجوالات تسوي transaction على نفس الوثيقة بنفس اللحظة،
   فتتعارض وتعيد (Firestore يعيد المحاولة بتأخير)، والانتقال يتأخر ويوصل للجوالات بأوقات مختلفة.
   الحين: المنظم أول (فوراً)، والمتسابقين احتياط بعده، والمشاهدين آخر شي. ولو المنظم غايب: المتسابقين أول. */
function bcAdvanceLag(d) {
    const gone = bcHostGone(d);
    if (!gone && amBcHost(d)) return 0;
    if (myLiveNum(d)) return gone ? 250 : 1200;
    return gone ? 1200 : 2500;
}
function liveAdvanceIfDue() {
    const d = liveMatchesCache[openLiveId];
    if (!d || liveAdvanceBusy || d.status !== "live") return;
    /* بالوقت بس: العد التنازلي، ووقت الجرس، ووقت الجواب (والسؤال الجاي بيد المقدم) */
    if (!(d.scene === "countdown" || (d.scene === "playing" && (d.phase === "buzz" || d.phase === "answer"))) || !d.deadline) return;
    if (bcNow() < (d.deadline || 0) + bcAdvanceLag(d)) return;
    if (bcNow() - liveLastAdvanceTry < 900) return;
    liveLastAdvanceTry = bcNow();
    liveAdvanceBusy = true;
    liveTx(openLiveId, liveNextStep)
        .catch(err => console.log("advance:", err))
        .finally(() => { liveAdvanceBusy = false; });
}

/* ===== تحكم المنظم ===== */
function bcNext(skip) {
    const id = openLiveId;
    const d = liveMatchesCache[id];
    if (!d || !isAdmin) return;
    if (skip && !confirm(`تخطي مواجهة ${livePlayerName(d, 1)} ضد ${livePlayerName(d, 2)}؟\nما بتنسجل لها نتيجة وتقدرون تلعبونها بعدين.`)) return;
    bcOpenNext(id, skip).then(() => liveTx(id, (x, now) => bcNextUpd(x, now, skip))).catch(err => alert("تعذّر: " + err.message));
}

/* البث المجدول: يبدأ الافتتاح بضغطة المنظم بس (قبل الموعد أو بعده). العداد للعرض، وما يبدأ البث لحاله */
function bcGoLive() {
    const d = liveMatchesCache[openLiveId];
    if (!d || d.status !== "scheduled" || !isAdmin) return;
    if (bcNow() < (Number(d.startAt) || 0) && !confirm("تبدأ البث الحين قبل الموعد؟")) return;
    liveTx(openLiveId, (x, now) => x.status === "scheduled" ? { status: "live", scene: "opening", sceneAt: now, startedAt: now, hostUid: currentUser.uid, hostName: (currentUserDocData && currentUserDocData.name) || x.hostName } : null)
        .catch(err => roomToast("تعذّر بدء البث: " + err.message, "alert"));
}

/* نافذة اختيار وقت البث: الحين أو موعد محدد */
function bcAskStart(r, count, unlinked) {
    return new Promise(resolve => {
        const now = new Date();
        const def = new Date(now.getTime() + 30 * 60000);
        def.setMinutes(def.getMinutes() < 30 ? 30 : 60, 0, 0);
        const hh = String(def.getHours()).padStart(2, "0"), mm = String(def.getMinutes()).padStart(2, "0");
        const box = document.createElement("div");
        box.className = "bc-ask";
        box.innerHTML = `
<div class="bc-ask-card">
<div class="bc-ask-t">${ic("megaphone")} بث الجولة ${escapeHTML(String(r))}</div>
<div class="bc-ask-s">فيها ${count} مواجهات بتنلعب ورا بعض في بث واحد.</div>
${(() => { const have = (roomState.qbank || []).length, need = count * LIVE_Q_COUNT; return have < need ? `<div class="bc-ask-w">${ic("alert")} بنك الأسئلة فيه ${have} سؤال بس، والجولة تحتاج ${need}. البث بيكمّل من ${LIVE_FALLBACK_QUESTIONS.length} سؤال احتياطي وبتتكرر الأسئلة. الأفضل تضيف أسئلة من الغرفة الصوتية (بنك الأسئلة) قبل البث.</div>` : ""; })()}
${unlinked.length ? `<div class="bc-ask-x">
<div class="t">${ic("alert")} ${unlinked.length} متسابق مو مربوط بحساب</div>
<div class="s">ما ينفتح له مايك (محد يسمعه)، وما يقدر يضغط "جاهز" ولا الجرس. اربطه قبل البث: المتسابق يسجّل في الموقع، وبعدها تضغط "ربط" وتختار حسابه.</div>
<div class="names">${unlinked.map(n => `<button class="bc-link" data-a="link" data-n="${escapeHTML(n)}">${ic("user")} ${escapeHTML(n)} · ربط</button>`).join("")}</div>
</div>` : ""}
<button class="bc-go" data-a="now">${ic("zap")} ابدأ البث الحين</button>
<div class="bc-ask-or">أو حدد موعد، ويطلع للكل عداد لين يبدأ:</div>
<div class="bc-ask-row"><input type="time" id="bcAskTime" value="${hh}:${mm}"><button class="bc-ghost" data-a="at">${ic("hourglass")} جدولة البث</button></div>
<button class="lv-link" data-a="no">إلغاء</button>
</div>`;
        const done = v => { box.remove(); resolve(v); };
        box.addEventListener("click", e => {
            const b = e.target.closest("[data-a]");
            if (!b) { if (e.target === box) done(null); return; }
            const a = b.dataset.a;
            if (a === "no") return done(null);
            if (a === "link") { done(null); openLinkPlayerModal(b.dataset.n); return; }
            if (a === "now") return done({ at: 0 });
            const v = (box.querySelector("#bcAskTime").value || "").split(":");
            if (v.length < 2) return;
            const at = new Date(); at.setHours(+v[0], +v[1], 0, 0);
            if (at.getTime() <= bcNow() + 30000) at.setDate(at.getDate() + 1);   /* وقت فات اليوم ← بكرة */
            done({ at: at.getTime() + bcClockOffset });   /* نحوّله لوقت السيرفر */
        });
        document.body.appendChild(box);
    });
}

/* الانتقال للمواجهة الجاية (أو الختام) — يقدر يسويه المنظم أو أي جهاز لو المنظم غايب */
function bcNextUpd(x, now, skip) {
    if (x.status !== "live") return null;
    const order = (x.order || []).map(o => Object.assign({}, o));
    if (skip && order[x.cur] && order[x.cur].state === "pending") order[x.cur].state = "skipped";
    let next = order.findIndex((o, i) => o.state === "pending" && i > x.cur);
    if (next === -1) next = order.findIndex((o, i) => o.state === "pending" && i !== x.cur);
    if (next === -1) return { scene: "closing", order: order, phase: "done", deadline: 0, sceneAt: now };
    const used = (x.usedQ || []).concat((x.questions || []).map(q => q.text)).slice(-300);
    /* المواجهة أسئلتها مختومة (box) وما انفتحت للحين على هالجهاز: ما ننتقل (bcOpenNext يفتحها قبل) */
    const opened = bcBoxed(order[next]) ? bcOpenedFor(openLiveId, x, next) : null;
    if (bcBoxed(order[next]) && !opened) return null;
    return Object.assign(bcQuizReset(), {
        scene: "intro", cur: next, order: order, sceneAt: now,
        usedQ: used, questions: opened ? opened.qs.slice() : pickLiveQuestions(used), gold: opened ? opened.gold.slice() : null
    });
}

/* ===== حضور المنظم =====
   جهاز المنظم يكتب "أنا موجود" كل 10 ثواني (hostSeen). يستخدمه الانتقال بالوقت داخل السؤال (bcAdvanceLag) ومزامنة المذيع.
   الطيار الآلي انشال (23 أكتوبر 2026، طلب محمد): ولا مشهد ينتقل لحاله (الافتتاح، صفحة المتسابقين، الترحيب، النتيجة، الختام)،
   ولا البث المجدول يبدأ لحاله لما يخلص العداد. كل انتقال بين الصفحات بضغطة من المنظم بس */
const BC_HOST_GONE_MS = 25000;
let bcLastBeat = 0;
function bcHostGone(d) { return !d.hostSeen || bcNow() - Number(d.hostSeen) > BC_HOST_GONE_MS; }
function bcHostHeartbeat(d) {
    if (!firebaseDB || !d || d.status !== "live" || !amBcHost(d) || bcNow() - bcLastBeat < 10000) return;
    bcLastBeat = bcNow();
    liveRef(openLiveId).update({ hostSeen: bcNow() }).catch(() => {});
}

/* ===== المقدم يحكم ويبدأ الأسئلة (23 أكتوبر 2026، قرار محمد: بدون جواب صوتي آلي ولا كتابة) =====
   المتسابق يضغط الجرس ويقول جوابه بالمايك، والمقدم يشوف الجواب الصحيح عنده ويضغط صح أو غلط.
   صح ← الكشف ونقطة له. غلط ← السؤال ينتقل للثاني (ولو جرّبه الاثنين ← الكشف). وبعد الكشف المقدم يبدأ السؤال الجاي */
function bcHostVerdict(ok) {
    const id = openLiveId, d0 = liveMatchesCache[id];
    if (!id || !d0 || !isAdmin || d0.phase !== "answer") return;
    document.querySelectorAll(".bc-verdict button").forEach(b => { b.disabled = true; });
    bcTap(document.querySelector(".bc-verdict"), "tapped", "", 25);
    liveTx(id, (x, now) => {
        if (x.status !== "live" || x.scene !== "playing" || x.phase !== "answer" || x.qIndex !== d0.qIndex || x.answerer !== d0.answerer) return null;
        const last = { by: x.answerer, text: "", correct: !!ok, judged: 1 };
        return ok ? liveRevealUpd(x, x.answerer, now, last) : livePassUpd(x, x.answerer, now, last);
    }).then(u => { if (!u) bcRedrawAll(); }).catch(err => { roomToast("تعذّر: " + err.message, "alert"); bcRedrawAll(); });
}
function bcHostNextQ() {
    const id = openLiveId, d0 = liveMatchesCache[id];
    if (!id || !d0 || !isAdmin || d0.phase !== "reveal") return;
    document.querySelectorAll(".bc-nextq").forEach(b => { b.disabled = true; });
    liveTx(id, (x, now) => (x.qIndex === d0.qIndex && x.cur === d0.cur) ? liveRevealNext(x, now) : null)
        .then(u => { if (!u) bcRedrawAll(); }).catch(err => { roomToast("تعذّر: " + err.message, "alert"); bcRedrawAll(); });
}

/* من صفحة المتسابقين ← فقرة الترحيب */
function bcToTalk() {
    if (!isAdmin) return;
    liveTx(openLiveId, (d, now) => (d.status === "live" && d.scene === "intro") ? { scene: "talk", sceneAt: now } : null)
        .catch(err => alert("تعذّر: " + err.message));
}
/* المنظم يضغط "ابدأ المواجهة" بعد الترحيب ← العد التنازلي ثم الأسئلة */
function bcForceStart() {
    if (!isAdmin) return;
    liveTx(openLiveId, (d, now) => (d.status === "live" && (d.scene === "intro" || d.scene === "talk")) ? { scene: "countdown", deadline: now + LIVE_COUNT_MS } : null)
        .catch(err => alert("تعذّر: " + err.message));
}

function bcEnd() {
    const d = liveMatchesCache[openLiveId];
    if (!d || !isAdmin) return;
    const left = (d.order || []).filter(o => o.state === "pending").length;
    const q = d.status === "scheduled" ? "إلغاء البث المجدول؟"
        : (left && d.scene !== "closing" ? `إنهاء بث الجولة؟ باقي ${left} مواجهات ما تلعبت، وتقدر تبدأ لها بث ثاني بعدين.` : "إنهاء بث الجولة؟");
    if (!confirm(q)) return;
    liveTx(openLiveId, (x, now) => isLiveActive(x) ? { status: "ended", phase: "done", endedAt: now } : null)
        .catch(err => alert("تعذّر: " + err.message));
}

/* إعادة تشغيل حركة CSS بدون قراءة offsetWidth: القراءة تجبر المتصفح يرتّب الصفحة كاملة على طول
   (قسناها ~100ms على معالج أبطأ 6 مرات، وكانت داخل ضغطة الجرس). لو الكلاس مو موجود يتضاف فوراً،
   ولو موجود يتشال ويرجع بعد إطارين */
function bcRestartAnim(el, cls, after, transition) {
    if (!el) return;
    /* transition (مو keyframes): لازم إطار والكلاس مشال عشان الانتقال يشتغل، حتى لو العنصر جديد */
    if (!transition && !el.classList.contains(cls)) { el.classList.add(cls); return; }
    el.classList.remove(cls);
    requestAnimationFrame(() => requestAnimationFrame(() => { if (!after || after()) el.classList.add(cls); }));
}

/* ===== الإحساس الفوري: كل ضغطة لها رد محلي (صوت واهتزاز وحركة) قبل ما يرد السيرفر ===== */
function bcTap(el, cls, sound, vib) {
    try { if (vib && navigator.vibrate) navigator.vibrate(vib); } catch (e) {}
    if (sound) cinePlay(sound, 0.6);
    bcRestartAnim(el, cls);
}

/* ===== التشخيص: آخر 5 قياسات لكل نوع (الجرس، الجواب الصوتي) في liveDiag/<id> → bcDiag.<uid>.<نوع> =====
   برا وثيقة البث: كتابته وقت الجرس والجواب كانت ترسل الوثيقة كاملة لكل الجوالات في أحرج لحظة */
const bcDiagMine = {};   /* id|نوع ← آخر 5 (الجهاز يعرف قياساته، فما يحتاج يقرا) */
function bcDiagWrite(id, field, list) {
    if (!firebaseDB || !currentUser || !id) return;
    liveDiagRef(id).set({ [field]: { [currentUser.uid]: list }, at: bcNow() }, { merge: true }).catch(() => {});
}
function bcDiagPush(kind, entry) {
    try {
        if (!openLiveId || !currentUser) return;
        /* المتسابقين والمنظم بس: المشاهدين ما يظهرون في اللوحة، وكتاباتهم تثقّل الوثيقة على الفاضي */
        if (!(isAdmin || myLiveNum(liveMatchesCache[openLiveId]))) return;
        const k = openLiveId + "|" + kind;
        const list = (bcDiagMine[k] || []).filter(x => x && x.at !== entry.at).concat([entry]).slice(-5);
        bcDiagMine[k] = list;
        const all = {};
        for (const kk in bcDiagMine) if (kk.indexOf(openLiveId + "|") === 0 && kk.slice(openLiveId.length + 1) !== "va") all[kk.slice(openLiveId.length + 1)] = bcDiagMine[kk];
        bcDiagWrite(openLiveId, "bcDiag", all);
    } catch (e) {}
}

/* زمن الجرس: الضغط ← الرد المحلي (أول رسمة) ← تأكيد السيرفر (transaction) ← وصول الحالة للجهاز (snapshot) */
const BC_BUZZ = { cur: null };
function bcBuzzDone(bz) {
    if (!bz || bz.sent) return;
    bz.sent = true;
    bcDiagPush("buzz", { at: bz.at, q: bz.q, local: bz.local, tx: bz.tx, seen: bz.seen, won: bz.won, ua: (navigator.userAgent || "").slice(0, 60) });
}
/* تنادى من رسم الشاشة: أول ما تجي الحالة الجديدة من السيرفر نحسب وقت الوصول */
function bcBuzzSeen(d) {
    const bz = BC_BUZZ.cur;
    if (!bz || bz.sent || !d || bz.id !== openLiveId) return;
    if (d.cur + "_" + d.qIndex !== bz.q) { bcBuzzDone(bz); return; }
    if (d.phase === "buzz") return;
    if (!bz.seen) bz.seen = Math.round(performance.now() - bz.t0);
    if (bz.won === null) bz.won = d.buzzer === myLiveNum(d);
    if (bz.tx) bcBuzzDone(bz);
}

function liveSetReady() {
    const id = openLiveId;
    if (!id) return;
    /* رد فوري: الزر يتغير ويطلع صوت واهتزاز، ولو السيرفر رفض يرجع */
    const btn = document.querySelector(".lv-ready-btn");
    if (btn) {
        if (btn.disabled) return;
        btn.disabled = true;
        btn.innerHTML = ic("check-circle") + " جاهز!";
        bcTap(btn, "tapped", "tick", 25);
    }
    liveTx(id, (d, now) => {
        if (d.status !== "live" || d.scene !== "intro") return null;
        const n = myLiveNum(d);
        if (!n) return null;
        const u = {};
        u["ready" + n] = true;
        const r1 = n === 1 || d.ready1, r2 = n === 2 || d.ready2;
        if (r1 && r2) { u.scene = "talk"; u.sceneAt = now; }   /* فقرة الترحيب: المنظم يسولف مع المتسابقين، وبعدها يبدأ المواجهة */
        return u;
    }).catch(err => {
        if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = ic("check-circle") + " جاهز"; }
        roomToast("تعذّر: " + err.message, "alert");
    });
}

function liveBuzz(ev) {
    const t0 = ev && ev.timeStamp > 0 ? ev.timeStamp : performance.now();
    const id = openLiveId;
    const d = liveMatchesCache[id];
    if (!d || d.scene !== "playing" || d.phase !== "buzz" || !myLiveNum(d)) return;
    const bell = document.getElementById("lvBell");
    if (bell && bell.classList.contains("rung")) return;   /* ضغطة وحدة تكفي */
    /* استجابة فورية قبل ما يرد السيرفر: صوت الجرس، اهتزاز، والجرس يتغير. الحكم مين ضغط أول يظل في الـ transaction تحت.
       بعدها المتسابق يقول جوابه بالمايك والمقدم يحكم (bcHostVerdict) */
    if (bell) { bell.classList.add("rung"); const sp = bell.querySelector("span"); if (sp) sp.textContent = "ضغطت!"; }
    /* السؤال يختفي عندي على طول (وعند الكل أول ما يوصل الجرس للسيرفر) */
    { const qt = document.querySelector("#liveScreenBody .lv-qtext.tv-words"); if (qt) qt.style.visibility = "hidden"; }
    bcLocalBuzzQ = id + "|" + d.cur + "|" + d.qIndex;
    const bz = BC_BUZZ.cur = { id, q: d.cur + "_" + d.qIndex, t0, at: bcNow(), local: 0, tx: 0, seen: 0, won: null, sent: false };
    /* طلب الجرس يطلع للسيرفر أول شي (مين أسرع يتحدد هناك)، وبعده الصوت والاهتزاز */
    const txP = liveTx(id, (x, now) => {
        if (x.status !== "live" || x.scene !== "playing" || x.phase !== "buzz" || now > x.deadline + 1500) return null;
        const n = myLiveNum(x);
        if (!n) return null;
        const u = { phase: "answer", buzzer: n, answerer: n, passed: false, deadline: now + LIVE_ANSWER_MS, ansAt: now };
        u["tried" + n] = true;
        /* سرعة ضغطة الجرس (لإحصائيات المواجهة وأفضل لحظة في الجولة) */
        const ms = Math.max(150, now - (x.qAt || (x.deadline - LIVE_BUZZ_MS)));
        if (!x["fb" + n] || ms < x["fb" + n]) u["fb" + n] = ms;
        return u;
    });
    cinePlay("buzz", 0.6);
    try { if (navigator.vibrate) navigator.vibrate(35); } catch (e) {}
    requestAnimationFrame(() => { bz.local = Math.round(performance.now() - t0); });
    setTimeout(() => bcBuzzDone(bz), 6000);   /* لو ما وصل شي، نسجّل اللي عندنا */
    if (typeof bcStopSpeech === "function") bcStopSpeech();
    txP.then(u => {
        bz.tx = Math.round(performance.now() - t0);
        if (!u) {
            bz.won = false; bcBuzzDone(bz);
            bcRedrawAll();   /* الجرس "ضغطت!" يرجع (الرسم الجزئي ما يلمس الجزء اللي انعدّل مباشرة) */
        } else if (bz.seen) bcBuzzDone(bz);
    }).catch(err => {
        console.log("buzz:", err);
        bz.tx = -1; bz.won = false; bcBuzzDone(bz);
        bcRedrawAll();
    });
}


/* تسجيل نتائج مواجهات البث في جدول الدوري تلقائياً */
function bcApplyResults(id) {
    const d = liveMatchesCache[id];
    if (!d || !firebaseDB || !currentUser) return;
    /* نتيجة بث التجربة ما تنكتب إلا في جدول التجربة، ونتيجة البث الحقيقي ما تنكتب في جدول التجربة */
    if (!!d.trial !== !!leagueTrial) return;
    (d.order || []).forEach((o, i) => {
        if (o.state !== "done" || o.applied) return;
        if (!isAdmin && o.uid1 !== currentUser.uid && o.uid2 !== currentUser.uid) return;
        const key = id + "#" + i;
        if (liveApplyTried[key] && bcNow() - liveApplyTried[key] < 15000) return;
        liveApplyTried[key] = bcNow();
        const leagueRef = firebaseDB.collection("league").doc("current");
        firebaseDB.runTransaction(async tx => {
            const s = await tx.get(leagueRef);
            const ls = await tx.get(liveRef(id));
            if (!s.exists || !ls.exists) return;
            const order = (ls.data().order || []).map(x => Object.assign({}, x));
            const it = order[i];
            if (!it || it.state !== "done" || it.applied) return;
            const arr = (s.data().matches || []).slice();
            const rr = it.round !== undefined ? it.round : d.round;
            const idx = arr.findIndex(x => x.round === rr && x.p1 === it.p1 && x.p2 === it.p2);
            if (idx !== -1 && (arr[idx].s1 === "" || arr[idx].s2 === "")) {
                arr[idx] = Object.assign({}, arr[idx], { s1: String(it.s1 || 0), s2: String(it.s2 || 0) });
                tx.update(leagueRef, { matches: arr, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            }
            it.applied = true;
            tx.update(liveRef(id), { order: order });
        }).catch(err => console.log("النتيجة بانتظار المسؤول:", err && err.code));
    });
}

/* ===== مطابقة الإجابة (تتجاهل الهمزات والتشكيل وال التعريف والمسافات) ===== */
function liveNormalize(s) {
    s = String(s || "").toLowerCase();
    s = s.replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x0660));
    s = s.replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x06F0));
    s = s.replace(/[ً-ْٰـ]/g, "");
    s = s.replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي");
    s = s.replace(/[^؀-ۿa-z0-9\s]/g, " ");
    s = s.split(/\s+/).filter(Boolean).map(w => (w.length > 3 && w.indexOf("ال") === 0) ? w.slice(2) : w).join(" ");
    return s.trim();
}
function liveLev(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = cur;
    }
    return prev[n];
}
function liveAnswerMatches(given, answer) {
    const g = liveNormalize(given);
    if (!g) return false;
    const gNoSpace = g.replace(/\s/g, "");
    return String(answer || "").split("|").some(alt => {
        const a = liveNormalize(alt);
        if (!a) return false;
        const aNoSpace = a.replace(/\s/g, "");
        if (g === a || gNoSpace === aNoSpace) return true;
        if (/^\d+$/.test(aNoSpace)) return (gNoSpace.match(/\d+/g) || []).indexOf(aNoSpace) !== -1;
        if (aNoSpace.length >= 4) {
            const dist = liveLev(gNoSpace, aNoSpace);
            if (dist <= Math.max(1, Math.floor(aNoSpace.length * 0.2))) return true;
            if (gNoSpace.length >= 4 && (gNoSpace.indexOf(aNoSpace) !== -1)) return true;
        }
        return false;
    });
}

/* ===== المؤثرات الصوتية (تنعزف على كل جهاز بنفس اللحظة) ===== */
let liveAudioCtx = null;
function liveCtx() {
    if (!liveAudioCtx) liveAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return liveAudioCtx;
}
