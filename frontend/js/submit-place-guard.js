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
import { submitCommunityPlace, COORD_BOUNDS } from "./places-service.js";
import { validateImageFile, uploadImageToCloudinary } from "./cloudinary-service.js";

// Default map view when no user location is known — centred on India at a
// continent-level zoom so any place in the country is reachable without
// panning. The user can zoom/pan to anywhere on Earth.
const DEFAULT_MAP_CENTER = [20.5937, 78.9629]; // geographic centre of India
const DEFAULT_MAP_ZOOM = 5;

function isValidCoords(lat, lon) {
  return typeof lat === "number" && typeof lon === "number"
    && !isNaN(lat) && !isNaN(lon)
    && lat >= COORD_BOUNDS.minLat && lat <= COORD_BOUNDS.maxLat
    && lon >= COORD_BOUNDS.minLon && lon <= COORD_BOUNDS.maxLon;
}

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
    el.style.backgroundColor = "#e8f3ea";
    el.style.borderColor = "#c7e2ce";
    el.style.color = "#2f6b3f";
  }
}

function setCoordFeedback(msg) {
  const fb = document.getElementById("spCoordFeedback");
  if (!fb) return;
  if (msg) {
    fb.textContent = msg;
    fb.classList.remove("d-none");
  } else {
    fb.textContent = "";
    fb.classList.add("d-none");
  }
}

let selectedPhotoFile = null;
let photoPreviewObjectUrl = null;

function clearPhotoSelection() {
  selectedPhotoFile = null;
  const input = document.getElementById("spPhoto");
  if (input) input.value = "";
  const preview = document.getElementById("spPhotoPreviewContainer");
  if (preview) preview.classList.add("d-none");
  const previewImg = document.getElementById("spPhotoPreviewImg");
  if (previewImg) previewImg.src = "";
  const feedback = document.getElementById("spPhotoFeedback");
  if (feedback) {
    feedback.textContent = "";
    feedback.classList.add("d-none");
  }
  const progressCont = document.getElementById("spUploadProgressContainer");
  if (progressCont) progressCont.classList.add("d-none");
  const progressBar = document.getElementById("spProgressBar");
  if (progressBar) progressBar.style.width = "0%";
  const progressPercent = document.getElementById("spUploadPercent");
  if (progressPercent) progressPercent.textContent = "0%";
  if (photoPreviewObjectUrl && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(photoPreviewObjectUrl);
    photoPreviewObjectUrl = null;
  }
}

function wirePhotoUpload() {
  const input = document.getElementById("spPhoto");
  const feedback = document.getElementById("spPhotoFeedback");
  const previewCont = document.getElementById("spPhotoPreviewContainer");
  const previewImg = document.getElementById("spPhotoPreviewImg");
  const fileNameSpan = document.getElementById("spPhotoFileName");
  const removeBtn = document.getElementById("spRemovePhotoBtn");

  if (!input) return;

  input.addEventListener("change", function () {
    if (!input.files || input.files.length === 0) {
      clearPhotoSelection();
      return;
    }

    const file = input.files[0];
    const validation = validateImageFile(file);
    if (!validation.valid) {
      if (feedback) {
        feedback.textContent = validation.error;
        feedback.classList.remove("d-none");
      }
      clearPhotoSelection();
      return;
    }

    if (feedback) {
      feedback.textContent = "";
      feedback.classList.add("d-none");
    }

    selectedPhotoFile = file;
    if (fileNameSpan) fileNameSpan.textContent = file.name;

    if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
      if (photoPreviewObjectUrl) URL.revokeObjectURL(photoPreviewObjectUrl);
      photoPreviewObjectUrl = URL.createObjectURL(file);
      if (previewImg) previewImg.src = photoPreviewObjectUrl;
    }
    if (previewCont) previewCont.classList.remove("d-none");
  });

  if (removeBtn) {
    removeBtn.addEventListener("click", function () {
      clearPhotoSelection();
    });
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

let mapInstance = null;
let markerInstance = null;

function initCoordinateMap() {
  const mapEl = document.getElementById("spMap");
  if (!mapEl || typeof window === "undefined" || !window.L) return;

  try {
    mapInstance = window.L.map("spMap").setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 18
    }).addTo(mapInstance);

    const latInput = document.getElementById("spLatitude");
    const lonInput = document.getElementById("spLongitude");

    mapInstance.on("click", function (e) {
      if (!e || !e.latlng) return;
      const clickedLat = parseFloat(e.latlng.lat.toFixed(5));
      const clickedLon = parseFloat(e.latlng.lng.toFixed(5));

      if (isValidCoords(clickedLat, clickedLon)) {
        setCoordFeedback("");
        if (latInput) latInput.value = clickedLat;
        if (lonInput) lonInput.value = clickedLon;

        if (markerInstance && typeof markerInstance.setLatLng === "function") {
          markerInstance.setLatLng([clickedLat, clickedLon]);
        } else {
          markerInstance = window.L.marker([clickedLat, clickedLon]).addTo(mapInstance);
        }
      } else {
        setCoordFeedback("Selected location could not be pinned — coordinates appear out of range.");
      }
    });

    function syncFromInputs() {
      const latVal = parseFloat(latInput.value);
      const lonVal = parseFloat(lonInput.value);

      if (!isNaN(latVal) && !isNaN(lonVal)) {
        if (isValidCoords(latVal, lonVal)) {
          setCoordFeedback("");
          if (markerInstance && typeof markerInstance.setLatLng === "function") {
            markerInstance.setLatLng([latVal, lonVal]);
          } else {
            markerInstance = window.L.marker([latVal, lonVal]).addTo(mapInstance);
          }
          if (typeof mapInstance.setView === "function") {
            mapInstance.setView([latVal, lonVal]);
          }
        } else {
          setCoordFeedback("Coordinates are out of valid range (Latitude: -90 to 90, Longitude: -180 to 180).");
        }
      }
    }

    if (latInput) latInput.addEventListener("input", syncFromInputs);
    if (lonInput) lonInput.addEventListener("input", syncFromInputs);
  } catch (err) {
    console.warn("Leaflet map initialization warning in submit-place:", err);
  }
}

function wireSubmitPlaceForm() {
  const form = document.getElementById("submitPlaceForm");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const user = getCurrentUser();
    if (!user) {
      showFormNote("submitPlaceFeedback", "Please sign in to submit a place.", true);
      return;
    }

    const name = document.getElementById("spName").value.trim();
    const type = document.getElementById("spType").value;
    const address = document.getElementById("spAddress").value.trim();
    const priceRange = document.getElementById("spPrice").value;
    const description = document.getElementById("spDescription").value.trim();
    const area = document.getElementById("spLocation").value.trim();
    const notesForReview = document.getElementById("spNotes").value.trim();

    const dietChecks = document.querySelectorAll('input[name="spDiet"]:checked');
    const dietTags = Array.from(dietChecks).map(function (c) { return c.value; });

    if (!name || !type || !address || dietTags.length === 0) {
      showFormNote(
        "submitPlaceFeedback",
        "Please fill in the place name, type, address, and select at least one dietary category.",
        true
      );
      return;
    }

    const latVal = parseFloat(document.getElementById("spLatitude").value);
    const lonVal = parseFloat(document.getElementById("spLongitude").value);

    if (isNaN(latVal) || isNaN(lonVal)) {
      showFormNote(
        "submitPlaceFeedback",
        "Please provide latitude and longitude by clicking on the map or entering them manually.",
        true
      );
      setCoordFeedback("Latitude and longitude are required.");
      return;
    }

    if (!isValidCoords(latVal, lonVal)) {
      showFormNote(
        "submitPlaceFeedback",
        "Coordinates must be valid numbers (Latitude: -90 to 90, Longitude: -180 to 180).",
        true
      );
      setCoordFeedback("Please enter valid latitude (-90 to 90) and longitude (-180 to 180).");
      return;
    }

    setCoordFeedback("");

    const submitBtn = document.getElementById("submitPlaceBtn");
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;

    try {
      let uploadedImageUrl = "";

      if (selectedPhotoFile) {
        const progressCont = document.getElementById("spUploadProgressContainer");
        const progressBar = document.getElementById("spProgressBar");
        const progressPercent = document.getElementById("spUploadPercent");

        if (progressCont) progressCont.classList.remove("d-none");
        submitBtn.textContent = "Uploading photo…";

        const uploadResult = await uploadImageToCloudinary(selectedPhotoFile, {
          onProgress: function (pct) {
            if (progressBar) progressBar.style.width = pct + "%";
            if (progressPercent) progressPercent.textContent = pct + "%";
          }
        });

        if (!uploadResult.success) {
          showFormNote(
            "submitPlaceFeedback",
            "Photo upload failed: " + (uploadResult.error || "Please try again or remove photo.") + "",
            true
          );
          if (progressCont) progressCont.classList.add("d-none");
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
          return;
        }

        // Always hide upload progress container once photo upload phase completes
        if (progressCont) progressCont.classList.add("d-none");

        if (uploadResult.isMock) {
          // Cloudinary credentials not provisioned on this environment (demo mode).
          // Strictly prevent fake or blob URLs from being saved into the public database.
          uploadedImageUrl = "";
          showFormNote(
            "submitPlaceFeedback",
            "Notice: Photo was verified in demonstration mode (Cloudinary credentials pending setup). Listing will be submitted without an attached image.",
            false
          );
        } else {
          uploadedImageUrl = uploadResult.secureUrl || "";
        }
      }

      submitBtn.textContent = "Submitting place…";

      const res = await submitCommunityPlace({
        name: name,
        placeType: type,
        address: address,
        area: area,
        latitude: latVal,
        longitude: lonVal,
        dietTags: dietTags,
        priceRange: priceRange,
        description: description,
        notesForReview: notesForReview,
        imageUrl: uploadedImageUrl
      }, user);

      if (res.status === "ok") {
        showFormNote(
          "submitPlaceFeedback",
          "Thank you! Your place submission was saved to our pending review queue. Our team will verify and review it before it appears publicly on Explore.",
          false
        );
        form.reset();
        clearPhotoSelection();
        if (markerInstance && mapInstance && typeof mapInstance.removeLayer === "function") {
          mapInstance.removeLayer(markerInstance);
          markerInstance = null;
        }
      } else {
        showFormNote(
          "submitPlaceFeedback",
          res.message || "We could not save your submission right now. Please check your inputs and try again.",
          true
        );
      }
    } catch (err) {
      console.error("VeganSaathi: submission error", err);
      showFormNote(
        "submitPlaceFeedback",
        "An unexpected error occurred while saving your submission. Please try again.",
        true
      );
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      const progressCont = document.getElementById("spUploadProgressContainer");
      if (progressCont) progressCont.classList.add("d-none");
      const progressBar = document.getElementById("spProgressBar");
      if (progressBar) progressBar.style.width = "0%";
      const progressPercent = document.getElementById("spUploadPercent");
      if (progressPercent) progressPercent.textContent = "0%";
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  initCoordinateMap();
  wireSubmitPlaceForm();
  wirePhotoUpload();
  onAuthChange(updateGuardUI);
});
