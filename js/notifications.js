/* الإشعارات: الجرس، notify()، إشعار النتائج الجديدة */
/* ===== الإشعارات =====
   تشتغل على جوالات أندرويد عن طريق Service Worker (new Notification ما يشتغل في كروم الجوال).
   تطلع لما الموقع مفتوح أو بالخلفية: نتيجة مواجهة جديدة، بداية بث، موعد بث، دورك في البث، الغرفة الصوتية مباشرة */
function notifOn() {
    try { return ("Notification" in window) && Notification.permission === "granted" && localStorage.getItem("notifOff") !== "1"; } catch (e) { return false; }
}
function renderNotifBell() {
    const b = document.getElementById("notifBellBtn");
    if (!b) return;
    const on = notifOn();
    b.classList.toggle("on", on);
    b.classList.toggle("off", !on);
    b.title = on ? "الإشعارات مفعّلة (اضغط للإيقاف)" : "تفعيل الإشعارات";
}
function enableNotifications() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return alert("المتصفح هذا ما يدعم الإشعارات. جرّب من متصفح Chrome، أو ثبّت الموقع كتطبيق.");
    if (notifOn()) {
        if (confirm("الإشعارات مفعّلة. تبي توقفها؟")) { try { localStorage.setItem("notifOff", "1"); } catch (e) {} renderNotifBell(); }
        return;
    }
    if (Notification.permission === "denied") {
        return alert("الإشعارات مقفلة من المتصفح.\n\nعشان تفتحها:\n1. اضغط القفل 🔒 جنب رابط الموقع فوق\n2. اختر الأذونات (Permissions)\n3. خلّ الإشعارات (Notifications) مسموحة\n4. حدّث الصفحة واضغط الجرس مرة ثانية");
    }
    Notification.requestPermission().then(permission => {
        if (permission === "granted") {
            try { localStorage.removeItem("notifOff"); } catch (e) {}
            renderNotifBell();
            notify("تم تفعيل الإشعارات ✅", "بيوصلك إشعار لما تنسجل نتيجة، أو يبدأ بث، أو يجي دورك.", "welcome", "/", true);
        } else {
            alert("ما تم تفعيل الإشعارات.");
        }
        renderNotifBell();
    });
}
const notifSeen = {};
function notify(title, body, tag, url, force) {
    if (!notifOn()) return;
    if (tag && notifSeen[tag] && !force) return;
    if (tag) notifSeen[tag] = 1;
    const opt = { body: body, tag: tag || undefined, icon: "logo.png", badge: "logo.png", lang: "ar", dir: "rtl", data: { url: url || "/" }, vibrate: [120, 60, 120] };
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(reg => reg.showNotification(title, opt)).catch(() => { try { new Notification(title, opt); } catch (e) {} });
    } else { try { new Notification(title, opt); } catch (e) {} }
}
/* توافق مع الكود القديم */
function showNotification(message) { notify("MASRO7 LEAGUE", message, "", "/"); }
document.addEventListener("DOMContentLoaded", renderNotifBell);
setTimeout(renderNotifBell, 1500);

/* نتيجة جديدة في الجدول */
let notifPrevScores = null;
function notifScoresCheck() {
    const cur = {};
    matches.forEach(m => { if (m.s1 !== "" && m.s2 !== "") cur[getMatchId(m)] = m; });
    if (notifPrevScores) {
        Object.keys(cur).forEach(k => {
            if (notifPrevScores[k]) return;
            const m = cur[k];
            notify("نتيجة جديدة 🏆", `${m.p1.name} ${m.s1} - ${m.s2} ${m.p2.name} · الجولة ${m.round}`, "res_" + k, "/");
        });
    }
    notifPrevScores = {};
    Object.keys(cur).forEach(k => notifPrevScores[k] = 1);
}
