/* ==========================================================================
   VeganSaathi — submit-place-guard.js
   ============================================================================
   Phase 4 scope for this page: require sign-in before the (still Phase 2
   demo-only — real Firestore writes are Phase 6) submission can go through.
   Browsing/filling the form stays open to everyone; only the actual submit
   is gated, consistent with "browsing is always open, contribution always
   requires login" elsewhere in this app.

   This replaces the old wireSubmitPlaceForm() that used to live in
   auth-ui.js — that file is now purely about login/register/password-reset/
   Google sign-in, so this page-specific concern gets its own small module
   rather than growing auth-ui.js past what its name promises.
   ========================================================================== */

import { onAuthChange, getCurrentUser } from "./auth-state.js";

function showFormNote(elId, message, isError) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = message;
  el.classList.remove("d-none");
  if (isError) {
    el.style.backgroundColor = "#fbeaea";
    el.style.borderColor = "#f0c3c3";
    el.style.color = "#8a2f2f";
  } else {
    el.style.backgroundColor = "";
    el.style.borderColor = "";
    el.style.color = "";
  }
}

function updateGuardUI(user) {
  const btn = document.getElementById("submitPlaceBtn");
  const note = document.getElementById("submitPlaceAuthNote");
  if (!btn || !note) return;

  const signedIn = !!user;
  btn.disabled = !signedIn;
  btn.title = signedIn ? "" : "Sign in to submit a place";
  note.classList.toggle("d-none", signedIn);
}

function wireSubmitPlaceForm() {
  const form = document.getElementById("submitPlaceForm");
  if (!form) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    // Re-check at submit time, not just at page load — someone could log
    // out in another tab and come back to this one.
    if (!getCurrentUser()) {
      showFormNote("submitPlaceFeedback", "Please sign in to submit a place.", true);
      return;
    }

    const name = document.getElementById("spName").value.trim();
    const type = document.getElementById("spType").value;
    const address = document.getElementById("spAddress").value.trim();
    const dietChecks = document.querySelectorAll('input[name="spDiet"]:checked');

    if (!name || !type || !address || dietChecks.length === 0) {
      showFormNote(
        "submitPlaceFeedback",
        "Please fill in the place name, type, address, and select at least one dietary category.",
        true
      );
      return;
    }

    showFormNote(
      "submitPlaceFeedback",
      "Demo: this submission workflow will be connected to Firestore in a later phase (Phase 6). New places will go to a pending queue for admin review before appearing publicly — nothing was saved yet.",
      false
    );
    form.reset();
  });
}

document.addEventListener("DOMContentLoaded", function () {
  wireSubmitPlaceForm();
  onAuthChange(updateGuardUI);
});
