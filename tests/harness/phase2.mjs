/* المرحلة 2 حق الأمن (26 أكتوبر 2026) من جهة كود الموقع: كل كتابة من غير المنظم تلمس حقلها بس،
   عشان قواعد Firestore الجديدة (tests/rules) ما ترفضها. هنا نتأكد من شكل الكتابات نفسها:
   - المايك والشات وجواب لعبة الغرفة: transaction على حقل واحد (mics أو chat أو game.revealText)، مو الغرفة كاملة
   - بنك أسئلة الغرفة ينتقل من room/main لـ liveSecrets/_roombank (المنظم بس)، ولعبة الغرفة ما تكتب الجواب في الوثيقة العامة
   - الإيميل في contacts/<uid> بس، و users و predictions بدون إيميل
   - السوم: pids مع كل كتابة
   node tests/harness/phase2.mjs */
import { serve, FakeDB, seed, launch, device, until, sleep, QUESTIONS } from "./harness.mjs";
const srv = await serve();
let ok = true;
const check = (name, v, extra) => { if (!v) ok = false; console.log((v ? "PASS " : "FAIL ") + name + (extra !== undefined ? " " + JSON.stringify(extra) : "")); };
const browser = await launch({});
const ROOM = "room/main";
const roomWrites = (db, from) => db.log.slice(from).filter(l => l.path === ROOM);
try {
    const db = new FakeDB(30);
    seed(db, "result", { status: "ended", sceneAt: Date.now() - 60000 });
    const r0 = db.data(ROOM);
    db.docs.set(ROOM, { ver: 1, data: Object.assign({}, r0, { isLive: true, hostUid: "u_host", hostName: "محمد", mics: Array(15).fill(null), chat: [{ senderUid: "u_p2", senderName: "فهد", text: "هلا", time: "1" }],
        game: { active: true, status: "running", qText: "س", s1: 0, s2: 0, p1Name: "أ", p2Name: "ب" } }) });

    /* ===== المنظم: بنك الأسئلة ينتقل ===== */
    const host = await device(browser, db, "host", { live: "none" });
    const bank = await until(() => { const b = db.data("liveSecrets/_roombank"); return b && b.items && b.items.length ? b : null; }, 10000);
    check("room question bank moved to liveSecrets/_roombank", bank && bank.items.length === QUESTIONS.length, bank && bank.items.length);
    check("…and removed from the public room doc", await until(() => !("qbank" in (db.data(ROOM) || {})), 5000));
    check("host keeps the bank in memory", await host.evaluate(() => roomBank.length) === QUESTIONS.length);
    await host.evaluate(() => { roomBank.push({ text: "سؤال جديد؟", answer: "جواب" }); saveRoomBank(); });
    check("adding a question writes the private bank only", await until(() => (db.data("liveSecrets/_roombank").items || []).length === QUESTIONS.length + 1, 4000) && !("qbank" in db.data(ROOM)));
    /* لعبة الغرفة: الجواب ما ينكتب في الوثيقة العامة */
    await host.evaluate(() => {
        roomState.game = { active: true, status: "running", qText: roomBank[0].text, s1: 0, s2: 0, p1Name: "أ", p2Name: "ب", timer: 30, reveal1: null, reveal2: null };
        saveRoomState();
    });
    await sleep(500);
    const g = db.data(ROOM).game || {};
    check("room game: no answer in the public doc", !("ans1" in g) && !("ans2" in g) && !JSON.stringify(db.data(ROOM)).includes(QUESTIONS[0].answer), g);

    /* ===== متسابق ===== */
    const p1 = await device(browser, db, "p1", { live: "none" });
    await until(() => p1.evaluate(() => !!currentUser && roomStateLoaded), 10000);
    check("p1 has no bank (admin only)", await p1.evaluate(() => roomBank.length === 0));
    const contact = await until(() => db.data("contacts/u_p1"), 5000);
    check("own email saved in contacts/<uid>", contact && contact.email === "p1@test.local", contact);
    const n0 = db.log.length;
    await p1.evaluate(() => { let i = document.getElementById("roomChatInput"); if (!i) { i = document.createElement("input"); i.id = "roomChatInput"; document.body.appendChild(i); } i.value = "السلام عليكم"; sendRoomChat(); });
    const chat = await until(() => { const c = db.data(ROOM).chat || []; return c.length === 2 ? c : null; }, 5000);
    check("chat: my message appended after the old one", chat && chat[0].senderUid === "u_p2" && chat[1].senderUid === "u_p1" && chat[1].text === "السلام عليكم", chat);
    let w = roomWrites(db, n0);
    check("chat: one write, field chat only", w.length === 1 && w[0].op === "update" && w[0].keys.join() === "chat", w.map(x => x.op + ":" + x.keys.join()));
    const n1 = db.log.length;
    await p1.evaluate(() => takeMicSlot(7));
    const mics = await until(() => { const m = db.data(ROOM).mics || []; return m[7] ? m : null; }, 5000);
    check("mic: seat taken in the database", mics && mics[7].uid === "u_p1" && mics.length === 15, mics && mics[7]);
    w = roomWrites(db, n1);
    check("mic: field mics only", w.length >= 1 && w.every(x => x.op === "update" && x.keys.join() === "mics"), w.map(x => x.op + ":" + x.keys.join()));
    await p1.evaluate(() => toggleMyMic(7));
    check("mic: mute own seat", await until(() => (db.data(ROOM).mics[7] || {}).muted === true, 4000));
    /* مقعد محجوز: ما ينحجز فوقه */
    db.write({ op: "update", path: ROOM, data: { mics: Object.assign(Array(15).fill(null), { 3: { uid: "u_p2", name: "فهد", avatar: "", muted: false }, 7: db.data(ROOM).mics[7] }) } });
    await sleep(300);
    await p1.evaluate(() => releaseMicSlot(7));
    check("mic: release own seat", await until(() => db.data(ROOM).mics[7] === null, 4000));
    const n2 = db.log.length;
    await p1.evaluate(() => { roomState.mics[3] = null; return takeMicSlot(3); });
    await sleep(800);
    check("mic: someone else's seat is not taken (checked against the database)", (db.data(ROOM).mics[3] || {}).uid === "u_p2" && roomWrites(db, n2).length === 0);
    /* جواب لعبة الغرفة */
    const n3 = db.log.length;
    await p1.evaluate(() => { let i = document.getElementById("gameInputP1"); if (!i) { i = document.createElement("input"); i.id = "gameInputP1"; document.body.appendChild(i); } i.value = "الرياض"; submitGameAnswer(1); });
    check("room game answer: game.revealText1 only", await until(() => (db.data(ROOM).game || {}).revealText1 === "الرياض", 4000)
        && roomWrites(db, n3).every(x => x.keys.join() === "game.revealText1"), roomWrites(db, n3).map(x => x.keys.join()));
    /* المتسابق ما يكتب الغرفة كاملة أبد */
    const n4 = db.log.length;
    await p1.evaluate(() => { roomState.pinnedMsg = "x"; saveRoomState(); pinMessage(0); });
    await sleep(500);
    check("non-admin saveRoomState writes nothing", roomWrites(db, n4).length === 0);
    /* التوقع بدون إيميل، و users بدون إيميل */
    await p1.evaluate(() => {
        const a = document.createElement("input"), b = document.createElement("input");
        a.id = "tp1"; b.id = "tp2"; a.value = "2"; b.value = "1"; document.body.append(a, b);
        savePrediction("m_test", "tp1", "tp2");
    });
    const pr = await until(() => db.data("predictions/u_p1_m_test"), 4000);
    check("prediction saved without userEmail", pr && pr.userId === "u_p1" && !("userEmail" in pr), pr);
    const userWrites = db.log.filter(l => l.path === "users/u_p1" && l.keys.includes("email"));
    check("no email written to users/<uid>", userWrites.length === 0, userWrites);

    /* ===== السوم: pids ===== */
    await host.evaluate(() => somDo({ t: "create", gid: "stest1234", name: "محمد" }));
    await p1.evaluate(() => somDo({ t: "join", name: "سعد", av: "" }));
    const som = await until(() => { const s = db.data("room/main/games/som"); return s && (s.pids || []).includes("u_p1") ? s : null; }, 5000);
    check("som: pids written with every move", som && JSON.stringify(som.pids) === JSON.stringify(som.players.map(p => p.uid)), som && som.pids);

    /* المنظم: إيميلات الكل من contacts */
    const emails = await host.evaluate(() => new Promise(r => { ensureContacts(() => r(contactsCache)); setTimeout(() => r(contactsCache), 3000); }));
    check("admin reads emails from contacts", emails && emails.u_p1 === "p1@test.local", emails);
    const errs = [...host.__logs, ...p1.__logs].filter(l => /PAGEERROR/.test(l));
    check("no page errors", !errs.length, errs.slice(0, 3));
} catch (e) { ok = false; console.log(e.stack || e); }
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
