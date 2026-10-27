/* قوانين "برا السالفة" (js/bara.js baraReduce): الردهة، الجولة، الأسئلة، التصويت، الكشف، التخمين، والنقاط.
   الملف يتحمّل في vm (سكربت عادي مو module) بدون أي واجهة. */
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { check, done } from "./helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ctx = vm.createContext({ console, sessionStorage: { getItem: () => null, setItem() {} }, Math, JSON, Date });
vm.runInContext(fs.readFileSync(path.join(ROOT, "js/bara.js"), "utf8") + "\n;globalThis.__b = { baraReduce, baraPairs, baraDelta, BARA, BARA_CATS };", ctx);
const { baraReduce, baraPairs, BARA, BARA_CATS } = ctx.__b;

let S = null, now = 1000;
const H = { uid: "h", host: true }, P = u => ({ uid: u, host: false });
function act(who, a) { const r = baraReduce(S, a, Object.assign({ now }, who)); if (r.err) return r.err; S = r.s; return null; }
const score = u => S.players[u].score;
const pairs = ids => baraPairs(ids);
/* Firestore ما يقبل مصفوفة داخل مصفوفة: الحالة كلها لازم تكون بدونها */
const nested = v => Array.isArray(v) ? v.some(x => Array.isArray(x) || nested(x)) : v && typeof v === "object" ? Object.values(v).some(nested) : false;

check("10 تصنيفات بالأسماء المطلوبة", BARA_CATS.length === 10 && ["أكلات", "أماكن", "مهن", "حيوانات", "أفلام ومسلسلات", "أغراض البيت", "رياضة", "ماركات", "دول", "شخصيات خليجية مشهورة"].every(n => BARA_CATS.some(c => c[1] === n)));

/* ترتيب الأسئلة: كل واحد يسأل مرة وينسأل مرة، وما أحد يسأل نفسه */
let okPairs = true;
for (let k = 0; k < 300; k++) {
    const ids = Array.from({ length: 3 + (k % 8) }, (_, i) => "u" + i), ps = baraPairs(ids);
    if (ps.length !== ids.length || ps.some(p => p.a === p.b) || new Set(ps.map(p => p.a)).size !== ids.length || new Set(ps.map(p => p.b)).size !== ids.length) okPairs = false;
}
check("ترتيب الأسئلة سليم (300 مرة، 3 لين 10 لاعبين)", okPairs);

/* الردهة */
check("لاعب ما يفتح طاولة", !!act(P("a"), { t: "create", gid: "babcdefg1" }));
check("المنظم يفتح طاولة", act(H, { t: "create", gid: "babcdefg1", name: "محمد" }) === null && S.phase === "lobby" && S.rounds === 5);
act(P("a"), { t: "join", name: "عبدالله" });
const vBefore = S.v;
check("الانضمام يغيّر pids و players بس (القواعد)", S.v === vBefore && S.pids.join() === "a");
act(P("b"), { t: "join", name: "بدر" });
check("ما ينضم مرتين", !!act(P("a"), { t: "join", name: "x" }));
check("الجولة تحتاج 3 لاعبين", !!act(H, { t: "round", round: 1, plan: "v1.p", cat: "food", catName: "أكلات", asks: pairs(["a", "b"]) }));
act(P("c"), { t: "join", name: "جاسم" }); act(P("d"), { t: "join", name: "دخيل" });
act(P("d"), { t: "leave" });
check("الطلوع من الردهة", S.pids.join() === "a,b,c" && !S.players.d);
check("لاعب ما يغيّر عدد الجولات", !!act(P("a"), { t: "rounds", n: 3 }));
act(H, { t: "rounds", n: 3 });
check("المنظم يحدد 3 جولات", S.rounds === 3);
check("لاعب ما يبدأ جولة", !!act(P("a"), { t: "round", round: 1, plan: "v1.p", cat: "food", catName: "أكلات", asks: pairs(S.pids) }));
check("ترتيب أسئلة غلط ينرفض", !!act(H, { t: "round", round: 1, plan: "v1.p", cat: "food", catName: "أكلات", asks: [{ a: "a", b: "a" }, { a: "b", b: "c" }, { a: "c", b: "b" }] }));
check("تصنيف غلط ينرفض", !!act(H, { t: "round", round: 1, plan: "v1.p", cat: "xx", catName: "?", asks: pairs(S.pids) }));

/* الجولة 1: c برا السالفة وانكشف (a و b صوّتوا عليه)، وخمّن صح */
const asks1 = [{ a: "a", b: "b" }, { a: "b", b: "c" }, { a: "c", b: "a" }];
act(H, { t: "round", round: 1, plan: "v1.p1", cat: "food", catName: "أكلات", asks: asks1 });
check("الجولة 1: مرحلة الأسئلة", S.phase === "ask" && S.round === 1 && S.turn === 0 && S.laps === 1);
check("ما فيه مصفوفة داخل مصفوفة في الحالة", !nested(S));
check("لاعب ما يضغط التالي", !!act(P("a"), { t: "next" }));
act(H, { t: "next" }); act(H, { t: "next" }); act(H, { t: "next" });
check("خلصت الدورة", S.turn === 3 && !!act(H, { t: "next" }));
check("دورة ثانية بترتيب غلط ترفض", !!act(H, { t: "lap", asks: [{ a: "a", b: "b" }] }));
act(H, { t: "lap", asks: pairs(S.pids) });
check("دورة ثانية", S.laps === 2 && S.asks.length === 6 && S.turn === 3);
check("ما يكشف قبل التصويت", !!act(H, { t: "reveal", votes: {}, out: "c", opts: Array(8).fill("x") }));
act(H, { t: "vote" });
check("التصويت بدأ", S.phase === "vote" && S.voted.length === 0);
act(H, { t: "voted", list: ["b", "a", "zz"] });
check("قائمة اللي صوّتوا (بدون لمين، وبترتيب الطاولة)", S.voted.join() === "a,b");
const OPTS = ["كبسة", "مندي", "جريش", "قرصان", "مرقوق", "هريس", "فول", "تميس"];
check("الخيارات لازم 8", !!act(H, { t: "reveal", votes: {}, out: "c", opts: OPTS.slice(0, 7) }));
act(H, { t: "reveal", votes: { a: "c", b: "c", c: "c", zz: "a" }, out: "c", opts: OPTS });
check("صوت لنفسه أو من برا الطاولة ما ينحسب", JSON.stringify(S.res.votes) === JSON.stringify({ a: "c", b: "c" }));
check("انكشف (الأكثر لحاله)", S.phase === "guess" && S.res.caught === true && S.res.tally.c === 2);
check("الكلمة ما طلعت في الحالة قبل النتيجة", !JSON.stringify(S).includes('"word"'));
check("تخمين من برا الخيارات ينرفض", !!act(H, { t: "settle", word: "كبسة", choice: "برجر" }));
check("كلمة من برا الخيارات ترفض", !!act(H, { t: "settle", word: "شي", choice: null }));
act(H, { t: "settle", word: "كبسة", choice: "كبسة" });
check("انكشف + خمّن صح: c +150 بس", score("c") === 150 && S.res.ok === true);
check("اللي صوّتوا صح: +100", score("a") === 100 && score("b") === 100);
check("الكلمة انكشفت في النتيجة", S.phase === "result" && S.res.word === "كبسة");

/* الجولة 2: a برا السالفة وما انكشف (الأصوات على b)، وخمّن غلط، و c ما صوّت */
now += 1000;
act(H, { t: "round", round: 2, plan: "v1.p2", cat: "places", catName: "أماكن", asks: pairs(S.pids) });
check("الجولة 2 تبدأ من النتيجة", S.phase === "ask" && S.round === 2 && S.res === null && S.voted.length === 0);
act(H, { t: "vote" });
act(H, { t: "reveal", votes: { a: "b", b: "c" }, out: "a", opts: OPTS });
check("تعادل (b و c صوت لكل واحد) ← ما انكشف", S.res.caught === false && S.res.top.length === 2);
act(H, { t: "settle", word: "مندي", choice: "كبسة" });
check("ما انكشف + خمّن غلط: a +200", score("a") === 100 + 200 && S.res.ok === false);
check("ما أحد صوّت صح: b و c ما زادوا", score("b") === 100 && score("c") === 150);

/* الجولة 3: b برا السالفة، الأكثر شخص ثاني (c)، وخمّن صح، وأحد ما صوّت أبد */
now += 1000;
act(H, { t: "round", round: 3, plan: "v1.p3", cat: "gulf", catName: "شخصيات خليجية مشهورة", asks: pairs(S.pids) });
act(H, { t: "vote" });
act(H, { t: "reveal", votes: { a: "c", b: "c" }, out: "b", opts: OPTS });
check("الأكثر شخص ثاني ← ما انكشف", S.res.caught === false);
act(H, { t: "settle", word: "هريس", choice: "هريس" });
check("ما انكشف + خمّن صح: +200 +150", score("b") === 100 + 350);
check("اللي ما صوّت (c) صفر", score("c") === 150);
check("الجولات خلصت: ما تبدأ رابعة", !!act(H, { t: "round", round: 4, plan: "v1.p4", cat: "food", catName: "أكلات", asks: pairs(S.pids) }));

/* المنظم تخطى التخمين: ينحسب ما خمّن */
const S3 = S;
S = JSON.parse(JSON.stringify(S3)); S.phase = "guess"; S.res = { votes: {}, tally: {}, top: [], out: "a", caught: false, opts: OPTS };
const before = score("a");
act(H, { t: "settle", word: "كبسة", choice: null });
check("ما أحد صوّت + ما خمّن: +200 بس", score("a") === before + 200 && S.res.choice === null);
S = S3;

check("لاعب ما ينهي اللعبة", !!act(P("a"), { t: "end" }));
act(H, { t: "end" });
check("انتهت", S.phase === "over");
check("لاعب ما ينضم بعد البداية", (() => { const T = S; S = JSON.parse(JSON.stringify(T)); S.phase = "vote"; const e = act(P("z"), { t: "join", name: "z" }); S = T; return !!e; })());
act(H, { t: "close" });
check("سكّر", S.active === false);
check("طاولة جديدة بعد ما تسكّر", act(H, { t: "create", gid: "bnew12345", name: "محمد" }) === null && S.pids.length === 0);
/* 10 لاعبين بالكثير */
for (let i = 0; i < 10; i++) act(P("p" + i), { t: "join", name: "لاعب " + i });
check("الحد 10 لاعبين", S.pids.length === 10 && !!act(P("p10"), { t: "join", name: "زايد" }));
done();
