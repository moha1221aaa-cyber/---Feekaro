/* يسجّل ملفات المايك الوهمي من داخل Chromium بنفس إعدادات مايك البث (echoCancellation و noiseSuppression و autoGainControl)،
   عشان نضبط كاشف الكلام على الصوت مثل ما يوصله فعلاً في الجوال، مو على الملف الخام. 
   node tests/harness/capture.mjs  ← audio/captured/<اسم>.wav (+ .json فيه بداية الكلام بعد المحاذاة) */
import fs from "node:fs";
import path from "node:path";
import { chromium, serve, PORT } from "./harness.mjs";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILES = ["speech", "speech_music", "silence", "music_only", "phone", "phone_quiet", "phone_music", "phone_music_only"];
const srv = await serve(PORT);
for (const f of FILES) {
    const browser = await chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--use-file-for-fake-audio-capture=" + path.join(HERE, "audio", f + ".wav"), "--autoplay-policy=no-user-gesture-required"] });
    const page = await (await browser.newContext({ permissions: ["microphone"] })).newPage();
    await page.goto(`http://127.0.0.1:${PORT}/icon-192.png`);
    const b64 = await page.evaluate(() => new Promise(async res => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        const ctx = new AudioContext({ sampleRate: 48000 });
        const src = ctx.createMediaStreamSource(stream), sp = ctx.createScriptProcessor(4096, 1, 1), g = ctx.createGain(); g.gain.value = 0;
        const parts = []; let n = 0;
        sp.onaudioprocess = e => { const d = e.inputBuffer.getChannelData(0); parts.push(new Float32Array(d)); n += d.length; if (n >= 48000 * 24) { sp.disconnect(); const all = new Int16Array(n); let o = 0; for (const p of parts) for (const v of p) all[o++] = Math.max(-32768, Math.min(32767, v * 32767)); let s = ""; const u8 = new Uint8Array(all.buffer); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); res(btoa(s)); } };
        src.connect(sp); sp.connect(g); g.connect(ctx.destination);
    }));
    const pcm = Buffer.from(b64, "base64");
    const h = Buffer.alloc(44); h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(48000, 24); h.writeUInt32LE(96000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
    fs.writeFileSync(path.join(HERE, "audio", "captured", f + ".wav"), Buffer.concat([h, pcm]));
    console.log("captured", f, (pcm.length / 96000).toFixed(1) + "s");
    await browser.close();
}
srv.close();
