/* التوقعات: الحفظ، الحساب (5/3 نقاط)، ترتيب المتوقعين */
function loadPredictions() {
if(!firebaseDB || !currentUser) return;
if(predictionListener) predictionListener();

predictionListener = firebaseDB.collection("predictions")
.where("userId", "==", currentUser.uid)
.onSnapshot(snapshot => {
predictions = {};
snapshot.forEach(doc => {
let data = doc.data();
predictions[data.matchId] = data;
});
renderPredictions();
renderRankingUI();
});
}

function calculatePredictionPoints(pred, match) {
if(!pred || !match || match.s1 === "" || match.s2 === "") return 0;
let ps1 = Number(pred.s1), ps2 = Number(pred.s2);
let ms1 = Number(match.s1), ms2 = Number(match.s2);

if(ps1 === ms1 && ps2 === ms2) return 5; 

let predOutcome = (ps1 > ps2) ? 1 : ((ps1 < ps2) ? -1 : 0);
let matchOutcome = (ms1 > ms2) ? 1 : ((ms1 < ms2) ? -1 : 0);

if(predOutcome === matchOutcome) return 3; 
return 0;
}

function savePrediction(matchId, p1InputId, p2InputId) {
if(!currentUser) return alert("يرجى تسجيل الدخول لتتمكن من التوقع");

let s1Val = document.getElementById(p1InputId).value;
let s2Val = document.getElementById(p2InputId).value;

if(s1Val === "" || s2Val === "") return alert("يرجى كتابة أرقام التوقع بالكامل");

let docId = `${currentUser.uid}_${matchId}`;

firebaseDB.collection("predictions").doc(docId).set({
userId: currentUser.uid,
userEmail: currentUser.email || "",
matchId: matchId,
s1: Number(s1Val),
s2: Number(s2Val),
updatedAt: firebase.firestore.FieldValue.serverTimestamp()
}, { merge: true })
.then(() => {
alert("تم حفظ التوقع بنجاح");
})
.catch(err => alert("خطأ أثناء حفظ التوقع: " + err.message));
}

function renderPredictions() {
let container = document.getElementById("predictionContent");
if(!container) return;

if(!currentUser) {
container.innerHTML = `
<div class="account-box">
<h3><svg class="ic" aria-hidden="true"><use href="#i-lock"/></svg> توقع نتائج المواجهات</h3>
<p class="login-message">يرجى تسجيل الدخول من تبويب "الحساب" لتشترك في التوقعات وتكسب النقاط!</p>
<button onclick="showTab(null, 'accountTab')"><svg class="ic" aria-hidden="true"><use href="#i-rocket"/></svg> الذهاب لتسجيل الدخول</button>
</div>
`;
return;
}

let upcomingMatches = matches.filter(m => m.s1 === "" || m.s2 === "");
let completedMatches = matches.filter(m => m.s1 !== "" && m.s2 !== "");

let html = "";

if(upcomingMatches.length > 0) {
html += `<h3 style="text-align:center; color:#60a5fa; margin:10px 0;"><svg class="ic" aria-hidden="true"><use href="#i-ball"/></svg> المواجهات القادمة للتوقع</h3>`;
upcomingMatches.forEach(m => {
let matchId = getMatchId(m);
let pred = predictions[matchId] || { s1: "", s2: "" };
let p1InputId = `pred_input_1_${matchId}`;
let p2InputId = `pred_input_2_${matchId}`;
let av1 = getPlayerAvatar(m.p1.name);
let av2 = getPlayerAvatar(m.p2.name);

html += `
<div class="prediction-match">
<div class="prediction-round">جولة ${m.round}</div>
<div class="prediction-teams-box">
<div class="prediction-player">
<img src="${safeSrc(av1.url)}" class="prediction-player-img" alt="">
<div class="prediction-player-name">${escapeHTML(m.p1.name)}</div>
</div>
<div class="prediction-score">
<input type="number" id="${p1InputId}" min="0" value="${pred.s1 !== "" ? pred.s1 : ""}" placeholder="-">
<span>:</span>
<input type="number" id="${p2InputId}" min="0" value="${pred.s2 !== "" ? pred.s2 : ""}" placeholder="-">
</div>
<div class="prediction-player">
<img src="${safeSrc(av2.url)}" class="prediction-player-img" alt="">
<div class="prediction-player-name">${escapeHTML(m.p2.name)}</div>
</div>
</div>
<button class="prediction-save" onclick="savePrediction('${matchId}', '${p1InputId}', '${p2InputId}')"><svg class="ic" aria-hidden="true"><use href="#i-save"/></svg> حفظ التوقع</button>
</div>
`;
});
} else {
html += `<div style="text-align:center; padding:20px; color:#94a3b8;">لا توجد مواجهات قادمة للتوقع حالياً</div>`;
}

if(completedMatches.length > 0) {
html += `<h3 style="text-align:center; color:#facc15; margin:20px 0 10px;"><svg class="ic" aria-hidden="true"><use href="#i-clipboard"/></svg> نتائج توقعاتك السابقة</h3>`;
completedMatches.forEach(m => {
let matchId = getMatchId(m);
let pred = predictions[matchId];
if(pred) {
let pts = calculatePredictionPoints(pred, m);
let av1 = getPlayerAvatar(m.p1.name);
let av2 = getPlayerAvatar(m.p2.name);
let ptsColor = pts === 5 ? "#4ade80" : (pts === 3 ? "#38bdf8" : "#f87171");

html += `
<div class="prediction-match" style="border-color:#475569;">
<div class="prediction-round">جولة ${m.round} (انتهت)</div>
<div class="prediction-teams-box">
<div class="prediction-player">
<img src="${safeSrc(av1.url)}" class="prediction-player-img" alt="">
<div class="prediction-player-name">${escapeHTML(m.p1.name)}</div>
</div>
<div style="text-align:center;">
<div style="font-size:16px; font-weight:bold; color:white;">${m.s1} : ${m.s2}</div>
<div style="font-size:11px; color:#94a3b8; margin-top:2px;">توقعك: ${pred.s1} - ${pred.s2}</div>
</div>
<div class="prediction-player">
<img src="${safeSrc(av2.url)}" class="prediction-player-img" alt="">
<div class="prediction-player-name">${escapeHTML(m.p2.name)}</div>
</div>
</div>
<div class="prediction-points" style="color:${ptsColor};">+${pts} نقاط</div>
</div>
`;
}
});
}

container.innerHTML = html;
}

function switchPredictionTab(tab) {
document.querySelectorAll(".prediction-tab").forEach(t => t.classList.remove("active"));
document.querySelectorAll(".prediction-page").forEach(p => p.classList.remove("active"));

if(tab === 'predict') {
document.querySelectorAll(".prediction-tab")[0].classList.add("active");
document.getElementById("predictPage").classList.add("active");
} else {
document.querySelectorAll(".prediction-tab")[1].classList.add("active");
document.getElementById("rankingPage").classList.add("active");
renderRankingUI();
}
}

function startPredictionRanking() {
if(!firebaseDB) return;

usersRankingListener = firebaseDB.collection("users").onSnapshot(snapshot => {
cachedUsersData = {};
snapshot.forEach(doc => {
cachedUsersData[doc.id] = thumbUser(doc.data());
});
renderRankingUI();
table();
});

predictionsRankingListener = firebaseDB.collection("predictions").onSnapshot(snapshot => {
cachedPredictionsData = {};
snapshot.forEach(doc => {
cachedPredictionsData[doc.id] = doc.data();
});
renderRankingUI();
});
}

function getPredictionRankingList() {
let userScores = {};

Object.keys(cachedUsersData).forEach(uid => {
let u = cachedUsersData[uid];
userScores[uid] = {
uid: uid,
name: u.name || u.displayName || "مستخدم",
email: u.email || "",
photoURL: u.photoURL || "",
points: 0,
exactCount: 0,
correctCount: 0
};
});

Object.keys(cachedPredictionsData).forEach(docId => {
let pred = cachedPredictionsData[docId];
let uid = pred.userId;
if(!userScores[uid]) {
userScores[uid] = {
uid: uid,
name: "مستخدم",
email: pred.userEmail || "",
photoURL: "",
points: 0,
exactCount: 0,
correctCount: 0
};
}

let match = matches.find(m => getMatchId(m) === pred.matchId);
if(match && match.s1 !== "" && match.s2 !== "") {
let pts = calculatePredictionPoints(pred, match);
userScores[uid].points += pts;
if(pts === 5) userScores[uid].exactCount++;
else if(pts === 3) userScores[uid].correctCount++;
}
});

let list = Object.values(userScores);
list.sort((a,b) => b.points - a.points || b.exactCount - a.exactCount || b.correctCount - a.correctCount);
return list;
}

function renderRankingUI() {
let container = document.getElementById("rankingContent");
if(!container) return;

let list = getPredictionRankingList();

if(list.length === 0) {
container.innerHTML = `<div class="empty-ranking">لا يوجد متنافسون في التوقعات حالياً</div>`;
return;
}

let html = `<div class="ranking-cards-container">`;

list.forEach((item, index) => {
let isMe = (currentUser && item.uid === currentUser.uid);
let rank = index + 1;
let rankClass = rank === 1 ? "rank-1" : (rank === 2 ? "rank-2" : (rank === 3 ? "rank-3" : ""));
let rankBadge = rank === 1 ? ic("medal","m1") : (rank === 2 ? ic("medal","m2") : (rank === 3 ? ic("medal","m3") : rank));

let avatarSrc = cdnThumb(item.photoURL) || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name.charAt(0))}&background=2563eb&color=fff&bold=true`;

html += `
<div class="user-card ${isMe ? 'is-me' : ''}" onclick="openUserProfile('${item.uid}', '')">
<div class="user-card-rank ${rankClass}">${rankBadge}</div>
<div class="user-card-profile">
<div class="user-card-avatar">
<img src="${safeSrc(avatarSrc)}" alt="">
</div>
<div class="user-card-info">
<div class="user-card-name">
${escapeHTML(item.name)} ${isMe ? '<span class="user-me-badge">أنت</span>' : ''}
</div>
<div class="user-card-stats">توقع صحيح: ${item.exactCount + item.correctCount}</div>
</div>
</div>
<div class="user-card-score">
<div class="user-card-points">${item.points}</div>
<div class="user-card-points-label">نقطة</div>
</div>
</div>
`;
});

html += `</div>`;
container.innerHTML = html;
}

function getUserPredictionStats(targetUid, targetEmail) {
let rankingList = getPredictionRankingList();
let rankIndex = rankingList.findIndex(item => item.uid === targetUid || (targetEmail && item.email === targetEmail.toLowerCase()));

let totalPoints = 0;
let exactCount = 0;
let outcomeCount = 0;
let totalPredictionsCount = 0;

Object.keys(cachedPredictionsData).forEach(docId => {
let pred = cachedPredictionsData[docId];
if(pred && (pred.userId === targetUid || (targetEmail && pred.userEmail && pred.userEmail.toLowerCase() === targetEmail.toLowerCase()))) {
totalPredictionsCount++;
let match = matches.find(m => getMatchId(m) === pred.matchId);
if(match && match.s1 !== "" && match.s2 !== "") {
let pts = calculatePredictionPoints(pred, match);
if(pts === 5) { totalPoints += 5; exactCount++; }
else if(pts === 3) { totalPoints += 3; outcomeCount++; }
}
}
});

return {
rank: rankIndex !== -1 ? (rankIndex + 1) : "-",
points: totalPoints,
exact: exactCount,
correct: outcomeCount,
total: totalPredictionsCount
};
}
