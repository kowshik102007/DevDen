// ============================================================
// firebase.js — Initialize Firebase and export core services
// ============================================================
// IMPORTANT: Replace the firebaseConfig below with YOUR project's
// config from the Firebase Console (Project Settings > General).
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage }     from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ── YOUR FIREBASE CONFIG ──────────────────────────────────────
const firebaseConfig = {

  apiKey: "AIzaSyDGOJHQbbVpda8ne81XlcnB4fUVz6L0qEw",

  authDomain: "lostandfound-e1407.firebaseapp.com",

  projectId: "lostandfound-e1407",

  storageBucket: "lostandfound-e1407.firebasestorage.app",

  messagingSenderId: "1089863160640",

  appId: "1:1089863160640:web:44b47d151ae56d332c20a5"

};

// ─────────────────────────────────────────────────────────────

const app     = initializeApp(firebaseConfig);
const auth    = getAuth(app);
const db      = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
