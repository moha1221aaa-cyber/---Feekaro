/* الدوري: ملف المتسابق، جدول الترتيب، الملخص، بطاقات المواجهات، التبويبات */
/* مستوى المتسابق من مواجهاته المنتهية: آخر 5 نتائج، أطول سلسلة فوز، متوسط أجوبته، وأكبر فوز */
function playerFormHTML(name) {
let done = matches.filter(m => (m.p1.name === name || m.p2.name === name) && m.s1 !== "" && m.s2 !== "" && m.s1 != null && m.s2 != null)
    .sort((a, b) => a.round - b.round)
    .map(m => { const me = m.p1.name === name, a = Number(me ? m.s1 : m.s2), b = Number(me ? m.s2 : m.s1); return { a, b, opp: me ? m.p2.name : m.p1.name, r: a > b ? "w" : a < b ? "l" : "d" }; });
if(!done.length) return "";
let best = 0, run = 0, big = null;
done.forEach(g => { run = g.r === "w" ? run + 1 : 0; best = Math.max(best, run); if(g.r === "w" && (!big || g.a - g.b > big.a - big.b)) big = g; });
const avg = (done.reduce((t, g) => t + g.a, 0) / done.length).toFixed(1);
const label = { w: "ف", d: "ت", l: "خ" }, color = { w: "#4ade80", d: "#facc15", l: "#f87171" };
const last = done.slice(-5).reverse().map(g => `<span class="form-pill" style="background:${color[g.r]}" title="${g.a} - ${g.b} ضد ${escapeHTML(g.opp)}">${label[g.r]}</span>`).join("");
return `
<div style="margin-top:15px; text-align:right;">
<div style="font-size:13px; font-weight:bold; color:#4ade80; margin-bottom:8px; border-bottom:1px solid #334155; padding-bottom:4px;">${ic("zap")} مستوى المتسابق</div>
<div class="form-row"><span>آخر النتائج</span><div class="form-pills">${last}</div></div>
<div class="stats-grid-box">
<div class="stat-box-item"><div class="stat-box-value" style="color:#4ade80;">${best}</div><div class="stat-box-label">أطول سلسلة فوز</div></div>
<div class="stat-box-item"><div class="stat-box-value" style="color:#60a5fa;">${avg}</div><div class="stat-box-label">متوسط أجوبته بالمواجهة</div></div>
<div class="stat-box-item"><div class="stat-box-value" style="font-size:15px;">${big ? `${big.a} - ${big.b}` : "-"}</div><div class="stat-box-label">${big ? `أكبر فوز (ضد ${escapeHTML(big.opp)})` : "أكبر فوز"}</div></div>
</div>
</div>`;
}

function openUserProfile(uid, playerName) {
let body = document.getElementById("viewProfileModalBody");
if(!body) return;

let userData = null;
if(uid && cachedUsersData[uid]) {
userData = cachedUsersData[uid];
} else if(playerName && playerLinks[playerName] && cachedUsersData[playerLinks[playerName]]) {
userData = cachedUsersData[playerLinks[playerName]];
uid = playerLinks[playerName];
}

let displayName = playerName || (userData ? (userData.name || userData.displayName) : "متسابق");
let userEmail = userData ? userData.email : "";
let av = getPlayerAvatar(displayName);
let photoUrl = (userData && userData.photoURL) ? userData.photoURL : av.url;

let pStat = players.find(p => p.name === displayName);
let pRank = pStat ? (players.indexOf(pStat) + 1) : "-";

// إحصائيات التوقعات تحتاج توقعات الكل: لو ما تحمّلت للحين، نرسم الملف ونعيده أول ما توصل (لو الملف للحين مفتوح)
ensurePredictionRanking(() => { if (activeModalId === "viewProfileModal") openUserProfile(uid, playerName); });
let predStats = getUserPredictionStats(uid, userEmail);

let statsHTML = "";
if(pStat) {
statsHTML = `
<div style="margin-top:15px; text-align:right;">
<div style="font-size:13px; font-weight:bold; color:#60a5fa; margin-bottom:8px; border-bottom:1px solid #334155; padding-bottom:4px;"><svg class="ic" aria-hidden="true"><use href="#i-chart"/></svg> إحصائيات الدوري (كمتسابق)</div>
<div class="stats-grid-box">
<div class="stat-box-item"><div class="stat-box-value">#${pRank}</div><div class="stat-box-label">الترتيب في الدوري</div></div>
<div class="stat-box-item"><div class="stat-box-value" style="color:#60a5fa;">${pStat.pts}</div><div class="stat-box-label">النقاط</div></div>
<div class="stat-box-item"><div class="stat-box-value" style="color:#4ade80;">${pStat.w}</div><div class="stat-box-label">الفوز</div></div>
<div class="stat-box-item"><div class="stat-box-value" style="color:#facc15;">${pStat.d}</div><div class="stat-box-label">التعادل</div></div>
<div class="stat-box-item"><div class="stat-box-value" style="color:#f87171;">${pStat.l}</div><div class="stat-box-label">الخسارة</div></div>
<div class="stat-box-item"><div class="stat-box-value">${pStat.gf} / ${pStat.ga}</div><div class="stat-box-label">أجوبته / أجوبة خصومه</div></div>
</div>
</div>
`;
}

let predStatsHTML = `
<div style="margin-top:15px; text-align:right;">
<div style="font-size:13px; font-weight:bold; color:#facc15; margin-bottom:8px; border-bottom:1px solid #334155; padding-bottom:4px;"><svg class="ic" aria-hidden="true"><use href="#i-target"/></svg> إحصائيات التوقعات</div>
<div class="stats-grid-box">
<div class="stat-box-item"><div class="stat-box-value" style="color:#facc15;">#${predStats.rank}</div><div class="stat-box-label">ترتيب التوقعات</div></div>
<div class="stat-box-item"><div class="stat-box-value" style="color:#38bdf8;">${predStats.points}</div><div class="stat-box-label">نقاط التوقعات</div></div>
<div class="stat-box-item"><div class="stat-box-value" style="color:#4ade80;">${predStats.exact}</div><div class="stat-box-label">توقع دقيق (5 ن)</div></div>
<div class="stat-box-item"><div class="stat-box-value" style="color:#a7f3d0;">${predStats.correct}</div><div class="stat-box-label">نتيجة صحيحة (3 ن)</div></div>
</div>
</div>
`;

let playerMatchesHTML = "";
if(displayName) {
let pMatches = matches.filter(m => m.p1.name === displayName || m.p2.name === displayName);
if(pMatches.length > 0) {
playerMatchesHTML = `<div style="margin-top:18px; text-align:right;">
<div style="font-size:13px; font-weight:bold; color:#38bdf8; margin-bottom:8px; border-bottom:1px solid #334155; padding-bottom:4px;"><svg class="ic" aria-hidden="true"><use href="#i-ball"/></svg> مواجهات المتسابق (${pMatches.length})</div>`;
pMatches.forEach(m => {
let isP1 = (m.p1.name === displayName);
let oppName = isP1 ? m.p2.name : m.p1.name;
let myScore = isP1 ? m.s1 : m.s2;
let oppScore = isP1 ? m.s2 : m.s1;

let statusText = "قادمة";
let statusColor = "#94a3b8";

if(m.s1 !== "" && m.s2 !== "") {
statusText = `${myScore} - ${oppScore}`;
let sA = Number(myScore), sB = Number(oppScore);
if(sA > sB) statusColor = "#4ade80";
else if(sA < sB) statusColor = "#f87171";
else statusColor = "#facc15";
}

playerMatchesHTML += `
<div style="background:#0f172a; padding:8px 12px; border-radius:8px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; font-size:12px; border:1px solid #334155;">
<div>ضد <strong style="color:white;">${escapeHTML(oppName)}</strong> <span style="font-size:10px; color:#94a3b8;">(جولة ${m.round})</span></div>
<div style="font-weight:bold; color:${statusColor};">${statusText}</div>
</div>
`;
});
playerMatchesHTML += `</div>`;
}
}

let adminButton = (isAdmin && displayName) ? `<button onclick="openLinkPlayerModal(${jsArg(displayName)})" style="margin-top:12px; background:#0284c7; width:100%;"><svg class="ic" aria-hidden="true"><use href="#i-ball"/></svg> توثيق المتسابق بالحساب</button>` : '';

body.innerHTML = `
<div style="text-align:center;">
<div style="width:85px; height:85px; margin:0 auto 10px; border-radius:50%; border:3px solid #2563eb; overflow:hidden; background:#0f172a; box-shadow:0 4px 12px rgba(37,99,235,0.4);">
<img loading="lazy" decoding="async" src="${safeSrc(photoUrl)}" style="width:100%; height:100%; object-fit:cover;" alt="">
</div>
<div style="font-size:18px; font-weight:bold; color:white; display:flex; align-items:center; justify-content:center; gap:5px;">
${escapeHTML(displayName)} ${av.isVerified ? '<span class="verified-badge" title="حساب موثوق"><svg class="ic" aria-hidden="true"><use href="#i-verified"/></svg></span>' : ''}
</div>
${userData && userData.email && (isAdmin || (currentUser && currentUser.uid === uid)) ? `<div style="font-size:12px; color:#94a3b8; direction:ltr; margin-top:3px;">${escapeHTML(userData.email)}</div>` : ''}
${statsHTML}
${pStat ? playerFormHTML(displayName) : ''}
${predStatsHTML}
${playerMatchesHTML}
${adminButton}
</div>
`;

openModal("viewProfileModal");
}

/* الحساب بس (بدون رسم): البث يحتاج الترتيب حتى لو رسم الجدول متأجل (bcDeferPage) */
function tableStats() {
players.forEach(p => { p.w = 0; p.d = 0; p.l = 0; p.gf = 0; p.ga = 0; p.pts = 0; });

matches.forEach(m => {
if(m.s1 === "" || m.s2 === "") return;
let a = Number(m.s1);
let b = Number(m.s2);
if(isNaN(a) || isNaN(b)) return;

m.p1.gf += a; m.p1.ga += b;
m.p2.gf += b; m.p2.ga += a;

if(a > b) { m.p1.w++; m.p1.pts += 3; m.p2.l++; }
else if(a < b) { m.p2.w++; m.p2.pts += 3; m.p1.l++; }
else { m.p1.d++; m.p2.d++; m.p1.pts += 1; m.p2.pts += 1; }
});

players.sort((a,b) => b.pts - a.pts || ((b.gf-b.ga) - (a.gf-a.ga)) || b.gf - a.gf);
}

function table() {
tableStats();
let tbody = document.getElementById("standings");
if(!tbody) return;
tbody.innerHTML = "";

players.forEach((p,i) => {
let row = document.createElement("tr");
let avatarData = getPlayerAvatar(p.name);
let verifiedBadge = avatarData.isVerified ? `<span class="verified-badge" title="حساب موثوق"><svg class="ic" aria-hidden="true"><use href="#i-verified"/></svg></span>` : '';

let playerCellHTML = `
<div class="table-player-cell clickable-profile" onclick="openUserProfile(${jsArg(playerLinks[p.name] || '')}, ${jsArg(p.name)})">
<img loading="lazy" decoding="async" src="${safeSrc(avatarData.url)}" class="table-player-img" alt="${escapeHTML(p.name)}">
<span style="font-weight:bold;">${escapeHTML(p.name)}</span>${verifiedBadge}
</div>
`;

if(i < 3) row.className = `top-${i+1}`;
row.innerHTML = `<td class="rank-cell">${i+1}</td><td>${playerCellHTML}</td><td>${p.w}</td><td>${p.d}</td><td>${p.l}</td><td>${p.gf}</td><td>${p.ga}</td><td class="pts-cell"><b>${p.pts}</b></td>`;
tbody.appendChild(row);
});

renderLeagueSummary();
}

function renderLeagueSummary() {
let container = document.getElementById("leagueSummaryBox");
if(!container) return;

let playedMatches = matches.filter(m => m.s1 !== "" && m.s2 !== "").length;
let totalMatches = matches.length;
let totalGoals = matches.reduce((acc, m) => acc + (Number(m.s1) || 0) + (Number(m.s2) || 0), 0);
let leader = players[0] ? players[0].name : "-";

container.innerHTML = `
<div class="summary-card">
<div class="summary-card-val">${playedMatches} / ${totalMatches}</div>
<div class="summary-card-lbl">المواجهات المكتملة</div>
</div>
<div class="summary-card">
<div class="summary-card-val" style="color:#facc15;"><svg class="ic" aria-hidden="true"><use href="#i-ball"/></svg> ${totalGoals}</div>
<div class="summary-card-lbl">إجمالي الأجوبة الصحيحة</div>
</div>
<div class="summary-card">
<div class="summary-card-val" style="color:#4ade80;"><svg class="ic" aria-hidden="true"><use href="#i-crown"/></svg> ${escapeHTML(leader)}</div>
<div class="summary-card-lbl">متصدر الدوري</div>
</div>
`;
}

function shareStandingsToWhatsApp() {
let text = `🏆 *جدول ترتيب دوري بنو مسروح للنخبة* 🏆\n\n`;
players.forEach((p, idx) => {
let medal = idx === 0 ? "🥇" : (idx === 1 ? "🥈" : (idx === 2 ? "🥉" : `${idx + 1}.`));
text += `${medal} *${p.name}* - ${p.pts} نقطة (ف:${p.w} | ت:${p.d} | خ:${p.l} | له:${p.gf})\n`;
});
text += `\n🏆 لمتابعة نتائج الدوري وتوقعات المواجهات عبر التطبيق!`;
let url = `https://wa.me/?text=${encodeURIComponent(text)}`;
window.open(url, '_blank');
}

/* بطاقة نتيجة المواجهة (صورة 1080×1080) تنرسل في الواتساب. الصور الشخصية من مواقع ثانية تقفل الحفظ من canvas، فنرسم أول حرف بدالها */
async function shareMatchCard(m) {
    const W = 1080, c = document.createElement("canvas");
    c.width = W; c.height = W;
    const x = c.getContext("2d");
    try { await document.fonts.load("800 60px Tajawal"); } catch (e) {}
    const F = (w, px) => `${w} ${px}px Tajawal, sans-serif`;
    const bg = x.createLinearGradient(0, 0, 0, W);
    bg.addColorStop(0, "#1e293b"); bg.addColorStop(1, "#0f172a");
    x.fillStyle = bg; x.fillRect(0, 0, W, W);
    x.direction = "rtl"; x.textAlign = "center"; x.textBaseline = "middle";
    const logo = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = "logo.png"; });
    if (logo) x.drawImage(logo, W / 2 - 90, 70, 180, 180);
    x.fillStyle = "#ffffff"; x.font = F(800, 54); x.fillText("دوري بنو مسروح للنخبة", W / 2, 310);
    x.fillStyle = "#60a5fa"; x.font = F(700, 38); x.fillText(`الجولة ${m.round}`, W / 2, 375);
    const s1 = Number(m.s1), s2 = Number(m.s2);
    const side = (name, cx, win) => {
        x.beginPath(); x.arc(cx, 560, 105, 0, Math.PI * 2);
        x.fillStyle = "#2563eb"; x.fill();
        x.lineWidth = 10; x.strokeStyle = win ? "#facc15" : "#334155"; x.stroke();
        x.fillStyle = "#ffffff"; x.font = F(800, 105); x.fillText(String(name).trim().charAt(0), cx, 572);
        x.font = F(800, 48); x.fillText(name, cx, 730, 320);
    };
    // RTL: المتسابق الأول يمين مثل بطاقة المواجهة في الموقع
    side(m.p1.name, W - 200, s1 > s2);
    side(m.p2.name, 200, s2 > s1);
    x.fillStyle = "#ffffff"; x.font = F(900, 130); x.direction = "ltr"; x.fillText(`${s2} : ${s1}`, W / 2, 575, 300); x.direction = "rtl";
    const res = s1 === s2 ? "تعادل" : `الفوز لـ ${s1 > s2 ? m.p1.name : m.p2.name}`;
    x.fillStyle = s1 === s2 ? "#facc15" : "#4ade80"; x.font = F(800, 56); x.fillText(res, W / 2, 870, 900);
    x.fillStyle = "#94a3b8"; x.font = F(700, 32); x.fillText("masro7-league.pages.dev", W / 2, 990);
    const text = `🏆 دوري بنو مسروح للنخبة\n${m.p1.name} ${s1} : ${s2} ${m.p2.name}\n${res}\nhttps://masro7-league.pages.dev`;
    const blob = await new Promise(r => c.toBlob(r, "image/png"));
    const file = blob && new File([blob], "masro7-result.png", { type: "image/png" });
    try {
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    // المتصفح ما يدعم مشاركة الصور: نحمّل الصورة ونفتح الواتساب بالنص
    if (blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "masro7-result.png"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
}

function createMatchCard(m) {
let div = document.createElement("div");
div.className = "match";

let av1 = getPlayerAvatar(m.p1.name);
let av2 = getPlayerAvatar(m.p2.name);

let player1Div = document.createElement("div");
player1Div.className = "match-player clickable-profile";
player1Div.onclick = () => openUserProfile(playerLinks[m.p1.name] || '', m.p1.name);
player1Div.innerHTML = `
<img loading="lazy" decoding="async" src="${safeSrc(av1.url)}" class="match-player-img" alt="${escapeHTML(m.p1.name)}">
<div class="match-player-name">${escapeHTML(m.p1.name)}</div>
`;

let scoreDiv = document.createElement("div");
scoreDiv.className = "match-score-box";

let in1 = document.createElement("input");
in1.type = "number";
in1.min = "0";
in1.value = m.s1;
in1.disabled = !isAdmin;

let separator = document.createElement("span");
separator.className = "match-sep";
separator.textContent = ":";

let in2 = document.createElement("input");
in2.type = "number";
in2.min = "0";
in2.value = m.s2;
in2.disabled = !isAdmin;

if (isAdmin) {
    let updateScore = () => {
        m.s1 = in1.value;
        m.s2 = in2.value;
        table();
        save();
    };
    in1.onchange = updateScore;
    in2.onchange = updateScore;
}

scoreDiv.appendChild(in1);
scoreDiv.appendChild(separator);
scoreDiv.appendChild(in2);

let player2Div = document.createElement("div");
player2Div.className = "match-player clickable-profile";
player2Div.onclick = () => openUserProfile(playerLinks[m.p2.name] || '', m.p2.name);
player2Div.innerHTML = `
<img loading="lazy" decoding="async" src="${safeSrc(av2.url)}" class="match-player-img" alt="${escapeHTML(m.p2.name)}">
<div class="match-player-name">${escapeHTML(m.p2.name)}</div>
`;

div.appendChild(player1Div);
div.appendChild(scoreDiv);
div.appendChild(player2Div);

let liveRow = buildMatchLiveRow(m);
if (liveRow) div.appendChild(liveRow);

if (m.s1 !== "" && m.s2 !== "" && m.s1 != null && m.s2 != null) {
    div.classList.add("is-done");
    let shareBtn = document.createElement("button");
    shareBtn.type = "button";
    shareBtn.className = "match-share-btn";
    shareBtn.innerHTML = `${ic("share")} شارك النتيجة`;
    shareBtn.onclick = (e) => { e.stopPropagation(); shareMatchCard(m); };
    div.appendChild(shareBtn);
}

return div;
}

/* ملخص بث الجولة بعد ما يخلص: النتائج اللي انلعبت في البث، أسرع جرس، أكبر فوز، وأفضل المتوقعين (من وثيقة البث نفسها) */
function buildRoundSummary(r) {
if (typeof liveMatchesCache === "undefined" || typeof bcBestMoment !== "function") return null;
const d = liveMatchesCache[bcId(r)];
if (!d || d.status !== "ended") return null;
const done = (d.order || []).filter(o => o.state === "done");
if (!done.length) return null;
const bm = bcBestMoment(d), board = bcPredBoard(d);
const box = document.createElement("details");
box.className = "round-summary";
box.innerHTML = `<summary>${ic("clapper")} ملخص بث الجولة ${escapeHTML(String(r))}</summary>
<div class="rs-body">
${done.map(o => `<div class="rs-row"><span>${escapeHTML(o.p1)}</span><b>${o.s2 || 0} - ${o.s1 || 0}</b><span>${escapeHTML(o.p2)}</span></div>`).join("")}
${bm.fast ? `<div class="rs-line">${ic("zap")} أسرع ضغطة جرس: <b>${escapeHTML(bm.fast.name)}</b> في ${bcSec(bm.fast.ms)} ثانية</div>` : ""}
${bm.big ? `<div class="rs-line">${ic("trophy")} أكبر فوز: <b>${escapeHTML(bm.big.w)}</b> ${bm.big.a} - ${bm.big.b}</div>` : ""}
${board.length ? `<div class="rs-line">${ic("target")} أفضل المتوقعين: ${board.slice(0, 3).map(x => `<b>${escapeHTML(x.name)}</b> (${x.ok}/${x.all})`).join("، ")}</div>` : ""}
</div>`;
return box;
}

function renderMatches() {
let upDiv = document.getElementById("upcoming");
let pastDiv = document.getElementById("past");
let homeUpDiv = document.getElementById("homeUpcoming");

if(!upDiv || !pastDiv) return;

upDiv.innerHTML = "";
pastDiv.innerHTML = "";
if(homeUpDiv) homeUpDiv.innerHTML = "";

let filterText = (document.getElementById("matchSearchInput") ? document.getElementById("matchSearchInput").value : "").trim().toLowerCase();

let upcomingGroup = {};
let pastGroup = {};

matches.forEach(m => {
if(filterText) {
let p1Match = m.p1.name.toLowerCase().includes(filterText);
let p2Match = m.p2.name.toLowerCase().includes(filterText);
if(!p1Match && !p2Match) return;
}

if(m.s1 === "" || m.s2 === "") {
if(!upcomingGroup[m.round]) upcomingGroup[m.round] = [];
upcomingGroup[m.round].push(m);
} else {
if(!pastGroup[m.round]) pastGroup[m.round] = [];
pastGroup[m.round].push(m);
}
});

let upRounds = Object.keys(upcomingGroup).map(Number).sort((a,b) => a - b);
if(upRounds.length === 0) {
upDiv.innerHTML = `<div class="empty-state">لا توجد مواجهات قادمة</div>`;
} else {
upRounds.forEach(r => {
let rHeader = document.createElement("h3");
rHeader.className = "round-head";
rHeader.textContent = `الجولة ${r}`;
upDiv.appendChild(rHeader);
let rLive = buildRoundLiveRow(r);
if (rLive) upDiv.appendChild(rLive);

upcomingGroup[r].forEach(m => {
upDiv.appendChild(createMatchCard(m));
});
});
}

let pastRounds = Object.keys(pastGroup).map(Number).sort((a,b) => b - a);
if(pastRounds.length === 0) {
pastDiv.innerHTML = `<div class="empty-state">لا توجد مواجهات سابقة</div>`;
} else {
pastRounds.forEach(r => {
let rHeader = document.createElement("h3");
rHeader.className = "round-head past";
rHeader.textContent = `الجولة ${r}`;
pastDiv.appendChild(rHeader);
let rSum = buildRoundSummary(r);
if (rSum) pastDiv.appendChild(rSum);

pastGroup[r].forEach(m => {
pastDiv.appendChild(createMatchCard(m));
});
});
}

if(homeUpDiv && upRounds.length > 0) {
let nextRound = upRounds[0];
let rHeader = document.createElement("h3");
rHeader.className = "round-head home";
rHeader.innerHTML = ic("ball") + ` المواجهات القادمة (الجولة ${nextRound})`;
homeUpDiv.appendChild(rHeader);
let hLive = buildRoundLiveRow(nextRound);
if (hLive) homeUpDiv.appendChild(hLive);

upcomingGroup[nextRound].forEach(m => {
homeUpDiv.appendChild(createMatchCard(m));
});
}
}

function showMiniTab(evt, tabName) {
let tabs = document.querySelectorAll(".mini-tab");
tabs.forEach(t => t.classList.remove("active"));
evt.currentTarget.classList.add("active");

document.getElementById("upcoming").style.display = (tabName === 'upcoming') ? 'block' : 'none';
document.getElementById("past").style.display = (tabName === 'past') ? 'block' : 'none';
}

/* التنقل بين التبويبات بانتقال ناعم (View Transitions) لو المتصفح يدعمه، وإلا يتبدل على طول */
function showTab(evt, sectionId) {
const tabEl = evt && evt.currentTarget;
const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!document.startViewTransition || reduce || !tabEl) return showTabNow(tabEl, sectionId);
document.startViewTransition(() => showTabNow(tabEl, sectionId));
}

function showTabNow(tabEl, sectionId) {
document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
document.querySelectorAll(".bottom-nav .tab").forEach(t => t.classList.remove("active"));

let activeSec = document.getElementById(sectionId);
if(activeSec) activeSec.classList.add("active");

let headerBranding = document.getElementById("headerBranding");
if(headerBranding) {
    if(sectionId === 'home') {
        headerBranding.style.display = "block";
    } else {
        headerBranding.style.display = "none";
    }
}
document.getElementById("mainHeader").classList.toggle("hdr-compact", sectionId !== 'home');

if(tabEl) {
tabEl.classList.add("active");
} else {
let navTabs = document.querySelectorAll(".bottom-nav .tab");
if(sectionId === 'home') navTabs[0].classList.add("active");
else if(sectionId === 'table') navTabs[1].classList.add("active");
else if(sectionId === 'matches') navTabs[2].classList.add("active");
else if(sectionId === 'predictions') navTabs[3].classList.add("active");
else if(sectionId === 'accountTab') navTabs[4].classList.add("active");
else if(sectionId === 'room') navTabs[5].classList.add("active");
}

if(sectionId === 'room') {
    startPresenceListener();
    renderRoomCard();
}
document.body.classList.toggle('room-tab', sectionId === 'room');
document.documentElement.style.setProperty('--hdr-h', document.getElementById('mainHeader').offsetHeight + 'px');
window.scrollTo(0, 0);
}
