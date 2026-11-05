/* ==========================================================================
   VeganSaathi — admin-service.js
   ============================================================================
   Phase 7 — Admin and Moderation Service Layer.
   Handles administrative access checks, pending queue moderation,
   published places editing, re-verification, report resolution,
   review deletion, and dashboard metrics.

   Separates data-access logic from DOM rendering in dashboard.html.
   All privileged actions require role == "admin" on the caller's
   users/{uid} document, enforced server-side by firestore.rules.
   ========================================================================== */

import { getFirebaseDb } from "./firebase-init.js";
import { fetchUserProfile } from "./auth-state.js";
import { PILOT_BOUNDS, COORD_BOUNDS, normalizePlace, isValidImageUrl, isValidCloudinaryUrl } from "./places-service.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const VALID_PLACE_TYPES = ["restaurant", "mess", "canteen", "cafe", "dhaba", "other"];
const VALID_DIET_TAGS = ["vegan", "vegetarian", "eggetarian", "jain"];
const VALID_PRICE_RANGES = ["budget", "moderate", "premium", "Price not listed"];

function toDateOrNull(val) {
  if (!val) return null;
  if (typeof val.toDate === "function") return val.toDate();
  if (val instanceof Date) return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function isValidCoordinatePair(lat, lon) {
  return typeof lat === "number" && typeof lon === "number"
    && !isNaN(lat) && !isNaN(lon)
    && lat >= COORD_BOUNDS.minLat && lat <= COORD_BOUNDS.maxLat
    && lon >= COORD_BOUNDS.minLon && lon <= COORD_BOUNDS.maxLon;
}

/**
 * checkIsAdmin(user)
 * Verifies if user holds the role="admin" claim on users/{uid}.
 */
export async function checkIsAdmin(user) {
  if (!user || !user.uid) return false;
  try {
    const profile = await fetchUserProfile(user.uid);
    return Boolean(profile && profile.role === "admin");
  } catch (err) {
    console.error("VeganSaathi admin-service: role check failed", err);
    return false;
  }
}

/**
 * fetchAdminOverviewStats()
 * Fetches dashboard metric counts from Firestore.
 */
// Shared admin gate for every write. Callers pass the signed-in user; we confirm
// the role from users/{uid} in Firestore (the same record the security rules read).
// Returns null when allowed, or a status object describing the refusal.
// The UI check and this check are conveniences; the Firestore rules remain the
// enforcement boundary.
async function requireAdmin(adminUser) {
  if (!adminUser || !adminUser.uid) {
    return { status: "unauthorized", message: "Admin authentication required." };
  }
  const allowed = await checkIsAdmin(adminUser);
  if (!allowed) {
    return { status: "permission-denied", message: "Your account does not have admin access." };
  }
  return null;
}

export async function fetchAdminOverviewStats() {
  const db = getFirebaseDb();
  try {
    const [pendingSnap, pubSnap, repSnap, revSnap, userSnap] = await Promise.all([
      getDocs(query(collection(db, "places"), where("status", "==", "pending"))),
      getDocs(query(collection(db, "places"), where("status", "==", "published"))),
      getDocs(query(collection(db, "reports"), where("status", "==", "pending"))),
      getDocs(collection(db, "reviews")),
      getDocs(collection(db, "users"))
    ]);

    let pendingCount = 0;
    pendingSnap.forEach(function () { pendingCount++; });

    let publishedCount = 0;
    pubSnap.forEach(function () { publishedCount++; });

    let reportsCount = 0;
    repSnap.forEach(function () { reportsCount++; });

    let reviewsCount = 0;
    revSnap.forEach(function () { reviewsCount++; });

    let usersCount = 0;
    userSnap.forEach(function () { usersCount++; });

    return {
      status: "ok",
      stats: {
        pendingPlaces: pendingCount,
        publishedPlaces: publishedCount,
        openReports: reportsCount,
        totalReviews: reviewsCount,
        totalUsers: usersCount
      }
    };
  } catch (error) {
    console.error("VeganSaathi admin-service: fetchAdminOverviewStats failed", error);
    return { status: "error", error: error };
  }
}

/**
 * fetchPendingSubmissions()
 * Retrieves all places with status == "pending".
 */
export async function fetchPendingSubmissions() {
  const db = getFirebaseDb();
  try {
    const q = query(collection(db, "places"), where("status", "==", "pending"));
    const snapshot = await getDocs(q);
    const places = [];

    snapshot.forEach(function (docSnap) {
      const d = docSnap.data();
      if (d) {
        places.push({
          id: docSnap.id,
          name: d.name || "Untitled Place",
          placeType: d.placeType || "other",
          address: d.address || "",
          area: d.area || "",
          latitude: Number(d.latitude),
          longitude: Number(d.longitude),
          dietTags: Array.isArray(d.dietTags) ? d.dietTags : [],
          dietNotes: d.dietNotes || "",
          priceRange: d.priceRange || "Price not listed",
          openingInfo: d.openingInfo || "",
          description: d.description || "",
          notesForReview: d.notesForReview || "",
          source: d.source || "community",
          submittedBy: d.submittedBy || "",
          submittedByName: d.submittedByName || "Community Member",
          status: d.status || "pending",
          verificationStatus: d.verificationStatus || "unverified",
          createdAt: toDateOrNull(d.createdAt) || new Date()
        });
      }
    });

    places.sort(function (a, b) {
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return { status: "ok", places: places };
  } catch (error) {
    console.error("VeganSaathi admin-service: fetchPendingSubmissions failed", error);
    return { status: "error", error: error };
  }
}

/**
 * approvePlace(placeId, adminUser)
 * Moderates a place to status="published". Verification remains "unverified"
 * until an explicit fieldwork verification occurs.
 */
export async function approvePlace(placeId, adminUser) {
  const denied = await requireAdmin(adminUser);
  if (denied) return denied;
  if (!placeId) return { status: "validation-error", message: "Place ID is required." };

  const db = getFirebaseDb();

  // Publishing must never create a place the public list would silently skip.
  // Read the stored document and run the same normalizePlace() check the public
  // list uses, with status forced to "published", before writing anything.
  let snapshot;
  try {
    snapshot = await getDoc(doc(db, "places", placeId));
  } catch (error) {
    console.error("VeganSaathi admin-service: approvePlace could not read the place", error);
    return { status: "error", error: error };
  }
  if (!snapshot.exists()) {
    return { status: "not-found", message: "This submission no longer exists." };
  }
  const wouldPublish = normalizePlace({ id: placeId, data: Object.assign({}, snapshot.data(), { status: "published" }) });
  if (!wouldPublish) {
    return {
      status: "validation-error",
      message: "This submission is incomplete or invalid and cannot be published. Check its name, type, address, coordinates and diet tags."
    };
  }

  try {
    await updateDoc(doc(db, "places", placeId), {
      status: "published",
      verificationStatus: "unverified",
      approvedBy: adminUser.uid,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { status: "ok" };
  } catch (error) {
    console.error("VeganSaathi admin-service: approvePlace failed", error);
    return { status: "error", error: error };
  }
}

/**
 * rejectPlace(placeId, adminUser, reason)
 * Updates place to status="rejected". Record is preserved in database for audit trail.
 */
export async function rejectPlace(placeId, adminUser, reason) {
  const denied = await requireAdmin(adminUser);
  if (denied) return denied;
  if (!placeId) return { status: "validation-error", message: "Place ID is required." };

  const db = getFirebaseDb();
  try {
    await updateDoc(doc(db, "places", placeId), {
      status: "rejected",
      rejectionReason: typeof reason === "string" ? reason.trim() : "",
      rejectedBy: adminUser.uid,
      rejectedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { status: "ok" };
  } catch (error) {
    console.error("VeganSaathi admin-service: rejectPlace failed", error);
    return { status: "error", error: error };
  }
}

/**
 * fetchPublishedPlacesForAdmin()
 * Retrieves all published places for management and re-verification tracking.
 */
export async function fetchPublishedPlacesForAdmin() {
  const db = getFirebaseDb();
  try {
    const q = query(collection(db, "places"), where("status", "==", "published"));
    const snapshot = await getDocs(q);
    const places = [];

    snapshot.forEach(function (docSnap) {
      const d = docSnap.data();
      if (d) {
        places.push({
          id: docSnap.id,
          name: d.name || "Untitled Place",
          placeType: d.placeType || "other",
          address: d.address || "",
          area: d.area || "",
          latitude: Number(d.latitude),
          longitude: Number(d.longitude),
          dietTags: Array.isArray(d.dietTags) ? d.dietTags : [],
          dietNotes: d.dietNotes || "",
          priceRange: d.priceRange || "Price not listed",
          openingInfo: d.openingInfo || "",
          description: d.description || "",
          source: d.source || "community",
          status: d.status || "published",
          verificationStatus: d.verificationStatus || "unverified",
          lastVerifiedAt: toDateOrNull(d.lastVerifiedAt),
          verificationNote: d.verificationNote || "",
          createdAt: toDateOrNull(d.createdAt) || new Date(),
          updatedAt: toDateOrNull(d.updatedAt) || new Date()
        });
      }
    });

    places.sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });

    return { status: "ok", places: places };
  } catch (error) {
    console.error("VeganSaathi admin-service: fetchPublishedPlacesForAdmin failed", error);
    return { status: "error", error: error };
  }
}

/**
 * updatePlaceByAdmin(placeId, fields, adminUser)
 * Edits details of an existing place record.
 */
export async function updatePlaceByAdmin(placeId, fields, adminUser) {
  const denied = await requireAdmin(adminUser);
  if (denied) return denied;
  if (!placeId) return { status: "validation-error", message: "Place ID is required." };
  if (!fields || typeof fields !== "object") {
    return { status: "validation-error", message: "Invalid update payload." };
  }

  const name = typeof fields.name === "string" ? fields.name.trim() : "";
  if (name.length < 2 || name.length > 100) {
    return { status: "validation-error", message: "Place name must be between 2 and 100 characters." };
  }

  if (!VALID_PLACE_TYPES.includes(fields.placeType)) {
    return { status: "validation-error", message: "Invalid place type selected." };
  }

  const address = typeof fields.address === "string" ? fields.address.trim() : "";
  if (address.length === 0 || address.length > 300) {
    return { status: "validation-error", message: "Address is required and must not exceed 300 characters." };
  }

  if (!Array.isArray(fields.dietTags) || fields.dietTags.length === 0 || !fields.dietTags.every(function (t) { return VALID_DIET_TAGS.includes(t); })) {
    return { status: "validation-error", message: "Please select at least one valid dietary category." };
  }

  const lat = Number(fields.latitude);
  const lon = Number(fields.longitude);
  if (!isValidCoordinatePair(lat, lon)) {
    return {
      status: "validation-error",
      message: "Coordinates must be valid numbers (Latitude: -90 to 90, Longitude: -180 to 180)."
    };
  }

  const priceRange = VALID_PRICE_RANGES.includes(fields.priceRange) ? fields.priceRange : "Price not listed";
  const area = typeof fields.area === "string" ? fields.area.trim() : "";
  const description = typeof fields.description === "string" ? fields.description.trim() : "";
  const dietNotes = typeof fields.dietNotes === "string" ? fields.dietNotes.trim() : "";
  const openingInfo = typeof fields.openingInfo === "string" ? fields.openingInfo.trim() : "";

  const updateData = {
    name: name,
    placeType: fields.placeType,
    address: address,
    area: area,
    latitude: lat,
    longitude: lon,
    dietTags: fields.dietTags.slice(),
    dietNotes: dietNotes,
    priceRange: priceRange,
    openingInfo: openingInfo,
    description: description,
    updatedAt: serverTimestamp()
  };

  if (typeof fields.imageUrl === "string") {
    const rawImageUrl = fields.imageUrl.trim();
    if (rawImageUrl.length > 0) {
      if (/^(javascript|data|vbscript|file):/i.test(rawImageUrl) || !isValidCloudinaryUrl(rawImageUrl)) {
        return {
          status: "validation-error",
          message: "Photo URL must be a valid, secure Cloudinary image URL (https://res.cloudinary.com/...)."
        };
      }
      updateData.imageUrl = rawImageUrl;
    } else {
      updateData.imageUrl = "";
    }
  }

  if (fields.status && ["pending", "published", "rejected"].includes(fields.status)) {
    updateData.status = fields.status;
  }

  const db = getFirebaseDb();
  try {
    await updateDoc(doc(db, "places", placeId), updateData);
    return { status: "ok" };
  } catch (error) {
    console.error("VeganSaathi admin-service: updatePlaceByAdmin failed", error);
    return { status: "error", error: error };
  }
}

/**
 * reverifyPlace(placeId, verificationNote, adminUser)
 * Marks a listing as verified following an actual fieldwork check.
 */
// Validates the physical visit date entered by an admin. Accepts only a real
// calendar date written YYYY-MM-DD, not in the future. Returns { ok, date } or
// { ok: false, message }. The date is stored at local noon so it displays as the
// same calendar day in any timezone.
export function parseVisitDate(text, now) {
  const reference = now instanceof Date ? now : new Date();
  const value = typeof text === "string" ? text.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { ok: false, message: "Enter the visit date as YYYY-MM-DD." };
  }
  const parts = value.split("-").map(Number);
  const y = parts[0], m = parts[1], d = parts[2];
  const date = new Date(y, m - 1, d, 12, 0, 0);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return { ok: false, message: "That is not a real calendar date." };
  }
  const todayNoon = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate(), 12, 0, 0);
  if (date.getTime() > todayNoon.getTime()) {
    return { ok: false, message: "The visit date cannot be in the future." };
  }
  return { ok: true, date: date };
}

export async function reverifyPlace(placeId, verificationNote, adminUser, visitDate) {
  const denied = await requireAdmin(adminUser);
  if (denied) return denied;
  if (!placeId) return { status: "validation-error", message: "Place ID is required." };

  const note = typeof verificationNote === "string" ? verificationNote.trim() : "";
  if (note.length === 0) {
    // A re-verification must record what was actually checked. Never write a
    // default claim that a visit happened.
    return { status: "validation-error", message: "Record what was checked at the visit before marking this place re-verified." };
  }
  if (note.length > 300) {
    return { status: "validation-error", message: "Verification note must not exceed 300 characters." };
  }

  // lastVerifiedAt must be the date of the physical visit the admin entered,
  // never the moment the button was pressed.
  const visit = parseVisitDate(visitDate);
  if (!visit.ok) return { status: "validation-error", message: visit.message };

  const db = getFirebaseDb();
  try {
    await updateDoc(doc(db, "places", placeId), {
      verificationStatus: "verified",
      lastVerifiedAt: visit.date,
      verificationNote: note,
      verifiedBy: adminUser.uid,
      verifiedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { status: "ok" };
  } catch (error) {
    console.error("VeganSaathi admin-service: reverifyPlace failed", error);
    return { status: "error", error: error };
  }
}

/**
 * fetchAdminReports()
 * Fetches all reports for moderation queue.
 */
export async function fetchAdminReports() {
  const db = getFirebaseDb();
  try {
    const snapshot = await getDocs(collection(db, "reports"));
    const reports = [];

    snapshot.forEach(function (docSnap) {
      const d = docSnap.data();
      if (d) {
        reports.push({
          id: docSnap.id,
          placeId: d.placeId || "",
          reporterId: d.reporterId || "",
          reason: d.reason || "other",
          description: d.description || "",
          status: d.status || "pending",
          createdAt: toDateOrNull(d.createdAt) || new Date(),
          resolvedAt: toDateOrNull(d.resolvedAt),
          dismissedAt: toDateOrNull(d.dismissedAt)
        });
      }
    });

    reports.sort(function (a, b) {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return { status: "ok", reports: reports };
  } catch (error) {
    console.error("VeganSaathi admin-service: fetchAdminReports failed", error);
    return { status: "error", error: error };
  }
}

/**
 * resolveReport(reportId, adminUser)
 */
export async function resolveReport(reportId, adminUser) {
  const denied = await requireAdmin(adminUser);
  if (denied) return denied;
  if (!reportId) return { status: "validation-error", message: "Report ID is required." };

  const db = getFirebaseDb();
  try {
    await updateDoc(doc(db, "reports", reportId), {
      status: "resolved",
      resolvedBy: adminUser.uid,
      resolvedAt: serverTimestamp()
    });
    return { status: "ok" };
  } catch (error) {
    console.error("VeganSaathi admin-service: resolveReport failed", error);
    return { status: "error", error: error };
  }
}

/**
 * dismissReport(reportId, adminUser)
 */
export async function dismissReport(reportId, adminUser) {
  const denied = await requireAdmin(adminUser);
  if (denied) return denied;
  if (!reportId) return { status: "validation-error", message: "Report ID is required." };

  const db = getFirebaseDb();
  try {
    await updateDoc(doc(db, "reports", reportId), {
      status: "dismissed",
      dismissedBy: adminUser.uid,
      dismissedAt: serverTimestamp()
    });
    return { status: "ok" };
  } catch (error) {
    console.error("VeganSaathi admin-service: dismissReport failed", error);
    return { status: "error", error: error };
  }
}

/**
 * fetchAdminReviews()
 * Fetches all reviews across places for moderation.
 */
export async function fetchAdminReviews() {
  const db = getFirebaseDb();
  try {
    const snapshot = await getDocs(collection(db, "reviews"));
    const reviews = [];

    snapshot.forEach(function (docSnap) {
      const d = docSnap.data();
      if (d) {
        reviews.push({
          id: docSnap.id,
          placeId: d.placeId || "",
          userId: d.userId || "",
          authorName: d.authorName || "Anonymous",
          rating: Math.max(1, Math.min(5, Math.round(Number(d.rating)) || 5)),
          comment: d.comment || "",
          createdAt: toDateOrNull(d.createdAt) || new Date()
        });
      }
    });

    reviews.sort(function (a, b) {
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return { status: "ok", reviews: reviews };
  } catch (error) {
    console.error("VeganSaathi admin-service: fetchAdminReviews failed", error);
    return { status: "error", error: error };
  }
}

/**
 * deleteReviewByAdmin(reviewId, adminUser)
 */
export async function deleteReviewByAdmin(reviewId, adminUser) {
  const denied = await requireAdmin(adminUser);
  if (denied) return denied;
  if (!reviewId) return { status: "validation-error", message: "Review ID is required." };

  const db = getFirebaseDb();
  try {
    await deleteDoc(doc(db, "reviews", reviewId));
    return { status: "ok" };
  } catch (error) {
    console.error("VeganSaathi admin-service: deleteReviewByAdmin failed", error);
    return { status: "error", error: error };
  }
}

/**
 * fetchAdminUsersList()
 * Retrieves user accounts for administrative visibility.
 */
export async function fetchAdminUsersList() {
  const db = getFirebaseDb();
  try {
    const snapshot = await getDocs(collection(db, "users"));
    const users = [];

    snapshot.forEach(function (docSnap) {
      const d = docSnap.data();
      if (d) {
        users.push({
          uid: docSnap.id,
          name: d.name || "(no name)",
          email: d.email || "",
          role: d.role || "user",
          dietPreference: d.dietPreference || "unspecified",
          createdAt: toDateOrNull(d.createdAt) || new Date()
        });
      }
    });

    users.sort(function (a, b) {
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return { status: "ok", users: users };
  } catch (error) {
    console.error("VeganSaathi admin-service: fetchAdminUsersList failed", error);
    return { status: "error", error: error };
  }
}
