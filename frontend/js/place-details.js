/* ==========================================================================
   VeganSaathi — place-details.js
   ============================================================================
   Task 5.5 — reads ?id= from the URL and fetches that place through
   fetchPlaceById() in places-service.js — no direct Firestore access here,
   no second Firebase initialization, and critically: no fallback to
   MOCK_PLACES[0] or any other arbitrary place if the requested id doesn't
   resolve. An unknown/invalid/inaccessible id shows an honest "not
   available" state instead.

   Reviews, reports and saved-place state are loaded from Firestore through
   places-service.js. Browsing is public; writing reviews/reports and saving
   places requires authentication. No mock review or saved-place fallback is
   used on this page.

   Loaded as an ES module (already was, since Phase 4) so it can share the
   one auth-state listener with the rest of the app (see auth-state.js) —
   browsing a place's details stays open to anyone; only the Save/Review/
   Report actions require sign-in.
   ========================================================================== */

import { onAuthChange, getCurrentUser } from "./auth-state.js";
import {
  fetchPlaceById,
  fetchReviewsForPlace,
  submitReview,
  deleteReview,
  submitReport,
  isPlaceSaved,
  savePlace,
  unsavePlace
} from "./places-service.js";

document.addEventListener("DOMContentLoaded", function () {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id"); // null if ?id= is missing entirely — fetchPlaceById() already treats that as not-found, no extra guard needed here

  loadPlace(id);
  onAuthChange(updateActionAvailability);
});

async function loadPlace(id) {
  showPlaceState("loading");

  let result;
  try {
    result = await fetchPlaceById(id);
  } catch (error) {
    // fetchPlaceById() is designed to catch its own errors and return a
    // status instead of throwing, but guard here too in case something
    // upstream (e.g. Firebase init itself) throws before that.
    console.error("VeganSaathi Place Details: unexpected error loading place.", error);
    showPlaceState("error");
    return;
  }

  if (result.status === "not-found" || result.status === "invalid") {
    // Both are shown the same way: from a visitor's perspective, "this
    // document doesn't exist" and "this document exists but is malformed"
    // both mean the same thing — there is nothing valid here to show them.
    // (Distinguished only in developer-facing logging, never in the UI.)
    if (result.status === "invalid") {
      console.warn("VeganSaathi Place Details: place \"" + id + "\" exists but failed validation — see places-service.js's own warning above for the exact reason.");
    }
    showPlaceState("not-found");
    return;
  }

  if (result.status === "permission-denied") {
    console.error("VeganSaathi Place Details: Firestore denied the read (permission-denied) for place \"" + id + "\". Check firebase/firestore.rules and that they're actually deployed.");
    showPlaceState("error");
    return;
  }

  if (result.status === "error") {
    console.error("VeganSaathi Place Details: failed to load place \"" + id + "\".", result.error);
    showPlaceState("error");
    return;
  }

  // result.status === "ok"
  const place = result.place;

  // Render DOM content immediately — map, reviews, and action buttons run in parallel
  // so the page feels fast even on slow Firestore connections.
  renderPlaceDetail(place);
  showPlaceState("content");

  // Kick off map right after DOM paint — it uses only place.latitude/longitude
  // already available, no extra network call needed.
  safelyInitDetailMap(place);

  // Reviews and wire-up run in parallel (independent of each other)
  await Promise.all([
    renderReviewsFor(place.id),
    wireActionButtons(place)
  ]);
}

// Shows exactly one of the four page states; hides the other three.
function showPlaceState(state) {
  const ids = {
    loading: "placeLoadingState",
    notFound: "placeNotFoundState",
    error: "placeErrorState",
    content: "placeContent"
  };
  const targetId = state === "not-found" ? ids.notFound : ids[state];
  Object.values(ids).forEach(function (elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.classList.toggle("d-none", elId !== targetId);
  });
}

function safelyInitDetailMap(place) {
  try {
    initDetailMap(place);
  } catch (err) {
    const mapEl = document.getElementById("vs-detail-map");
    if (mapEl) {
      mapEl.innerHTML = '<p class="text-muted-vs p-3 mb-0">Map preview is unavailable right now. The address above is still accurate.</p>';
    }
    // Logged for developers; not shown to the end user.
    console.warn("VeganSaathi: place detail map failed to initialize.", err);
  }
}

function renderPlaceDetail(place) {
  document.title = place.name + " — VeganSaathi";

  const imgEl = document.getElementById("placeImage");
  if (imgEl) {
    let heroUrl = "";
    if (place.imageUrl && typeof place.imageUrl === "string" && place.imageUrl.trim().length > 0) {
      heroUrl = buildOptimizedImageUrl(place.imageUrl.trim(), 1200, 800);
    }
    if (heroUrl) {
      imgEl.innerHTML = '<img class="vs-place-detail__img" src="' + escapeHtml(heroUrl) + '" alt="' + escapeHtml(place.name) + '" onerror="this.onerror=null;this.parentElement.textContent=\'No photo yet\';" />';
    } else {
      imgEl.textContent = "No photo yet";
    }
  }

  // A. Overview
  document.getElementById("placeName").textContent = place.name;
  document.getElementById("placeType").textContent = formatPlaceType(place.placeType);
  document.getElementById("placeArea").textContent = place.area || "Area not listed";
  document.getElementById("placeAddress").textContent = place.address;
  document.getElementById("placePrice").textContent = place.priceRange ? capitalize(place.priceRange) : "Price not listed";

  // Opening Hours (clean empty state)
  const openingEl = document.getElementById("placeOpening");
  const openingLabel = document.getElementById("placeOpeningLabel");
  if (place.openingInfo && place.openingInfo.trim()) {
    openingEl.textContent = place.openingInfo.trim();
    openingEl.classList.remove("d-none");
    if (openingLabel) openingLabel.classList.remove("d-none");
  } else {
    if (openingEl) openingEl.classList.add("d-none");
    if (openingLabel) openingLabel.classList.add("d-none");
  }

  // Phone (clean empty state)
  const phoneEl = document.getElementById("placePhone");
  const phoneLabel = document.getElementById("placePhoneLabel");
  if (place.phone && place.phone.trim()) {
    phoneEl.innerHTML = '<a href="tel:' + escapeHtml(place.phone.trim()) + '" class="text-decoration-none">📞 ' + escapeHtml(place.phone.trim()) + '</a>';
    phoneEl.classList.remove("d-none");
    if (phoneLabel) phoneLabel.classList.remove("d-none");
  } else {
    if (phoneEl) phoneEl.classList.add("d-none");
    if (phoneLabel) phoneLabel.classList.add("d-none");
  }

  // Website (clean empty state)
  const webEl = document.getElementById("placeWebsite");
  const webLabel = document.getElementById("placeWebsiteLabel");
  if (place.website && place.website.trim()) {
    const rawUrl = place.website.trim();
    const cleanUrl = rawUrl.startsWith("http://") || rawUrl.startsWith("https://") ? rawUrl : "https://" + rawUrl;
    webEl.innerHTML = '<a href="' + escapeHtml(cleanUrl) + '" target="_blank" rel="noopener noreferrer" class="text-decoration-none">🌐 Visit Website ↗</a>';
    webEl.classList.remove("d-none");
    if (webLabel) webLabel.classList.remove("d-none");
  } else {
    if (webEl) webEl.classList.add("d-none");
    if (webLabel) webLabel.classList.add("d-none");
  }

  // Description (clean empty state)
  const descEl = document.getElementById("placeDescription");
  const aboutSec = document.getElementById("placeAboutSection");
  if (place.description && place.description.trim()) {
    descEl.textContent = place.description.trim();
    if (aboutSec) aboutSec.classList.remove("d-none");
  } else {
    if (aboutSec) aboutSec.classList.add("d-none");
  }

  // B. Dietary Classification (Distinct badges)
  const dietBadgesEl = document.getElementById("placeDietBadges");
  if (typeof renderDietBadgesDetailed === "function") {
    dietBadgesEl.innerHTML = renderDietBadgesDetailed(place);
  } else {
    dietBadgesEl.innerHTML = renderPlaceDietBadges(place);
  }

  // Verification Pill
  document.getElementById("placeVerification").innerHTML = renderVerificationBadge(place);

  // C. Dietary Evidence & Ingredients Section
  renderDietaryEvidence(place);

  // D. Map Directions Link
  const dirBtn = document.getElementById("directionsBtn");
  if (dirBtn && typeof place.latitude === "number" && typeof place.longitude === "number") {
    dirBtn.href = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(place.latitude + "," + place.longitude);
    dirBtn.classList.remove("d-none");
  }
}

function renderDietaryEvidence(place) {
  const container = document.getElementById("placeEvidenceContainer");
  if (!container) return;

  const html = [];

  // 1. Physical fieldwork status
  const isPhys = place.verificationDimensions && place.verificationDimensions.physically_visited === true;
  if (isPhys) {
    html.push('<div class="d-flex align-items-center gap-2 mb-2"><span class="badge bg-success text-white">✓ On-Site Field Visit</span><span style="font-size:0.85rem;" class="text-muted-vs">Physical verification conducted on premises.</span></div>');
  }

  // 2. Ingredients & Preparation notes
  if (place.dietNotes && place.dietNotes.trim()) {
    html.push('<div class="mb-2"><strong style="font-size:0.85rem;" class="d-block text-dark mb-1">Ingredient &amp; Kitchen Notes:</strong><p class="mb-0 text-muted-vs" style="font-size:0.88rem; line-height:1.5;">' + escapeHtml(place.dietNotes.trim()) + '</p></div>');
  }

  // 3. Specific verified dishes / claims
  if (Array.isArray(place.evidenceRefs) && place.evidenceRefs.length > 0) {
    html.push('<div class="mt-2"><strong style="font-size:0.85rem;" class="d-block text-dark mb-1">Audited Menu Evidence:</strong><ul class="mb-0 ps-3 text-muted-vs" style="font-size:0.85rem;">');
    place.evidenceRefs.forEach(function (ref) {
      const claimText = escapeHtml(ref.claim || "");
      const excerptText = ref.excerpt ? ' <span class="fst-italic text-secondary">— "' + escapeHtml(ref.excerpt) + '"</span>' : "";
      const dateText = ref.lastCheckedAt ? ' <span class="badge bg-light text-dark border ms-1" style="font-size:0.75rem;">Checked: ' + escapeHtml(ref.lastCheckedAt) + '</span>' : "";
      html.push('<li><strong>' + claimText + '</strong>' + excerptText + dateText + '</li>');
    });
    html.push('</ul></div>');
  }

  // 4. Default advisory if minimal notes
  if (!place.dietNotes && (!place.evidenceRefs || place.evidenceRefs.length === 0)) {
    html.push('<p class="mb-0 text-muted-vs" style="font-size:0.88rem; line-height:1.5;">Venue details published. Confirm daily vegan ingredients directly with staff.</p>');
  }

  container.innerHTML = html.join("");
}

async function renderReviewsFor(placeId) {
  const container = document.getElementById("reviewsList");
  if (!container) return;

  container.innerHTML = '<p class="text-muted-vs">Loading reviews…</p>';

  const res = await fetchReviewsForPlace(placeId);
  if (res && res.status !== "ok") {
    container.innerHTML = '<p class="text-muted-vs text-danger">Unable to load reviews right now. Please try again later.</p>';
    return;
  }
  const reviews = res && res.places ? res.places : (res && res.reviews ? res.reviews : []);

  if (reviews.length === 0) {
    container.innerHTML = '<p class="text-muted-vs">No reviews yet for this place. Be the first to share your experience!</p>';
    return;
  }

  const currentUser = getCurrentUser();
  const currentUid = currentUser ? currentUser.uid : null;

  container.innerHTML = reviews.map(function (review) {
    const isAuthor = currentUid && review.userId === currentUid;
    const deleteBtn = isAuthor
      ? ' <button type="button" class="btn btn-sm btn-link text-danger p-0 ms-2 delete-review-btn" data-review-id="' + escapeHtml(review.id) + '">Delete</button>'
      : "";

    const rating = Math.max(0, Math.min(5, Math.round(Number(review.rating)) || 0));
    const stars = "★".repeat(rating) + "☆".repeat(5 - rating);

    return (
      '<div class="vs-card p-3 mb-2" id="review-' + escapeHtml(review.id) + '">' +
      '<div class="d-flex justify-content-between align-items-center">' +
      "<div><strong>" + escapeHtml(review.authorName) + "</strong>" + deleteBtn + "</div>" +
      '<span aria-label="' + rating + ' out of 5 stars" style="color:#b8862f;">' + stars + "</span>" +
      "</div>" +
      '<p class="mb-1 mt-1">' + escapeHtml(review.comment) + "</p>" +
      '<div class="text-muted-vs" style="font-size:0.78rem;">' + escapeHtml(formatDate(review.createdAt)) + "</div>" +
      "</div>"
    );
  }).join("");

  container.querySelectorAll(".delete-review-btn").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      const revId = btn.getAttribute("data-review-id");
      if (!revId) return;
      if (!confirm("Are you sure you want to delete your review?")) return;
      btn.disabled = true;
      btn.textContent = "Deleting…";
      await deleteReview(revId);
      await renderReviewsFor(placeId);
    });
  });
}

function initDetailMap(place) {
  // place.latitude/longitude are real, normalized Firestore coordinates by
  // the time this ever runs — normalizePlace() already rejects any place
  // whose coordinates aren't valid numbers inside the pilot bounding box
  // (places-service.js's PILOT_BOUNDS), so fetchPlaceById() would have
  // returned "invalid" long before reaching here. No second coordinate
  // check is duplicated in this file — that rule lives in exactly one
  // place (places-service.js).
  const map = L.map("vs-detail-map", { scrollWheelZoom: false }).setView([place.latitude, place.longitude], 15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19
  }).addTo(map);
  L.marker([place.latitude, place.longitude]).addTo(map).bindPopup(escapeHtml(place.name));
}

// Enable/disable the three protected controls to match current auth state,
// matching the same disabled+title pattern already used elsewhere in this
// app (e.g. the Google sign-in button, the Profile page's Edit button).
function updateActionAvailability(user) {
  const signedIn = !!user;

  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn) {
    saveBtn.disabled = !signedIn;
    saveBtn.title = signedIn ? "" : "Sign in to save places";
  }

  const reviewSubmit = document.querySelector('#reviewForm button[type="submit"]');
  if (reviewSubmit) {
    reviewSubmit.disabled = !signedIn;
    reviewSubmit.title = signedIn ? "" : "Sign in to write a review";
  }

  const reportSubmit = document.querySelector('#reportForm button[type="submit"]');
  if (reportSubmit) {
    reportSubmit.disabled = !signedIn;
    reportSubmit.title = signedIn ? "" : "Sign in to report incorrect information";
  }
}

async function wireActionButtons(place) {
  const saveBtn = document.getElementById("saveBtn");
  const shareBtn = document.getElementById("sharePlaceBtn");
  const copyAddrBtn = document.getElementById("copyAddressBtn");

  if (shareBtn) {
    shareBtn.addEventListener("click", function () {
      const shareData = {
        title: place.name + " — VeganSaathi",
        text: "Check out " + place.name + " (" + (place.area || "Maharashtra") + ") on VeganSaathi — community discovery portal for conscious dining!",
        url: window.location.href
      };
      if (navigator.share) {
        navigator.share(shareData).catch(function () {});
      } else {
        const text = encodeURIComponent(shareData.text + " " + shareData.url);
        window.open("https://api.whatsapp.com/send?text=" + text, "_blank", "noopener,noreferrer");
      }
    });
  }

  if (copyAddrBtn) {
    copyAddrBtn.addEventListener("click", function () {
      if (navigator.clipboard && place.address) {
        navigator.clipboard.writeText(place.address).then(function () {
          copyAddrBtn.textContent = "✓ Copied!";
          setTimeout(function () { copyAddrBtn.textContent = "📋 Copy"; }, 2000);
        });
      }
    });
  }

  async function refreshSaveButton() {
    const user = getCurrentUser();
    if (!user) {
      updateSaveButton(saveBtn, false);
      return;
    }
    const isSaved = await isPlaceSaved(place.id, user.uid);
    updateSaveButton(saveBtn, isSaved);
  }

  await refreshSaveButton();

  // Re-check save state on auth change
  onAuthChange(function () {
    refreshSaveButton();
  });

  saveBtn.addEventListener("click", async function () {
    const user = getCurrentUser();
    if (!user) return;

    const feedback = document.getElementById("saveFeedback");
    const currentlySaved = saveBtn.getAttribute("data-saved") === "true";
    saveBtn.disabled = true;
    if (feedback) {
      feedback.classList.add("d-none");
      feedback.textContent = "";
    }

    try {
      const result = currentlySaved
        ? await unsavePlace(place.id, user.uid)
        : await savePlace(place.id, user.uid);

      if (!result || result.status !== "ok") {
        if (feedback) {
          feedback.className = "vs-form-note mt-2";
          feedback.style.backgroundColor = "#fbeaea";
          feedback.style.borderColor = "#f0c3c3";
          feedback.style.color = "#8a2f2f";
          feedback.textContent = "Unable to update your saved places right now. Please try again.";
          feedback.setAttribute("role", "alert");
          feedback.classList.remove("d-none");
        }
        return;
      }

      updateSaveButton(saveBtn, !currentlySaved);
    } catch (error) {
      console.error("VeganSaathi: saved-place update failed.", error);
      if (feedback) {
        feedback.className = "vs-form-note mt-2";
        feedback.style.backgroundColor = "#fbeaea";
        feedback.style.borderColor = "#f0c3c3";
        feedback.style.color = "#8a2f2f";
        feedback.textContent = "Unable to update your saved places right now. Please try again.";
        feedback.setAttribute("role", "alert");
        feedback.classList.remove("d-none");
      }
    } finally {
      saveBtn.disabled = false;
    }
  });

  document.getElementById("reviewForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    const feedback = document.getElementById("reviewFeedback");
    const user = getCurrentUser();

    if (!user) {
      feedback.className = "vs-form-note mt-2";
      feedback.style.backgroundColor = "#fbeaea";
      feedback.style.borderColor = "#f0c3c3";
      feedback.style.color = "#8a2f2f";
      feedback.textContent = "Please sign in to write a review.";
      feedback.classList.remove("d-none");
      return;
    }

    const rating = document.getElementById("reviewRating").value;
    const comment = document.getElementById("reviewComment").value.trim();

    if (!rating || comment.length < 3) {
      feedback.className = "vs-form-note mt-2";
      feedback.style.backgroundColor = "#fbeaea";
      feedback.style.borderColor = "#f0c3c3";
      feedback.style.color = "#8a2f2f";
      feedback.textContent = "Please choose a rating and write a short comment (at least 3 characters).";
      feedback.classList.remove("d-none");
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await submitReview({
        placeId: place.id,
        rating: rating,
        comment: comment,
        user: user
      });

      if (res.status === "ok") {
        feedback.className = "vs-form-note mt-2";
        feedback.style.backgroundColor = "#e8f3ea";
        feedback.style.borderColor = "#c7e2ce";
        feedback.style.color = "#2f6b3f";
        feedback.textContent = "Your review was submitted successfully!";
        feedback.classList.remove("d-none");
        document.getElementById("reviewForm").reset();
        await renderReviewsFor(place.id);
      } else {
        feedback.className = "vs-form-note mt-2";
        feedback.style.backgroundColor = "#fbeaea";
        feedback.style.borderColor = "#f0c3c3";
        feedback.style.color = "#8a2f2f";
        feedback.textContent = res.message || "Failed to submit review. Please try again.";
        feedback.classList.remove("d-none");
      }
    } catch (err) {
      console.error("VeganSaathi: review submission error", err);
      feedback.className = "vs-form-note mt-2";
      feedback.style.backgroundColor = "#fbeaea";
      feedback.style.borderColor = "#f0c3c3";
      feedback.style.color = "#8a2f2f";
      feedback.textContent = "Unable to submit review right now. Please try again.";
      feedback.classList.remove("d-none");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  document.getElementById("reportForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    const feedback = document.getElementById("reportFeedback");
    const user = getCurrentUser();

    if (!user) {
      feedback.className = "vs-form-note mt-2";
      feedback.style.backgroundColor = "#fbeaea";
      feedback.style.borderColor = "#f0c3c3";
      feedback.style.color = "#8a2f2f";
      feedback.textContent = "Please sign in to report incorrect information.";
      feedback.classList.remove("d-none");
      return;
    }

    const reason = document.getElementById("reportReason").value;
    const description = document.getElementById("reportDescription").value.trim();

    if (!reason) {
      feedback.className = "vs-form-note mt-2";
      feedback.style.backgroundColor = "#fbeaea";
      feedback.style.borderColor = "#f0c3c3";
      feedback.style.color = "#8a2f2f";
      feedback.textContent = "Please choose a reason for the report.";
      feedback.classList.remove("d-none");
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await submitReport({
        placeId: place.id,
        reason: reason,
        description: description,
        user: user
      });

      if (res.status === "ok") {
        feedback.className = "vs-form-note mt-2";
        feedback.style.backgroundColor = "#e8f3ea";
        feedback.style.borderColor = "#c7e2ce";
        feedback.style.color = "#2f6b3f";
        feedback.textContent = "Thank you! Your report was submitted to the admin moderation queue.";
        feedback.classList.remove("d-none");
        document.getElementById("reportForm").reset();
      } else {
        feedback.className = "vs-form-note mt-2";
        feedback.style.backgroundColor = "#fbeaea";
        feedback.style.borderColor = "#f0c3c3";
        feedback.style.color = "#8a2f2f";
        feedback.textContent = res.message || "Failed to submit report. Please try again.";
        feedback.classList.remove("d-none");
      }
    } catch (err) {
      console.error("VeganSaathi: report submission error", err);
      feedback.className = "vs-form-note mt-2";
      feedback.style.backgroundColor = "#fbeaea";
      feedback.style.borderColor = "#f0c3c3";
      feedback.style.color = "#8a2f2f";
      feedback.textContent = "Unable to submit report right now. Please try again.";
      feedback.classList.remove("d-none");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

function updateSaveButton(btn, saved) {
  if (!btn) return;
  btn.setAttribute("data-saved", saved ? "true" : "false");
  btn.textContent = saved ? "Saved ✓" : "Save Place";
  btn.classList.toggle("btn-vs-primary", saved);
  btn.classList.toggle("btn-vs-outline", !saved);
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}
