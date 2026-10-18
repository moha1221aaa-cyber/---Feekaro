/* التغطيات: رفع الفيديو وعرضه وحذفه */
function toggleVideoUploadForm() {
let form = document.getElementById("videoUploadForm");
if(form) {
form.style.display = (form.style.display === "block") ? "none" : "block";
}
}

function uploadVideoHandler() {
if(!isAdmin) return;
let titleInput = document.getElementById("videoTitleInput");
let fileInput = document.getElementById("videoFileInput");
let progressDiv = document.getElementById("uploadProgressBar");

let title = titleInput.value.trim();
let file = fileInput.files[0];

if(!title) return alert("يرجى كتابة عنوان للفيديو");
if(!file) return alert("يرجى اختيار ملف فيديو للرفع");

let formData = new FormData();
formData.append('file', file);
formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

if(progressDiv) {
progressDiv.style.display = "block";
progressDiv.textContent = "جاري رفع الفيديو عبر Cloudinary...";
}

fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`, {
method: 'POST',
body: formData
})
.then(res => res.json())
.then(data => {
if(data.secure_url) {
return firebaseDB.collection("videos").add({
title: title,
videoUrl: data.secure_url,
createdAt: firebase.firestore.FieldValue.serverTimestamp()
});
} else {
throw new Error("فشل رفع الفيديو");
}
})
.then(() => {
if(progressDiv) progressDiv.style.display = "none";
titleInput.value = "";
fileInput.value = "";
toggleVideoUploadForm();
alert("تم رفع الفيديو بنجاح!");
})
.catch(err => {
if(progressDiv) progressDiv.style.display = "none";
alert("خطأ أثناء رفع الفيديو: " + err.message);
});
}

function listenToVideos() {
if(!firebaseDB) return;
if(videosListener) videosListener();

videosListener = firebaseDB.collection("videos")
.orderBy("createdAt", "desc")
.onSnapshot(snapshot => {
let container = document.getElementById("videosList");
if(!container) return;

if(snapshot.empty) {
container.innerHTML = `<div style="text-align:center; padding:15px; color:#94a3b8; font-size:13px;">لا توجد فيديوهات أو ملخصات مضافة حالياً</div>`;
return;
}

let html = "";
snapshot.forEach(doc => {
let v = doc.data();
let docId = doc.id;
let dateStr = v.createdAt ? new Date(v.createdAt.toDate()).toLocaleDateString('ar-SA') : "";

html += `
<div class="video-card">
<video controls preload="metadata" src="${safeSrc(v.videoUrl)}"></video>
<div class="video-info">
<div class="video-title">${escapeHTML(v.title)}</div>
<div class="video-date">
<span>${dateStr}</span>
${isAdmin ? `<button class="video-delete-btn" onclick="deleteVideo('${docId}')">حذف</button>` : ''}
</div>
</div>
</div>
`;
});

container.innerHTML = html;
});
}

function deleteVideo(docId) {
if(!isAdmin) return;
if(!confirm("هل أنت متأكد من حذف هذا الفيديو؟")) return;

firebaseDB.collection("videos").doc(docId).delete()
.then(() => alert("تم حذف الفيديو بنجاح"))
.catch(err => alert("خطأ أثناء الحذف: " + err.message));
}
