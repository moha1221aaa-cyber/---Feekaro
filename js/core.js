/* أدوات أساسية تتحمل أول شي: أيقونات SVG، وتحميل مكتبة الصوت (أجورا) وقت الحاجة */
function ic(n, c) { return '<svg class="ic' + (c ? " " + c : "") + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }

/* مكتبة الصوت (أجورا) تتحمل بس لما أحد يدخل الغرفة أو البث، عشان الموقع يفتح أسرع */
let agoraLoading = null;
function loadAgora() {
    if (window.AgoraRTC) return Promise.resolve(window.AgoraRTC);
    if (!agoraLoading) agoraLoading = new Promise((res, rej) => {
        const sc = document.createElement("script");
        sc.src = "https://download.agora.io/sdk/release/AgoraRTC_N-4.20.0.js";
        sc.onload = () => window.AgoraRTC ? res(window.AgoraRTC) : rej(new Error("مكتبة الصوت ما تحمّلت"));
        sc.onerror = () => { agoraLoading = null; rej(new Error("مكتبة الصوت ما تحمّلت، تأكد من النت")); };
        document.head.appendChild(sc);
    });
    return agoraLoading;
}
