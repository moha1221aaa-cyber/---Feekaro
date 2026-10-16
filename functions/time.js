/* وقت السيرفر للبث: كل الأجهزة تحسب المؤقتات منه بدل ساعة الجوال */
export async function onRequestGet() {
  return new Response(JSON.stringify({ t: Date.now() }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
