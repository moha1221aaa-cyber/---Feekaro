/* مولّد المؤثرات الصوتية الحقيقية للبث (ElevenLabs Sound Effects)
   - يستخدم نفس سر ELEVEN_KEY حق المذيع
   - ما يقبل نص حر: بس قائمة الأصوات الثابتة تحت (عشان محد يستخدمه ويخلص الرصيد)
   - الأصوات تتولد مرة وحدة بس، وتنحفظ كملفات mp3 دائمة في مجلد audio/ داخل الموقع
     (عن طريق GitHub Actions: .github/workflows/make-sfx.yml)
   - وتنحفظ كمان في كاش Cloudflare 30 يوم احتياط */

const SFX_PRESETS = {
  braam:     { s: 5,   p: 0.6,  t: "Massive cinematic movie trailer braam: huge deep brass horn blast layered with a sub bass boom impact and a long concert hall reverb tail" },
  riser:     { s: 3,   p: 0.6,  t: "Cinematic tension riser building up fast: rising whoosh, swelling strings and noise sweep, ending abruptly at the peak, movie trailer" },
  impact:    { s: 3,   p: 0.6,  t: "Deep cinematic boom impact hit with a metallic punch and a long reverb tail, movie trailer hit" },
  whoosh:    { s: 1.2, p: 0.6,  t: "Fast cinematic swoosh transition, air whoosh passing by quickly" },
  slam:      { s: 3.5, p: 0.6,  t: "Huge cinematic impact slam with a loud thunder crack and an electric lightning strike, epic versus screen" },
  heartbeat: { s: 1,   p: 0.7,  t: "One single deep tense heartbeat thump, close up, heavy bass" },
  go:        { s: 3,   p: 0.5,  t: "Powerful cinematic hit followed by a stadium crowd erupting in loud cheers" },
  cheer:     { s: 6,   p: 0.5,  t: "Large stadium crowd cheering, clapping and whistling in celebration after a goal" },
  whistle:   { s: 2.5, p: 0.6,  t: "Football referee blowing a long final whistle at the end of the match, stadium atmosphere" },
  fireworks: { s: 8,   p: 0.5,  t: "Fireworks show: rockets whistling up into the sky and exploding with loud booms and crackling sparkles, outdoor celebration" },
  bed_epic:  { s: 20,  p: 0.45, loop: true, t: "Epic cinematic orchestral music loop with big taiko drums, powerful strings and brass, sports tournament broadcast, no vocals" },
  bed_tension: { s: 20, p: 0.45, loop: true, t: "Suspenseful quiz show tension music loop: ticking clock, pulsing low synth bass and suspense strings underscore, no vocals" },
  crowd:     { s: 15,  p: 0.5,  loop: true, t: "Indoor arena crowd ambience: audience murmuring and chatting excitedly while waiting, distant claps" }
};

const err = (status, msg) => new Response(JSON.stringify({ error: msg }), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
});

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";

  if (id === "ping") return new Response(JSON.stringify({ ok: true, key: !!env.ELEVEN_KEY, ids: Object.keys(SFX_PRESETS) }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });

  const pr = SFX_PRESETS[id];
  if (!pr) return err(404, "unknown sound");
  if (!env.ELEVEN_KEY) return err(503, "ELEVEN_KEY not configured");

  const cache = caches.default;
  const cacheKey = new Request(url.origin + "/sfx-cache?v=1&id=" + encodeURIComponent(id));
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const body = { text: pr.t, duration_seconds: pr.s, prompt_influence: pr.p, model_id: "eleven_text_to_sound_v2" };
  if (pr.loop) body.loop = true;
  const r = await fetch("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128", {
    method: "POST",
    headers: { "xi-api-key": env.ELEVEN_KEY.trim(), "Content-Type": "application/json", "Accept": "audio/mpeg" },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    let m = String(r.status);
    try { const d = await r.json(); m = (d.detail && (d.detail.message || d.detail.status || JSON.stringify(d.detail))) || m; } catch (e) {}
    return err(502, "ElevenLabs: " + m);
  }
  const res = new Response(await r.arrayBuffer(), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=2592000",
      "X-Cost": r.headers.get("character-cost") || ""
    }
  });
  context.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
