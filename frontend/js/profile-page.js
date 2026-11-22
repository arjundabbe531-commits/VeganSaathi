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

  // Render Avatar: photoURL can be an image URL, data URL, or an emoji
  const photoUrl = profile.avatarDataUrl || user.photoURL || profile.photoURL || "";
  const avatarImg = document.getElementById("profileAvatarImg");
  const avatarFallback = document.getElementById("profileAvatarFallback");
  if (avatarImg && avatarFallback) {
    if (photoUrl && (/^https?:\/\//i.test(photoUrl) || photoUrl.startsWith("data:image/"))) {
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
        subEl.innerHTML = '<div class="text-muted-vs py-3 text-center">You haven\'t submitted any places yet. <a href="submit-place.html" class="fw-semibold">Contribute a place →</a></div>';
      } else {
        const total = subRes.submissions.length;
        const publishedCount = subRes.submissions.filter(s => s.status === "published").length;
        const pendingCount = subRes.submissions.filter(s => s.status === "pending").length;

        let activeTab = "all";
        let displayLimit = 5;

        function renderSubmissionsUI() {
          let filtered = subRes.submissions;
          if (activeTab === "published") filtered = filtered.filter(s => s.status === "published");
          if (activeTab === "pending") filtered = filtered.filter(s => s.status === "pending");

          const visible = filtered.slice(0, displayLimit);
          const hasMore = filtered.length > displayLimit;

          const tabsHtml =
            '<div class="d-flex align-items-center gap-1 mb-3 flex-wrap" role="tablist">' +
            '<button type="button" class="btn btn-sm ' + (activeTab === "all" ? "btn-vs-primary" : "btn-outline-secondary") + ' py-0.5 px-2.5" style="font-size:0.75rem;" data-sub-tab="all">All (' + total + ')</button>' +
            '<button type="button" class="btn btn-sm ' + (activeTab === "published" ? "btn-vs-primary" : "btn-outline-secondary") + ' py-0.5 px-2.5" style="font-size:0.75rem;" data-sub-tab="published">Published (' + publishedCount + ')</button>' +
            '<button type="button" class="btn btn-sm ' + (activeTab === "pending" ? "btn-vs-primary" : "btn-outline-secondary") + ' py-0.5 px-2.5" style="font-size:0.75rem;" data-sub-tab="pending">Under Review (' + pendingCount + ')</button>' +
            '</div>';

          const rowsHtml = visible.map(function (s) {
            const badgeClass = s.status === "published"
              ? "bg-success"
              : (s.status === "pending" ? "bg-warning text-dark" : "bg-secondary");
            const statusLabel = s.status === "published" ? "✓ Published" : (s.status === "pending" ? "⏳ In Review" : capitalize(s.status));
            return (
              '<div class="d-flex justify-content-between align-items-center border-bottom py-2.5">' +
              '<div>' +
              '<div class="fw-semibold text-dark" style="font-size:0.92rem;">' + escapeHtml(s.name) + '</div>' +
              '<span class="text-muted-vs" style="font-size:0.78rem;">Submitted ' + escapeHtml(formatDate(s.createdAt)) + (s.city ? ' &bull; ' + escapeHtml(s.city) : '') + '</span>' +
              '</div>' +
              '<span class="badge ' + badgeClass + '" style="font-size:0.75rem; letter-spacing:0.02em;">' + escapeHtml(statusLabel) + '</span>' +
              '</div>'
            );
          }).join("");

          const loadMoreBtn = hasMore
            ? '<button type="button" id="loadMoreSubmissionsBtn" class="btn btn-vs-outline btn-sm w-100 mt-2.5" style="font-size:0.82rem;">Show More Submissions (' + (filtered.length - displayLimit) + ' remaining)</button>'
            : (filtered.length > 5 ? '<div class="text-center text-muted-vs mt-2" style="font-size:0.75rem;">Showing all ' + filtered.length + ' submissions</div>' : '');

          subEl.innerHTML = tabsHtml + '<div class="vs-submissions-scroll" style="max-height:360px; overflow-y:auto;">' + (rowsHtml || '<div class="text-muted-vs py-2 text-center" style="font-size:0.85rem;">No submissions in this filter.</div>') + '</div>' + loadMoreBtn;

          // Wire tabs
          subEl.querySelectorAll("[data-sub-tab]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              activeTab = btn.getAttribute("data-sub-tab");
              displayLimit = 5;
              renderSubmissionsUI();
            });
          });

          // Wire load more
          const lm = document.getElementById("loadMoreSubmissionsBtn");
          if (lm) {
            lm.addEventListener("click", function () {
              displayLimit += 5;
              renderSubmissionsUI();
            });
          }
        }

        renderSubmissionsUI();
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
        revEl.innerHTML = '<div class="text-muted-vs py-3 text-center">You haven\'t written any reviews yet.</div>';
      } else {
        let revLimit = 5;
        function renderReviewsUI() {
          const visible = revRes.reviews.slice(0, revLimit);
          const hasMore = revRes.reviews.length > revLimit;

          const rowsHtml = visible.map(function (r) {
            const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
            return (
              '<div class="border-bottom py-2">' +
              '<div class="d-flex justify-content-between align-items-center mb-1">' +
              '<span style="color:#b8862f; font-size:0.9rem;">' + stars + '</span>' +
              '<span class="text-muted-vs" style="font-size:0.75rem;">' + escapeHtml(formatDate(r.createdAt)) + '</span>' +
              '</div>' +
              '<p class="mb-0 text-dark" style="font-size:0.85rem; line-height:1.5;">' + escapeHtml(r.comment) + '</p>' +
              '</div>'
            );
          }).join("");

          const loadMoreBtn = hasMore
            ? '<button type="button" id="loadMoreReviewsBtn" class="btn btn-vs-outline btn-sm w-100 mt-2.5" style="font-size:0.82rem;">Show More Reviews</button>'
            : '';

          revEl.innerHTML = '<div class="vs-reviews-scroll" style="max-height:300px; overflow-y:auto;">' + rowsHtml + '</div>' + loadMoreBtn;

          const lm = document.getElementById("loadMoreReviewsBtn");
          if (lm) {
            lm.addEventListener("click", function () {
              revLimit += 5;
              renderReviewsUI();
            });
          }
        }
        renderReviewsUI();
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
        // Clear file data url when URL is manually typed
        const fdEl = document.getElementById("editProfileFileDataUrl");
        if (fdEl) fdEl.value = "";
      } else {
        if (avatarImg) avatarImg.classList.add("d-none");
        if (avatarEmoji) avatarEmoji.classList.remove("d-none");
      }
    });
  }

  // File upload from device (supports drag & drop + file picker)
  const fileInput = document.getElementById("editProfileFileInput");
  const fileDataUrlInput = document.getElementById("editProfileFileDataUrl");
  if (fileInput && fileDataUrlInput) {
    function applyFileToAvatar(file) {
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) { alert("Photo must be under 8 MB. Please choose a smaller image."); return; }
      const reader = new FileReader();
      reader.onload = function (ev) {
        const rawDataUrl = ev.target.result;
        const img = new Image();
        img.onload = function () {
          // Resize/center-crop to crisp 128x128 thumbnail
          const canvas = document.createElement("canvas");
          canvas.width = 128;
          canvas.height = 128;
          const ctx = canvas.getContext("2d");
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 128, 128);
          const compressed = canvas.toDataURL("image/jpeg", 0.88);
          fileDataUrlInput.value = compressed;
          if (photoUrlInput) photoUrlInput.value = "";
          if (avatarImg) { avatarImg.src = compressed; avatarImg.classList.remove("d-none"); }
          if (avatarEmoji) avatarEmoji.classList.add("d-none");
        };
        img.onerror = function () {
          fileDataUrlInput.value = rawDataUrl;
          if (avatarImg) { avatarImg.src = rawDataUrl; avatarImg.classList.remove("d-none"); }
          if (avatarEmoji) avatarEmoji.classList.add("d-none");
        };
        img.src = rawDataUrl;
      };
      reader.readAsDataURL(file);
    }
    fileInput.addEventListener("change", function () {
      applyFileToAvatar(fileInput.files && fileInput.files[0]);
    });
    const uploadZone = document.querySelector(".vs-avatar-upload-zone");
    if (uploadZone) {
      uploadZone.addEventListener("dragover", function (e) { e.preventDefault(); uploadZone.classList.add("drag-over"); });
      uploadZone.addEventListener("dragleave", function () { uploadZone.classList.remove("drag-over"); });
      uploadZone.addEventListener("drop", function (e) {
        e.preventDefault(); uploadZone.classList.remove("drag-over");
        applyFileToAvatar(e.dataTransfer.files && e.dataTransfer.files[0]);
      });
    }
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
      const fileDataUrlEl = document.getElementById("editProfileFileDataUrl");
      const fileDataUrl = fileDataUrlEl ? fileDataUrlEl.value : "";

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
        const photoToSave = fileDataUrl && fileDataUrl.startsWith("data:image/")
          ? fileDataUrl
          : (customPhotoUrl && /^https?:\/\//i.test(customPhotoUrl)
            ? customPhotoUrl
            : (selectedAvatarEmoji || "🌱"));

        const isDataUrl = photoToSave.startsWith("data:image/");

        // 1. Update Firebase Auth profile
        try {
          await updateProfile(currentAuthUser, {
            displayName: name,
            photoURL: isDataUrl ? (selectedAvatarEmoji || "🌱") : photoToSave
          });
        } catch (authErr) {
          console.warn("VeganSaathi: updateProfile non-critical notice", authErr);
        }

        // 2. Update Firestore users/{uid} document
        const db = getFirebaseDb();
        const updatePayload = {
          name: name,
          dietPreference: diet,
          updatedAt: serverTimestamp()
        };
        if (isDataUrl) {
          updatePayload.avatarDataUrl = photoToSave;
          updatePayload.photoURL = photoToSave;
        } else {
          updatePayload.photoURL = photoToSave;
          updatePayload.avatarDataUrl = "";
        }
        await updateDoc(doc(db, "users", currentAuthUser.uid), updatePayload);

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
  const fileDataUrlInput = document.getElementById("editProfileFileDataUrl");
  const avatarImg = document.getElementById("editAvatarPreviewImg");
  const avatarEmoji = document.getElementById("editAvatarPreviewEmoji");
  const alertEl = document.getElementById("editProfileAlert");

  if (alertEl) alertEl.classList.add("d-none");
  if (nameInput) nameInput.value = profile.name || user.displayName || "";
  if (dietInput) dietInput.value = profile.dietPreference || "vegan";

  const photo = profile.avatarDataUrl || user.photoURL || profile.photoURL || "🌱";
  if (/^https?:\/\//i.test(photo) || photo.startsWith("data:image/")) {
    if (photo.startsWith("data:image/")) {
      if (fileDataUrlInput) fileDataUrlInput.value = photo;
      if (photoUrlInput) photoUrlInput.value = "";
    } else {
      if (photoUrlInput) photoUrlInput.value = photo;
      if (fileDataUrlInput) fileDataUrlInput.value = "";
    }
    if (avatarImg) {
      avatarImg.src = photo;
      avatarImg.classList.remove("d-none");
    }
    if (avatarEmoji) avatarEmoji.classList.add("d-none");
  } else {
    selectedAvatarEmoji = photo;
    if (photoUrlInput) photoUrlInput.value = "";
    if (fileDataUrlInput) fileDataUrlInput.value = "";
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
