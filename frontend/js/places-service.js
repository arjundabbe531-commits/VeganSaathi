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
  getDoc,
  setDoc,
  addDoc,
  deleteDoc,
  serverTimestamp
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
   Global coordinate bounds — valid geographic ranges for any place on Earth.
   Latitude: -90 (South Pole) to +90 (North Pole).
   Longitude: -180 (International Date Line West) to +180 (International Date Line East).

   VeganSaathi is not restricted to a single city or region. Any place with
   well-formed coordinates anywhere in the world is accepted. The application
   began as a project around SSGMCE, Shegaon, but that is the project's origin,
   not a permanent geographic limit.

   Use COORD_BOUNDS when writing new code. PILOT_BOUNDS is an alias kept for
   backward compatibility with existing imports — do not introduce new
   PILOT_BOUNDS references.
   ========================================================================== */
export const COORD_BOUNDS = {
  minLat: -90,
  maxLat: 90,
  minLon: -180,
  maxLon: 180
};

/** @deprecated Use COORD_BOUNDS. Kept for backward compatibility. */
export const PILOT_BOUNDS = COORD_BOUNDS;

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
    lat >= COORD_BOUNDS.minLat && lat <= COORD_BOUNDS.maxLat &&
    lon >= COORD_BOUNDS.minLon && lon <= COORD_BOUNDS.maxLon
  );
}

/**
 * Validates whether an image URL is a safe HTTPS Cloudinary URL.
 * Rejects javascript:, data:, vbscript:, http:, or non-Cloudinary domains.
 */
export function isValidImageUrl(url) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (trimmed.length === 0 || trimmed.length > 500) return false;
  if (/[\s<>"'`\\]/.test(trimmed)) return false;
  return /^https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_-]+\/image\/upload\/.+/i.test(trimmed);
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
    warn(id, "latitude/longitude (" + data.latitude + ", " + data.longitude + ") are missing, not finite numbers, or outside valid global ranges (lat -90 to 90, lon -180 to 180)");
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
  const city = isNonEmptyString(data.city) ? data.city.trim() : "";
  const state = isNonEmptyString(data.state) ? data.state.trim() : "";
  const country = isNonEmptyString(data.country) ? data.country.trim() : "";
  const postalCode = isNonEmptyString(data.postalCode) ? data.postalCode.trim() : "";
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
    city: city,
    state: state,
    country: country,
    postalCode: postalCode,
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

/* ==========================================================================
   Phase 6 Community Features — Data Access Layer
   ========================================================================== */

/**
 * submitCommunityPlace(submission, user)
 * Creates a new place with status="pending" and verificationStatus="unverified".
 * Requires explicit coordinates validated within PILOT_BOUNDS.
 */
export async function submitCommunityPlace(submission, user) {
  if (!user || !user.uid) {
    return { status: "unauthenticated", message: "Please sign in to submit a place." };
  }

  if (!submission || typeof submission !== "object") {
    return { status: "validation-error", message: "Invalid submission payload." };
  }

  const name = typeof submission.name === "string" ? submission.name.trim() : "";
  if (name.length < 2 || name.length > 100) {
    return { status: "validation-error", message: "Place name must be between 2 and 100 characters." };
  }

  if (!VALID_PLACE_TYPES.includes(submission.placeType)) {
    return { status: "validation-error", message: "Invalid place type selected." };
  }

  const address = typeof submission.address === "string" ? submission.address.trim() : "";
  if (address.length === 0) {
    return { status: "validation-error", message: "Address is required." };
  }

  if (!Array.isArray(submission.dietTags) || submission.dietTags.length === 0 || !submission.dietTags.every(function (t) { return VALID_DIET_TAGS.includes(t); })) {
    return { status: "validation-error", message: "Please select at least one valid dietary category." };
  }

  // Coordinates: require valid finite numbers within global geographic bounds; no silent fallback.
  const lat = typeof submission.latitude === "number" ? submission.latitude : Number(submission.latitude);
  const lon = typeof submission.longitude === "number" ? submission.longitude : Number(submission.longitude);
  if (!isValidCoordinatePair(lat, lon)) {
    return {
      status: "validation-error",
      message: "Please provide valid coordinates (Latitude: -90 to 90, Longitude: -180 to 180). Click the map or enter them manually."
    };
  }

  const area = typeof submission.area === "string" && submission.area.trim().length > 0
    ? submission.area.trim()
    : "Area not listed";

  const description = typeof submission.description === "string" ? submission.description.trim() : "";
  const dietNotes = typeof submission.dietNotes === "string" ? submission.dietNotes.trim() : "";
  const priceRange = typeof submission.priceRange === "string" && ["budget", "moderate", "premium"].includes(submission.priceRange)
    ? submission.priceRange
    : "Price not listed";
  const openingInfo = typeof submission.openingInfo === "string" ? submission.openingInfo.trim() : "";
  const notesForReview = typeof submission.notesForReview === "string" ? submission.notesForReview.trim() : "";

  const rawImageUrl = typeof submission.imageUrl === "string" ? submission.imageUrl.trim() : "";
  let imageUrl = "";
  if (rawImageUrl.length > 0) {
    if (/^(javascript|data|vbscript|file):/i.test(rawImageUrl) || !isValidImageUrl(rawImageUrl)) {
      return {
        status: "validation-error",
        message: "Photo URL must be a valid, secure Cloudinary image URL (https://res.cloudinary.com/...)."
      };
    }
    imageUrl = rawImageUrl;
  }

  const placeData = {
    name: name,
    placeType: submission.placeType,
    address: address,
    area: area,
    latitude: lat,
    longitude: lon,
    dietTags: submission.dietTags.slice(),
    dietNotes: dietNotes,
    priceRange: priceRange,
    openingInfo: openingInfo,
    description: description,
    notesForReview: notesForReview,
    imageUrl: imageUrl,
    status: "pending",
    verificationStatus: "unverified",
    lastVerifiedAt: null,
    verificationNote: "",
    source: "community",
    submittedBy: user.uid,
    submittedByName: user.displayName || "Community member",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const db = getFirebaseDb();
  try {
    const docRef = await addDoc(collection(db, "places"), placeData);
    return { status: "ok", id: docRef.id };
  } catch (error) {
    console.error("VeganSaathi places-service: submitCommunityPlace failed.", error);
    return { status: "error", error: error };
  }
}

/**
 * fetchReviewsForPlace(placeId)
 * Returns all reviews matching places/{placeId}.
 */
export async function fetchReviewsForPlace(placeId) {
  if (!isNonEmptyString(placeId)) {
    return { status: "ok", reviews: [] };
  }

  const db = getFirebaseDb();
  let snapshot;
  try {
    const q = query(collection(db, "reviews"), where("placeId", "==", placeId));
    snapshot = await getDocs(q);
  } catch (error) {
    console.error("VeganSaathi places-service: fetchReviewsForPlace failed.", error);
    return { status: "error", error: error };
  }

  const reviews = [];
  snapshot.forEach(function (docSnap) {
    const d = docSnap.data();
    if (d && typeof d === "object") {
      const createdAt = toDateOrNull(d.createdAt) || new Date();
      reviews.push({
        id: docSnap.id,
        placeId: d.placeId || placeId,
        userId: d.userId || "",
        authorName: d.authorName || "Anonymous",
        rating: Math.max(1, Math.min(5, Math.round(Number(d.rating)) || 5)),
        comment: typeof d.comment === "string" ? d.comment : "",
        createdAt: createdAt
      });
    }
  });

  // Sort newest first
  reviews.sort(function (a, b) {
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return { status: "ok", reviews: reviews };
}

/**
 * submitReview({ placeId, rating, comment, user })
 */
export async function submitReview({ placeId, rating, comment, user }) {
  if (!user || !user.uid) {
    return { status: "unauthenticated", message: "Please sign in to write a review." };
  }
  if (!isNonEmptyString(placeId)) {
    return { status: "validation-error", message: "Invalid place ID." };
  }

  const numRating = Math.round(Number(rating));
  if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
    return { status: "validation-error", message: "Rating must be an integer between 1 and 5." };
  }

  const textComment = typeof comment === "string" ? comment.trim() : "";
  if (textComment.length < 3) {
    return { status: "validation-error", message: "Comment must be at least 3 characters long." };
  }
  if (textComment.length > 500) {
    return { status: "validation-error", message: "Comment must be 500 characters or fewer." };
  }

  const authorName = user.displayName || "Community member";

  const db = getFirebaseDb();
  try {
    const docRef = await addDoc(collection(db, "reviews"), {
      placeId: placeId,
      userId: user.uid,
      authorName: authorName,
      rating: numRating,
      comment: textComment,
      createdAt: serverTimestamp()
    });
    return { status: "ok", id: docRef.id };
  } catch (error) {
    console.error("VeganSaathi places-service: submitReview failed.", error);
    return { status: "error", error: error };
  }
}

/**
 * deleteReview(reviewId)
 */
export async function deleteReview(reviewId) {
  if (!isNonEmptyString(reviewId)) {
    return { status: "validation-error", message: "Invalid review ID." };
  }
  const db = getFirebaseDb();
  try {
    await deleteDoc(doc(db, "reviews", reviewId));
    return { status: "ok" };
  } catch (error) {
    console.error("VeganSaathi places-service: deleteReview failed.", error);
    return { status: "error", error: error };
  }
}

/**
 * submitReport({ placeId, reason, description, user })
 */
export async function submitReport({ placeId, reason, description, user }) {
  if (!user || !user.uid) {
    return { status: "unauthenticated", message: "Please sign in to submit a report." };
  }
  if (!isNonEmptyString(placeId)) {
    return { status: "validation-error", message: "Invalid place ID." };
  }

  const validReasons = [
    "place-closed", "wrong-diet-info", "wrong-address",
    "temporarily-unavailable", "outdated", "other"
  ];
  if (!validReasons.includes(reason)) {
    return { status: "validation-error", message: "Please select a valid reason." };
  }
  const reportText = typeof description === "string" ? description.trim() : "";
  if (reportText.length > 500) {
    return { status: "validation-error", message: "Description must be 500 characters or fewer." };
  }

  const db = getFirebaseDb();
  try {
    const docRef = await addDoc(collection(db, "reports"), {
      placeId: placeId,
      reporterId: user.uid,
      reason: reason,
      description: typeof description === "string" ? description.trim() : "",
      status: "pending",
      createdAt: serverTimestamp()
    });
    return { status: "ok", id: docRef.id };
  } catch (error) {
    console.error("VeganSaathi places-service: submitReport failed.", error);
    return { status: "error", error: error };
  }
}

/**
 * isPlaceSaved(placeId, userId)
 */
export async function isPlaceSaved(placeId, userId) {
  if (!isNonEmptyString(placeId) || !isNonEmptyString(userId)) return false;
  const db = getFirebaseDb();
  try {
    const docSnap = await getDoc(doc(db, "savedPlaces", userId + "_" + placeId));
    return docSnap.exists();
  } catch (err) {
    console.warn("VeganSaathi places-service: isPlaceSaved check failed.", err);
    return false;
  }
}

/**
 * savePlace(placeId, userId)
 */
export async function savePlace(placeId, userId) {
  if (!isNonEmptyString(placeId) || !isNonEmptyString(userId)) {
    return { status: "validation-error", message: "Invalid place or user." };
  }
  const db = getFirebaseDb();
  try {
    await setDoc(doc(db, "savedPlaces", userId + "_" + placeId), {
      userId: userId,
      placeId: placeId,
      createdAt: serverTimestamp()
    });
    return { status: "ok" };
  } catch (error) {
    console.error("VeganSaathi places-service: savePlace failed.", error);
    return { status: "error", error: error };
  }
}

/**
 * unsavePlace(placeId, userId)
 */
export async function unsavePlace(placeId, userId) {
  if (!isNonEmptyString(placeId) || !isNonEmptyString(userId)) {
    return { status: "validation-error", message: "Invalid place or user." };
  }
  const db = getFirebaseDb();
  try {
    await deleteDoc(doc(db, "savedPlaces", userId + "_" + placeId));
    return { status: "ok" };
  } catch (error) {
    console.error("VeganSaathi places-service: unsavePlace failed.", error);
    return { status: "error", error: error };
  }
}

/**
 * fetchSavedPlacesForUser(userId)
 * Retrieves savedPlaces for userId and resolves each place document.
 */
export async function fetchSavedPlacesForUser(userId) {
  if (!isNonEmptyString(userId)) {
    return { status: "ok", places: [] };
  }
  const db = getFirebaseDb();
  let snapshot;
  try {
    const q = query(collection(db, "savedPlaces"), where("userId", "==", userId));
    snapshot = await getDocs(q);
  } catch (error) {
    console.error("VeganSaathi places-service: fetchSavedPlacesForUser query failed.", error);
    return { status: "error", error: error };
  }

  const placeIds = [];
  snapshot.forEach(function (docSnap) {
    const data = docSnap.data();
    if (data && data.placeId) {
      placeIds.push(data.placeId);
    }
  });

  const places = [];
  for (const id of placeIds) {
    const res = await fetchPlaceById(id);
    if (res.status === "ok" && res.place) {
      places.push(res.place);
    }
  }

  return { status: "ok", places: places };
}

/**
 * fetchUserSubmissions(userId)
 * Fetches places submitted by the given user.
 */
export async function fetchUserSubmissions(userId) {
  if (!isNonEmptyString(userId)) return { status: "ok", submissions: [] };
  const db = getFirebaseDb();
  try {
    const q = query(collection(db, "places"), where("submittedBy", "==", userId));
    const snapshot = await getDocs(q);
    const submissions = [];
    snapshot.forEach(function (docSnap) {
      const data = docSnap.data();
      submissions.push({
        id: docSnap.id,
        name: data.name || "Untitled Place",
        status: data.status || "pending",
        verificationStatus: data.verificationStatus || "unverified",
        createdAt: toDateOrNull(data.createdAt) || new Date()
      });
    });
    return { status: "ok", submissions: submissions };
  } catch (err) {
    console.error("VeganSaathi places-service: fetchUserSubmissions failed.", err);
    return { status: "error", error: err };
  }
}

/**
 * fetchUserReviews(userId)
 * Fetches reviews written by the given user.
 */
export async function fetchUserReviews(userId) {
  if (!isNonEmptyString(userId)) return { status: "ok", reviews: [] };
  const db = getFirebaseDb();
  try {
    const q = query(collection(db, "reviews"), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    const reviews = [];
    snapshot.forEach(function (docSnap) {
      const data = docSnap.data();
      reviews.push({
        id: docSnap.id,
        placeId: data.placeId || "",
        rating: data.rating || 5,
        comment: data.comment || "",
        createdAt: toDateOrNull(data.createdAt) || new Date()
      });
    });
    return { status: "ok", reviews: reviews };
  } catch (err) {
    console.error("VeganSaathi places-service: fetchUserReviews failed.", err);
    return { status: "error", error: err };
  }
}

