/* functions/tts.js: الزائر بدون حساب ياخذ الجملة من الكاش حتى لو طلبها بنفس لحظة توليدها (كان يرجع 401 والمذيع يسكت عنده)،
   وما يصرف من الرصيد أبد.  node tests/functions/tts.test.mjs */
import { setupAuth, fakeCaches, runFn, check, done } from "./helpers.mjs";
import { onRequestGet } from "../../functions/tts.js";

const auth = await setupAuth();
fakeCaches();
let gens = 0;
auth.routes.push({ match: u => u.startsWith("https://api.elevenlabs.io/"), handle: async () => { gens++; await new Promise(r => setTimeout(r, 900)); return new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "audio/mpeg" } }); } });
const env = { ELEVEN_KEY: "k" };
const get = (t, tok) => runFn(onRequestGet, new Request("https://masro7-league.pages.dev/tts?t=" + encodeURIComponent(t), { headers: Object.assign({ Origin: "https://masro7-league.pages.dev" }, tok ? { Authorization: "Bearer " + tok } : {}) }), env);
const host = await auth.token("u_host", "host@t");

/* المنظم يولّد، والزائر يطلب بنفس اللحظة */
const [h, g] = await Promise.all([get("السؤال الأول", host), new Promise(r => setTimeout(r, 50)).then(() => get("السؤال الأول"))]);
check("host generates (200)", h.status === 200);
check("guest asking at the same moment gets it from the cache (200, not 401)", g.status === 200, g.status);
check("generated once (guest spends nothing)", gens === 1, gens);
const t0 = Date.now();
const miss = await get("جملة ما أحد ولّدها");
check("guest with nothing in the cache still gets 401", miss.status === 401 && gens === 1, miss.status);
check("guest wait is bounded (< 3.5 s)", Date.now() - t0 < 3500, Date.now() - t0);
check("guest hit from cache is instant", (await get("السؤال الأول")).status === 200);
/* متسابق مسجّل (w=1) يطلب مع المنظم: ينتظر الكاش بدل ما يولّد مرة ثانية */
const p1 = await auth.token("u_p1", "p1@t");
const gw = url => runFn(onRequestGet, new Request("https://masro7-league.pages.dev/tts?w=1&t=" + encodeURIComponent(url), { headers: { Origin: "https://masro7-league.pages.dev", Authorization: "Bearer " + p1 } }), env);
const g0 = gens;
const [h2, w2] = await Promise.all([get("السؤال الثاني", host), new Promise(r => setTimeout(r, 50)).then(() => gw("السؤال الثاني"))]);
check("logged-in player (w=1) waits for the host's copy", h2.status === 200 && w2.status === 200 && gens === g0 + 1, gens - g0);
const w3 = await gw("جملة المنظم غايب عنها");
check("w=1 and nobody generates: the player generates after the wait", w3.status === 200 && gens === g0 + 2);
/* 27 أكتوبر 2026: Gemini (Alnilam) بعد ElevenLabs. رصيد ElevenLabs خلص ← Gemini يولّد، وصوته WAV ينحفظ في الكاش لحاله */
{
    const wav = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]);   /* "RIFF..." */
    let gemBody = null, gemN = 0;
    auth.routes.unshift({ match: u => u.startsWith("https://api.elevenlabs.io/") && env2.elDown, handle: async () => new Response(JSON.stringify({ detail: { message: "quota_exceeded" } }), { status: 401 }) });
    auth.routes.push({ match: u => u.startsWith("https://generativelanguage.googleapis.com/v1beta/interactions"), handle: async (u, init) => { gemN++; gemBody = JSON.parse(init.body); return new Response(JSON.stringify({ steps: [{ type: "model_output", content: [{ type: "audio", data: Buffer.from(wav).toString("base64") }] }] })); } });
    var env2 = { ELEVEN_KEY: "k", GEMINI_API_KEY: "g", elDown: true };
    const r = await runFn(onRequestGet, new Request("https://masro7-league.pages.dev/tts?t=" + encodeURIComponent("جملة بعد ما خلص الرصيد"), { headers: { Origin: "https://masro7-league.pages.dev", Authorization: "Bearer " + host } }), env2);
    const buf = new Uint8Array(await r.arrayBuffer());
    check("ElevenLabs out of credit → Gemini answers (WAV)", r.status === 200 && r.headers.get("X-TTS-Engine") === "gm" && /wav/.test(r.headers.get("Content-Type")) && buf[0] === 82, [r.status, r.headers.get("X-TTS-Engine"), r.headers.get("Content-Type")]);
    check("Gemini request: model, voice Alnilam, the text, quiz-host style", gemBody && gemBody.model === "gemini-3.8-flash-tts" && gemBody.generation_config.speech_config[0].voice === "Alnilam"
        && gemBody.input[0].content[0].text === "جملة بعد ما خلص الرصيد" && /quiz show host/.test(gemBody.input[0].content[0].annotations[0].style), gemBody);
    const again = await runFn(onRequestGet, new Request("https://masro7-league.pages.dev/tts?t=" + encodeURIComponent("جملة بعد ما خلص الرصيد"), { headers: { Origin: "https://masro7-league.pages.dev" } }), env2);
    check("same line again (guest): from the cache, Gemini not asked twice", again.status === 200 && gemN === 1, gemN);
    env2.elDown = false;
    const el = await runFn(onRequestGet, new Request("https://masro7-league.pages.dev/tts?t=" + encodeURIComponent("جملة جديدة والرصيد رجع"), { headers: { Origin: "https://masro7-league.pages.dev", Authorization: "Bearer " + host } }), env2);
    check("ElevenLabs working → ElevenLabs first (Gemini is only the fallback)", el.headers.get("X-TTS-Engine") === "el" && gemN === 1);
}
/* Gemini يعلّق (صار في العينات 120 ث): بعد 10 ث يكمّل للي بعده، والمذيع ما يتأخر أكثر */
{
    auth.routes.unshift({ match: u => u.startsWith("https://generativelanguage.googleapis.com/") && env3.hang, handle: (u, init) => new Promise((res, rej) => { init.signal && init.signal.addEventListener("abort", () => { const e = new Error("aborted"); e.name = "AbortError"; rej(e); }); }) });
    var env3 = { GEMINI_API_KEY: "g", AZURE_TTS_KEY: "a", AZURE_TTS_REGION: "x", hang: true };
    auth.routes.push({ match: u => u.includes(".tts.speech.microsoft.com/"), handle: async () => new Response(new Uint8Array([9, 9]), { headers: { "Content-Type": "audio/mpeg" } }) });
    const t0 = Date.now();
    const r = await runFn(onRequestGet, new Request("https://masro7-league.pages.dev/tts?t=" + encodeURIComponent("جملة وقوقل معلّق"), { headers: { Origin: "https://masro7-league.pages.dev", Authorization: "Bearer " + host } }), env3);
    const ms = Date.now() - t0;
    check("Gemini hangs → gives up after 10 s and the next engine answers", r.status === 200 && r.headers.get("X-TTS-Engine") === "az" && ms >= 9500 && ms < 12500, [r.status, r.headers.get("X-TTS-Engine"), ms]);
}
check("other origin refused", (await runFn(onRequestGet, new Request("https://masro7-league.pages.dev/tts?t=x", { headers: { Origin: "https://evil.example" } }), env)).status === 403);
auth.restore(); done();
