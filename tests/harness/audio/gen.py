# يولّد ملفات المايك الوهمي للاختبار (Chromium --use-file-for-fake-audio-capture) من مقطع كلام قصير وموسيقى البث.
# الاستخدام: python3 tests/harness/audio/gen.py  (يحتاج ffmpeg و numpy)
import numpy as np, wave, subprocess, os
D = os.path.dirname(os.path.abspath(__file__)); R = 48000; N = 32 * R
def rd(p):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", p, "-f", "s16le", "-ar", str(R), "-ac", "1", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768
def wr(name, x):
    w = wave.open(os.path.join(D, name), "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(R)
    w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
sp = rd(os.path.join(D, "speech_clip.wav"))
noise = np.random.default_rng(1).normal(0, 0.0015, N).astype(np.float32)
cyc = np.zeros(N, np.float32)
for k in range(0, 32, 4): cyc[k * R:k * R + len(sp)] += sp      # كلام 1.15 ث كل 4 ث
m = rd(os.path.join(D, "..", "..", "..", "audio", "think2.mp3")); m = np.tile(m, N // len(m) + 1)[:N]; m = m / np.max(np.abs(m)) * 0.12
wr("speech.wav", cyc + noise)
lng = np.zeros(N, np.float32); two = np.concatenate([sp, np.zeros(int(0.1 * R), np.float32), sp])
for k in range(0, 30, 6): lng[k * R:k * R + len(two)] += two  # جواب طويل 2.4 ث كل 6 ث (للنص المباشر)
wr("speech_long.wav", lng + noise)
wr("speech_music.wav", cyc + m + noise)
wr("silence.wav", noise)
wr("music_only.wav", m + noise)
# مايك جوال حقيقي (بعد تجربة 21 أكتوبر): نطاق الهاتف 300-3400 هرتز وصوت أوطى، مرة لحاله ومرة مع موسيقى
def phone(x, gain):
    raw = (np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes()
    out = subprocess.run(["ffmpeg", "-loglevel", "error", "-f", "s16le", "-ar", str(R), "-ac", "1", "-i", "-", "-af", "highpass=f=300,lowpass=f=3400,volume=%s" % gain, "-f", "s16le", "-"], input=raw, capture_output=True, check=True).stdout
    return np.frombuffer(out, np.int16).astype(np.float32) / 32768
wr("phone.wav", phone(cyc + noise, 0.6))
wr("phone_quiet.wav", phone(cyc + noise, 0.25))
wr("phone_music.wav", phone(cyc + m * 0.5 + noise, 0.6))
wr("phone_music_only.wav", phone(m * 0.5 + noise, 0.6))
# تجربة 21 أكتوبر الثانية (أندرويد 10): أعلى إطار 0.024 والضجة شبه صفر (كبت الضجة في الجوال يصفّرها)
def at_peak(x, target):
    f = 960; fr = x[:len(x) // f * f].reshape(-1, f); mx = np.sqrt((fr ** 2).mean(1)).max()
    return x * (target / mx)
quiet_noise = np.random.default_rng(2).normal(0, 0.0001, N).astype(np.float32)
wr("phone_soft.wav", at_peak(phone(cyc, 1.0), 0.024) + quiet_noise)
wr("phone_soft_music.wav", at_peak(phone(cyc + m * 0.15, 1.0), 0.03) + quiet_noise)
# نفس الجوال بس الكلام مقطّع (إلغاء الصدى في الجوال يكتم المايك 60ms كل 140ms لما فيه صوت ثاني يطلع من السماعة)
gate = (np.arange(N) % int(0.14 * R) < int(0.08 * R)).astype(np.float32)
wr("phone_choppy.wav", at_peak(phone(cyc, 1.0) * gate, 0.024) + quiet_noise)
# جواب فيه سكتة نص ثانية بالنص (كلمتين): التسجيل كان يوقف بعد 0.55 ث ويقطع الكلمة الثانية
gp = np.zeros(N, np.float32); two_gap = np.concatenate([sp, np.zeros(int(0.5 * R), np.float32), sp])
for k in range(0, 30, 6): gp[k * R:k * R + len(two_gap)] += two_gap
wr("speech_gap.wav", gp + noise)
print("ok")
