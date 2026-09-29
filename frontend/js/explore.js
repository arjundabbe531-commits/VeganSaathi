/* ==========================================================================
   VeganSaathi — explore.js
   Client-side search/filter over MOCK_PLACES, plus a Leaflet map view.
   No backend calls here — this all runs against in-memory mock data until
   Phase 5 replaces it with real Firestore queries.
   ========================================================================== */

let vsActiveDietFilters = [];
let vsActivePlaceType = "";
let vsActivePriceRange = "";
let vsVerifiedOnly = false;
let vsMap = null;
let vsMapMarkers = [];

document.addEventListener("DOMContentLoaded", function () {
  // Pre-fill search box from ?q= if the person searched from Home
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q");
  if (q) {
    document.getElementById("searchInput").value = q;
  }

  wireFilterChips();
  wireSearchAndSelects();
  wireViewToggle();
  renderResults();
});

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
  const searchTerm = document.getElementById("searchInput").value.trim().toLowerCase();

  return MOCK_PLACES.filter(function (place) {
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
}

function renderMapMarkers(places) {
  vsMapMarkers.forEach(function (m) { vsMap.removeLayer(m); });
  vsMapMarkers = [];

  // DEVELOPMENT MOCK DATA — replace with field-verified locations before final deployment.
  places.forEach(function (place) {
    const marker = L.marker([place.latitude, place.longitude]).addTo(vsMap);
    marker.bindPopup(
      "<strong>" + escapeHtml(place.name) + "</strong><br>" +
      escapeHtml(capitalize(place.placeType)) + "<br>" +
      '<a href="' + escapeHtml(placeDetailsUrl(place.id)) + '">View details</a>'
    );
    vsMapMarkers.push(marker);
  });
}
