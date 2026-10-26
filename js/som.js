/* لعبة السوم في الغرفة الصوتية (فكرة محمد، 26 أكتوبر 2026):
   كل لاعب معه 10,000 وبيده 4 أوراق (8 أنواع × 4 = 32 ورقة). يسومون بالدور (كل سوم أعلى من اللي قبله، يلف لين محد يعلّي)،
   وصاحب أعلى سوم يعرض على كل واحد مبلغ عشان ينسحب. اللي يقبل ياخذ العرض، واللي يرفض يداقش: تنكشف الأوراق والأقوى
   ياخذ سومه مضاعف وسوم كل اللي خسروا. لو كلهم قبلوا، صاحب السوم ياخذ نص سومه من البنك.
   حدّين عشان محد يقفل الجولة: السوم الواحد ما يزيد عن أعلى سوم بأكثر من 5,000، ولو انسحبوا كلهم قبل المفاوضة
   (ما أحد دخل معه) الجولة تخلص بدون فلوس.
   - الحالة في room/main/games/som (كل تغيير بـ transaction عبر somReduce، دالة صافية تنختبر في tests/functions/som-rules.test.mjs)
   - الأوراق من السيرفر (functions/som.js): المنظم يوزع (deal) والختم ينكتب في الوثيقة، وكل لاعب يطلب أوراقه بس (hand)،
     والكشف وقت المداقشة بس (reveal للمنظم).
   - ما فيه وقت ولا شي ينتقل لحاله (طلب محمد 26 أكتوبر): الكشف والجولة الجاية بزر المنظم، ولو أحد علّق المنظم يتخطاه (skip). */

const SOM = { START: 10000, MIN: 100, STEP: 100, JUMP: 5000, MIN_P: 2, MAX_P: 8, ROUNDS: 10 };
/* من الأضعف للأقوى: الرقم = floor(الورقة / 4) */
const SOM_RANKS = [{ n: "7" }, { n: "8" }, { n: "9" }, { n: "10" },
    { n: "درع", sym: "shield" }, { n: "هلال", sym: "moon" }, { n: "نجمة", sym: "star" }, { n: "تاج", sym: "crown" }];
const SOM_SYM = {
    crown: '<path d="M3 17.5 2 7l5.2 4.3L12 4l4.8 7.3L22 7l-1 10.5z"/><rect x="3" y="19" width="18" height="2.4" rx="1"/>',
    star: '<path d="m12 2.2 2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17.1l-6.1 3.5 1.5-6.8-5.2-4.6 6.9-.7z"/>',
    moon: '<path d="M14.6 2.5a9.6 9.6 0 1 0 6.9 15.4A8 8 0 0 1 14.6 2.5z"/>',
    shield: '<path d="M12 2 4 5v6.2c0 5 3.4 9.2 8 10.8 4.6-1.6 8-5.8 8-10.8V5z"/>'
};
const SOM_COIN = '<svg class="som-coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6.2" class="in"/></svg>';
const SOM_CATS = ["أعلى ورقة", "زوج", "زوجين", "ثلاثية", "رباعية"];

/* ===== القوانين (بدون أي واجهة) ===== */
function somRank(c) { return Math.floor(c / 4); }
/* قوة اليد: العدد أول (رباعية > ثلاثية > زوجين > زوج > أعلى ورقة)، وبعده قوة الورقة */
function somEval(cards) {
    const cnt = {};
    cards.forEach(c => { const r = somRank(c); cnt[r] = (cnt[r] || 0) + 1; });
    const groups = Object.keys(cnt).map(r => ({ r: +r, n: cnt[r] })).sort((a, b) => b.n - a.n || b.r - a.r);
    const n0 = groups[0].n, n1 = groups[1] ? groups[1].n : 0;
    const cat = n0 === 4 ? 4 : n0 === 3 ? 3 : (n0 === 2 && n1 === 2) ? 2 : n0 === 2 ? 1 : 0;
    return { cat, key: [cat].concat(groups.map(g => g.r)), groups };
}
function somCmp(a, b) {
    for (let i = 0; i < Math.max(a.key.length, b.key.length); i++) {
        const d = (a.key[i] == null ? -1 : a.key[i]) - (b.key[i] == null ? -1 : b.key[i]);
        if (d) return d;
    }
    return 0;
}
function somHandName(ev) {
    const g = ev.groups, n = i => SOM_RANKS[g[i].r].n;
    if (ev.cat === 4) return "رباعية " + n(0);
    if (ev.cat === 3) return "ثلاثية " + n(0);
    if (ev.cat === 2) return "زوجين " + n(0) + " و " + n(1);
    if (ev.cat === 1) return "زوج " + n(0);
    return "أعلى ورقة " + n(0);
}
function somFmt(n) { return Math.round(Number(n) || 0).toLocaleString("en-US"); }
function somPlayer(s, uid) { return ((s && s.players) || []).find(p => p.uid === uid) || null; }
function somName(s, uid) { const p = somPlayer(s, uid); return p ? p.name : "لاعب"; }
function somInUids(s) { return (s.seats || []).filter(u => !(s.folded || {})[u]); }
function somOthers(s) { return somInUids(s).filter(u => u !== s.leader); }
function somEligible(s) { return (s.players || []).filter(p => p.bal >= SOM.MIN).map(p => p.uid); }
function somIsOver(s) { return s.round >= s.maxRounds || somEligible(s).length < SOM.MIN_P; }
/* كم يقدر صاحب أعلى سوم يعرض: فلوسه ناقص سومه (لو داقشوه وخسر، يخسر سومه بعد ما دفع العروض) */
function somOfferRoom(s) { const p = somPlayer(s, s.leader); return p ? Math.max(0, p.bal - ((s.bids || {})[s.leader] || 0)) : 0; }
function somLog(s, t) { s.log = (s.log || []).concat(t).slice(-8); }
function somNextUid(s, from) {
    const seats = s.seats || [], i = seats.indexOf(from);
    for (let k = 1; k <= seats.length; k++) { const u = seats[(i + k) % seats.length]; if (!s.folded[u]) return u; }
    return "";
}
function somNew(gid, uid, name, now) {
    return { active: true, gid, phase: "lobby", hostUid: uid, hostName: name, players: [], round: 0, maxRounds: SOM.ROUNDS,
        seats: [], deal: "", starter: "", turn: "", bids: {}, folded: {}, high: 0, leader: "", offers: {}, replies: {},
        show: [], shown: null, pay: null, res: null, log: [], v: 1, at: now };
}

/* بعد كل سوم أو تثبيت أو انسحاب: باقي واحد ← الجولة تخلص بدون فلوس، الدور رجع لصاحب أعلى سوم ← المفاوضة */
function somAfterBid(s, u, now) {
    const inU = somInUids(s);
    if (inU.length <= 1) {
        s.res = { kind: "none", winners: [], delta: {} };
        Object.assign(s, { phase: "result", turn: "" });
        somLog(s, inU[0] && s.bids[inU[0]] > 0 ? somName(s, inU[0]) + " بقى لحاله، ما أحد دخل معه" : "الكل انسحب");
        return { s };
    }
    const nx = somNextUid(s, u);
    if (s.leader && nx === s.leader) {
        Object.assign(s, { phase: "offer", turn: s.leader });
        somLog(s, somName(s, s.leader) + " صاحب أعلى سوم، يفاوض");
        return { s };
    }
    s.turn = nx;
    return { s };
}
function somOffer(s, offers, now) {
    const others = somOthers(s), o = {};
    let sum = 0;
    for (const u of others) {
        const v = Math.floor(Number(offers[u]) || 0);
        if (v < 0) return { err: "مبلغ العرض غلط" };
        o[u] = v; sum += v;
    }
    if (sum > somOfferRoom(s)) return { err: "العروض أكثر من اللي تقدر تدفعه (" + somFmt(somOfferRoom(s)) + ")" };
    Object.assign(s, { offers: o, replies: {}, phase: "respond", turn: "" });
    somLog(s, somName(s, s.leader) + " عرض: " + others.map(u => somName(s, u) + " " + somFmt(o[u])).join("، "));
    return { s };
}
function somAfterReply(s, now) {
    const others = somOthers(s);
    if (!others.every(u => s.replies[u])) return { s };
    const pay = {};
    others.forEach(u => {
        if (s.replies[u] !== "accept") return;
        pay[u] = (pay[u] || 0) + s.offers[u];
        pay[s.leader] = (pay[s.leader] || 0) - s.offers[u];
    });
    const ref = others.filter(u => s.replies[u] === "refuse");
    if (!ref.length) return somSettle(s, now, null, pay);
    Object.assign(s, { pay, show: (s.seats || []).filter(u => u === s.leader || ref.indexOf(u) !== -1), phase: "showdown" });
    somLog(s, "مداقشة: " + s.show.map(u => somName(s, u)).join(" ضد "));
    return { s };
}
/* الحساب: hands فاضي = كسب بدون مداقشة (نص السوم من البنك). غيره: الأقوى ياخذ سومه من البنك (يتضاعف) وسوم كل خاسر،
   والتعادل على الأقوى يتقاسمون سوم الخاسرين */
function somSettle(s, now, hands, pay) {
    const delta = Object.assign({}, pay || {});
    const add = (u, v) => { delta[u] = (delta[u] || 0) + v; };
    let winners, kind;
    if (!hands) {
        kind = "clear"; winners = [s.leader];
        add(s.leader, Math.floor((s.bids[s.leader] || 0) / 100) * 50);
    } else {
        kind = "showdown";
        const ev = {};
        s.show.forEach(u => { ev[u] = somEval(hands[u]); });
        let best = null;
        s.show.forEach(u => { if (!best || somCmp(ev[u], ev[best]) > 0) best = u; });
        winners = s.show.filter(u => somCmp(ev[u], ev[best]) === 0);
        const losers = s.show.filter(u => winners.indexOf(u) === -1);
        let pot = 0;
        losers.forEach(u => { add(u, -s.bids[u]); pot += s.bids[u]; });
        const share = Math.floor(pot / winners.length);
        winners.forEach((u, i) => add(u, s.bids[u] + share + (i === 0 ? pot - share * winners.length : 0)));
        s.shown = hands;
    }
    Object.keys(delta).forEach(u => { if (!delta[u]) delete delta[u]; });
    s.players.forEach(p => { if (delta[p.uid]) p.bal = Math.max(0, p.bal + delta[p.uid]); });
    s.res = { kind, winners, delta };
    Object.assign(s, { phase: "result", turn: "" });
    somLog(s, winners.map(u => somName(s, u)).join(" و ") + (kind === "clear" ? " كسب بدون مداقشة" : " كسب المداقشة"));
    return { s };
}

/* كل حركة في اللعبة: (الحالة، الحركة، {uid، now، host}) ← { s: الحالة الجديدة } أو { err } */
function somReduce(s0, a, ctx) {
    const now = ctx.now, me = ctx.uid, E = m => ({ err: m });
    if (!a || !a.t) return E("حركة غلط");
    if (a.t === "create") {
        if (!ctx.host) return E("المنظم بس يفتح الطاولة");
        if (s0 && s0.active && s0.phase !== "over") return E("فيه طاولة شغالة");
        return { s: somNew(String(a.gid), me, String(a.name || "المنظم").slice(0, 30), now) };
    }
    if (!s0 || !s0.active) return E("ما فيه طاولة");
    const s = JSON.parse(JSON.stringify(s0));
    ["bids", "folded", "offers", "replies"].forEach(k => { s[k] = s[k] || {}; });
    s.players = s.players || []; s.v = (s.v || 0) + 1; s.at = now;
    const host = () => ctx.host ? null : E("للمنظم بس");
    switch (a.t) {
        case "join": {
            if (s.phase !== "lobby") return E("اللعبة بدأت، انتظر الطاولة الجاية");
            if (somPlayer(s, me)) return E("أنت داخل الطاولة");
            if (s.players.length >= SOM.MAX_P) return E("الطاولة مليانة (" + SOM.MAX_P + " لاعبين)");
            s.players.push({ uid: me, name: String(a.name || "لاعب").slice(0, 30), av: String(a.av || "").slice(0, 500), bal: SOM.START });
            return { s };
        }
        case "leave": {
            if (s.phase !== "lobby") return E("اللعبة بدأت");
            const who = a.uid && ctx.host ? String(a.uid) : me;
            s.players = s.players.filter(p => p.uid !== who);
            return { s };
        }
        case "round": {
            if (host()) return host();
            if (s.phase !== "lobby" && s.phase !== "result") return E("مو وقت جولة جديدة");
            if (s.phase === "result" && somIsOver(s)) return E("اللعبة خلصت");
            const seats = somEligible(s);
            if (seats.length < SOM.MIN_P) return E("لازم لاعبين على الأقل");
            if (a.round !== s.round + 1 || JSON.stringify(a.seats) !== JSON.stringify(seats) || typeof a.deal !== "string") return E("الأوراق مو لهالجولة");
            s.round = a.round; s.seats = seats; s.deal = a.deal;
            s.starter = seats[(s.round - 1) % seats.length];
            Object.assign(s, { phase: "bid", turn: s.starter, bids: {}, folded: {}, high: 0, leader: "", offers: {}, replies: {},
                show: [], shown: null, pay: null, res: null });
            somLog(s, "الجولة " + s.round + ": " + somName(s, s.starter) + " يبدأ السوم");
            return { s };
        }
        case "bid": case "hold": case "fold": {
            if (s.phase !== "bid") return E("مو وقت السوم");
            if (s.turn !== me) return E("مو دورك");
            const p = somPlayer(s, me);
            if (a.t === "bid") {
                const amt = Math.floor(Number(a.amt));
                if (!(amt > s.high) || amt < SOM.MIN) return E(s.high ? "لازم تعلّي على " + somFmt(s.high) : "أقل سوم " + somFmt(SOM.MIN));
                if (amt > s.high + SOM.JUMP) return E("أكثر شي تعلّي " + somFmt(SOM.JUMP) + " مرة وحدة");
                if (amt > p.bal) return E("ما عندك هالمبلغ");
                s.bids[me] = amt; s.high = amt; s.leader = me;
                somLog(s, p.name + " سام " + somFmt(amt));
            } else if (a.t === "hold") {
                if (!(s.bids[me] > 0)) return E("لازم تسوم أول");
                somLog(s, p.name + " ثبّت على " + somFmt(s.bids[me]));
            } else {
                s.folded[me] = true; delete s.bids[me];
                somLog(s, p.name + " انسحب");
            }
            return somAfterBid(s, me, now);
        }
        case "offer": {
            if (s.phase !== "offer") return E("مو وقت العروض");
            if (s.leader !== me) return E("المفاوضة لصاحب أعلى سوم");
            return somOffer(s, a.offers || {}, now);
        }
        case "reply": {
            if (s.phase !== "respond") return E("مو وقت الرد");
            if (somOthers(s).indexOf(me) === -1) return E("ما فيه عرض لك");
            if (s.replies[me]) return E("رديت من قبل");
            s.replies[me] = a.v === "refuse" ? "refuse" : "accept";
            somLog(s, somName(s, me) + (s.replies[me] === "refuse" ? " رفض، بيداقش" : " قبل " + somFmt(s.offers[me]) + " وانسحب"));
            return somAfterReply(s, now);
        }
        case "reveal": {
            if (host()) return host();
            if (s.phase !== "showdown") return E("مو وقت الكشف");
            const hands = a.hands || {}, out = {};
            for (const u of s.show) {
                const h = hands[u];
                if (!Array.isArray(h) || h.length !== 4 || !h.every(c => Number.isInteger(c) && c >= 0 && c < 32)) return E("أوراق ناقصة");
                out[u] = h.slice();
            }
            return somSettle(s, now, out, s.pay || {});
        }
        case "skip": {
            /* المنظم يتخطى اللي معلّق: اللي عليه الدور يثبّت (أو ينسحب لو ما سام)، وصاحب السوم يعرض صفر، واللي ما ردوا قبول */
            if (host()) return host();
            if (s.phase === "bid") {
                const u = s.turn;
                if (s.bids[u] > 0) somLog(s, somName(s, u) + " تخطاه المنظم وثبّت");
                else { s.folded[u] = true; somLog(s, somName(s, u) + " تخطاه المنظم وانسحب"); }
                return somAfterBid(s, u, now);
            }
            if (s.phase === "offer") { somLog(s, somName(s, s.leader) + " تخطاه المنظم"); return somOffer(s, {}, now); }
            if (s.phase === "respond") {
                somOthers(s).forEach(u => { if (!s.replies[u]) { s.replies[u] = "accept"; somLog(s, somName(s, u) + " ما رد، انحسب قبول"); } });
                return somAfterReply(s, now);
            }
            return E("ما فيه أحد ينتظر");
        }
        case "end": {
            if (host()) return host();
            Object.assign(s, { phase: "over", turn: "" });
            somLog(s, "انتهت اللعبة");
            return { s };
        }
        case "close": {
            if (host()) return host();
            s.active = false;
            return { s };
        }
    }
    return E("حركة غلط");
}

/* ===== الاتصال: الوثيقة والسيرفر ===== */
let somState = null, somUnsub = null, somIsOpen = false, somRulesOpen = false;
let somHand = null;              /* { key: "gid:round", cards } */
let somHandBusy = false, somHandFailAt = 0, somHostBusy = false;
let somRetry = null, somDraft = { key: "", bid: 0, okey: "", offers: {} };
let somDealtKey = "";            /* حركة التوزيع تطلع مرة وحدة لكل جولة، مو مع كل تحديث */
let somLastHTML = "";            /* الشاشة ما تنرسم من جديد إلا لو تغيّر فيها شي (الشات ما يحرّكها) */
try { const h = JSON.parse(sessionStorage.getItem("somHand") || "null"); if (h && h.key && Array.isArray(h.cards)) somHand = h; } catch (e) {}

function somRef() { return firebaseDB.collection("room").doc("main").collection("games").doc("som"); }
function somNow() { return typeof bcNow === "function" ? bcNow() : Date.now(); }
function somMe() { return currentUser ? currentUser.uid : ""; }
function somMyName() {
    return (currentUserDocData && currentUserDocData.name) || (currentUser && (currentUser.displayName || String(currentUser.email || "").split("@")[0])) || "لاعب";
}
function somKey(s) { return s ? s.gid + ":" + s.round : ""; }
function somActiveGame() { return !!(somState && somState.active); }
function somInRound(s, uid) { return !!s && s.phase !== "lobby" && s.phase !== "over" && (s.seats || []).indexOf(uid) !== -1; }

async function somApi(body) {
    const r = await fetch("/som", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, await authHeaders()), body: JSON.stringify(body) });
    let j = {};
    try { j = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error(j.error || "som " + r.status);
    return j;
}

async function somDo(a, quiet) {
    if (!firebaseDB || !currentUser) { roomToast("سجّل دخولك أول", "lock"); return null; }
    const ref = somRef();
    try {
        const out = await firebaseDB.runTransaction(async tx => {
            const snap = await tx.get(ref);
            const r = somReduce(snap.exists ? snap.data() : null, a, { uid: currentUser.uid, now: somNow(), host: !!isAdmin });
            /* Firestore يرفض undefined، فالحالة تنكتب نظيفة */
            if (!r.err) tx.set(ref, JSON.parse(JSON.stringify(r.s)));
            return r;
        });
        if (out && out.err && !quiet) roomToast(out.err, "alert");
        return out;
    } catch (e) {
        if (!quiet) roomToast("ما وصل، جرّب مرة ثانية", "alert");
        return null;
    }
}

/* ===== الأصوات: تسجيلات حقيقية من audio/ (نفس مؤثرات البث)، تطلع عند كل واحد على جهازه ===== */
const SOM_SFX = { whoosh: 0.55, tick: 0.9, start_q: 0.7, riser: 0.5, reveal: 0.75, slam: 0.45, correct: 0.85, wrong: 0.7, applause: 0.55, match_end: 0.75 };
let somAC = null;
const somBuf = {}, somBufLoading = {};
function somAudio() {
    if (!somAC) { try { somAC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    return somAC;
}
function somLoadSfx() {
    const c = somAudio();
    if (!c) return;
    Object.keys(SOM_SFX).forEach(id => {
        if (somBuf[id] || somBufLoading[id]) return;
        somBufLoading[id] = fetch("audio/" + id + ".mp3")
            .then(r => { if (!r.ok) throw new Error("no file"); return r.arrayBuffer(); })
            .then(ab => new Promise((res, rej) => c.decodeAudioData(ab, res, rej)))
            .then(b => { somBuf[id] = b; })
            .catch(() => setTimeout(() => { delete somBufLoading[id]; }, 30000));
    });
}
/* المتصفح ما يشغّل صوت قبل أول لمسة، فأول لمسة في الصفحة تفتحه */
function somUnlockAudio() { const c = somAudio(); try { if (c && c.state === "suspended") c.resume(); } catch (e) {} }
if (typeof document !== "undefined") document.addEventListener("pointerdown", somUnlockAudio, { passive: true });
function somSfx(id, v, delay) {
    if (!somIsOpen && !roomScreenOpen) return;
    if (typeof speakerMuted !== "undefined" && speakerMuted) return;
    const c = somAC, b = somBuf[id];
    if (!c || !b) return;
    try {
        if (c.state === "suspended") c.resume();
        const src = c.createBufferSource(), g = c.createGain();
        src.buffer = b; g.gain.value = (v == null ? 1 : v) * SOM_SFX[id];
        src.connect(g); g.connect(c.destination);
        src.start(c.currentTime + (delay || 0));
    } catch (e) {}
}
/* وش تغيّر من آخر مرة ← الصوت المناسب */
function somSoundFor(prev, s) {
    const me = somMe();
    if (!prev || !prev.active || !s || !s.active || prev.gid !== s.gid) return;
    if (s.phase === "lobby") { if ((s.players || []).length > (prev.players || []).length) somSfx("tick", 0.6); return; }
    if (s.round !== prev.round && s.phase === "bid") { somSfx("whoosh"); somSfx("whoosh", 0.6, 0.18); }
    if (s.phase === "bid" && prev.phase === "bid" && s.round === prev.round) {
        if (s.high > prev.high) somSfx("tick");
        else if (Object.keys(s.folded || {}).length > Object.keys(prev.folded || {}).length) somSfx("whoosh", 0.5);
    }
    const myTurn = x => (x.phase === "bid" || x.phase === "offer") && x.turn === me;
    if (myTurn(s) && !(myTurn(prev) && prev.phase === s.phase && prev.round === s.round)) somSfx("start_q", 1, 0.25);
    if (s.phase === "respond" && prev.phase !== "respond" && somOthers(s).indexOf(me) !== -1) somSfx("start_q", 1, 0.1);
    if (s.phase === "respond" && prev.phase === "respond") {
        const n = x => Object.keys(x.replies || {}).length;
        if (n(s) > n(prev)) somSfx("tick", 0.7);
    }
    if (s.phase === "showdown" && prev.phase !== "showdown") somSfx("riser");
    if (s.phase === "result" && prev.phase !== "result") {
        const r = s.res || { winners: [], delta: {} }, d = r.delta[me] || 0;
        if (r.kind === "showdown") { somSfx("slam"); somSfx("reveal", 1, 0.1); }
        if (r.winners.indexOf(me) !== -1) { somSfx("correct", 1, 0.5); somSfx("applause", 0.8, 0.7); }
        else if (d < 0) somSfx("wrong", 1, 0.5);
        else if (r.kind !== "none") somSfx("applause", 0.5, 0.6);
    }
    if (s.phase === "over" && prev.phase !== "over") { somSfx("match_end"); somSfx("applause", 0.8, 0.4); }
}

/* الاستماع للطاولة وقت ما الغرفة مفتوحة (room-screen.js) */
function somWatch(on) {
    if (on && !somUnsub && firebaseDB) {
        somUnsub = somRef().onSnapshot(doc => somOnSnap(doc.exists ? doc.data() : null), () => {});
        if (!somRetry) somRetry = setInterval(somFetchHand, 1500);
        somLoadSfx();
    } else if (!on) {
        if (somUnsub) { somUnsub(); somUnsub = null; }
        if (somRetry) { clearInterval(somRetry); somRetry = null; }
        somClose(true);
    }
}

function somOnSnap(s) {
    const prev = somState;
    somState = s;
    const me = somMe(), act = !!(s && s.active);
    const pPhase = prev && prev.active ? prev.phase : "", nPhase = act ? s.phase : "";
    if (act && !(prev && prev.active) && s.phase === "lobby" && me !== s.hostUid && roomScreenOpen) roomToast("طاولة السوم فتحت، ادخل وانضم", "dice");
    /* أول ما تبدأ اللعبة تنفتح الطاولة للاعبين (مرة وحدة) */
    if (act && pPhase === "lobby" && nPhase === "bid" && somPlayer(s, me) && roomScreenOpen && !somIsOpen) somOpen();
    if (act && me && prev && (((s.phase === "bid" || s.phase === "offer") && s.turn === me && !(prev.turn === me && prev.phase === s.phase))
        || (s.phase === "respond" && pPhase !== "respond" && somOthers(s).indexOf(me) !== -1))) {
        try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) {}
    }
    somSoundFor(prev, s);
    if (!act && somIsOpen) somClose(true);
    if (pPhase !== nPhase || (prev && s && prev.round !== s.round) || (prev && s && (prev.players || []).length !== (s.players || []).length)) {
        if (typeof renderRoomUI === "function") renderRoomUI();
    }
    somFetchHand();
    somRender();
}

async function somFetchHand() {
    const s = somState, me = somMe();
    if (!somInRound(s, me) || !s.active) return;
    const key = somKey(s);
    if ((somHand && somHand.key === key) || somHandBusy || Date.now() - somHandFailAt < 2500) return;
    somHandBusy = true;
    try {
        const r = await somApi({ action: "hand", gid: s.gid, round: s.round });
        if (Array.isArray(r.hand)) {
            somHand = { key, cards: r.hand };
            try { sessionStorage.setItem("somHand", JSON.stringify(somHand)); } catch (e) {}
            somRender();
        }
    } catch (e) { somHandFailAt = Date.now(); }
    finally { somHandBusy = false; }
}

/* ===== المنظم: يوزع ويكشف ويتخطى، كله بأزرار ===== */
async function somHostNextRound() {
    const s = somState;
    if (!isAdmin || !s || !s.active || somHostBusy) return;
    if (s.phase !== "lobby" && s.phase !== "result") return;
    if (s.phase === "result" && somIsOver(s)) { await somDo({ t: "end" }); return; }
    const seats = somEligible(s), round = s.round + 1;
    if (seats.length < SOM.MIN_P) return roomToast("لازم لاعبين على الأقل", "users");
    somHostBusy = true; somRender();
    try {
        const r = await somApi({ action: "deal", gid: s.gid, round, uids: seats });
        if (Array.isArray(r.hand)) {
            somHand = { key: s.gid + ":" + round, cards: r.hand };
            try { sessionStorage.setItem("somHand", JSON.stringify(somHand)); } catch (e) {}
        }
        await somDo({ t: "round", round, seats, deal: r.deal });
    } catch (e) {
        roomToast("ما قدرت أوزع الأوراق: " + e.message, "alert");
    } finally { somHostBusy = false; somRender(); }
}
async function somHostReveal() {
    const s = somState;
    if (!isAdmin || !s || s.phase !== "showdown" || somHostBusy) return;
    somHostBusy = true; somRender();
    try {
        const r = await somApi({ action: "reveal", gid: s.gid, round: s.round });
        await somDo({ t: "reveal", hands: r.hands });
    } catch (e) {
        roomToast("ما قدرت أكشف الأوراق: " + e.message, "alert");
    } finally { somHostBusy = false; somRender(); }
}
function somHostSkip() {
    const s = somState;
    if (!s) return;
    const who = s.phase === "respond" ? "اللي ما ردوا (ينحسب قبول)" : somName(s, s.phase === "offer" ? s.leader : s.turn);
    if (confirm("تتخطى " + who + "؟")) somDo({ t: "skip" });
}

/* ===== الحركات من الأزرار ===== */
async function somCreate() {
    if (!isAdmin || !currentUser) return roomToast("المنظم بس يفتح الطاولة", "lock");
    if (somActiveGame() && somState.phase !== "over") return somOpen();
    const gid = "s" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    const r = await somDo({ t: "create", gid, name: somMyName() });
    if (r && r.s) { somState = r.s; somOpen(); }
}
function somJoin() {
    const av = (currentUserDocData && currentUserDocData.photoURL) || "";
    somDo({ t: "join", name: somMyName(), av });
}
function somLeave() { somDo({ t: "leave" }); }
function somKick(uid) { if (confirm("تطلّع " + somName(somState, uid) + " من الطاولة؟")) somDo({ t: "leave", uid }); }
function somBid() { somDo({ t: "bid", amt: somDraft.bid }); }
function somHold() { somDo({ t: "hold" }); }
function somFold() { somDo({ t: "fold" }); }
function somReply(v) { somDo({ t: "reply", v: v === "refuse" ? "refuse" : "accept" }); }
function somSendOffers() { somDo({ t: "offer", offers: Object.assign({}, somDraft.offers) }); }
function somEnd() { if (confirm("تنهي اللعبة الحين؟ الترتيب يطلع على الفلوس اللي معهم")) somDo({ t: "end" }); }
function somCloseTable() { if (confirm("تسكّر الطاولة؟")) somDo({ t: "close" }); }
async function somNewTable() {
    const r = await somDo({ t: "close" }, true);
    if (r && r.s) { somState = r.s; await somCreate(); }
}

/* مبلغ السوم: يبدأ من أقل سوم مسموح، ويتصفّر لما أحد يعلّي */
function somFixDraft(s, p) {
    const key = somKey(s) + ":" + s.high;
    const min = Math.max(SOM.MIN, s.high + SOM.STEP);
    if (somDraft.key !== key) { somDraft.key = key; somDraft.bid = min; }
    somDraft.bid = Math.max(Math.min(somDraft.bid, p.bal, s.high + SOM.JUMP), Math.min(min, p.bal));
}
function somStep(dir) { somAdd(dir * SOM.STEP); }
function somAdd(v) {
    const s = somState, p = s && somPlayer(s, somMe());
    if (!p) return;
    somDraft.bid = Math.max(Math.max(SOM.MIN, s.high + SOM.STEP), Math.min(p.bal, s.high + SOM.JUMP, somDraft.bid + v));
    somRender();
}
function somMaxBid() { const s = somState, p = s && somPlayer(s, somMe()); if (p) { somDraft.bid = Math.min(p.bal, s.high + SOM.JUMP); somRender(); } }
function somFixOffers(s) {
    const key = somKey(s);
    if (somDraft.okey !== key) { somDraft.okey = key; somDraft.offers = {}; }
    somOthers(s).forEach(u => { if (!(somDraft.offers[u] >= 0)) somDraft.offers[u] = 0; });
}
function somOStep(uid, dir) {
    somDraft.offers[uid] = Math.max(0, (somDraft.offers[uid] || 0) + dir * SOM.STEP);
    somRender();
}
function somOAll(v) { somOthers(somState).forEach(u => { somDraft.offers[u] = v; }); somRender(); }

/* المايك من داخل الطاولة: لو جالس يشغّل ويطفي، ولو مو جالس ياخذ أول مقعد فاضي */
function somMic() {
    if (!currentUser) return roomToast("سجّل دخولك أول", "lock");
    const mics = roomState.mics || [];
    if (mics.some(m => m && m.uid === currentUser.uid)) { onMicButton(); return; }
    const free = mics.findIndex((m, i) => !m && i !== HOST_SEAT);
    if (free === -1) return roomToast("المايكات مليانة", "mic-off");
    takeMicSlot(free);
}

/* ===== الواجهة ===== */
function somOpen() {
    if (!somActiveGame()) return;
    let el = document.getElementById("somScreen");
    if (!el) {
        el = document.createElement("div");
        el.id = "somScreen";
        el.className = "som-screen";
        el.setAttribute("role", "dialog");
        el.setAttribute("aria-label", "طاولة السوم");
        document.body.appendChild(el);
    }
    /* زر الرجوع في الجوال يسكّر الطاولة بس ويرجعك للغرفة (app.js popstate) */
    if (!somIsOpen) { try { window.history.pushState({ roomOpen: true, somOpen: true }, ""); } catch (e) {} }
    somIsOpen = true; somLastHTML = "";
    el.classList.add("open");
    document.body.classList.add("som-open");
    somUnlockAudio(); somLoadSfx();
    somRender();
}
/* fromPop: انسكرت من زر الرجوع أو من الغرفة نفسها (بدون ما نرجع خطوة في السجل) */
function somClose(fromPop) {
    if (!fromPop && somIsOpen && window.history.state && window.history.state.somOpen) { window.history.back(); return; }
    somIsOpen = false; somRulesOpen = false; somLastHTML = "";
    const el = document.getElementById("somScreen");
    if (el) { el.classList.remove("open"); el.innerHTML = ""; }
    document.body.classList.remove("som-open");
}
function somToggleRules() { somRulesOpen = !somRulesOpen; somRender(); }

/* شريط الطاولة في الغرفة (room.js renderRoomUI) */
function somRoomPill() {
    const s = somState;
    if (!s || !s.active || !roomState.isLive) return "";
    const t = s.phase === "lobby" ? "مفتوحة للانضمام (" + s.players.length + "/" + SOM.MAX_P + ")" : s.phase === "over" ? "انتهت، شوف الترتيب" : "الجولة " + s.round + " من " + s.maxRounds;
    return `<button class="som-pill" onclick="somOpen()"><span class="som-pill-dot"></span><span class="som-pill-t"><b>طاولة السوم</b> · ${escapeHTML(t)}</span><span class="som-pill-go">افتح ${ic("chevron-right")}</span></button>`;
}

function somCardHTML(c, i, cls) {
    const r = somRank(c), R = SOM_RANKS[r];
    const face = R.sym ? `<svg class="som-sym" viewBox="0 0 24 24" aria-hidden="true">${SOM_SYM[R.sym]}</svg>` : `<span class="som-num">${R.n}</span>`;
    return `<div class="som-card r${r}${cls ? " " + cls : ""}" style="--i:${i}" aria-label="${escapeHTML(R.n)}"><span class="som-card-c">${escapeHTML(R.n)}</span>${face}</div>`;
}
const SOM_BACK = i => `<div class="som-card back" style="--i:${i}"></div>`;
/* الأوراق مرتبة: المجموعة الأكبر أول */
function somSorted(cards) {
    const order = somEval(cards).groups.map(g => g.r);
    return cards.slice().sort((a, b) => order.indexOf(somRank(a)) - order.indexOf(somRank(b)));
}

/* أماكن اللاعبين حول الطاولة (نص اللاعب من العرض، وأعلاه من الطول): أنت تحت، واللي بعدك بالدور على يمينك، ويلفون فوق لين يسارك.
   أماكن ثابتة لكل عدد عشان ما يركب أحد على أحد حتى بـ 8 لاعبين على جوال 360×640 */
const SOM_SPOTS = [[],
    [[50, 0]],
    [[84, 16], [16, 16]],
    [[87, 30], [50, 0], [13, 30]],
    [[88, 42], [68, 0], [32, 0], [12, 42]],
    [[88.5, 50], [85, 14], [50, 0], [15, 14], [11.5, 50]],
    [[88.5, 55], [88.5, 27], [64, 0], [36, 0], [11.5, 27], [11.5, 55]],
    [[88.5, 55], [88.5, 27], [75, 0], [50, 0], [25, 0], [11.5, 27], [11.5, 55]]];
function somSpots(k) { return (SOM_SPOTS[k] || []).map(([x, y]) => ({ x, y })); }

/* حالة اللاعب تحت اسمه */
function somStatus(s, p) {
    const u = p.uid, tag = (t, c) => `<span class="som-st ${c || ""}">${escapeHTML(t)}</span>`;
    if (s.phase === "lobby") return u === s.hostUid ? tag("المنظم", "gold") : tag("جاهز", "ok");
    if (s.phase === "over") return "";
    if ((s.seats || []).indexOf(u) === -1) return tag(p.bal < SOM.MIN ? "مفلس" : "يتفرج", "dim");
    if (s.folded[u]) return tag("انسحب", "dim");
    const bid = s.bids[u];
    if (s.phase === "result") {
        const sh = s.shown && s.shown[u];
        if (sh) return tag(somHandName(somEval(sh)), s.res && s.res.winners.indexOf(u) !== -1 ? "gold" : "red");
        if (s.replies[u] === "accept") return tag("قبل " + somFmt(s.offers[u] || 0), "ok");
        return bid ? tag("سام " + somFmt(bid), "gold") : "";
    }
    if (s.phase === "bid") return s.turn === u ? tag("يسوم...", "live") : bid ? tag(somFmt(bid), "gold bet") : "";
    if (u === s.leader) return s.phase === "offer" ? tag("يفاوض...", "live") : s.phase === "showdown" ? tag("داقش " + somFmt(bid), "red") : tag(somFmt(bid), "gold bet");
    if (s.phase === "offer") return tag(somFmt(bid), "gold bet");
    const rep = s.replies[u], off = s.offers[u] || 0;
    if (rep === "accept") return tag("قبل " + somFmt(off), "ok");
    if (rep === "refuse") return tag("داقش " + somFmt(bid), "red");
    return tag("عرض " + somFmt(off) + "؟", "live");
}

function somSeatHTML(s, p, pos, rank) {
    const u = p.uid, me = somMe(), cls = ["som-seat"];
    if (u === me) cls.push("me");
    if ((s.phase === "bid" && s.turn === u) || (s.phase === "offer" && s.leader === u) || (s.phase === "respond" && somOthers(s).indexOf(u) !== -1 && !s.replies[u])) cls.push("turn");
    if (s.phase !== "lobby" && s.phase !== "over" && ((s.seats || []).indexOf(u) === -1 || s.folded[u])) cls.push("out");
    if ((s.phase === "result" && s.res && s.res.winners.indexOf(u) !== -1) || (s.phase === "over" && rank === 0)) cls.push("win");
    const av = p.av || getPlayerAvatar(p.name).url;
    const d = s.phase === "result" && s.res ? s.res.delta[u] : 0;
    const lead = s.leader === u && ["bid", "offer", "respond", "showdown"].indexOf(s.phase) !== -1;
    const kick = isAdmin && s.phase === "lobby" && u !== me ? `<button class="som-x" onclick="somKick(${jsArg(u)})" aria-label="طلّع ${escapeHTML(p.name)}">${ic("x")}</button>` : "";
    if (pos.me) cls.push("spot-me");
    return `<div class="${cls.join(" ")}" style="left:${pos.x}%;${pos.me ? "" : "top:" + pos.y + "%"}">
<div class="som-av"><img src="${safeSrc(cdnThumb(av))}" alt="" loading="lazy">${lead ? `<span class="som-lead">${ic("crown")}</span>` : ""}${rank != null ? `<span class="som-rank">${rank + 1}</span>` : ""}${kick}</div>
${somStatus(s, p) || `<span class="som-st none"></span>`}
<div class="som-nm">${escapeHTML(p.name)}</div>
<div class="som-bal">${SOM_COIN}${somFmt(p.bal)}</div>
${d ? `<span class="som-delta ${d > 0 ? "up" : "down"}">${d > 0 ? "+" : "−"}${somFmt(Math.abs(d))}</span>` : ""}
</div>`;
}

/* وسط الطاولة: وش يصير الحين */
function somCenterHTML(s) {
    const me = somMe();
    let t = "", sub = "", cls = "";
    if (s.phase === "lobby") { t = "طاولة جديدة"; sub = s.players.length + " من " + SOM.MAX_P + " لاعبين · كل واحد " + somFmt(SOM.START); }
    else if (s.phase === "bid") {
        t = s.turn === me ? "دورك تسوم" : "دور " + somName(s, s.turn);
        sub = s.high ? "أعلى سوم " + somFmt(s.high) : "أول سوم يفتح الجولة";
        if (s.turn === me) cls = "mine";
    } else if (s.phase === "offer") {
        t = s.leader === me ? "فاوضهم" : somName(s, s.leader) + " يفاوض";
        sub = "أعلى سوم " + somFmt(s.high);
        if (s.leader === me) cls = "mine";
    } else if (s.phase === "respond") {
        const mine = somOthers(s).indexOf(me) !== -1 && !s.replies[me];
        t = mine ? "وصلك عرض" : "ينتظرون الردود";
        sub = "عرض " + somName(s, s.leader);
        if (mine) cls = "mine";
    } else if (s.phase === "showdown") { t = "مداقشة!"; sub = "ينتظرون المنظم يكشف الأوراق"; cls = "hot"; }
    else if (s.phase === "result") {
        const r = s.res || { winners: [] };
        t = r.kind === "none" ? "ما أحد كسب" : r.winners.map(u => somName(s, u)).join(" و ") + " كسب";
        sub = r.kind === "clear" ? "قبلوا العروض، ونص السوم من البنك" : r.kind === "showdown" ? "أوراقه الأقوى" : "انسحبوا قبل المفاوضة";
        cls = "win";
    } else if (s.phase === "over") {
        const top = s.players.slice().sort((a, b) => b.bal - a.bal)[0];
        t = "انتهت اللعبة"; sub = top ? "الفايز " + top.name : ""; cls = "win";
    }
    const last = (s.log || []).slice(-1)[0];
    return `<div class="som-center ${cls}"><div class="som-c-t">${escapeHTML(t)}</div><div class="som-c-s">${escapeHTML(sub)}</div>${last && s.phase !== "lobby" ? `<div class="som-c-l">${escapeHTML(last)}</div>` : ""}</div>`;
}

function somTableHTML(s) {
    const me = somMe(), list = (s.players || []).slice();
    if (!list.length) return `<div class="som-table"><div class="som-felt"></div><div class="som-center"><div class="som-c-t">طاولة جديدة</div><div class="som-c-s">ما أحد انضم للحين</div></div></div>`;
    let ranks = null;
    if (s.phase === "over") { ranks = {}; list.slice().sort((a, b) => b.bal - a.bal).forEach((p, i) => { ranks[p.uid] = i; }); }
    /* أنت تحت، والباقين بترتيب الدور من بعدك */
    const mi = list.findIndex(p => p.uid === me), start = mi === -1 ? 0 : mi;
    const order = list.slice(start).concat(list.slice(0, start));
    const spots = [{ x: 50, me: true }].concat(somSpots(order.length - 1));
    return `<div class="som-table"><div class="som-felt"></div>${somCenterHTML(s)}${order.map((p, i) => somSeatHTML(s, p, spots[i], ranks ? ranks[p.uid] : null)).join("")}</div>`;
}

function somHandHTML(s) {
    if (!somInRound(s, somMe())) return "";
    const cards = somHand && somHand.key === somKey(s) ? somHand.cards : null;
    if (!cards) return `<div class="som-hand"><div class="som-hand-l">أوراقك · <span>توصل الحين...</span></div><div class="som-cards">${[0, 1, 2, 3].map(SOM_BACK).join("")}</div></div>`;
    const ev = somEval(cards), hot = ev.groups.filter(g => g.n > 1).map(g => g.r);
    const out = s.folded[somMe()] ? " folded" : "";
    return `<div class="som-hand${out}"><div class="som-hand-l">أوراقك · <b>${escapeHTML(somHandName(ev))}</b></div><div class="som-cards" data-k="${escapeHTML(somHand.key)}">${somSorted(cards).map((c, i) => somCardHTML(c, i, hot.indexOf(somRank(c)) !== -1 ? "hot" : "")).join("")}</div></div>`;
}

/* لوحة المداقشة: قبل الكشف أوراق مقلوبة، وبعده الأوراق واسم اليد والفلوس */
function somDuelHTML(s) {
    const shown = s.phase === "result" && s.shown;
    const list = shown ? Object.keys(s.shown) : (s.show || []);
    if (!list.length) return "";
    const ordered = (s.seats || []).filter(u => list.indexOf(u) !== -1);
    if (shown) ordered.sort((a, b) => somCmp(somEval(s.shown[b]), somEval(s.shown[a])));
    return `<div class="som-duel">${ordered.map(u => {
        const win = shown && s.res.winners.indexOf(u) !== -1, d = shown ? s.res.delta[u] || 0 : 0;
        const cards = shown ? somSorted(s.shown[u]).map((c, i) => somCardHTML(c, i, "mini flip")).join("") : [0, 1, 2, 3].map(i => `<div class="som-card back mini" style="--i:${i}"></div>`).join("");
        return `<div class="som-drow${win ? " win" : ""}"><span class="som-dn">${win ? ic("crown") : ""}${escapeHTML(somName(s, u))}</span><div class="som-mini-cards">${cards}</div><span class="som-dh">${shown ? escapeHTML(somHandName(somEval(s.shown[u]))) : "سام " + somFmt(s.bids[u])}</span>${d ? `<b class="${d > 0 ? "up" : "down"}">${d > 0 ? "+" : "−"}${somFmt(Math.abs(d))}</b>` : ""}</div>`;
    }).join("")}</div>`;
}

function somActHTML(s) {
    const me = somMe(), p = somPlayer(s, me), note = t => `<div class="som-note">${t}</div>`;
    let h = "";
    if (s.phase === "lobby") {
        if (!currentUser) h = note("سجّل دخولك عشان تلعب");
        else if (p) h = note("انضميت" + (isAdmin ? "" : "، ننتظر المنظم يبدأ") + " · اطلع على المايك عشان تفاوض بصوتك") + `<button class="som-b ghost" onclick="somLeave()">طلّعني من الطاولة</button>`;
        else h = `<button class="som-b gold" onclick="somJoin()" ${s.players.length >= SOM.MAX_P ? "disabled" : ""}>${ic("plus")} انضم للطاولة</button>`;
        if (isAdmin) h += `<button class="som-b brand" onclick="somHostNextRound()" ${s.players.length >= SOM.MIN_P && !somHostBusy ? "" : "disabled"}>${ic("rocket")} ابدأ اللعبة (${s.players.length} لاعبين)</button>`;
    } else if (s.phase === "bid") {
        if (s.turn === me && p) h = somBidHTML(s, p);
        else if (somInRound(s, me) && !s.folded[me]) h = note(s.bids[me] ? "سومك " + somFmt(s.bids[me]) + " · انتظر دورك" : "انتظر دورك تسوم");
        else h = note("يسومون الحين");
    } else if (s.phase === "offer") {
        h = s.leader === me ? somOfferHTML(s) : note(somOthers(s).indexOf(me) !== -1 ? "انتظر عرض " + escapeHTML(somName(s, s.leader)) + "، وكلّمه بالمايك لو تبي تفاوض" : "يفاوضون الحين");
    } else if (s.phase === "respond") {
        if (somOthers(s).indexOf(me) !== -1 && !s.replies[me]) {
            const off = s.offers[me] || 0;
            h = `<div class="som-offer"><small>${escapeHTML(somName(s, s.leader))} يعرض عليك</small><b>${SOM_COIN}${somFmt(off)}</b><small>عشان تنسحب. لو داقشت وخسرت تخسر سومك ${somFmt(s.bids[me])}، ولو كسبت سومك يتضاعف وتاخذ سوم الخاسرين</small></div>
<div class="som-btns"><button class="som-b gold" onclick="somReply('accept')">${ic("check")} اقبل وانسحب</button><button class="som-b danger" onclick="somReply('refuse')">${ic("zap")} داقش</button></div>`;
        } else if (s.replies[me]) h = note(s.replies[me] === "refuse" ? "رفضت العرض، انتظر الباقين" : "قبلت العرض");
        else h = note(s.leader === me ? "انتظر ردودهم على عروضك" : "ينتظرون الردود");
    } else if (s.phase === "showdown") {
        h = somDuelHTML(s) + (isAdmin ? `<button class="som-b gold" onclick="somHostReveal()" ${somHostBusy ? "disabled" : ""}>${ic("zap")} اكشف الأوراق</button>` : note("المنظم يكشف الأوراق الحين"));
    } else if (s.phase === "result") {
        const d = s.res && s.res.delta[me];
        h = somDuelHTML(s) + note(d ? (d > 0 ? "كسبت " : "خسرت ") + somFmt(Math.abs(d)) + " بهالجولة" : (isAdmin ? "اضغط الجولة الجاية لما تكونون جاهزين" : "ننتظر المنظم يبدأ الجولة الجاية"));
        if (isAdmin) h += `<button class="som-b brand" onclick="somHostNextRound()" ${somHostBusy ? "disabled" : ""}>${somIsOver(s) ? ic("trophy") + " الترتيب النهائي" : ic("chevron-right") + " الجولة الجاية (" + (s.round + 1) + " من " + s.maxRounds + ")"}</button>`;
    } else if (s.phase === "over") h = note("شكراً للعب" + (p ? " · فلوسك " + somFmt(p.bal) : ""));
    if (isAdmin) h += somHostBarHTML(s);
    return h;
}

function somBidHTML(s, p) {
    somFixDraft(s, p);
    const min = Math.max(SOM.MIN, s.high + SOM.STEP), canRaise = p.bal >= min, entered = s.bids[p.uid] > 0;
    let h = "";
    if (canRaise) h += `<div class="som-amt">
<button class="som-step" onclick="somStep(-1)" aria-label="أقل">−</button>
<div class="som-amt-v"><b>${somFmt(somDraft.bid)}</b><small>${s.high ? "أكثر من " + somFmt(s.high) : "من " + somFmt(SOM.MIN)} لين ${somFmt(Math.min(p.bal, s.high + SOM.JUMP))}</small></div>
<button class="som-step" onclick="somStep(1)" aria-label="أكثر">+</button>
</div>
<div class="som-quick">${[500, 1000, 2500].map(v => `<button onclick="somAdd(${v})">+${somFmt(v)}</button>`).join("")}<button onclick="somMaxBid()">الأقصى</button></div>`;
    else h += `<div class="som-note">ما معك فلوس تعلّي على ${somFmt(s.high)}</div>`;
    h += `<div class="som-btns">${canRaise ? `<button class="som-b gold" onclick="somBid()">سوم ${somFmt(somDraft.bid)}</button>` : ""}${entered ? `<button class="som-b ghost" onclick="somHold()">ثبّت ${somFmt(s.bids[p.uid])}</button>` : ""}<button class="som-b danger" onclick="somFold()">انسحاب</button></div>`;
    return h;
}

function somOfferHTML(s) {
    somFixOffers(s);
    const room = somOfferRoom(s), others = somOthers(s);
    const sum = others.reduce((t, u) => t + (somDraft.offers[u] || 0), 0);
    const rows = others.map(u => `<div class="som-orow">
<span class="som-orow-n">${escapeHTML(somName(s, u))}<small>سام ${somFmt(s.bids[u])}</small></span>
<button class="som-step sm" onclick="somOStep(${jsArg(u)},-1)" aria-label="أقل">−</button>
<b>${somFmt(somDraft.offers[u])}</b>
<button class="som-step sm" onclick="somOStep(${jsArg(u)},1)" aria-label="أكثر">+</button>
</div>`).join("");
    return `<div class="som-orows">${rows}</div>
<div class="som-quick"><button onclick="somOAll(0)">صفر</button><button onclick="somOAll(300)">300</button><button onclick="somOAll(500)">500</button><button onclick="somOAll(1000)">1,000</button></div>
<div class="som-osum ${sum > room ? "bad" : ""}">المجموع ${somFmt(sum)} · تقدر لين ${somFmt(room)} · الصفر يعني داقشوني</div>
<div class="som-btns"><button class="som-b gold" onclick="somSendOffers()" ${sum > room ? "disabled" : ""}>${ic("send")} أرسل العروض</button></div>`;
}

function somHostBarHTML(s) {
    let b = "";
    if (s.phase === "bid" || s.phase === "offer" || s.phase === "respond") b += `<button onclick="somHostSkip()">${ic("chevron-right")} تخطّى</button>`;
    if (s.phase === "over") b += `<button onclick="somNewTable()">${ic("plus")} طاولة جديدة</button><button onclick="somCloseTable()">${ic("x")} سكّر الطاولة</button>`;
    else if (s.phase === "lobby") b += `<button onclick="somCloseTable()">${ic("x")} إلغاء الطاولة</button>`;
    else b += `<button onclick="somEnd()">${ic("power")} إنهاء اللعبة</button>`;
    return `<div class="som-host">${b}</div>`;
}

function somRulesHTML() {
    const ex = (cards, t) => `<div class="som-rx"><div class="som-mini-cards">${cards.map((c, i) => somCardHTML(c, i, "mini")).join("")}</div><span>${t}</span></div>`;
    return `<div class="som-rules" role="document" onclick="if(event.target===this)somToggleRules()">
<div class="som-rules-in">
<div class="som-rules-h"><b>طريقة اللعب</b><button class="som-ic" onclick="somToggleRules()" aria-label="سكّر">${ic("x")}</button></div>
<p>كل لاعب يبدأ بـ ${somFmt(SOM.START)}، وبيده 4 أوراق ما يشوفها غيره.</p>
<h4>الأوراق من الأقوى</h4>
<div class="som-rank-row">${[7, 6, 5, 4, 3, 2, 1, 0].map((r, i) => somCardHTML(r * 4, i, "mini")).join("")}</div>
<h4>اليد الأقوى: العدد أول وبعده قوة الورقة</h4>
${ex([20, 21, 22, 23], "رباعية")}${ex([8, 9, 10, 28], "ثلاثية")}${ex([28, 29, 24, 25], "زوجين")}${ex([24, 25, 0, 4], "زوج")}${ex([28, 24, 8, 0], "أعلى ورقة")}
<p class="som-rules-tip">يعني ثلاث أوراق 9 تغلب زوجين تاج.</p>
<h4>الجولة</h4>
<ol>
<li><b>السوم:</b> بالدور، كل سوم أعلى من اللي قبله (بحد أقصى ${somFmt(SOM.JUMP)} زيادة). تقدر تثبّت على سومك أو تنسحب (الانسحاب ما يخسرك شي). يلف لين محد يعلّي.</li>
<li><b>المفاوضة:</b> صاحب أعلى سوم يعرض على كل واحد مبلغ عشان ينسحب (أو صفر). تكلموا بالمايك.</li>
<li><b>الرد:</b> اللي يقبل ياخذ العرض من جيب صاحب السوم ويطلع. اللي يرفض يداقش.</li>
<li><b>المداقشة:</b> المنظم يكشف أوراق اللي داقشوا. الأقوى ياخذ سومه مضاعف وسوم كل الخاسرين، والخاسر يخسر سومه.</li>
<li>لو الكل قبلوا العروض، صاحب السوم ياخذ نص سومه من البنك. ولو انسحبوا كلهم قبل المفاوضة، الجولة تخلص بدون فلوس.</li>
</ol>
<p>ما فيه وقت: كل واحد ياخذ راحته، والمنظم يبدأ الجولة الجاية. ${somFmt(SOM.ROUNDS)} جولات، أو لين يبقى لاعب واحد معه فلوس، والأغنى في الآخر يفوز.</p>
</div></div>`;
}

function somMicBtn() {
    if (!currentUser) return "";
    const seat = (roomState.mics || []).findIndex(m => m && m.uid === currentUser.uid);
    if (seat === -1) return `<button class="som-ic dim" onclick="somMic()" aria-label="اطلع على المايك">${ic("mic")}</button>`;
    const muted = roomState.mics[seat].muted;
    return `<button class="som-ic ${muted ? "off" : "on"}" onclick="somMic()" aria-label="${muted ? "شغّل المايك" : "اكتم المايك"}">${ic(muted ? "mic-off" : "mic")}</button>`;
}

function somRender() {
    const el = document.getElementById("somScreen");
    if (!el || !somIsOpen) return;
    const s = somState;
    if (!s || !s.active) { somClose(true); return; }
    const html = `
<div class="som-top">
<button class="som-ic" onclick="somClose()" aria-label="رجوع للغرفة">${ic("chevron-right")}</button>
<div class="som-title"><b>السوم</b><span>${s.phase === "lobby" ? "قبل البداية" : s.phase === "over" ? "النتيجة النهائية" : "الجولة " + s.round + " من " + s.maxRounds}</span></div>
<div class="som-top-btns">${somMicBtn()}<button class="som-ic" onclick="somToggleRules()" aria-label="طريقة اللعب">${ic("book")}</button></div>
</div>
${somTableHTML(s)}
<div class="som-bottom">${somHandHTML(s)}<div class="som-act">${somActHTML(s)}</div></div>
${somRulesOpen ? somRulesHTML() : ""}`;
    if (html === somLastHTML) return;
    somLastHTML = html;
    el.innerHTML = html;
    /* حركة التوزيع مرة وحدة لكل جولة (كلاس من هنا مو من النص، عشان أي رسم بعدها ما يعيدها) */
    const cs = el.querySelector(".som-cards[data-k]");
    if (cs && cs.dataset.k !== somDealtKey) { somDealtKey = cs.dataset.k; cs.classList.add("deal"); }
}
