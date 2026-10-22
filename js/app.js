/* حالة التطبيق، النوافذ، دخول المسؤول، المتسابقين، توليد المواجهات، التحميل والحفظ من Firebase */
const ADMIN_EMAIL = "moha1221aaa@gmail.com";

let firebaseReady = false;
let firebaseDB = null;
let firebaseAuth = null;

let isAdmin = false;
let notifyEnabled = false;
let isInitialLoad = true;

let adminClicks = 0;
let adminTimer = null;

let currentUser = null;
let currentUserDocData = null;

let predictions = {};
let playerLinks = {};

let predictionListener = null;
let usersRankingListener = null;
let predictionsRankingListener = null;
let userProfileDocListener = null;
let videosListener = null;

let cachedUsersData = {};
/* صور Cloudinary بحجم صغير (بدل الصورة الكاملة) عشان الموقع يفتح أسرع */
function cdnThumb(url, size) {
    size = size || 160;
    if (!url || typeof url !== "string" || url.indexOf("res.cloudinary.com") === -1 || url.indexOf("/upload/") === -1) return url;
    if (/\/upload\/[^/]*(w_|c_fill)/.test(url)) return url;
    return url.replace("/upload/", `/upload/w_${size},h_${size},c_fill,g_face,q_auto,f_auto/`);
}
function thumbUser(u) { if (u && u.photoURL) u.photoURL = cdnThumb(u.photoURL); return u; }
let cachedPredictionsData = {};
let isRankingDataLoaded = false;
let activeModalId = null;

window.addEventListener('DOMContentLoaded', () => {
    renderCachedLeague();
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        firebaseDB = firebase.firestore();
        firebaseAuth = firebase.auth();
        firebaseReady = true;

        document.getElementById("debugText").textContent = "تم الاتصال بـ Firebase بنجاح";

        firebaseAuth.onAuthStateChanged(user => {
            currentUser = user;
            if (user) {
                isAdmin = (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
                listenToUserProfileDoc(user.uid);
                loadPredictions();
            } else {
                isAdmin = false;
                currentUserDocData = null;
                predictions = {};
            }

            const addBtn = document.getElementById("addVideoBtn");
            if (addBtn) addBtn.style.display = isAdmin ? "block" : "none";

            const resetBtn = document.getElementById("resetButton");
            if (resetBtn) resetBtn.style.display = isAdmin ? "block" : "none";

            const adminControls = document.getElementById("adminControls");
            if (adminControls) adminControls.style.display = isAdmin ? "block" : "none";

            table();
            renderMatches();
            renderPredictions();
            renderFullAccountPage();
            renderLeagueSummary();
            renderRoomUI();
            renderLiveBars();
            if (openLiveId) { liveLastSig = ""; renderLiveScreen(); }
        });

        loadFromFirebase();
        startPredictionRanking();
        initRoomFeature();
        initLiveMatches();
    } catch (err) {
        console.error(err);
        document.getElementById("debugText").textContent = "خطأ في الاتصال بقواعد البيانات";
    }
});

window.addEventListener('popstate', function(e) {
    closeAllModalsDirectly();
    const st = e.state || {};
    if (!st.liveOpen && typeof closeLiveScreen === "function") closeLiveScreen(true);
    if (!st.roomOpen && !st.liveOpen && typeof closeRoomScreen === "function") closeRoomScreen(true);
});

function openModal(modalId) {
    let modal = document.getElementById(modalId);
    if(!modal) return;
    
    if (!activeModalId) {
        window.history.pushState({ modalOpen: modalId }, '');
    }
    activeModalId = modalId;
    modal.classList.add("active");
}

function goBackModal() {
    if(activeModalId && window.history.state && window.history.state.modalOpen) {
        window.history.back();
    } else {
        closeAllModalsDirectly();
    }
}

function closeAllModalsDirectly() {
    activeModalId = null;
    document.querySelectorAll(".modal-overlay").forEach(m => m.classList.remove("active"));
}

function escapeHTML(value) {
return String(value || "")
.replace(/&/g,"&amp;")
.replace(/</g,"&lt;")
.replace(/>/g,"&gt;")
.replace(/"/g,"&quot;")
.replace(/'/g,"&#039;");
}
/* قيمة داخل onclick="fn(...)": JSON يحمي النص داخل JS، و escapeHTML يحميه داخل الخاصية.
   escapeHTML بروحه ما يكفي لأن المتصفح يفك &#039; قبل ما يشغّل الكود. */
function jsArg(value) {
return escapeHTML(JSON.stringify(String(value == null ? "" : value)));
}
/* رابط صورة أو فيديو داخل src="...": يقبل https و http والروابط الداخلية و blob بس، ويرجعه محمي */
function safeSrc(url) {
let u = String(url == null ? "" : url).trim();
if (!u) return "";
if (!/^(https?:\/\/|\/(?!\/)|blob:|data:image\/(png|jpe?g|gif|webp);)/i.test(u)) return "";
return escapeHTML(u);
}

function adminClick() {
adminClicks++;
clearTimeout(adminTimer);
adminTimer = setTimeout(() => { adminClicks = 0; }, 2000);
if(adminClicks >= 5) {
adminClicks = 0;
loginAdmin();
}
}

function loginAdmin() {
if(!firebaseReady || !firebaseAuth) return alert("Firebase غير متصل");
if(firebaseAuth.currentUser) return alert("يوجد حساب مسجل دخول بالفعل");

let email = prompt("اكتب بريد المسؤول");
if(!email) return;
let password = prompt("اكتب كلمة مرور حساب Firebase");
if(!password) return;

email = email.trim().toLowerCase();
if(email !== ADMIN_EMAIL.toLowerCase()) return alert("هذا ليس بريد المسؤول");

document.getElementById("firebaseStatus").textContent = "جاري تسجيل دخول المسؤول...";

firebaseAuth.signInWithEmailAndPassword(email, password)
.then(() => alert("تم تسجيل دخول المسؤول بنجاح"))
.catch(error => {
console.log(error);
alert("فشل تسجيل الدخول\n\n" + authErrAr(error));
});
}

/* رسائل أخطاء تسجيل الدخول بالعربي */
function authErrAr(err) {
    const c = (err && err.code) || "";
    const m = {
        "auth/invalid-email": "البريد الإلكتروني مكتوب غلط.",
        "auth/user-not-found": "ما فيه حساب بهذا البريد. لو حسابك من قبل، الحسابات القديمة انحذفت: أنشئ حساب جديد.",
        "auth/wrong-password": "كلمة المرور غلط.",
        "auth/invalid-credential": "البريد أو كلمة المرور غلط.",
        "auth/invalid-login-credentials": "البريد أو كلمة المرور غلط.",
        "auth/too-many-requests": "حاولت كثير. انتظر شوي وجرّب مرة ثانية.",
        "auth/network-request-failed": "فيه مشكلة في الاتصال بالإنترنت. تأكد من النت وجرّب مرة ثانية.",
        "auth/email-already-in-use": "هذا البريد مسجّل قبل. سجّل دخول بدل ما تنشئ حساب جديد.",
        "auth/weak-password": "كلمة المرور ضعيفة. لازم تكون 6 أحرف أو أكثر.",
        "auth/user-disabled": "هذا الحساب موقوف.",
        "auth/unauthorized-domain": "هذا الرابط مو مسموح له بتسجيل الدخول. كلّم المنظم.",
        "auth/operation-not-allowed": "طريقة تسجيل الدخول هذي مقفلة. كلّم المنظم.",
        "auth/missing-password": "اكتب كلمة المرور.",
        "auth/missing-email": "اكتب بريدك الإلكتروني.",
        "permission-denied": "ما عندك صلاحية لهذي العملية."
    };
    return m[c] || ("صار خطأ غير متوقع، جرّب مرة ثانية." + (c ? " (" + c + ")" : ""));
}

let players = [
"سعود", "احمد", "عبدالملك", "عبدالله", "محمد", "عبدالعزيز",
"حسام", "عبدالرحمن", "مشاري", "علول", "ياي", "خلود"
].map(name => ({ name:name, w:0, d:0, l:0, gf:0, ga:0, pts:0 }));

function getPlayerAvatar(playerName) {
let linkedUid = playerLinks[playerName];
if(linkedUid && cachedUsersData[linkedUid]) {
let userData = cachedUsersData[linkedUid];
if(userData.photoURL) {
return { url: userData.photoURL, isVerified: true };
}
}
let cleanName = (playerName || "P").trim();
let firstChar = cleanName.charAt(0);
let encoded = encodeURIComponent(firstChar);
let defaultUrl = `https://ui-avatars.com/api/?name=${encoded}&length=1&background=2563eb&color=ffffff&bold=true&size=128`;
return { url: defaultUrl, isVerified: !!linkedUid };
}

let matches = [];

function generateMatches() {
    matches = [];

    let arr = [...players].sort(() => Math.random() - 0.5);
    let n = arr.length;

    if (n % 2 !== 0) {
        arr.push({ name: "راحة" });
        n++;
    }

    const totalRounds = n - 1;
    const half = n / 2;

    const homeAwayHistory = {};
    players.forEach(player => {
        homeAwayHistory[player.name] = [];
    });

    for (let r = 0; r < totalRounds; r++) {

        const roundMatches = [];

        for (let i = 0; i < half; i++) {
            const a = arr[i];
            const b = arr[n - 1 - i];

            if (a.name !== "راحة" && b.name !== "راحة") {
                roundMatches.push({
                    a: a,
                    b: b
                });
            }
        }

        let tempRoundList = [];

        roundMatches.forEach((pair, index) => {
            let a = pair.a;
            let b = pair.b;

            let aHistory = homeAwayHistory[a.name] || [];
            let bHistory = homeAwayHistory[b.name] || [];

            let aLast = aHistory.length > 0 ? aHistory[aHistory.length - 1] : null;
            let bLast = bHistory.length > 0 ? bHistory[bHistory.length - 1] : null;

            let p1, p2;

            if (aLast === "H" && bLast === "A") {
                p1 = b; p2 = a;
            } else if (aLast === "A" && bLast === "H") {
                p1 = a; p2 = b;
            } else if (aLast === "H") {
                p1 = b; p2 = a;
            } else if (aLast === "A") {
                p1 = a; p2 = b;
            } else if (bLast === "H") {
                p1 = a; p2 = b;
            } else if (bLast === "A") {
                p1 = b; p2 = a;
            } else {
                if ((r + index) % 2 === 0) {
                    p1 = a; p2 = b;
                } else {
                    p1 = b; p2 = a;
                }
            }

            tempRoundList.push({
                p1: p1,
                p2: p2,
                s1: "",
                s2: "",
                round: r + 1
            });

            homeAwayHistory[p1.name].push("H");
            homeAwayHistory[p2.name].push("A");
        });

        tempRoundList.sort(() => Math.random() - 0.5);
        matches.push(...tempRoundList);

        arr.splice(1, 0, arr.pop());
    }

    const firstLegRounds = totalRounds;
    for (let r = 1; r <= firstLegRounds; r++) {
        let leg1Matches = matches.filter(m => m.round === r);
        let leg2Matches = leg1Matches.map(m => ({
            p1: m.p2,
            p2: m.p1,
            s1: "",
            s2: "",
            round: r + firstLegRounds
        }));
        
        leg2Matches.sort(() => Math.random() - 0.5);
        matches.push(...leg2Matches);
    }
}

function addNewPlayerPrompt() {
if(!isAdmin) return;
let name = prompt("أدخل اسم المتسابق الجديد:");
if(!name || !name.trim()) return;

name = name.trim();
if(players.some(p => p.name === name)) {
return alert("المتسابق موجود بالفعل بنفس الاسم!");
}

players.push({ name: name, w:0, d:0, l:0, gf:0, ga:0, pts:0 });
generateMatches();
table();
renderMatches();
save();
alert(`تم إضافة المتسابق "${name}" وإعادة بناء جدول المواجهات بنجاح!`);
}

function reDrawMatches() {
if(!isAdmin) return;
if(!confirm("هل أنت متأكد من إعادة خلط وسحب القرعة من جديد؟ سيتم مسح أي نتائج سابقة.")) return;

generateMatches();
table();
renderMatches();
save();
alert("تمت إعادة القرعة بنجاح!");
}

function serializeMatches() {
return matches.map(m => ({ p1:m.p1.name, p2:m.p2.name, s1:m.s1, s2:m.s2, round:m.round }));
}

function getMatchId(m) {
return `r${m.round}_${m.p1.name}_${m.p2.name}`;
}

/* بيانات الدوري (المتسابقين والمواجهات) تنحفظ في الجوال، فالترتيب يطلع على طول وحتى بدون نت، وبعدين يتحدث من Firebase */
const LEAGUE_CACHE_KEY = "masro7_league_v1";
function applyLeagueData(data) {
if(data.playersList && Array.isArray(data.playersList)) {
players = data.playersList.map(name => ({ name:name, w:0, d:0, l:0, gf:0, ga:0, pts:0 }));
}

if(data.matches) {
matches = data.matches.map(m => {
let p1Obj = players.find(p => p.name === m.p1) || { name:m.p1, w:0,d:0,l:0,gf:0,ga:0,pts:0 };
let p2Obj = players.find(p => p.name === m.p2) || { name:m.p2, w:0,d:0,l:0,gf:0,ga:0,pts:0 };
return { p1:p1Obj, p2:p2Obj, s1:m.s1, s2:m.s2, round:m.round };
});
}
playerLinks = data.playerLinks || {};
}
function renderLeagueAll() {
table();
renderMatches();
renderPredictions();
renderFullAccountPage();
renderLeagueSummary();
}

// تشتغل قبل Firebase: بدون نت مكتبة Firebase نفسها ما تتحمل، فالنسخة المحفوظة هي اللي تطلع
function renderCachedLeague() {
try {
const cached = JSON.parse(localStorage.getItem(LEAGUE_CACHE_KEY) || "null");
if(cached && isInitialLoad && Array.isArray(cached.matches) && cached.matches.length) { applyLeagueData(cached); renderLeagueAll(); }
} catch(e) {}
}

function loadFromFirebase() {
if(!firebaseReady || !firebaseDB) return;

firebaseDB.collection("league").doc("current").onSnapshot(doc => {
if(doc.exists) {
let data = doc.data();
isInitialLoad = false;
applyLeagueData(data);
try { localStorage.setItem(LEAGUE_CACHE_KEY, JSON.stringify({ playersList: data.playersList || [], matches: data.matches || [], playerLinks: data.playerLinks || {} })); } catch(e) {}
} else {
generateMatches();
}
renderLeagueAll();
notifScoresCheck();
});

listenToVideos();
}

function save() {
localStorage.setItem("m", JSON.stringify(serializeMatches()));
if(!firebaseReady || !firebaseDB) return;

firebaseDB.collection("league").doc("current").set({
matches: serializeMatches(),
playersList: players.map(p => p.name),
playerLinks: playerLinks,
updatedAt: firebase.firestore.FieldValue.serverTimestamp()
}, { merge: true })
.catch(error => {
console.log(error);
});
}

function resetLeague() {
if(!isAdmin) return;
if(!confirm("هل أنت متأكد من إعادة ضبط الدوري وحذف جميع النتائج؟")) return;
generateMatches();
save();
alert("تم إعادة ضبط الدوري بنجاح");
}
