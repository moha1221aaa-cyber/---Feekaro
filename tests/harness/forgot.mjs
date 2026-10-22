/* نسيت كلمة المرور: الزر يطلع في صفحة الحساب، ويطلب من Firebase إيميل بالعربي فيه رابط التغيير ورابط رجوع للموقع،
   ورسالة واضحة لو ما فيه حساب، ولو رابط الرجوع مرفوض يرسل بدونه. Firebase وهمي: ما يطلع أي إيميل.
   node tests/harness/forgot.mjs */
import { serve, FakeDB, seed, launch, device, until, sleep } from "./harness.mjs";

const srv = await serve(8787);
let ok = true;
const check = (name, v, extra) => { if (!v) ok = false; console.log((v ? "PASS " : "FAIL ") + name + (extra !== undefined ? " " + JSON.stringify(extra) : "")); };
const db = new FakeDB(30);
seed(db, "intro", { status: "ended" });
const browser = await launch({ wav: "silence.wav" });
try {
    const p = await device(browser, db, "guest", { live: "none" });   /* ضيف: بدون تسجيل دخول */
    const alerts = [];
    p.removeAllListeners("dialog");
    p.on("dialog", d => { alerts.push(d.message()); d.type() === "prompt" ? d.accept(p.__prompt || "") : d.accept(); });
    await until(() => p.evaluate(() => typeof renderFullAccountPage === "function" && typeof firebaseAuth !== "undefined" && !!firebaseAuth), 10000);
    await p.evaluate(() => { const t = [...document.querySelectorAll(".tab")].find(x => /الحساب/.test(x.textContent)); t.click(); });
    check("forgot button shown on login box", await until(() => p.$("#forgotPassBtn"), 5000));
    const send = async (email, prompt) => {
        alerts.length = 0; p.__prompt = prompt;
        await p.evaluate(e => { document.getElementById("loginEmail").value = e; window.__resets = []; }, email);
        await p.click("#forgotPassBtn");
        await until(() => alerts.length, 4000);
        await sleep(100);
        return { alerts: alerts.slice(), resets: await p.evaluate(() => window.__resets) };
    };
    let r = await send("player@test.local");
    check("sends reset email in Arabic with return link to the site", r.resets.length === 1 && r.resets[0].email === "player@test.local" && r.resets[0].lang === "ar" && r.resets[0].url === "http://127.0.0.1:8787/", r);
    check("success message names the email and mentions Spam", /player@test\.local/.test(r.alerts[0] || "") && /Spam/.test(r.alerts[0] || ""), r.alerts);
    check("button enabled again", await p.evaluate(() => !document.getElementById("forgotPassBtn").disabled));
    r = await send("", "asked@test.local");
    check("empty email: asks for it, then sends", r.alerts.length >= 2 && /بريدك/.test(r.alerts[0]) && r.resets.length === 1 && r.resets[0].email === "asked@test.local", r);
    r = await send("", "");
    await sleep(300);
    check("prompt cancelled: nothing sent", r.resets.length === 0, r);
    r = await send("nobody@test.local");
    check("no account: clear Arabic message", /ما فيه حساب/.test(r.alerts[0] || "") && /أنشئ حساب جديد/.test(r.alerts[0] || ""), r.alerts);
    r = await send("nodomain@test.local");
    check("return link refused: resends without it and succeeds", r.resets.length === 2 && r.resets[1].url === undefined && /أرسلنا/.test(r.alerts[0] || ""), r);
    const errs = p.__logs.filter(l => /PAGEERROR/.test(l));
    check("no page errors", !errs.length, errs.slice(0, 3));
} catch (e) { ok = false; console.log(e); }
await browser.close();
srv.close();
process.exit(ok ? 0 : 1);
