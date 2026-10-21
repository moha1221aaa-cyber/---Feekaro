/* الذكاء الاصطناعي في الدوري (السيرفر: functions/ai.js، مجاني من Cloudflare Workers AI)
   1) توليد أسئلة جديدة لبنك الأسئلة (المنظم يراجعها ويختار قبل الإضافة)
   2) تصحيح ذكي للإجابات: لو المطابقة العادية رفضت، الذكاء يحكم (أخطاء إملائية، عامية، إنجليزي)
   3) جمل جديدة للمقدم في كل جولة (تنحفظ في وثيقة البث فكل الأجهزة تسمع نفس الجملة)
   4) مساعد الموقع: دردشة لأي متسابق عن الدوري والثقافة العامة
   أي فشل في الذكاء ما يوقف شي: كل ميزة ترجع للطريقة القديمة */

function aiCall(task, body, timeoutMs) {
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), timeoutMs || 20000) : null;
    return authHeaders().then(h => fetch("/ai", {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, h),
        body: JSON.stringify(Object.assign({ task }, body || {})),
        signal: ctl ? ctl.signal : undefined
    })).then(r => r.json().catch(() => ({})).then(d => {
        if (!r.ok) throw new Error(d.error || ("AI " + r.status));
        return d;
    })).finally(() => { if (t) clearTimeout(t); });
}

/* ===== 1) توليد الأسئلة ===== */
let aiGenList = [];

function aiGenQuestions() {
    const btn = document.getElementById("aiGenBtn");
    const box = document.getElementById("aiGenBox");
    const cat = (document.getElementById("aiGenCat") || {}).value || "ثقافة عامة";
    const count = Number((document.getElementById("aiGenCount") || {}).value) || 5;
    if (!btn || !box) return;
    btn.disabled = true;
    btn.innerHTML = `<svg class="ic" aria-hidden="true"><use href="#i-hourglass"/></svg> يكتب الأسئلة...`;
    box.innerHTML = "";
    const avoid = (roomState.qbank || []).map(q => q && q.text).filter(Boolean)
        .concat((typeof LIVE_FALLBACK_QUESTIONS !== "undefined" ? LIVE_FALLBACK_QUESTIONS : []).map(q => q.text));
    btn.innerHTML = `<svg class="ic" aria-hidden="true"><use href="#i-hourglass"/></svg> يكتب الأسئلة ويراجعها (دقيقة تقريباً)...`;
    aiCall("questions", { category: cat, count, avoid }, 120000).then(d => {
        aiGenList = (d.questions || []).filter(q => q.text && q.answer);
        aiRenderGen(d.dropped || 0);
    }).catch(e => {
        box.innerHTML = `<div class="ai-note ai-err">ما قدرت أولّد أسئلة الحين (${escapeHTML(e.message === "The user aborted a request." ? "تأخر الرد" : e.message)}). جرّب بعد شوي.</div>`;
    }).finally(() => {
        btn.disabled = false;
        btn.innerHTML = `<svg class="ic" aria-hidden="true"><use href="#i-zap"/></svg> ولّد أسئلة بالذكاء الاصطناعي`;
    });
}

function aiRenderGen(dropped) {
    const box = document.getElementById("aiGenBox");
    if (!box) return;
    if (!aiGenList.length) { box.innerHTML = `<div class="ai-note">ما طلع شي متأكد منه هالمرة، جرّب مرة ثانية أو تصنيف ثاني.</div>`; return; }
    box.innerHTML = `<div class="ai-note">كل سؤال انراجع مرتين${dropped ? `، وانشال ${dropped} سؤال ما تأكد منه المراجع` : ""}. برضو راجعها بنفسك، وشيل الصح عن أي سؤال تشك فيه.</div>` +
        aiGenList.map((q, i) => `
<label class="ai-gen-item">
<input type="checkbox" class="ai-gen-chk" data-i="${i}" checked>
<span><strong>${escapeHTML(q.text)}</strong><small>الإجابة: ${escapeHTML(q.answer)}</small></span>
</label>`).join("") +
        `<button id="aiGenAddBtn" style="width:100%;"><svg class="ic" aria-hidden="true"><use href="#i-plus"/></svg> أضف المحدد لبنك الأسئلة</button>`;
    document.getElementById("aiGenAddBtn").onclick = aiAddGen;
}

function aiAddGen() {
    const picked = [];
    document.querySelectorAll(".ai-gen-chk").forEach(c => { if (c.checked && aiGenList[Number(c.dataset.i)]) picked.push(aiGenList[Number(c.dataset.i)]); });
    if (!picked.length) return alert("ما اخترت ولا سؤال");
    if (!roomState.qbank) roomState.qbank = [];
    const have = new Set(roomState.qbank.map(q => q && q.text));
    let n = 0;
    picked.forEach(q => { if (!have.has(q.text)) { roomState.qbank.push({ text: q.text, answer: q.answer }); n++; } });
    saveRoomState();
    renderQBankList();
    aiGenList = [];
    const box = document.getElementById("aiGenBox");
    if (box) box.innerHTML = `<div class="ai-note ai-ok">انضاف ${n} سؤال لبنك الأسئلة.</div>`;
}

/* ===== 2) التصحيح الذكي ===== */
const aiGradeCache = {};
function aiGrade(q, answer, given, timeoutMs) {
    const key = q + "\u0001" + given;
    if (aiGradeCache[key] !== undefined) return Promise.resolve(aiGradeCache[key]);
    return aiCall("grade", { q, answer, given }, timeoutMs || 4000)
        .then(d => (aiGradeCache[key] = d.ok === true))
        .catch(() => false);
}

/* ===== 3) جمل المقدم (والمواقف: سلسلة، رجوع، تعادل، تقدّم) ===== */
function aiHostLines(round, order) {
    const ms = (order || []).map((o, i) => {
        let ctx = "";
        try { const c = bcMatchContext({ order, cur: i, round }); ctx = c ? c.t : ""; } catch (e) {}
        return { p1: o.p1, p2: o.p2, ctx };
    });
    return aiCall("host", { round, matches: ms }, 7000)
        .then(d => (d && (d.open || (d.intros || []).length)) ? { open: d.open || "", intros: d.intros || [], close: d.close || "", situ: d.situ || {} } : null)
        .catch(() => null);
}

/* ===== 4) مساعد الموقع ===== */
let aiChatMsgs = [];
let aiChatBusy = false;

function aiLeagueContext() {
    const lines = [];
    try {
        const tab = bcStandings();
        lines.push("الترتيب (الاسم: نقاط، فوز/تعادل/خسارة، أجوبة له/عليه):");
        tab.forEach((r, i) => lines.push(`${i + 1}. ${r.name}: ${r.pts} نقطة، ${r.w}/${r.d}/${r.l}، ${r.gf}/${r.ga}`));
    } catch (e) {}
    try {
        const done = matches.filter(m => m.s1 !== "" && m.s2 !== "").sort((a, b) => Number(b.round) - Number(a.round)).slice(0, 10);
        const next = matches.filter(m => m.s1 === "" || m.s2 === "").sort((a, b) => Number(a.round) - Number(b.round)).slice(0, 12);
        if (done.length) { lines.push("آخر النتائج:"); done.forEach(m => lines.push(`الجولة ${m.round}: ${m.p1.name} ${m.s1} - ${m.s2} ${m.p2.name}`)); }
        if (next.length) { lines.push("المواجهات الجاية:"); next.forEach(m => lines.push(`الجولة ${m.round}: ${m.p1.name} ضد ${m.p2.name}`)); }
    } catch (e) {}
    try {
        const me = (currentUserDocData && currentUserDocData.name) || (currentUser && currentUser.displayName);
        if (me) lines.push("اسم اللي يكلمك: " + me);
    } catch (e) {}
    return lines.join("\n");
}

function aiOpenChat() {
    aiRenderChat();
    openModal("aiChatModal");
    setTimeout(() => { const i = document.getElementById("aiChatInput"); if (i) i.focus(); }, 200);
}

function aiRenderChat() {
    const box = document.getElementById("aiChatLog");
    if (!box) return;
    if (!aiChatMsgs.length) {
        box.innerHTML = `<div class="ai-msg ai-bot">هلا! أنا مساعد الدوري. اسألني عن الترتيب، المواجهات الجاية، طريقة البث والجرس، أو أي سؤال ثقافي تبي تتعلمه.</div>`;
    } else {
        box.innerHTML = aiChatMsgs.map(m => `<div class="ai-msg ${m.role === "user" ? "ai-me" : "ai-bot"}">${escapeHTML(m.content).replace(/\n/g, "<br>")}</div>`).join("") +
            (aiChatBusy ? `<div class="ai-msg ai-bot ai-typing">يكتب...</div>` : "");
    }
    box.scrollTop = box.scrollHeight;
}

function aiSendChat() {
    const inp = document.getElementById("aiChatInput");
    if (!inp || aiChatBusy) return;
    const text = inp.value.trim();
    if (!text) return;
    inp.value = "";
    aiChatMsgs.push({ role: "user", content: text.slice(0, 600) });
    aiChatBusy = true;
    aiRenderChat();
    aiCall("chat", { messages: aiChatMsgs.slice(-10), context: aiLeagueContext() }, 30000).then(d => {
        aiChatMsgs.push({ role: "assistant", content: d.reply || "ما قدرت أرد الحين، جرّب مرة ثانية." });
    }).catch(e => {
        aiChatMsgs.push({ role: "assistant", content: /429|كثرت/.test(e.message) ? "كثرت الأسئلة، عطني دقيقة وارجع اسأل." : "صار خطأ في الاتصال، جرّب مرة ثانية." });
    }).finally(() => {
        aiChatBusy = false;
        if (aiChatMsgs.length > 30) aiChatMsgs = aiChatMsgs.slice(-30);
        aiRenderChat();
    });
}
