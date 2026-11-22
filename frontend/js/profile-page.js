/* ==========================================================================
   VeganSaathi — profile-page.js
   ============================================================================
   Loads the signed-in user's real users/{uid} Firestore document and renders
   it on profile.html — no more mock data. Firestore rules only allow a user
   to read their own profile doc (or an admin to read any), so this will
   only ever succeed for the signed-in visitor's own uid.
   ========================================================================== */

import { onAuthChange, fetchUserProfile, invalidateUserProfileCache } from "./auth-state.js";
import { fetchUserSubmissions, fetchUserReviews } from "./places-service.js";
import { getFirebaseAuth, getFirebaseDb } from "./firebase-init.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let currentAuthUser = null;
let currentProfileData = null;
let editModalInstance = null;
let selectedAvatarEmoji = "🌱";

function show(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("d-none");
}
function hide(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("d-none");
}

async function renderProfile(user, profile) {
  currentAuthUser = user;
  currentProfileData = profile;

  const displayName = profile.name || user.displayName || "(no name on file)";
  document.getElementById("profileName").textContent = displayName;
  document.getElementById("profileEmail").textContent = profile.email || user.email || "";
  document.getElementById("profileDiet").innerHTML = renderDietBadges([profile.dietPreference || "unspecified"]);

  const headingEl = document.getElementById("profileHeadingName");
  if (headingEl) headingEl.textContent = displayName;

  // Render Avatar: photoURL can be an image URL or an emoji
  const photoUrl = user.photoURL || profile.photoURL || "";
  const avatarImg = document.getElementById("profileAvatarImg");
  const avatarFallback = document.getElementById("profileAvatarFallback");
  if (avatarImg && avatarFallback) {
    if (photoUrl && /^https?:\/\//i.test(photoUrl)) {
      avatarImg.src = photoUrl;
      avatarImg.classList.remove("d-none");
      avatarFallback.classList.add("d-none");
      avatarImg.onerror = function () {
        avatarImg.classList.add("d-none");
        avatarFallback.classList.remove("d-none");
        avatarFallback.textContent = "👤";
      };
    } else if (photoUrl && photoUrl.length <= 4) {
      avatarImg.classList.add("d-none");
      avatarFallback.classList.remove("d-none");
      avatarFallback.textContent = photoUrl;
    } else {
      avatarImg.classList.add("d-none");
      avatarFallback.classList.remove("d-none");
      avatarFallback.textContent = "👤";
    }
  }

  const createdAt = profile.createdAt && typeof profile.createdAt.toDate === "function"
    ? profile.createdAt.toDate().toLocaleDateString()
    : "—";
  document.getElementById("profileSince").textContent = createdAt;

  // Wire Edit Profile Button
  const editBtn = document.getElementById("openEditProfileBtn");
  if (editBtn) {
    editBtn.onclick = function () {
      openEditProfileModal(user, profile);
    };
  }

  // Render user's submissions. A failed query must not look like an empty history.
  const subEl = document.getElementById("mySubmissionsList");
  if (subEl) {
    try {
      const subRes = await fetchUserSubmissions(user.uid);
      if (!subRes || subRes.status !== "ok") {
        subEl.textContent = "Unable to load submissions right now. Please try again.";
      } else if (subRes.submissions.length === 0) {
        subEl.textContent = "You haven't submitted any places yet.";
      } else {
        subEl.innerHTML = subRes.submissions.map(function (s) {
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
      subEl.textContent = "Unable to load submissions right now. Please try again.";
    }
  }

  // Render user's reviews. A failed query must not look like an empty history.
  const revEl = document.getElementById("myReviewsList");
  if (revEl) {
    try {
      const revRes = await fetchUserReviews(user.uid);
      if (!revRes || revRes.status !== "ok") {
        revEl.textContent = "Unable to load reviews right now. Please try again.";
      } else if (revRes.reviews.length === 0) {
        revEl.textContent = "You haven't written any reviews yet.";
      } else {
        revEl.innerHTML = revRes.reviews.map(function (r) {
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
      revEl.textContent = "Unable to load reviews right now. Please try again.";
    }
  }

  hide("profileLoading");
  hide("profileSignedOut");
  show("profileContent");
}

function setupEditProfileModal() {
  const modalEl = document.getElementById("editProfileModal");
  if (!modalEl || typeof bootstrap === "undefined") return;
  editModalInstance = new bootstrap.Modal(modalEl);

  const form = document.getElementById("editProfileForm");
  const photoUrlInput = document.getElementById("editProfilePhotoUrl");
  const avatarImg = document.getElementById("editAvatarPreviewImg");
  const avatarEmoji = document.getElementById("editAvatarPreviewEmoji");
  const alertEl = document.getElementById("editProfileAlert");

  // Wire preset avatar buttons
  document.querySelectorAll(".btn-avatar-preset").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const emoji = btn.getAttribute("data-avatar") || "🌱";
      selectedAvatarEmoji = emoji;
      if (photoUrlInput) photoUrlInput.value = "";
      if (avatarImg) avatarImg.classList.add("d-none");
      if (avatarEmoji) {
        avatarEmoji.textContent = emoji;
        avatarEmoji.classList.remove("d-none");
      }
    });
  });

  if (photoUrlInput) {
    photoUrlInput.addEventListener("input", function () {
      const val = photoUrlInput.value.trim();
      if (/^https?:\/\//i.test(val)) {
        if (avatarImg) {
          avatarImg.src = val;
          avatarImg.classList.remove("d-none");
          avatarImg.onerror = function () {
            avatarImg.classList.add("d-none");
            if (avatarEmoji) avatarEmoji.classList.remove("d-none");
          };
        }
        if (avatarEmoji) avatarEmoji.classList.add("d-none");
      } else {
        if (avatarImg) avatarImg.classList.add("d-none");
        if (avatarEmoji) avatarEmoji.classList.remove("d-none");
      }
    });
  }

  if (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!currentAuthUser) return;

      const nameInput = document.getElementById("editProfileName");
      const dietInput = document.getElementById("editProfileDiet");
      const saveBtn = document.getElementById("saveProfileBtn");

      const name = nameInput.value.trim();
      const diet = dietInput.value;
      const customPhotoUrl = photoUrlInput ? photoUrlInput.value.trim() : "";

      if (!name || name.length < 2) {
        if (alertEl) {
          alertEl.textContent = "Please enter a valid display name (at least 2 characters).";
          alertEl.classList.remove("d-none");
        }
        return;
      }

      if (alertEl) alertEl.classList.add("d-none");
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";

      try {
        const photoToSave = customPhotoUrl && /^https?:\/\//i.test(customPhotoUrl)
          ? customPhotoUrl
          : (selectedAvatarEmoji || "🌱");

        // 1. Update Firebase Auth profile
        await updateProfile(currentAuthUser, {
          displayName: name,
          photoURL: photoToSave
        });

        // 2. Update Firestore users/{uid} document
        const db = getFirebaseDb();
        await updateDoc(doc(db, "users", currentAuthUser.uid), {
          name: name,
          dietPreference: diet,
          updatedAt: serverTimestamp()
        });

        // 3. Clear cache and reload
        invalidateUserProfileCache(currentAuthUser.uid);
        const refreshedProfile = await fetchUserProfile(currentAuthUser.uid, true);

        saveBtn.disabled = false;
        saveBtn.textContent = "Save Changes";
        if (editModalInstance) editModalInstance.hide();

        if (refreshedProfile) {
          renderProfile(currentAuthUser, refreshedProfile);
        }

        // Show brief success alert
        const errorEl = document.getElementById("profileError");
        if (errorEl) {
          errorEl.textContent = "✓ Profile updated successfully!";
          errorEl.style.backgroundColor = "#e8f5e9";
          errorEl.style.borderColor = "#c7e2ce";
          errorEl.style.color = "#1b5e20";
          errorEl.classList.remove("d-none");
          setTimeout(() => errorEl.classList.add("d-none"), 4000);
        }
      } catch (err) {
        console.error("VeganSaathi: profile update failed", err);
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Changes";
        if (alertEl) {
          alertEl.textContent = "Failed to update profile: " + (err.message || "Network error. Please try again.");
          alertEl.classList.remove("d-none");
        }
      }
    });
  }
}

function openEditProfileModal(user, profile) {
  if (!editModalInstance) setupEditProfileModal();

  const nameInput = document.getElementById("editProfileName");
  const dietInput = document.getElementById("editProfileDiet");
  const photoUrlInput = document.getElementById("editProfilePhotoUrl");
  const avatarImg = document.getElementById("editAvatarPreviewImg");
  const avatarEmoji = document.getElementById("editAvatarPreviewEmoji");
  const alertEl = document.getElementById("editProfileAlert");

  if (alertEl) alertEl.classList.add("d-none");
  if (nameInput) nameInput.value = profile.name || user.displayName || "";
  if (dietInput) dietInput.value = profile.dietPreference || "vegan";

  const photo = user.photoURL || profile.photoURL || "🌱";
  if (/^https?:\/\//i.test(photo)) {
    if (photoUrlInput) photoUrlInput.value = photo;
    if (avatarImg) {
      avatarImg.src = photo;
      avatarImg.classList.remove("d-none");
    }
    if (avatarEmoji) avatarEmoji.classList.add("d-none");
  } else {
    selectedAvatarEmoji = photo;
    if (photoUrlInput) photoUrlInput.value = "";
    if (avatarImg) avatarImg.classList.add("d-none");
    if (avatarEmoji) {
      avatarEmoji.textContent = photo;
      avatarEmoji.classList.remove("d-none");
    }
  }

  if (editModalInstance) editModalInstance.show();
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
