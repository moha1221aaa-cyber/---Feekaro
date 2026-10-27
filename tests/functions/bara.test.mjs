/* functions/bara.js: التوزيع والكشف للمنظم بس، كل لاعب ياخذ دوره هو بس، والتخمين للي برا السالفة بس ووقته بس.
   وبنك الكلمات (lib/bara-words.js): 40 وأكثر لكل تصنيف، وبدون تكرار. وثيقة اللعبة من Firestore وهمية (fetch محلي). */
import { setupAuth, fakeCaches, runFn, check, done } from "./helpers.mjs";
import { onRequestPost, pickRound } from "../../functions/bara.js";
import { BARA_WORDS, BARA_CAT_IDS } from "../../lib/bara-words.js";

/* البنك */
const all = BARA_CAT_IDS.flatMap(c => BARA_WORDS[c].w);
check("10 تصنيفات", BARA_CAT_IDS.length === 10);
check("40 كلمة وأكثر لكل تصنيف", BARA_CAT_IDS.every(c => BARA_WORDS[c].w.length >= 40), BARA_CAT_IDS.map(c => c + ":" + BARA_WORDS[c].w.length));
check("ما فيه كلمة مكررة (حتى بين التصنيفات)", new Set(all).size === all.length, all.filter((x, i) => all.indexOf(x) !== i));
check("كل الكلمات نص عربي قصير", all.every(w => typeof w === "string" && w.trim() === w && w.length >= 2 && w.length <= 30));
const r1 = pickRound("food", ["a", "b", "c"]);
check("8 خيارات من نفس التصنيف وفيها الكلمة", r1.opts.length === 8 && new Set(r1.opts).size === 8 && r1.opts.includes(r1.w) && r1.opts.every(w => BARA_WORDS.food.w.includes(w)));
const cats = new Set(); for (let i = 0; i < 80; i++) cats.add(pickRound("random", ["a", "b", "c"]).c);
check("العشوائي يختار من تصنيفات مختلفة", cats.size >= 5);
const outs = new Set(); for (let i = 0; i < 60; i++) outs.add(pickRound("food", ["a", "b", "c"]).o);
check("اللي برا السالفة عشوائي بين اللاعبين", outs.size === 3);

const auth = await setupAuth(); fakeCaches();
const env = { AGORA_APP_CERTIFICATE: "0123456789abcdef0123456789abcdef" };
let DOC = null;
const enc = v => v === null || v === undefined ? { nullValue: null } : typeof v === "string" ? { stringValue: v } : typeof v === "boolean" ? { booleanValue: v }
    : typeof v === "number" ? { integerValue: String(v) } : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } }
    : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
auth.routes.push({ match: u => u.startsWith("https://firestore.googleapis.com/"), handle: async u => {
    if (!DOC || !u.includes("/room/main/games/bara?")) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify({ fields: enc(DOC).mapValue.fields }));
} });
const post = async (body, tok, e) => runFn(onRequestPost, new Request("https://masro7-league.pages.dev/bara", { method: "POST",
    headers: Object.assign({ Origin: "https://masro7-league.pages.dev", "Content-Type": "application/json" }, tok ? { Authorization: "Bearer " + tok } : {}), body: JSON.stringify(body) }), e || env);
const J = async r => ({ status: r.status, j: await r.json() });
const admin = await auth.token("u_admin", "moha1221aaa@gmail.com"), a = await auth.token("u_a"), b = await auth.token("u_b"), x = await auth.token("u_x");
const T = { u_admin: admin, u_a: a, u_b: b };
const GID = "babc12345", PIDS = ["u_a", "u_b", "u_admin"];

/* deal */
check("deal: بدون دخول 401", (await post({ action: "deal", gid: GID, round: 1, cat: "food", pids: PIDS })).status === 401);
check("deal: لاعب 403", (await post({ action: "deal", gid: GID, round: 1, cat: "food", pids: PIDS }, a)).status === 403);
check("deal: لاعبين اثنين 400", (await post({ action: "deal", gid: GID, round: 1, cat: "food", pids: ["u_a", "u_b"] }, admin)).status === 400);
check("deal: 11 لاعب 400", (await post({ action: "deal", gid: GID, round: 1, cat: "food", pids: Array.from({ length: 11 }, (_, i) => "u" + i) }, admin)).status === 400);
check("deal: تكرار 400", (await post({ action: "deal", gid: GID, round: 1, cat: "food", pids: ["u_a", "u_a", "u_b"] }, admin)).status === 400);
check("deal: تصنيف غلط 400", (await post({ action: "deal", gid: GID, round: 1, cat: "xx", pids: PIDS }, admin)).status === 400);
check("deal: بدون سر 503", (await post({ action: "deal", gid: GID, round: 1, cat: "food", pids: PIDS }, admin, {})).status === 503);
let r = await J(await post({ action: "deal", gid: GID, round: 1, cat: "animals", pids: PIDS }, admin));
check("deal: المنظم ياخذ الختم والتصنيف ودوره", r.status === 200 && /^v1\./.test(r.j.plan) && r.j.cat === "animals" && r.j.catName === "حيوانات" && r.j.role && typeof r.j.role.out === "boolean", r.j);
check("deal: الكلمة ومين برا ما يطلعون في الرد (غير دور المنظم نفسه)", !JSON.stringify({ plan: r.j.plan, cat: r.j.cat }).match(/u_a|u_b/) && !BARA_WORDS.animals.w.some(w => r.j.plan.includes(w)));
DOC = { active: true, gid: GID, round: 1, phase: "lobby", plan: r.j.plan, pids: PIDS };
check("role: قبل ما تبدأ الجولة 409", (await post({ action: "role", gid: GID, round: 1 }, a)).status === 409);
DOC.phase = "ask";

/* role */
const roles = {};
for (const u of PIDS) roles[u] = (await J(await post({ action: "role", gid: GID, round: 1 }, T[u]))).j;
const outs1 = PIDS.filter(u => roles[u].out);
check("role: واحد بس برا السالفة", outs1.length === 1, roles);
const OUT = outs1[0], IN = PIDS.find(u => u !== OUT);
const word = roles[IN].word;
check("role: اللي داخل يشوف الكلمة والتصنيف", BARA_WORDS.animals.w.includes(word) && roles[IN].catName === "حيوانات");
check("role: اللي برا يشوف التصنيف بس (بدون الكلمة)", roles[OUT].word === undefined && roles[OUT].catName === "حيوانات" && !JSON.stringify(roles[OUT]).includes(word));
check("role: كل اللي داخل نفس الكلمة", PIDS.filter(u => u !== OUT).every(u => roles[u].word === word));
check("role: دور المنظم من deal نفسه", r.j.role.out === (OUT === "u_admin"));
check("role: اللي مو في الجولة 403", (await post({ action: "role", gid: GID, round: 1 }, x)).status === 403);
check("role: جولة ثانية 409", (await post({ action: "role", gid: GID, round: 2 }, a)).status === 409);
DOC = Object.assign({}, DOC, { round: 2 });
check("role: ختم جولة 1 ما ينفتح على أنه جولة 2", (await post({ action: "role", gid: GID, round: 2 }, a)).status === 500);
DOC = Object.assign({}, DOC, { round: 1, plan: DOC.plan.slice(0, -4) + (DOC.plan.slice(-4) === "AAAA" ? "BBBB" : "AAAA") });
check("role: ختم معدّل ما ينفتح", (await post({ action: "role", gid: GID, round: 1 }, a)).status === 500);
DOC = { active: true, gid: GID, round: 1, phase: "ask", plan: r.j.plan, pids: PIDS };

/* reveal */
check("reveal: لاعب 403", (await post({ action: "reveal", gid: GID, round: 1 }, a)).status === 403);
check("reveal: قبل التصويت 409 (حتى المنظم)", (await post({ action: "reveal", gid: GID, round: 1 }, admin)).status === 409);
DOC.phase = "vote";
let rv = await J(await post({ action: "reveal", gid: GID, round: 1 }, admin));
check("reveal: وقت التصويت يرجّع اللي برا والكلمة والخيارات", rv.status === 200 && rv.j.out === OUT && rv.j.word === word && rv.j.opts.length === 8 && rv.j.opts.includes(word), rv.j);

/* guess */
const outTok = T[OUT], inTok = T[IN];
check("guess: قبل وقت التخمين 409", (await post({ action: "guess", gid: GID, round: 1, choice: word }, outTok)).status === 409);
DOC.phase = "guess";
check("guess: اللي داخل السالفة 403", (await post({ action: "guess", gid: GID, round: 1, choice: word }, inTok)).status === 403);
check("guess: كلمة من برا الخيارات 400", (await post({ action: "guess", gid: GID, round: 1, choice: "شي ثاني" }, outTok)).status === 400);
const wrong = rv.j.opts.find(w => w !== word);
let g = await J(await post({ action: "guess", gid: GID, round: 1, choice: wrong }, outTok));
check("guess: إيصال بدون ما يقول صح أو غلط ولا الكلمة", g.status === 200 && /^v1\./.test(g.j.receipt) && g.j.ok === undefined && !JSON.stringify(g.j).includes(word), g.j);
let g2 = await J(await post({ action: "guess", gid: GID, round: 1, choice: word }, outTok));
check("guess: التخمين الثاني يرجع نفس الإيصال الأول", g2.j.receipt === g.j.receipt && g2.j.repeat === true);
rv = await J(await post({ action: "reveal", gid: GID, round: 1, receipt: g.j.receipt }, admin));
check("reveal + الإيصال: السيرفر يحكم (غلط)", rv.j.verdict && rv.j.verdict.choice === wrong && rv.j.verdict.ok === false, rv.j);
rv = await J(await post({ action: "reveal", gid: GID, round: 1, receipt: "v1.fake" }, admin));
check("reveal: إيصال مزوّر ما ينحسب", rv.j.verdict === null);
/* جولة 2 بتخمين صح */
let d2 = await J(await post({ action: "deal", gid: GID, round: 2, cat: "food", pids: PIDS }, admin));
DOC = { active: true, gid: GID, round: 2, phase: "vote", plan: d2.j.plan, pids: PIDS };
const rv2 = (await J(await post({ action: "reveal", gid: GID, round: 2 }, admin))).j;
DOC.phase = "guess";
const g3 = (await J(await post({ action: "guess", gid: GID, round: 2, choice: rv2.word }, T[rv2.out]))).j;
const v3 = (await J(await post({ action: "reveal", gid: GID, round: 2, receipt: g3.receipt }, admin))).j;
check("reveal + الإيصال: السيرفر يحكم (صح)", v3.verdict && v3.verdict.ok === true && v3.verdict.choice === rv2.word);
check("reveal: إيصال جولة 1 ما ينفع لجولة 2", (await J(await post({ action: "reveal", gid: GID, round: 2, receipt: g.j.receipt }, admin))).j.verdict === null);

/* الحماية */
check("Origin ثاني 403", (await runFn(onRequestPost, new Request("https://masro7-league.pages.dev/bara", { method: "POST", headers: { Origin: "https://evil.example", Authorization: "Bearer " + a }, body: "{}" }), env)).status === 403);
check("action غلط 400", (await post({ action: "peek", gid: GID, round: 1 }, a)).status === 400);
check("رقم لعبة غلط 400", (await post({ action: "role", gid: "../x", round: 1 }, a)).status === 400);
let limited = false;
for (let i = 0; i < 70 && !limited; i++) limited = (await post({ action: "role", gid: GID, round: 2 }, b)).status === 429;
check("role: حد الطلبات بالدقيقة", limited);
auth.restore();
done();
