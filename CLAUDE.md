# MASRO7 LEAGUE: تعليمات Claude

التعليمات الكاملة (صاحب المشروع، النشر، القواعد) في CLAUDE.md حق مستودع Feekaro-Web-Studio، والهيكل في README.md هنا.

الفحص الأمني: المرحلة 1 انصلحت (18 أكتوبر 2026): safeSrc للصور، jsArg لـ onclick، tts و ai بتوكن Firebase (lib/firebase-auth.js)، وتوكن استماع للضيف في أجورا. الباقي (الأجوبة في وثيقة البث، room/main و liveMatches مفتوحة للكتابة) خطته في SECURITY-PLAN.md.
- أي قيمة داخل onclick="fn(...)": استخدم jsArg(قيمة). وأي رابط داخل src: safeSrc(رابط). escapeHTML بروحه ما يكفي داخل JS.
- أي دالة سيرفر جديدة تصرف رصيد أو حصة: تحقق بـ verifyFirebaseToken(bearer(request)) والمتصفح يرسل authHeaders().
- **قواعد Firestore (19 أكتوبر 2026):** في firestore.rules هنا، وتنتشر من league-rules.yml (mode=deploy، و mode=read يقرا الحالية) بسر MASRO7_FIREBASE_SA في Feekaro-Web-Studio. league و videos للمنظم، users لصاحبه، predictions لصاحبها (userId والمعرّف uid_...)، room/** مفتوحة للحين، والمجموعات القديمة للمنظم. أي كتابة جديدة في كود الموقع لازم يكون لها مكان في القواعد، وإلا ترجع permission-denied. نتيجة البث تنكتب في league من جهاز المنظم بس. للرجوع: firestore.rules.before-2026-10-19.
- فحص شامل (19 أكتوبر 2026) في AUDIT.md: انصلح الأداء والوصول و SEO و sw.js و safeSrc لصور البث، وانضافت بطاقة النتيجة وملف المتسابق والأوسمة واستيراد CSV وملخص البث. الأمن الباقي: الغرفة والبث (room/main و liveMatches) للحين مفتوحة للكتابة، والأجوبة في وثيقة البث.
- **الجواب بالصوت (19 أكتوبر 2026):** بعد الجرس، js/broadcast/voice-answer.js يسجّل من مايك البث (bcTrack.getMediaStreamTrack، ما يفتح مايك ثاني) ويوقف لحاله لما يسكت المتسابق 0.8 ث (بدون أي أزرار)، وأول جواب هو اللي ينحسب (التغيير ما ينقبل)، ويرسل WAV 16k لـ /ai task voice: Whisper (whisper-large-v3-turbo، ar، ونص السؤال initial_prompt) ← خطوة تطلّع أول جواب بدون الإجابة الصحيحة ← مطابقة عادية (answerMatches نسخة liveAnswerMatches) ولو ما طابقت taskGrade بـ voice:true (يقبل غلط سمع بحرف). الوقت يتمدد 10 ث وقت التحقق. لو فشل أي شي يطلع مربع الكتابة. التجربة الحية: league-voice-test.yml في Feekaro-Web-Studio (فرع league-voice-test).
- التجربة المحلية بالبيانات الحقيقية مشروحة آخر README.md (Firebase من npm بدل gstatic).
- الهيدر (19 أكتوبر 2026): في الصفحات غير الرئيسية ينضاف كلاس hdr-compact (showTab في league.js) يعطي العنوان مسافة عن الجرس. الجرس يسار وزر تثبيت التطبيق يمين، لا تحطهم بنفس المكان.
## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.

## Remotion (فيديو)
سكلات Remotion الرسمية (remotion-dev/skills، نسخة 4.0.536) في .claude/skills/remotion-*. أي فيديو للدوري ابدأ بـ remotion-best-practices، والريندر عبر GitHub Actions لو التحميل هنا انحجب. كود الفيديو يكون في مجلد video/ منفصل عن الموقع.
