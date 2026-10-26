/* البث الخاص (بروفة المنظم لحاله، 27 أكتوبر 2026، طلب محمد): زر "بث خاص لي" في أدوات المنظم
   - الوثيقة في liveSecrets/rehearsal (المنظم بس)، فما تطلع لأي أحد ثاني ولا توصل منها إشعارات
   - متسابقين وهميين يضغطون جاهز والجرس لحالهم، والمنظم يحكم مثل البث الحقيقي
   - الصوت في قناة masro7_live_rehearsal، والنتيجة ما تنكتب في الجدول، والأسئلة ما تنحسب "انسألت"، وما فيه تشخيص في liveDiag
   node tests/harness/rehearsal.mjs */
import { serve, FakeDB, seed, launch, device, until, sleep } from "./harness.mjs";
const srv = await serve();
let ok = true;
const check = (name, v, extra) => { if (!v) ok = false; console.log((v ? "PASS " : "FAIL ") + name + (extra !== undefined ? " " + JSON.stringify(extra) : "")); };
const browser = await launch({});
const REH = "liveSecrets/rehearsal";
try {
    const db = new FakeDB(30);
    seed(db, "result", { status: "ended", sceneAt: Date.now() - 60000 });
    const league0 = JSON.stringify(db.data("league/current"));
    const fan = await device(browser, db, "fan", { live: "none" });
    const host = await device(browser, db, "host", { live: "none" });
    const channels = [];
    await host.context().route(/\/agora-token(\?|$)/, r => { channels.push(new URL(r.request().url()).searchParams.get("channel")); r.fulfill({ contentType: "application/json", body: JSON.stringify({ token: "007test" }) }); });
    await until(() => host.evaluate(() => !!currentUser && isAdmin && !!document.getElementById("rehearsalBtn")), 15000);
    check("organizer sees the private broadcast button", await host.evaluate(() => { const b = document.getElementById("rehearsalBtn"); return !!b && b.offsetParent !== null; }));
    check("viewer doesn't", await fan.evaluate(() => { const b = document.getElementById("rehearsalBtn"); return !b || b.offsetParent === null; }));
    await host.evaluate(() => { window.prompt = () => null; return bcStartRehearsal(); });
    await sleep(500);
    check("cancel: nothing starts", !db.data(REH));
    await host.evaluate(() => { window.prompt = () => "٢"; return bcStartRehearsal(); });   /* أرقام عربية */
    const d0 = await until(() => db.data(REH), 10000);
    check("private broadcast saved in liveSecrets/rehearsal (organizer only)", d0 && d0.status === "live" && d0.rehearsal === 1 && d0.order.length === 2, d0 && { status: d0.status, n: d0.order.length });
    check("fake contestants (bot uids)", d0 && d0.order.every(o => /^bot_/.test(o.uid1) && /^bot_/.test(o.uid2) && o.p1 && o.p2));
    check("nothing in the public broadcasts collection", db.list("room/main/liveMatches").every(x => !/rehearsal/.test(x.path)) && !db.data("room/main/liveMatches/rehearsal"));
    await until(() => host.evaluate(() => openLiveId === "rehearsal" && !!document.querySelector("#liveScreen.open")), 8000);
    check("organizer is on the private broadcast screen", await host.evaluate(() => openLiveId === "rehearsal"));
    await sleep(1500);
    check("viewer: no private broadcast in cache, bars or notifications", await fan.evaluate(() => !liveMatchesCache.rehearsal && !/البث الخاص/.test(document.body.innerText)));
    /* المواجهة الأولى: الوهميين يضغطون جاهز لحالهم */
    await host.evaluate(() => bcNext());
    check("first match intro", !!await until(() => db.data(REH).scene === "intro" && db.data(REH).cur === 0, 8000));
    check("bots press ready by themselves → welcome", !!await until(() => db.data(REH).scene === "talk" && db.data(REH).ready1 && db.data(REH).ready2, 8000));
    await sleep(6500);   /* الشارة */
    await host.evaluate(() => bcForceStart());
    check("countdown → first question", !!await until(() => db.data(REH).scene === "playing" && db.data(REH).phase === "buzz", 10000));
    const q = db.data(REH).questions || [];
    check("5 questions with their answers (private doc, no sealing)", q.length === 5 && q.every(x => x.text && x.answer), q.length);
    /* الجرس: وهمي يضغط بين 3 و 9 ث (أو ما أحد يضغط وينكشف بعد 15 ث) */
    const after = await until(() => { const x = db.data(REH); return x.phase !== "buzz" ? x : null; }, 20000);
    check("a bot buzzes or the time runs out", after && (after.phase === "answer" || after.phase === "reveal"), after && after.phase);
    if (after && after.phase === "answer") {
        check("bot buzz looks like a real one", (after.buzzer === 1 || after.buzzer === 2) && after.answerer === after.buzzer && after["tried" + after.buzzer] === true);
        await until(() => host.$(".bc-verdict button"), 5000);
        const s0 = after.s1 + after.s2;
        await host.evaluate(() => bcHostVerdict(true));
        const r = await until(() => db.data(REH).phase === "reveal" ? db.data(REH) : null, 6000);
        check("organizer judges the bot: correct → point", r && r.s1 + r.s2 === s0 + 1, r && [r.s1, r.s2]);
    }
    /* لا شي يتسرب للدوري */
    await host.evaluate(() => { const x = liveMatchesCache.rehearsal; x.order[0].state = "done"; bcApplyResults("rehearsal"); });
    await sleep(800);
    check("league table untouched", JSON.stringify(db.data("league/current")) === league0);
    check("no question history saved", !db.data("room/main/liveDiag/_qhistory"));
    check("no public diagnostics for the private broadcast", !db.data("room/main/liveDiag/rehearsal"));
    check("no public predictions doc", db.list("room/main/livePred").length === 0);
    check("audio on its own channel", channels.length > 0 && channels.every(c => c === "masro7_live_rehearsal"), channels);
    /* إنهاء */
    await host.evaluate(() => { window.confirm = () => true; bcEnd(); });
    check("ends like a normal broadcast", !!await until(() => db.data(REH).status === "ended", 5000));
    /* بعد التحديث: يرجع يكمّل أو يبدأ جديد */
    await host.evaluate(() => { window.confirm = () => false; window.prompt = () => "1"; return bcStartRehearsal(); });
    const d2 = await until(() => { const x = db.data(REH); return x && x.status === "live" && x.order.length === 1 ? x : null; }, 6000);
    check("new private broadcast replaces the old one", !!d2);
    const errs = [...host.__logs, ...fan.__logs].filter(l => /PAGEERROR/.test(l));
    check("no page errors", !errs.length, errs.slice(0, 3));
} catch (e) { ok = false; console.log(e.stack || e); }
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
