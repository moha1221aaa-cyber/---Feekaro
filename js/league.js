/* الدوري: ملف المتسابق، جدول الترتيب، الملخص، بطاقات المواجهات، التبويبات */
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
<img src="${safeSrc(photoUrl)}" style="width:100%; height:100%; object-fit:cover;" alt="">
</div>
<div style="font-size:18px; font-weight:bold; color:white; display:flex; align-items:center; justify-content:center; gap:5px;">
${escapeHTML(displayName)} ${av.isVerified ? '<span class="verified-badge" title="حساب موثوق"><svg class="ic" aria-hidden="true"><use href="#i-verified"/></svg></span>' : ''}
</div>
${userData && userData.email ? `<div style="font-size:12px; color:#94a3b8; direction:ltr; margin-top:3px;">${escapeHTML(userData.email)}</div>` : ''}
${statsHTML}
${predStatsHTML}
${playerMatchesHTML}
${adminButton}
</div>
`;

openModal("viewProfileModal");
}

function table() {
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

let tbody = document.getElementById("standings");
if(!tbody) return;
tbody.innerHTML = "";

players.forEach((p,i) => {
let row = document.createElement("tr");
let avatarData = getPlayerAvatar(p.name);
let verifiedBadge = avatarData.isVerified ? `<span class="verified-badge" title="حساب موثوق"><svg class="ic" aria-hidden="true"><use href="#i-verified"/></svg></span>` : '';

let playerCellHTML = `
<div class="table-player-cell clickable-profile" onclick="openUserProfile(${jsArg(playerLinks[p.name] || '')}, ${jsArg(p.name)})">
<img src="${safeSrc(avatarData.url)}" class="table-player-img" alt="${escapeHTML(p.name)}">
<span style="font-weight:bold;">${escapeHTML(p.name)}</span>${verifiedBadge}
</div>
`;

row.innerHTML = `<td>${i+1}</td><td>${playerCellHTML}</td><td>${p.w}</td><td>${p.d}</td><td>${p.l}</td><td>${p.gf}</td><td>${p.ga}</td><td><b>${p.pts}</b></td>`;
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

function createMatchCard(m) {
let div = document.createElement("div");
div.className = "match";

let av1 = getPlayerAvatar(m.p1.name);
let av2 = getPlayerAvatar(m.p2.name);

let player1Div = document.createElement("div");
player1Div.className = "match-player clickable-profile";
player1Div.onclick = () => openUserProfile(playerLinks[m.p1.name] || '', m.p1.name);
player1Div.innerHTML = `
<img src="${safeSrc(av1.url)}" class="match-player-img" alt="${escapeHTML(m.p1.name)}">
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
<img src="${safeSrc(av2.url)}" class="match-player-img" alt="${escapeHTML(m.p2.name)}">
<div class="match-player-name">${escapeHTML(m.p2.name)}</div>
`;

div.appendChild(player1Div);
div.appendChild(scoreDiv);
div.appendChild(player2Div);

let liveRow = buildMatchLiveRow(m);
if (liveRow) div.appendChild(liveRow);

return div;
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
upDiv.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8;">لا توجد مواجهات قادمة</div>`;
} else {
upRounds.forEach(r => {
let rHeader = document.createElement("h3");
rHeader.style.cssText = "text-align:center; color:#60a5fa; margin:15px 0 5px; font-size:15px;";
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
pastDiv.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8;">لا توجد مواجهات سابقة</div>`;
} else {
pastRounds.forEach(r => {
let rHeader = document.createElement("h3");
rHeader.style.cssText = "text-align:center; color:#facc15; margin:15px 0 5px; font-size:15px;";
rHeader.textContent = `الجولة ${r}`;
pastDiv.appendChild(rHeader);

pastGroup[r].forEach(m => {
pastDiv.appendChild(createMatchCard(m));
});
});
}

if(homeUpDiv && upRounds.length > 0) {
let nextRound = upRounds[0];
let rHeader = document.createElement("h3");
rHeader.style.cssText = "text-align:center; color:#60a5fa; margin:15px 0 10px; font-size:16px;";
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

function showTab(evt, sectionId) {
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

if(evt) {
evt.currentTarget.classList.add("active");
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
