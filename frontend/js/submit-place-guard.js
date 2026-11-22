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
import {
  validateImageFile,
  uploadImageToCloudinary,
  validateDirectImageUrl,
  uploadRemoteImageToCloudinary,
  isValidCloudinaryUrl
} from "./cloudinary-service.js";

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
let verifiedWebImageUrl = "";
let photoPreviewObjectUrl = null;

/**
 * Automatically downsizes / compresses large camera photos client-side
 * if they exceed the 5 MB limit. Uses HTML5 Canvas.
 */
function autoCompressImageFile(file, maxDimension = 1920, targetQuality = 0.82) {
  return new Promise((resolve) => {
    if (!file || typeof document === "undefined" || typeof FileReader === "undefined") {
      resolve(file);
      return;
    }
    // If already within size limits, keep as-is
    if (file.size <= 5 * 1024 * 1024) {
      resolve(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        if (typeof canvas.toBlob === "function") {
          canvas.toBlob(
            (blob) => {
              if (blob && blob.size < file.size) {
                const cleanName = (file.name || "photo.jpg").replace(/\.[^.]+$/, "") + ".jpg";
                const compressedFile = new File([blob], cleanName, {
                  type: "image/jpeg",
                  lastModified: Date.now()
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            "image/jpeg",
            targetQuality
          );
        } else {
          resolve(file);
        }
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

function clearPhotoSelection() {
  selectedPhotoFile = null;
  verifiedWebImageUrl = "";

  const fileInput = document.getElementById("spPhoto");
  if (fileInput) fileInput.value = "";

  const urlInput = document.getElementById("spImageUrlInput");
  if (urlInput) urlInput.value = "";

  const preview = document.getElementById("spPhotoPreviewContainer");
  if (preview) preview.classList.add("d-none");

  const previewImg = document.getElementById("spPhotoPreviewImg");
  if (previewImg) previewImg.src = "";

  const fileNameEl = document.getElementById("spPhotoFileName");
  if (fileNameEl) fileNameEl.textContent = "";

  const statusNoteEl = document.getElementById("spPhotoStatusNote");
  if (statusNoteEl) statusNoteEl.textContent = "Ready to attach to your submission.";

  const sourceBadgeEl = document.getElementById("spPhotoSourceBadge");
  if (sourceBadgeEl) {
    sourceBadgeEl.textContent = "Photo Attached";
    sourceBadgeEl.className = "badge bg-success text-white";
  }

  const feedback = document.getElementById("spPhotoFeedback");
  if (feedback) {
    feedback.textContent = "";
    feedback.classList.add("d-none");
    feedback.classList.remove("text-success", "text-danger");
  }

  const urlFeedback = document.getElementById("spUrlFeedback");
  if (urlFeedback) {
    urlFeedback.textContent = "";
    urlFeedback.classList.add("d-none");
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

async function handleLocalFile(rawFile) {
  const feedback = document.getElementById("spPhotoFeedback");
  const previewCont = document.getElementById("spPhotoPreviewContainer");
  const previewImg = document.getElementById("spPhotoPreviewImg");
  const fileNameEl = document.getElementById("spPhotoFileName");
  const statusNoteEl = document.getElementById("spPhotoStatusNote");
  const sourceBadgeEl = document.getElementById("spPhotoSourceBadge");

  if (!rawFile) return;

  let file = rawFile;
  let wasCompressed = false;

  if (file.size > 5 * 1024 * 1024) {
    if (feedback) {
      const origMb = (file.size / (1024 * 1024)).toFixed(1);
      feedback.textContent = `Optimizing high-resolution photo (${origMb} MB) for web upload…`;
      feedback.classList.remove("d-none", "text-danger");
      feedback.classList.add("text-success");
    }
    try {
      file = await autoCompressImageFile(rawFile);
      if (file.size < rawFile.size) {
        wasCompressed = true;
      }
    } catch (e) {
      console.warn("VeganSaathi: auto-compression bypassed", e);
    }
  }

  const validation = validateImageFile(file);
  if (!validation.valid) {
    if (feedback) {
      feedback.textContent = validation.error;
      feedback.classList.remove("d-none", "text-success");
      feedback.classList.add("text-danger");
    }
    clearPhotoSelection();
    return;
  }

  if (feedback) {
    feedback.textContent = "";
    feedback.classList.add("d-none");
    feedback.classList.remove("text-success", "text-danger");
  }

  // Clear any web URL when selecting a file
  verifiedWebImageUrl = "";
  const urlInput = document.getElementById("spImageUrlInput");
  if (urlInput) urlInput.value = "";

  selectedPhotoFile = file;

  if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    if (photoPreviewObjectUrl) URL.revokeObjectURL(photoPreviewObjectUrl);
    photoPreviewObjectUrl = URL.createObjectURL(file);
    if (previewImg) previewImg.src = photoPreviewObjectUrl;
  }

  if (fileNameEl) {
    fileNameEl.textContent = file.name;
    fileNameEl.title = file.name;
  }

  if (sourceBadgeEl) {
    sourceBadgeEl.textContent = wasCompressed ? "✓ Auto-Optimized" : "📁 Device Photo";
    sourceBadgeEl.className = "badge bg-success text-white";
  }

  const sizeKb = (file.size / 1024).toFixed(0);
  const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
  const sizeText = file.size >= 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;

  if (statusNoteEl) {
    statusNoteEl.textContent = `${sizeText} • Ready to attach`;
  }

  if (photoPreviewObjectUrl) {
    const measureImg = new Image();
    measureImg.onload = () => {
      if (statusNoteEl && measureImg.naturalWidth && measureImg.naturalHeight) {
        statusNoteEl.textContent = `${measureImg.naturalWidth} × ${measureImg.naturalHeight} px • ${sizeText} • Ready to submit`;
      }
    };
    measureImg.src = photoPreviewObjectUrl;
  }

  if (previewCont) previewCont.classList.remove("d-none");
}

function handleWebImageUrl(rawUrl) {
  const urlFeedback = document.getElementById("spUrlFeedback");
  const previewCont = document.getElementById("spPhotoPreviewContainer");
  const previewImg = document.getElementById("spPhotoPreviewImg");
  const fileNameEl = document.getElementById("spPhotoFileName");
  const statusNoteEl = document.getElementById("spPhotoStatusNote");
  const sourceBadgeEl = document.getElementById("spPhotoSourceBadge");

  const trimmed = (rawUrl || "").trim();
  if (!trimmed) {
    if (urlFeedback) {
      urlFeedback.textContent = "Please enter or paste an image URL.";
      urlFeedback.classList.remove("d-none");
      urlFeedback.style.color = "#8a2f2f";
    }
    return;
  }

  const validation = validateDirectImageUrl(trimmed);
  if (!validation.valid) {
    if (urlFeedback) {
      urlFeedback.textContent = validation.error;
      urlFeedback.classList.remove("d-none");
      urlFeedback.style.color = "#8a2f2f";
    }
    return;
  }

  if (urlFeedback) {
    urlFeedback.textContent = "Verifying direct image accessibility…";
    urlFeedback.classList.remove("d-none");
    urlFeedback.style.color = "#2f6b3f";
  }

  // Test loading image in the browser to ensure it's not a broken or 404/hotlinked-blocked URL
  const testImg = new Image();
  testImg.onload = function () {
    // Clear local file if any
    selectedPhotoFile = null;
    const fileInput = document.getElementById("spPhoto");
    if (fileInput) fileInput.value = "";
    if (photoPreviewObjectUrl && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(photoPreviewObjectUrl);
      photoPreviewObjectUrl = null;
    }

    verifiedWebImageUrl = trimmed;

    if (urlFeedback) {
      urlFeedback.textContent = "Image verified successfully!";
      urlFeedback.style.color = "#2f6b3f";
    }

    if (previewImg) previewImg.src = trimmed;

    if (sourceBadgeEl) {
      sourceBadgeEl.textContent = "🔗 Web Image";
      sourceBadgeEl.className = "badge bg-primary text-white";
    }

    let hostDisplay = "Web Image";
    try {
      const u = new URL(trimmed);
      const parts = u.pathname.split("/").filter(Boolean);
      hostDisplay = parts.pop() || u.hostname;
    } catch (e) {
      // fallback
    }

    if (fileNameEl) {
      fileNameEl.textContent = hostDisplay;
      fileNameEl.title = trimmed;
    }

    if (statusNoteEl) {
      statusNoteEl.textContent = `${testImg.naturalWidth} × ${testImg.naturalHeight} px • Verified web image`;
    }

    if (previewCont) previewCont.classList.remove("d-none");
  };

  testImg.onerror = function () {
    if (urlFeedback) {
      urlFeedback.textContent = "Unable to load image from this address. The link may be broken, private, or protected against direct hotlinking by the host server.";
      urlFeedback.style.color = "#8a2f2f";
    }
  };

  testImg.src = trimmed;
}

function wirePhotoUpload() {
  const fileInput = document.getElementById("spPhoto");
  const selectFileBtn = document.getElementById("spSelectFileBtn");
  const dropzone = document.getElementById("spDropzone");
  const removeBtn = document.getElementById("spRemovePhotoBtn");
  const urlInput = document.getElementById("spImageUrlInput");
  const verifyUrlBtn = document.getElementById("spVerifyUrlBtn");

  if (selectFileBtn && fileInput) {
    selectFileBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      fileInput.click();
    });
  }

  if (dropzone) {
    dropzone.setAttribute("tabindex", "0");
    dropzone.setAttribute("role", "button");
    dropzone.setAttribute("aria-label", "Click to select photo or drag and drop an image file");

    dropzone.addEventListener("click", function (e) {
      if (fileInput && e.target !== selectFileBtn) {
        fileInput.click();
      }
    });

    dropzone.addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " ") && fileInput) {
        e.preventDefault();
        fileInput.click();
      }
    });

    dropzone.addEventListener("dragover", function (e) {
      e.preventDefault();
      dropzone.classList.add("drag-active");
    });

    dropzone.addEventListener("dragleave", function (e) {
      e.preventDefault();
      dropzone.classList.remove("drag-active");
    });

    dropzone.addEventListener("drop", function (e) {
      e.preventDefault();
      dropzone.classList.remove("drag-active");

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleLocalFile(e.dataTransfer.files[0]);
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", function () {
      if (!fileInput.files || fileInput.files.length === 0) {
        clearPhotoSelection();
        return;
      }
      handleLocalFile(fileInput.files[0]);
    });
  }

  if (verifyUrlBtn && urlInput) {
    verifyUrlBtn.addEventListener("click", function () {
      handleWebImageUrl(urlInput.value);
    });

    urlInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        handleWebImageUrl(urlInput.value);
      }
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener("click", function () {
      clearPhotoSelection();
    });
  }

  const viewPreviewBtn = document.getElementById("spViewFullPreviewBtn");
  const previewImg = document.getElementById("spPhotoPreviewImg");
  const modalEl = document.getElementById("spPhotoFullPreviewModal");
  const modalImg = document.getElementById("spModalFullPreviewImg");
  const modalDetails = document.getElementById("spModalFullPreviewDetails");

  function openFullPreview() {
    const src = (previewImg && previewImg.src) || verifiedWebImageUrl || photoPreviewObjectUrl;
    if (!src || !modalEl || typeof bootstrap === "undefined") return;
    if (modalImg) modalImg.src = src;
    if (modalDetails) {
      const fileName = document.getElementById("spPhotoFileName")?.textContent || "Place photo";
      const statusNote = document.getElementById("spPhotoStatusNote")?.textContent || "";
      modalDetails.textContent = `${fileName} • ${statusNote}`;
    }
    const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
    modalInstance.show();
  }

  if (viewPreviewBtn) {
    viewPreviewBtn.addEventListener("click", openFullPreview);
  }
  if (previewImg) {
    previewImg.addEventListener("click", openFullPreview);
  }
}

function updateGuardUI(user) {
  const btn = document.getElementById("submitPlaceBtn");
  const note = document.getElementById("submitPlaceAuthNote");
  const authGate = document.getElementById("spAuthGate");
  const formContainer = document.getElementById("spFormContainer");

  const signedIn = !!user;

  if (authGate) {
    authGate.classList.toggle("d-none", signedIn);
  }
  if (formContainer) {
    formContainer.classList.toggle("d-none", !signedIn);
  }

  if (btn) {
    btn.disabled = !signedIn;
    btn.title = signedIn ? "" : "Sign in to submit a place";
  }
  if (note) {
    note.classList.toggle("d-none", signedIn);
  }
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
      } else if (verifiedWebImageUrl) {
        submitBtn.textContent = "Processing image…";
        try {
          const remoteResult = await uploadRemoteImageToCloudinary(verifiedWebImageUrl);
          if (remoteResult && remoteResult.success) {
            if (remoteResult.isMock) {
              // Cloudinary credentials not provisioned on this environment (demo mode).
              // Strictly prevent unhosted or raw external URLs from failing Firestore submission.
              uploadedImageUrl = "";
              showFormNote(
                "submitPlaceFeedback",
                "Notice: Web image address was verified in demonstration mode (Cloudinary credentials pending setup). Listing will be submitted without an attached image.",
                false
              );
            } else if (remoteResult.secureUrl && isValidCloudinaryUrl(remoteResult.secureUrl)) {
              uploadedImageUrl = remoteResult.secureUrl;
            } else {
              showFormNote(
                "submitPlaceFeedback",
                "Could not process image from the provided web address. Please try another address or upload from your device.",
                true
              );
              submitBtn.disabled = false;
              submitBtn.textContent = originalText;
              return;
            }
          } else {
            showFormNote(
              "submitPlaceFeedback",
              (remoteResult && remoteResult.error) || "Could not process image from the provided web address. Please try uploading from your device instead.",
              true
            );
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            return;
          }
        } catch (e) {
          showFormNote(
            "submitPlaceFeedback",
            "An error occurred while processing the image address. Please try uploading directly from your device.",
            true
          );
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
          return;
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
