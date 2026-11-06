const ALLOWED_VEGAN_CLASSES = new Set(["fully_vegan", "vegan_friendly", "verified_vegan_options"]);
const DIETARY_EVIDENCE = new Set(["ingredients_reviewed", "owner_confirmed", "vegansaathi_reviewed"]);
const PLACEHOLDER_ADDRESSES = new Set(["", "address pending verification", "address pending", "pending verification", "unknown", "n/a", "tbd"]);
const EVIDENCE_CLAIMS = new Set(["business_identity", "current_operation", "address", "coordinates", "fully_vegan_venue", "vegan_friendly_options", "vegan_options", "physical_visit"]);
const EVIDENCE_TYPES = new Set(["official_business_source", "direct_owner_confirmation", "menu_photo", "field_visit", "third_party_source"]);
const EVIDENCE_FIELDS = new Set(["claim", "url", "sourceType", "sourceOwner", "collectedAt", "lastCheckedAt", "excerpt", "reviewerUid", "strength", "validity", "rightsLimitations", "reviewerNote"]);
const EVIDENCE_MAX_AGE_DAYS = 180;
const PLACE_TYPES = new Set(["restaurant", "mess", "canteen", "cafe", "dhaba", "bakery", "dessert", "shop", "other"]);

function validateApproval(candidate, decision, reviewerUid) {
  if (!candidate || typeof candidate !== "object") throw new Error("Candidate data is missing.");
  if (isSyntheticCandidate(candidate)) {
    throw new Error("Synthetic test fixtures cannot be published.");
  }
  if (!ALLOWED_VEGAN_CLASSES.has(decision.veganClass)) throw new Error("A positive, non-conflicting vegan classification is required.");
  if (!DIETARY_EVIDENCE.has(decision.evidenceStatus)) throw new Error("Reviewed dietary evidence is required; discovery leads and unreviewed menu evidence cannot be published.");
  if (!new Set(["business_identity_supported", "owner_confirmed"]).has(decision.existence)) throw new Error("Supported business identity is required before publication.");
  if (decision.operating !== "open") throw new Error("Current operating status must be supported as open.");
  if (typeof decision.notes !== "string" || decision.notes.trim().length < 10) throw new Error("Reviewer audit notes are required (minimum 10 characters).");
  const refs = decision.evidenceRefs;
  if (!Array.isArray(refs) || refs.length === 0) throw new Error("Claim-specific evidence references are required for publication.");
  const now = Date.now();
  const claims = new Set();
  for (const ref of refs) {
    if (!ref || typeof ref !== "object" || Array.isArray(ref) || Object.keys(ref).some((key) => !EVIDENCE_FIELDS.has(key))) {
      throw new Error("Evidence reference has an invalid shape.");
    }
    if (!EVIDENCE_CLAIMS.has(ref.claim) || typeof ref.url !== "string" || !isHttpsUrl(ref.url) ||
        !EVIDENCE_TYPES.has(ref.sourceType) || typeof ref.sourceOwner !== "string" || !ref.sourceOwner.trim() ||
        typeof ref.excerpt !== "string" || ref.excerpt.trim().length < 20 ||
        ref.reviewerUid !== reviewerUid || !["direct", "corroborating"].includes(ref.strength) ||
        ref.validity !== "current" || typeof ref.rightsLimitations !== "string" || !ref.rightsLimitations.trim() ||
        typeof ref.reviewerNote !== "string" || !ref.reviewerNote.trim()) {
      throw new Error("Evidence reference is incomplete, unsupported, or reviewed by another administrator.");
    }
    const collectedAt = parseDateOnly(ref.collectedAt);
    const checkedAt = parseDateOnly(ref.lastCheckedAt);
    if (!Number.isFinite(collectedAt) || !Number.isFinite(checkedAt) || collectedAt > now || checkedAt > now ||
        collectedAt > checkedAt || (now - checkedAt) > EVIDENCE_MAX_AGE_DAYS * 86400000) {
      throw new Error("Evidence is stale or has invalid collection and review dates.");
    }
    claims.add(ref.claim);
  }
  const dietaryClaim = {
    fully_vegan: "fully_vegan_venue",
    vegan_friendly: "vegan_friendly_options",
    verified_vegan_options: "vegan_options"
  }[decision.veganClass];
  for (const claim of ["business_identity", "current_operation", "address", "coordinates", dietaryClaim]) {
    if (!claims.has(claim)) throw new Error(`Evidence reference for ${claim} is required.`);
  }
  if (decision.physicallyVisited === true && !claims.has("physical_visit")) throw new Error("Physical visit claim requires a visit evidence reference.");
  const lat = candidate.latitude;
  const lon = candidate.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180 || (lat === 0 && lon === 0)) {
    throw new Error("Valid, non-placeholder coordinates are required.");
  }
  const address = typeof candidate.address === "string" ? candidate.address.trim() : "";
  if (PLACEHOLDER_ADDRESSES.has(address.toLowerCase()) || address.length < 5 || address.length > 300) throw new Error("A supported, non-placeholder address is required.");
  if (!String(candidate.name || "").trim()) throw new Error("A business name is required.");
  if (!PLACE_TYPES.has(candidate.mapped_place_type)) throw new Error("A supported place type is required; unknown types cannot be converted to restaurants.");
  if (candidate.imageUrl && !candidate.photo_rights_cleared) throw new Error("Photo rights must be cleared before publishing an image.");
  return { lat, lon, address };
}

function isHttpsUrl(value) {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function parseDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : NaN;
}

export function isSyntheticCandidate(candidate, candidateId = "") {
  const id = String(candidateId || candidate?.candidate_id || candidate?.id || "");
  return id.startsWith("cand_synthetic_fixture_") ||
    candidate?.is_synthetic_fixture === true ||
    Boolean(String(candidate?.synthetic_fixture_id || "").trim()) ||
    Boolean(String(candidate?.synthetic_dataset_version || "").trim()) ||
    candidate?.dataset_origin === "synthetic_test_fixture" ||
    String(candidate?.source_id || "").toLowerCase().includes("synthetic") ||
    String(candidate?.name || "").startsWith("[TEST FIXTURE]");
}

export function assertCandidateCanStage(candidate) {
  if (!candidate || typeof candidate !== "object" || !candidate.candidate_id) {
    throw new Error("A candidate with a stable ID is required for staging.");
  }
  if (isSyntheticCandidate(candidate, candidate.candidate_id)) {
    throw new Error("Synthetic test fixtures cannot be staged.");
  }
  return true;
}

/** Publish a candidate atomically, using the real Firestore transaction API. */
export async function approveCandidateRecord({ db, candidateId, candidate, decision, admin, firestore }) {
  if (!candidateId || !admin?.uid) throw new Error("Candidate ID and authenticated administrator are required.");
  if (isSyntheticCandidate(candidate, candidateId)) throw new Error("Synthetic test fixtures cannot be published.");
  const { lat, lon, address } = validateApproval(candidate, decision, admin.uid);
  const { doc, collection, runTransaction, serverTimestamp } = firestore;
  const candidateRef = doc(db, "placeCandidates", candidateId);
  const placeId = candidate.approvedPlaceId || `place_${candidateId}`;
  const placeRef = doc(db, "places", placeId);
  const historyRef = doc(collection(db, "verificationHistory"));
  const verifiedAt = serverTimestamp();
  const dietTags = ["vegan"];
  const evidenceClaims = new Set(decision.evidenceRefs.map((ref) => ref.claim));
  const publicEvidenceRefs = decision.evidenceRefs.map(({ claim, url, lastCheckedAt, validity, strength, excerpt }) => ({
    claim, url, lastCheckedAt, validity, strength, excerpt
  }));
  const verificationDimensions = {
    business_exists: evidenceClaims.has("business_identity"),
    address_confirmed: evidenceClaims.has("address"),
    coordinates_supported: evidenceClaims.has("coordinates"),
    is_operating: evidenceClaims.has("current_operation"),
    physically_visited: evidenceClaims.has("physical_visit") && decision.physicallyVisited === true,
    online_reviewed: decision.evidenceStatus === "vegansaathi_reviewed",
    ingredients_reviewed: decision.evidenceStatus === "ingredients_reviewed" || decision.evidenceStatus === "vegansaathi_reviewed",
    vegan_options_verified: evidenceClaims.has("fully_vegan_venue") || evidenceClaims.has("vegan_friendly_options") || evidenceClaims.has("vegan_options"),
    photo_rights_cleared: Boolean(candidate.photo_rights_cleared)
  };
  const placeData = {
    name: candidate.name.trim(),
    placeType: candidate.mapped_place_type,
    address, area: candidate.area || "", city: candidate.city || "", district: candidate.district || "",
    state: candidate.state || "Maharashtra", country: candidate.country || "India", postalCode: candidate.postal_code || "",
    latitude: lat, longitude: lon, dietTags, priceRange: ["budget", "moderate", "premium"].includes(candidate.priceRange) ? candidate.priceRange : "Price not listed",
    description: candidate.description || "", website: candidate.website || "", phone: candidate.phone || "",
    imageUrl: candidate.photo_rights_cleared ? (candidate.imageUrl || "") : "", status: "published",
    verificationStatus: "verified", lastVerifiedAt: verifiedAt, veganClassification: decision.veganClass,
    existenceStatus: decision.existence, operatingStatus: decision.operating, evidenceStatus: decision.evidenceStatus,
    evidenceUrl: decision.evidenceRefs.find((ref) => ref.claim === dietaryClaimFor(decision.veganClass))?.url || "",
    evidenceRefs: publicEvidenceRefs, verificationDimensions, verificationNote: decision.notes.trim(),
    source: candidate.source_id && candidate.source_id.includes("community") ? "community" : "import",
    sourceId: candidate.source_id || "", sourceLicence: candidate.licence || "", sourceAttribution: candidate.source_attribution || "",
    upstreamSourceIds: candidate.upstream_source_ids || {}, candidateId, batchId: candidate.batch_id || "",
    submittedBy: admin.uid, submittedByName: admin.displayName || "Admin", createdAt: verifiedAt, updatedAt: verifiedAt
  };
  await runTransaction(db, async (transaction) => {
    const candidateSnap = await transaction.get(candidateRef);
    if (!candidateSnap.exists()) throw new Error("Candidate no longer exists; refresh the queue.");
    const fresh = candidateSnap.data();
    if (isSyntheticCandidate(fresh, candidateId)) throw new Error("Synthetic test fixtures cannot be published.");
    if (fresh.import_status !== "staged" || fresh.approvedPlaceId) throw new Error("Candidate is no longer staged; duplicate or stale approval blocked.");
    validateApproval(fresh, decision, admin.uid);
    for (const key of ["name", "address", "latitude", "longitude", "mapped_place_type", "imageUrl", "photo_rights_cleared", "source_id", "licence", "source_attribution", "upstream_source_ids", "dietTags", "area", "city", "district", "state", "country", "postal_code", "priceRange", "description", "website", "phone", "batch_id", "is_synthetic_fixture", "synthetic_fixture_id", "synthetic_dataset_version", "dataset_origin"]) {
      if (JSON.stringify(fresh[key] ?? null) !== JSON.stringify(candidate[key] ?? null)) throw new Error("Candidate changed after review; reload it before approval.");
    }
    const placeSnap = await transaction.get(placeRef);
    if (placeSnap.exists()) throw new Error("Target place already exists; duplicate approval blocked.");
    transaction.set(placeRef, placeData);
    transaction.set(historyRef, {
      placeId, candidateId, veganClassification: decision.veganClass, existenceStatus: decision.existence,
      operatingStatus: decision.operating, evidenceStatus: decision.evidenceStatus,
      evidenceUrl: decision.evidenceRefs.find((ref) => ref.claim === dietaryClaimFor(decision.veganClass))?.url || "",
      evidenceRefs: structuredClone(decision.evidenceRefs),
      dietTags, verificationStatus: "verified", verificationDimensions, notes: decision.notes.trim(),
      reviewerUid: admin.uid, reviewerName: admin.displayName || "Admin", decision: "approved", timestamp: verifiedAt
    });
    transaction.update(candidateRef, { import_status: "approved", approvedPlaceId: placeId, approvedBy: admin.uid, approvedAt: verifiedAt });
  });
  return { placeId, placeData };
}

function dietaryClaimFor(veganClass) {
  return { fully_vegan: "fully_vegan_venue", vegan_friendly: "vegan_friendly_options", verified_vegan_options: "vegan_options" }[veganClass];
}
