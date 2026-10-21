/* القائمة الجانبية (زر ☰ في الهيدر): التنقل، الميزات، وصفحات المعلومات (ما الجديد، طريقة اللعب، الخصوصية، عن الدوري).
   القائمة نفسها مودال (sideMenu) فزر الرجوع في الجوال يسكّرها مثل باقي النوافذ. */

const MENU_PAGES = [
    { id: "home", icon: "i-home", label: "الرئيسية" },
    { id: "table", icon: "i-chart", label: "الترتيب" },
    { id: "matches", icon: "i-ball", label: "المواجهات" },
    { id: "predictions", icon: "i-target", label: "التوقعات" },
    { id: "accountTab", icon: "i-user", label: "الحساب" },
    { id: "room", icon: "i-mic", label: "الغرفة الصوتية" }
];

/* أحدث شي فوق. أي ميزة جديدة تنضاف هنا عشان تطلع في "ما الجديد" */
const MENU_CHANGELOG = [
    { date: "21 أكتوبر 2026", items: [
        "الجرس في البث صار فوري: صوت واهتزاز أول ما تضغط",
        "الجواب بالصوت يسمعك من لحظة ضغط الجرس، ويوريك إنه يسمعك وأنت تتكلم"
    ] },
    { date: "20 أكتوبر 2026", items: [
        "مذيع البث صار بصوت سعودي جديد",
        "تصميم جديد كامل للموقع: شريط سفلي عائم، بطاقات مواجهات وترتيب أوضح، ونوافذ تطلع من تحت مثل التطبيقات"
    ] },
    { date: "19 أكتوبر 2026", items: [
        "قائمة جانبية فيها كل الصفحات والميزات وصفحات المعلومات",
        "الجواب بالصوت في البث: بعد الجرس تكلّم بجوابك والموقع يسمعه ويصحّحه",
        "صوت مذيع جديد للبث",
        "تنبيه بالأصوات لو المتصفح حجب التشغيل، وزر يشغّلها بضغطة",
        "ملخص لكل بث انتهى: النتائج وأسرع ضغطة جرس وأكبر فوز وأفضل المتوقعين",
        "استيراد أسئلة لبنك الأسئلة من ملف CSV"
    ] },
    { date: "18 أكتوبر 2026", items: [
        "بطاقة نتيجة المواجهة: صورة جاهزة للمشاركة تحت كل مواجهة منتهية",
        "مستوى المتسابق في ملفه: آخر 5 نتائج وأطول سلسلة فوز ومتوسط الأجوبة",
        "أوسمة المتوقعين: قنّاص، سلسلة، نجم الجولة",
        "الترتيب يطلع على طول وحتى بدون نت",
        "حماية أقوى للحسابات والبيانات"
    ] }
];

const MENU_INFO = {
    whatsNew: {
        icon: "i-rocket",
        title: "ما الجديد",
        html: () => MENU_CHANGELOG.map(g => `
<div class="info-block">
<div class="info-date">${escapeHTML(g.date)}</div>
<ul>${g.items.map(t => `<li>${escapeHTML(t)}</li>`).join("")}</ul>
</div>`).join("")
    },
    howToPlay: {
        icon: "i-book",
        title: "طريقة اللعب والقوانين",
        html: () => `
<div class="info-block">
<h4>المواجهة</h4>
<ul>
<li>كل مواجهة بين متسابقين اثنين، والأسئلة معلومات عامة.</li>
<li>ينعرض السؤال، وعندك ${Math.round(LIVE_BUZZ_MS / 1000)} ثانية تضغط الجرس. أول واحد يضغط هو اللي يجاوب.</li>
<li>تجاوب بالصوت أو بالكتابة. لو غلطت، السؤال يروح لخصمك.</li>
<li>كل جواب صح يحسب لك، والأكثر أجوبة صحيحة يفوز بالمواجهة.</li>
</ul>
</div>
<div class="info-block">
<h4>الترتيب</h4>
<ul>
<li>الفوز 3 نقاط، والتعادل نقطة، والخسارة صفر.</li>
<li>لو تساوت النقاط، الفرق بين الأجوبة له والأجوبة عليه يفصل بينهم.</li>
</ul>
</div>
<div class="info-block">
<h4>التوقعات (للجمهور)</h4>
<ul>
<li>سجّل دخولك وتوقّع نتيجة أي مواجهة قبل ما تبدأ.</li>
<li>النتيجة الدقيقة 5 نقاط، والفائز الصحيح بس 3 نقاط.</li>
<li>الأوسمة: قنّاص (3 توقعات دقيقة)، سلسلة (3 توقعات صحيحة ورا بعض)، نجم الجولة (أعلى نقاط في آخر جولة).</li>
</ul>
</div>`
    },
    privacy: {
        icon: "i-lock",
        title: "سياسة الخصوصية",
        html: () => `
<div class="info-block">
<p>آخر تحديث: 19 أكتوبر 2026. هذي الصفحة تشرح وش نجمع في موقع دوري بنو مسروح للنخبة وليش.</p>
</div>
<div class="info-block">
<h4>البيانات اللي نجمعها</h4>
<ul>
<li><b>الحساب:</b> الاسم والإيميل والصورة الشخصية لو رفعتها. الإيميل ما يشوفه إلا أنت ومنظم الدوري.</li>
<li><b>التوقعات:</b> توقعاتك ونقاطها، وتطلع باسمك في ترتيب المتوقعين.</li>
<li><b>الغرفة والبث:</b> اسمك ورسائلك في الشات وصوتك وقت ما يكون المايك مفتوح. الصوت ينبث مباشرة وما نسجّله.</li>
<li><b>الجواب بالصوت:</b> لما تجاوب بالصوت في البث، المقطع ينرسل للتحويل لنص عشان يتصحح، وما ينحفظ بعدها.</li>
<li><b>مساعد الدوري:</b> أسئلتك له تنرسل لخدمة الذكاء الاصطناعي عشان يرد، وما تنحفظ عندنا.</li>
</ul>
</div>
<div class="info-block">
<h4>الخدمات اللي نستخدمها</h4>
<ul>
<li>Firebase من Google: تسجيل الدخول وقاعدة البيانات.</li>
<li>Cloudflare: استضافة الموقع والذكاء الاصطناعي.</li>
<li>Agora: الصوت المباشر في الغرفة والبث.</li>
<li>Cloudinary: الصور والفيديوهات.</li>
</ul>
</div>
<div class="info-block">
<h4>على جهازك</h4>
<ul>
<li>نحفظ في المتصفح نسخة من بيانات الدوري عشان الموقع يفتح بسرعة، وبعض الإعدادات (مثل الإشعارات والمايك).</li>
<li>ما نستخدم إعلانات ولا أدوات تتبع، وما نبيع بياناتك لأي أحد.</li>
</ul>
</div>
<div class="info-block">
<h4>حقوقك</h4>
<ul>
<li>تقدر تعدّل اسمك وصورتك أو تحذفها من إعدادات الحساب.</li>
<li>لو تبي تحذف حسابك وكل بياناتك، تواصل مع منظم الدوري.</li>
</ul>
</div>`
    },
    about: {
        icon: "i-trophy",
        title: "عن الدوري",
        html: () => `
<div class="info-block" style="text-align:center;">
<img src="icon-192.png" alt="" width="72" height="72" style="border-radius:16px;">
<h4 style="margin:10px 0 4px;">دوري بنو مسروح للنخبة</h4>
<div style="color:#94a3b8;font-size:12px;">MASRO7 LEAGUE</div>
</div>
<div class="info-block">
<p>دوري أسئلة ومعلومات عامة بنظام الجرس. فيه ترتيب المتسابقين والمواجهات، وتوقعات للجمهور، وغرفة صوتية، وبث مباشر لكل جولة بطابع برامج المسابقات.</p>
<p>الموقع يشتغل كتطبيق: ثبّته من القائمة وتوصلك الإشعارات وقت البث.</p>
</div>`
    }
};

function menuItemHTML(icon, label, action, extraClass) {
    return `<button class="side-menu-item${extraClass ? " " + extraClass : ""}" onclick="${action}"><svg class="ic" aria-hidden="true"><use href="#${icon}"/></svg><span>${label}</span></button>`;
}

function renderSideMenu() {
    const body = document.getElementById("sideMenuBody");
    if (!body) return;
    const current = (document.querySelector(".section.active") || {}).id;
    const loggedIn = typeof firebaseAuth !== "undefined" && firebaseAuth && firebaseAuth.currentUser;
    body.innerHTML = `
<div class="side-menu-group">التنقل</div>
${MENU_PAGES.map(p => menuItemHTML(p.icon, p.label, `menuGoTab(${jsArg(p.id)})`, p.id === current ? "active" : "")).join("")}
<div class="side-menu-group">الميزات</div>
${menuItemHTML("i-message", "مساعد الدوري", "menuSwapModal(aiOpenChat)")}
${menuItemHTML("i-bell", "الإشعارات", "menuRun(enableNotifications)")}
${menuItemHTML("i-download", "تثبيت التطبيق", "menuRun(installPwa)")}
${menuItemHTML("i-share", "مشاركة الموقع", "menuRun(shareSite)")}
${loggedIn ? menuItemHTML("i-settings", "إعدادات الحساب", "menuSwapModal(openSettingsModal)") : ""}
<div class="side-menu-group">معلومات</div>
${Object.keys(MENU_INFO).map(k => menuItemHTML(MENU_INFO[k].icon, MENU_INFO[k].title, `menuSwapModal(function(){openInfoPage(${jsArg(k)})})`)).join("")}
<div class="side-menu-foot">MASRO7 LEAGUE © 2026</div>`;
}

function openSideMenu() {
    renderSideMenu();
    openModal("sideMenu");
    const btn = document.getElementById("menuBtn");
    if (btn) btn.setAttribute("aria-expanded", "true");
}

/* يسكّر القائمة وبعدها يشغّل fn. الانتظار لـ popstate عشان أي صفحة تفتح بعدها (مثل الغرفة) ما تنمسح مع رجوع القائمة */
function menuRun(fn) {
    const btn = document.getElementById("menuBtn");
    if (btn) btn.setAttribute("aria-expanded", "false");
    if (activeModalId === "sideMenu" && window.history.state && window.history.state.modalOpen) {
        window.addEventListener("popstate", () => setTimeout(fn, 0), { once: true });
        window.history.back();
    } else {
        closeAllModalsDirectly();
        fn();
    }
}

function menuGoTab(sectionId) {
    menuRun(() => { showTab(null, sectionId); window.scrollTo(0, 0); });
}

/* يبدّل القائمة بنافذة ثانية في نفس خطوة الرجوع: زر الرجوع من النافذة يرجع للصفحة على طول */
function menuSwapModal(openFn) {
    const menu = document.getElementById("sideMenu");
    if (menu) menu.classList.remove("active");
    const btn = document.getElementById("menuBtn");
    if (btn) btn.setAttribute("aria-expanded", "false");
    openFn();
}

function openInfoPage(key) {
    const page = MENU_INFO[key];
    if (!page) return;
    document.getElementById("infoPageTitle").innerHTML = `<svg class="ic" aria-hidden="true"><use href="#${page.icon}"/></svg> ${escapeHTML(page.title)}`;
    const body = document.getElementById("infoPageBody");
    body.innerHTML = page.html();
    body.scrollTop = 0;
    openModal("infoPageModal");
}

async function shareSite() {
    const url = "https://masro7-league.pages.dev/";
    const text = "دوري بنو مسروح للنخبة: الترتيب والمواجهات والتوقعات والبث المباشر";
    if (navigator.share) {
        try { await navigator.share({ title: "MASRO7 LEAGUE", text: text, url: url }); } catch (e) {}
        return;
    }
    try {
        await navigator.clipboard.writeText(url);
        alert("انتسخ رابط الموقع، شاركه مع ربعك");
    } catch (e) {
        window.open("https://wa.me/?text=" + encodeURIComponent(text + "\n" + url), "_blank");
    }
}
