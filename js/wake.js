/* الشاشة ما تطفي وقت البث وفي الغرفة الصوتية (Screen Wake Lock) */
/* =====================================================================
   screenAwake("live" | "room", true/false): ينطلب أول ما يفتح البث أو الغرفة، وينفك لما يطلع منهم كلهم.
   - القفل يروح لحاله لما الموقع يروح للخلفية، فنطلبه من جديد أول ما يرجع للواجهة (visibilitychange).
   - المتصفح اللي ما يدعمه (آيفون قبل iOS 16.4) أو رفض الطلب: فيديو صامت 16×16 (2KB، media/awake.mp4 أو webm)
     يشتغل بتكرار ومخفي (نفس فكرة NoSleep.js)، وما يشتغل إلا والبث أو الغرفة مفتوحة والموقع قدام.
   ===================================================================== */
const WAKE = { want: new Set(), lock: null, pending: null, video: null, retried: false };
/* التطبيق المثبّت على الشاشة الرئيسية في iOS 16.4 لين 18.3: الطلب ينجح بس ما يسوي شي (خلل WebKit 254545)،
   فنشغّل الفيديو الصامت معه */
const WAKE_IOS_PWA_BROKEN = (() => {
    try {
        const m = /OS (\d+)_(\d+)/.exec(navigator.userAgent || "");
        if (!m || !/iPhone|iPad|iPod/.test(navigator.userAgent) || !navigator.standalone) return false;
        return Number(m[1]) < 18 || (Number(m[1]) === 18 && Number(m[2]) < 4);
    } catch (e) { return false; }
})();
function screenAwake(why, on) {
    if (on) WAKE.want.add(why); else WAKE.want.delete(why);
    wakeSync();
}
function wakeOn() { return WAKE.want.size > 0 && document.visibilityState === "visible"; }
function wakeSync() {
    if (!wakeOn()) { wakeRelease(); return; }
    if (WAKE.lock || WAKE.pending) return;
    if (!(navigator.wakeLock && navigator.wakeLock.request)) { wakeVideo(true); return; }
    WAKE.pending = navigator.wakeLock.request("screen").then(l => {
        WAKE.pending = null;
        if (!wakeOn()) { l.release().catch(() => {}); return; }   /* طلع أو راح للخلفية قبل ما يوصل القفل */
        WAKE.lock = l; WAKE.retried = false;
        wakeVideo(WAKE_IOS_PWA_BROKEN);
        /* النظام فك القفل والموقع لسا قدام (توفير البطارية مثلاً): نطلبه من جديد */
        l.addEventListener("release", () => { if (WAKE.lock === l) { WAKE.lock = null; setTimeout(wakeSync, 1000); } });
    }).catch(e => {
        WAKE.pending = null;
        if (!wakeOn()) return;
        /* رجع للواجهة والطلب لسا معلّق من قبل ما يروح للخلفية فانرفض: نطلب مرة ثانية قبل الفيديو */
        if (e && e.name === "NotAllowedError" && !WAKE.retried) { WAKE.retried = true; wakeSync(); return; }
        wakeVideo(true);
    });
}
function wakeRelease() {
    const l = WAKE.lock;
    WAKE.lock = null;
    if (l) l.release().catch(() => {});
    wakeVideo(false);
}
function wakeVideo(on) {
    let v = WAKE.video;
    if (!on) { if (v && !v.paused) v.pause(); return; }
    if (!v) {
        v = WAKE.video = document.createElement("video");
        v.id = "wakeVideo";
        /* mp4 للآيفون، و webm للمتصفحات اللي ما فيها H.264 */
        v.innerHTML = '<source src="media/awake.mp4" type="video/mp4"><source src="media/awake.webm" type="video/webm">';
        v.muted = true; v.loop = true; v.playsInline = true;
        v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("aria-hidden", "true");
        v.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none";
        document.body.appendChild(v);
    }
    if (v.paused) v.play().catch(() => {
        /* بعض المتصفحات تبي لمسة قبل أي فيديو: نجرب مع أول ضغطة (click، لأن pointerdown باللمس ما يعتبر تفاعل) */
        document.addEventListener("click", wakeSync, { once: true, capture: true });
    });
}
document.addEventListener("visibilitychange", wakeSync);
