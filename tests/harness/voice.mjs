/* الجواب الصوتي بمايك وهمي (Chromium --use-file-for-fake-audio-capture) في كل الحالات:
   كلام فوري، كلام مع موسيقى، سكوت، موسيقى بس، مايك مكتوم من المتسابق، ومايك مرفوض من المتصفح.
   node tests/harness/voice.mjs [مجلد_النتائج] [حالة] */
import { serve, FakeDB, seed, launch, device, until, sleep, liveDoc } from "./harness.mjs";
import fs from "node:fs";

const out = process.argv[2] || "/tmp/harness-voice";
const only = process.argv[3] || "";
fs.mkdirSync(out, { recursive: true });
const wavSec = b64 => { const b = Buffer.from(b64, "base64"); return (b.length - 44) / 2 / b.readUInt32LE(24); };

const CASES = [
    { name: "speech-now", wav: "speech.wav", expect: "voice" },
    { name: "long-answer", wav: "speech_long.wav", expect: "voice", live: true },
    { name: "speech-music", wav: "speech_music.wav", expect: "voice" },
    { name: "phone-mic", wav: "phone.wav", expect: "voice" },
    { name: "phone-quiet", wav: "phone_quiet.wav", expect: "voice" },
    { name: "phone-music", wav: "phone_music.wav", expect: "voice" },
    { name: "silence", wav: "silence.wav", expect: "type" },
    { name: "music-only", wav: "music_only.wav", expect: "type" },
    { name: "self-muted", wav: "speech.wav", expect: "voice", mute: true },
    { name: "mic-denied", wav: "speech.wav", expect: "type", allowMic: false }
];
const srv = await serve(8787);
const results = [];
for (const c of CASES.filter(x => !only || x.name === only)) {
    const db = new FakeDB(60);
    const now = Date.now();
    seed(db, "playing", { phase: "buzz", qIndex: 0, qAt: now, deadline: now + 600000, ready1: true, ready2: true });
    const reqs = [];
    const api = { ai: async (b) => {
        const r = { task: b.task, at: Date.now(), sec: b.audio ? +wavSec(b.audio).toFixed(2) : 0 };
        reqs.push(r);
        if (b.audio) fs.writeFileSync(`${out}/${c.name}-${b.task}-${reqs.length}.wav`, Buffer.from(b.audio, "base64"));
        if (b.task === "hear") return { heard: "مساء الخير مساء" };
        if (b.task === "voice") {
            const lines = [{ heard: "مساء الخير" }, { final: true, heard: "مساء الخير", said: "الرياض", ok: true }];
            return b.stream ? { raw: { status: 200, contentType: "application/x-ndjson", body: lines.map(l => JSON.stringify(l)).join("\n") + "\n" } } : lines[1];
        }
        return { ok: false };
    } };
    const browser = await launch({ wav: c.wav, allowMic: c.allowMic });
    const r = { case: c.name, expect: c.expect };
    try {
        const p1 = await device(browser, db, "p1", { api, allowMic: c.allowMic });
        await until(() => p1.$("#lvBell"), 15000);
        /* الوقت للإجابة يكون كافي (الاختبار يقيس سلوك التسجيل مو نهاية الوقت) */
        await until(() => p1.evaluate(() => typeof bcTrack !== "undefined" && !!bcTrack || !!bcMicErr), 8000);
        if (c.mute) { await p1.evaluate(() => { if (!bcSelfMuted) bcToggleSelfMute(); }); await sleep(300); r.mutedBefore = await p1.evaluate(() => bcSelfMuted); }
        if (c.expect === "voice") {
            /* كلام فوري: ننتظر لين يبدأ الكلام في الملف ونضغط الجرس معه (أول كلمة لازم ما تضيع) */
            r.waitSpeech = !!(await until(() => p1.evaluate(() => {
                if (!window.__lvl) { const t = bcTrack.getMediaStreamTrack(); const was = t.enabled; t.enabled = true; const ctx = new AudioContext(); const an = ctx.createAnalyser(); ctx.createMediaStreamSource(new MediaStream([t.clone()])).connect(an); const buf = new Float32Array(an.fftSize); window.__lvl = () => { an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; return Math.sqrt(s / buf.length); }; t.enabled = was; }
                return window.__lvl() > 0.012;
            }), 9000, 20));
        } else await sleep(500);
        const t0 = Date.now();
        await p1.evaluate(() => document.getElementById("lvBell").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true })));
        await until(() => liveDoc(db).phase === "answer", 5000);
        await sleep(400);
        await p1.screenshot({ path: `${out}/${c.name}-1-rec.png` });
        if (c.live) {
            r.liveText = await until(() => p1.evaluate(() => { const e = document.getElementById("vaLive"); return e && e.textContent.trim(); }), 6000);
            await p1.screenshot({ path: `${out}/${c.name}-1b-live.png` });
        }
        if (c.expect === "voice") {
            r.sent = !!(await until(() => reqs.find(x => x.task === "voice"), 12000));
            const v = reqs.find(x => x.task === "voice");
            if (v) { r.sentAfterMs = v.at - t0; r.wavSec = v.sec; }
            r.committed = !!(await until(() => liveDoc(db).phase === "reveal", 8000));
            r.lastAnswer = liveDoc(db).lastAnswer;
            await sleep(300);
            await p1.screenshot({ path: `${out}/${c.name}-2-done.png` });
            if (c.mute) r.mutedAfter = await p1.evaluate(() => bcSelfMuted && !bcTrack.getMediaStreamTrack().enabled);
        } else {
            r.typeBox = !!(await until(() => p1.$("#lvAnswerInput"), 9000));
            r.typeAfterMs = Date.now() - t0;
            r.voiceSent = reqs.some(x => x.task === "voice");
            r.note = await p1.evaluate(() => { const n = document.querySelector(".va-note"); return n ? n.textContent.trim() : ""; });
            await p1.screenshot({ path: `${out}/${c.name}-2-type.png` });
        }
        const diag = ((db.data("room/main/liveDiag/round_2") || {}).vaDiag || {}).u_p1;
        r.diag = Array.isArray(diag) ? diag.map(x => ({ steps: x.steps.join(">"), via: x.via, speechMs: x.speechMs, said: x.said, ok: x.ok })) : diag;
        r.reqs = reqs.map(x => x.task + ":" + x.sec + "s");
        r.errors = p1.__logs.filter(l => /PAGEERROR/.test(l));
        r.pass = c.expect === "voice"
            ? r.sent && r.committed && r.wavSec > 0.9 && r.wavSec < (c.live ? 4.5 : 3.5) && r.diag && /worklet/.test(r.diag[r.diag.length - 1].via || "") && (!c.mute || (r.mutedBefore && r.mutedAfter)) && (!c.live || (r.liveText && r.reqs.some(x => /^hear/.test(x)))) && !r.errors.length
            : r.typeBox && !r.voiceSent && !r.errors.length;
    } catch (e) { r.pass = false; r.err = String(e.stack || e); }
    results.push(r);
    console.log((r.pass ? "PASS " : "FAIL ") + c.name + " " + JSON.stringify(r));
    await browser.close();
}
fs.writeFileSync(out + "/results.json", JSON.stringify(results, null, 1));
srv.close();
process.exit(results.every(r => r.pass) ? 0 : 1);
