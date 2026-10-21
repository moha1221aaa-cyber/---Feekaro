# فيديوهات بث الدوري (Remotion)

- `Opening`: افتتاح البث (5 ث، 1080×1920): أشرطة ألوان الدوري، الشعار، "دوري بنو مسروح للنخبة"، وبعدها "بث مباشر".
- `Bumper`: الفاصل بين المواجهات (2.2 ث): نفس الأشرطة والشعار، والنص الحي (رقم المواجهة ونتايج الجولة) يطلع فوقه من `js/broadcast/tv.js`.

الفيديوهات صامتة وبدون مسار صوت (البث ما يطلع أي صوت من المتصفح). الملفات في `media/` (mp4 للآيفون و webm للمتصفحات اللي ما فيها H.264)، والبث يرجع للمشهد المرسوم لو الفيديو ما اشتغل.

```bash
cd video && npm ci && cp ../logo.png public/logo.png
npx remotion studio                      # معاينة
npx remotion render Opening ../media/opening.mp4 --muted --crf 30
npx remotion render Opening ../media/opening.webm --codec vp8 --muted
```

الريندر التلقائي: `.github/workflows/league-video.yml` (يدوي أو مع أي تغيير في `video/src`) ويحط الملفات في `media/`.
