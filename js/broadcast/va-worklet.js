/* كاشف الكلام (VAD) للجواب الصوتي + معالج AudioWorklet اللي يسجّل المايك.
   نفس الملف يشتغل في ثلاث أماكن (عشان الكاشف واحد):
   1) AudioWorklet (الأساسي): voice-answer.js يحمّله بـ audioWorklet.addModule، فيسجّل على خيط الصوت بدل ScriptProcessor (المهجور)
   2) سكربت عادي في index.html: يعرّف vaVadCreate للاحتياط (ScriptProcessor) في المتصفحات القديمة
   3) Node (tests/harness/vad.mjs): نجرب الكاشف على ملفات صوت بدون متصفح
   الكاشف: كل 20ms نحسب طاقة الصوت بعد تقوية الحروف (pre-emphasis، يخفف البيس والموسيقى)،
   وأرضية الضجة = أقل طاقة في آخر 1.5 ث (تطلع ببطء وتنزل بسرعة، فالكلام ما يرفعها والموسيقى المستمرة ترفعها)،
   والكلام يبدأ بعد 3 إطارات واضحة (60ms) وينتهي بعد 15 إطار هادي (300ms). */

function vaVadCreate(rate) {
    const N = Math.max(64, Math.round(rate * 0.02));    /* إطار 20ms */
    const RING = 75;                                      /* 1.5 ث */
    const ring = new Float32Array(RING).fill(1);
    let ri = 0, prev = 0, floor = 0.004, on = 0, off = 0, talking = false;
    const st = { N, speechMs: 0, peak: 0, frames: 0, floor: floor, talking: false, e: 0 };
    st.frame = function (x) {
        let s = 0, s2 = 0, z = 0;
        for (let i = 0; i < x.length; i++) {
            const y = x[i] - 0.95 * prev; prev = x[i];
            s += y * y; s2 += x[i] * x[i];
            if (i && (x[i] >= 0) !== (x[i - 1] >= 0)) z++;
        }
        const n = x.length || 1;
        const e = Math.sqrt(s / n), rms = Math.sqrt(s2 / n), zcr = z / n;
        ring[ri] = e; ri = (ri + 1) % RING;
        let mn = Infinity; for (let k = 0; k < RING; k++) if (ring[k] < mn) mn = ring[k];
        mn = Math.max(0.0015, mn);
        floor = mn > floor ? floor * 0.97 + mn * 0.03 : floor * 0.6 + mn * 0.4;
        const hi = Math.max(0.012, floor * 3.2), lo = Math.max(0.008, floor * 2.2);
        const voiced = e > hi && zcr < 0.4;
        if (voiced) { on++; off = 0; } else if (e < lo || zcr >= 0.4) { off++; on = 0; }
        if (!talking && on >= 3) talking = true;
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
