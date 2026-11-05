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
// 7. Zero-Budget Constraint Tests
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

console.log("\n========================================");
console.log(`Place Intelligence Tests: ${passed} passed, ${failed} failed.`);
console.log("========================================\n");

if (failed > 0) {
  process.exit(1);
}
