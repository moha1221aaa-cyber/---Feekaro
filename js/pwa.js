/* تثبيت الموقع كتطبيق (PWA) وتسجيل الـ Service Worker */
/* تسجيل الـ Service Worker لدعم PWA. أي خطأ هنا لا يوقف الموقع، فقط يعطل ميزة "إضافة للشاشة الرئيسية". */
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch((err) => console.error("تعذّر تسجيل Service Worker:", err));
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
