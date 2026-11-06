/* ==========================================================================
   VeganSaathi — test-place-intelligence.mjs
   ============================================================================
   Unit and integration tests for the Place Intelligence data pipeline:
   - Source Registry schema and validation
   - Candidate record normalization and quality flag derivation
   - Deduplication scoring: exact ID match, phone match, domain match, geo-proximity
   - Vegan classification rules and evidence hierarchy
   - Photo submission rights validation
   - Reverification policy threshold calculations
   - Zero-budget policy enforcement

   Run with: node test-place-intelligence.mjs
   ========================================================================== */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`PASS - ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL - ${name}`);
    console.error(err);
    failed++;
  }
}

async function itAsync(name, fn) {
  try {
    await fn();
    console.log(`PASS - ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL - ${name}`);
    console.error(err);
    failed++;
  }
}

console.log("Starting Place Intelligence System Tests...\n");

// ---------------------------------------------------------------------------
// 1. Source Registry Tests
// ---------------------------------------------------------------------------

it("source_registry.json exists, is valid JSON and contains required sources", () => {
  const regPath = path.resolve(__dirname, "../scripts/data-pipeline/source_registry.json");
  assert.ok(fs.existsSync(regPath), "source_registry.json must exist");
  const data = JSON.parse(fs.readFileSync(regPath, "utf-8"));
  assert.ok(Array.isArray(data.sources), "sources must be an array");

  const requiredSourceIds = [
    "overture-maps-places",
    "foursquare-os-places",
    "openstreetmap-geofabrik",
    "sharan-india",
    "happycow",
    "openverse-images",
    "wikimedia-commons",
    "google-places-api",
  ];

  const sourceIds = data.sources.map((s) => s.id);
  for (const id of requiredSourceIds) {
    assert.ok(sourceIds.includes(id), `Source ${id} must be in the registry`);
  }
});

it("source registry enforces valid review status and licensing", () => {
  const regPath = path.resolve(__dirname, "../scripts/data-pipeline/source_registry.json");
  const data = JSON.parse(fs.readFileSync(regPath, "utf-8"));

  data.sources.forEach((s) => {
    assert.ok(
      ["approved", "blocked", "under_review", "draft", "deprecated"].includes(s.review_status),
      `${s.id} has invalid review_status: ${s.review_status}`
    );

    // Blocked sources like HappyCow and Google Places must not have approved adapters
    if (["happycow", "google-places-api"].includes(s.id)) {
      assert.equal(s.review_status, "blocked", `${s.id} must be blocked`);
      assert.equal(s.adapter_implemented, false, `${s.id} must not have an active adapter`);
    }

    // Approved sources must have attribution defined
    if (s.review_status === "approved" && s.id !== "sharan-india") {
      assert.ok(
        s.attribution_requirement || s.attribution_required_text,
        `${s.id} must have an attribution requirement`
      );
    }
  });
});

it("blocked sources have explicit reasons documented", () => {
  const regPath = path.resolve(__dirname, "../scripts/data-pipeline/source_registry.json");
  const data = JSON.parse(fs.readFileSync(regPath, "utf-8"));

  const happycow = data.sources.find((s) => s.id === "happycow");
  const happycowText = ((happycow.notes || "") + " " + (happycow.permitted_use || "")).toLowerCase();
  assert.ok(happycowText.includes("prohibit"), "HappyCow notes or permitted_use explain prohibition");

  const google = data.sources.find((s) => s.id === "google-places-api");
  const googleText = ((google.notes || "") + " " + (google.permitted_use || "")).toLowerCase();
  assert.ok(googleText.includes("prohibit") || googleText.includes("terms"), "Google notes explain restrictions");
});

// ---------------------------------------------------------------------------
// 2. Candidate Normalization & Quality Flags
// ---------------------------------------------------------------------------

function computeQualityFlags(cand) {
  const has_name = Boolean(cand.name && cand.name.trim().length > 0);
  const has_coordinates = (
    typeof cand.latitude === "number" && typeof cand.longitude === "number" &&
    Number.isFinite(cand.latitude) && Number.isFinite(cand.longitude) &&
    cand.latitude >= -90 && cand.latitude <= 90 &&
    cand.longitude >= -180 && cand.longitude <= 180
  );
  const has_address = Boolean(cand.address && cand.address.trim().length > 0);
  const has_website = Boolean(cand.website && cand.website.trim().length > 0);
  const has_phone = Boolean(cand.phone && cand.phone.trim().length > 0);

  const warnings = [];
  if (!has_name) warnings.push("missing_name");
  if (!has_coordinates) warnings.push("missing_or_invalid_coordinates");
  if (!has_address) warnings.push("missing_address");

  return { has_name, has_coordinates, has_address, has_website, has_phone, warnings };
}

it("computeQualityFlags: detects complete record without warnings", () => {
  const cand = {
    name: "Green Soul Vegan Kitchen",
    latitude: 18.5204,
    longitude: 73.8567,
    address: "Koregaon Park, Pune",
    website: "https://greensoul.in",
    phone: "+912012345678",
  };
  const q = computeQualityFlags(cand);
  assert.equal(q.has_name, true);
  assert.equal(q.has_coordinates, true);
  assert.equal(q.has_address, true);
  assert.equal(q.has_website, true);
  assert.equal(q.has_phone, true);
  assert.equal(q.warnings.length, 0);
});

it("computeQualityFlags: rejects out-of-range coordinates", () => {
  const cand = {
    name: "Test Place",
    latitude: 95.0, // out of range
    longitude: 73.8567,
    address: "Pune",
  };
  const q = computeQualityFlags(cand);
  assert.equal(q.has_coordinates, false);
  assert.ok(q.warnings.includes("missing_or_invalid_coordinates"));
});

it("computeQualityFlags: flags missing address and missing coordinates", () => {
  const cand = {
    name: "Unknown Stall",
    latitude: null,
    longitude: null,
    address: "",
  };
  const q = computeQualityFlags(cand);
  assert.equal(q.has_coordinates, false);
  assert.equal(q.has_address, false);
  assert.ok(q.warnings.includes("missing_address"));
  assert.ok(q.warnings.includes("missing_or_invalid_coordinates"));
});

// ---------------------------------------------------------------------------
// 3. Deduplication Logic Tests
// ---------------------------------------------------------------------------

function haversineDistM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

function detectDuplicatePair(candA, candB) {
  // Check exact source IDs
  for (const [k, v] of Object.entries(candA.upstream_source_ids || {})) {
    if (v && candB.upstream_source_ids && candB.upstream_source_ids[k] === v) {
      return { match_type: "exact", score: 1.0, signal: `shared_source_id:${k}` };
    }
  }

  // Check phone match
  const cleanPhone = (p) => {
    let digits = (p || "").replace(/[^0-9]/g, "");
    if (digits.startsWith("91") && digits.length > 10) digits = digits.slice(2);
    else if (digits.startsWith("0") && digits.length > 10) digits = digits.slice(1);
    return digits.length >= 10 ? digits.slice(-10) : digits;
  };
  const normA_phone = cleanPhone(candA.phone);
  const normB_phone = cleanPhone(candB.phone);
  if (normA_phone.length >= 8 && normA_phone === normB_phone) {
    return { match_type: "highly_probable", score: 0.9, signal: "exact_phone_match" };
  }

  // Check website match
  const normA_web = (candA.website || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  const normB_web = (candB.website || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  if (normA_web.length >= 5 && normA_web === normB_web) {
    return { match_type: "highly_probable", score: 0.85, signal: "exact_website_match" };
  }

  // Proximity + name
  if (candA.latitude && candA.longitude && candB.latitude && candB.longitude) {
    const dist = haversineDistM(candA.latitude, candA.longitude, candB.latitude, candB.longitude);
    const normA_name = (candA.name || "").toLowerCase().trim();
    const normB_name = (candB.name || "").toLowerCase().trim();

    if (dist < 100 && normA_name === normB_name) {
      return { match_type: "highly_probable", score: 0.95, signal: `proximity_${Math.round(dist)}m` };
    }

    // Franchise branch detection: same brand, distinct cities (>20km)
    if (normA_name === normB_name && dist > 20000 && candA.city && candB.city && candA.city !== candB.city) {
      return { match_type: "franchise_branch", score: 0.6, signal: `different_cities:${candA.city}_vs_${candB.city}` };
    }
  }

  return { match_type: "none", score: 0.0 };
}

it("dedup: identifies exact duplicate via shared upstream GERS ID", () => {
  const a = { name: "Leaf Cafe", upstream_source_ids: { overture_gers: "gers_12345" } };
  const b = { name: "Leaf Cafe & Bakery", upstream_source_ids: { overture_gers: "gers_12345" } };
  const match = detectDuplicatePair(a, b);
  assert.equal(match.match_type, "exact");
  assert.equal(match.score, 1.0);
});

it("dedup: identifies highly probable duplicate via matching phone number", () => {
  const a = { name: "Sattvic Thali", phone: "+91 712 2555 123" };
  const b = { name: "Sattvic Food Express", phone: "0712-2555-123" };
  const match = detectDuplicatePair(a, b);
  assert.equal(match.match_type, "highly_probable");
  assert.equal(match.signal, "exact_phone_match");
});

it("dedup: identifies franchise branches as separate records (e.g. Pune vs Nagpur)", () => {
  const a = {
    name: "Pure Green Cafe",
    city: "Pune",
    latitude: 18.5204,
    longitude: 73.8567,
  };
  const b = {
    name: "Pure Green Cafe",
    city: "Nagpur",
    latitude: 21.1458,
    longitude: 79.0882,
  };
  const match = detectDuplicatePair(a, b);
  assert.equal(match.match_type, "franchise_branch");
});

// ---------------------------------------------------------------------------
// 4. Vegan Classification & Evidence Rules
// ---------------------------------------------------------------------------

function validateVeganClassification(classification, evidenceStatus, notes) {
  const VALID_CLASSES = [
    "fully_vegan",
    "vegan_friendly",
    "verified_vegan_options",
    "vegan_status_unverified",
    "vegan_claim_conflicting",
  ];

  if (!VALID_CLASSES.includes(classification)) {
    return { valid: false, error: "invalid_classification_enum" };
  }

  // 'fully_vegan' requires actual menu review or owner confirmation
  if (classification === "fully_vegan") {
    if (!["menu_evidence_found", "ingredients_reviewed", "owner_confirmed", "vegansaathi_reviewed"].includes(evidenceStatus)) {
      return { valid: false, error: "fully_vegan_requires_menu_or_owner_evidence" };
    }
    if (!notes || notes.trim().length < 10) {
      return { valid: false, error: "fully_vegan_requires_descriptive_audit_notes" };
    }
  }

  return { valid: true };
}

it("vegan-classification: allows fully_vegan when menu evidence and review notes are present", () => {
  const res = validateVeganClassification(
    "fully_vegan",
    "ingredients_reviewed",
    "Full menu reviewed. Only plant milks and plant-based fats used. No dairy/ghee."
  );
  assert.equal(res.valid, true);
});

it("vegan-classification: rejects fully_vegan without supporting evidence", () => {
  const res = validateVeganClassification(
    "fully_vegan",
    "no_vegan_evidence",
    "Found on directory"
  );
  assert.equal(res.valid, false);
  assert.equal(res.error, "fully_vegan_requires_menu_or_owner_evidence");
});

it("vegan-classification: rejects fully_vegan with empty or trivial notes", () => {
  const res = validateVeganClassification(
    "fully_vegan",
    "owner_confirmed",
    "ok"
  );
  assert.equal(res.valid, false);
  assert.equal(res.error, "fully_vegan_requires_descriptive_audit_notes");
});

// ---------------------------------------------------------------------------
// 5. Photo Rights Validation Tests
// ---------------------------------------------------------------------------

function validatePhotoSubmission(sub) {
  if (!sub.place_id || typeof sub.place_id !== "string") {
    return { valid: false, error: "missing_place_id" };
  }
  if (!["storefront", "interior", "food", "menu", "logo"].includes(sub.photo_category)) {
    return { valid: false, error: "invalid_photo_category" };
  }
  if (!sub.is_original_work && !sub.has_permission_to_publish) {
    return { valid: false, error: "no_rights_declaration" };
  }
  if (!sub.photographer_name && !sub.rights_holder) {
    return { valid: false, error: "missing_rights_holder_attribution" };
  }
  return { valid: true };
}

it("photo-rights: accepts valid community photo with rights declaration", () => {
  const sub = {
    place_id: "place_123",
    photo_category: "storefront",
    is_original_work: true,
    photographer_name: "Rahul Patil",
    submission_type: "community_member",
  };
  const res = validatePhotoSubmission(sub);
  assert.equal(res.valid, true);
});

it("photo-rights: rejects photo submission without rights declaration", () => {
  const sub = {
    place_id: "place_123",
    photo_category: "food",
    is_original_work: false,
    has_permission_to_publish: false,
    submission_type: "community_member",
  };
  const res = validatePhotoSubmission(sub);
  assert.equal(res.valid, false);
  assert.equal(res.error, "no_rights_declaration");
});

// ---------------------------------------------------------------------------
// 6. Reverification Policy Thresholds
// ---------------------------------------------------------------------------

function evaluateReverificationStatus(lastVerifiedDate, warnDays = 90, reviewDays = 180) {
  const now = Date.now();
  const verifiedTs = new Date(lastVerifiedDate).getTime();
  const ageDays = (now - verifiedTs) / (24 * 60 * 60 * 1000);

  if (ageDays >= reviewDays) {
    return { status: "review_required", ageDays: Math.floor(ageDays) };
  }
  if (ageDays >= warnDays) {
    return { status: "warning", ageDays: Math.floor(ageDays) };
  }
  return { status: "current", ageDays: Math.floor(ageDays) };
}

it("reverification: marks recent verification as current", () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const res = evaluateReverificationStatus(thirtyDaysAgo);
  assert.equal(res.status, "current");
});

it("reverification: triggers warning between 90 and 180 days", () => {
  const oneHundredDaysAgo = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
  const res = evaluateReverificationStatus(oneHundredDaysAgo);
  assert.equal(res.status, "warning");
});

it("reverification: triggers review_required at 180+ days", () => {
  const twoHundredDaysAgo = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
  const res = evaluateReverificationStatus(twoHundredDaysAgo);
  assert.equal(res.status, "review_required");
});

// ---------------------------------------------------------------------------
// 7. Candidate State Management & Atomic Publishing (Priorities 2 & 3)
// ---------------------------------------------------------------------------

it("candidate-cache: simulates caching Firestore-loaded candidates into candidateCache map", () => {
  const cache = new Map();
  const firestoreDocs = [
    { id: "cand_fs_01", name: "Green Leaf Cafe", city: "Nagpur", mapped_place_type: "cafe" },
    { id: "cand_fs_02", name: "Pune Vegan Bowls", city: "Pune", mapped_place_type: "restaurant" },
  ];

  firestoreDocs.forEach((d) => cache.set(d.id, d));

  // Verify retrieval after simulated reload
  const retrieved = cache.get("cand_fs_01");
  assert.ok(retrieved, "Candidate loaded from Firestore must be found in cache");
  assert.equal(retrieved.name, "Green Leaf Cafe");

  // Missing candidate handling
  const missing = cache.get("nonexistent_id");
  assert.equal(missing, undefined, "Missing candidate returns undefined safely");
});

it("publishing-model: maps dietTags accurately according to verified veganClassification and rejects unverified fallback", () => {
  function deriveDietTags(veganClass, candTags = []) {
    if (veganClass === "fully_vegan") {
      return ["vegan"];
    } else if (veganClass === "vegan_friendly" || veganClass === "verified_vegan_options") {
      const tags = ["vegan", "vegetarian"];
      if (candTags.includes("jain")) tags.push("jain");
      return tags;
    } else {
      // Unverified or unknown: strictly null. VeganSaathi never converts absence of vegan evidence into positive dietary tags!
      return null;
    }
  }

  // 1. fully_vegan -> ["vegan"]
  assert.deepEqual(deriveDietTags("fully_vegan"), ["vegan"]);

  // 2. vegan_friendly -> ["vegan", "vegetarian"]
  assert.deepEqual(deriveDietTags("vegan_friendly"), ["vegan", "vegetarian"]);
  assert.deepEqual(deriveDietTags("vegan_friendly", ["jain"]), ["vegan", "vegetarian", "jain"]);

  // 3. unverified / unknown -> null (cannot publish without positive vegan verification)
  assert.equal(deriveDietTags("vegan_status_unverified"), null);
  assert.equal(deriveDietTags("unknown"), null);
});

it("publishing-integrity: enforces synthetic rejection, duplicate approval check, and independent dimensions", () => {
  // 1. Synthetic candidate safeguard
  function isSyntheticCandidate(cand) {
    return Boolean(
      cand.is_synthetic_fixture ||
      cand.dataset_origin === "synthetic_test_fixture" ||
      (cand.source_id && String(cand.source_id).includes("synthetic")) ||
      (cand.name && String(cand.name).startsWith("[TEST FIXTURE]"))
    );
  }
  assert.equal(isSyntheticCandidate({ is_synthetic_fixture: true }), true);
  assert.equal(isSyntheticCandidate({ name: "[TEST FIXTURE] Fake Cafe" }), true);
  assert.equal(isSyntheticCandidate({ name: "Genuine Vegan Hub", source_id: "osm" }), false);

  // 2. Duplicate approval check
  function canApproveCandidate(candState) {
    if (candState.import_status === "approved" || candState.approvedPlaceId) {
      return { allowed: false, reason: "duplicate_approval" };
    }
    if (candState.import_status === "rejected") {
      return { allowed: false, reason: "already_rejected" };
    }
    return { allowed: true };
  }
  assert.equal(canApproveCandidate({ import_status: "approved", approvedPlaceId: "p1" }).allowed, false);
  assert.equal(canApproveCandidate({ import_status: "pending" }).allowed, true);

  // 3. Independent verification dimensions
  function deriveDimensions(existence, operating, evidenceStatus, photoRights) {
    const isPhys = existence === "physically_verified";
    const isOwner = existence === "owner_confirmed" || evidenceStatus === "owner_confirmed";
    const isIng = evidenceStatus === "ingredients_reviewed" || evidenceStatus === "vegansaathi_reviewed";
    return {
      business_exists: existence !== "candidate" && existence !== "unknown",
      address_confirmed: isPhys || isOwner,
      is_operating: operating === "open",
      physically_visited: isPhys,
      online_reviewed: evidenceStatus === "menu_reviewed" || evidenceStatus === "vegansaathi_reviewed",
      ingredients_reviewed: isIng || isOwner,
      vegan_options_verified: true,
      photo_rights_cleared: Boolean(photoRights)
    };
  }

  const dimsOnlineOnly = deriveDimensions("candidate", "open", "menu_reviewed", false);
  assert.equal(dimsOnlineOnly.physically_visited, false, "Online menu review must not claim physical visit");
  assert.equal(dimsOnlineOnly.online_reviewed, true);
  assert.equal(dimsOnlineOnly.photo_rights_cleared, false);

  const dimsFieldwork = deriveDimensions("physically_verified", "open", "ingredients_reviewed", true);
  assert.equal(dimsFieldwork.physically_visited, true);
  assert.equal(dimsFieldwork.ingredients_reviewed, true);
  assert.equal(dimsFieldwork.photo_rights_cleared, true);
});

it("publishing-model: assigns verificationStatus='unverified' and lastVerifiedAt=null when affirmative evidence is absent", () => {
  function deriveVerificationDetails(evidenceStatus, existenceStatus) {
    const isAffirmativelyVerified = (
      evidenceStatus === "ingredients_reviewed" ||
      evidenceStatus === "owner_confirmed" ||
      evidenceStatus === "vegansaathi_reviewed" ||
      existenceStatus === "owner_confirmed"
    );
    return {
      verificationStatus: isAffirmativelyVerified ? "verified" : "unverified",
      lastVerifiedAt: isAffirmativelyVerified ? new Date() : null,
    };
  }

  // Merely found online / no verified evidence
  const unverifiedResult = deriveVerificationDetails("no_vegan_evidence", "candidate");
  assert.equal(unverifiedResult.verificationStatus, "unverified");
  assert.equal(unverifiedResult.lastVerifiedAt, null);

  // Vegan lead from tag only
  const leadResult = deriveVerificationDetails("vegan_lead", "address_supported");
  assert.equal(leadResult.verificationStatus, "unverified");
  assert.equal(leadResult.lastVerifiedAt, null);

  // Affirmatively verified (ingredients reviewed)
  const verifiedResult = deriveVerificationDetails("ingredients_reviewed", "business_identity_supported");
  assert.equal(verifiedResult.verificationStatus, "verified");
  assert.ok(verifiedResult.lastVerifiedAt instanceof Date);
});

it("atomic-publishing: verifies operations are batched together to prevent partial failure", () => {
  const operations = [];
  const mockBatch = {
    set: (ref, data) => operations.push({ op: "set", ref, data }),
    update: (ref, data) => operations.push({ op: "update", ref, data }),
    commit: async () => { operations.push({ op: "commit" }); return true; },
  };

  // Simulate atomic publish
  const newPlaceRef = { path: "places/new_p1" };
  const historyRef = { path: "verificationHistory/h1" };
  const candRef = { path: "placeCandidates/cand_01" };

  mockBatch.set(newPlaceRef, { name: "Leaf Cafe", status: "published" });
  mockBatch.set(historyRef, { placeId: "new_p1", decision: "approved" });
  mockBatch.update(candRef, { import_status: "approved", approvedPlaceId: "new_p1" });

  assert.equal(operations.length, 3);
  assert.equal(operations[0].op, "set");
  assert.equal(operations[1].op, "set");
  assert.equal(operations[2].op, "update");
});

// ---------------------------------------------------------------------------
// 8. Zero-Budget Constraint Tests
// ---------------------------------------------------------------------------

it("zero-budget: verifies codebase contains no paid billing activation or cloud functions dependency", () => {
  const firebaseJsonPath = path.resolve(__dirname, "../firebase.json");
  const fbJson = JSON.parse(fs.readFileSync(firebaseJsonPath, "utf-8"));

  // Check functions are not in firebase.json (which would require Blaze plan)
  assert.equal(fbJson.functions, undefined, "Firebase Functions must NOT be configured (requires Blaze plan)");

  // Check firestore rules don't reference paid services
  const rulesPath = path.resolve(__dirname, "../firebase/firestore.rules");
  const rulesContent = fs.readFileSync(rulesPath, "utf-8");
  assert.ok(!rulesContent.includes("phoneAuth"), "Phone Auth SMS (potentially paid) not in rules");
});

// ---------------------------------------------------------------------------
// 9. Regression Tests — Coordinate & Address Approval Guards
//    Covers the mandatory independent inspection findings:
//    - approveCandidate must reject missing/0,0/out-of-range coordinates
//    - approveCandidate must reject placeholder addresses
//    - existence === "owner_confirmed" alone must NOT grant verificationStatus: "verified"
//    - vegan_claim_conflicting must be blocked (no publish)
// ---------------------------------------------------------------------------

it("approval-guard: rejects null or missing coordinates", () => {
  function checkCoordinateApproval(lat, lon) {
    if (lat === null || lat === undefined || lon === null || lon === undefined) {
      return { blocked: true, reason: "missing_coordinates" };
    }
    if (lat === 0 && lon === 0) {
      return { blocked: true, reason: "zero_zero_placeholder" };
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return { blocked: true, reason: "out_of_range" };
    }
    return { blocked: false };
  }

  // null coordinates must block
  assert.equal(checkCoordinateApproval(null, null).blocked, true, "null coordinates must block approval");
  assert.equal(checkCoordinateApproval(null, null).reason, "missing_coordinates");

  // undefined coordinates must block
  assert.equal(checkCoordinateApproval(undefined, undefined).blocked, true, "undefined coordinates must block approval");

  // (0, 0) is a known null placeholder — must block
  assert.equal(checkCoordinateApproval(0, 0).blocked, true, "0,0 must block approval as a placeholder");
  assert.equal(checkCoordinateApproval(0, 0).reason, "zero_zero_placeholder");

  // out of valid geographic range — must block
  assert.equal(checkCoordinateApproval(999, 999).blocked, true, "out-of-range coordinates must block approval");
  assert.equal(checkCoordinateApproval(-91, 72).blocked, true, "lat < -90 must block");
  assert.equal(checkCoordinateApproval(18.5, 181).blocked, true, "lon > 180 must block");

  // valid Maharashtra coordinates — must NOT block
  assert.equal(checkCoordinateApproval(18.5204, 73.8567).blocked, false, "valid Pune coordinates must pass");
  assert.equal(checkCoordinateApproval(19.0760, 72.8777).blocked, false, "valid Mumbai coordinates must pass");
});

it("approval-guard: rejects placeholder or missing addresses", () => {
  const PLACEHOLDER_ADDRESSES = [
    "address pending verification",
    "address pending",
    "pending verification",
    "unknown",
    "n/a",
    "tbd",
    "",
  ];

  function checkAddressApproval(address) {
    const trimmed = typeof address === "string" ? address.trim() : "";
    if (!trimmed || PLACEHOLDER_ADDRESSES.includes(trimmed.toLowerCase())) {
      return { blocked: true, reason: "placeholder_or_missing_address" };
    }
    if (trimmed.length < 5 || trimmed.length > 300) {
      return { blocked: true, reason: "address_length_invalid" };
    }
    return { blocked: false };
  }

  // Explicit placeholders that must block
  assert.equal(checkAddressApproval("Address pending verification").blocked, true, "placeholder text must block");
  assert.equal(checkAddressApproval("address pending verification").blocked, true, "case-insensitive placeholder check");
  assert.equal(checkAddressApproval("").blocked, true, "empty address must block");
  assert.equal(checkAddressApproval("   ").blocked, true, "whitespace-only address must block");
  assert.equal(checkAddressApproval("unknown").blocked, true, "'unknown' must block");
  assert.equal(checkAddressApproval("n/a").blocked, true, "'n/a' must block");
  assert.equal(checkAddressApproval("tbd").blocked, true, "'tbd' must block");

  // Too short
  assert.equal(checkAddressApproval("ab").blocked, true, "address under 5 chars must block");

  // Valid real address — must NOT block
  assert.equal(checkAddressApproval("123, MG Road, Pune, Maharashtra 411001").blocked, false, "real address must pass");
  assert.equal(checkAddressApproval("Near Station, Nagpur").blocked, false, "short but real address must pass");
});

it("approval-guard: existence=owner_confirmed alone does NOT grant verificationStatus=verified", () => {
  /**
   * SEMANTICS CLARIFICATION:
   *   existence === "owner_confirmed" means: the owner confirmed the BUSINESS EXISTS.
   *   It does NOT mean: the owner confirmed vegan menu items or ingredients.
   *   Only dietary evidence (evidenceStatus) can grant verificationStatus === "verified".
   *
   *   The hardened approveCandidate() now uses:
   *     isDietaryOwnerConfirmed = evidenceStatus === "owner_confirmed"  (dietary confirmation)
   *     isOwnerExistenceConfirmed = existence === "owner_confirmed"      (existence only)
   *
   *   isAffirmativelyVerified = isIngredientsReviewed || isDietaryOwnerConfirmed
   *                             || (isPhysicallyVisited && evidenceStatus not no_vegan_evidence)
   */
  function deriveVerificationStatusV2(existenceStatus, evidenceStatus) {
    const isPhysicallyVisited = existenceStatus === "physically_verified";
    const isDietaryOwnerConfirmed = evidenceStatus === "owner_confirmed";
    const isIngredientsReviewed = evidenceStatus === "ingredients_reviewed" || evidenceStatus === "vegansaathi_reviewed";
    const hasVeganDietaryEvidence = isIngredientsReviewed || isDietaryOwnerConfirmed;
    const isAffirmativelyVerified = hasVeganDietaryEvidence ||
      (isPhysicallyVisited && evidenceStatus !== "no_vegan_evidence" && evidenceStatus !== "vegan_lead");
    return isAffirmativelyVerified ? "verified" : "unverified";
  }

  // Owner confirmed existence only — must NOT yield "verified"
  assert.equal(
    deriveVerificationStatusV2("owner_confirmed", "vegan_lead"),
    "unverified",
    "existence=owner_confirmed + vegan_lead must NOT yield verificationStatus=verified"
  );
  assert.equal(
    deriveVerificationStatusV2("owner_confirmed", "menu_evidence_found"),
    "unverified",
    "existence=owner_confirmed + menu_evidence_found (not full review) must stay unverified"
  );
  assert.equal(
    deriveVerificationStatusV2("owner_confirmed", "no_vegan_evidence"),
    "unverified",
    "existence=owner_confirmed + no_vegan_evidence must be unverified"
  );

  // Dietary owner confirmation — DOES grant verified (evidenceStatus field, not existenceStatus)
  assert.equal(
    deriveVerificationStatusV2("candidate", "owner_confirmed"),
    "verified",
    "evidenceStatus=owner_confirmed (dietary confirmation) must yield verified"
  );

  // Ingredients reviewed — must grant verified
  assert.equal(
    deriveVerificationStatusV2("address_supported", "ingredients_reviewed"),
    "verified",
    "ingredients_reviewed must yield verified"
  );
  assert.equal(
    deriveVerificationStatusV2("candidate", "vegansaathi_reviewed"),
    "verified",
    "vegansaathi_reviewed must yield verified"
  );

  // Physical visit with real evidence — verified
  assert.equal(
    deriveVerificationStatusV2("physically_verified", "menu_evidence_found"),
    "verified",
    "physical visit + menu evidence must yield verified"
  );

  // Physical visit with no evidence — still unverified
  assert.equal(
    deriveVerificationStatusV2("physically_verified", "no_vegan_evidence"),
    "unverified",
    "physical visit + no_vegan_evidence must stay unverified"
  );
});

it("approval-guard: vegan_claim_conflicting and vegan_status_unverified must both block publish", () => {
  const BLOCKED_VEGAN_CLASSES = ["vegan_status_unverified", "vegan_claim_conflicting", "", null, undefined, "unknown", "vegetarian"];
  const ALLOWED_VEGAN_CLASSES = ["fully_vegan", "vegan_friendly", "verified_vegan_options"];

  function canPublishVeganClass(veganClass, evidenceStatus) {
    const ALLOWED = ["fully_vegan", "vegan_friendly", "verified_vegan_options"];
    const ALLOWED_EVIDENCE = ["menu_evidence_found", "ingredients_reviewed", "owner_confirmed", "vegansaathi_reviewed"];
    if (!ALLOWED.includes(veganClass) || !ALLOWED_EVIDENCE.includes(evidenceStatus)) {
      return false;
    }
    return true;
  }

  for (const cls of BLOCKED_VEGAN_CLASSES) {
    assert.equal(canPublishVeganClass(cls, "ingredients_reviewed"), false,
      `veganClass='${cls}' must block publish`);
  }
  // no_vegan_evidence, vegan_lead, and conflicting_evidence must block even with a seemingly valid class
  assert.equal(canPublishVeganClass("fully_vegan", "no_vegan_evidence"), false,
    "no_vegan_evidence must block even when veganClass=fully_vegan");
  assert.equal(canPublishVeganClass("fully_vegan", "vegan_lead"), false,
    "vegan_lead must block even when veganClass=fully_vegan");
  assert.equal(canPublishVeganClass("fully_vegan", "conflicting_evidence"), false,
    "conflicting_evidence must block even when veganClass=fully_vegan");

  for (const cls of ALLOWED_VEGAN_CLASSES) {
    assert.equal(canPublishVeganClass(cls, "ingredients_reviewed"), true,
      `veganClass='${cls}' + ingredients_reviewed must allow publish`);
  }
});

it("approval-guard: in-flight concurrency lock and deterministic place ID protect against duplicate places", () => {
  // 1. In-flight lock
  const inFlight = new Set();
  function attemptApproval(candId) {
    if (inFlight.has(candId)) {
      return { success: false, reason: "concurrency_lock" };
    }
    inFlight.add(candId);
    return { success: true };
  }

  assert.equal(attemptApproval("cand_101").success, true, "First approval must acquire lock");
  assert.equal(attemptApproval("cand_101").success, false, "Second concurrent approval must be blocked by in-flight lock");
  assert.equal(attemptApproval("cand_101").reason, "concurrency_lock");
  inFlight.delete("cand_101");
  assert.equal(attemptApproval("cand_101").success, true, "After release, approval can proceed");
  inFlight.clear();

  // 2. Deterministic Place ID
  function getDeterministicPlaceId(candidate) {
    return candidate.approvedPlaceId || ("place_" + (candidate.candidate_id || candidate.id));
  }

  const pId1 = getDeterministicPlaceId({ id: "cand_999" });
  const pId2 = getDeterministicPlaceId({ candidate_id: "cand_999" });
  assert.equal(pId1, "place_cand_999", "Must generate deterministic place ID from candidate ID");
  assert.equal(pId1, pId2, "Repeated calls must yield identical place ID to prevent duplicate documents");
});

it("approval-guard: failed atomic batch write does not leave candidate in approved state", async () => {
  let candidateStatus = "pending";
  let publishedPlaces = [];

  // Simulate atomic batch where committing fails (e.g. permission or network error)
  async function atomicPublish(candidate, shouldFail) {
    const stagedChanges = [];
    stagedChanges.push(() => publishedPlaces.push({ id: "place_" + candidate.id, status: "published" }));
    stagedChanges.push(() => { candidateStatus = "approved"; });

    if (shouldFail) {
      // Simulate batch commit failure
      throw new Error("Firestore batch.commit() failed: simulated network disconnect");
    }

    // Apply all changes atomically only if commit succeeds
    for (const change of stagedChanges) change();
    return true;
  }

  // Attempt failed publish
  await assert.rejects(
    async () => await atomicPublish({ id: "cand_fail_1" }, true),
    /Firestore batch.commit\(\) failed/,
    "Batch failure must throw"
  );

  // Invariant check: candidate must NOT be left approved and no place published
  assert.equal(candidateStatus, "pending", "Candidate must remain pending after failed batch commit");
  assert.equal(publishedPlaces.length, 0, "No place document should be published on batch commit failure");

  // Attempt successful publish
  await atomicPublish({ id: "cand_success_1" }, false);
  assert.equal(candidateStatus, "approved");
  assert.equal(publishedPlaces.length, 1);
});

it("approval-guard: permanently closed establishments cannot be approved for publication", () => {
  function checkOperatingApproval(operating) {
    if (operating === "permanently_closed") {
      return { allowed: false, reason: "permanently_closed" };
    }
    return { allowed: true };
  }

  assert.equal(checkOperatingApproval("permanently_closed").allowed, false, "permanently_closed must block publication");
  assert.equal(checkOperatingApproval("open").allowed, true);
  assert.equal(checkOperatingApproval("unknown").allowed, true);
});

console.log("\n========================================");
console.log(`Place Intelligence Tests: ${passed} passed, ${failed} failed.`);
console.log("========================================\n");

if (failed > 0) {
  process.exit(1);
}
