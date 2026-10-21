/* صوت البث (أجورا): قناة مستقلة عن الغرفة */
/* =====================================================================
   صوت البث (أجورا) — قناة مستقلة عن الغرفة الصوتية
   ===================================================================== */
let bcClient = null, bcJoined = false, bcJoinPromise = null;
let bcTrack = null, bcPubPromise = null, bcSelfMuted = false;
let bcMicFailAt = 0, bcMicErr = "", bcAudioErr = "";
let bcSyncBusy = false, bcSyncAgain = false;
let bcMyUid = null;
let bcConnState = "", bcNetQ = 0, bcRejoinT = 0, bcRepub = false, bcRejoinN = 0;
/* نعيد بعد 1.5 ث، وكل مرة تفشل الضعف (لين 30 ث) */
function bcRejoinLater() {
    clearTimeout(bcRejoinT);
    const wait = Math.min(30000, 1500 * Math.pow(2, bcRejoinN++));
    bcRejoinT = setTimeout(() => { bcAudioErr = ""; bcSyncAudio(); }, wait);
}
function bcNetDiag(ev) { try { if (typeof bcDiagPush === "function") bcDiagPush("net", { at: bcNow(), ev: String(ev).slice(0, 40), q: bcNetQ }); } catch (e) {} }

/* أجورا يبي رقم، فنحوّل حساب Firebase لرقم ثابت عشان نعرف مين يتكلم */
function bcNumUid(uid) {
    if (!uid) return 0;
    let h = 2166136261;
    for (let i = 0; i < uid.length; i++) { h ^= uid.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 2000000000) + 1;
}

async function bcJoin() {
    await loadAgora();
    if (!bcClient) {
        bcClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        bcClient.on("user-published", async (user, mediaType) => {
            if (mediaType !== "audio") return;
            try {
                await bcClient.subscribe(user, "audio");
                if (user.audioTrack) { user.audioTrack.setVolume(speakerMuted ? 0 : 100); user.audioTrack.play(); }
                bcAudioErr = "";
            } catch (e) { console.error("بث: تعذر استقبال الصوت", e); bcAudioErr = "تعذّر استقبال الصوت"; }
            liveLastSig = ""; renderLiveScreen();
        });
        bcClient.on("user-unpublished", (user, mediaType) => {
            if (mediaType === "audio" && user.audioTrack) user.audioTrack.stop();
        });
        const renew = async () => {
            try { await bcClient.renewToken(await fetchAgoraToken(BC_CHANNEL)); } catch (e) { console.error("بث: فشل تجديد Token", e); }
        };
        bcClient.on("token-privilege-will-expire", renew);
        /* انقطع الاتصال نهائياً (تغيّر النت من واي فاي لبيانات، أو التوكن خلص): كان bcJoined يبقى true فالصوت يسكت لين يحدّث الصفحة.
           الحين نرجع ندخل لحالنا (أجورا يعيد الاتصال بنفسه في RECONNECTING، وهذا بس للانقطاع الكامل) */
        const rejoin = why => {
            bcNetDiag("rejoin:" + why);
            if (/BANNED/.test(why)) { bcAudioErr = "تعذّر الاتصال بصوت البث"; return; }   /* سبب دائم: ما نعيد */
            bcJoined = false;
            if (bcTrack) bcRepub = true;   /* نفس المايك ينعاد نشره (ما نقفله، عشان لو المتسابق يسجّل جوابه ما ينقطع) */
            bcAudioErr = "انقطع صوت البث، نرجع نوصله...";
            bcRejoinLater();
        };
        bcClient.on("token-privilege-did-expire", () => rejoin("token"));
        bcClient.on("connection-state-change", (cur, prev, reason) => {
            bcConnState = cur;
            if (cur === "CONNECTED") bcRejoinN = 0;
            /* بس لو كان متصل وانقطع (مو join فشل من أوله) */
            if (cur === "DISCONNECTED" && reason && reason !== "LEAVE" && (prev === "CONNECTED" || prev === "RECONNECTING")) rejoin(reason);
            else if (cur === "RECONNECTING") bcNetDiag("reconnecting");
            if (openLiveId) { liveLastSig = ""; renderLiveScreen(); }
        });
        /* جودة النت (0 ما يعرف، 1 ممتاز ... 6 مقطوع): تطلع للمتسابق والمنظم تحذير لو النت ضعيف */
        bcClient.on("network-quality", q => { bcNetQ = Math.max(q.uplinkNetworkQuality || 0, q.downlinkNetworkQuality || 0); });
    }
    if (bcJoined) return;
    if (!bcJoinPromise) {
        bcJoinPromise = (async () => {
            const token = await fetchAgoraToken(BC_CHANNEL);
            const wanted = currentUser ? bcNumUid(currentUser.uid) : null;
            try {
                bcMyUid = await bcClient.join(AGORA_APP_ID, BC_CHANNEL, token, wanted);
            } catch (e) {
                /* نفس الحساب فاتح البث من جهازين: ندخل برقم عشوائي */
                if (wanted && String(e && (e.code || e.message)).indexOf("UID_CONFLICT") !== -1) bcMyUid = await bcClient.join(AGORA_APP_ID, BC_CHANNEL, token, null);
                else throw e;
            }
            bcJoined = true;
            bcAudioErr = "";
        })().catch(e => { bcAudioErr = "تعذّر الاتصال بصوت البث: " + (e.message || e.code || e); throw e; })
            .finally(() => { bcJoinPromise = null; });
    }
    await bcJoinPromise;
}

async function bcPublish() {
    if (bcTrack) return;
    if (!bcPubPromise) {
        bcPubPromise = (async () => {
            await agoraUpgradeToken(bcClient, BC_CHANNEL);
            /* speech_standard: مخصص للكلام وأثبت على النت الضعيف من الافتراضي (مخصص للموسيقى) */
            const track = await AgoraRTC.createMicrophoneAudioTrack({ AEC: true, ANS: true, AGC: true, encoderConfig: "speech_standard" });
            try { await bcClient.publish([track]); } catch (e) { track.close(); throw e; }
            if (bcSelfMuted) await track.setMuted(true).catch(() => {});
            bcTrack = track;
            bcMicErr = "";
            roomToast("مايكك مفتوح في البث، الكل يسمعك الحين", "mic");
        })().finally(() => { bcPubPromise = null; });
    }
    await bcPubPromise;
}

async function bcUnpublish() {
    if (!bcTrack) return;
    const t = bcTrack; bcTrack = null; bcRepub = false;
    try { await bcClient.unpublish([t]); } catch (e) {}
    t.close();
    bcSelfMuted = false;
}

async function bcLeave() {
    await bcUnpublish();
    if (bcClient && bcJoined) { try { await bcClient.leave(); } catch (e) {} }
    bcJoined = false; bcRepub = false;
    bcMyUid = null;
}

/* هل لازم مايكي يكون مفتوح الحين؟ المنظم دايماً، وللمتسابقين أول ما تبدأ مواجهتهم */
function bcShouldPublish(d) {
    /* المايك يفتح بس وقت اللعب: من بداية المواجهة (العد التنازلي والأسئلة)، ويتقفل أول ما تنتهي */
    if (!currentUser || !d || d.status !== "live" || !(d.scene === "talk" || d.scene === "countdown" || d.scene === "playing") || !bcCur(d)) return false;
    if (amBcHost(d)) return true;
    return !!myLiveNum(d);
}

function bcSyncAudio() {
    if (bcSyncBusy) { bcSyncAgain = true; return; }
    bcSyncBusy = true;
    (async () => {
        do {
            bcSyncAgain = false;
            const d = openLiveId ? liveMatchesCache[openLiveId] : null;
            const listen = !!(d && d.status === "live");
            try {
                if (!listen) { if (bcJoined || bcTrack) await bcLeave(); continue; }
                await bcJoin();
                if (bcRepub && bcTrack) {
                    bcRepub = false;
                    try { await bcClient.unpublish([bcTrack]); } catch (e) {}   /* لو أجورا للحين يحسبه منشور من الجلسة اللي انقطعت */
                    try { await agoraUpgradeToken(bcClient, BC_CHANNEL); await bcClient.publish([bcTrack]); bcNetDiag("republished"); }
                    catch (e) { bcRepub = true; bcNetDiag("republish-failed"); bcRejoinLater(); }   /* المايك يظل مفتوح (التسجيل ما ينقطع) ونحاول بعدين */
                }
                const want = bcShouldPublish(d);
                if (want && !bcTrack && bcNow() - bcMicFailAt > 10000) {
                    try { await bcPublish(); }
                    catch (e) {
                        bcMicFailAt = bcNow();
                        bcMicErr = e && e.code === "PERMISSION_DENIED" ? "ارفض المتصفح إذن المايك، فعّله من إعدادات المتصفح" : ("تعذّر فتح المايك: " + (e.message || e.code || e));
                    }
                } else if (!want && bcTrack) {
                    await bcUnpublish();
                    roomToast("تقفل مايكك في البث", "mic-off");
                }
            } catch (e) { console.error("بث:", e); }
        } while (bcSyncAgain);
    })().finally(() => {
        bcSyncBusy = false;
        liveLastSig = "";
        renderLiveScreen();
    });
}

function bcToggleSelfMute() {
    if (!bcTrack) { bcMicFailAt = 0; bcMicErr = ""; bcSyncAudio(); return; }
    bcSelfMuted = !bcSelfMuted;
    bcTrack.setMuted(bcSelfMuted).catch(() => {});
    liveLastSig = ""; renderLiveScreen();
}

/* المتصفح حجب صوت البث (أجورا قالت autoplay-failed): زر كبير ثابت فوق أي مشهد، ضغطة وحدة تشغّل الكل */
function bcShowAudioUnlock() {
    if (!openLiveId || document.getElementById("bcUnlock")) return;
    const b = document.createElement("button");
    b.id = "bcUnlock"; b.className = "bc-unlock";
    b.innerHTML = ic("volume-x") + " الصوت موقف من المتصفح · اضغط هنا عشان تسمع";
    b.onclick = bcUnlockAudio;
    document.body.appendChild(b);
}
function bcUnlockAudio() {
    const b = document.getElementById("bcUnlock"); if (b) b.remove();
    try { liveCtx(); if (liveAudioCtx.state === "suspended") liveAudioCtx.resume(); } catch (e) {}
    if (bcClient) bcClient.remoteUsers.forEach(u => { try { if (u.audioTrack) { u.audioTrack.stop(); u.audioTrack.play(); } } catch (e) {} });
    try { if (typeof enableRoomAudio === "function" && agoraAudioBlocked) enableRoomAudio(); } catch (e) {}
}

/* أي ضغطة على شاشة البث تشغّل الصوت لو المتصفح حجبه */
document.addEventListener("click", () => {
    try { if (liveAudioCtx && liveAudioCtx.state === "suspended") liveAudioCtx.resume(); } catch (e) {}
    if (!bcClient || !openLiveId) return;
    bcClient.remoteUsers.forEach(u => { try { if (u.audioTrack && !u.audioTrack.isPlaying) u.audioTrack.play(); } catch (e) {} });
}, true);

/* المتكلمين على الهواء: المنظم + متسابقي المواجهة الحالية */
function bcSpeakers(d) {
    const list = [];
    if (d.hostUid) list.push({ uid: d.hostUid, name: d.hostName || "المنظم", av: d.hostAv || getPlayerAvatar(d.hostName || "م").url, role: "المنظم" });
    const o = bcCur(d);
    if (o && (d.scene === "talk" || d.scene === "countdown" || d.scene === "playing")) {
        [1, 2].forEach(n => {
            const uid = n === 1 ? o.uid1 : o.uid2;
            if (!uid || uid === d.hostUid) return;
            list.push({ uid: uid, name: n === 1 ? o.p1 : o.p2, av: bcAv(o, n), role: "متسابق" });
        });
    }
    return list;
}

/* حالة مايك شخص معيّن: مفتوح؟ ومستوى صوته */
function bcMicLevel(uid) {
    const num = bcNumUid(uid);
    if (currentUser && uid === currentUser.uid) {
        if (!bcTrack || bcSelfMuted) return { on: false, lvl: 0 };
        return { on: true, lvl: bcTrack.getVolumeLevel() };
    }
    if (!bcClient) return { on: false, lvl: 0 };
    const u = bcClient.remoteUsers.find(x => x.uid === num);
    if (!u || !u.hasAudio) return { on: false, lvl: 0 };
    return { on: true, lvl: u.audioTrack ? u.audioTrack.getVolumeLevel() : 0 };
}

let bcRemoteTalk = false;   /* أحد غيري يتكلم الحين (cinema.js تخفض الموسيقى عشان صوته يوضح) */
function bcTickMics() {
    const d = liveMatchesCache[openLiveId];
    if (!d) return;
    let anyTalk = false;
    document.querySelectorAll("[data-bcuid]").forEach(el => {
        const st = bcMicLevel(el.dataset.bcuid);
        const talk = st.on && st.lvl > 0.04;
        if (talk && !(currentUser && el.dataset.bcuid === currentUser.uid)) anyTalk = true;
        el.classList.toggle("on", st.on);
        el.classList.toggle("talk", talk);
        const s = el.querySelector(".bc-st");
        if (s) {
            const txt = !st.on ? "المايك مقفل" : (talk ? "يتكلم..." : "المايك مفتوح");
            if (s.textContent !== txt) s.textContent = txt;
        }
    });
    if (anyTalk !== bcRemoteTalk) { bcRemoteTalk = anyTalk; if (typeof bedApply === "function") bedApply(); }
    const ls = document.getElementById("bcListeners");
    if (ls) {
        const n = bcJoined && bcClient ? bcClient.remoteUsers.length + 1 : 0;
        const t = n ? String(n) : "…";
        if (ls.textContent !== t) {
            const prev = parseInt(ls.textContent, 10);
            ls.textContent = t;
            if (n && prev && n !== prev) {
                ls.classList.remove("bump"); void ls.offsetWidth; ls.classList.add("bump");
                const f = document.createElement("span");
                f.className = "st-delta " + (n > prev ? "up" : "down");
                f.textContent = (n > prev ? "+" : "") + (n - prev);
                ls.parentNode.appendChild(f);
                setTimeout(() => f.remove(), 1600);
            }
        }
    }
}
