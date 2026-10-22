/* تثبيت الموقع كتطبيق (PWA) وتسجيل الـ Service Worker */
/* تسجيل الـ Service Worker لدعم PWA. أي خطأ هنا لا يوقف الموقع، فقط يعطل ميزة "إضافة للشاشة الرئيسية". */
if ("serviceWorker" in navigator) {
    /* التحديث التلقائي (22 أكتوبر 2026): الجوال يخلي الموقع مفتوح بالخلفية، فيظل على الكود القديم بعد النشر
       (تجربة محمد طلعت على النسخة اللي قبل). الحين: كل ما يرجع الموقع للواجهة أو كل 10 دقايق نسأل عن نسخة جديدة،
       ولو نسخة جديدة استلمت (controllerchange) نعيد تحميل الصفحة، بس مو وسط سؤال أو جواب في البث (ننتظر لين يخلص) */
    let swReg = null, swHadController = !!navigator.serviceWorker.controller, swReloadPending = false;
    const swBusy = () => {
        try {
            if (typeof openLiveId === "undefined" || !openLiveId) return false;
            const d = liveMatchesCache[openLiveId];
            return !!(d && d.status === "live" && (d.scene === "countdown" || d.scene === "playing" || d.scene === "talk"));
        } catch (e) { return false; }
    };
    const swReloadWhenFree = () => {
        if (!swBusy()) { location.reload(); return; }
        swReloadPending = true;
    };
    setInterval(() => { if (swReloadPending && !swBusy()) location.reload(); }, 3000);
    navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!swHadController) { swHadController = true; return; }   /* أول تثبيت: ما فيه نسخة قديمة */
        swReloadWhenFree();
    });
    const swCheck = () => { if (swReg) swReg.update().catch(() => {}); };
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") swCheck(); });
    setInterval(swCheck, 10 * 60 * 1000);
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").then(r => { swReg = r; }).catch((err) => console.error("تعذّر تسجيل Service Worker:", err));
    });
}

/* زر "تثبيت التطبيق": يظهر فقط عندما يقترحه المتصفح فعلياً (Android/Chrome). iOS لا يدعم هذا الحدث، فنعرض تعليمات بديلة. */
let deferredPwaPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPwaPrompt = e;
    const btn = document.getElementById("pwaInstallBtn");
    if (btn) btn.style.display = "inline-flex";
});
window.addEventListener("appinstalled", () => {
    deferredPwaPrompt = null;
    const btn = document.getElementById("pwaInstallBtn");
    if (btn) btn.style.display = "none";
});
async function installPwa() {
    if (deferredPwaPrompt) {
        deferredPwaPrompt.prompt();
        await deferredPwaPrompt.userChoice;
        deferredPwaPrompt = null;
        const btn = document.getElementById("pwaInstallBtn");
        if (btn) btn.style.display = "none";
        return;
    }
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    alert(isIOS
        ? "لإضافة التطبيق على آيفون: اضغط زر المشاركة في متصفح Safari، ثم اختر \"إضافة إلى الشاشة الرئيسية\"."
        : "افتح قائمة المتصفح (⋮) واختر \"إضافة إلى الشاشة الرئيسية\" أو \"تثبيت التطبيق\".");
}
