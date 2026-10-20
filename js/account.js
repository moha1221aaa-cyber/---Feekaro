/* الحساب: الصفحة، الإعدادات، الصورة، الدخول والتسجيل، ربط المتسابق بحساب */
function listenToUserProfileDoc(uid) {
if(!firebaseDB) return;
if(userProfileDocListener) userProfileDocListener();

userProfileDocListener = firebaseDB.collection("users").doc(uid).onSnapshot(doc => {
if(doc.exists) {
currentUserDocData = thumbUser(doc.data());
} else {
currentUserDocData = { name: currentUser.displayName || "مستخدم جديد", email: currentUser.email };
}
renderFullAccountPage();
});
}

function renderFullAccountPage() {
let container = document.getElementById("fullAccountView");
if(!container) return;

if(!currentUser) {
container.innerHTML = `
<div class="account-box">
<h3><svg class="ic" aria-hidden="true"><use href="#i-lock"/></svg> تسجيل الدخول / إنشاء حساب</h3>
<input type="email" id="loginEmail" placeholder="البريد الإلكتروني">
<input type="password" id="loginPassword" placeholder="كلمة المرور">
<input type="text" id="registerName" placeholder="الاسم الكامل (عند التسجيل لأول مرة)">
<div class="account-buttons">
<button onclick="handleLogin()">تسجيل الدخول</button>
<button onclick="handleRegister()" style="background:#059669;">إنشاء حساب جديد</button>
</div>
</div>
`;
return;
}

let name = (currentUserDocData && currentUserDocData.name) ? currentUserDocData.name : (currentUser.displayName || "مستخدم");
let email = currentUser.email || "";
let photoURL = (currentUserDocData && currentUserDocData.photoURL) ? currentUserDocData.photoURL : "";
let avatarSrc = photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name.charAt(0))}&background=2563eb&color=fff&bold=true`;

let predStats = getUserPredictionStats(currentUser.uid, email);

container.innerHTML = `
<div class="profile-full-page">
<div class="profile-header-card">
<button class="settings-gear-btn" onclick="openSettingsModal()" title="الإعدادات"><svg class="ic" aria-hidden="true"><use href="#i-settings"/></svg></button>
<div class="profile-avatar-wrapper" onclick="triggerProfilePhotoUpload()">
<div class="profile-avatar-large">
<img loading="lazy" decoding="async" src="${safeSrc(avatarSrc)}" alt="">
</div>
<button class="upload-photo-btn" title="تغيير الصورة"><svg class="ic" aria-hidden="true"><use href="#i-camera"/></svg></button>
</div>
<div class="profile-name-container">
<div class="profile-name-text">${escapeHTML(name)}</div>
<button class="edit-name-btn" onclick="promptChangeName()" title="تعديل الاسم"><svg class="ic" aria-hidden="true"><use href="#i-pencil"/></svg></button>
</div>
<div class="profile-email-text">${escapeHTML(email)}</div>
</div>

<div class="stats-grid-box">
<div class="stat-box-item">
<div class="stat-box-value" style="color:#facc15;">#${predStats.rank}</div>
<div class="stat-box-label">ترتيب التوقعات</div>
</div>
<div class="stat-box-item">
<div class="stat-box-value" style="color:#60a5fa;">${predStats.points}</div>
<div class="stat-box-label">مجموع النقاط</div>
</div>
<div class="stat-box-item">
<div class="stat-box-value" style="color:#4ade80;">${predStats.exact}</div>
<div class="stat-box-label">توقع دقيق (5 ن)</div>
</div>
<div class="stat-box-item">
<div class="stat-box-value" style="color:#38bdf8;">${predStats.correct}</div>
<div class="stat-box-label">نتيجة صحيحة (3 ن)</div>
</div>
</div>
</div>
`;
}

function openSettingsModal() {
let body = document.getElementById("settingsModalBody");
if(!body) return;

let photoURL = (currentUserDocData && currentUserDocData.photoURL) ? currentUserDocData.photoURL : "";

body.innerHTML = `
<div style="text-align:right;">
<h4 style="color:#60a5fa; margin-top:0;">إعدادات الحساب الشخصي</h4>
<button onclick="promptChangeName()" style="width:100%; margin:8px 0; background:#334155;"><svg class="ic" aria-hidden="true"><use href="#i-pencil"/></svg> تعديل الاسم الشخصي</button>
<button onclick="triggerProfilePhotoUpload()" style="width:100%; margin:8px 0; background:#334155;"><svg class="ic" aria-hidden="true"><use href="#i-camera"/></svg> تغيير الصورة الشخصية</button>
${photoURL ? `<button onclick="removeProfilePhoto()" style="width:100%; margin:8px 0; background:#7f1d1d; color:#fca5a5;"><svg class="ic" aria-hidden="true"><use href="#i-trash"/></svg> حذف الصورة الشخصية</button>` : ''}
<hr style="border-color:#334155; margin:15px 0;">
<button onclick="handleLogout()" class="logout-button" style="width:100%;"><svg class="ic" aria-hidden="true"><use href="#i-logout"/></svg> تسجيل الخروج</button>
</div>
`;

openModal("settingsModal");
}

function promptChangeName() {
if(!currentUser) return;
let currentName = (currentUserDocData && currentUserDocData.name) ? currentUserDocData.name : (currentUser.displayName || "");
let newName = prompt("أدخل الاسم الجديد:", currentName);

if(newName && newName.trim() && newName.trim() !== currentName) {
newName = newName.trim();
firebaseDB.collection("users").doc(currentUser.uid).set({
name: newName,
updatedAt: firebase.firestore.FieldValue.serverTimestamp()
}, { merge: true })
.then(() => {
alert("تم تحديث الاسم بنجاح");
closeAllModalsDirectly();
})
.catch(err => alert("حدث خطأ أثناء تعديل الاسم: " + err.message));
}
}

function triggerProfilePhotoUpload() {
let input = document.getElementById("userAvatarFileInput");
if(input) input.click();
}

function handleProfilePhotoUpload(event) {
let file = event.target.files[0];
if(!file || !currentUser) return;

let formData = new FormData();
formData.append('file', file);
formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

document.getElementById("firebaseStatus").style.display = "block";
document.getElementById("firebaseStatus").textContent = "جاري رفع الصورة الشخصية...";

fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
method: 'POST',
body: formData
})
.then(res => res.json())
.then(data => {
document.getElementById("firebaseStatus").style.display = "none";
if(data.secure_url) {
return firebaseDB.collection("users").doc(currentUser.uid).set({
photoURL: data.secure_url,
updatedAt: firebase.firestore.FieldValue.serverTimestamp()
}, { merge: true });
} else {
throw new Error("فشل رفع الصورة إلى Cloudinary");
}
})
.then(() => {
alert("تم رفع وتغيير الصورة الشخصية بنجاح");
closeAllModalsDirectly();
})
.catch(err => {
document.getElementById("firebaseStatus").style.display = "none";
alert("خطأ أثناء رفع الصورة: " + err.message);
});
}

function removeProfilePhoto() {
if(!currentUser) return;
if(!confirm("هل أنت متأكد من حذف صورتك الشخصية؟")) return;

firebaseDB.collection("users").doc(currentUser.uid).update({
photoURL: firebase.firestore.FieldValue.delete()
})
.then(() => {
alert("تم حذف الصورة الشخصية بنجاح");
closeAllModalsDirectly();
})
.catch(err => alert("خطأ أثناء الحذف: " + err.message));
}

function handleLogin() {
let email = document.getElementById("loginEmail").value.trim();
let pass = document.getElementById("loginPassword").value;

if(!email || !pass) return alert("يرجى ملء البريد وكلمة المرور");

firebaseAuth.signInWithEmailAndPassword(email, pass)
.then(() => alert("تم تسجيل الدخول بنجاح!"))
.catch(err => alert("خطأ في تسجيل الدخول: " + authErrAr(err)));
}

function handleRegister() {
let email = document.getElementById("loginEmail").value.trim();
let pass = document.getElementById("loginPassword").value;
let name = document.getElementById("registerName").value.trim();

if(!email || !pass || !name) return alert("يرجى كتابة البريد وكلمة المرور والاسم الكامل");

firebaseAuth.createUserWithEmailAndPassword(email, pass)
.then(res => {
return firebaseDB.collection("users").doc(res.user.uid).set({
name: name,
email: email,
createdAt: firebase.firestore.FieldValue.serverTimestamp()
});
})
.then(() => alert("تم إنشاء الحساب بنجاح!"))
.catch(err => alert("خطأ في إنشاء الحساب: " + authErrAr(err)));
}

function handleLogout() {
firebaseAuth.signOut().then(() => {
alert("تم تسجيل الخروج بنجاح");
closeAllModalsDirectly();
});
}

function openLinkPlayerModal(playerName) {
let body = document.getElementById("linkPlayerModalBody");
if(!body) return;

let usersList = Object.keys(cachedUsersData).map(uid => ({
uid: uid,
name: cachedUsersData[uid].name || cachedUsersData[uid].displayName || "مستخدم",
email: cachedUsersData[uid].email || ""
}));

let optionsHTML = `<option value="">-- إزالة الربط / بدون ربط --</option>`;
let currentLinkedUid = playerLinks[playerName] || "";

usersList.forEach(u => {
let selected = (u.uid === currentLinkedUid) ? "selected" : "";
optionsHTML += `<option value="${u.uid}" ${selected}>${escapeHTML(u.name)} (${escapeHTML(u.email)})</option>`;
});

body.innerHTML = `
<div style="text-align:right;">
<p style="font-size:13px; color:#94a3b8;">ربط المتسابق <strong>${escapeHTML(playerName)}</strong> بحساب مستخدم مسجل:</p>
<select id="linkUserSelect" style="width:100%; padding:10px; background:#334155; border:1px solid #475569; color:white; border-radius:8px; margin-bottom:12px;">
${optionsHTML}
</select>
<button onclick="savePlayerLink(${jsArg(playerName)})" style="width:100%;"><svg class="ic" aria-hidden="true"><use href="#i-save"/></svg> حفظ الربط</button>
</div>
`;

openModal("linkPlayerModal");
}

function savePlayerLink(playerName) {
let select = document.getElementById("linkUserSelect");
if(!select) return;
let uid = select.value;

if(uid) {
playerLinks[playerName] = uid;
} else {
delete playerLinks[playerName];
}

save();
table();
renderMatches();
alert("تم تحديث ربط المتسابق بنجاح!");
closeAllModalsDirectly();
}
