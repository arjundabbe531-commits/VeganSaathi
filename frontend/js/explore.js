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

import { fetchPublishedPlaces, COORD_BOUNDS } from "./places-service.js";
import { requestUserLocation, sortByDistance, formatDistance, haversineKm, reverseGeocode } from "./geolocation.js";

let vsAllPlaces = null; // null until the first successful load; [] is a valid "loaded, zero places" state
let vsActiveDietFilters = [];
let vsActivePlaceType = "";
let vsActivePriceRange = "";
let vsVerifiedOnly = false;
let vsActiveMaxDistance = null;
let vsMap = null;
let vsMarkersLayer = null; // Leaflet layerGroup -- all current markers live here
let vsUserLocation = null; // { lat, lon } when the user has granted permission; null otherwise
let vsUserLocationDetails = null; // { road, area, city, formattedLocation } from reverse geocoding

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", function () {
    // Pre-fill filters from URL parameters if arriving from Home or shared link
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) {
      document.getElementById("searchInput").value = q;
    }
    const dietParam = params.get("diet");
    if (dietParam) {
      vsActiveDietFilters.push(dietParam);
      const chip = document.querySelector(`.vs-filter-chip[data-diet="${dietParam}"]`);
      if (chip) chip.classList.add("active");
    }
    const typeParam = params.get("type");
    if (typeParam) {
      vsActivePlaceType = typeParam;
      const typeSelect = document.getElementById("placeTypeSelect");
      if (typeSelect) typeSelect.value = typeParam;
    }
    const priceParam = params.get("price");
    if (priceParam) {
      vsActivePriceRange = priceParam;
      const priceSelect = document.getElementById("priceSelect");
      if (priceSelect) priceSelect.value = priceParam;
    }
    if (params.get("verified") === "true") {
      vsVerifiedOnly = true;
      const vChip = document.getElementById("verifiedChip");
      if (vChip) vChip.classList.add("active");
    }

    wireFilterChips();
    wireSearchAndSelects();
    wireViewToggle();
    wireLocationButton();
    wireRefreshButton();
    wireResetButtons();
    setViewToggleEnabled(false); // nothing to show yet -- re-enabled once data loads successfully

    loadPlaces(false);
  });
}

function wireRefreshButton() {
  const btn = document.getElementById("refreshPlacesBtn");
  if (!btn) return;

  btn.addEventListener("click", async function () {
    btn.disabled = true;
    const origHtml = btn.innerHTML;
    btn.innerHTML = "⏳ Refreshing…";
    try {
      await loadPlaces(true);
    } finally {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  });
}

async function loadPlaces(forceRefresh = false) {
  showOnly("loadingState");

  let result;
  try {
    result = await fetchPublishedPlaces({ forceRefresh: forceRefresh });
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

// Default sort: verified places first, then most recently verified, then name.
// When vsUserLocation is active, sortByDistance() overrides this before render.
function sortPlaces(places) {
  return places.slice().sort(function (a, b) {
    var aVerified = a.verificationStatus === "verified";
    var bVerified = b.verificationStatus === "verified";
    if (aVerified !== bVerified) return aVerified ? -1 : 1;

    if (aVerified && bVerified) {
      var aTime = a.lastVerifiedAt instanceof Date ? a.lastVerifiedAt.getTime() : 0;
      var bTime = b.lastVerifiedAt instanceof Date ? b.lastVerifiedAt.getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
    }

    return a.name.localeCompare(b.name);
  });
}

/* ---------------- Location button ---------------- */
function wireLocationButton() {
  var btn = document.getElementById("useMyLocationBtn");
  if (!btn) return; // button is optional; page works without it

  btn.addEventListener("click", async function () {
    btn.disabled = true;
    btn.textContent = "Getting precise location\u2026";

    var result = await requestUserLocation();

    if (result.status === "ok") {
      vsUserLocation = { lat: result.lat, lon: result.lon };

      // Reverse geocode to get road, area, city name
      const geoInfo = await reverseGeocode(result.lat, result.lon);
      if (geoInfo && geoInfo.ok) {
        vsUserLocationDetails = geoInfo;
      } else {
        vsUserLocationDetails = { formattedLocation: result.lat.toFixed(4) + ", " + result.lon.toFixed(4) };
      }

      const displayLoc = vsUserLocationDetails.area || vsUserLocationDetails.city || vsUserLocationDetails.road || "Location found";
      btn.textContent = "\u2713 Near " + displayLoc;
      btn.classList.add("btn-vs-primary");
      btn.classList.remove("btn-vs-outline");
      btn.disabled = false;

      var note = document.getElementById("locationNote");
      if (note) {
        note.innerHTML = '<span class="text-success fw-bold">📍 Active:</span> ' +
          escapeHtml(vsUserLocationDetails.formattedLocation || (result.lat.toFixed(4) + ", " + result.lon.toFixed(4)));
        note.classList.remove("d-none");
      }

      var distChips = document.getElementById("distanceChips");
      if (distChips) {
        distChips.classList.remove("d-none");
        distChips.classList.add("d-inline-flex");
      }

      renderResults();
    } else {
      btn.disabled = false;
      btn.textContent = "Use my location";
      var note = document.getElementById("locationNote");
      if (note) {
        note.textContent = result.message;
        note.classList.remove("d-none");
      }
    }
  });
}

function wireResetButtons() {
  const resetBtn = document.getElementById("resetFiltersBtn");
  const emptyResetBtn = document.getElementById("emptyResetBtn");

  function resetAllFilters() {
    const searchInput = document.getElementById("searchInput");
    if (searchInput) searchInput.value = "";
    const typeSelect = document.getElementById("placeTypeSelect");
    if (typeSelect) typeSelect.value = "";
    vsActivePlaceType = "";
    const priceSelect = document.getElementById("priceSelect");
    if (priceSelect) priceSelect.value = "";
    vsActivePriceRange = "";
    vsActiveDietFilters = [];
    document.querySelectorAll(".vs-filter-chip[data-diet]").forEach(function (c) {
      c.classList.remove("active");
    });
    vsVerifiedOnly = false;
    const vChip = document.getElementById("verifiedChip");
    if (vChip) vChip.classList.remove("active");
    vsActiveMaxDistance = null;
    document.querySelectorAll(".vs-dist-chip").forEach(function (c) {
      c.classList.remove("active");
    });

    renderResults();
  }

  if (resetBtn) resetBtn.addEventListener("click", resetAllFilters);
  if (emptyResetBtn) emptyResetBtn.addEventListener("click", resetAllFilters);
}

function wireFilterChips() {
  document.querySelectorAll(".vs-filter-chip[data-diet]").forEach(function (chip) {
    chip.addEventListener("click", function () {
      const diet = chip.getAttribute("data-diet");
      chip.classList.toggle("active");
      if (chip.classList.contains("active")) {
        if (!vsActiveDietFilters.includes(diet)) {
          vsActiveDietFilters.push(diet);
        }
      } else {
        vsActiveDietFilters = vsActiveDietFilters.filter(function (d) { return d !== diet; });
      }
      renderResults();
    });
  });

  const verifiedChip = document.getElementById("verifiedChip");
  if (verifiedChip) {
    verifiedChip.addEventListener("click", function () {
      vsVerifiedOnly = !vsVerifiedOnly;
      verifiedChip.classList.toggle("active");
      renderResults();
    });
  }

  document.querySelectorAll(".vs-dist-chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      const maxDist = Number(chip.getAttribute("data-max-dist"));
      if (vsActiveMaxDistance === maxDist) {
        vsActiveMaxDistance = null;
        chip.classList.remove("active");
      } else {
        document.querySelectorAll(".vs-dist-chip").forEach(function (c) { c.classList.remove("active"); });
        vsActiveMaxDistance = maxDist;
        chip.classList.add("active");
      }
      renderResults();
    });
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

export function matchesSearchTerm(place, term) {
  if (!term || typeof term !== "string" || !term.trim()) return true;
  const needle = term.trim().toLowerCase();

  const searchParts = [
    place.name,
    place.address,
    place.area,
    place.city,
    place.state,
    place.postalCode,
    place.placeType,
    place.description,
    place.dietNotes,
    place.verificationNote,
    place.veganClassification,
    Array.isArray(place.dietTags) ? place.dietTags.join(" ") : "",
    Array.isArray(place.evidenceRefs)
      ? place.evidenceRefs.map(function (ref) {
          return (ref.claim || "") + " " + (ref.excerpt || "");
        }).join(" ")
      : ""
  ];

  const haystack = searchParts.filter(Boolean).join(" ").toLowerCase();
  return haystack.indexOf(needle) !== -1;
}

function getFilteredPlaces() {
  if (!vsAllPlaces) return []; // data hasn't loaded (or load failed) — nothing to filter

  const searchTerm = document.getElementById("searchInput").value.trim().toLowerCase();

  return vsAllPlaces.filter(function (place) {
    if (searchTerm) {
      if (!matchesSearchTerm(place, searchTerm)) return false;
    }
    if (vsActiveDietFilters.length > 0) {
      const hasAll = vsActiveDietFilters.every(function (d) {
        if (d === "vegan") return isVeganDietVerified(place);
        return Array.isArray(place.dietTags) && place.dietTags.indexOf(d) !== -1;
      });
      if (!hasAll) return false;
    }
    if (vsActivePlaceType && place.placeType !== vsActivePlaceType) return false;
    if (vsActivePriceRange && place.priceRange !== vsActivePriceRange) return false;
    if (vsVerifiedOnly && place.verificationStatus !== "verified") return false;
    if (vsActiveMaxDistance && vsUserLocation) {
      if (!isValidMapCoordinate(place.latitude, place.longitude)) return false;
      const km = haversineKm(vsUserLocation, { lat: place.latitude, lon: place.longitude });
      if (km > vsActiveMaxDistance) return false;
    }
    return true;
  });
}

function renderResults() {
  if (!vsAllPlaces) return;

  const searchTerm = document.getElementById("searchInput")?.value.trim() || "";
  const resetBtn = document.getElementById("resetFiltersBtn");
  if (resetBtn) {
    const isFiltered = Boolean(
      searchTerm ||
      vsActivePlaceType ||
      vsActivePriceRange ||
      vsActiveDietFilters.length > 0 ||
      vsVerifiedOnly ||
      vsActiveMaxDistance !== null
    );
    resetBtn.classList.toggle("d-none", !isFiltered);
  }

  // If the user has shared their location, sort by distance; otherwise use verification sort.
  var results = vsUserLocation
    ? sortByDistance(getFilteredPlaces(), vsUserLocation)
    : getFilteredPlaces();

  var container = document.getElementById("resultsGrid");
  var emptyState = document.getElementById("emptyState");
  var countLabel = document.getElementById("resultsCount");

  var locLabel = vsUserLocation ? " (sorted by distance)" : "";
  countLabel.textContent = results.length + (results.length === 1 ? " place found" : " places found") + locLabel;

  if (results.length === 0) {
    container.innerHTML = "";
    emptyState.classList.remove("d-none");
  } else {
    emptyState.classList.add("d-none");
    container.innerHTML = results.map(function (place) {
      var km = vsUserLocation
        ? haversineKm(vsUserLocation, { lat: place.latitude, lon: place.longitude })
        : null;
      return renderPlaceCard(place, km);
    }).join("");
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
  // Default centre: geographic centre of India at a country-level zoom.
  // renderMapMarkers() will call fitBounds() to re-centre on actual results
  // if they have valid coordinates.
  vsMap = L.map("vs-map").setView([20.5937, 78.9629], 5);
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

// Validates a place's coordinates against the same global bounds
// places-service.js's normalizePlace() already checked — belt-and-braces.
// A place that fails is simply skipped on the map; its card is untouched.
function isValidMapCoordinate(lat, lon) {
  if (typeof lat !== "number" || typeof lon !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  return (
    lat >= COORD_BOUNDS.minLat && lat <= COORD_BOUNDS.maxLat &&
    lon >= COORD_BOUNDS.minLon && lon <= COORD_BOUNDS.maxLon
  );
}

function renderMapMarkers(places) {
  // Clears every marker currently in the group in one call
  vsMarkersLayer.clearLayers();

  var validBounds = [];

  // 1. If user location is active, pin user with distinctive marker
  if (vsUserLocation && isValidMapCoordinate(vsUserLocation.lat, vsUserLocation.lon)) {
    validBounds.push([vsUserLocation.lat, vsUserLocation.lon]);

    var userIcon = typeof L !== "undefined" && typeof L.divIcon === "function" ? L.divIcon({
      className: "vs-user-marker-wrap",
      html: '<div style="background-color:#0284c7; width:22px; height:22px; border-radius:50%; border:3px solid #ffffff; box-shadow:0 0 12px rgba(2,132,199,0.8); display:flex; align-items:center; justify-content:center; color:#fff; font-size:11px;">📍</div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    }) : undefined;

    var userMarker = userIcon
      ? L.marker([vsUserLocation.lat, vsUserLocation.lon], { icon: userIcon, zIndexOffset: 1000 })
      : L.marker([vsUserLocation.lat, vsUserLocation.lon], { zIndexOffset: 1000 });

    var userLocText = vsUserLocationDetails?.formattedLocation || (vsUserLocation.lat.toFixed(4) + ", " + vsUserLocation.lon.toFixed(4));
    userMarker.bindPopup(
      '<div style="min-width:180px;">' +
      '<strong style="color:#0284c7;">📍 You Are Here</strong><br>' +
      '<small class="text-muted-vs">' + escapeHtml(userLocText) + '</small>' +
      '</div>'
    );
    userMarker.bindTooltip("Your location (" + escapeHtml(userLocText) + ")", { permanent: false, direction: "top" });
    vsMarkersLayer.addLayer(userMarker);
  }

  // 2. Add each place marker with place name on map, road, area, details
  places.forEach(function (place) {
    if (!isValidMapCoordinate(place.latitude, place.longitude)) {
      return;
    }

    validBounds.push([place.latitude, place.longitude]);
    var marker = L.marker([place.latitude, place.longitude]);

    var locDetails = [place.area, place.city].filter(Boolean).join(", ");
    var distText = vsUserLocation
      ? '<div class="mt-1"><span class="badge bg-light text-success border">~' + escapeHtml(formatDistance(haversineKm(vsUserLocation, { lat: place.latitude, lon: place.longitude }))) + ' away</span></div>'
      : '';

    if (typeof marker.bindTooltip === "function") {
      marker.bindTooltip("<strong>" + escapeHtml(place.name) + "</strong>", { permanent: false, direction: "top" });
    }

    marker.bindPopup(
      '<div style="min-width:200px; padding:2px;">' +
      '<h4 style="font-size:1.02rem; margin-bottom:0.25rem; font-weight:700; color:var(--vs-green-900);">' + escapeHtml(place.name) + '</h4>' +
      '<div class="mb-1" style="font-size:0.82rem; color:#4a5568;">' +
      (locDetails ? '<div class="fw-semibold text-dark">📍 ' + escapeHtml(locDetails) + '</div>' : '') +
      '<div class="text-muted-vs" style="font-size:0.78rem;">' + escapeHtml(place.address) + '</div>' +
      '</div>' +
      '<div class="my-1.5">' + renderPlaceDietBadges(place) + '</div>' +
      distText +
      '<div class="mt-2 pt-1 border-top d-flex justify-content-between align-items-center gap-2">' +
      '<a href="' + escapeHtml(placeDetailsUrl(place.id)) + '" class="btn btn-vs-primary btn-sm py-1 px-2" style="font-size:0.78rem;">View Details →</a>' +
      '<a href="https://www.google.com/maps/search/?api=1&query=' + place.latitude + ',' + place.longitude + '" target="_blank" rel="noopener noreferrer" class="btn btn-outline-secondary btn-sm py-1 px-2" style="font-size:0.75rem;">Directions ↗</a>' +
      '</div>' +
      '</div>'
    );
    vsMarkersLayer.addLayer(marker);
  });

  // Fit the map to the markers so all results are visible
  if (validBounds.length > 0 && vsMap && typeof vsMap.fitBounds === "function") {
    try {
      vsMap.fitBounds(validBounds, { padding: [35, 35], maxZoom: 15 });
    } catch (err) {
      console.warn("VeganSaathi: fitBounds failed", err);
    }
  }
}
