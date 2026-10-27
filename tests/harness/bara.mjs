/* برا السالفة من البداية للنهاية: 4 أجهزة (المنظم وسعد وفهد ومشاهد) بالكود الحقيقي + functions/bara.js الحقيقي (يشتغل هنا في Node)
   + قاعدة وهمية (Firestore REST للسيرفر يقرا من نفس القاعدة). يتأكد: كل واحد يشوف دوره بس، والكلمة ما تطلع في أي وثيقة عامة
   ولا عند اللي برا السالفة، وجولة كاملة لين النقاط، وما شي يتغيّر لحاله، والأصوات، وزر الرجوع، و 10 لاعبين بدون تداخل.
   (قواعد Firestore نفسها في tests/rules بالمحاكي)
   node tests/harness/bara.mjs [مجلد الصور] */
import fs from "node:fs";
import { serve, FakeDB, seed, launch, device, until, sleep } from "./harness.mjs";
import { setupAuth, fakeCaches } from "../functions/helpers.mjs";
import { onRequestPost as baraPost } from "../../functions/bara.js";

const out = process.argv[2] || "/tmp/harness-bara";
fs.mkdirSync(out, { recursive: true });
let ok = true;
const check = (name, v, extra) => { console.log((v ? "PASS " : "FAIL ") + name + (extra !== undefined && !v ? " " + JSON.stringify(extra).slice(0, 400) : "")); if (!v) ok = false; };

const auth = await setupAuth(); fakeCaches();
const db = new FakeDB(40);
seed(db, "intro");
db.docs.set("room/main", { ver: 1, data: { isLive: true, hostUid: "u_host", hostName: "محمد", accessId: "123456", mics: [], chat: [], game: { active: false } } });
/* Firestore الحقيقي يرفض مصفوفة داخل مصفوفة (القاعدة الوهمية تقبلها)، فنتأكد هنا من كل كتابة للعبة */
const nested = v => Array.isArray(v) ? v.some(x => Array.isArray(x) || nested(x)) : v && typeof v === "object" ? Object.values(v).some(nested) : false;
const badWrites = [];
const write0 = db.write.bind(db);
db.write = w => { if (/games\/bara|baraVotes/.test(w.path) && nested(w.data)) badWrites.push(w.path); return write0(w); };
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
const UID = { host: "u_host", p1: "u_p1", p2: "u_p2", fan: "u_fan" };
const tokens = { host: await auth.token("u_host", "moha1221aaa@gmail.com"), p1: await auth.token("u_p1"), p2: await auth.token("u_p2"), fan: await auth.token("u_fan") };
const api = {
    bara: async (b, info) => {
        const pending = [];
        const req = new Request("http://127.0.0.1:8787/bara", { method: "POST", body: JSON.stringify(b),
            headers: Object.assign({ Origin: "http://127.0.0.1:8787", "Content-Type": "application/json" }, info.headers.authorization ? { Authorization: "Bearer " + tokens[info.who] } : {}) });
        const res = await baraPost({ request: req, env, waitUntil: p => pending.push(p) });
        const text = await res.text();
        await Promise.all(pending);
        return { raw: { status: res.status, contentType: "application/json", body: text } };
    }
};
const game = () => db.data("room/main/games/bara");
const srv = await serve(8787);
const browser = await launch({});
const shot = (pg, name) => pg.screenshot({ path: out + "/" + name + ".png" });
try {
    const devs = {};
    for (const who of ["host", "p1", "p2", "fan"]) devs[who] = await device(browser, db, who, { api, live: "none", viewport: who === "p2" ? { width: 360, height: 640 } : undefined });
    const { host, p1, p2, fan } = devs;
    for (const pg of Object.values(devs)) {
        await until(() => pg.evaluate(() => typeof baraCreate === "function" && !!currentUser && roomStateLoaded && roomState.isLive), 10000);
        await pg.evaluate(() => { try { localStorage.setItem("masro7RoomAccess", "123456"); } catch (e) {} openRoomScreen(); });
        await pg.evaluate(() => { window.__sfx = []; const o = baraSfx; baraSfx = function (id) { window.__sfx.push(id); return o.apply(this, arguments); }; });
    }
    const sfx = pg => pg.evaluate(() => window.__sfx.slice());

    /* المنظم يفتح الطاولة من قائمة الألعاب */
    await host.evaluate(() => openRoomGamesModal());
    check("برا السالفة في قائمة الألعاب", await host.evaluate(() => [...document.querySelectorAll("#roomGamesBody .game-row-name")].some(e => e.textContent === "برا السالفة")));
    await host.evaluate(() => startRoomGame(ROOM_GAMES.findIndex(g => g.id === "bara")));
    check("الطاولة انفتحت (lobby)", !!await until(() => game() && game().phase === "lobby", 5000));
    check("شاشة الطاولة طلعت للمنظم", !!await until(() => host.evaluate(() => !!document.querySelector("#baraScreen.open")), 3000));
    for (const pg of [p1, p2, fan]) { await until(() => pg.evaluate(() => !!document.querySelector(".bara-pill")), 4000); await pg.click(".bara-pill"); }
    for (const pg of [host, p1, p2, fan]) { await until(() => pg.evaluate(() => !!document.querySelector("#baraScreen.open .bara-act .som-b.gold")), 3000); await pg.click("#baraScreen .bara-act .som-b.gold"); await sleep(250); }
    check("4 لاعبين انضموا", !!await until(() => (game().pids || []).length === 4, 5000), game().pids);
    check("الأصوات الحقيقية تحمّلت (audio/)", !!await until(() => p1.evaluate(() => Object.keys(baraBuf).length >= 8), 6000));
    /* زر الرجوع يسكّر الطاولة بس */
    await p1.evaluate(() => history.back());
    check("الرجوع سكّر الطاولة والغرفة باقية", !!await until(() => p1.evaluate(() => !document.querySelector("#baraScreen.open") && roomScreenOpen), 3000));
    await p1.click(".bara-pill");
    /* المنظم: جولتين، وتصنيف حيوانات */
    for (let i = 0; i < 3; i++) { await host.click(".bara-rounds .som-step:first-of-type"); await sleep(250); }
    check("المنظم حدد 2 جولات", !!await until(() => game().rounds === 2, 3000), game().rounds);
    await host.evaluate(() => baraPickCat("animals"));
    await sleep(200); await shot(p1, "1-lobby"); await shot(host, "1-lobby-host");
    await host.click(".bara-act .som-b.brand");
    check("الجولة 1 بدأت", !!await until(() => game().phase === "ask" && game().round === 1, 6000), game());
    const g1 = game();
    check("الخطة مختومة، والتصنيف بس ظاهر", /^v1\./.test(g1.plan) && g1.catName === "حيوانات" && !("word" in g1) && !JSON.stringify(g1).includes('"out"'));

    /* كل واحد يقلب بطاقته ويشوف دوره بس */
    const roles = {};
    for (const [who, pg] of Object.entries(devs)) {
        check("البطاقة مقلوبة أول (" + who + ")", !!await until(() => pg.evaluate(() => !!document.querySelector(".bara-card:not(.open) .bara-face.front")), 4000));
        await pg.click(".bara-face.front");
        await until(() => pg.evaluate(() => baraRole && baraRole.key === baraKey(baraState)), 5000);
        roles[who] = await pg.evaluate(() => ({ out: baraRole.out, word: baraRole.word || "", shown: document.querySelector(".bara-face.back").textContent }));
    }
    const outWho = Object.keys(roles).filter(w => roles[w].out);
    check("واحد بس برا السالفة", outWho.length === 1, roles);
    const OUT = outWho[0], word = roles[Object.keys(roles).find(w => w !== OUT)].word;
    check("اللي داخل كلهم نفس الكلمة وتطلع على بطاقتهم", Object.keys(roles).filter(w => w !== OUT).every(w => roles[w].word === word && roles[w].shown.includes(word)));
    check("اللي برا السالفة ما يشوف الكلمة في أي مكان بشاشته", !(await devs[OUT].evaluate(() => document.body.innerText)).includes(word) && roles[OUT].shown.includes("برا السالفة"));
    check("الكلمة ما طلعت في أي وثيقة عامة", ![...db.docs.keys()].filter(p => p.startsWith("room/")).some(p => JSON.stringify(db.data(p)).includes(word)));
    await shot(devs[OUT], "2-card-out"); await shot(devs[Object.keys(roles).find(w => w !== OUT)], "2-card-in");
    await p2.click(".bara-hide");
    check("خبّ الكلمة يقلب البطاقة", !!await until(() => p2.evaluate(() => !document.querySelector(".bara-card.open")), 2000));
    check("صوت التوزيع طلع", (await sfx(p1)).includes("whoosh"));

    /* ما شي يتغيّر لحاله */
    await sleep(3500);
    check("بدون ضغط ما يتغيّر شي (3.5 ث)", game().phase === "ask" && game().turn === 0);
    /* رسالة شات ما تعيد رسم الطاولة */
    await p2.evaluate(() => { document.querySelector("#baraScreen .bara-body").dataset.k = "1"; });
    db.write({ op: "set", path: "room/main", data: { chat: [{ senderName: "x", text: "هلا", time: "" }] }, merge: true });
    await sleep(800);
    check("الشات ما يعيد رسم الطاولة", await p2.evaluate(() => document.querySelector("#baraScreen .bara-body").dataset.k === "1"));

    /* الأسئلة: مين يسأل مين، والمنظم يضغط التالي */
    const a0 = game().asks[0];
    const asker = Object.keys(UID).find(w => UID[w] === a0.a);
    check("الشاشة تبين مين يسأل مين", !!await until(() => devs[asker].evaluate(() => (document.querySelector(".bara-panel.ask .bara-p-t") || {}).textContent || ""), 2000)
        && (await devs[asker].evaluate(() => document.querySelector(".bara-panel.ask .bara-p-t").textContent)).startsWith("دورك تسأل"));
    await shot(p2, "3-ask-small");
    for (let i = 0; i < 4; i++) { await host.click(".bara-act .som-b.brand"); await until(() => game().turn === i + 1, 3000); }
    check("خلصت الدورة (4 أسئلة)", game().turn === 4);
    check("صوت التالي", (await sfx(fan)).includes("tick"));
    await until(() => host.evaluate(() => document.querySelectorAll(".bara-act .som-btns .som-b").length === 2), 3000);
    await host.click(".bara-act .som-btns .som-b.ghost");     /* دورة ثانية */
    check("المنظم زاد دورة ثانية", !!await until(() => game().laps === 2 && game().asks.length === 8, 3000));
    for (let i = 4; i < 8; i++) { await host.click(".bara-act .som-b.brand"); await until(() => game().turn === i + 1, 3000); }
    await until(() => host.evaluate(() => !!document.querySelector(".bara-act .som-btns .som-b.brand")), 3000);
    await host.click(".bara-act .som-btns .som-b.brand");     /* ابدأ التصويت */
    check("التصويت بدأ", !!await until(() => game().phase === "vote", 3000));

    /* التصويت السري: اللي داخل يصوّتون على اللي برا، واللي برا يصوّت على واحد ثاني */
    const inside = Object.keys(devs).filter(w => w !== OUT);
    for (const w of inside) {
        await until(() => devs[w].evaluate(() => document.querySelectorAll(".bara-grid.vote .bara-tile").length === 3), 3000);
        await devs[w].evaluate(u => baraVote(u), UID[OUT]);
    }
    await devs[OUT].evaluate(u => baraVote(u), UID[inside[0]]);
    await devs[OUT].evaluate(u => baraVote(u), UID[inside[1]]);   /* يغيّر صوته */
    check("كل صوت في baraVotes/<uid>", !!await until(() => Object.values(UID).every(u => (db.data("baraVotes/" + u) || {}).target), 3000));
    check("صوت اللي برا آخر اختيار له", db.data("baraVotes/" + UID[OUT]).target === UID[inside[1]]);
    check("الوثيقة العامة فيها مين صوّت بس (بدون لمين)", !!await until(() => (game().voted || []).length === 4, 4000) && game().res === null && !JSON.stringify(game()).includes('"target"'));
    check("صوتي محدد عندي", await p1.evaluate(() => !!document.querySelector(".bara-tile.picked")) || OUT === "p1");
    await shot(p2, "4-vote-small");
    await sleep(2500);
    check("الكشف ما يصير لحاله", game().phase === "vote");
    await host.click(".bara-act .som-b.gold");                /* اكشف التصويت */
    check("الكشف: انكشف", !!await until(() => game().phase === "guess", 5000) && game().res.caught === true && game().res.out === UID[OUT], game().res);
    /* الخيارات الـ8 (وفيها الكلمة) تطلع للكل عشان اللي برا يخمّن منها، بس أي وحدة هي الكلمة ما ينكتب لين النتيجة */
    check("الكلمة ما تنحدد في الوثيقة قبل النتيجة", !("word" in game().res) && game().res.opts.length === 8);
    check("صوت الكشف", !!await until(async () => (await sfx(p1)).includes("slam"), 3000));

    /* التخمين: اللي برا يختار من 8 */
    const op = devs[OUT];
    check("8 خيارات للي برا السالفة", !!await until(() => op.evaluate(() => document.querySelectorAll(".bara-opt").length === 8), 3000));
    check("الخيارات عند غيره ما تطلع", (await devs[inside[0]].evaluate(() => document.querySelectorAll(".bara-opt").length)) === 0);
    await op.evaluate(w => baraPickGuess(w), word);
    await shot(op, "5-guess");
    await op.click(".bara-act .som-b.gold, .bara-body .som-b.gold");
    check("إيصال التخمين انحفظ", !!await until(() => !!(db.data("baraVotes/" + UID[OUT]) || {}).g, 4000));
    check("الإيصال ما فيه الكلمة", !JSON.stringify(db.data("baraVotes/" + UID[OUT])).includes(word));
    await sleep(2000);
    check("النتيجة ما تطلع لحالها", game().phase === "guess");
    await host.click(".bara-act .som-b.gold");                /* النتيجة */
    check("النتيجة", !!await until(() => game().phase === "result", 5000), game().phase);
    const r1 = game().res, sc = u => game().players[u].score;
    check("السالفة انكشفت للكل", r1.word === word && r1.ok === true && r1.choice === word);
    check("النقاط: اللي صوّتوا صح +100، واللي برا (انكشف وخمّن صح) +150", inside.every(w => sc(UID[w]) === 100) && sc(UID[OUT]) === 150, game().players);
    await sleep(500);
    await shot(p2, "6-result-small"); await shot(op, "6-result-out");
    check("صوت الفوز", (await sfx(op)).includes("correct"));
    await sleep(2500);
    check("الجولة الجاية ما تبدأ لحالها", game().phase === "result" && game().round === 1);

    /* الجولة 2 (عشوائي): محد يصوّت، ما انكشف، والمنظم يتخطى التخمين */
    await host.evaluate(() => baraPickCat("random"));
    await host.click(".bara-act .som-b.brand");
    check("الجولة 2", !!await until(() => game().phase === "ask" && game().round === 2, 6000));
    check("البطاقة ترجع مقلوبة بالجولة الجديدة", !!await until(() => p1.evaluate(() => !document.querySelector(".bara-card.open")), 3000));
    await host.evaluate(() => { baraHostVote(); });
    await until(() => game().phase === "vote", 3000);
    await host.click(".bara-act .som-b.gold");
    check("ما أحد صوّت ← ما انكشف", !!await until(() => game().phase === "guess", 5000) && game().res.caught === false);
    const out2 = game().res.out, before2 = game().players[out2].score;
    await host.click(".som-host button:first-child");           /* تخطّى */
    check("المنظم تخطى التخمين ← ما انكشف +200 بس", !!await until(() => game().phase === "result", 5000) && game().players[out2].score === before2 + 200 && game().res.choice === null);
    await host.click(".bara-act .som-b.brand");                /* الترتيب النهائي */
    check("انتهت اللعبة بعد جولتين", !!await until(() => game().phase === "over", 4000));
    await sleep(400); await shot(p1, "7-over");
    check("صوت النهاية", (await sfx(p1)).includes("match_end"));
    check("ولا كتابة فيها مصفوفة داخل مصفوفة (Firestore يرفضها)", badWrites.length === 0, badWrites);

    /* 10 لاعبين على 360×640: التصويت والردهة بدون تداخل */
    const ids = ["u_host", "u_p1", "u_p2", "u_fan"].concat(Array.from({ length: 6 }, (_, i) => "u_x" + i));
    const names = ["محمد", "سعد", "فهد", "مشاهد", "عبدالرحمن الطويل", "ناصر", "خالد", "تركي", "بندر", "عبدالعزيز"];
    const players = {}; ids.forEach((u, i) => { players[u] = { name: names[i], av: "", score: i * 100 }; });
    const ten = extra => Object.assign({}, game(), { active: true, gid: "bten12345", round: 1, rounds: 5, pids: ids, players, cat: "food", catName: "أكلات", plan: "v1.x",
        asks: ids.map((u, i) => ({ a: u, b: ids[(i + 1) % 10] })), turn: 3, laps: 1, voted: ids.slice(0, 4), res: null }, extra);
    const layout = pg => pg.evaluate(() => {
        const W = innerWidth, bad = [];
        const tiles = [...document.querySelectorAll("#baraScreen .bara-tile, #baraScreen .bara-trow")].map(e => e.getBoundingClientRect());
        tiles.forEach((a, i) => tiles.forEach((b, j) => { if (j > i && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) bad.push(i + "×" + j); }));
        document.querySelectorAll("#baraScreen *").forEach(e => { const r = e.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push("out:" + (e.className || e.tagName)); });
        const body = document.querySelector(".bara-body").getBoundingClientRect(), act = document.querySelector(".bara-act").getBoundingClientRect();
        if (body.bottom > act.top + 1) bad.push("body×act");
        if (act.bottom > innerHeight + 1) bad.push("act out");
        return { n: tiles.length, bad: bad.slice(0, 8) };
    });
    for (const [ph, extra] of [["vote", { phase: "vote" }], ["ask", { phase: "ask" }], ["lobby", { phase: "lobby", round: 0, plan: "" }], ["result", { phase: "result", res: { votes: {}, tally: {}, top: [], out: "u_x0", caught: false, opts: [], word: "كبسة", choice: null, ok: false, delta: { u_x0: 200 } } }]]) {
        db.write({ op: "set", path: "room/main/games/bara", data: ten(extra) });
        for (const [who, pg] of [["p2", p2], ["host", host]]) {
            await until(() => pg.evaluate(p => baraState && baraState.phase === p && baraState.gid === "bten12345", ph), 3000);
            await pg.evaluate(() => { if (!baraIsOpen) baraOpen(); });
            await sleep(400);
            const r = await layout(pg);
            check("10 لاعبين بدون تداخل: " + ph + " (" + who + ")", r.bad.length === 0, r);
            if (who === "p2") await shot(pg, "8-ten-" + ph);
        }
    }
    const errs = Object.entries(devs).flatMap(([w, pg]) => pg.__logs.filter(l => /PAGEERROR/.test(l)).map(l => w + ": " + l));
    check("ما فيه أخطاء JS", errs.length === 0, errs);
} catch (e) {
    console.log("FAIL exception " + (e && e.stack || e)); ok = false;
} finally {
    await browser.close(); srv.close(); auth.restore();
}
console.log(ok ? "all passed" : "SOME FAILED");
process.exit(ok ? 0 : 1);
