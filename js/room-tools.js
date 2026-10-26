/* أدوات الغرفة: المؤثرات، شريط الكتابة، أدوات المسؤول، الألعاب، بنك الأسئلة */
/* ====== شريط الكتابة والأزرار الدائرية (مايك / سبيكر / ألعاب / أدوات المسؤول) ====== */
/* ===== المؤثرات الصوتية =====
   تُولَّد داخل الصفحة وتُرسل لأجورا كمسار صوتي مستقل عن المايك،
   فلا تمر على معالجات المتصفح (إلغاء الصدى / تقليل الضوضاء / التحكم التلقائي بالمستوى). */
let fxCtx = null, fxDest = null, fxMaster = null, fxComp = null, fxLocal = null;
let fxTrack = null, fxPublishPromise = null;
let rawMic = false;
try { rawMic = localStorage.getItem("rawMic") === "1"; } catch (e) {}

function micOptions() {
    return rawMic ? { AEC: false, ANS: false, AGC: false, encoderConfig: "music_standard" } : {};
}

function fxSyncLocal() { if (fxLocal) fxLocal.gain.value = speakerMuted ? 0 : 1; }

function fxBuildGraph() {
    if (fxComp) { try { fxComp.disconnect(); } catch (e) {} }
    if (fxMaster) { try { fxMaster.disconnect(); } catch (e) {} }
    fxComp = fxCtx.createDynamicsCompressor();
    fxComp.threshold.value = -14; fxComp.ratio.value = 6; fxComp.attack.value = 0.003; fxComp.release.value = 0.2;
    fxMaster = fxCtx.createGain();
    fxMaster.gain.value = 0.85;
    fxMaster.connect(fxComp);
    fxComp.connect(fxDest);
    fxLocal = fxCtx.createGain();
    fxComp.connect(fxLocal);
    fxLocal.connect(fxCtx.destination);
    fxSyncLocal();
}

function fxInit() {
    if (fxCtx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    fxCtx = new AC();
    fxDest = fxCtx.createMediaStreamDestination();
    fxBuildGraph();
}

function fxNoiseBuf(c) {
    if (!c.__noiseBuf) {
        const len = Math.floor(c.sampleRate * 3);
        const b = c.createBuffer(1, len, c.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        c.__noiseBuf = b;
    }
    return c.__noiseBuf;
}

function fxEnv(c, out, t, a, d, peak) {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    g.connect(out);
    return g;
}

function fxTone(c, out, type, f0, t, dur, peak, f1, lp) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = fxEnv(c, out, t, 0.012, dur, peak);
    if (lp) {
        const f = c.createBiquadFilter();
        f.type = "lowpass"; f.frequency.value = lp;
        o.connect(f); f.connect(g);
    } else {
        o.connect(g);
    }
    o.start(t);
    o.stop(t + dur + 0.05);
}

function fxNoiseHit(c, out, t, dur, peak, ftype, freq, q) {
    const src = c.createBufferSource();
    src.buffer = fxNoiseBuf(c);
    const f = c.createBiquadFilter();
    f.type = ftype; f.frequency.value = freq; f.Q.value = q || 0.7;
    const g = fxEnv(c, out, t, 0.003, dur, peak);
    src.connect(f); f.connect(g);
    src.start(t, Math.random() * 1.5, dur + 0.08);
}

const ROOM_FX = [
    { id: "applause", icon: ic("hand"), name: "تصفيق", play(c, o, t) {
        for (let i = 0; i < 110; i++) {
            const tt = t + Math.pow(Math.random(), 0.85) * 2.6;
            fxNoiseHit(c, o, tt, 0.06, 0.1 + Math.random() * 0.12, "bandpass", 1200 + Math.random() * 1800, 0.9);
        }
    } },
    { id: "correct", icon: ic("check-circle"), name: "إجابة صحيحة", play(c, o, t) {
        fxTone(c, o, "sine", 784, t, 0.35, 0.5);
        fxTone(c, o, "sine", 1175, t + 0.12, 0.6, 0.45);
        fxTone(c, o, "triangle", 1568, t + 0.12, 0.5, 0.15);
    } },
    { id: "wrong", icon: ic("x-circle"), name: "إجابة خاطئة", play(c, o, t) {
        fxTone(c, o, "sawtooth", 165, t, 0.28, 0.35, null, 1600);
        fxTone(c, o, "sawtooth", 123, t + 0.32, 0.55, 0.4, null, 1400);
    } },
    { id: "drum", icon: ic("drum"), name: "طبول", play(c, o, t) {
        let tt = t;
        while (tt < t + 1.8) {
            const k = (tt - t) / 1.8;
            fxNoiseHit(c, o, tt, 0.05, 0.12 + 0.35 * k, "highpass", 900, 0.7);
            fxTone(c, o, "sine", 180, tt, 0.06, 0.08 + 0.15 * k, 110);
            tt += 1 / (7 + 18 * k);
        }
        fxNoiseHit(c, o, t + 1.85, 1.2, 0.5, "highpass", 4000, 0.5);
        fxTone(c, o, "sine", 140, t + 1.85, 0.3, 0.7, 45);
    } },
    { id: "fanfare", icon: ic("megaphone"), name: "فوز", play(c, o, t) {
        [[523, 0], [659, 0.16], [784, 0.32]].forEach(([f, d]) => {
            fxTone(c, o, "sawtooth", f, t + d, 0.2, 0.2, null, 3000);
            fxTone(c, o, "square", f, t + d, 0.2, 0.07, null, 2500);
        });
        [523, 659, 784, 1047].forEach(f => {
            fxTone(c, o, "sawtooth", f, t + 0.5, 0.9, 0.14, null, 3000);
            fxTone(c, o, "triangle", f * 2, t + 0.5, 0.9, 0.05);
        });
    } },
    { id: "sad", icon: ic("frown"), name: "خسارة", play(c, o, t) {
        [[196, 0, 0.3], [185, 0.34, 0.3], [175, 0.68, 0.3], [165, 1.02, 0.9]].forEach(([f, d, dur]) =>
            fxTone(c, o, "sawtooth", f, t + d, dur, 0.3, f * 0.94, 1200));
    } },
    { id: "bell", icon: ic("bell"), name: "جرس", play(c, o, t) {
        fxTone(c, o, "sine", 880, t, 1.6, 0.4);
        fxTone(c, o, "sine", 2217, t, 1.0, 0.18);
        fxTone(c, o, "sine", 3520, t, 0.6, 0.08);
    } },
    { id: "alarm", icon: ic("alarm"), name: "انتهى الوقت", play(c, o, t) {
        for (let i = 0; i < 4; i++) fxTone(c, o, "square", 880, t + i * 0.22, 0.12, 0.2, null, 4000);
        fxTone(c, o, "square", 1175, t + 0.95, 0.5, 0.22, null, 4000);
    } }
];

async function fxEnsurePublished() {
    if (fxTrack) return;
    if (!fxPublishPromise) {
        fxPublishPromise = (async () => {
            fxInit();
            await ensureAgoraJoined();
            await agoraUpgradeToken(agoraClient);
            const track = AgoraRTC.createCustomAudioTrack({ mediaStreamTrack: fxDest.stream.getAudioTracks()[0] });
            try { await agoraClient.publish([track]); }
            catch (e) { track.close(); throw e; }
            fxTrack = track;
        })().finally(() => { fxPublishPromise = null; });
    }
    await fxPublishPromise;
}

async function fxTeardown() {
    if (!fxTrack) return;
    const t = fxTrack;
    fxTrack = null;
    try { await agoraClient.unpublish([t]); } catch (e) {}
    try { t.close(); } catch (e) {}
}

async function fxPlay(id) {
    const fx = ROOM_FX.find(e => e.id === id);
    if (!fx) return;
    fxInit();
    try { if (fxCtx.state === "suspended") await fxCtx.resume(); } catch (e) {}
    if (!fxTrack) {
        /* أول مرة: ننتظر اكتمال الإرسال للغرفة حتى لا يفوت الحاضرين بداية المؤثر */
        try { await fxEnsurePublished(); }
        catch (e) {
            console.error("تعذّر إرسال المؤثر للغرفة:", e);
            roomToast("المؤثر يعمل عندك فقط: " + (e.message || e.code || e), "alert");
        }
    }
    fxSyncLocal();
    fx.play(fxCtx, fxMaster, fxCtx.currentTime + 0.03);
}

function fxPlayQuiet(id) { try { fxPlay(id).catch(() => {}); } catch (e) {} }

function fxStopAll() {
    if (!fxCtx) return;
    fxBuildGraph();
    roomToast("أوقفت المؤثرات", "square");
}

function canUseFx() {
    if (!currentUser) return false;
    if (isAdmin || roomState.hostUid === currentUser.uid) return true;
    return !!(roomState.mics && roomState.mics.some(m => m && m.uid === currentUser.uid));
}

function renderFxModal() {
    const body = document.getElementById("roomFxBody");
    if (!body) return;
    let html = `<div class="fx-note">تُرسل المؤثرات مباشرة للغرفة كمسار صوتي مستقل، فلا تمر عبر المايك ولا يعالجها المتصفح (إلغاء الصدى وتقليل الضوضاء).</div><div class="fx-grid">`;
    ROOM_FX.forEach(fx => {
        html += `<button class="fx-btn" onclick="fxPlay('${fx.id}')"><span class="fx-ico">${fx.icon}</span><span>${escapeHTML(fx.name)}</span></button>`;
    });
    html += `</div>
<button class="tool-row" onclick="fxStopAll()"><svg class="ic" aria-hidden="true"><use href="#i-square"/></svg> إيقاف كل المؤثرات</button>
<div class="fx-switch">
<div class="fx-switch-txt">
<div class="fx-sw-title"><svg class="ic" aria-hidden="true"><use href="#i-sliders"/></svg> مايك بدون معالجة المتصفح</div>
<div class="fx-sw-desc">يوقف إلغاء الصدى وتقليل الضوضاء والتحكم التلقائي بمستوى الصوت لتحصل على صوت أنقى. استخدم سماعات حتى لا يرجع الصدى.</div>
</div>
<button class="fx-toggle ${rawMic ? "on" : ""}" onclick="setRawMic(!rawMic)" aria-label="مايك بدون معالجة"></button>
</div>`;
    body.innerHTML = html;
}

function openFxModal() {
    if (!canUseFx()) { roomToast("اجلس على مقعد لتستخدم المؤثرات", "music"); return; }
    renderFxModal();
    openModal("roomFxModal");
}

async function setRawMic(on) {
    rawMic = !!on;
    try { localStorage.setItem("rawMic", rawMic ? "1" : "0"); } catch (e) {}
    renderFxModal();
    if (localAudioTrack) {
        /* نعيد تشغيل المايك بالإعداد الجديد */
        try {
            await unpublishMyMic();
            await publishMyMic();
            syncMyMicWithState();
        } catch (e) {
            console.error(e);
            roomToast("تعذّر إعادة تشغيل المايك: " + (e.message || e.code || e), "alert");
            return;
        }
    }
    roomToast(rawMic ? "المايك الآن بدون معالجة المتصفح" : "رجع المايك للمعالجة العادية", "sliders");
}

function roomToast(msg, icon) {
    const old = document.getElementById("roomToastEl");
    if (old) old.remove();
    const el = document.createElement("div");
    el.id = "roomToastEl";
    el.className = "room-toast";
    el.innerHTML = (icon ? ic(icon) + " " : "") + escapeHTML(msg);
    document.body.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 2200);
}

function canManageRoom() {
    return !!(isAdmin || (currentUser && roomState.hostUid === currentUser.uid));
}

function updateComposerState() {
    const bar = document.getElementById("roomComposer");
    if (!bar) return;
    bar.style.display = roomState.isLive ? "flex" : "none";
    if (!roomState.isLive) composerTyping(false);

    const admin = document.getElementById("rcAdminBtn");
    if (admin) admin.style.display = isAdmin ? "flex" : "none";

    const fxBtn = document.getElementById("rcFxBtn");
    if (fxBtn) fxBtn.style.display = canUseFx() ? "flex" : "none";

    const games = document.getElementById("rcGamesBtn");
    if (games) games.className = "rc-btn" + (roomGameActive() ? " on" : "");

    const sp = document.getElementById("rcSpeakerBtn");
    if (sp) {
        sp.innerHTML = speakerMuted ? ic("volume-x") : ic("volume-2");
        sp.className = "rc-btn" + (speakerMuted ? " off" : "");
    }

    const mic = document.getElementById("rcMicBtn");
    if (mic) {
        const seat = (currentUser && roomState.mics) ? roomState.mics.findIndex(m => m && m.uid === currentUser.uid) : -1;
        if (seat === -1) mic.className = "rc-btn dim";
        else if (roomState.mics[seat].muted) mic.className = "rc-btn off slash";
        else mic.className = "rc-btn on";
    }
}

/* عند الكتابة: تختفي الأزرار ويظهر سهم الإرسال، وترجع عند الإرسال أو إغلاق الكيبورد */
function composerTyping(on) {
    const bar = document.getElementById("roomComposer");
    if (bar) bar.classList.toggle("typing", !!on);
    document.body.classList.toggle("room-typing", !!on);
}
function composerBlurSoon() {
    setTimeout(() => {
        const input = document.getElementById("roomChatInput");
        if (!input || document.activeElement !== input) composerTyping(false);
    }, 120);
}
let kbWasOpen = false;
let roomBaseH = window.innerHeight;
function roomViewportSync() {
    const vv = window.visualViewport;
    const typing = document.body.classList.contains("room-typing");
    const curH = vv ? Math.min(window.innerHeight, vv.height) : window.innerHeight;
    if (!typing) {
        /* بدون كتابة لا يوجد كيبورد: هذا هو الارتفاع الكامل */
        if (!vv || vv.height >= window.innerHeight - 5) roomBaseH = window.innerHeight;
        document.documentElement.style.removeProperty("--kb");
        kbWasOpen = false;
        return;
    }
    /* ارتفاع الكيبورد (يعمل سواء تقلّصت نافذة العرض أو تقلّصت العرض المرئي فقط) */
    const kb = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    document.documentElement.style.setProperty("--kb", kb + "px");
    if (curH < roomBaseH - 120) { kbWasOpen = true; return; }
    if (kbWasOpen) {
        /* أُغلق الكيبورد بينما المربع ما زال مفعّلاً: نُرجع الأزرار */
        kbWasOpen = false;
        const input = document.getElementById("roomChatInput");
        if (input) input.blur();
        composerTyping(false);
    }
}
if (window.visualViewport) window.visualViewport.addEventListener("resize", roomViewportSync);
window.addEventListener("resize", roomViewportSync);
window.addEventListener("orientationchange", () => { roomBaseH = 0; setTimeout(() => { roomBaseH = window.innerHeight; }, 400); });

function onMicButton() {
    if (!currentUser) return roomToast("سجّل دخولك من تبويب الحساب أولاً");
    const idx = roomState.mics.findIndex(m => m && m.uid === currentUser.uid);
    if (idx === -1) return roomToast("اجلس على أحد المقاعد لتتحدث", "mic");
    toggleMyMic(idx);
    updateComposerState();
}

function applySpeakerState() {
    try {
        if (agoraClient) agoraClient.remoteUsers.forEach(u => { if (u.audioTrack) u.audioTrack.setVolume(speakerMuted ? 0 : 100); });
    } catch (e) { console.error(e); }
}
function toggleSpeaker() {
    speakerMuted = !speakerMuted;
    applySpeakerState();
    fxSyncLocal();
    if (!speakerMuted) enableRoomAudio();
    updateComposerState();
    refreshAgoraStatus();
    roomToast(speakerMuted ? "كتمت صوت الغرفة عندك" : "شغّلت صوت الغرفة", speakerMuted ? "volume-x" : "volume-2");
}

function openAdminToolsModal() {
    if (!isAdmin) return;
    const body = document.getElementById("roomAdminToolsBody");
    if (!body) return;
    body.innerHTML = `
<button class="tool-row" onclick="adminToolsAction('qbank')"><svg class="ic" aria-hidden="true"><use href="#i-book"/></svg> إدارة قاعدة الأسئلة</button>
<button class="tool-row" onclick="adminToolsAction('clear')"><svg class="ic" aria-hidden="true"><use href="#i-mic-off"/></svg> تفريغ كل المايكات</button>
<button class="tool-row danger" onclick="adminToolsAction('end')"><svg class="ic" aria-hidden="true"><use href="#i-power"/></svg> إنهاء البث وإغلاق الغرفة</button>
`;
    openModal("roomAdminToolsModal");
}
function adminToolsAction(action) {
    if (!isAdmin) return;
    closeAllModalsDirectly();
    if (action === "qbank") openQBankModal();
    else if (action === "clear") clearAllMics();
    else if (action === "end") { if (confirm("إنهاء البث وإغلاق الغرفة للجميع؟")) endRoomBroadcast(); }
}

/* قائمة الألعاب: لإضافة لعبة جديدة مستقبلاً أضف عنصراً هنا بنفس الشكل { id, icon, name, desc, start } */
const ROOM_GAMES = [
    { id: "quiz", icon: ic("gamepad"), name: "مسابقة الأسئلة", desc: "تحدٍّ بين متسابقين بسؤال من قاعدة الأسئلة", start: function () { openGameStartModal(); } },
    { id: "som", icon: ic("dice"), name: "السوم", desc: "أوراق وسوم ومفاوضة: كل واحد معه 10,000، وصاحب أعلى سوم يفاوض، واللي يرفض يداقش (2 لين 8 لاعبين)", start: function () { somCreate(); } }
];
function roomGameActive() { return !!(roomState.game && roomState.game.active) || (typeof somActiveGame === "function" && somActiveGame()); }

function openRoomGamesModal() {
    const body = document.getElementById("roomGamesBody");
    if (!body) return;
    const active = roomGameActive();
    const manage = canManageRoom() && roomState.isLive;
    let html = "";
    if (active) html += `<div class="game-note live"><svg class="ic" aria-hidden="true"><use href="#i-dot"/></svg> توجد لعبة جارية الآن</div>`;
    else if (!manage) html += `<div class="game-note">يختار المضيف اللعبة ويبدأها</div>`;
    ROOM_GAMES.forEach((g, i) => {
        html += `
<div class="game-row">
<div class="game-row-ico">${g.icon}</div>
<div class="game-row-info">
<div class="game-row-name">${escapeHTML(g.name)}</div>
<div class="game-row-desc">${escapeHTML(g.desc)}</div>
</div>
<button class="game-row-btn" ${(manage && !active) ? `onclick="startRoomGame(${i})"` : "disabled"}>ابدأ</button>
</div>
`;
    });
    body.innerHTML = html;
    openModal("roomGamesModal");
}
function startRoomGame(i) {
    const g = ROOM_GAMES[i];
    if (!g || !canManageRoom()) return;
    closeAllModalsDirectly();
    g.start();
}

function startRoomBroadcast() {
if(!isAdmin) return;
roomState.isLive = true;
roomState.hostName = currentUser.displayName || currentUser.email.split('@')[0] || "المسؤول";
roomState.hostUid = currentUser.uid;
roomState.hostAvatar = (currentUserDocData && currentUserDocData.photoURL) ? currentUserDocData.photoURL : "";

/* بداية جلسة جديدة: نفرّغ المقاعد ونجلس المسؤول على مقعد المضيف الذهبي */
roomState.mics = Array(MIC_SLOTS).fill(null);
roomState.mics[HOST_SEAT] = { uid: currentUser.uid, name: roomState.hostName, avatar: roomState.hostAvatar, muted: false };

joinVoiceChannel("masro7_main_room", currentUser.uid).catch(() => {
    /* فشل تشغيل المايك: نحرر مقعد المضيف حتى لا يبقى محجوزاً بدون صوت */
    if (roomState.mics[HOST_SEAT] && roomState.mics[HOST_SEAT].uid === currentUser.uid) {
        roomState.mics[HOST_SEAT] = null;
        saveRoomState(["mics"]);
    }
});
saveRoomState(["mics"]);
alert("تم بدء البث الصوتي المباشر بنجاح!");
}

function endRoomBroadcast() {
if(!isAdmin) return;
leaveVoiceChannel();
roomState.isLive = false;
roomState.hostName = "";
roomState.hostUid = "";
roomState.mics = Array(MIC_SLOTS).fill(null);
roomState.game.active = false;
if (typeof somActiveGame === "function" && somActiveGame()) somDo({ t: "close" }, true);
saveRoomState(["mics"]);
alert("تم إنهاء البث المباشر وإغلاق الغرفة.");
}

async function takeMicSlot(index) {
if(!currentUser || !roomState.isLive) return;
if(roomState.mics[index]) return;
if(roomState.mics.some(m => m && m.uid === currentUser.uid)) {
    return alert('أنت على مايك بالفعل، اضغط "مغادرة المايك" أولاً.');
}
let myName = currentUserDocData && currentUserDocData.name ? currentUserDocData.name : (currentUser.displayName || "مستخدم");
let myPhoto = currentUserDocData && currentUserDocData.photoURL ? currentUserDocData.photoURL : "";

const mine = { uid: currentUser.uid, name: String(myName).slice(0, 60), avatar: myPhoto, muted: false };
/* المقعد يتحجز من آخر نسخة في القاعدة: لو أحد سبقني له أو أنا على مقعد ثاني، ما ينحجز (roomUserTx) */
let got = null;
try {
    got = await roomUserTx(d => {
        const m = roomMicsOf(d);
        if (!d.isLive || m[index] || m.some(x => x && x.uid === currentUser.uid)) return null;
        m[index] = mine;
        return { mics: m };
    });
} catch (e) { got = null; }
if (!got) return roomToast("المقعد انحجز أو الغرفة تغيّرت، جرّب مقعد ثاني", "alert");
roomState.mics[index] = mine;
renderRoomUI();

try {
    await joinVoiceChannel("masro7_main_room", currentUser.uid);
} catch (e) {
    // فشل تشغيل المايك: نحرر المقعد حتى لا يبقى محجوزاً بدون صوت
    roomReleaseMySeat(index);
}
}

// تفريغ كل مقاعد المايك (للمسؤول)
function clearAllMics() {
if(!isAdmin) return;
if(!confirm("هل تريد تفريغ كل مقاعد المايك؟")) return;
roomState.mics = Array(MIC_SLOTS).fill(null);
saveRoomState(["mics"]);
}

// تحرير مقعد المايك عند إغلاق الصفحة (قدر الإمكان)
window.addEventListener("pagehide", () => {
try {
    if(!currentUser || !roomState || !roomState.mics) return;
    let idx = roomState.mics.findIndex(m => m && m.uid === currentUser.uid);
    if(idx !== -1) { roomState.mics[idx] = null; roomReleaseMySeat(idx); }
} catch (e) {}
});

function sendRoomChat() {
let input = document.getElementById("roomChatInput");
if(!input || !input.value.trim()) return;
if(!currentUser) return alert("يرجى تسجيل الدخول للكتابة في الشات");

let text = input.value.trim();
let myName = currentUserDocData && currentUserDocData.name ? currentUserDocData.name : (currentUser.displayName || "مستخدم");
let timeNow = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

const msg = { senderUid: currentUser.uid, senderName: String(myName).slice(0, 60), text: text.slice(0, 500), time: timeNow };
if(!roomState.chat) roomState.chat = [];
roomState.chat.push(msg);
if(roomState.chat.length > 50) roomState.chat.shift();
renderRoomUI();
input.value = "";
/* رسالتي بس على آخر الشات (roomUserTx، والقواعد ترفض أي تغيير ثاني في رسائل غيري) */
roomUserTx(d => ({ chat: (Array.isArray(d.chat) ? d.chat : []).concat([msg]).slice(-50) }))
.catch(() => roomToast("ما وصلت رسالتك، جرّب مرة ثانية", "alert"));
input.blur();
composerTyping(false);
}

function pinMessage(index) {
if(!roomState.chat[index]) return;
roomState.pinnedMsg = roomState.chat[index].text;
saveRoomState();
}

function unpinMessage() {
roomState.pinnedMsg = null;
saveRoomState();
}

function deleteChatMessage(index) {
if(!roomState.chat[index]) return;
roomState.chat.splice(index, 1);
saveRoomState(["chat"]);
}

function openGameStartModal() {
let body = document.getElementById("roomPlayerPickerModalBody");
if(!body) return;

let qOptions = "";
if(roomBank && roomBank.length > 0) {
roomBank.forEach((q, idx) => {
qOptions += `<option value="${idx}">${escapeHTML(q.text)}</option>`;
});
} else {
qOptions = `<option value="">لا توجد أسئلة مضافة في القاعدة</option>`;
}

body.innerHTML = `
<div style="text-align:right;">
<h4 style="color:#60a5fa; margin-top:0;">اختر السؤال للمعركة</h4>
<select id="gameSelectedQIndex" style="width:100%; padding:10px; background:#334155; border:1px solid #475569; color:white; border-radius:8px; margin-bottom:12px;">
${qOptions}
</select>

<h4 style="color:#60a5fa;">اختر المتسابق الأول (أو اكتب اسماً)</h4>
<input type="text" id="gameP1NameInput" placeholder="اسم المتسابق الأول (مثال: أحمد)" style="width:100%; padding:9px; background:#334155; border:1px solid #475569; color:white; border-radius:8px; margin-bottom:12px; box-sizing:border-box;">

<h4 style="color:#60a5fa;">اختر المتسابق الثاني</h4>
<input type="text" id="gameP2NameInput" placeholder="اسم المتسابق الثاني (مثال: سعود)" style="width:100%; padding:9px; background:#334155; border:1px solid #475569; color:white; border-radius:8px; margin-bottom:12px; box-sizing:border-box;">

<button onclick="launchGameFromModal()" style="width:100%; background:#059669;"><svg class="ic" aria-hidden="true"><use href="#i-rocket"/></svg> بدء التحدي الآن</button>
</div>
`;

openModal("roomPlayerPickerModal");
}

function launchGameFromModal() {
let qSelect = document.getElementById("gameSelectedQIndex");
let p1Input = document.getElementById("gameP1NameInput");
let p2Input = document.getElementById("gameP2NameInput");

if(!qSelect || qSelect.value === "") return alert("يرجى اختيار سؤال صالح من قاعدة الأسئلة");
let qIdx = Number(qSelect.value);
let qObj = roomBank[qIdx];
if(!qObj) return alert("السؤال غير موجود");

let p1Name = p1Input.value.trim() || "المتسابق 1";
let p2Name = p2Input.value.trim() || "المتسابق 2";

let av1 = getPlayerAvatar(p1Name);
let av2 = getPlayerAvatar(p2Name);

roomState.game = {
active: true,
status: "running",
qText: qObj.text,
s1: 0,
s2: 0,
p1Name: p1Name,
p2Name: p2Name,
p1Avatar: av1.url,
p2Avatar: av2.url,
timer: 30,
reveal1: null,
reveal2: null
};

saveRoomState();
closeAllModalsDirectly();
alert("بدأت المسابقة في الغرفة!");
}

function renderGameWidgetHTML() {
let g = roomState.game;
let statusClass = g.status === 'running' ? 'running' : 'ended';
let statusText = g.status === 'running' ? 'تحدي قائم الآن' : 'انتهت المواجهة';

return `
<div class="game-widget">
<span class="game-status-badge ${statusClass}">${statusText}</span>
<div class="game-header-title"><svg class="ic" aria-hidden="true"><use href="#i-zap"/></svg> منافسة مباشرة في الغرفة</div>

<div class="vs-box">
<div class="player-circle-wrap">
<img src="${safeSrc(g.p1Avatar)}" class="player-circle" alt="">
<div class="player-circle-name">${escapeHTML(g.p1Name)}</div>
</div>
<div class="score-box">${escapeHTML(String(g.s1))} - ${escapeHTML(String(g.s2))}</div>
<div class="player-circle-wrap">
<img src="${safeSrc(g.p2Avatar)}" class="player-circle" alt="">
<div class="player-circle-name">${escapeHTML(g.p2Name)}</div>
</div>
</div>

<div class="question-card">
<div class="question-card-label">السؤال الموجه:</div>
<div class="question-card-text">${escapeHTML(g.qText)}</div>
</div>

<div class="timer-wrap">
<div class="timer-circle-num ${g.timer <= 5 ? 'low' : ''}">${g.timer}</div>
</div>

<div class="answer-boxes">
<div class="answer-box-col ${g.reveal1 !== null ? (g.reveal1 ? 'revealed correct' : 'revealed wrong') : ''}">
<div class="answer-box-col-label">إجابة ${escapeHTML(g.p1Name)}</div>
${g.status === 'running' ? `<input type="text" id="gameInputP1" placeholder="اكتب الإجابة..." onkeydown="if(event.key==='Enter') submitGameAnswer(1)">` : `<div class="answer-reveal-text">${escapeHTML(g.revealText1 || 'تمت الإجابة')}</div>`}
${g.reveal1 !== null ? `<div class="answer-reveal-tag ${g.reveal1 ? 'correct' : 'wrong'}">${g.reveal1 ? '<svg class="ic" aria-hidden="true"><use href="#i-check"/></svg> صحيحة (+1)' : '<svg class="ic" aria-hidden="true"><use href="#i-x"/></svg> خاطئة'}</div>` : ''}
</div>

<div class="answer-box-col ${g.reveal2 !== null ? (g.reveal2 ? 'revealed correct' : 'revealed wrong') : ''}">
<div class="answer-box-col-label">إجابة ${escapeHTML(g.p2Name)}</div>
${g.status === 'running' ? `<input type="text" id="gameInputP2" placeholder="اكتب الإجابة..." onkeydown="if(event.key==='Enter') submitGameAnswer(2)">` : `<div class="answer-reveal-text">${escapeHTML(g.revealText2 || 'تمت الإجابة')}</div>`}
${g.reveal2 !== null ? `<div class="answer-reveal-tag ${g.reveal2 ? 'correct' : 'wrong'}">${g.reveal2 ? '<svg class="ic" aria-hidden="true"><use href="#i-check"/></svg> صحيحة (+1)' : '<svg class="ic" aria-hidden="true"><use href="#i-x"/></svg> خاطئة'}</div>` : ''}
</div>
</div>

${isAdmin ? `
<div class="admin-game-dock">
<h4><svg class="ic" aria-hidden="true"><use href="#i-settings"/></svg> تحكم المسؤول باللعبة</h4>
<div class="admin-btn-group">
<button onclick="judgeGameAnswer(1, true)" style="background:#059669;"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg> صح للمتسابق 1</button>
<button onclick="judgeGameAnswer(1, false)" style="background:#dc2626;"><svg class="ic" aria-hidden="true"><use href="#i-x"/></svg> خطأ للمتسابق 1</button>
<button onclick="judgeGameAnswer(2, true)" style="background:#059669;"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg> صح للمتسابق 2</button>
<button onclick="judgeGameAnswer(2, false)" style="background:#dc2626;"><svg class="ic" aria-hidden="true"><use href="#i-x"/></svg> خطأ للمتسابق 2</button>
<button onclick="endActiveGame()" style="background:#7f1d1d; width:100%; margin-top:6px;"><svg class="ic" aria-hidden="true"><use href="#i-power"/></svg> إنهاء المسابقة وإعلان النتيجة</button>
</div>
</div>
` : ''}
</div>
`;
}

function submitGameAnswer(playerNum) {
let inputId = playerNum === 1 ? "gameInputP1" : "gameInputP2";
let input = document.getElementById(inputId);
if(!input || !input.value.trim()) return;

let ansText = input.value.trim().slice(0, 100);
if(!currentUser) return alert("يرجى تسجيل الدخول");
roomState.game["revealText" + playerNum] = ansText;
/* حقل الجواب بس (roomUserTx في room.js) */
roomUserTx(d => (d.game && d.game.active) ? { ["game.revealText" + playerNum]: ansText } : null)
.then(u => alert(u ? "تم إرسال الإجابة بنجاح!" : "المسابقة انتهت"))
.catch(() => alert("ما وصل جوابك، جرّب مرة ثانية"));
}

function judgeGameAnswer(playerNum, isCorrect) {
if(!isAdmin) return;
let g = roomState.game;

if(playerNum === 1) {
g.reveal1 = isCorrect;
if(isCorrect) g.s1++;
} else {
g.reveal2 = isCorrect;
if(isCorrect) g.s2++;
}

fxPlayQuiet(isCorrect ? "correct" : "wrong");
saveRoomState();
}

function endActiveGame() {
if(!isAdmin) return;
roomState.game.status = "ended";
roomState.game.active = false;
fxPlayQuiet("fanfare");
saveRoomState();
alert("تم إنهاء المسابقة بنجاح!");
}

function openQBankModal() {
renderQBankList();
openModal("roomQBankModal");
}

function renderQBankList() {
let container = document.getElementById("qbankListBox");
if(!container) return;

if(!roomBank || roomBank.length === 0) {
container.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:15px; font-size:13px;">لا توجد أسئلة مضافة في القاعدة حالياً</div>`;
return;
}

let html = "";
roomBank.forEach((q, idx) => {
html += `
<div class="qbank-item">
<div class="qbank-item-text">
<strong>س${idx+1}:</strong> ${escapeHTML(q.text)}
<div style="font-size:11px; color:#4ade80; margin-top:2px;">الإجابة: ${escapeHTML(q.answer)}</div>
</div>
<div class="qbank-item-actions">
<button onclick="deleteQuestionFromBank(${idx})" style="background:#dc2626;">حذف</button>
</div>
</div>
`;
});

container.innerHTML = html;
}

function addQuestionToBank() {
let textInput = document.getElementById("qbankNewText");
let answerInput = document.getElementById("qbankNewAnswer");

let text = textInput.value.trim();
let answer = answerInput.value.trim();

if(!text || !answer) return alert("يرجى كتابة نص السؤال والإجابة الصحيحة");

roomBank.push({ text: text, answer: answer });

textInput.value = "";
answerInput.value = "";
saveRoomBank();
renderQBankList();
alert("تمت إضافة السؤال إلى القاعدة بنجاح!");
}

/* استيراد أسئلة من CSV: كل سطر سؤال وإجابة (فاصلة، فاصلة عربية، فاصلة منقوطة، أو تاب). السطر الأول يتجاهل لو عنوان */
function parseQBankCsv(text) {
const rows = [];
String(text).replace(/^\uFEFF/, "").split(/\r?\n/).forEach(line => {
    if (!line.trim()) return;
    const cells = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
        else if (ch === '"' && !cur.trim()) q = true;
        else if (",،;\t".includes(ch) && cells.length === 0) { cells.push(cur); cur = ""; }
        else cur += ch;
    }
    cells.push(cur);
    const t = (cells[0] || "").trim(), a = (cells[1] || "").trim();
    if (t && a) rows.push({ text: t.slice(0, 300), answer: a.slice(0, 120) });
});
if (rows.length && /^(ال)?سؤال$|^question$/i.test(rows[0].text) && /^(ال)?(إجابة|اجابة|جواب)( الصحيحة)?$|^answer$/i.test(rows[0].answer)) rows.shift();
return rows;
}
function importQBankCsv(input) {
if (!isAdmin) return;
const file = input.files && input.files[0];
input.value = "";
if (!file) return;
if (file.size > 200000) return alert("الملف كبير، خلّه أقل من 200KB");
const reader = new FileReader();
reader.onload = () => {
    const rows = parseQBankCsv(reader.result);
    if (!rows.length) return alert("ما لقيت أسئلة في الملف. كل سطر لازم يكون: السؤال، الإجابة");
    const have = new Set(roomBank.map(q => q && q.text));
    const fresh = rows.filter(r => !have.has(r.text) && have.add(r.text)).slice(0, 200);
    if (!fresh.length) return alert("كل الأسئلة اللي في الملف موجودة في البنك من قبل");
    if (!confirm(`بنضيف ${fresh.length} سؤال للبنك. أول سؤال:\n${fresh[0].text}\nالإجابة: ${fresh[0].answer}`)) return;
    roomBank.push(...fresh);
    saveRoomBank();
    renderQBankList();
    alert(`انضاف ${fresh.length} سؤال` + (rows.length - fresh.length > 0 ? ` (وتجاهلت ${rows.length - fresh.length} مكرر أو زايد عن 200)` : ""));
};
reader.onerror = () => alert("ما قدرت أقرا الملف");
reader.readAsText(file, "utf-8");
}

function deleteQuestionFromBank(index) {
if(!roomBank[index]) return;
roomBank.splice(index, 1);
saveRoomBank();
renderQBankList();
}
