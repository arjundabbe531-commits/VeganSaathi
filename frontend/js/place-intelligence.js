/* ==========================================================================
   VeganSaathi — place-intelligence.js
   ============================================================================
   Admin-only Place Intelligence dashboard controller.
   Handles: source registry, import manifest loading, candidate management,
   verification workflow, duplicate review, photo moderation, quality reporting.

   Security: All writes guarded by admin role check (via admin-service.js).
   No data is published without explicit admin approval.
   No candidate is treated as a verified place.
   ========================================================================== */

import { getFirebaseDb, getFirebaseAuth } from "./firebase-init.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  orderBy,
  limit as firestoreLimit,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { isAdmin } from "./admin-service.js";

/* ---------- State ---------- */
let _currentAdmin = null;
let _currentManifest = null;
let _stagedCandidates = [];
let _selectedCandidateId = null;
let _qualityData = null;

/* ---------- Auth Gate ---------- */

function showScreen(id) {
  ["adminLoadingScreen", "adminUnauthorizedScreen", "adminMainContent"].forEach((s) => {
    const el = document.getElementById(s);
    if (el) {
      el.classList.toggle("d-none", el.id !== id);
    }
  });
}

onAuthStateChanged(getFirebaseAuth(), async (user) => {
  if (!user) {
    showScreen("adminUnauthorizedScreen");
    return;
  }
  const adminOk = await isAdmin(user);
  if (!adminOk) {
    showScreen("adminUnauthorizedScreen");
    return;
  }
  _currentAdmin = user;
  showScreen("adminMainContent");
  const badgeEl = document.getElementById("piUserBadge");
  if (badgeEl) badgeEl.textContent = "👤 " + (user.displayName || user.email || "Admin");
  initDashboard();
});

/* ---------- Initialisation ---------- */

function initDashboard() {
  initTabs();
  initImportControls();
  initCandidateFilters();
  initPhotoFilters();
  initPublishedSearch();
  initReverifyPolicy();
  loadKPIs();
  loadSourceRegistry();
  loadPublishedPlaces();
  loadQualityReport();
}

/* ---------- Tab navigation ---------- */

function initTabs() {
  const panes = document.querySelectorAll(".pi-pane");
  const buttons = document.querySelectorAll(".pi-tab-btn");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const paneId = "pane-" + btn.dataset.pane;
      panes.forEach((p) => p.classList.toggle("active", p.id === paneId));
      buttons.forEach((b) => b.classList.toggle("active", b === btn));
    });
  });
}

/* ---------- KPI Loading ---------- */

async function loadKPIs() {
  try {
    const db = getFirebaseDb();

    // Published places
    const placesSnap = await getDocs(
      query(collection(db, "places"), where("status", "==", "published"))
    );
    const publishedPlaces = [];
    placesSnap.forEach((d) => publishedPlaces.push({ id: d.id, ...d.data() }));

    // Pending places
    const pendingSnap = await getDocs(
      query(collection(db, "places"), where("status", "==", "pending"))
    );

    // Candidates (admin-only collection)
    const candidatesSnap = await getDocs(collection(db, "placeCandidates"));
    let dupeCount = 0;
    candidatesSnap.forEach((d) => {
      if (d.data().is_suspected_duplicate) dupeCount++;
    });

    const fullyVegan = publishedPlaces.filter(
      (p) => p.veganClassification === "fully_vegan"
    ).length;
    const veganFriendly = publishedPlaces.filter(
      (p) => p.veganClassification === "vegan_friendly"
    ).length;

    // Reverification needed: lastVerifiedAt > 90 days ago
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const reverifyCount = publishedPlaces.filter((p) => {
      if (!p.lastVerifiedAt) return false;
      const verifiedDate = p.lastVerifiedAt.toDate ? p.lastVerifiedAt.toDate() : new Date(p.lastVerifiedAt);
      return verifiedDate < ninetyDaysAgo;
    }).length;

    setKPI("kpiTotalCandidates", candidatesSnap.size);
    setKPI("kpiPendingReview", pendingSnap.size);
    setKPI("kpiFullyVegan", fullyVegan);
    setKPI("kpiVeganFriendly", veganFriendly);
    setKPI("kpiDuplicates", dupeCount);
    setKPI("kpiReverify", reverifyCount);
  } catch (err) {
    console.warn("place-intelligence: loadKPIs failed", err);
  }
}

function setKPI(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value !== undefined && value !== null ? String(value) : "—";
}

/* ---------- Source Registry ---------- */

async function loadSourceRegistry() {
  const container = document.getElementById("sourceRegistry");
  if (!container) return;

  try {
    const resp = await fetch("../../scripts/data-pipeline/source_registry.json");
    if (!resp.ok) throw new Error("Not found");
    const data = await resp.json();
    renderSourceRegistry(data.sources || [], container);
  } catch {
    // Fallback: render inline summary
    renderSourceRegistryFallback(container);
  }
}

function renderSourceRegistry(sources, container) {
  container.innerHTML = "";
  sources.forEach((src) => {
    const statusClass = {
      approved: "success",
      blocked: "danger",
      draft: "secondary",
      under_review: "warning",
      deprecated: "secondary",
    }[src.review_status] || "secondary";

    const costClass = src.cost_status && src.cost_status.startsWith("FREE") ? "success" :
      src.cost_status && src.cost_status.includes("BLOCKED") ? "danger" : "warning";

    const col = document.createElement("div");
    col.className = "col-md-6 col-xl-4";
    col.innerHTML = `
      <div class="vs-card p-3 h-100">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div class="fw-bold" style="font-size:0.9rem;">${escHtml(src.name)}</div>
          <span class="badge bg-${statusClass} ms-2" style="font-size:0.68rem;">${escHtml(src.review_status)}</span>
        </div>
        <div class="text-muted-vs mb-2" style="font-size:0.8rem;">${escHtml(src.provider || "")}</div>
        <div class="mb-2">
          <span class="badge bg-${costClass} bg-opacity-10 text-${costClass}" style="font-size:0.68rem; border:1px solid;">${escHtml((src.cost_status || "").split(" — ")[0])}</span>
        </div>
        <div style="font-size:0.78rem;" class="mb-2">
          <span class="text-muted-vs">Licence:</span>
          ${src.licence_url ? `<a href="${escHtml(src.licence_url)}" target="_blank" rel="noopener noreferrer">${escHtml(src.licence_name || src.licence || "?")}</a>` : escHtml(src.licence_name || src.licence || "?")}
        </div>
        <div style="font-size:0.78rem;" class="mb-2">
          <span class="text-muted-vs">Attribution:</span>
          ${escHtml((src.attribution_requirement || "").substring(0, 100))}${(src.attribution_requirement || "").length > 100 ? "…" : ""}
        </div>
        ${src.owner_action_required ? `<div class="alert alert-warning p-2 mt-2 mb-0" style="font-size:0.75rem;"><strong>Owner action required:</strong> ${escHtml(src.owner_action_required)}</div>` : ""}
        ${src.adapter_implemented ? `<div class="mt-2 text-success" style="font-size:0.75rem;">✅ Adapter implemented: <code>${escHtml(src.adapter_file || "")}</code></div>` : `<div class="mt-2 text-muted-vs" style="font-size:0.75rem;">— No adapter</div>`}
      </div>`;
    container.appendChild(col);
  });
}

function renderSourceRegistryFallback(container) {
  container.innerHTML = `
    <div class="col-12">
      <div class="alert alert-secondary" style="font-size:0.85rem;">
        Source registry file not accessible from browser.
        View <code>scripts/data-pipeline/source_registry.json</code> for the full source inventory.
        <br><br>
        <strong>Summary of approved sources:</strong>
        <ul class="mb-0 mt-2">
          <li>✅ <strong>Overture Maps</strong> — CDLA Permissive 2.0 — Free, no credentials needed</li>
          <li>✅ <strong>OpenStreetMap (Geofabrik)</strong> — ODbL 1.0 — Free, download PBF locally</li>
          <li>⚠️ <strong>Foursquare OS Places</strong> — Apache 2.0 — Free but requires owner registration at places.foursquare.com</li>
          <li>⚠️ <strong>Openverse Images</strong> — Per-image CC licences — Free API, verify each image individually</li>
          <li>⚠️ <strong>SHARAN India</strong> — Research leads only — no automated adapter</li>
          <li>🚫 <strong>HappyCow</strong> — BLOCKED — Terms prohibit scraping or competing database creation</li>
          <li>🚫 <strong>Google Places</strong> — BLOCKED — Terms prohibit bulk import and storage</li>
        </ul>
      </div>
    </div>`;
}

/* ---------- Import Manager ---------- */

function initImportControls() {
  const sourceSelect = document.getElementById("importSource");
  const modeSelect = document.getElementById("importMode");
  const scopeSelect = document.getElementById("importScope");
  const cmdEl = document.getElementById("importCommand");
  const copyBtn = document.getElementById("copyImportCmd");
  const loadBtn = document.getElementById("loadManifestBtn");

  function updateCommand() {
    if (!sourceSelect || !modeSelect || !cmdEl) return;
    const src = sourceSelect.value;
    const mode = modeSelect.value;
    const dryRun = mode === "dry_run" ? " --dry-run" : "";
    const baseCmd = "python scripts/data-pipeline/pipeline.py";

    let cmd = "";
    if (src === "overture") {
      cmd = `${baseCmd} overture${dryRun} --output data/processed/overture_mh_${_dateStr()}.ndjson`;
    } else if (src === "osm") {
      cmd = `${baseCmd} osm --pbf data/raw/osm/western-zone-latest.osm.pbf${dryRun}`;
    } else if (src === "foursquare") {
      cmd = `FSQ_ACCESS_TOKEN=<token> ${baseCmd} foursquare${dryRun}`;
    } else {
      cmd = `${baseCmd} all${dryRun}`;
    }
    cmdEl.textContent = cmd;
  }

  if (sourceSelect) sourceSelect.addEventListener("change", updateCommand);
  if (modeSelect) modeSelect.addEventListener("change", updateCommand);

  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const cmd = cmdEl ? cmdEl.textContent : "";
      navigator.clipboard.writeText(cmd).then(() => {
        copyBtn.textContent = "✅ Copied!";
        setTimeout(() => { copyBtn.textContent = "📋 Copy Command"; }, 2000);
      });
    });
  }

  // Manifest file loader
  const manifestInput = document.getElementById("manifestFileInput");
  const candidatesInput = document.getElementById("candidatesFileInput");

  if (loadBtn) {
    loadBtn.addEventListener("click", async () => {
      if (!manifestInput || !manifestInput.files.length) {
        showAlert("Please select a manifest JSON file.", "warning");
        return;
      }
      try {
        const manifestText = await readFile(manifestInput.files[0]);
        _currentManifest = JSON.parse(manifestText);
        renderManifestPreview(_currentManifest);

        if (candidatesInput && candidatesInput.files.length) {
          const candidatesText = await readFile(candidatesInput.files[0]);
          _stagedCandidates = candidatesText
            .split("\n")
            .filter((l) => l.trim())
            .map((l) => { try { return JSON.parse(l); } catch { return null; } })
            .filter(Boolean);
          renderCandidateTable(_stagedCandidates);
        }
      } catch (err) {
        showAlert("Failed to parse manifest: " + err.message, "danger");
      }
    });
  }

  // Stage batch button
  const stageBtn = document.getElementById("stageBatchBtn");
  if (stageBtn) {
    stageBtn.addEventListener("click", () => stageCandidatesToFirestore());
  }
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function renderManifestPreview(manifest) {
  const preview = document.getElementById("manifestPreview");
  if (preview) preview.classList.remove("d-none");

  const kpisEl = document.getElementById("manifestKpis");
  if (kpisEl) {
    kpisEl.innerHTML = [
      { label: "Source", value: manifest.source_id },
      { label: "Batch ID", value: (manifest.batch_id || "").substring(0, 24) + "…" },
      { label: "Extraction Date", value: manifest.extraction_date },
      { label: "Status", value: manifest.import_status },
      { label: "Input Records", value: manifest.input_count },
      { label: "Candidates", value: manifest.candidate_count },
      { label: "Rejected", value: manifest.rejected_count },
      { label: "Errors", value: manifest.error_count },
      { label: "Licence", value: manifest.licence },
    ].map(({ label, value }) => `
      <div class="col-md-4 col-lg-3">
        <div class="pi-stat-card">
          <div class="pi-stat-label">${escHtml(label)}</div>
          <div class="fw-bold" style="font-size:0.9rem;">${escHtml(String(value ?? "—"))}</div>
        </div>
      </div>`).join("");
  }
}

function renderCandidateTable(candidates) {
  const tableEl = document.getElementById("candidatePreviewTable");
  if (!tableEl) return;

  if (!candidates.length) {
    tableEl.innerHTML = `<div class="text-muted-vs text-center py-3">No candidates loaded.</div>`;
    return;
  }

  const rows = candidates.slice(0, 50).map((c) => `
    <tr class="candidate-row" data-id="${escHtml(c.candidate_id || "")}">
      <td style="font-size:0.82rem;">${escHtml(c.name || "—")}</td>
      <td style="font-size:0.82rem;">${escHtml(c.city || "—")}</td>
      <td><span class="source-badge ${sourceBadgeClass(c.source_id)}">${escHtml(sourceShortName(c.source_id))}</span></td>
      <td><span class="evidence-strength ${c.vegan_signal_strength || "none"}">${escHtml(c.vegan_signal_strength || "none")}</span></td>
      <td style="font-size:0.75rem;" class="text-muted-vs">${(c.vegan_signals || []).slice(0, 2).map((s) => `<span class="signal-pill">${escHtml(s)}</span>`).join("")}</td>
      <td>
        <span class="${c.has_coordinates ? "text-success" : "text-danger"}" title="Coordinates">📍</span>
        <span class="${c.has_address ? "text-success" : "text-danger"}" title="Address">🏠</span>
        <span class="${c.has_website ? "text-success" : "text-muted-vs"}" title="Website">🌐</span>
      </td>
    </tr>`).join("");

  tableEl.innerHTML = `
    <div style="overflow-x:auto; max-height:400px; overflow-y:auto;">
      <table class="table table-sm table-hover" style="font-size:0.82rem;">
        <thead class="sticky-top bg-white">
          <tr>
            <th>Name</th><th>City</th><th>Source</th>
            <th>Vegan Signal</th><th>Signals</th><th>Quality</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${candidates.length > 50 ? `<div class="text-muted-vs text-center mt-2" style="font-size:0.8rem;">Showing first 50 of ${candidates.length} candidates.</div>` : ""}`;
}

async function stageCandidatesToFirestore() {
  if (!_stagedCandidates.length) {
    showAlert("No candidates loaded.", "warning");
    return;
  }
  if (!_currentAdmin) {
    showAlert("Not authenticated.", "danger");
    return;
  }

  const db = getFirebaseDb();
  let written = 0;
  let skipped = 0;
  const BATCH_SIZE = 50;

  showAlert(`Staging ${_stagedCandidates.length} candidates to Firestore…`, "info");

  for (let i = 0; i < _stagedCandidates.length; i += BATCH_SIZE) {
    const chunk = _stagedCandidates.slice(i, i + BATCH_SIZE);
    for (const c of chunk) {
      if (!c.candidate_id) { skipped++; continue; }
      try {
        const candidateRef = doc(db, "placeCandidates", c.candidate_id);
        const existing = await getDoc(candidateRef);
        if (existing.exists()) {
          // Idempotent: skip exact duplicates
          skipped++;
          continue;
        }
        await setDoc(candidateRef, {
          ...c,
          stagedAt: serverTimestamp(),
          stagedBy: _currentAdmin.uid,
          import_status: "staged",
        });
        written++;
      } catch (err) {
        console.error("Failed to stage candidate:", c.candidate_id, err);
        skipped++;
      }
    }
  }

  showAlert(
    `Staged ${written} candidates (${skipped} skipped — already exist or invalid).`,
    written > 0 ? "success" : "warning"
  );
  loadKPIs();
}

/* ---------- Candidate List ---------- */

function initCandidateFilters() {
  const filterBtn = document.getElementById("candidateFilterBtn");
  if (filterBtn) filterBtn.addEventListener("click", () => loadCandidates());
}

async function loadCandidates() {
  const listEl = document.getElementById("candidateList");
  if (!listEl) return;

  if (_stagedCandidates.length) {
    // Show from staged memory if available
    const city = document.getElementById("candidateCityFilter")?.value.toLowerCase();
    const src = document.getElementById("candidateSourceFilter")?.value;
    const veganStrength = document.getElementById("candidateVeganFilter")?.value;
    const search = document.getElementById("candidateSearch")?.value.toLowerCase();

    let filtered = _stagedCandidates.filter((c) => {
      if (city && !(c.city || "").toLowerCase().includes(city)) return false;
      if (src && c.source_id !== src) return false;
      if (veganStrength && c.vegan_signal_strength !== veganStrength) return false;
      if (search && !(c.name || "").toLowerCase().includes(search) && !(c.address || "").toLowerCase().includes(search)) return false;
      return true;
    });

    renderCandidateListFull(filtered, listEl);
    return;
  }

  // Load from Firestore
  listEl.innerHTML = `<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-secondary"></div></div>`;
  try {
    const db = getFirebaseDb();
    const snap = await getDocs(query(collection(db, "placeCandidates"), firestoreLimit(100)));
    const candidates = [];
    snap.forEach((d) => candidates.push({ id: d.id, ...d.data() }));
    if (candidates.length === 0) {
      listEl.innerHTML = `<div class="text-muted-vs text-center py-5" style="font-size:0.9rem;"><div style="font-size:2.5rem;" class="mb-3">🔍</div>No candidates in queue. Load a pilot file from the Import tab.</div>`;
    } else {
      renderCandidateListFull(candidates, listEl);
    }
  } catch (err) {
    listEl.innerHTML = `<div class="alert alert-danger">Failed to load candidates: ${escHtml(err.message)}</div>`;
  }
}

function renderCandidateListFull(candidates, container) {
  if (!candidates.length) {
    container.innerHTML = `<div class="text-muted-vs text-center py-4">No candidates match the current filters.</div>`;
    return;
  }

  const rows = candidates.slice(0, 100).map((c) => `
    <div class="vs-card p-3 mb-2 candidate-row" data-id="${escHtml(c.candidate_id || c.id || "")}">
      <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
        <div>
          <div class="fw-bold" style="font-size:0.9rem;">${escHtml(c.name || "Unnamed")}</div>
          <div class="text-muted-vs" style="font-size:0.8rem;">${escHtml(c.address || "No address")} · ${escHtml(c.city || "")}</div>
        </div>
        <div class="d-flex gap-1 flex-wrap">
          <span class="source-badge ${sourceBadgeClass(c.source_id)}">${escHtml(sourceShortName(c.source_id))}</span>
          <span class="evidence-strength ${c.vegan_signal_strength || "none"}">${escHtml(c.vegan_signal_strength || "none")} signal</span>
          ${c.is_suspected_duplicate ? `<span class="badge bg-warning text-dark">Possible Duplicate</span>` : ""}
        </div>
      </div>
      ${(c.vegan_signals || []).length ? `<div class="mt-2">${(c.vegan_signals || []).slice(0, 4).map((s) => `<span class="signal-pill">${escHtml(s)}</span>`).join("")}</div>` : ""}
      <div class="d-flex gap-2 mt-2 flex-wrap">
        ${c.has_website && c.website ? `<a href="${escHtml(c.website)}" target="_blank" rel="noopener noreferrer" class="btn btn-xs btn-outline-secondary" style="font-size:0.72rem;padding:0.1rem 0.5rem;">🌐 Website</a>` : ""}
        <button class="btn btn-xs btn-outline-secondary" onclick="openVerificationPanel('${escHtml(c.candidate_id || c.id || "")}')" style="font-size:0.72rem;padding:0.1rem 0.5rem;">✅ Verify</button>
      </div>
    </div>`).join("");

  container.innerHTML = rows;
  if (candidates.length > 100) {
    container.innerHTML += `<div class="text-muted-vs text-center mt-2" style="font-size:0.8rem;">Showing first 100 of ${candidates.length} candidates.</div>`;
  }
}

/* ---------- Verification Panel ---------- */

window.openVerificationPanel = function(candidateId) {
  // Switch to verification tab
  document.querySelector('[data-pane="verification"]')?.click();
  _selectedCandidateId = candidateId;

  const candidate = _stagedCandidates.find((c) => (c.candidate_id || c.id) === candidateId);
  if (!candidate) return;

  const panel = document.getElementById("verificationPanel");
  if (panel) panel.classList.remove("d-none");

  // Populate identity
  const identityEl = document.getElementById("vp-identity");
  if (identityEl) {
    identityEl.innerHTML = `
      <table class="table table-sm table-borderless" style="font-size:0.85rem;">
        <tr><td class="text-muted-vs" style="width:35%;">Name</td><td class="fw-bold">${escHtml(candidate.name || "—")}</td></tr>
        <tr><td class="text-muted-vs">Address</td><td>${escHtml(candidate.address || "—")}</td></tr>
        <tr><td class="text-muted-vs">City</td><td>${escHtml(candidate.city || "—")}</td></tr>
        <tr><td class="text-muted-vs">Coordinates</td><td>${candidate.latitude ? `${candidate.latitude.toFixed(5)}, ${candidate.longitude.toFixed(5)}` : "—"}</td></tr>
        <tr><td class="text-muted-vs">Website</td><td>${candidate.website ? `<a href="${escHtml(candidate.website)}" target="_blank" rel="noopener noreferrer">${escHtml(candidate.website)}</a>` : "—"}</td></tr>
        <tr><td class="text-muted-vs">Phone</td><td>${escHtml(candidate.phone || "—")}</td></tr>
        <tr><td class="text-muted-vs">Category</td><td>${escHtml(candidate.source_category || "—")} → ${escHtml(candidate.mapped_place_type || "—")}</td></tr>
      </table>`;
  }

  // Evidence
  const evidenceEl = document.getElementById("vp-evidence");
  if (evidenceEl) {
    const signals = candidate.vegan_signals || [];
    evidenceEl.innerHTML = `
      <div class="mb-2">
        <span class="evidence-strength ${candidate.vegan_signal_strength || "none"}">${escHtml(candidate.vegan_signal_strength || "none")} signal strength</span>
      </div>
      ${signals.length ? `<div class="mb-2">${signals.map((s) => `<span class="signal-pill">${escHtml(s)}</span>`).join("")}</div>` : `<div class="text-muted-vs" style="font-size:0.82rem;">No vegan signals found in source data.</div>`}
      <div class="alert alert-warning p-2 mt-2" style="font-size:0.8rem;">
        ⚠️ Source signals are discovery clues, not verification. Manual review of the actual menu or business is required.
      </div>`;
  }

  // Provenance
  const provenanceEl = document.getElementById("vp-provenance");
  if (provenanceEl) {
    const srcIds = candidate.upstream_source_ids || {};
    provenanceEl.innerHTML = `
      <table class="table table-sm table-borderless" style="font-size:0.82rem;">
        <tr><td class="text-muted-vs" style="width:35%;">Source</td><td>${escHtml(candidate.source_id || "—")}</td></tr>
        <tr><td class="text-muted-vs">Licence</td><td>${escHtml(candidate.licence || "—")}</td></tr>
        <tr><td class="text-muted-vs">Attribution</td><td>${escHtml(candidate.source_attribution || "—")}</td></tr>
        <tr><td class="text-muted-vs">Collected</td><td>${escHtml(candidate.collection_date || "—")}</td></tr>
        ${Object.entries(srcIds).map(([k, v]) => `<tr><td class="text-muted-vs">${escHtml(k)}</td><td><code style="font-size:0.75rem;">${escHtml(String(v))}</code></td></tr>`).join("")}
      </table>`;
  }

  // Wire approval buttons
  const approveBtn = document.getElementById("vd-approve-btn");
  if (approveBtn) {
    approveBtn.onclick = () => approveCandidate(candidate);
  }
  const rejectBtn = document.getElementById("vd-reject-btn");
  if (rejectBtn) {
    rejectBtn.onclick = () => rejectCandidate(candidate);
  }
};

async function approveCandidate(candidate) {
  const veganClass = document.getElementById("vd-vegan-class")?.value;
  const existence = document.getElementById("vd-existence")?.value;
  const operating = document.getElementById("vd-operating")?.value;
  const evidenceStatus = document.getElementById("vd-evidence")?.value;
  const evidenceUrl = document.getElementById("vd-evidence-url")?.value?.trim();
  const notes = document.getElementById("vd-notes")?.value?.trim();

  if (!notes || notes.length < 10) {
    showResult("vd-action-result", "Reviewer notes are required (minimum 10 characters).", "warning");
    return;
  }
  if (!veganClass || veganClass === "vegan_status_unverified") {
    if (!confirm("You are approving a place as 'Unverified'. Are you sure this should be published?")) return;
  }

  if (!_currentAdmin) return;
  const db = getFirebaseDb();

  try {
    // Create the published place record from candidate
    const placeData = {
      name: candidate.name || "",
      placeType: candidate.mapped_place_type || "other",
      address: candidate.address || "",
      area: candidate.area || "Area not listed",
      city: candidate.city || "",
      district: candidate.district || "",
      state: candidate.state || "Maharashtra",
      country: candidate.country || "India",
      postalCode: candidate.postal_code || "",
      latitude: candidate.latitude || 0,
      longitude: candidate.longitude || 0,
      dietTags: ["vegan"],
      description: candidate.description || "",
      website: candidate.website || "",
      phone: candidate.phone || "",
      imageUrl: "",
      status: "published",
      verificationStatus: "verified",
      veganClassification: veganClass,
      existenceStatus: existence || "candidate",
      operatingStatus: operating || "unknown",
      evidenceStatus: evidenceStatus || "no_vegan_evidence",
      evidenceUrl: evidenceUrl || "",
      verificationNote: notes,
      source: "import",
      sourceId: candidate.source_id || "",
      sourceLicence: candidate.licence || "",
      sourceAttribution: candidate.source_attribution || "",
      upstreamSourceIds: candidate.upstream_source_ids || {},
      candidateId: candidate.candidate_id || "",
      batchId: candidate.batch_id || "",
      submittedBy: _currentAdmin.uid,
      submittedByName: _currentAdmin.displayName || "Admin",
      lastVerifiedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const placeRef = await addDoc(collection(db, "places"), placeData);

    // Record verification history
    await addDoc(collection(db, "verificationHistory"), {
      placeId: placeRef.id,
      candidateId: candidate.candidate_id || "",
      veganClassification: veganClass,
      existenceStatus: existence,
      operatingStatus: operating,
      evidenceStatus: evidenceStatus,
      evidenceUrl: evidenceUrl || "",
      notes: notes,
      reviewerUid: _currentAdmin.uid,
      reviewerName: _currentAdmin.displayName || "Admin",
      decision: "approved",
      timestamp: serverTimestamp(),
    });

    // Update candidate status
    if (candidate.candidate_id) {
      try {
        await updateDoc(doc(db, "placeCandidates", candidate.candidate_id), {
          import_status: "approved",
          approvedPlaceId: placeRef.id,
          approvedBy: _currentAdmin.uid,
          approvedAt: serverTimestamp(),
        });
      } catch {}
    }

    showResult("vd-action-result", `✅ Place approved and published (ID: ${placeRef.id})`, "success");
    loadKPIs();
  } catch (err) {
    showResult("vd-action-result", "Failed to publish: " + err.message, "danger");
  }
}

async function rejectCandidate(candidate) {
  const notes = document.getElementById("vd-notes")?.value?.trim();
  if (!notes || notes.length < 5) {
    showResult("vd-action-result", "Please add rejection notes before rejecting.", "warning");
    return;
  }
  if (!confirm("Reject this candidate? It will be removed from the verification queue.")) return;

  const db = getFirebaseDb();
  try {
    if (candidate.candidate_id) {
      await updateDoc(doc(db, "placeCandidates", candidate.candidate_id), {
        import_status: "rejected",
        rejectionNotes: notes,
        rejectedBy: _currentAdmin?.uid,
        rejectedAt: serverTimestamp(),
      });
    }
    showResult("vd-action-result", "Candidate rejected.", "secondary");
  } catch (err) {
    showResult("vd-action-result", "Failed to reject: " + err.message, "danger");
  }
}

/* ---------- Published Places ---------- */

function initPublishedSearch() {
  const btn = document.getElementById("publishedFilterBtn");
  if (btn) btn.addEventListener("click", () => loadPublishedPlaces());
}

async function loadPublishedPlaces() {
  const listEl = document.getElementById("publishedList");
  if (!listEl) return;
  listEl.innerHTML = `<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-secondary"></div></div>`;

  try {
    const db = getFirebaseDb();
    const snap = await getDocs(
      query(collection(db, "places"), where("status", "==", "published"), firestoreLimit(200))
    );
    const places = [];
    snap.forEach((d) => places.push({ id: d.id, ...d.data() }));

    if (!places.length) {
      listEl.innerHTML = `<div class="text-muted-vs text-center py-5" style="font-size:0.9rem;"><div style="font-size:2.5rem;" class="mb-3">🌿</div>No published places yet.</div>`;
      return;
    }

    const city = document.getElementById("publishedCity")?.value.toLowerCase();
    const veganClass = document.getElementById("publishedVeganClass")?.value;
    const search = document.getElementById("publishedSearch")?.value.toLowerCase();

    let filtered = places.filter((p) => {
      if (city && !(p.city || "").toLowerCase().includes(city)) return false;
      if (veganClass && p.veganClassification !== veganClass) return false;
      if (search && !(p.name || "").toLowerCase().includes(search)) return false;
      return true;
    });

    listEl.innerHTML = filtered.slice(0, 100).map((p) => `
      <div class="vs-card p-3 mb-2 d-flex justify-content-between align-items-start gap-2 flex-wrap">
        <div>
          <div class="fw-bold" style="font-size:0.9rem;">${escHtml(p.name || "—")}</div>
          <div class="text-muted-vs" style="font-size:0.8rem;">${escHtml(p.address || "")} · ${escHtml(p.city || "")}</div>
          <div class="mt-1">
            <span class="vegan-badge ${p.veganClassification || "unverified"}">${escHtml(formatVeganClass(p.veganClassification))}</span>
          </div>
        </div>
        <button class="btn btn-xs btn-outline-secondary" style="font-size:0.72rem;padding:0.15rem 0.5rem;" onclick="editPublishedPlace('${p.id}')">✏️ Edit</button>
      </div>`).join("") + (filtered.length > 100 ? `<div class="text-muted-vs text-center mt-2" style="font-size:0.8rem;">Showing 100 of ${filtered.length} places.</div>` : "");
  } catch (err) {
    listEl.innerHTML = `<div class="alert alert-danger">Failed to load: ${escHtml(err.message)}</div>`;
  }
}

window.editPublishedPlace = function(placeId) {
  // Navigate to admin dashboard for editing (existing functionality)
  window.location.href = `dashboard.html#place-${placeId}`;
};

/* ---------- Photo Moderation ---------- */

function initPhotoFilters() {
  document.querySelectorAll("[data-photo-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-photo-filter]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      loadPhotos(btn.dataset.photoFilter);
    });
  });
}

async function loadPhotos(filter) {
  const listEl = document.getElementById("photoList");
  if (!listEl) return;
  listEl.innerHTML = `<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-secondary"></div></div>`;

  try {
    const db = getFirebaseDb();
    const q = filter === "missing"
      ? query(collection(db, "places"), where("status", "==", "published"), where("imageUrl", "==", ""))
      : query(collection(db, "placePhotos"), where("approval_status", "==",
          filter === "approved" ? "approved" :
          filter === "rejected" ? "rejected" :
          filter === "removal" ? "removal_requested" : "pending"
        ));

    const snap = await getDocs(q);
    if (snap.empty) {
      listEl.innerHTML = `<div class="text-muted-vs text-center py-5">No ${filter} photos.</div>`;
      return;
    }

    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));

    listEl.innerHTML = `<div class="row g-3">${items.slice(0, 50).map((item) => renderPhotoCard(item, filter)).join("")}</div>`;
  } catch (err) {
    listEl.innerHTML = `<div class="alert alert-danger">Failed to load photos: ${escHtml(err.message)}</div>`;
  }
}

function renderPhotoCard(item, filter) {
  return `
    <div class="col-md-6 col-lg-4">
      <div class="vs-card p-3">
        <div class="d-flex gap-3 mb-2">
          ${item.temp_url || item.cloudinary_url
            ? `<img src="${escHtml(item.temp_url || item.cloudinary_url)}" class="photo-thumb" alt="Photo submission" onerror="this.style.display='none'">`
            : `<div class="photo-thumb-placeholder">📷</div>`}
          <div style="font-size:0.82rem;">
            <div class="fw-bold">${escHtml(item.photo_category || "Unknown category")}</div>
            <div class="text-muted-vs">${escHtml(item.submitter_name || "Unknown")}</div>
            <div class="text-muted-vs">${escHtml(item.submission_type || "")}</div>
          </div>
        </div>
        <div class="mb-2" style="font-size:0.78rem;">
          <span class="text-muted-vs">Rights:</span>
          ${item.is_original_work ? `<span class="text-success">Original work</span>` : `<span class="text-warning">Permission claimed</span>`}
          ${item.rights_holder ? ` · ${escHtml(item.rights_holder)}` : ""}
        </div>
        ${filter === "pending" ? `
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-vs-primary" onclick="approvePhoto('${item.id}')">✅ Approve</button>
            <button class="btn btn-sm btn-outline-danger" onclick="rejectPhoto('${item.id}')">❌ Reject</button>
          </div>` : ""}
      </div>
    </div>`;
}

window.approvePhoto = async function(photoId) {
  if (!_currentAdmin) return;
  const db = getFirebaseDb();
  try {
    await updateDoc(doc(db, "placePhotos", photoId), {
      approval_status: "approved",
      approving_admin_uid: _currentAdmin.uid,
      approval_timestamp: serverTimestamp(),
    });
    showAlert("Photo approved.", "success");
    loadPhotos("pending");
  } catch (err) {
    showAlert("Failed to approve photo: " + err.message, "danger");
  }
};

window.rejectPhoto = async function(photoId) {
  const reason = prompt("Rejection reason:");
  if (!reason) return;
  const db = getFirebaseDb();
  try {
    await updateDoc(doc(db, "placePhotos", photoId), {
      approval_status: "rejected",
      rejection_reason: reason,
      approving_admin_uid: _currentAdmin?.uid,
      approval_timestamp: serverTimestamp(),
    });
    showAlert("Photo rejected.", "secondary");
    loadPhotos("pending");
  } catch (err) {
    showAlert("Failed to reject photo: " + err.message, "danger");
  }
};

/* ---------- Reverify Manager ---------- */

function initReverifyPolicy() {
  const warnInput = document.getElementById("reverifyWarnDays");
  const reviewInput = document.getElementById("reverifyReviewDays");
  const saveBtn = document.getElementById("saveReverifyPolicy");

  function updateDisplay() {
    document.getElementById("warnDaysDisplay").textContent = warnInput?.value || "90";
    document.getElementById("reviewDaysDisplay").textContent = reviewInput?.value || "180";
  }
  if (warnInput) warnInput.addEventListener("input", updateDisplay);
  if (reviewInput) reviewInput.addEventListener("input", updateDisplay);
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      showAlert("Policy saved (applies to next reverification scan).", "success");
      loadReverifyQueue(parseInt(warnInput?.value || 90), parseInt(reviewInput?.value || 180));
    });
  }

  loadReverifyQueue(90, 180);
}

async function loadReverifyQueue(warnDays, reviewDays) {
  const listEl = document.getElementById("reverifyList");
  if (!listEl) return;

  try {
    const db = getFirebaseDb();
    const snap = await getDocs(
      query(collection(db, "places"), where("status", "==", "published"), firestoreLimit(200))
    );

    const now = Date.now();
    const warnMs = warnDays * 24 * 60 * 60 * 1000;
    const reviewMs = reviewDays * 24 * 60 * 60 * 1000;
    const needsReverify = [];

    snap.forEach((d) => {
      const data = { id: d.id, ...d.data() };
      if (!data.lastVerifiedAt) return;
      const verifiedTs = data.lastVerifiedAt.toDate ? data.lastVerifiedAt.toDate().getTime() : 0;
      const age = now - verifiedTs;
      if (age > reviewMs) {
        needsReverify.push({ ...data, urgency: "review_required", ageDays: Math.round(age / 86400000) });
      } else if (age > warnMs) {
        needsReverify.push({ ...data, urgency: "warning", ageDays: Math.round(age / 86400000) });
      }
    });

    if (!needsReverify.length) {
      listEl.innerHTML = `<div class="text-muted-vs text-center py-5"><div style="font-size:2.5rem;" class="mb-3">✅</div>No records currently require reverification.</div>`;
      return;
    }

    listEl.innerHTML = needsReverify.map((p) => `
      <div class="vs-card p-3 mb-2 ${p.urgency === "review_required" ? "reverify-urgent" : "reverify-warning"}">
        <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
          <div>
            <div class="fw-bold" style="font-size:0.9rem;">${escHtml(p.name || "—")}</div>
            <div class="text-muted-vs" style="font-size:0.8rem;">${escHtml(p.city || "")} · ${p.ageDays} days since last verification</div>
          </div>
          <div class="d-flex gap-1">
            <span class="badge ${p.urgency === "review_required" ? "bg-danger" : "bg-warning text-dark"}">${p.urgency === "review_required" ? "Review Required" : "Warning"}</span>
          </div>
        </div>
      </div>`).join("");
  } catch (err) {
    listEl.innerHTML = `<div class="alert alert-danger">Failed to load: ${escHtml(err.message)}</div>`;
  }
}

/* ---------- Quality Report ---------- */

async function loadQualityReport() {
  try {
    const db = getFirebaseDb();
    const snap = await getDocs(
      query(collection(db, "places"), where("status", "==", "published"))
    );
    const places = [];
    snap.forEach((d) => places.push({ id: d.id, ...d.data() }));

    const counts = {
      total: places.length,
      fullyVegan: 0, veganFriendly: 0, verifiedOptions: 0, unverified: 0,
      withCoords: 0, withAddress: 0, withWebsite: 0, withPhoto: 0,
      byCity: {}, byClass: {},
    };

    for (const p of places) {
      const vc = p.veganClassification || "unverified";
      if (vc === "fully_vegan") counts.fullyVegan++;
      else if (vc === "vegan_friendly") counts.veganFriendly++;
      else if (vc === "verified_vegan_options") counts.verifiedOptions++;
      else counts.unverified++;

      if (p.latitude && p.longitude) counts.withCoords++;
      if (p.address) counts.withAddress++;
      if (p.website) counts.withWebsite++;
      if (p.imageUrl) counts.withPhoto++;

      const city = p.city || "Unknown";
      counts.byCity[city] = (counts.byCity[city] || 0) + 1;
      counts.byClass[vc] = (counts.byClass[vc] || 0) + 1;
    }

    renderQualityReport(counts);
  } catch (err) {
    console.warn("Quality report failed:", err);
  }
}

function renderQualityReport(counts) {
  const kpisEl = document.getElementById("qualityKpis");
  if (kpisEl) {
    kpisEl.innerHTML = [
      { label: "Total Published", value: counts.total },
      { label: "Fully Vegan", value: counts.fullyVegan },
      { label: "Vegan Friendly", value: counts.veganFriendly },
      { label: "Unverified Status", value: counts.unverified },
      { label: "With Coordinates", value: `${counts.withCoords} / ${counts.total}` },
      { label: "With Photo", value: `${counts.withPhoto} / ${counts.total}` },
    ].map(({ label, value }) => `
      <div class="col-6 col-md-4 col-xl-2">
        <div class="pi-stat-card"><div class="pi-stat-label">${escHtml(label)}</div><div class="pi-stat-value">${escHtml(String(value))}</div></div>
      </div>`).join("");
  }

  const classEl = document.getElementById("qualityByClassification");
  if (classEl) {
    classEl.innerHTML = Object.entries(counts.byClass)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="vegan-badge ${k}">${escHtml(formatVeganClass(k))}</span>
          <div class="d-flex align-items-center gap-2">
            <div class="bg-secondary bg-opacity-25 rounded" style="width:${Math.min(v / (counts.total || 1) * 200, 120)}px;height:6px;"></div>
            <span class="fw-bold" style="font-size:0.85rem;">${v}</span>
          </div>
        </div>`).join("") || `<div class="text-muted-vs" style="font-size:0.85rem;">No data yet.</div>`;
  }

  const cityEl = document.getElementById("qualityByCity");
  if (cityEl) {
    const max = Math.max(...Object.values(counts.byCity), 1);
    cityEl.innerHTML = Object.entries(counts.byCity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([city, count]) => `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span style="font-size:0.85rem;">${escHtml(city)}</span>
          <div class="d-flex align-items-center gap-2">
            <div style="background:var(--vs-green-600);opacity:0.5;border-radius:3px;width:${Math.min(count / max * 150, 150)}px;height:6px;"></div>
            <span class="fw-bold" style="font-size:0.85rem;">${count}</span>
          </div>
        </div>`).join("") || `<div class="text-muted-vs" style="font-size:0.85rem;">No data yet.</div>`;
  }

  const fieldEl = document.getElementById("qualityFieldCompleteness");
  if (fieldEl && counts.total > 0) {
    const pct = (n) => Math.round(n / counts.total * 100);
    fieldEl.innerHTML = [
      { label: "Coordinates", value: pct(counts.withCoords) },
      { label: "Address", value: pct(counts.withAddress) },
      { label: "Website", value: pct(counts.withWebsite) },
      { label: "Photo", value: pct(counts.withPhoto) },
    ].map(({ label, value }) => `
      <div class="mb-3">
        <div class="d-flex justify-content-between mb-1">
          <span style="font-size:0.82rem;">${escHtml(label)}</span>
          <span class="fw-bold" style="font-size:0.82rem;">${value}%</span>
        </div>
        <div class="progress" style="height:6px;">
          <div class="progress-bar bg-success" style="width:${value}%;"></div>
        </div>
      </div>`).join("");
  } else if (fieldEl) {
    fieldEl.innerHTML = `<div class="text-muted-vs" style="font-size:0.85rem;">No published places to measure.</div>`;
  }

  const gapEl = document.getElementById("qualityEvidenceGap");
  if (gapEl) {
    gapEl.innerHTML = `
      <div class="alert alert-info p-3" style="font-size:0.82rem;">
        <strong>Important distinction:</strong><br>
        <ul class="mb-0 mt-1">
          <li><strong>${counts.total}</strong> total published places</li>
          <li><strong>${counts.fullyVegan}</strong> fully vegan verified</li>
          <li><strong>${counts.veganFriendly}</strong> vegan friendly verified</li>
          <li><strong>${counts.unverified}</strong> published with unverified status</li>
          <li><strong>${counts.withPhoto}</strong> with approved photograph</li>
        </ul>
        <div class="mt-2">Total candidates ≠ verified vegan coverage. Only verified records represent actual vegan places.</div>
      </div>`;
  }
}

/* ---------- Utility ---------- */

function showAlert(msg, type) {
  const el = document.getElementById("piAlert");
  if (!el) return;
  el.className = `alert alert-${type} mb-4`;
  el.textContent = msg;
  el.classList.remove("d-none");
  setTimeout(() => el.classList.add("d-none"), 6000);
}

function showResult(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = `<div class="alert alert-${type} p-2 mt-2" style="font-size:0.85rem;">${escHtml(msg)}</div>`;
}

function escHtml(str) {
  if (!str && str !== 0) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sourceBadgeClass(sourceId) {
  if (!sourceId) return "community";
  if (sourceId.includes("overture")) return "overture";
  if (sourceId.includes("openstreetmap")) return "osm";
  if (sourceId.includes("foursquare")) return "foursquare";
  return "community";
}

function sourceShortName(sourceId) {
  if (!sourceId) return "Community";
  if (sourceId.includes("overture")) return "Overture";
  if (sourceId.includes("openstreetmap")) return "OSM";
  if (sourceId.includes("foursquare")) return "Foursquare";
  return "Community";
}

function formatVeganClass(cls) {
  return {
    fully_vegan: "Fully Vegan",
    vegan_friendly: "Vegan Friendly",
    verified_vegan_options: "Verified Options",
    vegan_status_unverified: "Unverified",
    vegan_claim_conflicting: "Conflicting",
    unverified: "Unverified",
  }[cls] || cls || "Unverified";
}

function _dateStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

document.getElementById("refreshStatsBtn")?.addEventListener("click", () => {
  loadKPIs();
  loadQualityReport();
});

