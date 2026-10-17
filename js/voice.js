/* صوت الغرفة (أجورا): الاتصال، المايك، حالة الصوت */
/* يجلب Token أجورا من السيرفر لأن مشروع أجورا عليه Certificate:
   على Cloudflare Pages من /agora-token (functions/agora-token.js)، وعلى Netlify من دالته القديمة */
let agoraJoinPromise = null;
async function fetchAgoraToken(channel) {
    const base = location.hostname.endsWith("netlify.app") ? "/.netlify/functions/agora-token" : "/agora-token";
    const res = await fetch(base + (channel ? "?channel=" + encodeURIComponent(channel) : ""), { cache: "no-store" });
    let data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok || !data || !data.token) {
        throw new Error((data && data.error) || ("تعذّر جلب Token من السيرفر (" + res.status + ")"));
    }
    return data.token;
}

let agoraClient = null;
let agoraJoined = false;
let agoraAudioBlocked = false;
let agoraLastFail = 0;
let speakerMuted = false;

function setAgoraStatus(text, kind) {
    const el = document.getElementById("agoraStatusBar");
    if (!el) return;
    if (!text) { el.style.display = "none"; return; }
    el.innerHTML = text;
    el.className = "agora-status " + (kind || "");
    el.style.display = "block";
}

let agoraRemoteLevel = 0;
let agoraStatusTimer = null;
let agoraErrorUntil = 0;

/* شريط الحالة: يوضح للمستخدم هل هو متصل، وهل مايكه يلتقط صوتاً، وهل يصله صوت من غيره */
function refreshAgoraStatus() {
    if (!agoraJoined) { setAgoraStatus(""); return; }
    if (Date.now() < agoraErrorUntil) return;
    if (agoraAudioBlocked) { setAgoraStatus(ic("volume-x") + " اضغط هنا لتفعيل الصوت", "warn"); return; }
    const remote = agoraClient ? agoraClient.remoteUsers : [];
    const talkers = remote.filter(u => u.hasAudio).length;
    let text = ic("volume-2") + " متصل";
    if (localAudioTrack) text += " · " + ic("mic") + " " + (localAudioTrack.getVolumeLevel() > 0.02 ? "مايكك يلتقط صوتك" : "مايكك لا يلتقط صوتاً");
    if (talkers > 0) text += " · يتحدث " + talkers + (agoraRemoteLevel > 3 ? " " + ic("check-circle") + " الصوت يصل" : " " + ic("hourglass") + " لا يصل صوت");
    else if (!localAudioTrack) text += " · لا أحد يتحدث";
    if (speakerMuted) text += " · " + ic("volume-x") + " مكتوم عندك";
    setAgoraStatus(text, "ok");
}

function enableRoomAudio() {
    try {
        if (agoraClient) agoraClient.remoteUsers.forEach(u => { if (u.audioTrack) u.audioTrack.play(); });
    } catch (e) { console.error(e); }
    agoraAudioBlocked = false;
    refreshAgoraStatus();
}
/* أي ضغطة على الصفحة تحاول تشغيل الصوت إذا كان محجوباً */
document.addEventListener("click", () => { if (agoraAudioBlocked) enableRoomAudio(); }, true);
let localAudioTrack = null;
let myMicIndex = null;

/* ينضم إلى قناة أجورا كمستمع فقط (بدون طلب إذن الميكروفون وبدون نشر صوت).
   يُستخدم لكل من يفتح الغرفة، حتى لو لم يكن على المايك، ليتمكن من سماع
   المتحدثين. ملاحظة مهمة: الـ uid يُترك null ليولّده أجورا تلقائيًا كرقم،
   لأن معرّف Firebase (uid) نص طويل وأجورا يتوقع رقمًا وليس نصًا، وهذا كان
   سبب فشل الانضمام بالكامل سابقًا. */
async function ensureAgoraJoined() {
    await loadAgora();
    if (!agoraClient) {
        agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

        /* المتصفح قد يمنع تشغيل الصوت قبل أي ضغطة من المستخدم؛ نعرض شريط تنبيه ويكفي ضغطة واحدة */
        AgoraRTC.onAudioAutoplayFailed = () => {
            agoraAudioBlocked = true;
            refreshAgoraStatus();
        };

        agoraClient.on("user-published", async (user, mediaType) => {
            try {
                await agoraClient.subscribe(user, mediaType);
                if (mediaType === "audio" && user.audioTrack) {
                    user.audioTrack.setVolume(speakerMuted ? 0 : 100);
                    user.audioTrack.play();
                }
            } catch (e) {
                console.error("تعذر استقبال الصوت:", e);
                agoraErrorUntil = Date.now() + 8000;
                setAgoraStatus(ic("alert") + " تعذّر استقبال الصوت: " + escapeHTML(e.message || e.code || e), "err");
            }
        });

        agoraClient.enableAudioVolumeIndicator();
        agoraClient.on("volume-indicator", (vols) => {
            let max = 0;
            vols.forEach(v => { if (v.uid !== agoraClient.uid && v.uid !== 0 && v.level > max) max = v.level; });
            agoraRemoteLevel = max;
        });

        agoraClient.on("user-unpublished", (user, mediaType) => {
            if (mediaType === "audio" && user.audioTrack) {
                user.audioTrack.stop();
            }
        });

        const renewAgoraToken = async () => {
            try { await agoraClient.renewToken(await fetchAgoraToken()); }
            catch (e) { console.error("فشل تجديد Token أجورا:", e); }
        };
        agoraClient.on("token-privilege-will-expire", renewAgoraToken);
        agoraClient.on("token-privilege-did-expire", renewAgoraToken);
    }

    if (!agoraJoined) {
        if (!agoraJoinPromise) {
            agoraJoinPromise = (async () => {
                try {
                    const token = await fetchAgoraToken();
                    await agoraClient.join(AGORA_APP_ID, AGORA_CHANNEL, token, null);
                    agoraJoined = true;
                    refreshAgoraStatus();
                    if (!agoraStatusTimer) agoraStatusTimer = setInterval(refreshAgoraStatus, 1000);
                } catch (e) {
                    setAgoraStatus(ic("alert") + " تعذّر الاتصال بالصوت: " + escapeHTML(e.message || e.code || e), "err");
                    throw e;
                }
            })().finally(() => { agoraJoinPromise = null; });
        }
        await agoraJoinPromise;
    }
}

/* تفعيل الميكروفون فعليًا (يطلب إذن المايك وينشر الصوت) — يُستخدم فقط عند
   أخذ مقعد مايك، وليس لمجرد فتح الغرفة كمستمع. */
let publishPromise = null;
async function publishMyMic() {
    await ensureAgoraJoined();
    if (localAudioTrack) return; // المايك مفعّل مسبقًا
    if (!publishPromise) {
        publishPromise = (async () => {
            const track = await AgoraRTC.createMicrophoneAudioTrack(micOptions());
            try { await agoraClient.publish([track]); }
            catch (e) { track.close(); throw e; }
            localAudioTrack = track;
        })().finally(() => { publishPromise = null; });
    }
    await publishPromise;
}

async function unpublishMyMic() {
    if (!localAudioTrack) return;
    try { await agoraClient.unpublish([localAudioTrack]); } catch (e) {}
    localAudioTrack.close();
    localAudioTrack = null;
}

async function joinVoiceChannel(channelName, userId) {
    try {
        await publishMyMic();
    } catch (error) {
        console.error("خطأ تشغيل المايك عبر أجورا:", error);
        if (error.code === "PERMISSION_DENIED") {
            alert("يرجى منح إذن استخدام الميكروفون من إعدادات المتصفح.");
        } else {
            alert("تعذّر تشغيل المايك عبر أجورا: " + (error.message || error.code || error));
        }
        throw error;
    }
}

async function leaveVoiceChannel() {
    await unpublishMyMic();
    await fxTeardown();
    if (agoraClient && agoraJoined) {
        await agoraClient.leave();
        agoraJoined = false;
        agoraAudioBlocked = false;
        if (agoraStatusTimer) { clearInterval(agoraStatusTimer); agoraStatusTimer = null; }
        setAgoraStatus("");
    }
}

/* يطبّق حالة المايك (كتم المسؤول / إخراج من المقعد) الآتية من Firestore على
   جهاز صاحب المايك نفسه، لأن أجورا لا يسمح لمستخدم بكتم مايك مستخدم آخر عن
   بُعد — يجب أن يطبّق كل متصفح الحالة على نفسه بناءً على البيانات اللحظية. */
let micRecovering = false;
let micRecoverFailedAt = 0;

/* إذا كان اسمك على مقعد (أو أنت المضيف) لكن مايكك غير منشور على هذا الجهاز
   (مثلاً بعد تحديث الصفحة)، نشغّله من جديد بدل أن يبقى المقعد "محجوزاً" بلا صوت. */
function recoverMyMic() {
    if (micRecovering || !roomState.isLive || Date.now() - micRecoverFailedAt < 15000) return;
    micRecovering = true;
    publishMyMic().then(() => {
        const m = myMicIndex !== null ? roomState.mics[myMicIndex] : null;
        if (localAudioTrack && m) localAudioTrack.setMuted(!!m.muted).catch(() => {});
        refreshAgoraStatus();
    }).catch(err => {
        micRecoverFailedAt = Date.now();
        console.error("تعذّر تشغيل المايك:", err);
        agoraErrorUntil = Date.now() + 8000;
        setAgoraStatus(ic("alert") + " مايكك غير مفعّل: " + escapeHTML(err.message || err.code || err) + " · اضغط على صورتك للمحاولة", "err");
    }).finally(() => { micRecovering = false; });
}

function syncMyMicWithState() {
    if (!currentUser || !roomState.mics) return;
    let idx = roomState.mics.findIndex(m => m && m.uid === currentUser.uid);

    if (idx === -1) {
        /* المايك مرتبط بالمقعد: من ليس على مقعد لا ينشر صوتاً */
        if (localAudioTrack) unpublishMyMic();
        myMicIndex = null;
        return;
    }

    myMicIndex = idx;
    if (localAudioTrack) {
        let shouldMute = !!roomState.mics[idx].muted;
        localAudioTrack.setMuted(shouldMute).catch(() => {});
    } else {
        recoverMyMic();
    }
}

function toggleMyMic(index) {
    if (!currentUser || !roomState.mics[index] || roomState.mics[index].uid !== currentUser.uid) return;
    if (!localAudioTrack) { micRecoverFailedAt = 0; recoverMyMic(); return; }
    let willMute = !roomState.mics[index].muted;
    localAudioTrack.setMuted(willMute).catch(() => {});
    roomState.mics[index].muted = willMute;
    saveRoomState();
    updateComposerState();
}

function releaseMicSlot(index) {
    if (!currentUser || !roomState.mics[index] || roomState.mics[index].uid !== currentUser.uid) return;
    unpublishMyMic();
    roomState.mics[index] = null;
    myMicIndex = null;
    saveRoomState();
}

function adminKickMic(index) {
    if (!isAdmin) return;
    if (!roomState.mics[index]) return;
    if (!confirm("هل تريد إخراج هذا المستخدم من المايك؟")) return;
    roomState.mics[index] = null; // سيقوم جهاز المستخدم نفسه بإيقاف مايكه تلقائيًا عند وصول هذا التحديث
    saveRoomState();
}
