/* functions/qbank.js: الأسئلة الصعبة بأجوبتها للمنظم بس (فحص 25 أكتوبر، البند 19)، والملف العام القديم انشال */
import fs from "node:fs";
import { setupAuth, runFn, check, done } from "./helpers.mjs";
import { onRequestGet } from "../../functions/qbank.js";
import HARD from "../../lib/qbank-hard.js";

const auth = await setupAuth();
const get = tok => runFn(onRequestGet, new Request("https://masro7-league.pages.dev/qbank", { headers: tok ? { Authorization: "Bearer " + tok } : {} }), {});
check("guest refused (401)", (await get()).status === 401);
check("fake token refused (401)", (await get("a.b.c")).status === 401);
check("player refused (403)", (await get(await auth.token("u_p1", "p1@t"))).status === 403);
const r = await get(await auth.token("u_admin", "moha1221aaa@gmail.com"));
const j = await r.json();
check("organizer gets all the hard questions with answers", r.status === 200 && Array.isArray(j) && j.length === HARD.length && j.length >= 50 && j.every(q => q.text && q.answer), j.length);
check("not cached", /no-store/.test(r.headers.get("Cache-Control") || ""));
check("old public file is gone", !fs.existsSync(new URL("../../js/broadcast/qbank-hard.json", import.meta.url)));
auth.restore();
done();
