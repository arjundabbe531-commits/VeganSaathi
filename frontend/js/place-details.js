/* ==========================================================================
   VeganSaathi — place-details.js
   ============================================================================
   Task 5.5 — reads ?id= from the URL and fetches that place through
   fetchPlaceById() in places-service.js — no direct Firestore access here,
   no second Firebase initialization, and critically: no fallback to
   MOCK_PLACES[0] or any other arbitrary place if the requested id doesn't
   resolve. An unknown/invalid/inaccessible id shows an honest "not
   available" state instead.

   Reviews and the Save button's "already saved?" check are explicitly OUT
   of scope for this task (real Reviews/Saved Places are Phase 6) and still
   read from MOCK_REVIEWS/MOCK_SAVED_PLACES as a preserved UI shell — this
   degrades correctly on its own for a real place, since a real Firestore
   id will simply never match any mock id, honestly showing "no reviews
   yet" / "not saved" rather than fabricating either.

   Loaded as an ES module (already was, since Phase 4) so it can share the
   one auth-state listener with the rest of the app (see auth-state.js) —
   browsing a place's details stays open to anyone; only the Save/Review/
   Report actions require sign-in.
   ========================================================================== */

import { onAuthChange, getCurrentUser } from "./auth-state.js";
import { fetchPlaceById } from "./places-service.js";

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

  renderPlaceDetail(place);
  renderReviewsFor(place.id);
  // Action buttons (Save / Review / Report) must work even if the map fails
  // to load for any reason (offline demo, blocked CDN, slow connection) —
  // wire them first, then attempt the map in its own try/catch so a map
  // failure can never take the rest of the page down with it.
  wireActionButtons(place);
  safelyInitDetailMap(place);

  showPlaceState("content");
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

  // placeImageLabel() (components.js) already handles "no photo available"
  // correctly for a real place (which has imageUrl, not the mock-only
  // imageLabel field) — reused here rather than duplicated.
  document.getElementById("placeImage").textContent = placeImageLabel(place);
  document.getElementById("placeName").textContent = place.name;
  document.getElementById("placeType").textContent = capitalize(place.placeType);
  document.getElementById("placeArea").textContent = place.area;
  document.getElementById("placeAddress").textContent = place.address;
  document.getElementById("placePrice").textContent = capitalize(place.priceRange);
  document.getElementById("placeDescription").textContent = place.description;
  document.getElementById("placeDietBadges").innerHTML = renderDietBadges(place.dietTags);
  document.getElementById("placeVerification").innerHTML = renderVerificationBadge(place);
}

function renderReviewsFor(placeId) {
  const reviews = MOCK_REVIEWS.filter(function (r) { return r.placeId === placeId; });
  const container = document.getElementById("reviewsList");
  if (reviews.length === 0) {
    container.innerHTML = '<p class="text-muted-vs">No reviews yet for this place.</p>';
    return;
  }
  container.innerHTML = reviews.map(renderReviewCard).join("");
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

function wireActionButtons(place) {
  const isSaved = MOCK_SAVED_PLACES.indexOf(place.id) !== -1;
  const saveBtn = document.getElementById("saveBtn");
  updateSaveButton(saveBtn, isSaved);

  saveBtn.addEventListener("click", function () {
    if (!getCurrentUser()) return; // button is disabled in this state, but guard anyway
    const nowSaved = saveBtn.getAttribute("data-saved") === "true";
    updateSaveButton(saveBtn, !nowSaved);
    // Phase 2 note: this only changes the button's visual state; nothing is persisted yet.
  });

  document.getElementById("reviewForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const feedback = document.getElementById("reviewFeedback");

    if (!getCurrentUser()) {
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
      feedback.textContent = "Please choose a rating and write a short comment before submitting.";
      feedback.classList.remove("d-none");
      return;
    }

    feedback.className = "vs-form-note mt-2";
    feedback.textContent = "Demo: review submission will be connected to Firestore in a later phase. Nothing was saved.";
    feedback.classList.remove("d-none");
    document.getElementById("reviewForm").reset();
  });

  document.getElementById("reportForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const feedback = document.getElementById("reportFeedback");

    if (!getCurrentUser()) {
      feedback.textContent = "Please sign in to report incorrect information.";
      feedback.classList.remove("d-none");
      return;
    }

    const reason = document.getElementById("reportReason").value;

    if (!reason) {
      feedback.textContent = "Please choose a reason for the report.";
      feedback.classList.remove("d-none");
      return;
    }

    feedback.textContent = "Demo: this report will be connected to the admin review queue in a later phase. Nothing was saved.";
    feedback.classList.remove("d-none");
    document.getElementById("reportForm").reset();
  });
}

function updateSaveButton(btn, saved) {
  btn.setAttribute("data-saved", saved ? "true" : "false");
  btn.textContent = saved ? "Saved ✓" : "Save Place";
  btn.classList.toggle("btn-vs-primary", saved);
  btn.classList.toggle("btn-vs-outline", !saved);
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}
