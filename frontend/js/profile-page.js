/* ==========================================================================
   VeganSaathi — profile-page.js
   ============================================================================
   Loads the signed-in user's real users/{uid} Firestore document and renders
   it on profile.html — no more mock data. Firestore rules only allow a user
   to read their own profile doc (or an admin to read any), so this will
   only ever succeed for the signed-in visitor's own uid.
   ========================================================================== */

import { onAuthChange, fetchUserProfile } from "./auth-state.js";

function show(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("d-none");
}
function hide(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("d-none");
}

function renderProfile(user, profile) {
  document.getElementById("profileName").textContent = profile.name || "(no name on file)";
  document.getElementById("profileEmail").textContent = profile.email || user.email || "";
  document.getElementById("profileDiet").innerHTML = renderDietBadges([profile.dietPreference || "unspecified"]);

  const createdAt = profile.createdAt && typeof profile.createdAt.toDate === "function"
    ? profile.createdAt.toDate().toLocaleDateString()
    : "—";
  document.getElementById("profileSince").textContent = createdAt;

  hide("profileLoading");
  hide("profileSignedOut");
  show("profileContent");
}

function showSignedOut() {
  hide("profileLoading");
  hide("profileContent");
  show("profileSignedOut");
}

function showError(message) {
  hide("profileLoading");
  const el = document.getElementById("profileError");
  if (el) {
    el.textContent = message;
    el.classList.remove("d-none");
  }
}

function hideError() {
  const el = document.getElementById("profileError");
  if (el) {
    el.classList.add("d-none");
    el.textContent = "";
  }
}

document.addEventListener("DOMContentLoaded", function () {
  onAuthChange(async function (user) {
    // Every state transition — signing out, signing back in, a fresh load —
    // starts clean: clear any error left over from a previous attempt
    // before deciding what to show next.
    hideError();

    if (!user) {
      showSignedOut();
      return;
    }

    try {
      const profile = await fetchUserProfile(user.uid);
      if (!profile) {
        // A signed-in Firebase Auth user with no Firestore profile doc is an
        // inconsistent state (registration should always create one) —
        // surface it plainly rather than silently showing blank fields.
        showError("Your account exists, but no profile information was found. Please contact the project team.");
        return;
      }
      renderProfile(user, profile);
    } catch (error) {
      console.error("VeganSaathi: failed to load profile.", error);
      showError("Something went wrong loading your profile. Please try again.");
    }
  });
});
