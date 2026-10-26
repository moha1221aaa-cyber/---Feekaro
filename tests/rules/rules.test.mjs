/* قواعد Firestore (firestore.rules) بمحاكي Firebase: الحركات الصحيحة من كود الموقع تنقبل، والتلاعب ينرفض.
   المرحلة 2 (26 أكتوبر 2026): الغرفة والبث والسوم والحضور والتشخيص والتوقعات والإيميلات.
   التشغيل: cd tests/rules && npm i && npx firebase emulators:exec --only firestore --project masro7league "node rules.test.mjs" */
import fs from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";

const RULES = fs.readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
const env = await initializeTestEnvironment({ projectId: "masro7league", firestore: { rules: RULES, host: "127.0.0.1", port: 8085 } });
const TS = () => firebase.firestore.FieldValue.serverTimestamp();
const DEL = () => firebase.firestore.FieldValue.delete();
const ADMIN = "moha1221aaa@gmail.com";
const ctx = {
    admin: env.authenticatedContext("u_admin", { email: ADMIN }).firestore(),
    p1: env.authenticatedContext("u_p1", { email: "p1@t.local" }).firestore(),
    p2: env.authenticatedContext("u_p2", { email: "p2@t.local" }).firestore(),
    fan: env.authenticatedContext("u_fan", { email: "fan@t.local" }).firestore(),
    guest: env.unauthenticatedContext().firestore()
};
let failed = 0;
async function ok(name, p) { try { await assertSucceeds(p); console.log("PASS " + name); } catch (e) { failed++; console.log("FAIL " + name + " → " + (e && e.message || e).split("\n")[0]); } }
async function no(name, p) { try { await assertFails(p); console.log("PASS " + name); } catch (e) { failed++; console.log("FAIL " + name + " (was allowed)"); } }
async function seed(path, data) { await env.withSecurityRulesDisabled(async c => { await c.firestore().doc(path).set(data); }); }

/* ===== وثيقة البث ===== */
const LIVE = "room/main/liveMatches/round_2";
const now = () => Date.now();
const live = extra => Object.assign({
    type: "round", status: "live", scene: "playing", phase: "buzz", cur: 0, qIndex: 1, v: 10, round: 2, hostUid: "u_admin",
    order: [{ p1: "سعد", p2: "فهد", uid1: "u_p1", uid2: "u_p2", s1: 0, s2: 0, state: "pending" }],
    questions: [{ text: "س1", seal: "x" }, { text: "س2", seal: "y" }], shown: {},
    ready1: false, ready2: false, buzzer: 0, answerer: 0, tried1: false, tried2: false, passed: false, lastAnswer: null, outcome: 0,
    s1: 1, s2: 0, log: [1, -1, -1, -1, -1], fb1: 0, fb2: 0, bh1: 0, bh2: 0, qAt: now() - 2000, deadline: now() + 13000
}, extra || {});
const L = db => db.doc(LIVE);
const stamp = (u, v) => Object.assign(u, { v: (v || 10) + 1, updatedAt: TS() });

await seed(LIVE, live({ scene: "intro", phase: "wait" }));
await ok("p1 ready (own)", L(ctx.p1).update(stamp({ ready1: true })));
await seed(LIVE, live({ scene: "intro", phase: "wait", ready1: true }));
await ok("p2 ready → both ready → talk", L(ctx.p2).update(stamp({ ready2: true, scene: "talk", sceneAt: now() })));
await seed(LIVE, live({ scene: "intro", phase: "wait" }));
await no("p1 marks p2 ready", L(ctx.p1).update(stamp({ ready2: true })));
await no("p1 skips to talk without p2", L(ctx.p1).update(stamp({ ready1: true, scene: "talk", sceneAt: now() })));
await no("fan ready", L(ctx.fan).update(stamp({ ready1: true })));
await no("v not bumped", L(ctx.p1).update({ ready1: true, updatedAt: TS() }));

/* الجرس */
const buzz = n => stamp({ phase: "answer", buzzer: n, answerer: n, passed: false, deadline: now() + 7000, ansAt: now(), ["tried" + n]: true, ["fb" + n]: 2100 });
await seed(LIVE, live());
await ok("p1 buzz", L(ctx.p1).update(buzz(1)));
await seed(LIVE, live());
await ok("p2 buzz", L(ctx.p2).update(buzz(2)));
await seed(LIVE, live());
await no("p2 buzzes as player 1", L(ctx.p2).update(buzz(1)));
await no("fan buzz", L(ctx.fan).update(buzz(1)));
await no("guest buzz", L(ctx.guest).update(buzz(1)));
await no("p1 buzz + score", L(ctx.p1).update(Object.assign(buzz(1), { s1: 5 })));
await no("p1 buzz with a long answer time", L(ctx.p1).update(Object.assign(buzz(1), { deadline: now() + 60000 })));
await seed(LIVE, live({ deadline: now() - 10000 }));
await no("p1 buzz after the time is over", L(ctx.p1).update(buzz(1)));
await seed(LIVE, live({ phase: "answer", buzzer: 2, answerer: 2, tried2: true }));
await no("p1 buzz while p2 answers", L(ctx.p1).update(buzz(1)));

/* النقاط والنتائج: المنظم بس */
await seed(LIVE, live({ phase: "answer", buzzer: 1, answerer: 1, tried1: true, deadline: now() + 5000 }));
const reveal = (w, extra) => stamp(Object.assign({ phase: "reveal", outcome: w, log: [1, w, -1, -1, -1], deadline: now() + 6500, pend: null, lastAnswer: { by: 1, text: "", correct: w === 1 }, bh1: 0, bh2: 0 }, extra || {}));
await no("p1 judges himself correct", L(ctx.p1).update(reveal(1, { s1: 2 })));
await no("fan awards a point", L(ctx.fan).update(reveal(1, { s1: 2 })));
await ok("admin verdict correct (+1)", L(ctx.admin).update(reveal(1, { s1: 2 })));
await seed(LIVE, live());
await no("p1 rewrites the match order (results)", L(ctx.p1).update(stamp({ order: [{ uid1: "u_p1", uid2: "u_p2", s1: 5, s2: 0, state: "done" }] })));
await no("p1 rewrites questions", L(ctx.p1).update(stamp({ questions: [] })));
await no("p1 writes shown answers", L(ctx.p1).update(stamp({ shown: { "0_1": "x" } })));
await no("p1 ends the broadcast", L(ctx.p1).update(stamp({ status: "ended" })));
await no("p1 jumps to the next match", L(ctx.p1).update(stamp({ cur: 1, scene: "intro" })));
await no("fan creates a broadcast", ctx.fan.doc("room/main/liveMatches/round_9").set(live()));
await ok("admin creates a broadcast", ctx.admin.doc("room/main/liveMatches/round_9").set(live()));
await no("fan deletes a broadcast", ctx.fan.doc("room/main/liveMatches/round_9").delete());

/* انتهاء الوقت: أي أحد مسجّل، بس بعد وقته */
await seed(LIVE, live({ deadline: now() - 500 }));
await ok("fan: buzz time over → reveal with no points", L(ctx.fan).update(reveal(0, { lastAnswer: null })));
await seed(LIVE, live({ deadline: now() + 9000 }));
await no("fan: early reveal (time not over)", L(ctx.fan).update(reveal(0, { lastAnswer: null })));
await seed(LIVE, live({ deadline: now() - 500 }));
await no("fan: timeout reveal that marks a winner", L(ctx.fan).update(reveal(1, { lastAnswer: null })));
await no("fan: timeout reveal that rewrites old log entries", L(ctx.fan).update(reveal(0, { lastAnswer: null, log: [2, 0, -1, -1, -1] })));
await no("fan: timeout reveal with fake comeback stat", L(ctx.fan).update(reveal(0, { lastAnswer: null, bh2: 3 })));
await seed(LIVE, live({ phase: "answer", buzzer: 1, answerer: 1, tried1: true, deadline: now() - 500 }));
const pass = extra => stamp(Object.assign({ phase: "answer", answerer: 2, passed: true, lastAnswer: { by: 1, text: "", correct: false, timeout: true }, deadline: now() + 7000, ansAt: now(), pend: null, tried2: true }, extra || {}));
await ok("fan: answer time over → passes to p2", L(ctx.fan).update(pass()));
await no("fan: pass marked correct", L(ctx.fan).update(pass({ lastAnswer: { by: 1, correct: true } })));
await no("fan: pass back to the same player", L(ctx.fan).update(pass({ answerer: 1, tried1: true, tried2: DEL() })));
await seed(LIVE, live({ phase: "answer", buzzer: 1, answerer: 1, tried1: true, tried2: true, passed: true, deadline: now() - 500 }));
await ok("fan: both tried, time over → reveal", L(ctx.fan).update(reveal(0, { lastAnswer: { by: 2, text: "", correct: false, timeout: true } })));
await seed(LIVE, live({ scene: "countdown", phase: "wait", qIndex: 0, deadline: now() - 300 }));
const firstQ = () => stamp({ scene: "playing", qIndex: 0, phase: "buzz", buzzer: 0, answerer: 0, tried1: false, tried2: false, passed: false, lastAnswer: null, outcome: 0, qAt: now(), deadline: now() + 15000 });
await ok("fan: countdown over → first question", L(ctx.fan).update(firstQ()));
await seed(LIVE, live({ scene: "countdown", phase: "wait", qIndex: 0, deadline: now() + 3000 }));
await no("fan: first question before the countdown ends", L(ctx.fan).update(firstQ()));
await seed(LIVE, live({ scene: "talk", phase: "wait" }));
await no("p1 starts the countdown (host only)", L(ctx.p1).update(stamp({ scene: "countdown", deadline: now() + 3500 })));
await ok("admin heartbeat", L(ctx.admin).update({ hostSeen: now() }));
await no("p1 heartbeat", L(ctx.p1).update({ hostSeen: now() }));
await no("rx doc by a fan", ctx.fan.doc("room/main/liveMatches/rx_round_2").set({ type: "rx", n: 1 }));

/* ثغرات المراجعة الأمنية (security-auditor، 26 أكتوبر): حرق السؤال، تقديم الوقت، تثبيت قيم غلط */
await seed(LIVE, live());
await no("p1 buzz with deadline 0 (to burn the question)", L(ctx.p1).update(Object.assign(buzz(1), { deadline: 0 })));
await seed(LIVE, live({ deadline: now() - 500 }));
await no("fan: reveal with an instant deadline", L(ctx.fan).update(reveal(0, { lastAnswer: null, deadline: 0 })));
await seed(LIVE, live({ phase: "answer", buzzer: 1, answerer: 1, tried1: true, deadline: now() - 500 }));
await no("fan: reveal before p2 got the question (skips the pass)", L(ctx.fan).update(reveal(0, { lastAnswer: { by: 1, text: "", correct: false, timeout: true } })));
await seed(LIVE, live({ phase: "answer", buzzer: 1, answerer: 2, tried1: true, tried2: true, passed: true, deadline: now() - 500 }));
await no("fan: pass back to p1 who already tried", L(ctx.fan).update(pass({ answerer: 1, tried1: true, tried2: DEL() })));
await seed(LIVE, live({ deadline: now() + 1500 }));
await no("fan: reveal 1.5 s before the time is over", L(ctx.fan).update(reveal(0, { lastAnswer: null })));
await seed(LIVE, live({ scene: "countdown", phase: "wait", qIndex: 0, deadline: now() - 300 }));
await no("fan: first question with both players locked out", L(ctx.fan).update(Object.assign(firstQ(), { tried1: true, tried2: true })));
await no("fan: first question with a fake correct answer", L(ctx.fan).update(Object.assign(firstQ(), { lastAnswer: { by: 1, text: "", correct: true } })));
await no("fan: first question with a 1-second buzz window", L(ctx.fan).update(Object.assign(firstQ(), { deadline: now() + 1000 })));
await seed(LIVE, live({ deadline: now() - 500 }));
await no("fan: timeout reveal with a big text in lastAnswer", L(ctx.fan).update(reveal(0, { lastAnswer: { by: 1, text: "x".repeat(5000), correct: false, timeout: true } })));
await no("fan: timeout reveal that truncates the log", L(ctx.fan).update(reveal(0, { lastAnswer: null, log: [1, 0] })));
await seed(LIVE, live({ deadline: now() - 500, bh1: 2 }));
await no("fan: timeout reveal that lowers a comeback stat", L(ctx.fan).update(reveal(0, { lastAnswer: null, bh1: 0 })));
await seed(LIVE, live());
await no("p1 buzz with a fake buzz speed", L(ctx.p1).update(Object.assign(buzz(1), { fb1: 1 })));

/* صناديق الأسئلة والتشخيص والتوقعات */
await no("fan writes question boxes", ctx.fan.doc("room/main/liveBoxes/round_2").set({ boxes: [] }));
await ok("admin writes question boxes", ctx.admin.doc("room/main/liveBoxes/round_2").set({ boxes: ["v1.x"], at: 1 }));
const DIAG = "room/main/liveDiag/round_2";
await ok("p1 diag (create)", ctx.p1.doc(DIAG).set({ bcDiag: { u_p1: { buzz: [{ at: 1, local: 20 }] } }, at: 1 }, { merge: true }));
await ok("p2 diag (merge)", ctx.p2.doc(DIAG).set({ bcDiag: { u_p2: { buzz: [{ at: 2 }] } }, at: 2 }, { merge: true }));
await no("p2 overwrites p1 diag", ctx.p2.doc(DIAG).set({ bcDiag: { u_p1: { buzz: [] } }, at: 3 }, { merge: true }));
await no("p1 writes extra fields in diag", ctx.p1.doc(DIAG).set({ hack: 1 }, { merge: true }));
await no("fan writes question history", ctx.fan.doc("room/main/liveDiag/_qhistory").set({ bcDiag: { u_fan: {} } }));
await ok("fan prediction (own doc)", ctx.fan.doc("room/main/livePred/round_2/u/u_fan").set({ p: { c0: 1 }, name: "مشاهد" }, { merge: true }));
await no("fan prediction in p1's doc", ctx.fan.doc("room/main/livePred/round_2/u/u_p1").set({ p: { c0: 2 }, name: "x" }));
await no("guest prediction", ctx.guest.doc("room/main/livePred/round_2/u/g").set({ p: { c0: 1 } }));
await no("fan writes the old prediction map", ctx.fan.doc("room/main/livePred/round_2").set({ c0: { u_fan: { n: 1 } } }));

/* ===== الغرفة ===== */
const ROOM = "room/main";
const mics = (over) => { const m = Array(15).fill(null); Object.assign(m, over || {}); return m; };
const room = extra => Object.assign({ isLive: true, hostUid: "u_admin", hostName: "محمد", mics: mics({ 2: { uid: "u_admin", name: "محمد", avatar: "", muted: false }, 5: { uid: "u_p2", name: "فهد", avatar: "", muted: false } }),
    chat: [{ senderUid: "u_p2", senderName: "فهد", text: "هلا", time: "1" }], pinnedMsg: null, game: { active: true, status: "running", qText: "س", s1: 0, s2: 0, p1Name: "أ", p2Name: "ب" } }, extra || {});
const R = db => db.doc(ROOM);
const seat = (uid, muted) => ({ uid, name: "x", avatar: "", muted: !!muted });
await seed(ROOM, room());
await ok("p1 takes an empty seat", R(ctx.p1).update({ mics: mics({ 2: room().mics[2], 5: room().mics[5], 7: seat("u_p1") }) }));
await seed(ROOM, room());
await no("p1 takes p2's seat", R(ctx.p1).update({ mics: mics({ 2: room().mics[2], 5: seat("u_p1") }) }));
await no("p1 kicks p2", R(ctx.p1).update({ mics: mics({ 2: room().mics[2] }) }));
await no("p1 sits as someone else", R(ctx.p1).update({ mics: mics({ 2: room().mics[2], 5: room().mics[5], 7: seat("u_fan") }) }));
await ok("p2 mutes own seat", R(ctx.p2).update({ mics: mics({ 2: room().mics[2], 5: seat("u_p2", true) }) }));
await ok("p2 leaves own seat", R(ctx.p2).update({ mics: mics({ 2: room().mics[2] }) }));
await seed(ROOM, room({ isLive: false }));
await no("p1 takes a seat while the room is closed", R(ctx.p1).update({ mics: mics({ 2: room().mics[2], 5: room().mics[5], 7: seat("u_p1") }) }));
await seed(ROOM, room());
const msg = (uid, t) => ({ senderUid: uid, senderName: "x", text: t || "مرحبا", time: "2" });
await ok("p1 sends a chat message", R(ctx.p1).update({ chat: room().chat.concat([msg("u_p1")]) }));
await seed(ROOM, room());
await no("p1 sends as p2", R(ctx.p1).update({ chat: room().chat.concat([msg("u_p2")]) }));
await no("p1 deletes p2's message", R(ctx.p1).update({ chat: [msg("u_p1")] }));
await no("p1 edits p2's message", R(ctx.p1).update({ chat: [msg("u_p2", "تعديل"), msg("u_p1")] }));
await no("guest sends chat", R(ctx.guest).update({ chat: room().chat.concat([msg("g")]) }));
const full = Array.from({ length: 50 }, (_, i) => msg("u_p2", "م" + i));
await seed(ROOM, room({ chat: full }));
await ok("p1 message on a full chat (oldest drops)", R(ctx.p1).update({ chat: full.slice(1).concat([msg("u_p1")]) }));
await seed(ROOM, room());
await no("p1 wipes the chat (keeps only his message)", R(ctx.p1).update({ chat: [msg("u_p1")] }));
await no("p1 takes two seats", R(ctx.p1).update({ mics: mics({ 2: room().mics[2], 5: room().mics[5], 7: seat("u_p1"), 8: seat("u_p1") }) }));
await seed(ROOM, room({ mics: mics({ 5: room().mics[5] }) }));
await no("p1 takes the host seat", R(ctx.p1).update({ mics: mics({ 2: seat("u_p1"), 5: room().mics[5] }) }));
await seed(ROOM, (() => { const r = room(); delete r.chat; return r; })());
await ok("p1 takes a seat in a room doc with no chat field", R(ctx.p1).update({ mics: mics({ 2: room().mics[2], 5: room().mics[5], 7: seat("u_p1") }) }));
await ok("p1 first message in a room doc with no chat field", R(ctx.p1).update({ chat: [msg("u_p1")] }));
await seed(ROOM, room());
await no("p1 writes a huge game answer", R(ctx.p1).update({ "game.revealText1": "x".repeat(500) }));
await ok("p1 answers the room game", R(ctx.p1).update({ "game.revealText1": "الرياض" }));
await no("p1 gives himself game points", R(ctx.p1).update({ "game.s1": 3 }));
await no("p1 opens the room", R(ctx.p1).update({ isLive: true, hostUid: "u_p1" }));
await no("p1 pins a message", R(ctx.p1).update({ pinnedMsg: "x" }));
await no("p1 writes a question bank", R(ctx.p1).update({ qbank: [{ text: "س", answer: "ج" }] }));
await no("p1 changes the room ID", R(ctx.p1).update({ accessId: "123" }));
await ok("admin writes the whole room", R(ctx.admin).set(room({ pinnedMsg: "تثبيت" }), { merge: true }));
await seed(ROOM, room({ game: { active: false } }));
await no("p1 answers a finished game", R(ctx.p1).update({ "game.revealText1": "x" }));

/* الحضور */
const pres = { name: "سعد", photoURL: "", isAdmin: false, lastSeen: TS() };
await ok("p1 presence (own)", ctx.p1.doc("room/main/presence/u_p1").set(pres, { merge: true }));
await no("p1 presence as p2", ctx.p1.doc("room/main/presence/u_p2").set(pres));
await no("p1 presence claiming admin", ctx.p1.doc("room/main/presence/u_p1").set(Object.assign({}, pres, { isAdmin: true })));
await ok("guest presence", ctx.guest.doc("room/main/presence/guest_gabc123xyz").set(pres, { merge: true }));
await no("guest presence on a user's doc", ctx.guest.doc("room/main/presence/u_p1").set(pres));
await ok("p1 removes own presence", ctx.p1.doc("room/main/presence/u_p1").delete());

/* ===== السوم ===== */
const SOM = "room/main/games/som";
const som = extra => Object.assign({ active: true, gid: "sabc123", phase: "bid", hostUid: "u_admin", deal: "v1.deal", players: [{ uid: "u_p1", bal: 10000 }, { uid: "u_p2", bal: 10000 }],
    pids: ["u_p1", "u_p2"], bids: {}, v: 3 }, extra || {});
await seed(SOM, som());
await ok("som: player bids", ctx.p1.doc(SOM).set(som({ bids: { u_p1: 500 }, v: 4 })));
await seed(SOM, som());
await no("som: outsider writes", ctx.fan.doc(SOM).set(som({ bids: { u_fan: 500 } })));
await no("som: player swaps the sealed cards", ctx.p1.doc(SOM).set(som({ deal: "v1.other" })));
await no("som: player adds an outsider", ctx.p1.doc(SOM).set(som({ pids: ["u_p1", "u_p2", "u_fan"] })));
await no("som: player closes the table", ctx.p1.doc(SOM).set(som({ active: false })));
await seed(SOM, som({ phase: "lobby" }));
await ok("som: fan joins the lobby", ctx.fan.doc(SOM).set(som({ phase: "lobby", pids: ["u_p1", "u_p2", "u_fan"], players: som().players.concat([{ uid: "u_fan", bal: 10000 }]) })));
await seed(SOM, som({ phase: "lobby" }));
await ok("som: player leaves the lobby", ctx.p2.doc(SOM).set(som({ phase: "lobby", pids: ["u_p1"], players: [som().players[0]] })));
await seed(SOM, som());
await no("som: fan joins mid-game", ctx.fan.doc(SOM).set(som({ pids: ["u_p1", "u_p2", "u_fan"] })));
await seed(SOM, som({ round: 2, seats: ["u_p1", "u_p2"], starter: "u_p1" }));
await no("som: player changes the round", ctx.p1.doc(SOM).set(som({ round: 3, seats: ["u_p1", "u_p2"], starter: "u_p1" })));
await no("som: player changes who starts", ctx.p1.doc(SOM).set(som({ round: 2, seats: ["u_p1", "u_p2"], starter: "u_p2" })));
await no("som: player replaces a player (same pids)", ctx.p1.doc(SOM).set(som({ round: 2, seats: ["u_p1", "u_p2"], starter: "u_p1", players: [som().players[0], { uid: "u_fan", bal: 10000 }] })));
await ok("som: player bids (round 2)", ctx.p1.doc(SOM).set(som({ round: 2, seats: ["u_p1", "u_p2"], starter: "u_p1", bids: { u_p1: 600 } })));
await ok("som: admin opens a new table", ctx.admin.doc(SOM).set(som({ gid: "snew999", phase: "lobby", pids: [], players: [] })));
await no("som: anything else under room by a fan", ctx.fan.doc("room/main/games/other").set({ x: 1 }));

/* ===== الإيميلات ===== */
await ok("contacts: own email", ctx.p1.doc("contacts/u_p1").set({ email: "p1@t.local" }, { merge: true }));
await no("contacts: someone else's email", ctx.p1.doc("contacts/u_p1").set({ email: "other@t.local" }));
await no("contacts: writing another user's contact", ctx.p1.doc("contacts/u_p2").set({ email: "p1@t.local" }));
await no("contacts: reading another user's email", ctx.p2.doc("contacts/u_p1").get());
await ok("contacts: reading own email", ctx.p1.doc("contacts/u_p1").get());
await ok("contacts: admin reads all", ctx.admin.collection("contacts").get());
await no("contacts: guest reads", ctx.guest.collection("contacts").get());
await no("users: new account with email in the public doc", ctx.p1.doc("users/u_p1").set({ name: "سعد", email: "p1@t.local" }));
await ok("users: new account without email", ctx.p1.doc("users/u_p1").set({ name: "سعد" }));
await seed("users/u_p2", { name: "فهد", email: "p2@t.local" });
await ok("users: legacy doc with email, rename", ctx.p2.doc("users/u_p2").set({ name: "فهد 2" }, { merge: true }));
await ok("users: removing the legacy email", ctx.p2.doc("users/u_p2").update({ email: DEL() }));
await no("users: adding email back", ctx.p2.doc("users/u_p2").update({ email: "p2@t.local" }));
await no("predictions: new with userEmail", ctx.p1.doc("predictions/u_p1_m1").set({ userId: "u_p1", matchId: "m1", s1: 1, s2: 0, userEmail: "p1@t.local" }));
await ok("predictions: new without email", ctx.p1.doc("predictions/u_p1_m1").set({ userId: "u_p1", matchId: "m1", s1: 1, s2: 0 }));
await no("predictions: in someone else's name", ctx.p1.doc("predictions/u_p2_m1").set({ userId: "u_p2", matchId: "m1", s1: 1, s2: 0 }));

/* ===== اللي ما تغيّر ===== */
await no("league: player writes the table", ctx.p1.doc("league/current").set({ matches: [] }));
await ok("league: everyone reads", ctx.guest.doc("league/current").get());
await no("liveSecrets: player reads", ctx.p1.doc("liveSecrets/round_2").get());
await no("liveSecrets: player reads the room question bank", ctx.p1.doc("liveSecrets/_roombank").get());
await no("private broadcast (liveSecrets/rehearsal): player reads", ctx.p1.doc("liveSecrets/rehearsal").get());
await no("private broadcast: player writes", ctx.p1.doc("liveSecrets/rehearsal").set({ status: "live" }));
await ok("private broadcast: admin writes", ctx.admin.doc("liveSecrets/rehearsal").set({ type: "round", status: "live", rehearsal: 1 }));
await ok("liveSecrets: admin writes the room question bank", ctx.admin.doc("liveSecrets/_roombank").set({ items: [{ text: "س", answer: "ج" }] }));
await ok("room: everyone reads", ctx.guest.doc(ROOM).get());

await env.cleanup();
if (failed) { console.log(failed + " failed"); process.exit(1); }
console.log("all passed");
