/* استوديو المسابقات: الإحصائيات، المقدم، الساعة، المخرج، التوقعات، الرابط، التفاعلات */
/* =====================================================================
   استوديو برنامج المسابقات
   - بيانات المتسابقين الحقيقية (الترتيب، الانتصارات، آخر 3 نتائج، آخر لقاء)
   - المقدم: جمل متنوعة حسب السياق (نفس الجملة على كل الأجهزة لأن الاختيار ثابت حسب اللحظة)
   - سؤال الحسم، الفوز الساحق، العودة، أفضل لحظة في الجولة
   - شريط الأخبار، ساعة البث، تفاعلات المشاهدين
   ===================================================================== */
const BC_AR_NUM_F = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة", "التاسعة", "العاشرة"];
function bcHash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function bcPick(arr, key) { return arr[bcHash(key) % arr.length]; }
function bcFill(t, v) { return t.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : "")); }
function bcSec(ms) { return (Math.round(ms / 100) / 10).toFixed(1); }

/* ترتيب الدوري من النتائج الحقيقية */
function bcStandings() {
    const st = {};
    const row = n => st[n] || (st[n] = { name: n, w: 0, d: 0, l: 0, pts: 0, gf: 0, ga: 0 });
    (typeof players !== "undefined" ? players : []).forEach(p => row(p.name));
    (typeof matches !== "undefined" ? matches : []).forEach(m => {
        if (m.s1 === "" || m.s2 === "") return;
        const a = Number(m.s1), b = Number(m.s2);
        if (isNaN(a) || isNaN(b)) return;
        [[m.p1.name, a, b], [m.p2.name, b, a]].forEach(([n, x, y]) => {
            const r = row(n); r.gf += x; r.ga += y;
            if (x > y) { r.w++; r.pts += 3; } else if (x < y) r.l++; else { r.d++; r.pts++; }
        });
    });
    return Object.values(st).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
}
function bcPlayerInfo(name, tab) {
    tab = tab || bcStandings();
    const i = tab.findIndex(r => r.name === name);
    const r = tab[i] || { w: 0, d: 0, l: 0, pts: 0 };
    const played = matches.filter(m => m.s1 !== "" && m.s2 !== "" && (m.p1.name === name || m.p2.name === name))
        .sort((a, b) => Number(b.round) - Number(a.round));
    const last = played.slice(0, 3).map(m => {
        const me = m.p1.name === name, x = Number(me ? m.s1 : m.s2), y = Number(me ? m.s2 : m.s1);
        return x > y ? "w" : (x < y ? "l" : "d");
    });
    return { rank: i + 1, w: r.w, d: r.d, l: r.l, pts: r.pts, last, played: played.length };
}
function bcLastMeeting(a, b, round) {
    const ms = matches.filter(m => m.s1 !== "" && m.s2 !== "" && Number(m.round) !== Number(round) &&
        ((m.p1.name === a && m.p2.name === b) || (m.p1.name === b && m.p2.name === a)))
        .sort((x, y) => Number(y.round) - Number(x.round));
    if (!ms.length) return null;
    const m = ms[0], x = Number(m.s1), y = Number(m.s2);
    return { winner: x > y ? m.p1.name : (x < y ? m.p2.name : ""), round: m.round };
}
/* سياق المواجهة: ثأر، قمة، متصدر */
function bcMatchContext(d) {
    const o = bcCur(d);
    if (!o) return null;
    const tab = bcStandings();
    const a = bcPlayerInfo(o.p1, tab), b = bcPlayerInfo(o.p2, tab);
    const lm = bcLastMeeting(o.p1, o.p2, d.round);
    if (lm && lm.winner) {
        const loser = lm.winner === o.p1 ? o.p2 : o.p1;
        return { k: "revenge", t: `مواجهة ثأر! ${lm.winner} فاز بآخر لقاء بينهم، فهل ينتقم ${loser}؟` };
    }
    if (a.pts + b.pts > 0 && ((a.rank === 1 && b.rank === 2) || (a.rank === 2 && b.rank === 1))) return { k: "top", t: "قمة الجولة بين المتصدر والوصيف!" };
    if (a.rank === 1 && a.pts > 0) return { k: "leader", t: `${o.p1} متصدر الدوري، فهل يحافظ على صدارته؟` };
    if (b.rank === 1 && b.pts > 0) return { k: "leader", t: `${o.p2} متصدر الدوري، فهل يحافظ على صدارته؟` };
    return null;
}

/* النقاط قبل السؤال الحالي (عشان لحظة الكشف ما تغيّر حالة الحسم) */
function bcPreScores(d) {
    let s1 = d.s1 || 0, s2 = d.s2 || 0;
    if (d.phase === "reveal" && d.outcome === 1) s1--;
    if (d.phase === "reveal" && d.outcome === 2) s2--;
    return [s1, s2];
}
/* سؤال الحسم: آخر سؤال والفرق نقطة أو تعادل */
function bcIsGolden(d) { return !!d && d.status === "live" && d.scene === "playing" && (d.golden || 0) > 0 && d.qIndex >= LIVE_Q_COUNT; }
function bcIsDecider(d) {
    if (bcIsGolden(d)) return true;
    const n = (d.questions || []).length;
    if (!d || d.status !== "live" || d.scene !== "playing" || !n || d.qIndex !== n - 1) return false;
    const [a, b] = bcPreScores(d);
    return Math.abs(a - b) <= 1;
}
/* نوع الفوز: ساحق (فرق 3+) أو عودة (كان متأخر بنقطتين وفاز) */
function bcWinKind(it) {
    const a = it.s1 || 0, b = it.s2 || 0;
    if (a === b) return "";
    const w = a > b ? 1 : 2;
    if ((it["bh" + w] || 0) >= 2) return "comeback";
    if (Math.abs(a - b) >= 3) return "big";
    return "";
}
/* أفضل لحظة في الجولة: أسرع ضغطة جرس + أكبر فوز */
function bcBestMoment(d) {
    let fast = null, big = null;
    (d.order || []).forEach(o => {
        if (o.state !== "done") return;
        [1, 2].forEach(n => {
            const ms = o["fb" + n];
            if (ms > 0 && (!fast || ms < fast.ms)) fast = { name: n === 1 ? o.p1 : o.p2, ms };
        });
        const m = Math.abs((o.s1 || 0) - (o.s2 || 0));
        if (m > 0 && (!big || m > big.m)) big = { m, w: (o.s1 || 0) > (o.s2 || 0) ? o.p1 : o.p2, a: Math.max(o.s1 || 0, o.s2 || 0), b: Math.min(o.s1 || 0, o.s2 || 0) };
    });
    return { fast, big };
}

/* ===== المقدم ===== */
const BC_HOST = {
    open: [
        "أهلاً وسهلاً بكم في بث مباشر جديد من دوري بنو مسروح للنخبة. الجولة {r}، والليلة عندنا {n} مواجهات، فاستعدوا!",
        "مساء الخير، ومعكم البث المباشر للجولة {r} من دوري بنو مسروح للنخبة. {n} مواجهات بانتظاركم، والأسرع على الجرس هو اللي يكسب.",
        "أهلاً بكم في استوديو دوري بنو مسروح للنخبة. الجولة {r} بدأت، وعندنا الليلة {n} مواجهات مليانة تحدي."
    ],
    intro: ["المواجهة {ord}: {p1} ضد {p2}.", "ننتقل للمواجهة {ord}، بين {p1} و{p2}.", "حياكم في المواجهة {ord}. {p1} في مواجهة {p2}."],
    introTail: ["مين بيكون الأسرع على الجرس؟", "خمسة أسئلة تفصل بين الفوز والخسارة.", "التركيز مطلوب من أول سؤال."],
    q: ["السؤال {ord}. {t}", "السؤال {ord}، ركزوا معي. {t}", "وهذا السؤال {ord}. {t}"],
    qTense: ["السؤال الجاي ممكن يغيّر كل شي. السؤال {ord}. {t}", "النتيجة متقاربة، والسؤال {ord} مهم جداً. {t}"],
    golden: ["تعادل! وصلنا للسؤال الذهبي، واللي يجاوب صح أول يفوز بالمواجهة. {t}", "السؤال الذهبي! أول إجابة صحيحة تحسم المواجهة. {t}"],
    decider: ["سؤال الحسم! هذا السؤال يحدد مصير المواجهة. {t}", "وصلنا لسؤال الحسم، والإجابة الصحيحة تقرر كل شي. {t}"],
    reveal: ["والإجابة الصحيحة هي: {a}.", "الإجابة الصحيحة: {a}.", "والجواب الصحيح هو: {a}."],
    /* جمل الموقف بعد الجواب ({p} اسم اللي جاوب). الذكاء الاصطناعي يكتب غيرها لكل جولة (aiLines.situ)، وهذي احتياط */
    situ: {
        streak: ["{p} على نار! ثلاث إجابات ورا بعض.", "{p} ما يوقفه أحد الليلة!"],
        comeback: ["{p} يرجع للمواجهة بقوة!", "ما استسلم {p}، ورجع من بعيد!"],
        tie: ["وتعادل في الأجوبة!", "ورجعنا للتعادل!"],
        lead: ["و{p} يتقدم الحين!", "{p} يخطف الصدارة في هذي المواجهة!"]
    },
    win: ["نهاية المواجهة. الفوز لـ {w} بنتيجة {a} مقابل {b}.", "انتهت المواجهة، و{w} يفوز {a} مقابل {b}. مبروك!"],
    big: ["فوز ساحق لـ {w} بنتيجة {a} مقابل {b}!"],
    comeback: ["عودة تاريخية! {w} يقلب الطاولة ويفوز {a} مقابل {b}!"],
    tie: ["نهاية المواجهة بالتعادل، {a} مقابل {a}."],
    close: ["وبكذا نختم الجولة {r}. {best} شكراً لمتابعتكم، ونلقاكم في الجولة الجاية.", "نهاية بث الجولة {r}. {best} شكراً لكم، وإلى اللقاء."]
};
function bcQText(d, i, plain) {
    const q = (d.questions || [])[i];
    if (!q) return "";
    const v = { ord: BC_AR_NUM[i] || (i + 1), t: q.text };
    const key = "q" + d.round + ":" + d.cur + ":" + i;
    if (i >= LIVE_Q_COUNT) return bcFill(bcPick(BC_HOST.golden, key), v);
    if (!plain && d.qIndex === i && bcIsDecider(d)) return bcFill(bcPick(BC_HOST.decider, key), v);
    if (!plain && i >= 2 && d.qIndex === i) {
        const [a, b] = bcPreScores(d);
        if (Math.abs(a - b) <= 1 && bcHash(key + "t") % 2 === 0) return bcFill(bcPick(BC_HOST.qTense, key), v);
    }
    return bcFill(bcPick(BC_HOST.q, key), v);
}
function bcRevealText(d, i, plain) {
    const q = (d.questions || [])[i];
    if (!q) return "";
    /* بدون إضافات: نفس النص اللي جهّزه جهاز المنظم مسبقاً (bcPrefetchVoice)، والموقف جملة لحالها (bcSituText) */
    const a = bcAnswerOf(d, i);
    if (!a) return "";   /* الجواب مختوم وما انكشف للحين */
    return bcFill(bcPick(BC_HOST.reveal, "a" + d.round + ":" + d.cur + ":" + i), { a: a.split("|")[0] });
}
/* جملة الموقف بعد كشف جواب صح: رجوع من خسارة، تعادل، تقدّم، أو سلسلة (3 إجابات ورا بعض). نفس الجملة على كل الأجهزة (bcPick ثابت) */
function bcSituKind(d) {
    if (!d || d.phase !== "reveal" || !d.outcome) return "";
    const n = d.outcome, s = [0, d.s1 || 0, d.s2 || 0], pre = [0].concat(bcPreScores(d)), o = n === 1 ? 2 : 1;
    if ((d["bh" + n] || 0) >= 2 && s[n] >= s[o] && pre[n] < pre[o]) return "comeback";
    if (s[n] === s[o]) return "tie";
    if (s[n] > s[o] && pre[n] <= pre[o]) return "lead";
    const log = d.log || [];
    let run = 0; for (let i = d.qIndex; i >= 0 && log[i] === n; i--) run++;
    return run >= 3 ? "streak" : "";
}
function bcSituText(d) {
    const k = bcSituKind(d), o = bcCur(d);
    if (!k || !o) return "";
    const ai = ((d.aiLines || {}).situ || {})[k];
    const list = Array.isArray(ai) && ai.length ? ai : BC_HOST.situ[k];
    return bcFill(bcPick(list, "s" + k + d.round + ":" + d.cur + ":" + d.qIndex), { p: d.outcome === 1 ? o.p1 : o.p2 });
}

function bcResultText(d) {
    const o = bcCur(d);
    if (!o) return "";
    const it = Object.assign({}, (d.order || [])[d.cur] || {}, { s1: d.s1 || 0, s2: d.s2 || 0, bh1: d.bh1, bh2: d.bh2 });
    const a = Math.max(it.s1, it.s2), b = Math.min(it.s1, it.s2), key = "r" + d.round + ":" + d.cur;
    if (it.s1 === it.s2) return bcFill(bcPick(BC_HOST.tie, key), { a });
    const w = it.s1 > it.s2 ? o.p1 : o.p2, kind = bcWinKind(it);
    return bcFill(bcPick(kind === "comeback" ? BC_HOST.comeback : (kind === "big" ? BC_HOST.big : BC_HOST.win), key), { w, a, b });
}
function bcCloseText(d) {
    const bm = bcBestMoment(d);
    const best = bm.fast ? `أفضل لحظة الليلة: أسرع ضغطة جرس كانت لـ ${bm.fast.name} في ${bcSec(bm.fast.ms)} ثانية.` : "";
    const ai = (d.aiLines || {}).close;   /* جملة ختام من الذكاء الاصطناعي (js/ai.js) */
    if (ai) return `${ai} ${best} شكراً لمتابعتكم، ونلقاكم في الجولة الجاية.`.replace(/\s+/g, " ");
    return bcFill(bcPick(BC_HOST.close, "c" + d.round), { r: d.round, best });
}

/* ===== ساعة البث وشريط الأخبار ===== */
function bcAirClock(d) {
    const el = document.getElementById("bcAirClock");
    if (!el || !d) return;
    const start = Number(d.startedAt) || bcTsMs(d.createdAt) || Number(d.startAt) || Number(d.sceneAt) || bcNow();
    const s = Math.max(0, Math.floor((bcNow() - start) / 1000));
    const p = n => String(n).padStart(2, "0");
    const t = s >= 3600 ? `${Math.floor(s / 3600)}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}` : `${p(Math.floor(s / 60))}:${p(s % 60)}`;
    if (el.textContent !== t) el.textContent = t;
}
let bcTickerSig = "";
function bcTicker(d) {
    const scr = document.getElementById("liveScreen");
    if (!scr) return;
    let el = document.getElementById("stTicker");
    const show = !!(d && d.status === "live");
    if (!show) { if (el) el.remove(); bcTickerSig = ""; return; }
    const items = [];
    (d.order || []).forEach(o => { if (o.state === "done") items.push(`${ic("check-circle")} ${escapeHTML(o.p1)} <b>${o.s1 || 0} - ${o.s2 || 0}</b> ${escapeHTML(o.p2)}`); });
    const tab = bcStandings().slice(0, 5);
    if (tab.some(r => r.pts > 0)) items.push(`${ic("trophy")} الترتيب: ` + tab.map((r, i) => `${i + 1}. ${escapeHTML(r.name)} <b>${r.pts}</b>`).join(" · "));
    const nx = (d.order || []).find((o, i) => o.state === "pending" && i !== d.cur);
    if (nx) items.push(`${ic("zap")} المواجهة الجاية: ${escapeHTML(nx.p1)} ضد ${escapeHTML(nx.p2)}`);
    items.unshift(...showStats(d));
    items.push(`دوري بنو مسروح للنخبة · الجولة ${escapeHTML(String(d.round))} · بث مباشر`);
    const sig = items.join("|");
    if (sig === bcTickerSig && el) return;
    bcTickerSig = sig;
    if (!el) { el = document.createElement("div"); el.id = "stTicker"; el.className = "st-ticker"; scr.appendChild(el); }
    const row = items.map(x => `<span class="st-tk-it">${x}</span>`).join("");
    const dur = Math.max(18, sig.length * 0.22);
    /* الشريط يكمل من مكانه لما يتحدث (الإحصائيات تتغير مع كل جواب)، ما يرجع من أوله */
    const old = el.querySelector(".st-tk-in"), oa = old && old.getAnimations ? old.getAnimations()[0] : null;
    const prog = oa && oa.effect && oa.effect.getComputedTiming ? (oa.effect.getComputedTiming().progress || 0) : 0;
    el.innerHTML = `<span class="st-tk-tag">${ic("megaphone")} أخبار</span><div class="st-tk-win"><div class="st-tk-in" style="animation-duration:${dur}s;animation-delay:${-(prog * dur).toFixed(2)}s">${row}${row}</div></div>`;
}

/* ===== الشريط السفلي (Lower third) لاسم المتسابق: لما يضغط الجرس أو يتكلم ===== */
const BC_L3 = { key: "", talkUid: "", talkUntil: 0 };
function bcLowerThird(d) {
    const scr = document.getElementById("liveScreen");
    if (!scr) return;
    let el = document.getElementById("stL3");
    let want = null;
    if (d && d.status === "live") {
        const o = bcCur(d);
        /* 23 أكتوبر 2026: الشريط كان ثابت تحت فوق المشهد، فيغطي مربع الجواب وخانة الكتابة وأزرار المنظم.
           الحين يطلع وقت الترحيب بس (المشهد يترك له مكان)، ووقت الأسئلة "فلان ضغط الجرس أول" مكتوبة في المشهد نفسه */
        if (d.scene === "talk") {
            /* أعلى صوت يتكلم الحين (مع مهلة عشان ما يرمش) */
            let best = null;
            bcSpeakers(d).forEach(sp => { const m = bcMicLevel(sp.uid); if (m.on && m.lvl > 0.06 && (!best || m.lvl > best.lvl)) best = Object.assign({ lvl: m.lvl }, sp); });
            const now = bcNow();
            if (best) { BC_L3.talkUid = best.uid; BC_L3.talkUntil = now + 1800; BC_L3.talk = best; }
            if (BC_L3.talk && now < BC_L3.talkUntil) want = { key: "t" + BC_L3.talk.uid, name: BC_L3.talk.name, sub: BC_L3.talk.role === "المنظم" ? "مقدم البرنامج" : "متسابق · على الهواء", av: BC_L3.talk.av };
        }
    }
    if (!want) { if (el && el.classList.contains("on")) el.classList.remove("on"); BC_L3.key = ""; return; }
    if (!el) { el = document.createElement("div"); el.id = "stL3"; el.className = "st-l3"; scr.appendChild(el); }
    if (BC_L3.key !== want.key) {
        BC_L3.key = want.key;
        el.innerHTML = `<img src="${safeSrc(want.av)}" alt=""><div class="tx"><b>${escapeHTML(want.name)}</b><span>${escapeHTML(want.sub)}</span></div>`;
        el.classList.toggle("gold", !!want.gold);
        const k = want.key;
        bcRestartAnim(el, "on", () => BC_L3.key === k, true);   /* كان void offsetWidth: ~100ms لحظة الجرس على الجوال الضعيف */
        return;
    }
    el.classList.add("on");
}
let bcLastQAnim = "";

/* ===== المخرج: يقطع بين لقطات الاستوديو حسب اللحظة ===== */
/* لقطات Flow + لقطات مولّدة بالذكاء الاصطناعي (Cloudflare Workers AI) */
const BC_SHOTS = ["screen", "ident", "wide", "podium", "countdown", "decider", "winner", "closing", "lobby"];
function bcShotFor(d) {
    if (!d) return "";
    if (d.status === "scheduled") return "lobby";                            /* الانتظار قبل البث */
    if (d.status !== "live") return "";
    if (bcIsDecider(d)) return d.phase === "answer" ? "podium" : "decider";  /* سؤال الحسم: الاستوديو الأحمر */
    switch (d.scene) {
        case "opening": return "ident";                                      /* فاصل الافتتاح */
        case "intro": return "wide";                                         /* لقطة علوية بين المواجهات */
        case "talk": return "studio";
        case "countdown": return "countdown";                                /* ضوء واحد قبل البداية */
        case "playing": return d.phase === "answer" ? "podium" : "screen";   /* المنصة لما أحد يضغط الجرس، وشاشة السؤال غير كذا */
        case "result": return (d.s1 || 0) !== (d.s2 || 0) ? "winner" : "studio";   /* قصاصات ذهبية للفائز */
        case "closing": return "closing";                                    /* ألعاب نارية */
        default: return "studio";
    }
}
function bcDirector(d) {
    const scr = document.getElementById("liveScreen");
    if (!scr) return;
    const shot = bcShotFor(d);
    if (scr.dataset.shot === shot) return;
    scr.dataset.shot = shot;
    /* الصورة تتحمل أول مرة تحتاجها بس (كانت الـ 9 صور، 720KB، تنزل كلها أول ما يفتح البث) */
    document.querySelectorAll("#stShots img").forEach(img => {
        const on = img.dataset.shot === shot;
        if (on && !img.getAttribute("src")) img.src = "media/shot_" + shot + ".jpg";
        img.classList.toggle("on", on);
    });
}

/* ===== توقّع الفائز (للمشاهدين، قبل بداية كل مواجهة) ===== */
/* 26 أكتوبر 2026: التوقعات في وثيقة لحالها (room/main/livePred/<id>)، لأن كل توقّع من أي مشاهد كان يكتب في وثيقة البث
   فتنرسل كاملة لكل الجوالات وتتعارض مع الجرس. الوثائق القديمة: d.pred */
let bcPredDoc = null, bcPredSub = null, bcPredSubId = "";
function bcPredListen(id) {
    if (bcPredSubId === (id || "")) return;
    if (bcPredSub) { bcPredSub(); bcPredSub = null; }
    bcPredSubId = id || ""; bcPredDoc = null;
    if (!id || !firebaseDB) return;
    bcPredSub = livePredRef(id).onSnapshot(s => {
        bcPredDoc = s.exists ? s.data() : null;
        if (openLiveId === id) { liveLastSig = ""; renderLiveScreen(); }
    }, () => {});
}
function bcPredAll(d) { return Object.assign({}, (d && d.pred) || {}, bcPredDoc || {}); }
function bcPredMap(d, cur) { return bcPredAll(d)["c" + cur] || {}; }
function bcPredCounts(d, cur) {
    const m = bcPredMap(d, cur); let a = 0, b = 0;
    Object.keys(m).forEach(k => { if (m[k] && m[k].n === 1) a++; else if (m[k] && m[k].n === 2) b++; });
    return { a, b, t: a + b };
}
function bcPredSig(d) { if (!d) return ""; const m = bcPredMap(d, d.cur); const c = bcPredCounts(d, d.cur); return c.a + "-" + c.b + "-" + (currentUser && m[currentUser.uid] ? m[currentUser.uid].n : 0); }
function bcCanPredict(d) { return !!currentUser && !!d && d.status === "live" && d.scene === "intro" && !myLiveNum(d); }
function bcPredict(n) {
    const d = liveMatchesCache[openLiveId];
    if (!bcCanPredict(d)) return;
    const name = (currentUserDocData && currentUserDocData.name) || currentUser.displayName || "مشاهد";
    livePredRef(openLiveId).set({ ["c" + d.cur]: { [currentUser.uid]: { n: n, name: name } } }, { merge: true })
        .then(() => roomToast("انحفظ توقعك", "check"))
        .catch(err => roomToast(err && err.code === "permission-denied" ? "ما قدرنا نحفظ توقعك (صلاحيات قاعدة البيانات)" : "تعذّر حفظ توقعك", "alert"));
}
function bcPredHTML(d, o) {
    const c = bcPredCounts(d, d.cur);
    const pa = c.t ? Math.round(c.a * 100 / c.t) : 50;
    const mine = currentUser ? (bcPredMap(d, d.cur)[currentUser.uid] || {}).n : 0;
    const bar = `<div class="st-predbar"><i style="width:${pa}%"></i></div><div class="st-predlbl"><span>${escapeHTML(o.p1)} ${c.t ? pa + "%" : ""}</span><span>${c.t} توقّع</span><span>${c.t ? (100 - pa) + "%" : ""} ${escapeHTML(o.p2)}</span></div>`;
    if (!currentUser) return `<div class="st-pred"><div class="t">${ic("target")} توقّع الفائز</div>${bar}<div class="lv-muted">سجّل دخول عشان تتوقع</div></div>`;
    if (myLiveNum(d)) return c.t ? `<div class="st-pred"><div class="t">${ic("target")} توقعات الجمهور</div>${bar}</div>` : "";
    return `<div class="st-pred"><div class="t">${ic("target")} مين بيفوز؟ توقّع قبل البداية</div>
<div class="st-predbtns"><button class="${mine === 1 ? "on" : ""}" onclick="bcPredict(1)">${escapeHTML(o.p1)}</button><button class="${mine === 2 ? "on" : ""}" onclick="bcPredict(2)">${escapeHTML(o.p2)}</button></div>${bar}</div>`;
}
/* ترتيب أفضل المتوقعين في الجولة */
function bcPredBoard(d) {
    const tally = {};
    (d.order || []).forEach((o, i) => {
        if (o.state !== "done" || (o.s1 || 0) === (o.s2 || 0)) return;
        const w = (o.s1 || 0) > (o.s2 || 0) ? 1 : 2;
        const m = bcPredMap(d, i);
        Object.keys(m).forEach(uid => {
            const x = m[uid]; if (!x) return;
            const t = tally[uid] || (tally[uid] = { name: x.name || "مشاهد", ok: 0, all: 0 });
            t.all++; if (x.n === w) t.ok++;
        });
    });
    return Object.values(tally).sort((a, b) => b.ok - a.ok || a.all - b.all).slice(0, 5);
}

/* ===== رابط مباشر للبث (يتنسخ ويتفتح في الواتساب) ===== */
function bcShareUrl(id) { return location.origin + "/?live=" + encodeURIComponent(id); }
function bcShare(id) {
    id = id || openLiveId;
    const d = liveMatchesCache[id];
    if (!d) return;
    const url = bcShareUrl(id);
    const when = d.status === "scheduled" ? ` يبدأ الساعة ${bcTimeLabel(d.startAt || 0)}` : " مباشر الحين";
    const text = `🔴 بث الجولة ${d.round} من دوري بنو مسروح للنخبة${when}\nادخل من هنا:\n${url}`;
    try { navigator.clipboard.writeText(url).then(() => roomToast("نسخت رابط البث", "check")).catch(() => {}); } catch (e) {}
    window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");
}
/* لو أحد فتح الموقع من رابط البث، نفتح له البث على طول */
let bcDeepLink = (() => { try { return new URLSearchParams(location.search).get("live"); } catch (e) { return null; } })();


/* ===== تفاعلات المشاهدين (بدون صوت) ===== */
const BC_RX = ["👏", "🔥", "❤️"];
let bcRxLastSend = 0, bcRxSeenN = null;
function bcFloat(e, mine) {
    const scr = document.getElementById("liveScreen");
    if (!scr || CINE_REDUCED && !mine) return;
    const f = document.createElement("div");
    f.className = "st-float";
    f.textContent = e;
    f.style.left = (8 + Math.random() * 14) + "%";
    f.style.setProperty("--dx", ((Math.random() - 0.5) * 80) + "px");
    scr.appendChild(f);
    setTimeout(() => f.remove(), 2700);
}
function bcReact(i) {
    const e = BC_RX[i];
    if (!e || !openLiveId) return;
    bcFloat(e, true);
    if (bcNow() - bcRxLastSend < 700 || !firebaseDB) return;
    bcRxLastSend = bcNow();
    const by = currentUser ? currentUser.uid : "guest";
    liveCol().doc("rx_" + openLiveId).set({ type: "rx", e: e, n: bcNow() + Math.random(), by: by }).catch(() => {});
}
/* 23 أكتوبر 2026 (طلب محمد): أزرار التفاعل انشالت، وتفاعلات الجوالات اللي للحين على النسخة القديمة ما تطلع فوق البث */
function bcOnRx(x) {}
