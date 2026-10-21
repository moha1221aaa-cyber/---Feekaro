/* كاشف الكلام (VAD) للجواب الصوتي + معالج AudioWorklet اللي يسجّل المايك.
   نفس الملف يشتغل في ثلاث أماكن (عشان الكاشف واحد):
   1) AudioWorklet (الأساسي): voice-answer.js يحمّله بـ audioWorklet.addModule، فيسجّل على خيط الصوت بدل ScriptProcessor (المهجور)
   2) سكربت عادي في index.html: يعرّف vaVadCreate للاحتياط (ScriptProcessor) في المتصفحات القديمة
   3) Node (tests/harness/vad.mjs): نجرب الكاشف على ملفات صوت بدون متصفح
   الكاشف: كل 20ms نحسب طاقة الصوت في نطاق الكلام (300-3500 هرتز)،
   وأرضية الضجة = أقل طاقة في آخر 1.5 ث (تطلع ببطء وتنزل بسرعة، فالكلام ما يرفعها والموسيقى المستمرة ترفعها)،
   والكلام يبدأ بعد 6 إطارات واضحة (120ms) وينتهي بعد 15 إطار هادي (300ms).
   (21 أكتوبر، بعد تجربة حقيقية: كان فيه pre-emphasis يقوّي الحروف الحادة، ومايك الجوال بعد كبت الضجة يقصها،
    فصوت المتسابق الواضح ما كان ينحسب كلام أبد. الحين الطاقة كاملة والحد أوطى) */

function vaVadCreate(rate) {
    const N = Math.max(64, Math.round(rate * 0.02));    /* إطار 20ms */
    const RING = 75;                                      /* 1.5 ث */
    const ring = new Float32Array(RING).fill(1);
    /* نطاق الكلام 300-3500 هرتز. الحد: الأعلى من (أرضية الضجة × 4، أو 0.2 من أعلى صوت قريب، أو 0.008)،
       فالجوال الواطي (بدون رفع صوت تلقائي) والعالي (بعد كبت الضجة ورفع الصوت) الاثنين ينلقط كلامهم.
       الإعدادات من بحث على 16 تسجيل (8 خام و 8 بعد معالجة مايك Chromium، tests/harness/capture.mjs):
       كل الكلام انلقط بدون ولا دورة ناقصة، والسكوت صفر، والموسيقى الكاملة بعد رفع الصوت مقطع واحد في 22 ث */
    const ah = Math.exp(-2 * Math.PI * 300 / rate), al = 1 - Math.exp(-2 * Math.PI * 3500 / rate);
    const K = 4, MIN = 0.008, REL = 0.2, PD = 0.995, ON = 6;
    let ri = 0, px = 0, py = 0, ly = 0, floor = 0.01, pk = 0, on = 0, off = 0, talking = false;
    const st = { N, speechMs: 0, peak: 0, frames: 0, floor: floor, talking: false, e: 0 };
    st.frame = function (x) {
        let s = 0, s2 = 0, z = 0;
        for (let i = 0; i < x.length; i++) {
            const y = ah * (py + x[i] - px); px = x[i]; py = y;
            ly += al * (y - ly);
            s += ly * ly; s2 += x[i] * x[i];
            if (i && (x[i] >= 0) !== (x[i - 1] >= 0)) z++;
        }
        const n = x.length || 1;
        const e = Math.sqrt(s / n), rms = Math.sqrt(s2 / n), zcr = z / n;
        ring[ri] = e; ri = (ri + 1) % RING;
        let mn = Infinity; for (let k = 0; k < RING; k++) if (ring[k] < mn) mn = ring[k];
        mn = Math.max(0.0008, mn);
        floor = mn > floor ? floor * 0.92 + mn * 0.08 : floor * 0.6 + mn * 0.4;
        pk = Math.max(e, pk * PD);
        const hi = Math.max(MIN, floor * K, pk * REL), lo = hi * 0.66;
        const voiced = e > hi && zcr < 0.4;
        if (voiced) { on++; off = 0; } else if (e < lo || zcr >= 0.4) { off++; on = 0; }
        if (!talking && on >= ON) talking = true;
        if (talking && off >= 15) talking = false;
        if (talking && e > lo) st.speechMs += n / rate * 1000;
        if (rms > st.peak) st.peak = rms;
        st.frames++; st.floor = floor; st.talking = talking; st.e = e; st.rms = rms;
        return talking;
    };
    return st;
}

if (typeof registerProcessor === "function" && typeof AudioWorkletProcessor === "function") {
    /* يجمع الصوت (128 عينة كل مرة) لإطارات 20ms، ويرسل كل إطار مع حكم الكاشف للصفحة */
    class VaCapture extends AudioWorkletProcessor {
        constructor() {
            super();
            this.vad = vaVadCreate(sampleRate);
            this.buf = new Float32Array(this.vad.N);
            this.n = 0;
            this.on = true;
            this.port.onmessage = ev => { if (ev.data === "stop") this.on = false; };
        }
        process(inputs) {
            if (!this.on) return false;
            const ch = inputs[0] && inputs[0][0];
            if (ch) {
                for (let i = 0; i < ch.length; i++) {
                    this.buf[this.n++] = ch[i];
                    if (this.n === this.buf.length) {
                        const f = this.buf;
                        const v = this.vad, talking = v.frame(f);
                        this.port.postMessage({ pcm: f, talking, rms: v.rms, e: v.e, floor: v.floor, speechMs: v.speechMs, peak: v.peak }, [f.buffer]);
                        this.buf = new Float32Array(this.vad.N); this.n = 0;
                    }
                }
            }
            return true;
        }
    }
    registerProcessor("va-capture", VaCapture);
}
