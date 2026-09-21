/* Service Worker بسيط لموقع MASRO7 LEAGUE:
   - يخزن الصفحة الرئيسية والشعار مؤقتاً ليفتح الموقع بسرعة حتى مع نت ضعيف.
   - لا يخزن بيانات الدوري نفسها (النتائج، الشات، الغرفة)، فهذي دائماً تجي محدثة من الإنترنت.
   - رقم الإصدار CACHE_NAME: لازم يتغيّر مع كل تحديث كبير للموقع حتى يحمّل الأجهزة النسخة الجديدة. */
const CACHE_NAME = "masro7-shell-v1";
const SHELL_FILES = ["/", "/index.html", "/logo.png", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
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
    req.headers.get("accept")?.includes("text/event-stream")
  ) {
    return;
  }

  /* شبكة أولاً مع رجوع للنسخة المخزنة عند انقطاع النت (يضمن تحديثات الدوري الفورية) */
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match("/index.html")))
  );
});
