/* ==========================================================================
   VeganSaathi — explore.js
   ============================================================================
   Task 5.3 — Explore reads real places through places-service.js
   (fetchPublishedPlaces()), not Firestore directly and not MOCK_PLACES.
   Firestore is queried exactly once per page load; search/filter/sort all
   run client-side against that cached array, matching the Phase 5 plan's
   "fetch once, filter in the browser" architecture (docs/PHASE_5_PLAN.md).

   No mock-data fallback anywhere in this file, including on error — see
   requirement 2/11 in the Task 5.3 brief.

   Task 5.4 — the map itself is now robust: a Leaflet layerGroup replaces
   manual marker-array tracking (see renderMapMarkers()), coordinates are
   revalidated against the same pilot bounds places-service.js already uses
   before a marker is ever created, and invalidateSize() is called every
   time the Map view becomes visible (not just the first time) — see
   wireViewToggle()'s mapViewBtn handler for why "every time" matters.

   Loaded as an ES module (<script type="module">) because it imports from
   places-service.js.
   ========================================================================== */

import { fetchPublishedPlaces, PILOT_BOUNDS } from "./places-service.js";

let vsAllPlaces = null; // null until the first successful load; [] is a valid "loaded, zero places" state
let vsActiveDietFilters = [];
let vsActivePlaceType = "";
let vsActivePriceRange = "";
let vsVerifiedOnly = false;
let vsMap = null;
let vsMarkersLayer = null; // Leaflet layerGroup — all current markers live here, cleared as a group on every re-render

document.addEventListener("DOMContentLoaded", function () {
  // Pre-fill search box from ?q= if the person searched from Home — this
  // doesn't depend on data having loaded yet.
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q");
  if (q) {
    document.getElementById("searchInput").value = q;
  }

  wireFilterChips();
  wireSearchAndSelects();
  wireViewToggle();
  setViewToggleEnabled(false); // nothing to show yet — re-enabled once data loads successfully

  loadPlaces();
});

async function loadPlaces() {
  showOnly("loadingState");

  let result;
  try {
    result = await fetchPublishedPlaces();
  } catch (error) {
    // fetchPublishedPlaces() is designed to catch its own errors and return
    // a status instead of throwing, but guard here too in case something
    // upstream (e.g. Firebase init itself) throws before that.
    console.error("VeganSaathi Explore: unexpected error loading places.", error);
    showOnly("errorState");
    return;
  }

  if (result.status === "permission-denied") {
    console.error("VeganSaathi Explore: Firestore denied the read (permission-denied). Check firebase/firestore.rules and that they're actually deployed.");
    showOnly("errorState");
    return;
  }

  if (result.status === "error") {
    console.error("VeganSaathi Explore: failed to load places.", result.error);
    showOnly("errorState");
    return;
  }

  // result.status === "ok"
  vsAllPlaces = sortPlaces(result.places);

  if (vsAllPlaces.length === 0) {
    showOnly("emptyDatabaseState");
    return;
  }

  showOnly("listView");
  setViewToggleEnabled(true);
  renderResults();
}

// Shows exactly one of the four top-level states; hides the other three.
// listView/mapView are handled as a pair by wireViewToggle() afterward —
// showOnly("listView") is the entry point once data is ready, defaulting to
// the list (matching the page's existing default List/Map toggle state).
function showOnly(stateId) {
  ["loadingState", "errorState", "emptyDatabaseState", "listView", "mapView"].forEach(function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("d-none", id !== stateId);
  });
}

function setViewToggleEnabled(enabled) {
  const listBtn = document.getElementById("listViewBtn");
  const mapBtn = document.getElementById("mapViewBtn");
  if (listBtn) listBtn.disabled = !enabled;
  if (mapBtn) mapBtn.disabled = !enabled;
}

/* ---------------- Sorting (Phase 5 D-decision: verified first, then most
   recently verified, then name — browser-side, no Firestore orderBy()) ---------------- */
function sortPlaces(places) {
  return places.slice().sort(function (a, b) {
    const aVerified = a.verificationStatus === "verified";
    const bVerified = b.verificationStatus === "verified";
    if (aVerified !== bVerified) return aVerified ? -1 : 1;

    if (aVerified && bVerified) {
      const aTime = a.lastVerifiedAt instanceof Date ? a.lastVerifiedAt.getTime() : 0;
      const bTime = b.lastVerifiedAt instanceof Date ? b.lastVerifiedAt.getTime() : 0;
      if (aTime !== bTime) return bTime - aTime; // most recently verified first
    }

    return a.name.localeCompare(b.name);
  });
}

function wireFilterChips() {
  document.querySelectorAll(".vs-filter-chip[data-diet]").forEach(function (chip) {
    chip.addEventListener("click", function () {
      const diet = chip.getAttribute("data-diet");
      chip.classList.toggle("active");
      if (chip.classList.contains("active")) {
        vsActiveDietFilters.push(diet);
      } else {
        vsActiveDietFilters = vsActiveDietFilters.filter(function (d) { return d !== diet; });
      }
      renderResults();
    });
  });

  const verifiedChip = document.getElementById("verifiedChip");
  verifiedChip.addEventListener("click", function () {
    vsVerifiedOnly = !vsVerifiedOnly;
    verifiedChip.classList.toggle("active");
    renderResults();
  });
}

function wireSearchAndSelects() {
  document.getElementById("searchInput").addEventListener("input", renderResults);
  document.getElementById("placeTypeSelect").addEventListener("change", function (e) {
    vsActivePlaceType = e.target.value;
    renderResults();
  });
  document.getElementById("priceSelect").addEventListener("change", function (e) {
    vsActivePriceRange = e.target.value;
    renderResults();
  });
}

function wireViewToggle() {
  document.getElementById("listViewBtn").addEventListener("click", function () {
    document.getElementById("listView").classList.remove("d-none");
    document.getElementById("mapView").classList.add("d-none");
    setToggleActive("listViewBtn", "mapViewBtn");
  });
  document.getElementById("mapViewBtn").addEventListener("click", function () {
    document.getElementById("listView").classList.add("d-none");
    document.getElementById("mapView").classList.remove("d-none");
    setToggleActive("mapViewBtn", "listViewBtn");
    try {
      initMapIfNeeded();
      renderMapMarkers(getFilteredPlaces());
      // Must run AFTER the container's d-none is removed (above), and on
      // EVERY switch back to Map view, not just the first: Leaflet sizes
      // itself from the container's dimensions at certain points, and a
      // container that was hidden via CSS in between can report a stale or
      // zero size otherwise, producing a squashed map with broken tiles.
      if (vsMap) {
        vsMap.invalidateSize();
      }
    } catch (err) {
      const mapEl = document.getElementById("vs-map");
      if (mapEl) {
        mapEl.innerHTML = '<p class="text-muted-vs p-3 mb-0">Map view is unavailable right now — try List view instead.</p>';
      }
      console.warn("VeganSaathi: explore map failed to initialize.", err);
    }
  });
}

function setToggleActive(activeId, inactiveId) {
  document.getElementById(activeId).classList.add("btn-vs-primary");
  document.getElementById(activeId).classList.remove("btn-vs-outline");
  document.getElementById(inactiveId).classList.add("btn-vs-outline");
  document.getElementById(inactiveId).classList.remove("btn-vs-primary");
}

function getFilteredPlaces() {
  if (!vsAllPlaces) return []; // data hasn't loaded (or load failed) — nothing to filter

  const searchTerm = document.getElementById("searchInput").value.trim().toLowerCase();

  return vsAllPlaces.filter(function (place) {
    if (searchTerm) {
      const haystack = (place.name + " " + place.area + " " + place.description).toLowerCase();
      if (haystack.indexOf(searchTerm) === -1) return false;
    }
    if (vsActiveDietFilters.length > 0) {
      const hasAll = vsActiveDietFilters.every(function (d) { return place.dietTags.indexOf(d) !== -1; });
      if (!hasAll) return false;
    }
    if (vsActivePlaceType && place.placeType !== vsActivePlaceType) return false;
    if (vsActivePriceRange && place.priceRange !== vsActivePriceRange) return false;
    if (vsVerifiedOnly && place.verificationStatus !== "verified") return false;
    return true;
  });
}

function renderResults() {
  if (!vsAllPlaces) return; // guard against a stray event before data loads

  const results = getFilteredPlaces();
  const container = document.getElementById("resultsGrid");
  const emptyState = document.getElementById("emptyState");
  const countLabel = document.getElementById("resultsCount");

  countLabel.textContent = results.length + (results.length === 1 ? " place found" : " places found");

  if (results.length === 0) {
    container.innerHTML = "";
    emptyState.classList.remove("d-none");
  } else {
    emptyState.classList.add("d-none");
    container.innerHTML = results.map(renderPlaceCard).join("");
  }

  if (vsMap) {
    try {
      renderMapMarkers(results);
    } catch (err) {
      console.warn("VeganSaathi: failed to refresh map markers.", err);
    }
  }
}

/* ---------------- Map (Leaflet + OpenStreetMap) ---------------- */
function initMapIfNeeded() {
  if (vsMap) return;
  // Centered roughly on Shegaon town.
  vsMap = L.map("vs-map").setView([20.7945, 76.6970], 14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19
  }).addTo(vsMap);
  // One layerGroup, created once, added to the map once. Markers are added
  // to and removed from THIS group (addLayer/clearLayers below) instead of
  // being tracked in a manual array and removed one at a time — the group
  // itself never needs to be touched again after this.
  vsMarkersLayer = L.layerGroup().addTo(vsMap);
}

// Revalidates a place's coordinates against the same pilot bounding box
// places-service.js's normalizePlace() already checked — belt-and-braces,
// not a reason to skip this: normalized data is still just data, and the
// map should never blindly trust a coordinate pair without checking it
// itself. Never "corrects" a bad coordinate — a place that fails this
// check simply gets no marker, while everything else about it (its card,
// its data) is untouched.
function isValidMapCoordinate(lat, lon) {
  if (typeof lat !== "number" || typeof lon !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  return (
    lat >= PILOT_BOUNDS.minLat && lat <= PILOT_BOUNDS.maxLat &&
    lon >= PILOT_BOUNDS.minLon && lon <= PILOT_BOUNDS.maxLon
  );
}

function renderMapMarkers(places) {
  // Clears every marker currently in the group in one call — this is what
  // actually prevents stale markers from a previous filter/search
  // accumulating on repeated List<->Map switches or filter changes.
  vsMarkersLayer.clearLayers();

  places.forEach(function (place) {
    if (!isValidMapCoordinate(place.latitude, place.longitude)) {
      // Skip only this marker; every other valid place still renders.
      console.warn(
        "VeganSaathi Explore: skipping map marker for \"" + place.name + "\" (id: " + place.id + ") — " +
        "coordinates (" + place.latitude + ", " + place.longitude + ") are outside the expected pilot area."
      );
      return;
    }

    const marker = L.marker([place.latitude, place.longitude]);
    marker.bindPopup(
      "<strong>" + escapeHtml(place.name) + "</strong><br>" +
      escapeHtml(capitalize(place.placeType)) + "<br>" +
      '<a href="' + escapeHtml(placeDetailsUrl(place.id)) + '">View details</a>'
    );
    vsMarkersLayer.addLayer(marker);
  });
}
