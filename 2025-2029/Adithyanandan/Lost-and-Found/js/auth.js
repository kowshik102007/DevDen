// ============================================================
// auth.js — Authentication helpers
// ============================================================
import { auth } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { showToast, showSpinner, hideSpinner } from "./ui.js";

// ── Sign Up ───────────────────────────────────────────────────
export async function signUp(name, email, password) {
  showSpinner();
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    showToast("Account created! Welcome aboard 🎉", "success");
    return cred.user;
  } catch (err) {
    showToast(friendlyError(err.code), "error");
    return null;
  } finally {
    hideSpinner();
  }
}

// ── Login ─────────────────────────────────────────────────────
export async function login(email, password) {
  showSpinner();
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    showToast(`Welcome back, ${cred.user.displayName || "User"}!`, "success");
    return cred.user;
  } catch (err) {
    showToast(friendlyError(err.code), "error");
    return null;
  } finally {
    hideSpinner();
  }
}

// ── Logout ────────────────────────────────────────────────────
export async function logout() {
  await signOut(auth);
  showToast("Logged out successfully.", "info");
  window.location.href = "login.html";
}

// ── Reset Password ────────────────────────────────────────────
export async function resetPassword(email) {
  showSpinner();
  try {
    await sendPasswordResetEmail(auth, email);
    showToast("Password reset email sent! Please check your inbox.", "success");
    return true;
  } catch (err) {
    showToast(friendlyError(err.code), "error");
    return false;
  } finally {
    hideSpinner();
  }
}

// ── Session Watcher ───────────────────────────────────────────
export function watchAuth(onUser, onGuest) {
  onAuthStateChanged(auth, (user) => {
    if (user) onUser(user);
    else if (onGuest) onGuest();
  });
}

// ── Require Auth (redirect if not logged in) ─────────────────
export function requireAuth() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (!user) {
        window.location.href = "login.html";
      } else {
        resolve(user);
      }
    });
  });
}

// ── Human-readable error messages ─────────────────────────────
function friendlyError(code) {
  const map = {
    "auth/email-already-in-use":  "This email is already registered.",
    "auth/invalid-email":         "Please enter a valid email address.",
    "auth/weak-password":         "Password must be at least 6 characters.",
    "auth/user-not-found":        "No account found with this email.",
    "auth/wrong-password":        "Incorrect password. Please try again.",
    "auth/too-many-requests":     "Too many attempts. Try again later.",
    "auth/network-request-failed":"Network error. Check your connection.",
  };
  return map[code] || "Something went wrong. Please try again.";
}
