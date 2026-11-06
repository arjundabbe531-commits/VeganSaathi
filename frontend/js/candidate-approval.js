const ALLOWED_VEGAN_CLASSES = new Set(["fully_vegan", "vegan_friendly", "verified_vegan_options"]);
const DIETARY_EVIDENCE = new Set(["ingredients_reviewed", "owner_confirmed", "vegansaathi_reviewed"]);
const PLACEHOLDER_ADDRESSES = new Set(["", "address pending verification", "address pending", "pending verification", "unknown", "n/a", "tbd"]);

function validateApproval(candidate, decision) {
  if (!candidate || typeof candidate !== "object") throw new Error("Candidate data is missing.");
  if (candidate.is_synthetic_fixture || candidate.dataset_origin === "synthetic_test_fixture" ||
      String(candidate.source_id || "").toLowerCase().includes("synthetic") ||
      String(candidate.name || "").startsWith("[TEST FIXTURE]")) {
    throw new Error("Synthetic test fixtures cannot be published.");
  }
  if (!ALLOWED_VEGAN_CLASSES.has(decision.veganClass)) throw new Error("A positive, non-conflicting vegan classification is required.");
  if (!DIETARY_EVIDENCE.has(decision.evidenceStatus)) throw new Error("Reviewed dietary evidence is required; discovery leads and unreviewed menu evidence cannot be published.");
  if (!new Set(["business_identity_supported", "owner_confirmed"]).has(decision.existence)) throw new Error("Supported business identity is required before publication.");
  if (decision.operating !== "open") throw new Error("Current operating status must be supported as open.");
  if (typeof decision.notes !== "string" || decision.notes.trim().length < 10) throw new Error("Reviewer audit notes are required (minimum 10 characters).");
  const lat = candidate.latitude;
  const lon = candidate.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180 || (lat === 0 && lon === 0)) {
    throw new Error("Valid, non-placeholder coordinates are required.");
  }
  const address = typeof candidate.address === "string" ? candidate.address.trim() : "";
  if (PLACEHOLDER_ADDRESSES.has(address.toLowerCase()) || address.length < 5 || address.length > 300) throw new Error("A supported, non-placeholder address is required.");
  if (!String(candidate.name || "").trim()) throw new Error("A business name is required.");
  if (candidate.imageUrl && !candidate.photo_rights_cleared) throw new Error("Photo rights must be cleared before publishing an image.");
  return { lat, lon, address };
}

/** Publish a candidate atomically, using the real Firestore transaction API. */
export async function approveCandidateRecord({ db, candidateId, candidate, decision, admin, firestore }) {
  if (!candidateId || !admin?.uid) throw new Error("Candidate ID and authenticated administrator are required.");
  const { lat, lon, address } = validateApproval(candidate, decision);
  const { doc, collection, runTransaction, serverTimestamp } = firestore;
  const candidateRef = doc(db, "placeCandidates", candidateId);
  const placeId = candidate.approvedPlaceId || `place_${candidateId}`;
  const placeRef = doc(db, "places", placeId);
  const historyRef = doc(collection(db, "verificationHistory"));
  const verifiedAt = serverTimestamp();
  const dietTags = decision.veganClass === "fully_vegan" ? ["vegan"] : ["vegan", "vegetarian", ...(Array.isArray(candidate.dietTags) && candidate.dietTags.includes("jain") ? ["jain"] : [])];
  const verificationDimensions = {
    business_exists: true,
    address_confirmed: true,
    is_operating: true,
    physically_visited: decision.existence === "business_identity_supported" && decision.physicallyVisited === true,
    online_reviewed: decision.evidenceStatus === "vegansaathi_reviewed",
    ingredients_reviewed: decision.evidenceStatus === "ingredients_reviewed" || decision.evidenceStatus === "vegansaathi_reviewed",
    vegan_options_verified: true,
    photo_rights_cleared: Boolean(candidate.photo_rights_cleared)
  };
  const placeData = {
    name: candidate.name.trim(),
    placeType: ["restaurant", "mess", "canteen", "cafe", "dhaba", "other"].includes(candidate.mapped_place_type) ? candidate.mapped_place_type : "restaurant",
    address, area: candidate.area || "", city: candidate.city || "", district: candidate.district || "",
    state: candidate.state || "Maharashtra", country: candidate.country || "India", postalCode: candidate.postal_code || "",
    latitude: lat, longitude: lon, dietTags, priceRange: ["budget", "moderate", "premium"].includes(candidate.priceRange) ? candidate.priceRange : "Price not listed",
    description: candidate.description || "", website: candidate.website || "", phone: candidate.phone || "",
    imageUrl: candidate.photo_rights_cleared ? (candidate.imageUrl || "") : "", status: "published",
    verificationStatus: "verified", lastVerifiedAt: verifiedAt, veganClassification: decision.veganClass,
    existenceStatus: decision.existence, operatingStatus: decision.operating, evidenceStatus: decision.evidenceStatus,
    evidenceUrl: decision.evidenceUrl || "", verificationDimensions, verificationNote: decision.notes.trim(),
    source: candidate.source_id && candidate.source_id.includes("community") ? "community" : "import",
    sourceId: candidate.source_id || "", sourceLicence: candidate.licence || "", sourceAttribution: candidate.source_attribution || "",
    upstreamSourceIds: candidate.upstream_source_ids || {}, candidateId, batchId: candidate.batch_id || "",
    submittedBy: admin.uid, submittedByName: admin.displayName || "Admin", createdAt: verifiedAt, updatedAt: verifiedAt
  };
  await runTransaction(db, async (transaction) => {
    const candidateSnap = await transaction.get(candidateRef);
    if (!candidateSnap.exists()) throw new Error("Candidate no longer exists; refresh the queue.");
    const fresh = candidateSnap.data();
    if (fresh.import_status !== "staged" || fresh.approvedPlaceId) throw new Error("Candidate is no longer staged; duplicate or stale approval blocked.");
    validateApproval(fresh, decision);
    for (const key of ["name", "address", "latitude", "longitude", "mapped_place_type", "imageUrl", "photo_rights_cleared", "source_id", "licence", "source_attribution", "upstream_source_ids", "dietTags", "area", "city", "district", "state", "country", "postal_code", "priceRange", "description", "website", "phone", "batch_id", "is_synthetic_fixture", "dataset_origin"]) {
      if (JSON.stringify(fresh[key] ?? null) !== JSON.stringify(candidate[key] ?? null)) throw new Error("Candidate changed after review; reload it before approval.");
    }
    const placeSnap = await transaction.get(placeRef);
    if (placeSnap.exists()) throw new Error("Target place already exists; duplicate approval blocked.");
    transaction.set(placeRef, placeData);
    transaction.set(historyRef, {
      placeId, candidateId, veganClassification: decision.veganClass, existenceStatus: decision.existence,
      operatingStatus: decision.operating, evidenceStatus: decision.evidenceStatus, evidenceUrl: decision.evidenceUrl || "",
      dietTags, verificationStatus: "verified", verificationDimensions, notes: decision.notes.trim(),
      reviewerUid: admin.uid, reviewerName: admin.displayName || "Admin", decision: "approved", timestamp: verifiedAt
    });
    transaction.update(candidateRef, { import_status: "approved", approvedPlaceId: placeId, approvedBy: admin.uid, approvedAt: verifiedAt });
  });
  return { placeId, placeData };
}
