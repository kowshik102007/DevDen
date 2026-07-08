// ============================================================
// contact.js — Contact page form handling
// ============================================================

import { db } from "./firebase.js";

import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { logout } from "./auth.js";
import {
  showToast,
  showSpinner,
  hideSpinner
} from "./ui.js";


// ─────────────────────────────────────────────────────────────
// Mobile Menu Toggle
// ─────────────────────────────────────────────────────────────
document
  .getElementById("mobileMenuBtn")
  ?.addEventListener("click", () => {
    document
      .getElementById("mobileMenu")
      ?.classList.toggle("hidden");
  });


// ─────────────────────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────────────────────
document
  .getElementById("logoutBtn")
  ?.addEventListener("click", logout);


// ─────────────────────────────────────────────────────────────
// Contact Form Submit
// ─────────────────────────────────────────────────────────────
document
  .getElementById("sendMessageBtn")
  ?.addEventListener("click", async () => {

    const name = document
      .getElementById("contactName")
      ?.value.trim();

    const email = document
      .getElementById("contactEmail")
      ?.value.trim();

    const subject = document
      .getElementById("contactSubject")
      ?.value.trim();

    const message = document
      .getElementById("contactMessage")
      ?.value.trim();


    // ── Validation ───────────────────────────
    if (!name || !email || !subject || !message) {
      showToast(
        "Please fill in all fields.",
        "error"
      );
      return;
    }

    // Basic email validation
    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      showToast(
        "Please enter a valid email.",
        "error"
      );
      return;
    }

    // Prevent empty spam
    if (message.length < 10) {
      showToast(
        "Message is too short.",
        "error"
      );
      return;
    }


    // ── Save to Firebase ─────────────────────
    showSpinner();

    try {

      await addDoc(
        collection(db, "contactMessages"),
        {
          name,
          email,
          subject,
          message,

          createdAt:
            serverTimestamp()
        }
      );

      showToast(
        "Message sent successfully! 🎉",
        "success"
      );


      // Reset form
      document
        .getElementById("contactName")
        .value = "";

      document
        .getElementById("contactEmail")
        .value = "";

      document
        .getElementById("contactSubject")
        .value = "";

      document
        .getElementById("contactMessage")
        .value = "";

    } catch (err) {

      console.error(err);

      showToast(
        "Failed to send message. Please try again.",
        "error"
      );

    } finally {

      hideSpinner();

    }
  });