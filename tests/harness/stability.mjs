/* ثبات البث (26 أكتوبر 2026، بعد "الموقع يعلق والجرس ما يضغط والمذيع يتأخر وصوت المتسابق يختفي"):
   1) المايك ينفتح وينتشر مرة وحدة ويتكتم ويتفتح بس (المتسابق من صفحة مواجهته لين نتيجتها، والمنظم طول البث)
   2) توقعات المشاهدين في livePred/<id>/u/<uid> (كل واحد وثيقته)، مو في وثيقة البث
   3) المنظم ما يكتب "أنا موجود" لحاله وهو كتب شي قريب، والكشف من جهازه فيه الجواب بنفس الكتابة
   4) صوت السؤال الجاي (بصيغته اللي بتنقرا) يتجهز وقت كشف السؤال اللي قبله، والمنظم ما يبدأ السؤال قبل صوته
   5) رسم صفحات الموقع ورا البث يتأجل لين تنقفل شاشة البث
   node tests/harness/stability.mjs */
import { serve, FakeDB, seed, launch, device, until, sleep, liveDoc, QUESTIONS } from "./harness.mjs";
const srv = await serve();
let ok = true;
const check = (name, v, extra) => { if (!v) ok = false; console.log((v ? "PASS " : "FAIL ") + name + (extra !== undefined ? " " + JSON.stringify(extra) : "")); };
const wav = (() => {   /* 1 ث سكوت */
    const n = 16000, b = Buffer.alloc(44 + n * 2);
    b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
    b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40); return b;
})();
const browser = await launch({});
const P = "room/main/liveMatches/round_2";
const mic = page => page.evaluate(() => ({ track: !!bcTrack, pubs: (window.__agora || {}).publishes || 0, muted: !!window.__micMuted, open: bcMicOpen() }));
try {
    /* ===== 1) المايك ===== */
    {
        const db = new FakeDB(30);
        seed(db, "intro", { sceneAt: Date.now() - 5000 });
        const p1 = await device(browser, db, "p1", {});
        const host = await device(browser, db, "host", {});
        const a = await until(async () => { const m = await mic(p1); return m.track ? m : null; }, 8000);
        check("contestant: mic ready (published, muted) on the match page", a && a.pubs === 1 && a.muted && !a.open, a);
        const t0 = Date.now();
        db.write({ op: "update", path: P, data: { ready1: true, ready2: true, scene: "talk", sceneAt: t0, v: 5 } });
        await sleep(2500);
        const b = await mic(p1);
        check("contestant: still muted during the sting, no new publish", b.muted && b.pubs === 1, b);
        const at = await until(() => p1.evaluate(() => bcMicOpen()).then(v => v ? Date.now() : 0), 9000);
        check("contestant: unmuted by itself right after the sting (~5.6 s), same track", at && at - t0 >= 5500 && at - t0 < 7500, at && at - t0);
        check("contestant: still one publish", (await mic(p1)).pubs === 1);
        db.write({ op: "update", path: P, data: { scene: "countdown", deadline: Date.now() + 3000, sceneAt: Date.now(), v: 6 } });
        await sleep(700);
        db.write({ op: "update", path: P, data: { scene: "result", phase: "done", sceneAt: Date.now(), v: 7 } });
        await sleep(1500);
        const c = await mic(p1);
        check("contestant: result → muted, track kept", c.track && c.muted && c.pubs === 1, c);
        const hm = await mic(host);
        check("host: one publish through the match", hm.pubs === 1 && hm.track, hm);
        /* المواجهة الجاية (المتسابق مو فيها): مايكه ينشال، ومايك المنظم يظل */
        const order = liveDoc(db).order.map((o, i) => i === 0 ? Object.assign({}, o, { state: "done" }) : o);
        db.write({ op: "update", path: P, data: { scene: "intro", cur: 1, order, sceneAt: Date.now(), v: 8 } });
        await sleep(1500);
        check("contestant: next match not his → mic released", !(await mic(p1)).track);
        db.write({ op: "update", path: P, data: { scene: "talk", sceneAt: Date.now() - 10000, v: 9 } });
        await sleep(1200);
        const h2 = await mic(host);
        check("host: same track for the next match (no re-publish)", h2.pubs === 1 && h2.open, h2);
        const errs = [...p1.__logs, ...host.__logs].filter(l => /PAGEERROR/.test(l));
        check("no page errors (mic)", !errs.length, errs.slice(0, 3));
        await p1.context().close(); await host.context().close();
    }
    /* ===== 2 + 5) التوقعات ورسم الصفحات ===== */
    {
        const db = new FakeDB(30);
        seed(db, "intro", { sceneAt: Date.now() - 5000 });
        const fan = await device(browser, db, "fan", {});
        await until(() => fan.$(".st-predbtns button"), 10000);
        const v0 = db.get(P).ver;
        await fan.evaluate(() => bcPredict(1));
        const pd = await until(() => db.data("room/main/livePred/round_2/u/u_fan"), 5000);
        check("prediction saved in livePred/<id>/u/<uid> (own doc)", pd && pd.p && pd.p.c0 === 1 && pd.name, pd);
        check("broadcast doc untouched by the prediction", db.get(P).ver === v0 && !liveDoc(db).pred);
        const shown = await until(() => fan.evaluate(() => (document.querySelector(".st-predlbl") || {}).textContent || "").then(t => /1 توقّع/.test(t) ? t : ""), 5000);
        check("prediction counted on screen", !!shown, shown);
        /* الجدول تغيّر وشاشة البث مفتوحة: الرسم يتأجل */
        await fan.evaluate(() => { window.__lr = 0; const f = renderLeagueAll; renderLeagueAll = function () { window.__lr++; return f.apply(this, arguments); }; });
        const lc = db.data("league/current"); lc.matches[2].s1 = "1"; lc.matches[2].s2 = "0";
        db.write({ op: "set", path: "league/current", data: lc });
        await sleep(800);
        check("league re-render deferred while the broadcast is open", await fan.evaluate(() => window.__lr === 0 && bcPageQueue.has("league")));
        check("standings still computed for the broadcast", await fan.evaluate(() => players.find(p => p.name === "سعد").pts >= 3));
        await fan.evaluate(() => closeLiveScreen(true));
        check("league rendered after closing the broadcast", await until(() => fan.evaluate(() => window.__lr >= 1), 3000));
        await fan.context().close();
    }
    /* ===== 3 + 4) كتابات المنظم وصوت السؤال الجاي ===== */
    {
        const tts = [];
        const api = {
            tts: async (b, info) => { tts.push({ who: info.who, text: info.url.searchParams.get("t"), at: Date.now() }); await sleep(info.who === "host" ? 300 : 50); return { raw: { status: 200, contentType: "audio/wav", body: wav } }; }
        };
        const db = new FakeDB(30);
        const now = Date.now();
        /* السؤال 4 انكشف والنتيجة 2-2: السؤال الخامس "سؤال الحسم" بصيغة ثانية غير اللي تجهزت أول المواجهة */
        seed(db, "playing", { phase: "reveal", qIndex: 3, s1: 2, s2: 2, outcome: 2, log: [1, 2, 1, 2, -1], deadline: now + 60000, qAt: now - 20000, hostSeen: now });
        const host = await device(browser, db, "host", { api });
        const fan = await device(browser, db, "fan", { api });
        const want = await until(() => host.evaluate(() => typeof bcNextQSpoken === "function" && liveMatchesCache[openLiveId] ? bcNextQSpoken(liveMatchesCache[openLiveId]) : ""), 10000);
        check("next question is the decider wording", /الحسم|يحسم|حاسم/.test(want || "") && want.indexOf(QUESTIONS[4].text) !== -1, want);
        const hostReq = await until(() => tts.find(t => t.who === "host" && t.text === want), 4000);
        check("host prepares the exact next-question audio during the reveal", !!hostReq);
        const fanReq = await until(() => tts.find(t => t.who === "fan" && t.text === want), 4000);
        check("viewer prepares it too (from cache, after the host)", !!fanReq && fanReq.at >= hostReq.at);
        /* ما فيه كتابة "أنا موجود" لحالها والمنظم كتب قريب */
        const beats0 = db.log.filter(l => l.path === P && l.keys.length === 1 && l.keys[0] === "hostSeen").length;
        await sleep(11000);
        const beats = db.log.filter(l => l.path === P && l.keys.length === 1 && l.keys[0] === "hostSeen").length - beats0;
        check("no separate host heartbeat writes within 11 s", beats === 0, beats);
        /* المنظم يضغط السؤال التالي: الكتابة فيها hostSeen، والصوت كان جاهز قبلها */
        const tPress = Date.now();
        await host.evaluate(() => bcHostNextQ());
        const d = await until(() => { const x = liveDoc(db); return x.phase === "buzz" && x.qIndex === 4 ? x : null; }, 6000);
        check("next question started", !!d);
        check("question write carries hostSeen", d && d.hostSeen >= tPress, d && d.hostSeen - tPress);
        check("host had the voice before the question started", !!hostReq && hostReq.at < tPress);
        /* الكشف من المنظم: الجواب بنفس الكتابة (مو كتابة ثانية بعدها) */
        db.write({ op: "update", path: P, data: { phase: "answer", buzzer: 1, answerer: 1, tried1: true, deadline: Date.now() + 7000, ansAt: Date.now(), v: 99 } });
        await until(() => host.$(".bc-verdict button"), 4000);
        await host.evaluate(() => { bcSecrets[openLiveId] = bcSecrets[openLiveId] || {}; const q = liveMatchesCache[openLiveId].questions[4]; q.seal = "x"; bcSecrets[openLiveId][q.text] = "الفهد"; });
        /* الختم مزيف في الجهاز بس (الوثيقة فيها answer)، فالمطلوب: الكتابة ما تفشل */
        const nlog = db.log.length;
        await host.evaluate(() => bcHostVerdict(true));
        const r = await until(() => liveDoc(db).phase === "reveal" ? liveDoc(db) : null, 5000);
        check("verdict → reveal in one write", !!r && db.log.slice(nlog).filter(l => l.path === P).length === 1, db.log.slice(nlog).map(l => l.keys.join(",")));
        const errs = [...host.__logs, ...fan.__logs].filter(l => /PAGEERROR/.test(l));
        check("no page errors (host)", !errs.length, errs.slice(0, 3));
        await host.context().close(); await fan.context().close();
    }
    /* ===== حجم وثيقة البث ===== */
    {
        const db = new FakeDB(30);
        seed(db, "result", { status: "ended", sceneAt: Date.now() - 60000 });
        const host = await device(browser, db, "host", { live: "none" });
        await until(() => host.evaluate(() => typeof bcStartRound === "function" && matches.length > 0), 15000);
        await host.evaluate(() => { bcAskStart = async () => ({ at: 0 }); aiHostLines = async () => null; bcFreshQuestions = async () => []; bcStartRound(2); });
        const d = await until(() => { const x = db.data("room/main/liveMatches/round_2"); return x && x.status === "live" && x.scene === "opening" ? x : null; }, 20000);
        check("default avatars not stored in the broadcast order", d && d.order.every(o => !/ui-avatars/.test(o.av1 + o.av2)), d && d.order.map(o => o.av1));
        await host.context().close();
    }
} catch (e) { ok = false; console.log(e.stack || e); }
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
