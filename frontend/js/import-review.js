/* ==========================================================================
   VeganSaathi — frontend/js/import-review.js
   ============================================================================
   Client-side script for the Offline Research Import Reviewer.
   Provides interactive inspection of research validation reports with zero
   Firebase writes or external API dependencies.
   ========================================================================== */

// Embedded default sample datasets for instant zero-config exploration
const GEMINI_SAMPLE_REPORT = {
  inputFile: "research/master_package/places_app_import.csv",
  timestamp: "2026-10-24T00:15:00.000Z",
  summary: {
    totalRows: 4,
    importEligible: 0,
    blockedPreliminaryLeads: 4,
    errorCount: 5,
    warningCount: 4
  },
  records: [
    {
      rowIndex: 2,
      sourceId: "VS-IN-MH-SHG-0001",
      name: "Hotel Anand Pure Veg",
      placeType: "restaurant",
      address: "Station Road, opposite Railway Platform 1, Shegaon",
      area: "Station Road",
      city: "Shegaon",
      state: "Maharashtra",
      country: "India",
      postalCode: "444203",
      latitude: null,
      longitude: null,
      dietTags: ["vegetarian", "jain"],
      dietNotes: "Pure vegetarian thali; rotis can be requested without ghee. Online review mentions Jain meals available.",
      priceRange: "budget",
      verificationStatus: "unverified",
      lastVerifiedAt: "",
      source: "community",
      sourceUrls: "https://example.com/shegaon/anand-pure-veg",
      classification: "BLOCKED_PRELIMINARY_LEAD",
      blockers: [
        "Coordinates are missing or non-numeric (got lat: \"\", lon: \"\"). Record is blocked from public app import."
      ],
      advisories: [
        "Online desk research lead. In-person visit required for verification."
      ]
    },
    {
      rowIndex: 3,
      sourceId: "VS-IN-MH-SHG-0002",
      name: "Govinda Bhojanalay",
      placeType: "mess",
      address: "Near College Gate, Shegaon",
      area: "College Gate",
      city: "Shegaon",
      state: "Maharashtra",
      country: "India",
      postalCode: "444203",
      latitude: null,
      longitude: null,
      dietTags: ["vegetarian"],
      dietNotes: "Student dining hall / mess serving unlimited vegetarian thali. Dairy butter and curd served daily.",
      priceRange: "budget",
      verificationStatus: "unverified",
      lastVerifiedAt: "",
      source: "community",
      sourceUrls: "https://example.com/shegaon/govinda-bhojanalay",
      classification: "BLOCKED_PRELIMINARY_LEAD",
      blockers: [
        "Coordinates are missing or non-numeric (got lat: \"\", lon: \"\"). Record is blocked from public app import."
      ],
      advisories: [
        "Student mess lead. Coordinates must be established on campus."
      ]
    },
    {
      rowIndex: 4,
      sourceId: "VS-IN-MH-SHG-0003",
      name: "Surya Cafe & Tea Stall",
      placeType: "cafe",
      address: "Main Market, Gandhi Chowk, Shegaon",
      area: "Gandhi Chowk",
      city: "Shegaon",
      state: "Maharashtra",
      country: "India",
      postalCode: "444203",
      latitude: null,
      longitude: null,
      dietTags: ["vegetarian", "vegan"],
      dietNotes: "Tea made with buffalo milk; black tea and poha prepared in vegetable oil available.",
      priceRange: "budget",
      verificationStatus: "unverified",
      lastVerifiedAt: "",
      source: "community",
      sourceUrls: "https://example.com/shegaon/surya-cafe",
      classification: "BLOCKED_PRELIMINARY_LEAD",
      blockers: [
        "Coordinates are missing or non-numeric (got lat: \"\", lon: \"\"). Record is blocked from public app import."
      ],
      advisories: [
        "Poha in vegetable oil requires verification with food handler."
      ]
    },
    {
      rowIndex: 5,
      sourceId: "VS-IN-MH-SHG-0004",
      name: "Sai Refreshments",
      placeType: "canteen",
      address: "Khamgaon Road, Shegaon",
      area: "Khamgaon Road",
      city: "Shegaon",
      state: "Maharashtra",
      country: "India",
      postalCode: "444203",
      latitude: null,
      longitude: null,
      dietTags: [],
      dietNotes: "General snack stall.",
      priceRange: "budget",
      verificationStatus: "unverified",
      lastVerifiedAt: "",
      source: "community",
      sourceUrls: "https://example.com/shegaon/sai-refreshments",
      classification: "BLOCKED_PRELIMINARY_LEAD",
      blockers: [
        "Coordinates are missing or non-numeric (got lat: \"\", lon: \"\"). Record is blocked from public app import.",
        "At least one valid diet tag is required (vegan, vegetarian, eggetarian, jain)."
      ],
      advisories: []
    }
  ]
};

const SYNTHETIC_STAGING_REPORT = {
  inputFile: "research/sample_research_places.csv",
  timestamp: "2026-10-24T00:18:00.000Z",
  summary: {
    totalRows: 3,
    importEligible: 3,
    blockedPreliminaryLeads: 0,
    errorCount: 0,
    warningCount: 0
  },
  records: [
    {
      rowIndex: 2,
      sourceId: "RES-SYNTH-001",
      name: "Green Leaf Bistro",
      placeType: "restaurant",
      address: "Shop 4 FC Road Deccan Gymkhana",
      area: "Deccan",
      city: "Pune",
      state: "Maharashtra",
      country: "India",
      postalCode: "411004",
      latitude: 18.5186,
      longitude: 73.8415,
      dietTags: ["vegan", "vegetarian"],
      dietNotes: "100% vegan kitchen. All gravies made with cashew/tomato base, no dairy milk or butter used.",
      priceRange: "moderate",
      verificationStatus: "verified",
      lastVerifiedAt: "2026-10-15T11:30:00.000Z",
      verificationNote: "Physical team visit confirmed oil cooking and separate tawa",
      source: "fieldwork",
      submittedByName: "Research Team",
      sourceUrls: "https://example.com/greenleaf",
      classification: "IMPORT_ELIGIBLE",
      blockers: [],
      advisories: []
    },
    {
      rowIndex: 3,
      sourceId: "RES-SYNTH-002",
      name: "Anand Pure Veg",
      placeType: "restaurant",
      address: "Station Road opposite Railway Platform 1",
      area: "Station Road",
      city: "Shegaon",
      state: "Maharashtra",
      country: "India",
      postalCode: "444203",
      latitude: 20.7932,
      longitude: 76.6914,
      dietTags: ["vegetarian", "jain"],
      dietNotes: "Pure vegetarian restaurant. Uses dairy ghee in special thali; roti can be prepared without butter upon request.",
      priceRange: "budget",
      verificationStatus: "verified",
      lastVerifiedAt: "2026-10-16T14:00:00.000Z",
      verificationNote: "In-person check confirmed vegetarian and Jain preparation",
      source: "fieldwork",
      submittedByName: "Research Team",
      sourceUrls: "https://example.com/anand",
      classification: "IMPORT_ELIGIBLE",
      blockers: [],
      advisories: []
    },
    {
      rowIndex: 4,
      sourceId: "RES-SYNTH-003",
      name: "Coastal Spice Vegan Cafe",
      placeType: "cafe",
      address: "12 Bandra West",
      area: "Bandra West",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      postalCode: "400050",
      latitude: 19.0596,
      longitude: 72.8295,
      dietTags: ["vegan", "vegetarian"],
      dietNotes: "Soy milk and almond milk available for beverages. Vegan desserts made in-house.",
      priceRange: "moderate",
      verificationStatus: "unverified",
      lastVerifiedAt: "",
      verificationNote: "",
      source: "community",
      submittedByName: "Online Desk Research",
      sourceUrls: "https://example.com/coastalspice",
      classification: "IMPORT_ELIGIBLE",
      blockers: [],
      advisories: [
        "Online desk research lead. In-person visit required for verification."
      ]
    }
  ]
};

let currentReport = null;
let currentFilter = "all";

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function updateStats(records) {
  const total = records.length;
  const eligible = records.filter(r => r.classification === "IMPORT_ELIGIBLE").length;
  const advisories = records.filter(r => r.classification === "IMPORT_ELIGIBLE_WITH_ADVISORIES").length;
  const blocked = records.filter(r => r.classification === "BLOCKED_PRELIMINARY_LEAD").length;

  document.getElementById("statTotal").textContent = total;
  document.getElementById("statEligible").textContent = eligible;
  document.getElementById("statAdvisories").textContent = advisories;
  document.getElementById("statBlocked").textContent = blocked;
}

function renderRecords(records) {
  const container = document.getElementById("recordsContainer");
  const filtered = records.filter(r => {
    if (currentFilter === "all") return true;
    if (currentFilter === "eligible") return r.classification === "IMPORT_ELIGIBLE";
    if (currentFilter === "advisories") return r.classification === "IMPORT_ELIGIBLE_WITH_ADVISORIES";
    if (currentFilter === "blocked") return r.classification === "BLOCKED_PRELIMINARY_LEAD";
    return true;
  });

  document.getElementById("filterCount").textContent =
    `Showing ${filtered.length} of ${records.length} records`;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="vs-card p-4 text-center text-muted">
        <p class="mb-0">No records found matching the "${currentFilter}" filter.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(rec => {
    const isBlocked = rec.classification === "BLOCKED_PRELIMINARY_LEAD";
    const hasAdvisories = rec.classification === "IMPORT_ELIGIBLE_WITH_ADVISORIES";

    let cardClass = "status-eligible";
    let badgeClass = "badge-eligible";
    let statusText = "Ready for Staging";

    if (isBlocked) {
      cardClass = "status-blocked";
      badgeClass = "badge-blocked";
      statusText = "Blocked Preliminary Lead";
    } else if (hasAdvisories) {
      cardClass = "status-advisory";
      badgeClass = "badge-advisory";
      statusText = "Eligible with Advisories";
    }

    // Coordinates presentation
    const hasCoords = Number.isFinite(rec.latitude) && Number.isFinite(rec.longitude);
    const coordsBadge = hasCoords
      ? `<span class="badge bg-light text-dark border">📍 ${rec.latitude.toFixed(4)}, ${rec.longitude.toFixed(4)}</span>
         <a href="https://www.openstreetmap.org/?mlat=${rec.latitude}&mlon=${rec.longitude}#map=17/${rec.latitude}/${rec.longitude}"
            target="_blank" rel="noopener" class="small text-decoration-none ms-1">View Map ↗</a>`
      : `<span class="badge bg-danger">❌ Missing Coordinates</span>`;

    // Diet tags
    const dietBadges = (rec.dietTags || []).map(t => {
      const cls = t === "vegan" ? "bg-success" : (t === "jain" ? "bg-warning text-dark" : "bg-primary");
      return `<span class="badge ${cls} me-1 text-uppercase">${escapeHtml(t)}</span>`;
    }).join("") || `<span class="badge bg-secondary">No diet tags</span>`;

    // Verification distinction
    const isVerified = rec.verificationStatus === "verified";
    const verificationPill = isVerified
      ? `<span class="evidence-pill verification-pill-verified">✓ Physical Fieldwork Verified</span>`
      : `<span class="evidence-pill verification-pill-unverified">○ Online Research (Unverified)</span>`;

    // Dietary uncertainty alert
    const notesLower = (rec.dietNotes || "").toLowerCase();
    const hasDairyUncertainty = (rec.dietTags || []).includes("vegan") &&
      /(pure\s+veg|ghee|butter|paneer|milk|curd|dairy)/i.test(`${rec.name} ${notesLower}`) &&
      !/(vegan|plant[-\s]?based|dairy[-\s]?free|no\s+(ghee|butter)|without\s+butter|oil)/i.test(notesLower);

    return `
      <div class="card vs-card p-3 review-card ${cardClass} shadow-sm">
        <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
          <div>
            <span class="badge ${badgeClass} text-uppercase mb-1">${statusText}</span>
            <span class="text-muted ms-2 small">Row ${rec.rowIndex || "-"} &bull; ID: <code>${escapeHtml(rec.sourceId || rec.id)}</code></span>
            <h2 class="h5 mb-0 mt-1">${escapeHtml(rec.name)}</h2>
          </div>
          <div>
            ${verificationPill}
          </div>
        </div>

        <div class="row g-2 mb-2 small text-muted">
          <div class="col-md-6">
            <strong>Address:</strong> ${escapeHtml(rec.address || "No address provided")}
            ${rec.city ? `(${escapeHtml(rec.city)}, ${escapeHtml(rec.country || "")})` : ""}
          </div>
          <div class="col-md-6 text-md-end">
            ${coordsBadge}
          </div>
        </div>

        <div class="mb-2">
          <span class="small fw-bold text-muted me-2">Dietary:</span>
          ${dietBadges}
        </div>

        ${rec.dietNotes ? `
          <div class="p-2 rounded bg-light small mb-2 border-start border-3 border-success">
            <strong>Dietary Notes:</strong> ${escapeHtml(rec.dietNotes)}
          </div>
        ` : `
          <div class="p-2 rounded bg-light small mb-2 text-muted fst-italic">
            No dietary notes recorded.
          </div>
        `}

        ${hasDairyUncertainty ? `
          <div class="alert alert-warning py-1 px-2 small mb-2">
            ⚠️ <strong>Dietary Notice:</strong> Place is tagged "vegan" and identifies as pure-veg or mentions dairy ingredients without explicit confirmation of dairy-free items.
          </div>
        ` : ""}

        ${isVerified ? `
          <div class="small text-success mb-2">
            <strong>Visit Date:</strong> ${escapeHtml(rec.lastVerifiedAt || "Date missing")} &bull;
            <strong>Note:</strong> ${escapeHtml(rec.verificationNote || "No note recorded")}
          </div>
        ` : `
          <div class="small text-muted mb-2">
            <strong>Safety Constraint:</strong> This record cannot be marked "verified" in public Firestore listings until a team member physically inspects the kitchen.
          </div>
        `}

        ${rec.sourceUrls ? `
          <div class="small text-muted mb-2">
            <strong>Source URL:</strong> <a href="${escapeHtml(rec.sourceUrls)}" target="_blank" rel="noopener">${escapeHtml(rec.sourceUrls)}</a>
          </div>
        ` : ""}

        ${rec.blockers && rec.blockers.length > 0 ? `
          <div class="alert alert-danger py-2 px-3 small mb-2">
            <strong>🚫 Blocking Issues (${rec.blockers.length}):</strong>
            <ul class="mb-0 ps-3 mt-1">
              ${rec.blockers.map(b => `<li>${escapeHtml(b)}</li>`).join("")}
            </ul>
          </div>
        ` : ""}

        ${rec.advisories && rec.advisories.length > 0 ? `
          <div class="alert alert-warning py-2 px-3 small mb-0">
            <strong>⚠️ Advisories (${rec.advisories.length}):</strong>
            <ul class="mb-0 ps-3 mt-1">
              ${rec.advisories.map(a => `<li>${escapeHtml(a)}</li>`).join("")}
            </ul>
          </div>
        ` : ""}
      </div>
    `;
  }).join("");
}

function loadReport(report) {
  currentReport = report;
  updateStats(report.records || []);
  renderRecords(report.records || []);
}

function setupEventListeners() {
  document.getElementById("btnLoadSampleReport").addEventListener("click", () => {
    loadReport(GEMINI_SAMPLE_REPORT);
  });

  document.getElementById("btnLoadSampleStaging").addEventListener("click", () => {
    loadReport(SYNTHETIC_STAGING_REPORT);
  });

  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      currentFilter = e.target.getAttribute("data-filter");
      if (currentReport) {
        renderRecords(currentReport.records || []);
      }
    });
  });

  document.getElementById("reportFileInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        if (file.name.endsWith(".json")) {
          const parsed = JSON.parse(text);
          loadReport(parsed);
        } else {
          alert("CSV uploaded: please run scripts/validate-import.mjs to generate a comprehensive JSON report for inspection.");
        }
      } catch (err) {
        alert("Failed to parse report: " + err.message);
      }
    };
    reader.readAsText(file);
  });
}

// Auto-initialize with Gemini Sample Report on page load
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  loadReport(GEMINI_SAMPLE_REPORT);
});
