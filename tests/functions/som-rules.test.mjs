/* قوانين لعبة السوم (js/som.js somReduce و somEval): قوة اليد، السوم بالدور، المفاوضة، المداقشة، والحساب.
   الملف يتحمّل في vm (سكربت عادي مو module) بدون أي واجهة. */
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { check, done } from "./helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ctx = vm.createContext({ console, sessionStorage: { getItem: () => null, setItem() {} }, Math, JSON, Date });
vm.runInContext(fs.readFileSync(path.join(ROOT, "js/som.js"), "utf8") + "\n;globalThis.__som = { somReduce, somEval, somCmp, somHandName, SOM };", ctx);
const { somReduce, somEval, somCmp, somHandName, SOM } = ctx.__som;

/* الورقة = النوع × 4 + نسخة. الأنواع: 0=7 1=8 2=9 3=10 4=درع 5=هلال 6=نجمة 7=تاج */
const C = (...ranks) => { const used = {}; return ranks.map(r => { used[r] = (used[r] || 0) + 1; return r * 4 + used[r] - 1; }); };
const beats = (a, b) => somCmp(somEval(a), somEval(b)) > 0;

/* --- قوة اليد --- */
check("ثلاث بنات + ولد تغلب اكتين + ولدين (ثلاثية > زوجين)", beats(C(4, 4, 4, 6), C(7, 7, 6, 6)));
check("ثلاثية 9 تغلب زوجين تاج", beats(C(2, 2, 2, 0), C(7, 7, 6, 6)));
check("رباعية 7 تغلب ثلاثية تاج", beats(C(0, 0, 0, 0), C(7, 7, 7, 6)));
check("زوج 7 يغلب أعلى ورقة تاج", beats(C(0, 0, 1, 2), C(7, 6, 5, 4)));
check("زوجين: الزوج الأعلى يحسم", beats(C(7, 7, 0, 0), C(6, 6, 5, 5)));
check("نفس الزوج: الورقة الثالثة تحسم", beats(C(5, 5, 7, 0), C(5, 5, 6, 3)));
check("نفس الثلاثية: الرابعة تحسم", beats(C(2, 2, 2, 7), C(2, 2, 2, 6)));
check("أعلى ورقة: الأقوى أول", beats(C(7, 3, 2, 0), C(6, 5, 4, 3)));
check("تعادل كامل = 0", somCmp(somEval(C(7, 6, 5, 4)), somEval(C(7, 6, 5, 4))) === 0);
check("الأسماء", somHandName(somEval(C(4, 4, 4, 6))) === "ثلاثية درع" && somHandName(somEval(C(7, 7, 6, 6))) === "زوجين تاج و نجمة"
    && somHandName(somEval(C(3, 2, 1, 0))) === "أعلى ورقة 10", somHandName(somEval(C(7, 7, 6, 6))));

/* --- اللعبة --- */
let now = 1000000, S = null;
const H = { uid: "h", host: true }, P = u => ({ uid: u, host: false });
function act(who, a) {
    const r = somReduce(S, a, Object.assign({ now }, who));
    if (r.err) return r.err;
    S = r.s; return null;
}
const bal = u => S.players.find(p => p.uid === u).bal;

check("لاعب ما يقدر يفتح طاولة", !!act(P("a"), { t: "create", gid: "sabcdefg1" }));
check("المنظم يفتح طاولة", act(H, { t: "create", gid: "sabcdefg1", name: "محمد" }) === null && S.phase === "lobby");
["a", "b", "c", "d"].forEach(u => act(P(u), { t: "join", name: "لاعب " + u }));
check("4 انضموا وكل واحد 10,000", S.players.length === 4 && S.players.every(p => p.bal === 10000));
check("ما ينضم مرتين", !!act(P("a"), { t: "join", name: "x" }));
check("جولة بأوراق لجولة ثانية ترفض", !!act(H, { t: "round", round: 2, seats: ["a", "b", "c", "d"], deal: "v1.x" }));
check("جولة بلاعبين غلط ترفض", !!act(H, { t: "round", round: 1, seats: ["a", "b"], deal: "v1.x" }));
check("الجولة 1 تبدأ وa يسوم أول", act(H, { t: "round", round: 1, seats: ["a", "b", "c", "d"], deal: "v1.x" }) === null && S.phase === "bid" && S.turn === "a");
check("مو دورك", !!act(P("b"), { t: "bid", amt: 500 }));
check("تثبيت بدون سوم ممنوع", !!act(P("a"), { t: "hold" }));
check("أكثر من 5,000 زيادة ممنوع", !!act(P("a"), { t: "bid", amt: 5100 }));
check("a سام 500", act(P("a"), { t: "bid", amt: 500 }) === null && S.turn === "b" && S.high === 500);
check("b ما يقدر يسوم أقل أو نفسه", !!act(P("b"), { t: "bid", amt: 500 }));
act(P("b"), { t: "bid", amt: 1000 }); act(P("c"), { t: "bid", amt: 1300 }); act(P("d"), { t: "bid", amt: 2000 });
check("لفة ثانية: الدور رجع لـ a", S.turn === "a" && S.leader === "d");
act(P("a"), { t: "hold" }); act(P("b"), { t: "hold" }); act(P("c"), { t: "hold" });
check("محد علّى ← d يفاوض", S.phase === "offer" && S.turn === "d");
check("غير صاحب السوم ما يعرض", !!act(P("a"), { t: "offer", offers: {} }));
check("عروض أكثر من فلوسه ناقص سومه ترفض", !!act(P("d"), { t: "offer", offers: { a: 3000, b: 3000, c: 3000 } }));
check("d عرض 300 لكل واحد", act(P("d"), { t: "offer", offers: { a: 300, b: 300, c: 300 } }) === null && S.phase === "respond");
act(P("a"), { t: "reply", v: "accept" });
check("ما يرد مرتين", !!act(P("a"), { t: "reply", v: "refuse" }));
act(P("b"), { t: "reply", v: "refuse" });
check("لسا c ما رد", S.phase === "respond");
act(P("c"), { t: "reply", v: "refuse" });
check("مداقشة: d و b و c (بترتيب الجلوس)", S.phase === "showdown" && JSON.stringify(S.show) === JSON.stringify(["b", "c", "d"]), S.show);
check("لاعب ما يكشف", !!act(P("b"), { t: "reveal", hands: {} }));
check("كشف ناقص يرفض", !!act(H, { t: "reveal", hands: { b: C(0, 1, 2, 3) } }));
/* c أقوى (ثلاثية)، d زوجين، b أعلى ورقة */
act(H, { t: "reveal", hands: { b: C(7, 5, 2, 0), c: C(4, 4, 4, 6), d: C(7, 7, 6, 6) } });
check("c كسب المداقشة", S.phase === "result" && S.res.kind === "showdown" && JSON.stringify(S.res.winners) === '["c"]');
/* a قبل 300 من d. c: سومه 1300 من البنك + سوم b (1000) + سوم d (2000). d: −2000 −300 */
check("الحساب: a +300", bal("a") === 10300, bal("a"));
check("الحساب: b −1000", bal("b") === 9000, bal("b"));
check("الحساب: c +1300 +1000 +2000", bal("c") === 14300, bal("c"));
check("الحساب: d −2000 −300", bal("d") === 7700, bal("d"));
check("مجموع الفلوس = 40,000 + سوم الفايز من البنك", S.players.reduce((t, p) => t + p.bal, 0) === 40000 + 1300);

/* الجولة 2: b يبدأ. الكل يقبل ← d ياخذ نص سومه */
now += 10000;
act(H, { t: "round", round: 2, seats: ["a", "b", "c", "d"], deal: "v1.y" });
check("الجولة 2 يبدأها b", S.turn === "b" && S.round === 2);
act(P("b"), { t: "bid", amt: 400 }); act(P("c"), { t: "fold" }); act(P("d"), { t: "bid", amt: 3000 }); act(P("a"), { t: "bid", amt: 3500 });
check("الدور رجع لـ b (c انسحب يتخطى)", S.turn === "b");
act(P("b"), { t: "hold" });
check("d دوره بعد b", S.turn === "d");
act(P("d"), { t: "hold" });
check("a يفاوض", S.phase === "offer" && S.leader === "a");
act(P("a"), { t: "offer", offers: { b: 200, d: 500 } });
act(P("b"), { t: "reply", v: "accept" }); act(P("d"), { t: "reply", v: "accept" });
check("الكل قبل ← كسب بدون مداقشة", S.phase === "result" && S.res.kind === "clear" && S.res.winners[0] === "a");
check("a: −700 عروض +1750 نص سومه", bal("a") === 10300 - 700 + 1750, bal("a"));
check("b +200 و d +500 و c ما تغيّر", bal("b") === 9200 && bal("d") === 8200 && bal("c") === 14300);

/* الجولة 3: c يبدأ ويعلّق ← المنظم يتخطاه (ما سام ← ينسحب). ما فيه وقت: ما يتخطى أحد إلا بزر المنظم */
now += 10000;
act(H, { t: "round", round: 3, seats: ["a", "b", "c", "d"], deal: "v1.z" });
check("ما فيه وقت في الحالة", !("deadline" in S));
now += 10 * 60 * 1000;
check("بعد 10 دقايق الدور للحين عند c", S.turn === "c");
check("skip من لاعب يرفض", !!act(P("a"), { t: "skip" }));
act(H, { t: "skip" });
check("المنظم تخطى c (ما سام) ← انسحب، والدور لـ d", S.folded.c === true && S.turn === "d");
act(P("d"), { t: "bid", amt: 1000 }); act(P("a"), { t: "fold" }); act(P("b"), { t: "fold" });
check("انسحبوا كلهم قبل المفاوضة ← بدون فلوس", S.phase === "result" && S.res.kind === "none" && bal("d") === 8200);

/* الجولة 4: تعادل في المداقشة يتقاسمون */
now += 10000;
act(H, { t: "round", round: 4, seats: ["a", "b", "c", "d"], deal: "v1.w" });
check("الجولة 4 يبدأها d", S.turn === "d");
act(P("d"), { t: "bid", amt: 1000 }); act(P("a"), { t: "bid", amt: 2000 }); act(P("b"), { t: "bid", amt: 2500 }); act(P("c"), { t: "fold" });
act(P("d"), { t: "hold" }); act(P("a"), { t: "hold" });
act(P("b"), { t: "offer", offers: {} });
act(H, { t: "skip" });
check("المنظم تخطى اللي ما ردوا ← قبول بصفر ← b كسب بدون مداقشة", S.res.kind === "clear" && bal("b") === 9200 + 1250, bal("b"));
now += 10000;
act(H, { t: "round", round: 5, seats: ["a", "b", "c", "d"], deal: "v1.v" });
act(P("a"), { t: "bid", amt: 1000 }); act(P("b"), { t: "bid", amt: 1500 }); act(P("c"), { t: "fold" }); act(P("d"), { t: "fold" });
act(P("a"), { t: "hold" });
act(P("b"), { t: "offer", offers: { a: 0 } }); act(P("a"), { t: "reply", v: "refuse" });
const before = { a: bal("a"), b: bal("b") };
act(H, { t: "reveal", hands: { a: C(7, 6, 5, 4), b: C(7, 6, 5, 4) } });
check("تعادل: الاثنين يكسبون سومهم من البنك", JSON.stringify(S.res.winners) === '["a","b"]' && bal("a") === before.a + 1000 && bal("b") === before.b + 1500);

/* نهاية اللعبة */
check("end للمنظم بس", !!act(P("a"), { t: "end" }));
act(H, { t: "end" });
check("انتهت", S.phase === "over");
act(H, { t: "close" });
check("سكّر", S.active === false);
check("طاولة جديدة بعد ما تسكّر", act(H, { t: "create", gid: "sabcdefg2", name: "محمد" }) === null && S.phase === "lobby" && S.players.length === 0);

/* لاعب مفلس ما يدخل الجولة */
["a", "b", "c"].forEach(u => act(P(u), { t: "join", name: u }));
S.players[2].bal = 50;
check("المفلس برا الجولة", !!act(H, { t: "round", round: 1, seats: ["a", "b", "c"], deal: "v1.q" }) && act(H, { t: "round", round: 1, seats: ["a", "b"], deal: "v1.q" }) === null);
done();
