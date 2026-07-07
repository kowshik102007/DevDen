// ============================================================
// posts.js — Create, read, update, delete posts + image upload
// ============================================================
import { db, storage } from "./firebase.js";
import {
  collection, addDoc, getDocs, getDoc, doc,
  updateDoc, deleteDoc, query, where, orderBy,
  serverTimestamp, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  ref, uploadBytesResumable, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { showToast, showSpinner, hideSpinner } from "./ui.js";

const COLLECTIONS = { lost: "lostItems", found: "foundItems" };

// ── Upload image to Firebase Storage ─────────────────────────
export async function uploadImage(file, userId, onProgress) {
  const ext  = file.name.split(".").pop();
  const path = `items/${userId}/${Date.now()}.${ext}`;
  const storageRef = ref(storage, path);
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file);
    task.on("state_changed",
      snap => { if (onProgress) onProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)); },
      reject,
      async () => { resolve({ url: await getDownloadURL(task.snapshot.ref), path }); }
    );
  });
}

// ── Create a new post ─────────────────────────────────────────
export async function createPost(type, data, imageFile, userId, onProgress) {
  showSpinner();
  try {
    let imageUrl = "", imagePath = "";
    if (imageFile) {
      const result = await uploadImage(imageFile, userId, onProgress);
      imageUrl  = result.url;
      imagePath = result.path;
    }
    const colName = COLLECTIONS[type];
    const docRef  = await addDoc(collection(db, colName), {
      ...data,
      imageUrl,
      imagePath,
      userId,
      status:    "open",
      createdAt: serverTimestamp(),
    });
    showToast("Post created successfully! 🎉", "success");
    return docRef.id;
  } catch (err) {
    console.error(err);
    showToast("Failed to create post. Please try again.", "error");
    return null;
  } finally {
    hideSpinner();
  }
}

// ── Fetch all posts from a collection ────────────────────────
export async function fetchPosts(type, filters = {}) {
  const colName = COLLECTIONS[type];
  let q = collection(db, colName);
  const constraints = [orderBy("createdAt", "desc")];
  if (filters.category && filters.category !== "all") {
    constraints.unshift(where("category", "==", filters.category));
  }
  if (filters.status && filters.status !== "all") {
    constraints.unshift(where("status", "==", filters.status));
  }
  if (filters.userId) {
    constraints.unshift(where("userId", "==", filters.userId));
  }
  if (filters.limit) constraints.push(limit(filters.limit));
  q = query(q, ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Fetch single post ─────────────────────────────────────────
export async function fetchPost(type, id) {
  const colName = COLLECTIONS[type];
  const snap    = await getDoc(doc(db, colName, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ── Update post status ────────────────────────────────────────
export async function updatePostStatus(type, id, status) {
  await updateDoc(doc(db, COLLECTIONS[type], id), { status });
  showToast(`Status updated to "${status}".`, "success");
}

// ── Update full post ──────────────────────────────────────────
export async function updatePost(type, id, data) {
  showSpinner();
  try {
    await updateDoc(doc(db, COLLECTIONS[type], id), { ...data, updatedAt: serverTimestamp() });
    showToast("Post updated successfully.", "success");
    return true;
  } catch (err) {
    showToast("Failed to update post.", "error");
    return false;
  } finally {
    hideSpinner();
  }
}

// ── Delete post (+ image) ─────────────────────────────────────
export async function deletePost(type, id, imagePath) {
  showSpinner();
  try {
    if (imagePath) {
      try { await deleteObject(ref(storage, imagePath)); } catch (_) {}
    }
    await deleteDoc(doc(db, COLLECTIONS[type], id));
    showToast("Post deleted.", "info");
    return true;
  } catch (err) {
    showToast("Failed to delete post.", "error");
    return false;
  } finally {
    hideSpinner();
  }
}

// ── Fetch recent posts for homepage ──────────────────────────
export async function fetchRecentPosts(type, count = 6) {
  return fetchPosts(type, { limit: count });
}
