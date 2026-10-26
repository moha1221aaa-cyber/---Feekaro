/* لعبة السوم من البداية للنهاية: 3 أجهزة (المنظم وسعد وفهد) بالكود الحقيقي + functions/som.js الحقيقي (يشتغل هنا في Node)
   + قاعدة وهمية (Firestore REST للسيرفر يقرا من نفس القاعدة). يتأكد: كل واحد يشوف أوراقه بس، والأوراق ما تطلع في الوثيقة،
   والسوم بالأزرار، والمفاوضة والمداقشة والحساب، والشاشة ما تطلع برا الجوال.
   node tests/harness/som.mjs [مجلد الصور] */
import fs from "node:fs";
import { serve, FakeDB, seed, launch, device, until, sleep } from "./harness.mjs";
import { setupAuth, fakeCaches } from "../functions/helpers.mjs";
import { onRequestPost as somPost } from "../../functions/som.js";

const out = process.argv[2] || "/tmp/harness-som";
fs.mkdirSync(out, { recursive: true });
let ok = true;
const check = (name, v, extra) => { console.log((v ? "PASS " : "FAIL ") + name + (extra !== undefined && !v ? " " + JSON.stringify(extra).slice(0, 400) : "")); if (!v) ok = false; };

const auth = await setupAuth(); fakeCaches();
const db = new FakeDB(40);
seed(db, "intro");
db.docs.set("room/main", { ver: 1, data: { isLive: true, hostUid: "u_host", hostName: "محمد", accessId: "123456", qbank: [], mics: [], chat: [], game: { active: false } } });
const enc = v => v === null || v === undefined ? { nullValue: null } : typeof v === "string" ? { stringValue: v } : typeof v === "boolean" ? { booleanValue: v }
    : typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } }
    : (v && typeof v.__ts === "number") ? { timestampValue: new Date(v.__ts).toISOString() }
    : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
auth.routes.push({ match: u => u.startsWith("https://firestore.googleapis.com/"), handle: async u => {
    const p = decodeURIComponent(u.split("/documents/")[1].split("?")[0]);
    const d = db.data(p);
    return d ? new Response(JSON.stringify({ fields: enc(d).mapValue.fields })) : new Response("{}", { status: 404 });
} });
const env = { AGORA_APP_CERTIFICATE: "test-secret-0123456789abcdef" };
const tokens = { host: await auth.token("u_host", "moha1221aaa@gmail.com"), p1: await auth.token("u_p1"), p2: await auth.token("u_p2") };
const served = { host: [], p1: [], p2: [] };
const api = {
    som: async (b, info) => {
        const pending = [];
        const req = new Request("http://127.0.0.1:8787/som", { method: "POST", body: JSON.stringify(b),
            headers: Object.assign({ Origin: "http://127.0.0.1:8787", "Content-Type": "application/json" }, info.headers.authorization ? { Authorization: "Bearer " + tokens[info.who] } : {}) });
        const res = await somPost({ request: req, env, waitUntil: p => pending.push(p) });
        const text = await res.text();
        await Promise.all(pending);
        if (res.ok && b.action !== "reveal") { const j = JSON.parse(text); if (j.hand) served[info.who].push(j.hand); }
        return { raw: { status: res.status, contentType: "application/json", body: text } };
    }
};
const game = () => db.data("room/main/games/som");
const srv = await serve(8787);
const browser = await launch({});
const shot = (pg, name) => pg.screenshot({ path: out + "/" + name + ".png" });
try {
    const devs = {};
    for (const who of ["host", "p1", "p2"]) devs[who] = await device(browser, db, who, { api, live: "none", viewport: who === "p2" ? { width: 360, height: 640 } : undefined });
    const { host, p1, p2 } = devs;
    for (const [who, pg] of Object.entries(devs)) {
        await until(() => pg.evaluate(() => typeof somCreate === "function" && !!currentUser && roomStateLoaded && roomState.isLive), 10000);
        await pg.evaluate(() => { try { localStorage.setItem("masro7RoomAccess", "123456"); } catch (e) {} openRoomScreen(); });
    }
    /* المنظم يفتح الطاولة من قائمة الألعاب */
    await host.evaluate(() => openRoomGamesModal());
    await host.click("#roomGamesBody .game-row:nth-child(2) .game-row-btn");
    check("الطاولة انفتحت (lobby)", !!await until(() => game() && game().phase === "lobby", 5000));
    check("شاشة الطاولة طلعت للمنظم", await until(() => host.evaluate(() => !!document.querySelector("#somScreen.open")), 3000));
    check("الشريط طلع في غرفة سعد", !!await until(() => p1.evaluate(() => !!document.querySelector(".som-pill")), 3000));
    await p1.click(".som-pill"); await p2.click(".som-pill");
    for (const pg of [host, p1, p2]) { await until(() => pg.evaluate(() => !!document.querySelector("#somScreen.open .som-b.gold")), 3000); await pg.click("#somScreen .som-b.gold"); await sleep(250); }
    check("3 لاعبين انضموا", !!await until(() => game().players.length === 3, 5000), game().players);
    await sleep(300); await shot(p1, "1-lobby");
    await host.click("#somScreen .som-b.brand");
    check("الجولة 1 بدأت", !!await until(() => game().phase === "bid" && game().round === 1, 6000), game());
    const g1 = game();
    check("الختم في الوثيقة، ما فيه أوراق مكشوفة", /^v1\./.test(g1.deal) && !g1.shown && !JSON.stringify(g1).includes('"hand"'));
    /* كل جهاز يطلب أوراقه بس */
    for (const [who, pg] of Object.entries(devs)) check("أوراق " + who + " وصلت (4 بالشاشة)", !!await until(() => pg.evaluate(() => document.querySelectorAll(".som-hand .som-card:not(.back)").length === 4), 6000));
    const hands = { host: served.host.at(-1), p1: served.p1.at(-1), p2: served.p2.at(-1) };
    check("ما فيه ورقة مكررة بين الثلاثة", new Set([].concat(hands.host, hands.p1, hands.p2)).size === 12, hands);
    const shownRanks = async pg => pg.evaluate(() => [...document.querySelectorAll(".som-hand .som-card")].map(c => +c.className.match(/r(\d)/)[1]).sort().join());
    check("سعد يشوف أوراقه هو", await shownRanks(p1) === hands.p1.map(c => Math.floor(c / 4)).sort().join());
    check("فهد يشوف أوراقه هو", await shownRanks(p2) === hands.p2.map(c => Math.floor(c / 4)).sort().join());

    /* السوم: المنظم 600، سعد 700، فهد ينسحب، المنظم يثبّت ← سعد يفاوض */
    check("دور المنظم أول", g1.turn === "u_host");
    await until(() => host.evaluate(() => !!document.querySelector(".som-amt")), 3000);
    await shot(host, "2-bid-myturn");
    await host.click(".som-quick button:first-child");              /* +500 ← 600 */
    await host.click(".som-btns .som-b.gold");
    check("المنظم سام 600", !!await until(() => game().high === 600 && game().turn === "u_p1", 4000), game());
    await until(() => p1.evaluate(() => !!document.querySelector(".som-btns .som-b.gold")), 3000);
    await p1.click(".som-btns .som-b.gold");                       /* أقل سوم = 700 */
    check("سعد سام 700", !!await until(() => game().high === 700 && game().leader === "u_p1", 4000), game());
    await until(() => p2.evaluate(() => !!document.querySelector(".som-btns .som-b.danger")), 3000);
    await shot(p2, "3-bid-small-screen");
    await p2.click(".som-btns .som-b.danger");
    await until(() => host.evaluate(() => !!document.querySelector(".som-btns .som-b.ghost")), 4000);
    await host.click(".som-btns .som-b.ghost");
    check("سعد صاحب أعلى سوم ويفاوض", !!await until(() => game().phase === "offer" && game().turn === "u_p1", 4000), game());

    /* المفاوضة: سعد يعرض 300 ← المنظم يرفض ويداقش */
    await until(() => p1.evaluate(() => !!document.querySelector(".som-orow")), 3000);
    await p1.click(".som-quick button:nth-child(2)");
    await shot(p1, "4-offer");
    await p1.click(".som-btns .som-b.gold");
    check("العرض وصل", !!await until(() => game().phase === "respond" && game().offers.u_host === 300, 4000), game());
    await until(() => host.evaluate(() => !!document.querySelector(".som-offer")), 3000);
    await shot(host, "5-respond");
    await host.click(".som-btns .som-b.danger");
    check("مداقشة ثم كشف تلقائي من جهاز المنظم", !!await until(() => game().phase === "result", 8000), game());
    const g2 = game();
    check("الكشف فيه أوراق اللي داقشوا بس", g2.shown && g2.shown.u_host && g2.shown.u_p1 && !g2.shown.u_p2);
    check("الأوراق المكشوفة هي نفسها اللي انوزعت", JSON.stringify(g2.shown.u_host) === JSON.stringify(hands.host) && JSON.stringify(g2.shown.u_p1) === JSON.stringify(hands.p1));
    const verdict = await host.evaluate(([a, b]) => somCmp(somEval(a), somEval(b)), [hands.host, hands.p1]);
    const bal = u => g2.players.find(p => p.uid === u).bal;
    /* المنظم رفض العرض، فالـ 300 ما تندفع */
    if (verdict > 0) check("المنظم كسب: +600 +700، وسعد −700", bal("u_host") === 11300 && bal("u_p1") === 9300, g2.players);
    else if (verdict < 0) check("سعد كسب: +700 +600، والمنظم −600", bal("u_p1") === 11300 && bal("u_host") === 9400, g2.players);
    else check("تعادل: كل واحد سومه من البنك", bal("u_host") === 10600 && bal("u_p1") === 10700, g2.players);
    check("فهد ما تغيّر (انسحب)", bal("u_p2") === 10000);
    await sleep(600);
    await shot(p1, "6-result");
    await shot(p2, "6-result-small");

    /* الجولة الجاية بزر المنظم، ويبدأها سعد */
    await host.click(".som-host button:first-child");
    check("الجولة 2 بأوراق جديدة ويبدأها سعد", !!await until(() => game().round === 2 && game().phase === "bid" && game().turn === "u_p1", 6000), game());
    check("أوراق جديدة لسعد", !!await until(() => p1.evaluate(k => somHand && somHand.key === k, game().gid + ":2"), 5000));

    /* الشاشة داخل الجوال: ما فيه شي يطلع برا العرض */
    for (const [who, pg] of Object.entries(devs)) {
        const bad = await pg.evaluate(() => {
            const W = window.innerWidth, out = [];
            document.querySelectorAll("#somScreen *").forEach(e => { const r = e.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) out.push(e.className || e.tagName); });
            return out.slice(0, 5);
        });
        check("ما فيه شي يطلع برا الشاشة (" + who + ")", bad.length === 0, bad);
    }
    /* المنظم ينهي ويسكّر */
    await host.evaluate(() => somDo({ t: "end" }));
    check("انتهت اللعبة", !!await until(() => game().phase === "over", 3000));
    await sleep(400); await shot(p1, "7-over");
    await host.evaluate(() => somDo({ t: "close" }));
    check("الطاولة تسكّرت والشاشة اختفت عند سعد", !!await until(() => p1.evaluate(() => !document.querySelector("#somScreen.open")), 3000));
    const errs = Object.entries(devs).flatMap(([w, pg]) => pg.__logs.filter(l => /PAGEERROR/.test(l)).map(l => w + ": " + l));
    check("ما فيه أخطاء JS", errs.length === 0, errs);
} catch (e) {
    console.log("FAIL exception " + (e && e.stack || e)); ok = false;
} finally {
    await browser.close(); srv.close(); auth.restore();
}
console.log(ok ? "all passed" : "SOME FAILED");
process.exit(ok ? 0 : 1);
