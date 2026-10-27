/* لعبة "برا السالفة" في الغرفة الصوتية (طلب محمد، 27 أكتوبر 2026). نفس طريقة السوم (js/som.js):
   - 3 لين 10 لاعبين. كل جولة المنظم يختار تصنيف (أو عشوائي)، والسيرفر (functions/bara.js) يختار كلمة سرية ولاعب واحد
     "برا السالفة" ويختمها في الوثيقة (plan)، وكل لاعب يطلب دوره هو بس (role): داخل السالفة والكلمة، أو برا السالفة والتصنيف.
   - الأسئلة بالدور (asks: [{ a: السائل، b: اللي ينسأل }]، كل واحد يسأل مرة وينسأل مرة بكل دورة. Firestore ما يقبل مصفوفة داخل مصفوفة)، والمنظم يضغط التالي، ويقدر يضيف دورة.
   - التصويت سري: كل لاعب يكتب صوته في baraVotes/<uid> (يقراه هو والمنظم بس، firestore.rules)، ويقدر يغيّره لين المنظم يكشف.
   - الكشف: لو الأكثر أصوات (لحاله) هو اللي برا السالفة ← انكشف. غيره أو تعادل ← ما انكشف. وبالحالتين يخمّن الكلمة من 8 خيارات.
     التخمين يروح للسيرفر (guess) ويرجع إيصال مختوم بدون ما يقول صح أو غلط، والمنظم يحكم فيه (reveal مع receipt).
   - النقاط: صوت صح +100، اللي برا السالفة لو ما انكشف +200، تخمين صح +150، واللي ما صوّت 0.
   - الحالة في room/main/games/bara، وكل تغيير بـ transaction عبر baraReduce (دالة صافية، tests/functions/bara-rules.test.mjs).
   - ما فيه أي انتقال تلقائي: بداية الجولة والتالي واكشف التصويت والنتيجة والجولة الجاية كلها بزر المنظم، ولو أحد علّق "تخطّى". */

const BARA = { MIN_P: 3, MAX_P: 10, ROUNDS: 5, MAX_ROUNDS: 10, OPTS: 8, VOTE: 100, ESCAPE: 200, GUESS: 150 };
/* أسماء التصنيفات بس (الكلمات في lib/bara-words.js بالسيرفر، ما تنتشر) */
const BARA_CATS = [["food", "أكلات"], ["places", "أماكن"], ["jobs", "مهن"], ["animals", "حيوانات"], ["shows", "أفلام ومسلسلات"],
    ["home", "أغراض البيت"], ["sports", "رياضة"], ["brands", "ماركات"], ["countries", "دول"], ["gulf", "شخصيات خليجية مشهورة"]];
const BARA_CAT_IDS = BARA_CATS.map(c => c[0]);

/* ===== القوانين (بدون أي واجهة) ===== */
function baraName(s, uid) { const p = ((s && s.players) || {})[uid]; return p ? p.name : "لاعب"; }
function baraNew(gid, uid, name, now) {
    return { active: true, gid, phase: "lobby", hostUid: uid, hostName: name, pids: [], players: {}, rounds: BARA.ROUNDS, round: 0,
        cat: "", catName: "", plan: "", asks: [], turn: 0, laps: 0, voted: [], res: null, log: [], v: 1, at: now };
}
function baraLog(s, t) { s.log = (s.log || []).concat(t).slice(-8); }
/* دورة أسئلة: كل لاعب يسأل واحد ثاني، وكل واحد ينسأل مرة (ترتيب عشوائي بدون ما أحد يسأل نفسه). rand للاختبار */
function baraPairs(pids, rand) {
    const r = rand || Math.random, n = pids.length;
    if (n < 2) return [];
    let p;
    for (let k = 0; k < 200; k++) {
        p = pids.slice();
        for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
        if (p.every((u, i) => u !== pids[i])) break;
        p = null;
    }
    if (!p) p = pids.slice(1).concat(pids[0]);
    const start = Math.floor(r() * n);
    return pids.map((_, i) => ({ a: pids[(start + i) % n], b: p[(start + i) % n] }));
}
function baraPairsOk(s, pairs) {
    const n = s.pids.length;
    if (!Array.isArray(pairs) || pairs.length !== n) return false;
    const askers = new Set(), askees = new Set();
    return pairs.every(x => x && typeof x === "object" && Object.keys(x).length === 2 && x.a !== x.b && s.pids.indexOf(x.a) !== -1 && s.pids.indexOf(x.b) !== -1
        && !askers.has(x.a) && askers.add(x.a) && !askees.has(x.b) && askees.add(x.b));
}
/* الكشف: عدد الأصوات لكل واحد، والأكثر (لو تعادلوا كلهم في top) */
function baraTally(s, votes) {
    const tally = {};
    Object.keys(votes).forEach(v => { const t = votes[v]; tally[t] = (tally[t] || 0) + 1; });
    const max = Math.max(0, ...Object.values(tally));
    const top = max ? s.pids.filter(u => tally[u] === max) : [];
    return { tally, top };
}
/* النقاط: صوت صح +100، ما انكشف +200، تخمين صح +150 */
function baraDelta(res, ok) {
    const d = {};
    const add = (u, n) => { d[u] = (d[u] || 0) + n; };
    Object.keys(res.votes || {}).forEach(v => { if (res.votes[v] === res.out) add(v, BARA.VOTE); });
    if (!res.caught) add(res.out, BARA.ESCAPE);
    if (ok) add(res.out, BARA.GUESS);
    return d;
}
function baraRanking(s) { return (s.pids || []).slice().sort((a, b) => ((s.players[b] || {}).score || 0) - ((s.players[a] || {}).score || 0)); }

/* كل حركة في اللعبة: (الحالة، الحركة، {uid، now، host}) ← { s } أو { err }.
   الانضمام والطلوع (من غير المنظم) يغيّرون pids و players بس، عشان قواعد Firestore تسمح لهم بهذا وبس */
function baraReduce(s0, a, ctx) {
    const now = ctx.now, me = ctx.uid, E = m => ({ err: m });
    if (!a || !a.t) return E("حركة غلط");
    if (a.t === "create") {
        if (!ctx.host) return E("المنظم بس يفتح الطاولة");
        if (s0 && s0.active && s0.phase !== "over") return E("فيه طاولة شغالة");
        return { s: baraNew(String(a.gid), me, String(a.name || "المنظم").slice(0, 30), now) };
    }
    if (!s0 || !s0.active) return E("ما فيه طاولة");
    const s = JSON.parse(JSON.stringify(s0));
    s.pids = s.pids || []; s.players = s.players || {};
    const host = () => ctx.host ? null : E("للمنظم بس");
    if (a.t === "join") {
        if (s.phase !== "lobby") return E("اللعبة بدأت، انتظر الطاولة الجاية");
        if (s.pids.indexOf(me) !== -1) return E("أنت داخل الطاولة");
        if (s.pids.length >= BARA.MAX_P) return E("الطاولة مليانة (" + BARA.MAX_P + " لاعبين)");
        s.pids.push(me);
        s.players[me] = { name: String(a.name || "لاعب").slice(0, 30), av: String(a.av || "").slice(0, 500), score: 0 };
        return { s };
    }
    if (a.t === "leave") {
        if (s.phase !== "lobby") return E("اللعبة بدأت");
        const who = a.uid && ctx.host ? String(a.uid) : me;
        if (s.pids.indexOf(who) === -1) return E("مو في الطاولة");
        s.pids = s.pids.filter(u => u !== who);
        delete s.players[who];
        return { s };
    }
    if (host()) return host();
    s.v = (s.v || 0) + 1; s.at = now;
    switch (a.t) {
        case "rounds": {
            if (s.phase !== "lobby") return E("اللعبة بدأت");
            const n = Math.floor(Number(a.n));
            if (!(n >= 1 && n <= BARA.MAX_ROUNDS)) return E("عدد الجولات من 1 لين " + BARA.MAX_ROUNDS);
            s.rounds = n;
            return { s };
        }
        case "round": {
            if (s.phase !== "lobby" && s.phase !== "result") return E("مو وقت جولة جديدة");
            if (s.round >= s.rounds) return E("الجولات خلصت");
            if (s.pids.length < BARA.MIN_P) return E("لازم " + BARA.MIN_P + " لاعبين على الأقل");
            if (a.round !== s.round + 1 || typeof a.plan !== "string" || !a.plan || BARA_CAT_IDS.indexOf(a.cat) === -1) return E("الجولة مو جاهزة");
            if (!baraPairsOk(s, a.asks)) return E("ترتيب الأسئلة غلط");
            Object.assign(s, { phase: "ask", round: a.round, plan: a.plan, cat: a.cat, catName: String(a.catName || "").slice(0, 40),
                asks: a.asks.map(x => ({ a: x.a, b: x.b })), turn: 0, laps: 1, voted: [], res: null });
            baraLog(s, "الجولة " + s.round + ": " + s.catName);
            return { s };
        }
        case "next": {
            if (s.phase !== "ask") return E("مو وقت الأسئلة");
            if (s.turn >= s.asks.length) return E("خلصت الدورة");
            s.turn++;
            return { s };
        }
        case "lap": {
            if (s.phase !== "ask" || s.turn < s.asks.length) return E("كمّلوا الدورة أول");
            if (!baraPairsOk(s, a.asks)) return E("ترتيب الأسئلة غلط");
            s.asks = s.asks.concat(a.asks.map(x => ({ a: x.a, b: x.b }))); s.laps++;
            baraLog(s, "دورة أسئلة ثانية");
            return { s };
        }
        case "vote": {
            if (s.phase !== "ask") return E("مو وقت التصويت");
            Object.assign(s, { phase: "vote", voted: [] });
            baraLog(s, "التصويت بدأ");
            return { s };
        }
        case "voted": {
            if (s.phase !== "vote") return E("مو وقت التصويت");
            const list = Array.isArray(a.list) ? s.pids.filter(u => a.list.indexOf(u) !== -1) : [];
            if (JSON.stringify(list) === JSON.stringify(s.voted || [])) return E("ما تغيّر شي");
            s.voted = list;
            return { s };
        }
        case "reveal": {
            if (s.phase !== "vote") return E("مو وقت الكشف");
            if (s.pids.indexOf(a.out) === -1) return E("اللاعب مو في الطاولة");
            if (!Array.isArray(a.opts) || a.opts.length !== BARA.OPTS || !a.opts.every(x => typeof x === "string" && x)) return E("الخيارات ناقصة");
            const votes = {};
            Object.keys(a.votes || {}).forEach(v => {
                const t = a.votes[v];
                if (s.pids.indexOf(v) !== -1 && s.pids.indexOf(t) !== -1 && t !== v) votes[v] = t;
            });
            const { tally, top } = baraTally(s, votes);
            const caught = top.length === 1 && top[0] === a.out;
            s.res = { votes, tally, top, out: a.out, caught, opts: a.opts.slice() };
            Object.assign(s, { phase: "guess", voted: Object.keys(votes) });
            baraLog(s, caught ? baraName(s, a.out) + " انكشف" : baraName(s, a.out) + " ما انكشف");
            return { s };
        }
        case "settle": {
            if (s.phase !== "guess") return E("مو وقت النتيجة");
            const choice = a.choice == null ? null : String(a.choice);
            if (choice !== null && s.res.opts.indexOf(choice) === -1) return E("التخمين مو من الخيارات");
            if (typeof a.word !== "string" || s.res.opts.indexOf(a.word) === -1) return E("الكلمة غلط");
            const ok = choice !== null && choice === a.word;
            const delta = baraDelta(s.res, ok);
            Object.keys(delta).forEach(u => { if (s.players[u]) s.players[u].score = (s.players[u].score || 0) + delta[u]; });
            Object.assign(s.res, { word: a.word, choice, ok, delta });
            s.phase = "result";
            baraLog(s, "السالفة: " + a.word + (choice === null ? "، وما خمّن" : ok ? "، وخمّنها صح" : "، وخمّن غلط"));
            return { s };
        }
        case "end": {
            Object.assign(s, { phase: "over" });
            baraLog(s, "انتهت اللعبة");
            return { s };
        }
        case "close": {
            s.active = false;
            return { s };
        }
    }
    return E("حركة غلط");
}

/* ===== الاتصال: الوثيقة والسيرفر ===== */
let baraState = null, baraUnsub = null, baraIsOpen = false, baraRulesOpen = false;
let baraRole = null;             /* { key: "gid:round", out, cat, catName, word? } */
let baraRoleBusy = false, baraRoleFailAt = 0, baraHostBusy = false, baraRetry = null;
let baraCardOpen = false, baraCardKey = "";   /* بطاقة الدور مقلوبة لين تلمسها، وترجع تنقلب مع كل جولة */
let baraCatPick = "random";
let baraMyVote = null, baraVoteUnsub = null; /* صوتي (وثيقتي في baraVotes) */
let baraVotesUnsub = null, baraVoteDocs = {}; /* المنظم: أصوات الكل */
let baraGuessPick = "", baraGuessSent = "";
let baraLastHTML = "";
try { const r = JSON.parse(sessionStorage.getItem("baraRole") || "null"); if (r && r.key) baraRole = r; } catch (e) {}
try { baraGuessSent = sessionStorage.getItem("baraGuess") || ""; } catch (e) {}

function baraRef() { return firebaseDB.collection("room").doc("main").collection("games").doc("bara"); }
function baraVoteRef(uid) { return firebaseDB.collection("baraVotes").doc(uid); }
function baraNow() { return typeof bcNow === "function" ? bcNow() : Date.now(); }
function baraMe() { return currentUser ? currentUser.uid : ""; }
function baraMyName() {
    return (currentUserDocData && currentUserDocData.name) || (currentUser && (currentUser.displayName || String(currentUser.email || "").split("@")[0])) || "لاعب";
}
function baraKey(s) { return s ? s.gid + ":" + s.round : ""; }
function baraActiveGame() { return !!(baraState && baraState.active); }
function baraInRound(s, uid) { return !!s && ["ask", "vote", "guess", "result"].indexOf(s.phase) !== -1 && (s.pids || []).indexOf(uid) !== -1; }

async function baraApi(body) {
    const r = await fetch("/bara", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, await authHeaders()), body: JSON.stringify(body) });
    let j = {};
    try { j = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error(j.error || "bara " + r.status);
    return j;
}

async function baraDo(a, quiet) {
    if (!firebaseDB || !currentUser) { roomToast("سجّل دخولك أول", "lock"); return null; }
    const ref = baraRef();
    try {
        const out = await firebaseDB.runTransaction(async tx => {
            const snap = await tx.get(ref);
            const r = baraReduce(snap.exists ? snap.data() : null, a, { uid: currentUser.uid, now: baraNow(), host: !!isAdmin });
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

/* ===== الأصوات: نفس تسجيلات audio/ اللي في السوم والبث، على جهاز كل واحد، وتحترم كتم الغرفة ===== */
const BARA_SFX = { whoosh: 0.55, tick: 0.9, start_q: 0.7, riser: 0.5, reveal: 0.75, slam: 0.45, correct: 0.85, wrong: 0.7, applause: 0.55, match_end: 0.75 };
let baraAC = null;
const baraBuf = {}, baraBufLoading = {};
function baraAudio() {
    if (!baraAC) { try { baraAC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    return baraAC;
}
function baraLoadSfx() {
    const c = baraAudio();
    if (!c) return;
    Object.keys(BARA_SFX).forEach(id => {
        if (baraBuf[id] || baraBufLoading[id]) return;
        baraBufLoading[id] = fetch("audio/" + id + ".mp3")
            .then(r => { if (!r.ok) throw new Error("no file"); return r.arrayBuffer(); })
            .then(ab => new Promise((res, rej) => c.decodeAudioData(ab, res, rej)))
            .then(b => { baraBuf[id] = b; })
            .catch(() => setTimeout(() => { delete baraBufLoading[id]; }, 30000));
    });
}
function baraUnlockAudio() { const c = baraAudio(); try { if (c && c.state === "suspended") c.resume(); } catch (e) {} }
if (typeof document !== "undefined") document.addEventListener("pointerdown", baraUnlockAudio, { passive: true });
function baraSfx(id, v, delay) {
    if (!baraIsOpen && !roomScreenOpen) return;
    if (typeof speakerMuted !== "undefined" && speakerMuted) return;
    const c = baraAC, b = baraBuf[id];
    if (!c || !b) return;
    try {
        if (c.state === "suspended") c.resume();
        const src = c.createBufferSource(), g = c.createGain();
        src.buffer = b; g.gain.value = (v == null ? 1 : v) * BARA_SFX[id];
        src.connect(g); g.connect(c.destination);
        src.start(c.currentTime + (delay || 0));
    } catch (e) {}
}
function baraSoundFor(prev, s) {
    const me = baraMe();
    if (!prev || !prev.active || !s || !s.active || prev.gid !== s.gid) return;
    if (s.phase === "lobby") { if ((s.pids || []).length > (prev.pids || []).length) baraSfx("tick", 0.6); return; }
    if (s.phase === "ask" && (prev.phase !== "ask" || prev.round !== s.round)) { baraSfx("whoosh"); baraSfx("whoosh", 0.6, 0.18); }
    if (s.phase === "ask") {
        const p = s.asks[s.turn];
        if (prev.phase === "ask" && s.turn !== prev.turn) baraSfx("tick", 0.8);
        if (p && (p.a === me || p.b === me) && !(prev.phase === "ask" && prev.turn === s.turn && prev.round === s.round)) baraSfx("start_q", 1, 0.2);
    }
    if (s.phase === "vote" && prev.phase !== "vote") baraSfx("start_q");
    if (s.phase === "vote" && (s.voted || []).length > (prev.voted || []).length) baraSfx("tick", 0.6);
    if (s.phase === "guess" && prev.phase !== "guess") {
        baraSfx("slam"); baraSfx("reveal", 1, 0.1);
        if (s.res.out === me) baraSfx(s.res.caught ? "wrong" : "correct", 1, 0.6);
        else if (s.res.votes[me] === s.res.out) baraSfx("correct", 1, 0.6);
        else if (s.res.votes[me]) baraSfx("wrong", 1, 0.6);
    }
    if (s.phase === "result" && prev.phase !== "result") {
        const d = (s.res.delta || {})[me] || 0;
        if (s.res.out === me) baraSfx(s.res.ok ? "correct" : "wrong", 1, 0.1);
        baraSfx("applause", d > 0 ? 0.9 : 0.5, 0.4);
    }
    if (s.phase === "over" && prev.phase !== "over") { baraSfx("match_end"); baraSfx("applause", 0.8, 0.4); }
}

/* الاستماع للطاولة وقت ما الغرفة مفتوحة (room-screen.js) */
function baraWatch(on) {
    if (on && !baraUnsub && firebaseDB) {
        baraUnsub = baraRef().onSnapshot(doc => baraOnSnap(doc.exists ? doc.data() : null), () => {});
        if (!baraRetry) baraRetry = setInterval(baraFetchRole, 1500);
        baraLoadSfx();
    } else if (!on) {
        if (baraUnsub) { baraUnsub(); baraUnsub = null; }
        if (baraRetry) { clearInterval(baraRetry); baraRetry = null; }
        baraListenVotes(false); baraListenMyVote(false);
        baraClose(true);
    }
}

function baraOnSnap(s) {
    const prev = baraState;
    baraState = s;
    const me = baraMe(), act = !!(s && s.active);
    const pPhase = prev && prev.active ? prev.phase : "", nPhase = act ? s.phase : "";
    if (act && !(prev && prev.active) && s.phase === "lobby" && me !== s.hostUid && roomScreenOpen) roomToast("طاولة برا السالفة فتحت، ادخل وانضم", "users");
    /* أول جولة تنفتح الطاولة للاعبين (مرة وحدة) */
    if (act && pPhase === "lobby" && nPhase === "ask" && (s.pids || []).indexOf(me) !== -1 && roomScreenOpen && !baraIsOpen) baraOpen();
    if (act && prev && s.phase === "ask") {
        const p = s.asks[s.turn];
        if (p && (p.a === me || p.b === me) && !(prev.phase === "ask" && prev.turn === s.turn && prev.round === s.round)) { try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) {} }
    }
    baraSoundFor(prev, s);
    if (act && baraKey(s) !== baraCardKey) { baraCardKey = baraKey(s); baraCardOpen = false; baraGuessPick = ""; }
    if (!act && baraIsOpen) baraClose(true);
    if (pPhase !== nPhase || (prev && s && prev.round !== s.round) || (prev && s && (prev.pids || []).length !== (s.pids || []).length)) {
        if (typeof renderRoomUI === "function") renderRoomUI();
    }
    baraListenMyVote(act && (s.pids || []).indexOf(me) !== -1);
    baraListenVotes(act && isAdmin && (s.phase === "vote" || s.phase === "guess"));
    baraFetchRole();
    baraRender();
}

/* صوتي أنا: أشوفه بس أنا (القواعد)، فيطلع محدد في شبكة التصويت حتى لو فتحت الصفحة من جديد */
function baraListenMyVote(on) {
    if (on && !baraVoteUnsub && firebaseDB && currentUser) {
        baraVoteUnsub = baraVoteRef(currentUser.uid).onSnapshot(d => { baraMyVote = d.exists ? d.data() : null; baraRender(); }, () => {});
    } else if (!on && baraVoteUnsub) { baraVoteUnsub(); baraVoteUnsub = null; baraMyVote = null; }
}
/* المنظم: أصوات الكل (القواعد تسمح له بس)، ومنها قائمة "مين صوّت" (بدون لمين) في الوثيقة العامة */
function baraListenVotes(on) {
    if (on && !baraVotesUnsub && firebaseDB) {
        const s = baraState;
        baraVotesUnsub = firebaseDB.collection("baraVotes").where("gid", "==", s.gid).onSnapshot(snap => {
            baraVoteDocs = {};
            snap.forEach(d => { baraVoteDocs[d.id] = d.data(); });
            const cur = baraState;
            if (!cur || cur.phase !== "vote") return;
            const list = Object.keys(baraVoteDocs).filter(u => baraVoteDocs[u].round === cur.round && baraVoteDocs[u].gid === cur.gid && baraVoteDocs[u].target);
            if (JSON.stringify(cur.pids.filter(u => list.indexOf(u) !== -1)) !== JSON.stringify(cur.voted || [])) baraDo({ t: "voted", list }, true);
        }, () => {});
    } else if (!on && baraVotesUnsub) { baraVotesUnsub(); baraVotesUnsub = null; baraVoteDocs = {}; }
}

async function baraFetchRole() {
    const s = baraState, me = baraMe();
    if (!s || !s.active || !baraInRound(s, me)) return;
    const key = baraKey(s);
    if ((baraRole && baraRole.key === key) || baraRoleBusy || Date.now() - baraRoleFailAt < 2500) return;
    baraRoleBusy = true;
    try {
        const r = await baraApi({ action: "role", gid: s.gid, round: s.round });
        baraRole = Object.assign({ key }, r);
        try { sessionStorage.setItem("baraRole", JSON.stringify(baraRole)); } catch (e) {}
        baraRender();
    } catch (e) { baraRoleFailAt = Date.now(); }
    finally { baraRoleBusy = false; }
}

/* ===== المنظم: كل مرحلة بزر ===== */
async function baraHostRound() {
    const s = baraState;
    if (!isAdmin || !s || !s.active || baraHostBusy) return;
    if (s.phase !== "lobby" && s.phase !== "result") return;
    if (s.round >= s.rounds) { await baraDo({ t: "end" }); return; }
    if (s.pids.length < BARA.MIN_P) return roomToast("لازم " + BARA.MIN_P + " لاعبين على الأقل", "users");
    const round = s.round + 1;
    baraHostBusy = true; baraRender();
    try {
        const r = await baraApi({ action: "deal", gid: s.gid, round, cat: baraCatPick, pids: s.pids });
        if (r.role) {
            baraRole = Object.assign({ key: s.gid + ":" + round }, r.role);
            try { sessionStorage.setItem("baraRole", JSON.stringify(baraRole)); } catch (e) {}
        }
        await baraDo({ t: "round", round, plan: r.plan, cat: r.cat, catName: r.catName, asks: baraPairs(s.pids) });
    } catch (e) {
        roomToast("ما قدرت أبدأ الجولة: " + e.message, "alert");
    } finally { baraHostBusy = false; baraRender(); }
}
function baraHostNext() { baraDo({ t: "next" }); }
function baraHostLap() { baraDo({ t: "lap", asks: baraPairs(baraState.pids) }); }
function baraHostVote() { baraDo({ t: "vote" }); }
async function baraHostReveal() {
    const s = baraState;
    if (!isAdmin || !s || s.phase !== "vote" || baraHostBusy) return;
    baraHostBusy = true; baraRender();
    try {
        const r = await baraApi({ action: "reveal", gid: s.gid, round: s.round });
        /* الأصوات من القاعدة نفسها لحظة الكشف (مو بس من آخر تحديث وصل) */
        const snap = await firebaseDB.collection("baraVotes").where("gid", "==", s.gid).get();
        const votes = {};
        snap.forEach(d => { const v = d.data(); if (v.gid === s.gid && v.round === s.round && v.target) votes[d.id] = v.target; });
        await baraDo({ t: "reveal", votes, out: r.out, opts: r.opts });
    } catch (e) {
        roomToast("ما قدرت أكشف التصويت: " + e.message, "alert");
    } finally { baraHostBusy = false; baraRender(); }
}
/* النتيجة: السيرفر يحكم على إيصال التخمين (لو فيه)، والكلمة تنكشف للكل */
async function baraHostSettle(skip) {
    const s = baraState;
    if (!isAdmin || !s || s.phase !== "guess" || baraHostBusy) return;
    if (skip && !confirm("تتخطى تخمين " + baraName(s, s.res.out) + "؟ (ينحسب ما خمّن)")) return;
    baraHostBusy = true; baraRender();
    try {
        let receipt = "";
        if (!skip) {
            const d = await baraVoteRef(s.res.out).get();
            const v = d.exists ? d.data() : null;
            if (v && v.gid === s.gid && v.round === s.round && v.g) receipt = v.g;
        }
        const r = await baraApi(Object.assign({ action: "reveal", gid: s.gid, round: s.round }, receipt ? { receipt } : {}));
        const vd = r.verdict;
        await baraDo({ t: "settle", word: r.word, choice: vd ? vd.choice : null });
    } catch (e) {
        roomToast("ما قدرت أطلّع النتيجة: " + e.message, "alert");
    } finally { baraHostBusy = false; baraRender(); }
}
function baraHostSkip() {
    const s = baraState;
    if (!s) return;
    if (s.phase === "ask") { const p = s.asks[s.turn]; if (p && confirm("تتخطى سؤال " + baraName(s, p.a) + "؟")) baraHostNext(); }
    else if (s.phase === "vote") { if (confirm("تكشف التصويت الحين؟ اللي ما صوّت ياخذ صفر")) baraHostReveal(); }
    else if (s.phase === "guess") baraHostSettle(true);
}
function baraSetRounds(dir) { const s = baraState; if (s) baraDo({ t: "rounds", n: Math.max(1, Math.min(BARA.MAX_ROUNDS, (s.rounds || BARA.ROUNDS) + dir)) }); }
function baraPickCat(c) { baraCatPick = c === "random" || BARA_CAT_IDS.indexOf(c) !== -1 ? c : "random"; baraRender(); }

/* ===== حركات اللاعبين ===== */
async function baraCreate() {
    if (!isAdmin || !currentUser) return roomToast("المنظم بس يفتح الطاولة", "lock");
    if (baraActiveGame() && baraState.phase !== "over") return baraOpen();
    const gid = "b" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    const r = await baraDo({ t: "create", gid, name: baraMyName() });
    if (r && r.s) { baraState = r.s; baraOpen(); }
}
function baraJoin() { baraDo({ t: "join", name: baraMyName(), av: (currentUserDocData && currentUserDocData.photoURL) || "" }); }
function baraLeave() { baraDo({ t: "leave" }); }
function baraKick(uid) { if (confirm("تطلّع " + baraName(baraState, uid) + " من الطاولة؟")) baraDo({ t: "leave", uid }); }
function baraEnd() { if (confirm("تنهي اللعبة الحين؟ الترتيب يطلع على النقاط اللي معهم")) baraDo({ t: "end" }); }
function baraCloseTable() { if (confirm("تسكّر الطاولة؟")) baraDo({ t: "close" }); }
async function baraNewTable() {
    const r = await baraDo({ t: "close" }, true);
    if (r && r.s) { baraState = r.s; await baraCreate(); }
}
function baraFlip(open) { baraCardOpen = open == null ? !baraCardOpen : !!open; baraRender(); }
/* صوتي: وثيقتي في baraVotes (القواعد: أنا بس، ووقت التصويت بس، ولاعب ثاني من الطاولة) */
async function baraVote(uid) {
    const s = baraState, me = baraMe();
    if (!s || s.phase !== "vote" || uid === me || s.pids.indexOf(me) === -1 || s.pids.indexOf(uid) === -1) return;
    const prev = baraMyVote;
    baraMyVote = { gid: s.gid, round: s.round, target: uid };
    baraSfx("tick", 0.7); baraRender();
    try { await baraVoteRef(me).set({ gid: s.gid, round: s.round, target: uid }); }
    catch (e) { baraMyVote = prev; baraRender(); roomToast("ما انحفظ صوتك، جرّب مرة ثانية", "alert"); }
}
function baraPickGuess(w) { baraGuessPick = String(w); baraRender(); }
async function baraSendGuess() {
    const s = baraState, me = baraMe();
    if (!s || s.phase !== "guess" || !s.res || s.res.out !== me || !baraGuessPick) return;
    try {
        const r = await baraApi({ action: "guess", gid: s.gid, round: s.round, choice: baraGuessPick });
        const v = baraMyVote && baraMyVote.gid === s.gid && baraMyVote.round === s.round ? baraMyVote.target || null : null;
        await baraVoteRef(me).set({ gid: s.gid, round: s.round, target: v, g: r.receipt });
        baraGuessSent = baraKey(s) + "|" + baraGuessPick;
        try { sessionStorage.setItem("baraGuess", baraGuessSent); } catch (e) {}
        baraSfx("tick"); baraRender();
    } catch (e) { roomToast("ما وصل تخمينك: " + e.message, "alert"); }
}
function baraMyGuess(s) { const p = baraGuessSent.split("|"); return p[0] === baraKey(s) ? p.slice(1).join("|") : ""; }

function baraMic() {
    if (!currentUser) return roomToast("سجّل دخولك أول", "lock");
    const mics = roomState.mics || [];
    if (mics.some(m => m && m.uid === currentUser.uid)) { onMicButton(); return; }
    const free = mics.findIndex((m, i) => !m && i !== HOST_SEAT);
    if (free === -1) return roomToast("المايكات مليانة", "mic-off");
    takeMicSlot(free);
}

/* ===== الواجهة ===== */
function baraOpen() {
    if (!baraActiveGame()) return;
    let el = document.getElementById("baraScreen");
    if (!el) {
        el = document.createElement("div");
        el.id = "baraScreen";
        el.className = "bara-screen";
        el.setAttribute("role", "dialog");
        el.setAttribute("aria-label", "برا السالفة");
        document.body.appendChild(el);
    }
    /* زر الرجوع في الجوال يسكّر الطاولة بس ويرجعك للغرفة (app.js popstate) */
    if (!baraIsOpen) { try { window.history.pushState({ roomOpen: true, baraOpen: true }, ""); } catch (e) {} }
    baraIsOpen = true; baraLastHTML = "";
    el.classList.add("open");
    document.body.classList.add("bara-open");
    baraUnlockAudio(); baraLoadSfx();
    baraRender();
}
function baraClose(fromPop) {
    if (!fromPop && baraIsOpen && window.history.state && window.history.state.baraOpen) { window.history.back(); return; }
    baraIsOpen = false; baraRulesOpen = false; baraLastHTML = "";
    const el = document.getElementById("baraScreen");
    if (el) { el.classList.remove("open"); el.innerHTML = ""; }
    document.body.classList.remove("bara-open");
}
function baraToggleRules() { baraRulesOpen = !baraRulesOpen; baraRender(); }

/* شريط الطاولة في الغرفة (room.js renderRoomUI) */
function baraRoomPill() {
    const s = baraState;
    if (!s || !s.active || !roomState.isLive) return "";
    const t = s.phase === "lobby" ? "مفتوحة للانضمام (" + s.pids.length + "/" + BARA.MAX_P + ")" : s.phase === "over" ? "انتهت، شوف الترتيب" : "الجولة " + s.round + " من " + s.rounds;
    return `<button class="som-pill bara-pill" onclick="baraOpen()"><span class="som-pill-dot"></span><span class="som-pill-t"><b>برا السالفة</b> · ${escapeHTML(t)}</span><span class="som-pill-go">افتح ${ic("chevron-right")}</span></button>`;
}

function baraAv(s, uid, cls) {
    const p = s.players[uid] || {};
    const url = p.av || getPlayerAvatar(p.name || "?").url;
    return `<img class="${cls || "bara-av"}" src="${safeSrc(cdnThumb(url))}" alt="" loading="lazy">`;
}

/* بطاقة الدور: مقلوبة لين تلمسها، وفيها زر "خبّ الكلمة" */
function baraCardHTML(s) {
    const me = baraMe();
    if (!baraInRound(s, me)) return "";
    const r = baraRole && baraRole.key === baraKey(s) ? baraRole : null;
    let back;
    if (!r) back = `<div class="bara-role-t">لحظة...</div><div class="bara-role-s">دورك يوصل الحين</div>`;
    else if (r.out) back = `<div class="bara-role-k">أنت</div><div class="bara-role-t out">برا السالفة</div><div class="bara-role-s">التصنيف: <b>${escapeHTML(r.catName)}</b> · اسمع أسئلتهم وحاول تعرف السالفة بدون ما تنكشف</div>`;
    else back = `<div class="bara-role-k">داخل السالفة · ${escapeHTML(r.catName)}</div><div class="bara-role-t">${escapeHTML(r.word)}</div><div class="bara-role-s">لا تقولها! اسأل وجاوب بحيث اللي برا السالفة ما يفهم</div>`;
    return `<div class="bara-card${baraCardOpen ? " open" : ""}">
<div class="bara-card-in">
<button class="bara-face front" onclick="baraFlip(true)" aria-label="اضغط وشوف دورك">${ic("lock")}<b>اضغط وشوف دورك</b><span>خلّ محد يشوف شاشتك</span></button>
<div class="bara-face back${r && r.out ? " is-out" : ""}">${back}<button class="bara-hide" onclick="baraFlip(false)">${ic("lock")} خبّ الكلمة</button></div>
</div></div>`;
}

function baraPlayersHTML(s, opts) {
    opts = opts || {};
    if (!s.pids.length) return `<div class="bara-empty">${ic("users")} ما أحد انضم للحين</div>`;
    const me = baraMe(), rank = opts.rank ? baraRanking(s) : null;
    const list = rank || s.pids;
    return `<div class="bara-grid${opts.small ? " small" : ""}">${list.map((u, i) => {
        const p = s.players[u] || {}, cls = ["bara-tile"];
        if (u === me) cls.push("me");
        if (rank && i === 0 && (p.score || 0) > 0) cls.push("win");
        const kick = isAdmin && s.phase === "lobby" && u !== me ? `<button class="bara-x" onclick="baraKick(${jsArg(u)})" aria-label="طلّع ${escapeHTML(p.name || "")}">${ic("x")}</button>` : "";
        const sub = opts.scores ? `<span class="bara-pts">${p.score || 0}</span>` : u === s.hostUid && s.phase === "lobby" ? `<span class="bara-tag">المنظم</span>` : "";
        return `<div class="${cls.join(" ")}">${rank ? `<span class="bara-rank">${i + 1}</span>` : ""}${baraAv(s, u)}${kick}<span class="bara-nm">${escapeHTML(p.name || "لاعب")}</span>${sub}</div>`;
    }).join("")}</div>`;
}

function baraCatsHTML() {
    const chip = (id, n) => `<button class="bara-chip${baraCatPick === id ? " on" : ""}" onclick="baraPickCat(${jsArg(id)})">${escapeHTML(n)}</button>`;
    return `<div class="bara-cats">${chip("random", "عشوائي")}${BARA_CATS.map(c => chip(c[0], c[1])).join("")}</div>`;
}

/* مين يسأل مين */
function baraAskHTML(s) {
    const me = baraMe(), done = s.turn >= s.asks.length, n = s.pids.length;
    const lapN = Math.min(s.laps, Math.floor(s.turn / n) + 1), inLap = done ? n : (s.turn % n) + 1;
    if (done) return `<div class="bara-panel"><div class="bara-p-t">خلصت ${s.laps > 1 ? "الدورة " + s.laps : "دورة الأسئلة"}</div><div class="bara-p-s">${isAdmin ? "ابدأ التصويت، أو زيد دورة أسئلة ثانية" : "ننتظر المنظم يبدأ التصويت"}</div></div>`;
    const { a, b } = s.asks[s.turn];
    const t = a === me ? "دورك تسأل " + baraName(s, b) : b === me ? baraName(s, a) + " يسألك" : baraName(s, a) + " يسأل " + baraName(s, b);
    return `<div class="bara-panel ask${a === me || b === me ? " mine" : ""}">
<div class="bara-ask">
<div class="bara-ask-p">${baraAv(s, a, "bara-av lg")}<span>${escapeHTML(baraName(s, a))}</span><small>يسأل</small></div>
<div class="bara-ask-arrow">${ic("chevron-right")}</div>
<div class="bara-ask-p">${baraAv(s, b, "bara-av lg")}<span>${escapeHTML(baraName(s, b))}</span><small>يجاوب</small></div>
</div>
<div class="bara-p-t">${escapeHTML(t)}</div>
<div class="bara-p-s">سؤال ${inLap} من ${n}${s.laps > 1 ? " · الدورة " + lapN : ""} · اسأل بالمايك عن السالفة</div>
</div>`;
}

/* شبكة التصويت: صور اللاعبين (غيري) */
function baraVoteHTML(s) {
    const me = baraMe(), playing = s.pids.indexOf(me) !== -1;
    const mine = baraMyVote && baraMyVote.gid === s.gid && baraMyVote.round === s.round ? baraMyVote.target : "";
    const voted = s.voted || [];
    const tiles = s.pids.filter(u => u !== me).map(u => {
        const cls = ["bara-tile", "vote"];
        if (mine === u) cls.push("picked");
        const done = voted.indexOf(u) !== -1;
        const inner = `${baraAv(s, u)}<span class="bara-nm">${escapeHTML(baraName(s, u))}</span>${done ? `<span class="bara-done" aria-label="صوّت">${ic("check")}</span>` : ""}${mine === u ? `<span class="bara-pick">صوتك</span>` : ""}`;
        return playing ? `<button class="${cls.join(" ")}" onclick="baraVote(${jsArg(u)})">${inner}</button>` : `<div class="${cls.join(" ")}">${inner}</div>`;
    }).join("");
    return `<div class="bara-panel"><div class="bara-p-t">${playing ? (mine ? "صوّت على " + escapeHTML(baraName(s, mine)) : "مين برا السالفة؟") : "يصوّتون الحين"}</div>
<div class="bara-p-s">${playing ? "تقدر تغيّر صوتك لين المنظم يكشف · " : ""}صوّت ${voted.length} من ${s.pids.length}</div></div>
<div class="bara-grid vote">${tiles}</div>`;
}

/* الكشف: الأصوات لكل واحد، واللي برا السالفة */
function baraTallyHTML(s) {
    const r = s.res, max = Math.max(1, ...Object.values(r.tally || {}));
    const order = s.pids.slice().sort((a, b) => (r.tally[b] || 0) - (r.tally[a] || 0));
    return `<div class="bara-tally">${order.map(u => {
        const n = r.tally[u] || 0, out = u === r.out;
        const voters = Object.keys(r.votes).filter(v => r.votes[v] === u).map(v => baraName(s, v)).join("، ");
        return `<div class="bara-trow${out ? " out" : ""}">${baraAv(s, u, "bara-av sm")}<div class="bara-tmid"><span class="bara-tn">${escapeHTML(baraName(s, u))}${out ? ` <em>برا السالفة</em>` : ""}</span><div class="bara-bar"><i style="width:${Math.round(n / max * 100)}%"></i></div>${voters ? `<small>${escapeHTML(voters)}</small>` : ""}</div><b>${n}</b></div>`;
    }).join("")}</div>`;
}

function baraGuessHTML(s) {
    const me = baraMe(), r = s.res, sent = baraMyGuess(s);
    const head = `<div class="bara-panel ${r.caught ? "caught" : "escaped"}"><div class="bara-p-t">${r.caught ? "انكشف! " : ""}${escapeHTML(baraName(s, r.out))} برا السالفة${r.caught ? "" : " وما انكشف!"}</div>
<div class="bara-p-s">${r.out === me ? (sent ? "خمّنت: " + escapeHTML(sent) + " · ننتظر المنظم يطلّع النتيجة" : "خمّن السالفة من الخيارات") : escapeHTML(baraName(s, r.out)) + " يخمّن السالفة الحين"}</div></div>`;
    let guess = "";
    if (r.out === me && !sent) {
        guess = `<div class="bara-opts">${r.opts.map(w => `<button class="bara-opt${baraGuessPick === w ? " on" : ""}" onclick="baraPickGuess(${jsArg(w)})">${escapeHTML(w)}</button>`).join("")}</div>
<button class="som-b gold" onclick="baraSendGuess()" ${baraGuessPick ? "" : "disabled"}>${ic("send")} ${baraGuessPick ? "أرسل: " + escapeHTML(baraGuessPick) : "اختار كلمة"}</button>`;
    }
    return head + guess + baraTallyHTML(s);
}

function baraResultHTML(s) {
    const r = s.res, me = baraMe(), d = r.delta || {};
    const g = r.choice == null ? "ما خمّن" : r.ok ? "خمّن صح: " + r.choice : "خمّن غلط: " + r.choice;
    const gained = s.pids.filter(u => d[u]).map(u => `<span class="bara-gain${u === me ? " me" : ""}">${escapeHTML(baraName(s, u))} +${d[u]}</span>`).join("");
    return `<div class="bara-panel word"><div class="bara-p-k">السالفة كانت</div><div class="bara-word">${escapeHTML(r.word)}</div>
<div class="bara-p-s">${escapeHTML(baraName(s, r.out))} برا السالفة · ${r.caught ? "انكشف" : "ما انكشف"} · ${escapeHTML(g)}</div>
${gained ? `<div class="bara-gains">${gained}</div>` : `<div class="bara-p-s">ما أحد كسب نقاط بهالجولة</div>`}</div>
<div class="bara-sec">الترتيب</div>${baraPlayersHTML(s, { rank: true, scores: true, small: true })}`;
}

function baraBodyHTML(s) {
    const me = baraMe(), playing = s.pids.indexOf(me) !== -1;
    if (s.phase === "lobby") {
        return `<div class="bara-panel"><div class="bara-p-t">طاولة جديدة</div><div class="bara-p-s">${s.pids.length} من ${BARA.MAX_P} لاعبين · ${s.rounds} جولات · لازم ${BARA.MIN_P} على الأقل</div></div>${baraPlayersHTML(s)}`;
    }
    if (s.phase === "over") {
        const top = baraRanking(s)[0];
        return `<div class="bara-panel word"><div class="bara-p-k">انتهت اللعبة</div><div class="bara-word">${top ? escapeHTML(baraName(s, top)) : ""}</div><div class="bara-p-s">الفايز بـ ${top ? (s.players[top].score || 0) : 0} نقطة</div></div>${baraPlayersHTML(s, { rank: true, scores: true, small: true })}`;
    }
    let h = playing ? baraCardHTML(s) : `<div class="bara-panel"><div class="bara-p-t">تتفرج</div><div class="bara-p-s">التصنيف: ${escapeHTML(s.catName)}</div></div>`;
    if (s.phase === "ask") h += baraAskHTML(s);
    else if (s.phase === "vote") h += baraVoteHTML(s);
    else if (s.phase === "guess") h += baraGuessHTML(s);
    else if (s.phase === "result") h += baraResultHTML(s);
    return h;
}

function baraActHTML(s) {
    const me = baraMe(), playing = s.pids.indexOf(me) !== -1;
    let h = "";
    if (s.phase === "lobby") {
        if (!currentUser) h = `<div class="som-note">سجّل دخولك عشان تلعب</div>`;
        else if (playing) h = `<button class="som-b ghost" onclick="baraLeave()">طلّعني من الطاولة</button>`;
        else h = `<button class="som-b gold" onclick="baraJoin()" ${s.pids.length >= BARA.MAX_P ? "disabled" : ""}>${ic("plus")} انضم للطاولة</button>`;
    }
    if (isAdmin) {
        if (s.phase === "lobby" || (s.phase === "result" && s.round < s.rounds)) {
            if (s.phase === "lobby") h += `<div class="bara-rounds"><span>عدد الجولات</span><button class="som-step sm" onclick="baraSetRounds(-1)" aria-label="أقل">−</button><b>${s.rounds}</b><button class="som-step sm" onclick="baraSetRounds(1)" aria-label="أكثر">+</button></div>`;
            h += `<div class="bara-sec">تصنيف الجولة ${s.round + 1}</div>${baraCatsHTML()}`;
            h += `<button class="som-b brand" onclick="baraHostRound()" ${s.pids.length >= BARA.MIN_P && !baraHostBusy ? "" : "disabled"}>${ic("rocket")} ${s.phase === "lobby" ? "ابدأ الجولة الأولى (" + s.pids.length + " لاعبين)" : "الجولة الجاية (" + (s.round + 1) + " من " + s.rounds + ")"}</button>`;
        } else if (s.phase === "result") h += `<button class="som-b brand" onclick="baraHostRound()">${ic("trophy")} الترتيب النهائي</button>`;
        else if (s.phase === "ask") {
            if (s.turn < s.asks.length) h += `<button class="som-b brand" onclick="baraHostNext()">${ic("chevron-right")} التالي</button>`;
            else h += `<div class="som-btns"><button class="som-b brand" onclick="baraHostVote()">${ic("users")} ابدأ التصويت</button><button class="som-b ghost" onclick="baraHostLap()">${ic("plus")} دورة ثانية</button></div>`;
        } else if (s.phase === "vote") h += `<button class="som-b gold" onclick="baraHostReveal()" ${baraHostBusy ? "disabled" : ""}>${ic("zap")} اكشف التصويت</button>`;
        else if (s.phase === "guess") h += `<button class="som-b gold" onclick="baraHostSettle(false)" ${baraHostBusy ? "disabled" : ""}>${ic("check")} النتيجة</button>`;
        let b = "";
        if (["ask", "vote", "guess"].indexOf(s.phase) !== -1) b += `<button onclick="baraHostSkip()">${ic("chevron-right")} تخطّى</button>`;
        if (s.phase === "over") b += `<button onclick="baraNewTable()">${ic("plus")} طاولة جديدة</button><button onclick="baraCloseTable()">${ic("x")} سكّر الطاولة</button>`;
        else if (s.phase === "lobby") b += `<button onclick="baraCloseTable()">${ic("x")} إلغاء الطاولة</button>`;
        else b += `<button onclick="baraEnd()">${ic("power")} إنهاء اللعبة</button>`;
        h += `<div class="som-host">${b}</div>`;
    } else if (s.phase !== "lobby" && s.phase !== "over" && !(s.phase === "guess" && s.res && s.res.out === me && !baraMyGuess(s))) {
        const wait = { ask: "المنظم يمشّي الأسئلة", vote: "المنظم يكشف التصويت لما يخلصون", guess: "ننتظر التخمين", result: "ننتظر المنظم يبدأ الجولة الجاية" }[s.phase];
        if (wait) h += `<div class="som-note">${wait}</div>`;
    }
    return h;
}

function baraRulesHTML() {
    return `<div class="som-rules" role="document" onclick="if(event.target===this)baraToggleRules()">
<div class="som-rules-in">
<div class="som-rules-h"><b>طريقة اللعب</b><button class="som-ic" onclick="baraToggleRules()" aria-label="سكّر">${ic("x")}</button></div>
<ol>
<li>كل جولة المنظم يختار تصنيف، وكل واحد يشوف دوره على جواله: <b>داخل السالفة</b> ويشوف الكلمة، أو <b>برا السالفة</b> ويعرف التصنيف بس.</li>
<li><b>الأسئلة:</b> بالدور، كل واحد يسأل واحد ثاني بالمايك عن السالفة. اللي داخلها يجاوب بحيث ما يفضحها، واللي برا يحاول يفهم بدون ما ينكشف.</li>
<li><b>التصويت:</b> كل واحد يصوّت سراً على اللي يظن إنه برا السالفة، ويقدر يغيّر صوته لين المنظم يكشف.</li>
<li><b>الكشف:</b> لو أكثر واحد انصوّت عليه هو اللي برا السالفة انكشف، ولو غيره أو تعادل ما انكشف. وبالحالتين يخمّن السالفة من 8 خيارات.</li>
</ol>
<h4>النقاط</h4>
<ul><li>صوّتت صح: +${BARA.VOTE}</li><li>برا السالفة وما انكشفت: +${BARA.ESCAPE}</li><li>خمّنت السالفة صح: +${BARA.GUESS}</li><li>ما صوّتت: صفر</li></ul>
<p>ما فيه وقت: المنظم يمشّي كل مرحلة. والأكثر نقاط بعد آخر جولة يفوز.</p>
</div></div>`;
}

function baraMicBtn() {
    if (!currentUser) return "";
    const seat = (roomState.mics || []).findIndex(m => m && m.uid === currentUser.uid);
    if (seat === -1) return `<button class="som-ic dim" onclick="baraMic()" aria-label="اطلع على المايك">${ic("mic")}</button>`;
    const muted = roomState.mics[seat].muted;
    return `<button class="som-ic ${muted ? "off" : "on"}" onclick="baraMic()" aria-label="${muted ? "شغّل المايك" : "اكتم المايك"}">${ic(muted ? "mic-off" : "mic")}</button>`;
}

function baraRender() {
    const el = document.getElementById("baraScreen");
    if (!el || !baraIsOpen) return;
    const s = baraState;
    if (!s || !s.active) { baraClose(true); return; }
    const sub = s.phase === "lobby" ? "قبل البداية" : s.phase === "over" ? "النتيجة النهائية" : "الجولة " + s.round + " من " + s.rounds + " · " + s.catName;
    const html = `
<div class="som-top">
<button class="som-ic" onclick="baraClose()" aria-label="رجوع للغرفة">${ic("chevron-right")}</button>
<div class="som-title"><b>برا السالفة</b><span>${escapeHTML(sub)}</span></div>
<div class="som-top-btns">${baraMicBtn()}<button class="som-ic" onclick="baraToggleRules()" aria-label="طريقة اللعب">${ic("book")}</button></div>
</div>
<div class="bara-body">${baraBodyHTML(s)}</div>
<div class="bara-act">${baraActHTML(s)}</div>
${baraRulesOpen ? baraRulesHTML() : ""}`;
    if (html === baraLastHTML) return;
    const sc = el.querySelector(".bara-body"), keep = sc ? sc.scrollTop : 0;
    baraLastHTML = html;
    el.innerHTML = html;
    const nb = el.querySelector(".bara-body");
    if (nb) nb.scrollTop = keep;
}
