/* بديل أجورا للاختبار المحلي: المايك من getUserMedia (في Chromium يكون المايك الوهمي --use-file-for-fake-audio-capture)،
   والقناة ما تتصل بأي مكان. setMuted مثل أجورا: التتبع يظل موجود بس يطلع سكوت. */
(function () {
    function micTrack() {
        return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(stream => {
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
            return {
                remoteUsers: [],
                on: (e, f) => { h[e] = f; },
                join: (app, ch, tok, uid) => Promise.resolve(uid || Math.floor(Math.random() * 1e6)),
                publish: () => Promise.resolve(), unpublish: () => Promise.resolve(),
                subscribe: () => Promise.resolve(), renewToken: () => Promise.resolve(), leave: () => Promise.resolve(),
                enableAudioVolumeIndicator() {}
            };
        },
        createMicrophoneAudioTrack: () => micTrack(),
        setLogLevel() {}, disableLogUpload() {}
    };
})();
