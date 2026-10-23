/* Service Worker بسيط لموقع MASRO7 LEAGUE:
   - يخزن الصفحة الرئيسية والشعار مؤقتاً ليفتح الموقع بسرعة حتى مع نت ضعيف.
   - لا يخزن بيانات الدوري نفسها (النتائج، الشات، الغرفة)، فهذي دائماً تجي محدثة من الإنترنت.
   - رقم الإصدار CACHE_NAME: لازم يتغيّر مع كل تحديث كبير للموقع حتى يحمّل الأجهزة النسخة الجديدة. */
const CACHE_NAME = "masro7-shell-v59";
/* ملفات الموقع الأساسية (الشكل في css/ والكود في js/) */
const SHELL_FILES = ["/", "/index.html", "/logo.png", "/icon-192.png", "/manifest.json", "/css/main.css", "/css/room.css", "/css/design.css", "/css/broadcast.css", "/js/core.js", "/js/pwa.js", "/js/wake.js", "/js/config.js", "/js/voice.js", "/js/app.js", "/js/notifications.js", "/js/predictions.js", "/js/league.js", "/js/account.js", "/js/videos.js", "/js/room.js", "/js/room-tools.js", "/js/room-screen.js", "/js/broadcast/engine.js", "/js/broadcast/presenter.js", "/js/broadcast/studio.js", "/js/broadcast/cinema.js", "/js/broadcast/tv.js", "/js/broadcast/show.js", "/js/broadcast/voice.js", "/js/broadcast/va-worklet.js", "/js/broadcast/voice-answer.js", "/js/broadcast/screen.js", "/js/ai.js", "/js/menu.js"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.all(SHELL_FILES.map((f) => cache.add(f).catch(() => {}))))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  /* لا نتدخل أبداً في اتصالات أجورا (الصوت المباشر) أو أي طلب لدالة الـ Token أو Firestore/الخارجية */
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/.netlify/") ||
    url.pathname.startsWith("/agora-token") ||
    url.pathname.startsWith("/tts") ||
    url.pathname.startsWith("/time") ||
    url.pathname.startsWith("/media/") ||
    req.headers.get("accept")?.includes("text/event-stream")
  ) {
    return;
  }

  /* شبكة أولاً مع رجوع للنسخة المخزنة عند انقطاع النت (يضمن تحديثات الدوري الفورية) */
  event.respondWith(
    fetch(req)
      .then((res) => {
        /* نخزّن الرد السليم بس، عشان صفحة خطأ (404 أو 500) ما تنحفظ وتطلع بدون نت */
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || (req.mode === "navigate" ? caches.match("/index.html") : undefined)))
  );
});

/* الضغط على الإشعار: يفتح الموقع (أو البث) ويرجع للتبويب المفتوح لو موجود */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin)) {
          return c.focus().then(() => (c.navigate && url !== c.url ? c.navigate(url) : c));
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
