/* بديل Firebase للاختبار المحلي بس (tests/harness): قاعدة البيانات الحقيقية ما تنلمس.
   كل الأجهزة (الصفحات) تشترك بقاعدة وحدة في run.mjs عن طريق window.__db (exposeBinding)،
   والـ transaction تشتغل مثل Firestore: تقرا بنسخة، والكتابة تنرفض لو أحد غيّر الوثيقة وتنعاد. */
(function () {
    const qs = new URLSearchParams(location.search);
    const AS = qs.get("as") || "";
    const USERS = {
        host: { uid: "u_host", email: "moha1221aaa@gmail.com", displayName: "محمد" },
        p1: { uid: "u_p1", email: "p1@test.local", displayName: "سعد" },
        p2: { uid: "u_p2", email: "p2@test.local", displayName: "فهد" },
        fan: { uid: "u_fan", email: "fan@test.local", displayName: "مشاهد" }
    };
    const SENT = { ts: { __fv: "ts" }, del: { __fv: "del" } };
    const ts = n => ({ __ts: n, toMillis() { return n; }, toDate() { return new Date(n); } });
    function revive(v) {
        if (Array.isArray(v)) return v.map(revive);
        if (v && typeof v === "object") {
            if (typeof v.__ts === "number") return ts(v.__ts);
            const o = {}; for (const k in v) o[k] = revive(v[k]); return o;
        }
        return v;
    }
    function plain(v) {
        if (v === SENT.ts || v === SENT.del) return v === SENT.ts ? { __fv: "ts" } : { __fv: "del" };
        if (Array.isArray(v)) return v.map(plain);
        if (v && typeof v === "object") {
            if (typeof v.__ts === "number") return { __ts: v.__ts };
            const o = {}; for (const k in v) if (v[k] !== undefined) o[k] = plain(v[k]); return o;
        }
        return v;
    }
    const db = (op, a) => window.__db(op, a);
    const subs = {}; let subN = 0;
    window.__dbPush = (id, payload) => { const s = subs[id]; if (s) s(payload); };

    function docSnap(path, rec) {
        return { id: path.split("/").pop(), exists: !!rec, ref: docRef(path), data: () => rec ? revive(rec.data) : undefined, get: k => rec ? revive(rec.data)[k] : undefined };
    }
    function docRef(path) {
        return {
            id: path.split("/").pop(), path,
            collection: n => colRef(path + "/" + n),
            get: () => db("get", { path }).then(r => docSnap(path, r)),
            set: (data, opt) => db("set", { path, data: plain(data), merge: !!(opt && opt.merge) }),
            update: (data) => db("update", { path, data: plain(data) }),
            delete: () => db("delete", { path }),
            onSnapshot(cb, err) {
                const id = ++subN; subs[id] = r => cb(docSnap(path, r));
                db("sub", { id, path, kind: "doc" });
                return () => { delete subs[id]; db("unsub", { id }); };
            }
        };
    }
    function colRef(path) {
        const q = {
            id: path.split("/").pop(), path,
            doc: id => docRef(path + "/" + (id || ("auto" + Math.random().toString(36).slice(2, 10)))),
            add: data => { const r = q.doc(); return r.set(data).then(() => r); },
            where: () => q, orderBy: () => q, limit: () => q,
            get: () => db("list", { path }).then(list => qSnap(list)),
            onSnapshot(cb, err) {
                const id = ++subN; subs[id] = list => cb(qSnap(list));
                db("sub", { id, path, kind: "col" });
                return () => { delete subs[id]; db("unsub", { id }); };
            }
        };
        return q;
    }
    function qSnap(list) {
        const docs = list.map(x => docSnap(x.path, x.rec));
        return { docs, size: docs.length, empty: !docs.length, forEach: f => docs.forEach(f), docChanges: () => [] };
    }
    const firestore = {
        collection: n => colRef(n),
        async runTransaction(fn) {
            for (let i = 0; i < 8; i++) {
                const reads = [], writes = [];
                const tx = {
                    get: ref => db("get", { path: ref.path }).then(r => { reads.push({ path: ref.path, ver: r ? r.ver : 0 }); return docSnap(ref.path, r); }),
                    set: (ref, data, opt) => { writes.push({ op: "set", path: ref.path, data: plain(data), merge: !!(opt && opt.merge) }); return tx; },
                    update: (ref, data) => { writes.push({ op: "update", path: ref.path, data: plain(data) }); return tx; },
                    delete: ref => { writes.push({ op: "delete", path: ref.path }); return tx; }
                };
                const out = await fn(tx);
                const ok = await db("commit", { reads, writes });
                if (ok) return out;
            }
            const e = new Error("transaction contention"); e.code = "aborted"; throw e;
        }
    };
    const user = USERS[AS] ? Object.assign({ getIdToken: () => Promise.resolve("test-token-" + AS) }, USERS[AS]) : null;
    const listeners = [];
    const auth = {
        currentUser: user,
        onAuthStateChanged(cb) { listeners.push(cb); setTimeout(() => cb(user), 0); return () => {}; },
        signOut: () => Promise.resolve(),
        signInWithEmailAndPassword: () => Promise.reject(new Error("test")),
        createUserWithEmailAndPassword: () => Promise.reject(new Error("test"))
    };
    window.firebase = {
        apps: [],
        initializeApp() { this.apps.push({}); },
        firestore: Object.assign(() => firestore, { FieldValue: { serverTimestamp: () => SENT.ts, delete: () => SENT.del } }),
        auth: () => auth
    };
})();
