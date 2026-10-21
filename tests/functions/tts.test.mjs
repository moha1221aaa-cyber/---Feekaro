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
check("other origin refused", (await runFn(onRequestGet, new Request("https://masro7-league.pages.dev/tts?t=x", { headers: { Origin: "https://evil.example" } }), env)).status === 403);
auth.restore(); done();
