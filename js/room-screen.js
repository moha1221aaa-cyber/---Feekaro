/* بطاقة الغرفة، ID الدخول، شاشة الغرفة الكاملة */
/* =====================================================================
   بطاقة الغرفة + ID الدخول + شاشة الغرفة الكاملة
   ===================================================================== */
let roomStateLoaded = false;
let roomScreenOpen = false;
let roomAccessIdCreating = false;

function getSavedRoomAccess() {
    try { return localStorage.getItem("masro7RoomAccess") || ""; } catch (e) { return ""; }
}
function setSavedRoomAccess(v) {
    try { localStorage.setItem("masro7RoomAccess", v); } catch (e) {}
}
function hasRoomAccess() {
    if (isAdmin) return true;
    const id = roomState.accessId ? String(roomState.accessId) : "";
    return !!id && getSavedRoomAccess() === id;
}

/* المسؤول: ينشأ ID تلقائي للغرفة إذا ما كان موجود */
function ensureRoomAccessId() {
    if (!isAdmin || !firebaseDB || !roomStateLoaded || roomState.accessId || roomAccessIdCreating) return;
    roomAccessIdCreating = true;
    const newId = String(Math.floor(100000 + Math.random() * 900000));
    firebaseDB.collection("room").doc("main").set({ accessId: newId }, { merge: true })
        .catch(err => console.log(err))
        .finally(() => { roomAccessIdCreating = false; });
}

function adminChangeRoomId(ev) {
    if (ev) ev.stopPropagation();
    if (!isAdmin) return;
    let v = prompt("اكتب ID جديد للغرفة (أرقام أو حروف).\nملاحظة: الكل بيحتاج يدخل الـ ID الجديد مرة ثانية.", roomState.accessId || "");
    if (v === null) return;
    v = v.trim();
    if (v.length < 3) return alert("الـ ID لازم يكون 3 خانات على الأقل");
    roomState.accessId = v;
    firebaseDB.collection("room").doc("main").set({ accessId: v }, { merge: true })
        .then(() => roomToast("تم تغيير ID الغرفة", "check"))
        .catch(err => alert("تعذّر تغيير الـ ID: " + err.message));
}

function adminCopyRoomId(ev) {
    if (ev) ev.stopPropagation();
    const v = roomState.accessId || "";
    if (!v) return;
    if (navigator.clipboard) navigator.clipboard.writeText(v).then(() => roomToast("تم نسخ ID الغرفة", "check")).catch(() => {});
}

function renderRoomCard() {
    const box = document.getElementById("roomCardBox");
    if (!box) return;
    ensureRoomAccessId();

    const live = !!roomState.isLive;
    const canEnter = live || isAdmin;
    /* المنظم ممكن يطلع وما يسكّر الغرفة: لو مفتوحة وما فيها أحد خلال آخر 45 ث ما نكتب "مباشر الآن" */
    const empty = live && presenceLoaded && presentCount() === 0;
    const access = hasRoomAccess();
    const seated = (roomState.mics || []).filter(m => m);
    let avatars = "";
    seated.slice(0, 7).forEach(m => {
        const url = m.avatar || getPlayerAvatar(m.name).url;
        avatars += `<img src="${safeSrc(cdnThumb(url))}" alt="">`;
    });
    if (seated.length > 7) avatars += `<span class="more">+${seated.length - 7}</span>`;
    if (!avatars) avatars = `<span class="empty">${live ? "ما أحد على المايك حالياً" : "الغرفة فاضية"}</span>`;

    let lockHTML = "";
    if (isAdmin) lockHTML = `<span class="rcd-lock ok">${ic("crown")} المسؤول</span>`;
    else if (access) lockHTML = `<span class="rcd-lock ok">${ic("check-circle")} مسموح لك</span>`;
    else lockHTML = `<span class="rcd-lock">${ic("lock")} تحتاج ID</span>`;

    let cta;
    if (!canEnter) cta = `${ic("lock")} الغرفة مغلقة حالياً`;
    else if (!access) cta = `${ic("lock")} اضغط وأدخل ID الغرفة`;
    else cta = `دخول الغرفة ${ic("chevron-right")}`;

    let html = `
<div class="room-card ${live && !empty ? "live" : ""} ${canEnter ? "" : "closed"}" onclick="onRoomCardClick()">
<div class="rcd-top">
<span class="rcd-badge"><span class="dot"></span>${live ? (empty ? "مفتوحة، ما فيها أحد" : "مباشر الآن") : "مغلقة"}</span>
${lockHTML}
</div>
<div class="rcd-main">
<div class="rcd-icon">${ic("mic")}</div>
<div>
<div class="rcd-title">الغرفة الصوتية</div>
<div class="rcd-sub">${live && roomState.hostName ? "المضيف: " + escapeHTML(roomState.hostName) : "دوري بنو مسروح للنخبة"}</div>
</div>
</div>
<div class="rcd-avatars">${avatars}</div>
<div class="rcd-stats">
<span>${ic("users")} الحاضرون: ${presentCount()}</span>
<span>${ic("mic")} على المايك: ${seated.length} / ${MIC_SLOTS}</span>
${roomState.game && roomState.game.active ? `<span>${ic("gamepad")} لعبة جارية</span>` : ""}
</div>
<div class="rcd-cta">${cta}</div>
</div>`;

    if (isAdmin) {
        html += `
<div class="rcd-admin">
<div>ID الغرفة: <b>${escapeHTML(roomState.accessId || "...")}</b></div>
<div style="display:flex;gap:6px;">
<button onclick="adminCopyRoomId(event)" style="background:#334155;">نسخ</button>
<button onclick="adminChangeRoomId(event)">تغيير</button>
</div>
</div>`;
    }
    box.innerHTML = `<div class="room-card-wrap">${html}</div>`;

    const idEl = document.getElementById("roomScreenId");
    if (idEl) idEl.textContent = isAdmin && roomState.accessId ? "ID: " + roomState.accessId : (live ? "● مباشر" : "مغلقة");
}

function onRoomCardClick() {
    if (!roomState.isLive && !isAdmin) {
        return roomToast("الغرفة مغلقة حالياً، تفتح مع بداية البث", "lock");
    }
    if (hasRoomAccess()) return openRoomScreen();
    if (!roomState.accessId) return roomToast("المسؤول ما حدد ID للغرفة بعد", "lock");
    openRoomIdModal();
}

function openRoomIdModal() {
    let modal = document.getElementById("roomIdModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "roomIdModal";
        modal.className = "modal-overlay";
        modal.innerHTML = `
<div class="modal-content">
<div class="modal-header">
<h3>${ic("lock")} دخول الغرفة</h3>
<button class="modal-back-btn" onclick="goBackModal()">${ic("chevron-right")} رجوع</button>
</div>
<div class="rid-box">
<p>أول مرة تدخل الغرفة؟ اكتب الـ ID اللي أعطاك إياه المسؤول.<br>بعدها تدخل على طول بدون ما تكتبه مرة ثانية.</p>
<input type="text" id="roomIdInput" placeholder="ID الغرفة" autocomplete="off" inputmode="text" onkeydown="if(event.key==='Enter'){event.preventDefault();submitRoomId();}">
<div class="rid-err" id="roomIdErr"></div>
<button onclick="submitRoomId()">دخول ${ic("chevron-right")}</button>
</div>
</div>`;
        document.body.appendChild(modal);
    }
    document.getElementById("roomIdErr").textContent = "";
    const inp = document.getElementById("roomIdInput");
    inp.value = "";
    openModal("roomIdModal");
    setTimeout(() => inp.focus(), 150);
}

function submitRoomId() {
    const inp = document.getElementById("roomIdInput");
    const err = document.getElementById("roomIdErr");
    const val = (inp.value || "").trim();
    const real = String(roomState.accessId || "");
    if (!val) { err.textContent = "اكتب الـ ID أول"; return; }
    if (val !== real) {
        err.textContent = "الـ ID غلط، تأكد منه وجرب مرة ثانية";
        inp.classList.remove("shake"); void inp.offsetWidth; inp.classList.add("shake");
        return;
    }
    setSavedRoomAccess(real);
    closeAllModalsDirectly();
    /* نستبدل حالة المودال في السجل بحالة الغرفة */
    try { window.history.replaceState({ roomOpen: true }, ""); } catch (e) {}
    openRoomScreen(true);
    renderRoomCard();
}

function openRoomScreen(skipPush) {
    const scr = document.getElementById("roomScreen");
    if (!scr) return;
    if (!roomScreenOpen && !skipPush) {
        try { window.history.pushState({ roomOpen: true }, ""); } catch (e) {}
    }
    roomScreenOpen = true;
    scr.classList.add("open");
    if (typeof screenAwake === "function") screenAwake("room", true);
    document.body.classList.add("room-open");
    joinRoomPresence();
    if (roomState.isLive && !agoraJoined) ensureAgoraJoined().catch(err => { agoraLastFail = Date.now(); console.error("تعذر الانضمام كمستمع لقناة أجورا:", err); });
    enableRoomAudio();
    renderRoomUI();
    roomViewportSync();
}

function closeRoomScreen(fromPop) {
    if (!roomScreenOpen) return;
    if (currentUser && roomState.mics) {
        const idx = roomState.mics.findIndex(m => m && m.uid === currentUser.uid);
        if (idx !== -1) {
            if (!fromPop && !confirm("أنت على المايك، إذا طلعت بتنزل من المايك. تبي تطلع؟")) return;
            releaseMicSlot(idx);
        }
    }
    if (!fromPop && window.history.state && window.history.state.roomOpen) {
        window.history.back(); /* popstate بيكمل الإغلاق */
        return;
    }
    roomScreenOpen = false;
    const scr = document.getElementById("roomScreen");
    if (scr) scr.classList.remove("open");
    document.body.classList.remove("room-open");
    const input = document.getElementById("roomChatInput");
    if (input) input.blur();
    composerTyping(false);
    leaveRoomPresence();
    renderRoomCard();
    if (typeof screenAwake === "function") screenAwake("room", false);
}

function leaveRoomPresence() {
    if (presenceInterval) { clearInterval(presenceInterval); presenceInterval = null; }
    if (firebaseDB) {
        firebaseDB.collection("room").doc("main").collection("presence").doc(myPresenceId()).delete().catch(() => {});
    }
}
