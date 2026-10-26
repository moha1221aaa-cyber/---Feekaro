/* functions/som.js: التوزيع للمنظم بس، كل لاعب ياخذ أوراقه بس، والكشف وقت المداقشة بس.
   وثيقة اللعبة من Firestore وهمية (fetch محلي)، والتوكن موقّع بمفتاح تجريبي. */
import { setupAuth, fakeCaches, runFn, check, done } from "./helpers.mjs";
import { onRequestPost, shuffledDeck } from "../../functions/som.js";

const auth = await setupAuth(); fakeCaches();
const env = { AGORA_APP_CERTIFICATE: "0123456789abcdef0123456789abcdef" };
let DOC = null;
const enc = v => v === null || v === undefined ? { nullValue: null } : typeof v === "string" ? { stringValue: v } : typeof v === "boolean" ? { booleanValue: v }
    : typeof v === "number" ? { integerValue: String(v) } : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } }
    : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
auth.routes.push({ match: u => u.startsWith("https://firestore.googleapis.com/"), handle: async u => {
    if (!DOC || !u.includes("/room/main/games/som?")) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify({ fields: enc(DOC).mapValue.fields }));
} });
const post = async (body, tok, e) => runFn(onRequestPost, new Request("https://masro7-league.pages.dev/som", { method: "POST",
    headers: Object.assign({ Origin: "https://masro7-league.pages.dev", "Content-Type": "application/json" }, tok ? { Authorization: "Bearer " + tok } : {}), body: JSON.stringify(body) }), e || env);
const admin = await auth.token("u_admin", "moha1221aaa@gmail.com"), a = await auth.token("u_a"), b = await auth.token("u_b"), x = await auth.token("u_x");
const GID = "sabc12345";

/* الخلط */
const deck = shuffledDeck();
check("الخلط: 32 ورقة بدون تكرار", deck.length === 32 && new Set(deck).size === 32 && deck.every(c => c >= 0 && c < 32));
let same = 0; for (let i = 0; i < 20; i++) if (shuffledDeck().join() === deck.join()) same++;
check("الخلط عشوائي", same === 0);

/* deal */
check("deal: بدون دخول 401", (await post({ action: "deal", gid: GID, round: 1, uids: ["u_a", "u_b"] })).status === 401);
check("deal: لاعب 403", (await post({ action: "deal", gid: GID, round: 1, uids: ["u_a", "u_b"] }, a)).status === 403);
check("deal: لاعب واحد 400", (await post({ action: "deal", gid: GID, round: 1, uids: ["u_a"] }, admin)).status === 400);
check("deal: تكرار 400", (await post({ action: "deal", gid: GID, round: 1, uids: ["u_a", "u_a"] }, admin)).status === 400);
check("deal: 9 لاعبين 400", (await post({ action: "deal", gid: GID, round: 1, uids: Array.from({ length: 9 }, (_, i) => "u" + i) }, admin)).status === 400);
check("deal: رقم لعبة غلط 400", (await post({ action: "deal", gid: "../x", round: 1, uids: ["u_a", "u_b"] }, admin)).status === 400);
check("deal: بدون سر 503", (await post({ action: "deal", gid: GID, round: 1, uids: ["u_a", "u_b"] }, admin, {})).status === 503);
let r = await post({ action: "deal", gid: GID, round: 1, uids: ["u_a", "u_b", "u_admin"] }, admin);
let j = await r.json();
check("deal: المنظم ياخذ الختم وأوراقه", r.status === 200 && /^v1\./.test(j.deal) && Array.isArray(j.hand) && j.hand.length === 4, j);
const adminHand = j.hand;
DOC = { active: true, gid: GID, round: 1, phase: "bid", deal: j.deal, show: [] };

/* hand */
r = await post({ action: "hand", gid: GID, round: 1 }, a); const ha = (await r.json()).hand;
r = await post({ action: "hand", gid: GID, round: 1 }, b); const hb = (await r.json()).hand;
check("hand: كل لاعب 4 أوراق", ha.length === 4 && hb.length === 4);
check("hand: ما فيه ورقة مكررة بين اللاعبين", new Set(ha.concat(hb, adminHand)).size === 12);
check("hand: نفس الأوراق لو انطلبت مرة ثانية", JSON.stringify((await (await post({ action: "hand", gid: GID, round: 1 }, a)).json()).hand) === JSON.stringify(ha));
check("hand: اللي مو في الجولة 403", (await post({ action: "hand", gid: GID, round: 1 }, x)).status === 403);
check("hand: جولة ثانية 409", (await post({ action: "hand", gid: GID, round: 2 }, a)).status === 409);
DOC = Object.assign({}, DOC, { round: 2 });
check("hand: ختم جولة 1 ما ينفتح على أنه جولة 2", (await post({ action: "hand", gid: GID, round: 2 }, a)).status === 500);
DOC = Object.assign({}, DOC, { round: 1, deal: DOC.deal.slice(0, -4) + (DOC.deal.slice(-4) === "AAAA" ? "BBBB" : "AAAA") });
check("hand: ختم معدّل ما ينفتح", (await post({ action: "hand", gid: GID, round: 1 }, a)).status === 500);
DOC = { active: true, gid: GID, round: 1, phase: "bid", deal: j.deal, show: [] };

/* reveal */
check("reveal: لاعب 403", (await post({ action: "reveal", gid: GID, round: 1 }, a)).status === 403);
check("reveal: قبل المداقشة 409", (await post({ action: "reveal", gid: GID, round: 1 }, admin)).status === 409);
DOC = Object.assign({}, DOC, { phase: "showdown", show: ["u_a", "u_admin"] });
r = await post({ action: "reveal", gid: GID, round: 1 }, admin); j = await r.json();
check("reveal: أوراق اللي داقشوا بس", r.status === 200 && JSON.stringify(j.hands.u_a) === JSON.stringify(ha) && JSON.stringify(j.hands.u_admin) === JSON.stringify(adminHand) && !j.hands.u_b, j);
DOC = Object.assign({}, DOC, { show: ["u_a", "u_nobody"] });
check("reveal: لاعب مو في التوزيع 409", (await post({ action: "reveal", gid: GID, round: 1 }, admin)).status === 409);

/* الحماية */
check("Origin ثاني 403", (await runFn(onRequestPost, new Request("https://masro7-league.pages.dev/som", { method: "POST", headers: { Origin: "https://evil.example", Authorization: "Bearer " + a }, body: "{}" }), env)).status === 403);
check("action غلط 400", (await post({ action: "peek", gid: GID, round: 1 }, a)).status === 400);
let limited = false;
for (let i = 0; i < 70 && !limited; i++) limited = (await post({ action: "hand", gid: GID, round: 1 }, b)).status === 429;
check("hand: حد الطلبات بالدقيقة", limited);
auth.restore();
done();
