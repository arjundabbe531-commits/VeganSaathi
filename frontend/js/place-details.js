/* ==========================================================================
   VeganSaathi — place-details.js
   Reads ?id= from the URL and renders the matching mock place. No backend —
   Save/Write Review/Report all show a clear "coming in a later phase"
   message rather than pretending to persist anything.

   Phase 4: Save/Write Review/Report now require sign-in. Loaded as an ES
   module so it can share the one auth-state listener with the rest of the
   app (see auth-state.js) — browsing the place itself stays open to anyone.
   ========================================================================== */

import { onAuthChange, getCurrentUser } from "./auth-state.js";

document.addEventListener("DOMContentLoaded", function () {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const place = MOCK_PLACES.find(function (p) { return p.id === id; }) || MOCK_PLACES[0];

  renderPlaceDetail(place);
  renderReviewsFor(place.id);
  // Action buttons (Save / Review / Report) must work even if the map fails
  // to load for any reason (offline demo, blocked CDN, slow connection) —
  // wire them first, then attempt the map in its own try/catch so a map
  // failure can never take the rest of the page down with it.
  wireActionButtons(place);
  safelyInitDetailMap(place);

  onAuthChange(updateActionAvailability);
});

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

  document.getElementById("placeImage").textContent = place.imageLabel + " (mock photo)";
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
  // DEVELOPMENT MOCK DATA — replace with field-verified locations before final deployment.
  const map = L.map("vs-detail-map", { scrollWheelZoom: false }).setView([place.latitude, place.longitude], 15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19
  }).addTo(map);
  L.marker([place.latitude, place.longitude]).addTo(map).bindPopup(place.name);
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
