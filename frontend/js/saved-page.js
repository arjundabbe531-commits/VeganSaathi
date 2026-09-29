/* ==========================================================================
   VeganSaathi — saved-page.js
   ============================================================================
   Phase 4 scope: gate this page behind sign-in. The actual saved-places
   data is still local mock data for this browser session — the real
   Firestore-backed Saved Places feature is Phase 6 (see
   docs/DEVELOPMENT_PLAN.md). This file preserves that Phase 2 mock
   save/remove behavior exactly, just no longer showing it to signed-out
   visitors.
   ========================================================================== */

import { onAuthChange } from "./auth-state.js";

let savedIds = [];

function renderSaved() {
  const grid = document.getElementById("savedGrid");
  const empty = document.getElementById("savedEmptyState");
  const places = MOCK_PLACES.filter(function (p) { return savedIds.indexOf(p.id) !== -1; });

  if (places.length === 0) {
    grid.innerHTML = "";
    empty.classList.remove("d-none");
    return;
  }
  empty.classList.add("d-none");
  grid.innerHTML = places.map(function (place) {
    return (
      '<div class="col-sm-6 col-lg-4">' +
      '<div class="vs-card vs-place-card">' +
      '<div class="vs-place-card__image">' + escapeHtml(placeImageLabel(place)) + "</div>" +
      '<div class="vs-place-card__body">' +
      '<h3 class="vs-place-card__title">' + escapeHtml(place.name) + "</h3>" +
      "<div>" + renderDietBadges(place.dietTags) + "</div>" +
      '<div class="d-flex gap-2 mt-2">' +
      '<a href="' + escapeHtml(placeDetailsUrl(place.id)) + '" class="btn btn-vs-primary btn-sm">View Details</a>' +
      '<button type="button" class="btn btn-vs-outline btn-sm" data-remove-id="' + escapeHtml(place.id) + '">Remove</button>' +
      "</div></div></div></div>"
    );
  }).join("");

  grid.querySelectorAll("[data-remove-id]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      savedIds = savedIds.filter(function (id) { return id !== btn.getAttribute("data-remove-id"); });
      renderSaved();
    });
  });
}

document.addEventListener("DOMContentLoaded", function () {
  onAuthChange(function (user) {
    const signedOutEl = document.getElementById("savedSignedOut");
    const signedInEl = document.getElementById("savedSignedIn");

    if (!user) {
      signedOutEl.classList.remove("d-none");
      signedInEl.classList.add("d-none");
      return;
    }

    signedOutEl.classList.add("d-none");
    signedInEl.classList.remove("d-none");

    // Reset to the mock seed data each time someone signs in on this page —
    // there is no real per-user persistence yet (Phase 6).
    savedIds = MOCK_SAVED_PLACES.slice();
    renderSaved();
  });
});
