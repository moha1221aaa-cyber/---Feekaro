/* الغرفة الصوتية: الحالة، الحضور، الواجهة والشات */
const MIC_SLOTS = 15;
const HOST_SEAT = 2; // مقعد المضيف المميز (الأوسط في الصف الأول)
function normalizeRoomMics() {
    const old = Array.isArray(roomState.mics) ? roomState.mics : [];
    roomState.mics = Array.from({ length: MIC_SLOTS }, (_, i) => old[i] || null);
}

let roomState = {
isLive: false,
hostName: "",
hostUid: "",
hostAvatar: "",
mics: Array(MIC_SLOTS).fill(null),
pinnedMsg: null,
chat: [],
game: { active: false, status: "idle", qText: "", ans1: "", ans2: "", s1: 0, s2: 0, p1Name: "", p2Name: "", p1Avatar: "", p2Avatar: "", timer: 30, reveal1: null, reveal2: null },
qbank: []
};

let roomListener = null;
let roomTimerInterval = null;

function initRoomFeature() {
if(!firebaseDB) return;
roomListener = firebaseDB.collection("room").doc("main").onSnapshot(doc => {
if(doc.exists) {
const wasLive = !!(roomState && roomState.isLive);
roomState = doc.data();
if (roomStateLoaded && !wasLive && roomState.isLive && !(currentUser && roomState.hostUid === currentUser.uid)) notify("الغرفة الصوتية مباشرة 🎙️", (roomState.hostName ? roomState.hostName + " فتح الغرفة" : "الغرفة الصوتية فتحت") + "، ادخل وشارك", "room_" + (roomState.startedAt || Date.now()), "/");
} else {
roomState = {
isLive: false, hostName: "", hostUid: "", hostAvatar: "",
mics: Array(MIC_SLOTS).fill(null), pinnedMsg: null, chat: [],
game: { active: false, status: "idle", qText: "", ans1: "", ans2: "", s1: 0, s2: 0, p1Name: "", p2Name: "", p1Avatar: "", p2Avatar: "", timer: 30, reveal1: null, reveal2: null },
qbank: []
};
}

roomStateLoaded = true;
normalizeRoomMics();
syncMyMicWithState();

/* أي شخص يفتح الغرفة وهي مباشرة ينضم تلقائيًا كمستمع في أجورا (بدون طلب
   إذن المايك)، حتى يسمع المتحدثين فعليًا لا كواجهة شكلية فقط. */
if(roomState.isLive && roomScreenOpen && !agoraJoined && Date.now() - agoraLastFail > 10000) {
ensureAgoraJoined().catch(err => { agoraLastFail = Date.now(); console.error("تعذر الانضمام كمستمع لقناة أجورا:", err); });
}
if(!roomState.isLive && agoraJoined) {
leaveVoiceChannel();
}

renderRoomUI();
});
}

function saveRoomState() {
if(!firebaseDB) return;
/* الـ ID ما يُحفظ من هنا (يتغير فقط من زر المسؤول) عشان نسخة قديمة ما ترجعه */
let roomData = Object.assign({}, roomState);
delete roomData.accessId;
firebaseDB.collection("room").doc("main").set(roomData, { merge: true }).catch(err => console.log(err));
}

let presenceListener = null;
let cachedPresence = {};
let presenceInterval = null;

function getGuestId() {
    let id = null;
    try { id = localStorage.getItem("guestId"); } catch (e) {}
    if (!id) {
        id = "g" + Math.random().toString(36).slice(2) + Date.now().toString(36);
        try { localStorage.setItem("guestId", id); } catch (e) {}
    }
    return id;
}

function myPresenceId() { return currentUser ? currentUser.uid : "guest_" + getGuestId(); }

function sendPresenceHeartbeat() {
    if (!firebaseDB) return;
    let name = (currentUserDocData && currentUserDocData.name) ? currentUserDocData.name
        : (currentUser ? (currentUser.displayName || (currentUser.email || "مستخدم").split("@")[0]) : "ضيف");
    let photoURL = (currentUserDocData && currentUserDocData.photoURL) ? currentUserDocData.photoURL : "";
    firebaseDB.collection("room").doc("main").collection("presence").doc(myPresenceId()).set({
        name: name, photoURL: photoURL, isAdmin: !!isAdmin,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(() => {});
}

let presenceLoaded = false;
function startPresenceListener() {
    if (!firebaseDB || presenceListener) return;
    presenceListener = firebaseDB.collection("room").doc("main").collection("presence").onSnapshot(snap => {
        cachedPresence = {};
        snap.forEach(d => { cachedPresence[d.id] = d.data(); });
        presenceLoaded = true;
        renderRoomUI();
        if (typeof renderRoomCard === "function") renderRoomCard();
        renderParticipantsModalIfOpen();
    });
}

function presentCount() {
    const now = Date.now();
    return Object.values(cachedPresence).filter(p => {
        const t = p.lastSeen && p.lastSeen.toMillis ? p.lastSeen.toMillis() : 0;
        return now - t < 45000;
    }).length;
}

function joinRoomPresence() {
    sendPresenceHeartbeat();
    startPresenceListener();
    if (!presenceInterval) presenceInterval = setInterval(sendPresenceHeartbeat, 20000);
}

function renderParticipantsModalIfOpen() {
    if (activeModalId === "roomParticipantsModal") renderParticipantsModal();
}

function renderParticipantsModal() {
    const body = document.getElementById("roomParticipantsModalBody");
    if (!body) return;
    const now = Date.now();
    const list = Object.entries(cachedPresence)
        .filter(([id, p]) => now - ((p.lastSeen && p.lastSeen.toMillis) ? p.lastSeen.toMillis() : 0) < 45000)
        .sort((a, b) => (b[1].isAdmin ? 1 : 0) - (a[1].isAdmin ? 1 : 0));
    if (list.length === 0) {
        body.innerHTML = `<div class="empty-ranking">لا يوجد أحد في الغرفة حالياً</div>`;
        return;
    }
    let html = `<div class="ranking-cards-container">`;
    list.forEach(([id, p]) => {
        let isMe = id === myPresenceId();
        let avatar = cdnThumb(p.photoURL) || `https://ui-avatars.com/api/?name=${encodeURIComponent((p.name || "ض").charAt(0))}&background=1c1c1c&color=fff&bold=true`;
        html += `
<div class="user-card ${isMe ? "is-me" : ""}">
<div class="user-card-profile">
<div class="user-card-avatar"><img loading="lazy" decoding="async" src="${safeSrc(avatar)}" alt=""></div>
<div class="user-card-info">
<div class="user-card-name">${escapeHTML(p.name || "ضيف")} ${isMe ? '<span class="user-me-badge">أنت</span>' : ""} ${p.isAdmin ? ic("crown","gold") : ""}</div>
</div>
</div>
</div>`;
    });
    html += `</div>`;
    body.innerHTML = html;
}

function openParticipantsModal() {
    renderParticipantsModal();
    openModal("roomParticipantsModal");
}

function renderRoomUI() {
let container = document.getElementById("roomContent");
let tabIcon = document.getElementById("roomTabIcon");
renderRoomCard();
if(!container) return;

if(tabIcon) {
tabIcon.style.color = roomState.isLive ? "#4ade80" : "#94a3b8";
}

if(!roomState.isLive && !isAdmin) {
container.innerHTML = `
<div class="room-offline-box">
<div class="room-offline-icon"><svg class="ic" aria-hidden="true"><use href="#i-mic"/></svg></div>
<h3>غرفة البث الصوتي مغلقة حالياً</h3>
<p style="font-size:12px; color:#94a3b8; margin-top:6px;">ستفتح الغرفة عند بدء البث المباشر والمسابقات من قبل المسؤول.</p>
</div>
`;
updateComposerState();
return;
}

let isHostOrAdmin = isAdmin || (currentUser && roomState.hostUid === currentUser.uid);

let html = "";

if(isAdmin && !roomState.isLive) {
html += `
<div style="text-align:center; margin-bottom:12px;">
<button onclick="startRoomBroadcast()" style="background:#059669; font-size:15px; padding:12px 24px;"><svg class="ic" aria-hidden="true"><use href="#i-mic"/></svg> بدء البث الصوتي المباشر</button>
</div>
`;
}

let seatedCount = (roomState.mics || []).filter(m => m).length;
html += `
<div class="room-toolbar">
<div class="room-live-badge ${roomState.isLive ? 'is-live' : ''}">
<div class="room-live-dot"></div>
<span>${roomState.isLive ? 'مباشر' : 'مغلق'}</span>
</div>
<div class="room-status-pill"><svg class="ic" aria-hidden="true"><use href="#i-mic"/></svg> على المايك: ${seatedCount} / ${MIC_SLOTS}</div>
<button class="room-status-pill room-presence-btn" onclick="openParticipantsModal()"><svg class="ic" aria-hidden="true"><use href="#i-users"/></svg> الحاضرون: ${presentCount()}</button>
</div>
`;

if(roomState.game && roomState.game.active) {
html += renderGameWidgetHTML();
}

html += `
<div class="mic-stage">
<div class="mic-grid">
`;

for(let i=0; i<MIC_SLOTS; i++) {
let m = roomState.mics[i];
if(m) {
let av = getPlayerAvatar(m.name);
let avatarUrl = m.avatar || av.url;
let isMine = currentUser && m.uid === currentUser.uid;
let clickAttr = isMine ? `onclick="toggleMyMic(${i})"` : (isAdmin ? `onclick="adminKickMic(${i})"` : '');
html += `
<div class="mic-slot${i === HOST_SEAT ? ' host-seat' : ''}">
<div class="mic-slot-avatar-wrap ${m.muted ? '' : 'speaking'}" ${clickAttr} style="cursor:${isMine || isAdmin ? 'pointer' : 'default'};">
<img loading="lazy" decoding="async" src="${safeSrc(cdnThumb(avatarUrl))}" class="mic-slot-avatar" alt="">
${m.muted ? '<div class="mic-slot-muted-icon">' + ic('mic-off') + '</div>' : ''}
</div>
<div class="mic-slot-name">${escapeHTML(m.name)}</div>
${isMine ? `<div style="font-size:9px;color:#f87171;cursor:pointer;margin-top:2px;" onclick="releaseMicSlot(${i})"><svg class="ic" aria-hidden="true"><use href="#i-x"/></svg> مغادرة المايك</div>` : ''}
</div>
`;
} else {
let canTakeMic = currentUser && roomState.isLive;
html += `
<div class="mic-slot${i === HOST_SEAT ? ' host-seat' : ''}">
<div class="mic-slot-empty" ${canTakeMic ? `onclick="takeMicSlot(${i})"` : ''} title="مقياس مايك فارغ"><svg class="ic" aria-hidden="true"><use href="#i-plus"/></svg></div>
<div class="mic-slot-vacant-label">${i === HOST_SEAT ? ic('crown','gold') + ' المضيف' : 'مايك ' + (i+1)}</div>
</div>
`;
}
}

html += `
</div>
</div>
`;

let pinnedHTML = "";
if(roomState.pinnedMsg) {
pinnedHTML = `
<div class="room-pinned-msg">
<div><svg class="ic" aria-hidden="true"><use href="#i-pin"/></svg> <strong>تثبيت:</strong> ${escapeHTML(roomState.pinnedMsg)}</div>
${isHostOrAdmin ? `<button onclick="unpinMessage()" style="margin:0; padding:2px 6px; font-size:10px; background:#dc2626;">إلغاء</button>` : ''}
</div>
`;
}

html += `
<div class="room-chat-box">
${pinnedHTML}
<div class="room-chat-messages" id="roomChatMessagesBox">
`;

if(roomState.chat && roomState.chat.length > 0) {
roomState.chat.forEach((msg, idx) => {
let av = getPlayerAvatar(msg.senderName);
let timeStr = msg.time || "";
html += `
<div class="room-chat-msg">
<img loading="lazy" decoding="async" src="${safeSrc(av.url)}" class="room-chat-msg-avatar" alt="">
<div class="room-chat-msg-body">
<div style="display:flex; justify-content:space-between; align-items:center;">
<span class="room-chat-msg-name">${escapeHTML(msg.senderName)}</span>
<span class="room-chat-msg-time">${escapeHTML(timeStr)}</span>
</div>
<div style="color:white; word-break:break-word;">${escapeHTML(msg.text)}</div>
${isHostOrAdmin ? `
<div class="room-chat-msg-actions">
<button onclick="pinMessage(${idx})"><svg class="ic" aria-hidden="true"><use href="#i-pin"/></svg> تثبيت</button>
<button onclick="deleteChatMessage(${idx})" style="background:#dc2626;">حذف</button>
</div>
` : ''}
</div>
</div>
`;
});
} else {
html += `<div style="text-align:center; color:#475569; padding:20px; font-size:12px;">لا توجد رسائل في الشات بعد... ابدأ المحادثة!</div>`;
}

html += `
</div>
</div>
`;

container.innerHTML = html;
updateComposerState();

let chatBox = document.getElementById("roomChatMessagesBox");
if(chatBox) chatBox.scrollTop = chatBox.scrollHeight;
}
