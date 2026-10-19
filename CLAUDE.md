# MASRO7 LEAGUE: تعليمات Claude

التعليمات الكاملة (صاحب المشروع، النشر، القواعد) في CLAUDE.md حق مستودع Feekaro-Web-Studio، والهيكل في README.md هنا.

الفحص الأمني: المرحلة 1 انصلحت (18 أكتوبر 2026): safeSrc للصور، jsArg لـ onclick، tts و ai بتوكن Firebase (lib/firebase-auth.js)، وتوكن استماع للضيف في أجورا. الباقي (الأجوبة في وثيقة البث، room/main و liveMatches مفتوحة للكتابة) خطته في SECURITY-PLAN.md وينتظر موافقة محمد.
- أي قيمة داخل onclick="fn(...)": استخدم jsArg(قيمة). وأي رابط داخل src: safeSrc(رابط). escapeHTML بروحه ما يكفي داخل JS.
- أي دالة سيرفر جديدة تصرف رصيد أو حصة: تحقق بـ verifyFirebaseToken(bearer(request)) والمتصفح يرسل authHeaders().
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
