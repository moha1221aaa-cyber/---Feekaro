/* functions/ai.js task host: جمل الموقف (situ) تنفلتر: {p} لازم موجود (إلا التعادل)، وما فيه أقواس ثانية، وجملتين بالكثير */
import { setupAuth, fakeCaches, ctxFor, check, done } from "./helpers.mjs";
import { onRequestPost } from "../../functions/ai.js";

const auth = await setupAuth(); fakeCaches();
const reply = { open: "أهلاً", intros: ["مواجهة نارية"], close: "ختام", situ: {
    streak: ["{p} نار!", "بدون اسم", "{p} ثالثة زايدة", "{p} مرة ثالثة"],
    comeback: ["{p} {x} غريب", "{p} رجع"],
    tie: ["تعادل!", "{p} تعادل"],
    lead: "مو قائمة",
    hack: ["{p}"]
} };
const env = { AI: { run: async () => ({ response: JSON.stringify(reply) }) } };
const req = new Request("https://masro7-league.pages.dev/ai", { method: "POST", headers: { Origin: "https://masro7-league.pages.dev", "Content-Type": "application/json", Authorization: "Bearer " + await auth.token("u1") },
    body: JSON.stringify({ task: "host", round: 3, matches: [{ p1: "سعد", p2: "فهد" }] }) });
const j = await (await onRequestPost(ctxFor(req, env))).json();
check("streak filtered (needs {p}, max 2)", JSON.stringify(j.situ.streak) === JSON.stringify(["{p} نار!", "{p} ثالثة زايدة"]), j.situ);
check("comeback drops other braces", JSON.stringify(j.situ.comeback) === JSON.stringify(["{p} رجع"]), j.situ);
check("tie has no name", JSON.stringify(j.situ.tie) === JSON.stringify(["تعادل!"]), j.situ);
check("bad/unknown keys dropped", !j.situ.lead && !j.situ.hack, j.situ);
check("open/intros/close kept", j.open === "أهلاً" && j.intros[0] === "مواجهة نارية" && j.close === "ختام");
auth.restore(); done();
