/* ==========================================================================
   VeganSaathi — profile-page.js
   ============================================================================
   Loads the signed-in user's real users/{uid} Firestore document and renders
   it on profile.html — no more mock data. Firestore rules only allow a user
   to read their own profile doc (or an admin to read any), so this will
   only ever succeed for the signed-in visitor's own uid.
   ========================================================================== */

import { onAuthChange, fetchUserProfile } from "./auth-state.js";
import { fetchUserSubmissions, fetchUserReviews } from "./places-service.js";

function show(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("d-none");
}
function hide(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("d-none");
}

async function renderProfile(user, profile) {
  document.getElementById("profileName").textContent = profile.name || "(no name on file)";
  document.getElementById("profileEmail").textContent = profile.email || user.email || "";
  document.getElementById("profileDiet").innerHTML = renderDietBadges([profile.dietPreference || "unspecified"]);

  const createdAt = profile.createdAt && typeof profile.createdAt.toDate === "function"
    ? profile.createdAt.toDate().toLocaleDateString()
    : "—";
  document.getElementById("profileSince").textContent = createdAt;

  // Render user's submissions
  const subEl = document.getElementById("mySubmissionsList");
  if (subEl) {
    try {
      const subRes = await fetchUserSubmissions(user.uid);
      const subs = subRes && subRes.status === "ok" ? subRes.submissions : [];
      if (subs.length === 0) {
        subEl.textContent = "You haven't submitted any places yet.";
      } else {
        subEl.innerHTML = subs.map(function (s) {
          const badgeClass = s.status === "published" ? "bg-success" : (s.status === "pending" ? "bg-warning text-dark" : "bg-secondary");
          return (
            '<div class="d-flex justify-content-between align-items-center border-bottom py-2">' +
            '<div><strong>' + escapeHtml(s.name) + '</strong><br>' +
            '<span class="text-muted-vs" style="font-size:0.8rem;">Submitted ' + escapeHtml(formatDate(s.createdAt)) + '</span></div>' +
            '<span class="badge ' + badgeClass + '">' + escapeHtml(capitalize(s.status)) + '</span>' +
            '</div>'
          );
        }).join("");
      }
    } catch (e) {
      subEl.textContent = "Unable to load submissions right now.";
    }
  }

  // Render user's reviews
  const revEl = document.getElementById("myReviewsList");
  if (revEl) {
    try {
      const revRes = await fetchUserReviews(user.uid);
      const revs = revRes && revRes.status === "ok" ? revRes.reviews : [];
      if (revs.length === 0) {
        revEl.textContent = "You haven't written any reviews yet.";
      } else {
        revEl.innerHTML = revs.map(function (r) {
          const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
          return (
            '<div class="border-bottom py-2">' +
            '<div class="d-flex justify-content-between">' +
            '<span style="color:#b8862f;">' + stars + '</span>' +
            '<span class="text-muted-vs" style="font-size:0.75rem;">' + escapeHtml(formatDate(r.createdAt)) + '</span>' +
            '</div>' +
            '<p class="mb-0 text-muted-vs" style="font-size:0.85rem;">' + escapeHtml(r.comment) + '</p>' +
            '</div>'
          );
        }).join("");
      }
    } catch (e) {
      revEl.textContent = "Unable to load reviews right now.";
    }
  }

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
