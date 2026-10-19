/* أدوات أساسية تتحمل أول شي: أيقونات SVG، وتحميل مكتبة الصوت (أجورا) وقت الحاجة */
function ic(n, c) { return '<svg class="ic' + (c ? " " + c : "") + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }

/* هيدر تسجيل الدخول لدوال السيرفر (tts و ai و agora-token): توكن Firebase لو المستخدم داخل */
async function authHeaders() {
    try {
        const u = typeof firebaseAuth !== "undefined" && firebaseAuth && firebaseAuth.currentUser;
        if (u) return { Authorization: "Bearer " + await u.getIdToken() };
    } catch (e) {}
    return {};
}

/* أجورا: المتصفح حجب الصوت. الغرفة تعرض شريطها، والبث يعرض زر كبير "اضغط عشان تسمع" (js/broadcast/voice.js) */
function onAgoraAutoplayBlocked() {
    try { if (typeof agoraAudioBlocked !== "undefined") { agoraAudioBlocked = true; if (typeof refreshAgoraStatus === "function") refreshAgoraStatus(); } } catch (e) {}
    try { if (typeof bcShowAudioUnlock === "function") bcShowAudioUnlock(); } catch (e) {}
}

/* مكتبة الصوت (أجورا) تتحمل بس لما أحد يدخل الغرفة أو البث، عشان الموقع يفتح أسرع */
let agoraLoading = null;
function loadAgora() {
    if (window.AgoraRTC) return Promise.resolve(window.AgoraRTC);
    if (!agoraLoading) agoraLoading = new Promise((res, rej) => {
        const sc = document.createElement("script");
        sc.src = "https://download.agora.io/sdk/release/AgoraRTC_N-4.20.0.js";
        sc.onload = () => {
            if (!window.AgoraRTC) return rej(new Error("مكتبة الصوت ما تحمّلت"));
            /* المتصفح منع تشغيل الصوت قبل أي ضغطة: نخبر الغرفة والبث (الاسم القديم والجديد في أجورا) */
            window.AgoraRTC.onAudioAutoplayFailed = window.AgoraRTC.onAutoplayFailed = onAgoraAutoplayBlocked;
            res(window.AgoraRTC);
        };
        sc.onerror = () => { agoraLoading = null; rej(new Error("مكتبة الصوت ما تحمّلت، تأكد من النت")); };
        document.head.appendChild(sc);
    });
    return agoraLoading;
}

/* إمكانية الوصول: أي عنصر مو زر وفيه onclick (التبويبات، البطاقات، المقاعد) يتوصل له بالكيبورد ويشتغل بـ Enter أو مسافة */
const A11Y_CLICK = "[onclick]:not(button):not(a):not(input):not(select):not(textarea):not(label)";
function a11yMark(root) {
    if (!root || !root.querySelectorAll) return;
    const list = root.matches && root.matches(A11Y_CLICK) ? [root] : [];
    root.querySelectorAll(A11Y_CLICK).forEach(el => list.push(el));
    list.forEach(el => {
        if (!el.hasAttribute("tabindex")) el.tabIndex = 0;
        if (!el.hasAttribute("role")) el.setAttribute("role", "button");
    });
}
document.addEventListener("DOMContentLoaded", () => {
    a11yMark(document.body);
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) a11yMark(n); })))
        .observe(document.body, { childList: true, subtree: true });
});
document.addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches(A11Y_CLICK)) { e.preventDefault(); e.target.click(); }
});
