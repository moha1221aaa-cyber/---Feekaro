/* بديل أجورا للاختبار المحلي: المايك من getUserMedia (في Chromium يكون المايك الوهمي --use-file-for-fake-audio-capture)،
   والقناة ما تتصل بأي مكان. setMuted مثل أجورا: التتبع يظل موجود بس يطلع سكوت. */
(function () {
    function micTrack() {
        /* ?rawmic=1: بدون معالجة المتصفح (مثل جوال ما يرفع الصوت تلقائياً)، عشان الملف الواطي يوصل واطي */
        const raw = /[?&]rawmic=1/.test(location.search);
        return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: !raw, noiseSuppression: !raw, autoGainControl: !raw } }).then(stream => {
            const t = stream.getAudioTracks()[0];
            let ctx = null, an = null, buf = null;
            return {
                trackMediaType: "audio",
                getMediaStreamTrack: () => t,
                setMuted: m => { t.enabled = !m; window.__micMuted = !!m; return Promise.resolve(); },
                setEnabled: e => { t.enabled = !!e; return Promise.resolve(); },
                getVolumeLevel() {
                    try {
                        if (!an) { ctx = new AudioContext(); an = ctx.createAnalyser(); an.fftSize = 512; buf = new Float32Array(512); ctx.createMediaStreamSource(new MediaStream([t])).connect(an); }
                        an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; return Math.min(1, Math.sqrt(s / buf.length) * 4);
                    } catch (e) { return 0; }
                },
                close: () => t.stop(), stop() {}, play() {}
            };
        });
    }
    window.AgoraRTC = {
        createClient() {
            const h = {};
            /* window.__agora: عدد الدخول والنشر، و emit يطلق حدث (مثلاً انقطاع النت) للاختبار */
            const st = window.__agora = { joins: 0, publishes: 0, published: [], emit: (e, ...a) => h[e] && h[e](...a) };
            return {
                remoteUsers: [],
                on: (e, f) => { h[e] = f; },
                join: (app, ch, tok, uid) => { st.joins++; return Promise.resolve(uid || Math.floor(Math.random() * 1e6)); },
                publish: tr => { st.publishes++; if (st.failPublish > 0) { st.failPublish--; return Promise.reject(new Error("CAN_NOT_PUBLISH_MULTIPLE_TRACKS")); } st.published = tr; return Promise.resolve(); }, unpublish: () => Promise.resolve(),
                subscribe: () => Promise.resolve(), renewToken: () => Promise.resolve(), leave: () => Promise.resolve(),
                enableAudioVolumeIndicator() {}
            };
        },
        createMicrophoneAudioTrack: () => micTrack(),
        setLogLevel() {}, disableLogUpload() {}
    };
})();
