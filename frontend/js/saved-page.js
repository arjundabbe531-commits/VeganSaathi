/* ==========================================================================
   VeganSaathi — saved-page.js
   ============================================================================
   Phase 6 — Persistent user-specific saved places from Firestore.
   Gated behind sign-in. Reads real saved places from savedPlaces collection
   and fetches corresponding published place details.
   ========================================================================== */

import { onAuthChange } from "./auth-state.js";
import { fetchSavedPlacesForUser, unsavePlace } from "./places-service.js";

async function loadAndRenderSaved(user) {
  const grid = document.getElementById("savedGrid");
  const empty = document.getElementById("savedEmptyState");
  if (!grid || !empty) return;

  grid.innerHTML = '<div class="col-12 text-center text-muted-vs py-4">Loading your saved places…</div>';
  empty.classList.add("d-none");

  const res = await fetchSavedPlacesForUser(user.uid);
  if (res && res.status !== "ok") {
    grid.innerHTML = '<div class="col-12 text-center text-danger py-4">Unable to load your saved places right now. Please try again.</div>';
    empty.classList.add("d-none");
    return;
  }
  const places = res && res.places ? res.places : [];

  if (places.length === 0) {
    grid.innerHTML = "";
    empty.classList.remove("d-none");
    return;
  }

  empty.classList.add("d-none");
  grid.innerHTML = places.map(function (place) {
    return (
      '<div class="col-sm-6 col-lg-4" id="saved-card-' + escapeHtml(place.id) + '">' +
      '<div class="vs-card vs-place-card">' +
      '<div class="vs-place-card__image">' + escapeHtml(placeImageLabel(place)) + "</div>" +
      '<div class="vs-place-card__body">' +
      '<h3 class="vs-place-card__title">' + escapeHtml(place.name) + "</h3>" +
      '<div class="vs-place-card__meta">' + escapeHtml(formatPlaceType(place.placeType)) + (place.area ? " &middot; " + escapeHtml(place.area) : "") + "</div>" +
      "<div>" + renderPlaceDietBadges(place) + "</div>" +
      '<div class="d-flex gap-2 mt-2">' +
      '<a href="' + escapeHtml(placeDetailsUrl(place.id)) + '" class="btn btn-vs-primary btn-sm">View Details</a>' +
      '<button type="button" class="btn btn-vs-outline btn-sm remove-saved-btn" data-place-id="' + escapeHtml(place.id) + '">Remove</button>' +
      "</div></div></div></div>"
    );
  }).join("");

  grid.querySelectorAll(".remove-saved-btn").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      const placeId = btn.getAttribute("data-place-id");
      if (!placeId) return;
      btn.disabled = true;
      btn.textContent = "Removing…";
      await unsavePlace(placeId, user.uid);
      await loadAndRenderSaved(user);
    });
  });
}

function initSavedPage() {
  onAuthChange(async function (user) {
    const signedOutEl = document.getElementById("savedSignedOut");
    const signedInEl = document.getElementById("savedSignedIn");

    if (!user) {
      if (signedOutEl) signedOutEl.classList.remove("d-none");
      if (signedInEl) signedInEl.classList.add("d-none");
      return;
    }

    if (signedOutEl) signedOutEl.classList.add("d-none");
    if (signedInEl) signedInEl.classList.remove("d-none");

    await loadAndRenderSaved(user);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSavedPage);
} else {
  initSavedPage();
}
