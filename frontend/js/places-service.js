/* ==========================================================================
   VeganSaathi — places-service.js
   ============================================================================
   Task 5.1c — the single Firestore data-access layer for Places. Future
   Phase 5 UI modules (Explore, Place Details, Home) will import from here
   instead of touching Firestore directly. This file does not render
   anything and does not know about the DOM — see docs/DATABASE_SCHEMA.md
   for the field-by-field contract this module enforces.

   Reuses the existing centralized Firebase initialization
   (firebase-init.js) — no second initializeApp() call anywhere here.
   ========================================================================== */

import { getFirebaseDb } from "./firebase-init.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

/* ==========================================================================
   Controlled values (must match docs/DATABASE_SCHEMA.md exactly)
   ========================================================================== */

const VALID_PLACE_TYPES = ["restaurant", "mess", "canteen", "cafe", "dhaba", "other"];
const VALID_DIET_TAGS = ["vegan", "vegetarian", "eggetarian", "jain"];
const VALID_STATUSES = ["pending", "published", "rejected"];
const VALID_VERIFICATION_STATUSES = ["unverified", "verified"];
const VALID_SOURCES = ["fieldwork", "community"];

/* ==========================================================================
   Pilot bounding box (ASSUMPTION — see docs/DATABASE_SCHEMA.md's coordinate
   validation note, which called for this but never gave numbers).
   Chosen generously around SSGMCE + Shegaon town from the existing mock
   coordinates (~20.79–20.80 N, ~76.69–76.70 E), with margin for real
   fieldwork sites a few km out. This is a validation constant, not place
   data — it exists to catch an obviously wrong or swapped lat/lon, not to
   define the "real" pilot area precisely. Widen it if real fieldwork data
   legitimately falls outside it; do not silently accept out-of-range values
   by removing the check instead.
   ========================================================================== */
export const PILOT_BOUNDS = {
  minLat: 20.70,
  maxLat: 20.90,
  minLon: 76.55,
  maxLon: 76.80
};

/* ==========================================================================
   Small internal helpers
   ========================================================================== */

function warn(docId, reason) {
  console.warn("VeganSaathi places-service: skipping invalid place document \"" + docId + "\" — " + reason);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidCoordinatePair(lat, lon) {
  if (!isFiniteNumber(lat) || !isFiniteNumber(lon)) return false;
  return (
    lat >= PILOT_BOUNDS.minLat && lat <= PILOT_BOUNDS.maxLat &&
    lon >= PILOT_BOUNDS.minLon && lon <= PILOT_BOUNDS.maxLon
  );
}

// Firestore Timestamps expose .toDate(). Accepts a real Timestamp, a plain
// object shaped like one (useful for tests), or an already-converted Date.
// Returns null for anything else — never invents a date.
function toDateOrNull(value) {
  if (value instanceof Date) return value;
  if (value && typeof value.toDate === "function") return value.toDate();
  return null;
}

/* ==========================================================================
   normalizePlace(rawDoc)
   ============================================================================
   rawDoc: { id: string, data: object } — the shape you get from
   `{ id: docSnap.id, data: docSnap.data() }`. Kept as a plain object (rather
   than requiring a real Firestore DocumentSnapshot) so this function can be
   unit-tested directly with plain JS objects — see tests/.

   Returns a normalized place object ready for display, or `null` if the
   document fails validation. A `null` return means "skip this document" —
   callers must never treat null as a placeholder place.
   ========================================================================== */
export function normalizePlace(rawDoc) {
  if (!rawDoc || typeof rawDoc !== "object" || !rawDoc.data) {
    return null;
  }

  const id = rawDoc.id;
  const data = rawDoc.data;

  if (!isNonEmptyString(id)) {
    warn(String(id), "missing or invalid document id");
    return null;
  }

  // ---- Required fields ----
  if (!isNonEmptyString(data.name) || data.name.trim().length < 2 || data.name.trim().length > 100) {
    warn(id, "name is missing, or not 2-100 characters");
    return null;
  }

  if (!VALID_PLACE_TYPES.includes(data.placeType)) {
    warn(id, "placeType \"" + data.placeType + "\" is not one of " + VALID_PLACE_TYPES.join(", "));
    return null;
  }

  if (!isNonEmptyString(data.address)) {
    warn(id, "address is missing");
    return null;
  }

  if (!isValidCoordinatePair(data.latitude, data.longitude)) {
    warn(id, "latitude/longitude (" + data.latitude + ", " + data.longitude + ") are missing, not numbers, or outside the pilot bounding box — possible swap or bad entry");
    return null;
  }

  if (!Array.isArray(data.dietTags) || data.dietTags.length === 0 || !data.dietTags.every(function (t) { return VALID_DIET_TAGS.includes(t); })) {
    warn(id, "dietTags is missing, empty, or contains a value outside " + VALID_DIET_TAGS.join(", "));
    return null;
  }

  if (!VALID_STATUSES.includes(data.status)) {
    warn(id, "status \"" + data.status + "\" is not one of " + VALID_STATUSES.join(", "));
    return null;
  }

  if (!VALID_VERIFICATION_STATUSES.includes(data.verificationStatus)) {
    warn(id, "verificationStatus \"" + data.verificationStatus + "\" is not one of " + VALID_VERIFICATION_STATUSES.join(", "));
    return null;
  }

  if (!VALID_SOURCES.includes(data.source)) {
    warn(id, "source \"" + data.source + "\" is not one of " + VALID_SOURCES.join(", "));
    return null;
  }

  if (!isNonEmptyString(data.submittedBy)) {
    warn(id, "submittedBy is missing");
    return null;
  }

  if (!isNonEmptyString(data.submittedByName)) {
    warn(id, "submittedByName is missing");
    return null;
  }

  const createdAt = toDateOrNull(data.createdAt);
  if (!createdAt) {
    warn(id, "createdAt is missing or not a valid timestamp");
    return null;
  }

  const updatedAt = toDateOrNull(data.updatedAt);
  if (!updatedAt) {
    warn(id, "updatedAt is missing or not a valid timestamp");
    return null;
  }

  // ---- Conditional field: lastVerifiedAt ----
  // Per docs/DATABASE_SCHEMA.md: a "verified" place without a valid
  // lastVerifiedAt is an invalid document, not a place to silently show as
  // unverified — malformed verification data is worth surfacing loudly.
  let lastVerifiedAt = null;
  if (data.verificationStatus === "verified") {
    lastVerifiedAt = toDateOrNull(data.lastVerifiedAt);
    if (!lastVerifiedAt) {
      warn(id, "verificationStatus is \"verified\" but lastVerifiedAt is missing or invalid");
      return null;
    }
  }

  // ---- Optional fields: safe presentational defaults, never fabricated ----
  // Note: priceRange keeps its raw enum value ("budget"/"moderate"/"premium")
  // when present, exactly as before — only a MISSING priceRange becomes the
  // sentinel string below. A later UI calling capitalize() on either is
  // safe (capitalize() on an already-capitalized sentinel is a no-op).
  const description = isNonEmptyString(data.description) ? data.description.trim() : "";
  const area = isNonEmptyString(data.area) ? data.area.trim() : "Area not listed";
  const dietNotes = isNonEmptyString(data.dietNotes) ? data.dietNotes.trim() : "";
  const priceRange = isNonEmptyString(data.priceRange) ? data.priceRange : "Price not listed";
  const openingInfo = isNonEmptyString(data.openingInfo) ? data.openingInfo.trim() : "";
  const verificationNote = isNonEmptyString(data.verificationNote) ? data.verificationNote.trim() : "";
  const imageUrl = isNonEmptyString(data.imageUrl) ? data.imageUrl : null;

  return {
    id: id,
    name: data.name.trim(),
    description: description,
    placeType: data.placeType,
    address: data.address.trim(),
    area: area,
    latitude: data.latitude,
    longitude: data.longitude,
    dietTags: data.dietTags.slice(),
    dietNotes: dietNotes,
    priceRange: priceRange,
    openingInfo: openingInfo,
    imageUrl: imageUrl,
    status: data.status,
    verificationStatus: data.verificationStatus,
    lastVerifiedAt: lastVerifiedAt,
    verificationNote: verificationNote,
    source: data.source,
    submittedBy: data.submittedBy,
    submittedByName: data.submittedByName,
    createdAt: createdAt,
    updatedAt: updatedAt
  };
}

/* ==========================================================================
   fetchPublishedPlaces()
   ============================================================================
   Queries ONLY status == "published" — Firestore Security Rules are not a
   query filter, so a broader query would be rejected outright for a signed-
   out visitor (see firebase/firestore.rules). No orderBy(), so no composite
   index is required.

   Returns:
     { status: "ok", places: [...normalized] }
     { status: "permission-denied" }
     { status: "error", error }
   An invalid individual document is skipped (with a console warning from
   normalizePlace()) rather than failing the whole load.
   ========================================================================== */
export async function fetchPublishedPlaces() {
  const db = getFirebaseDb();

  let snapshot;
  try {
    const placesQuery = query(collection(db, "places"), where("status", "==", "published"));
    snapshot = await getDocs(placesQuery);
  } catch (error) {
    if (error && error.code === "permission-denied") {
      return { status: "permission-denied" };
    }
    console.error("VeganSaathi places-service: fetchPublishedPlaces failed.", error);
    return { status: "error", error: error };
  }

  const places = [];
  snapshot.forEach(function (docSnap) {
    const normalized = normalizePlace({ id: docSnap.id, data: docSnap.data() });
    if (normalized) places.push(normalized);
  });

  return { status: "ok", places: places };
}

/* ==========================================================================
   fetchPlaceById(id)
   ============================================================================
   Fetches exactly places/{id} — no fallback to any other place if it's
   missing, invalid, or inaccessible.

   Returns:
     { status: "ok", place: {...normalized} }
     { status: "not-found" }        — document doesn't exist
     { status: "invalid" }          — document exists but failed normalization
     { status: "permission-denied" }
     { status: "error", error }
   ========================================================================== */
export async function fetchPlaceById(id) {
  if (!isNonEmptyString(id)) {
    return { status: "not-found" };
  }

  const db = getFirebaseDb();

  let docSnap;
  try {
    docSnap = await getDoc(doc(db, "places", id));
  } catch (error) {
    if (error && error.code === "permission-denied") {
      return { status: "permission-denied" };
    }
    console.error("VeganSaathi places-service: fetchPlaceById(\"" + id + "\") failed.", error);
    return { status: "error", error: error };
  }

  if (!docSnap.exists()) {
    return { status: "not-found" };
  }

  const normalized = normalizePlace({ id: docSnap.id, data: docSnap.data() });
  if (!normalized) {
    return { status: "invalid" };
  }

  return { status: "ok", place: normalized };
}
