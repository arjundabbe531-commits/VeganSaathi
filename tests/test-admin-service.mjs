/* ==========================================================================
   VeganSaathi — tests/test-admin-service.mjs
   ============================================================================
   Phase 7 Admin & Moderation Unit Tests.
   Exercises admin-service.js using Node.js assert and tests/firebase-stub-loader.mjs.
   Tests authentication gating, moderation queues, approve/reject lifecycle,
   re-verification, reports, reviews, and safe error states.
   ========================================================================== */

import { register } from "node:module";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
register("./firebase-stub-loader.mjs", import.meta.url);

const adminServicePath = pathToFileURL(
  path.join(__dirname, "..", "frontend", "js", "admin-service.js")
).href;

const {
  checkIsAdmin,
  fetchAdminOverviewStats,
  fetchPendingSubmissions,
  approvePlace,
  rejectPlace,
  fetchPublishedPlacesForAdmin,
  updatePlaceByAdmin,
  reverifyPlace,
  fetchAdminReports,
  resolveReport,
  dismissReport,
  fetchAdminReviews,
  deleteReviewByAdmin,
  fetchAdminUsersList
} = await import(adminServicePath);

let passed = 0;
let failed = 0;

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log("PASS - " + name);
    passed++;
  } catch (err) {
    console.log("FAIL - " + name + " :: " + err.message);
    failed++;
  }
}

function stubTimestamp(iso) {
  return { toDate: function () { return new Date(iso); } };
}

console.log("Starting Phase 7 Admin Service tests...\n");

// 1. Admin Role & Gating
// A stored place that normalizePlace() accepts (pending, community, pilot-box coordinates).
function validPendingPlace(overrides) {
  const stamp = { toDate: function () { return new Date("2026-10-01T12:00:00Z"); } };
  return Object.assign({
    name: "Submitted Dosa Corner",
    placeType: "cafe",
    address: "Station Road, Shegaon",
    latitude: 20.79,
    longitude: 76.69,
    dietTags: ["vegan"],
    priceRange: "budget",
    status: "pending",
    verificationStatus: "unverified",
    source: "community",
    submittedBy: "uid-student",
    submittedByName: "Community member",
    createdAt: stamp,
    updatedAt: stamp
  }, overrides || {});
}

// Admin and ordinary-user profiles plus the given places, all served by the stub lookup.
function setAdminAndPlaces(placesById) {
  globalThis.__STUB_DOC_BY_ID__ = function (id) {
    if (id === "admin-1") return { id: id, data: { role: "admin", email: "admin@ssgmce.ac.in" } };
    if (id === "user-1") return { id: id, data: { role: "user", email: "user@ssgmce.ac.in" } };
    if (placesById[id]) return { id: id, data: placesById[id] };
    return null;
  };
}

// Models the users/{uid} lookup that requireAdmin() performs. admin-1 is an
// administrator; user-1 is an ordinary signed-in user.
function setAdminStub() {
  globalThis.__STUB_DOC_BY_ID__ = function (id) {
    if (id === "admin-1") return { id: id, data: { role: "admin", email: "admin@ssgmce.ac.in" } };
    if (id === "user-1") return { id: id, data: { role: "user", email: "user@ssgmce.ac.in" } };
    return null;
  };
}

await asyncTest("checkIsAdmin: signed-out user is denied access", async function () {
  assert.equal(await checkIsAdmin(null), false);
  assert.equal(await checkIsAdmin(undefined), false);
  assert.equal(await checkIsAdmin({}), false);
});

await asyncTest("checkIsAdmin: non-admin authenticated user is denied access", async function () {
  globalThis.__STUB_DOC_BY_ID__ = function (id) {
    if (id === "user-regular") {
      return { id: "user-regular", data: { role: "user", email: "user@ssgmce.ac.in" } };
    }
    return null;
  };
  const result = await checkIsAdmin({ uid: "user-regular" });
  assert.equal(result, false);
});

await asyncTest("checkIsAdmin: authorized admin user is granted access", async function () {
  globalThis.__STUB_DOC_BY_ID__ = function (id) {
    if (id === "user-admin") {
      return { id: "user-admin", data: { role: "admin", email: "admin@ssgmce.ac.in" } };
    }
    return null;
  };
  const result = await checkIsAdmin({ uid: "user-admin" });
  assert.equal(result, true);
});

await asyncTest("checkIsAdmin: profile lookup failure returns false safely", async function () {
  globalThis.__STUB_THROW__ = new Error("Firestore network disconnect");
  const result = await checkIsAdmin({ uid: "user-admin" });
  assert.equal(result, false);
});

// 2. Overview Stats
await asyncTest("fetchAdminOverviewStats: returns metric counts accurately", async function () {
  globalThis.__STUB_DOCS__ = [
    { id: "1", data: { status: "pending" } },
    { id: "2", data: { status: "pending" } }
  ];
  const res = await fetchAdminOverviewStats();
  assert.equal(res.status, "ok");
  assert.ok(typeof res.stats.pendingPlaces === "number");
  assert.ok(typeof res.stats.publishedPlaces === "number");
  assert.ok(typeof res.stats.openReports === "number");
});

await asyncTest("fetchAdminOverviewStats: surfaces error without mock fallback on query failure", async function () {
  globalThis.__STUB_THROW__ = new Error("Permission denied");
  const res = await fetchAdminOverviewStats();
  assert.equal(res.status, "error");
  assert.ok(res.error);
});

// 3. Pending Submissions & Moderation
await asyncTest("fetchPendingSubmissions: loads pending places and sorts newest first", async function () {
  globalThis.__STUB_DOCS__ = [
    { id: "p1", data: { name: "Older Place", status: "pending", createdAt: stubTimestamp("2026-01-01T00:00:00Z") } },
    { id: "p2", data: { name: "Newer Place", status: "pending", createdAt: stubTimestamp("2026-02-01T00:00:00Z") } }
  ];
  const res = await fetchPendingSubmissions();
  assert.equal(res.status, "ok");
  assert.equal(res.places.length, 2);
  assert.equal(res.places[0].id, "p2"); // newest first
});

await asyncTest("approvePlace: updates status to published and leaves verification unverified", async function () {
  globalThis.__STUB_UPDATES__ = [];
  setAdminAndPlaces({ p1: validPendingPlace() });
  const adminUser = { uid: "admin-1" };
  const res = await approvePlace("p1", adminUser);
  assert.equal(res.status, "ok");

  const lastUpdate = globalThis.__STUB_UPDATES__[globalThis.__STUB_UPDATES__.length - 1];
  assert.equal(lastUpdate.id, "p1");
  assert.equal(lastUpdate.data.status, "published");
  assert.equal(lastUpdate.data.verificationStatus, "unverified"); // must NOT be auto-verified
  assert.equal(lastUpdate.data.approvedBy, "admin-1");
});

await asyncTest("rejectPlace: updates status to rejected with audit reason", async function () {
  globalThis.__STUB_UPDATES__ = [];
  setAdminStub();
  const adminUser = { uid: "admin-1" };
  const res = await rejectPlace("p1", adminUser, "Incomplete address");
  assert.equal(res.status, "ok");

  const lastUpdate = globalThis.__STUB_UPDATES__[globalThis.__STUB_UPDATES__.length - 1];
  assert.equal(lastUpdate.id, "p1");
  assert.equal(lastUpdate.data.status, "rejected");
  assert.equal(lastUpdate.data.rejectionReason, "Incomplete address");
  assert.equal(lastUpdate.data.rejectedBy, "admin-1");
});

// 4. Listing Management & Validation
await asyncTest("updatePlaceByAdmin: accepts globally valid coordinates (Pune)", async function () {
  setAdminStub();
  globalThis.__STUB_UPDATES__ = [];
  const adminUser = { uid: "admin-1" };
  const res = await updatePlaceByAdmin("p1", {
    name: "Valid Name",
    placeType: "cafe",
    address: "Valid Address, Pune",
    dietTags: ["vegan"],
    latitude: 18.5204, // Pune lat — valid globally
    longitude: 73.8567
  }, adminUser);
  assert.equal(res.status, "ok", "Pune coordinates are globally valid and must be accepted");
});

await asyncTest("updatePlaceByAdmin: rejects truly invalid coordinates (outside global range)", async function () {
  setAdminStub();
  globalThis.__STUB_UPDATES__ = [];
  const adminUser = { uid: "admin-1" };
  const res = await updatePlaceByAdmin("p1", {
    name: "Valid Name",
    placeType: "cafe",
    address: "Valid Address",
    dietTags: ["vegan"],
    latitude: 200, // > 90 — genuinely invalid globally
    longitude: 73.8567
  }, adminUser);
  assert.equal(res.status, "validation-error");
  assert.equal(globalThis.__STUB_UPDATES__.length, 0);
});

await asyncTest("updatePlaceByAdmin: updates permitted fields with valid data", async function () {
  globalThis.__STUB_UPDATES__ = [];
  setAdminStub();
  const adminUser = { uid: "admin-1" };
  const res = await updatePlaceByAdmin("p1", {
    name: "Updated Name",
    placeType: "restaurant",
    address: "Station Road",
    area: "Near Gate",
    latitude: 20.7936,
    longitude: 76.6946,
    dietTags: ["vegan", "vegetarian"],
    priceRange: "budget",
    description: "Verified options",
    openingInfo: "8am - 9pm"
  }, adminUser);
  assert.equal(res.status, "ok");

  const lastUpdate = globalThis.__STUB_UPDATES__[globalThis.__STUB_UPDATES__.length - 1];
  assert.equal(lastUpdate.id, "p1");
  assert.equal(lastUpdate.data.name, "Updated Name");
  assert.equal(lastUpdate.data.placeType, "restaurant");
  assert.equal(lastUpdate.data.priceRange, "budget");
});

await asyncTest("updatePlaceByAdmin: updates imageUrl when provided", async function () {
  globalThis.__STUB_UPDATES__ = [];
  setAdminStub();
  const adminUser = { uid: "admin-1" };
  const res = await updatePlaceByAdmin("p1", {
    name: "Updated Name",
    placeType: "restaurant",
    address: "New Address",
    latitude: 18.5204,
    longitude: 73.8567,
    dietTags: ["vegan"],
    imageUrl: "https://res.cloudinary.com/vegansaathi/image/upload/v123/p1_new.jpg"
  }, adminUser);
  assert.equal(res.status, "ok");

  const lastUpdate = globalThis.__STUB_UPDATES__[globalThis.__STUB_UPDATES__.length - 1];
  assert.equal(lastUpdate.data.imageUrl, "https://res.cloudinary.com/vegansaathi/image/upload/v123/p1_new.jpg");
});

await asyncTest("updatePlaceByAdmin: rejects unsafe imageUrl", async function () {
  setAdminStub();
  const adminUser = { uid: "admin-1" };
  const res = await updatePlaceByAdmin("p1", {
    name: "Updated Name",
    placeType: "restaurant",
    address: "New Address",
    latitude: 18.5204,
    longitude: 73.8567,
    dietTags: ["vegan"],
    imageUrl: "javascript:alert(1)"
  }, adminUser);
  assert.equal(res.status, "validation-error");
});

// 5. Re-Verification
await asyncTest("reverifyPlace: marks listing verified and records timestamp and note", async function () {
  globalThis.__STUB_UPDATES__ = [];
  setAdminStub();
  const adminUser = { uid: "admin-1" };
  const res = await reverifyPlace("p1", "Checked kitchen on 12 Oct", adminUser, "2026-10-12");
  assert.equal(res.status, "ok");

  const lastUpdate = globalThis.__STUB_UPDATES__[globalThis.__STUB_UPDATES__.length - 1];
  assert.equal(lastUpdate.id, "p1");
  assert.equal(lastUpdate.data.verificationStatus, "verified");
  assert.equal(lastUpdate.data.verificationNote, "Checked kitchen on 12 Oct");
});

// 6. Reports Moderation
await asyncTest("fetchAdminReports: loads reports queue", async function () {
  globalThis.__STUB_DOCS__ = [
    { id: "r1", data: { placeId: "p1", reason: "place-closed", status: "pending", createdAt: stubTimestamp("2026-01-01T00:00:00Z") } },
    { id: "r2", data: { placeId: "p2", reason: "wrong-diet-info", status: "resolved", createdAt: stubTimestamp("2026-02-01T00:00:00Z") } }
  ];
  const res = await fetchAdminReports();
  assert.equal(res.status, "ok");
  assert.equal(res.reports.length, 2);
  assert.equal(res.reports[0].id, "r1"); // pending first
});

await asyncTest("resolveReport and dismissReport: update report lifecycle accurately", async function () {
  globalThis.__STUB_UPDATES__ = [];
  setAdminStub();
  const adminUser = { uid: "admin-1" };

  const res1 = await resolveReport("r1", adminUser);
  assert.equal(res1.status, "ok");
  const update1 = globalThis.__STUB_UPDATES__[globalThis.__STUB_UPDATES__.length - 1];
  assert.equal(update1.data.status, "resolved");

  const res2 = await dismissReport("r2", adminUser);
  assert.equal(res2.status, "ok");
  const update2 = globalThis.__STUB_UPDATES__[globalThis.__STUB_UPDATES__.length - 1];
  assert.equal(update2.data.status, "dismissed");
});

// 7. Review Moderation
await asyncTest("deleteReviewByAdmin: deletes review document via deleteDoc", async function () {
  globalThis.__STUB_DELETES__ = [];
  setAdminStub();
  const adminUser = { uid: "admin-1" };
  const res = await deleteReviewByAdmin("rev-99", adminUser);
  assert.equal(res.status, "ok");
  assert.equal(globalThis.__STUB_DELETES__[0], "reviews/rev-99");
});

// 8. User Administration
await asyncTest("fetchAdminUsersList: retrieves user accounts for admin visibility", async function () {
  globalThis.__STUB_DOCS__ = [
    { id: "u1", data: { name: "Student A", email: "student@ssgmce.ac.in", role: "user", dietPreference: "vegan" } }
  ];
  const res = await fetchAdminUsersList();
  assert.equal(res.status, "ok");
  assert.equal(res.users.length, 1);
  assert.equal(res.users[0].name, "Student A");
  assert.equal(res.users[0].role, "user");
});


await asyncTest("reverifyPlace REFUSES an empty note and performs no write (no fabricated visit claim)", async function () {
  globalThis.__STUB_UPDATES__ = [];
  const before = globalThis.__STUB_UPDATES__.length;
  setAdminStub();
  const adminUser = { uid: "admin-1" };
  const res = await reverifyPlace("p1", "", adminUser, "2026-10-12");
  assert.equal(res.status, "validation-error");
  assert.equal(globalThis.__STUB_UPDATES__.length, before, "no updateDoc call may happen without a recorded note");
  const resWhitespace = await reverifyPlace("p1", "   ", adminUser, "2026-10-12");
  assert.equal(resWhitespace.status, "validation-error");
  assert.equal(globalThis.__STUB_UPDATES__.length, before);
});


await asyncTest("every admin WRITE refuses a non-admin user and writes nothing (H1)", async function () {
  setAdminStub();
  const nonAdmin = { uid: "user-1" };
  globalThis.__STUB_UPDATES__ = [];
  const results = [
    await approvePlace("p1", nonAdmin),
    await rejectPlace("p1", nonAdmin, "not suitable"),
    await updatePlaceByAdmin("p1", { name: "Changed" }, nonAdmin),
    await reverifyPlace("p1", "checked kitchen", nonAdmin, "2026-10-12"),
    await resolveReport("r1", nonAdmin),
    await dismissReport("r1", nonAdmin),
    await deleteReviewByAdmin("rv1", nonAdmin)
  ];
  for (const r of results) assert.equal(r.status, "permission-denied");
  assert.equal(globalThis.__STUB_UPDATES__.length, 0, "a non-admin must never cause a write");
});

await asyncTest("admin WRITE functions still refuse a missing user with 'unauthorized'", async function () {
  setAdminStub();
  const r = await approvePlace("p1", null);
  assert.equal(r.status, "unauthorized");
});


await asyncTest("parseVisitDate accepts a real past date and rejects malformed, impossible and future dates", async function () {
  // Use pathToFileURL to build a portable file:// URL — bare Windows paths
  // (e.g. d:\...) are not valid ESM specifiers on Node 18+ on Windows.
  const adminServiceUrl = pathToFileURL(
    path.join(__dirname, "..", "frontend", "js", "admin-service.js")
  ).href;
  const { parseVisitDate } = await import(adminServiceUrl);
  const now = new Date(2026, 9, 15, 10, 0, 0); // 15 Oct 2026, local
  assert.equal(parseVisitDate("2026-10-12", now).ok, true);
  assert.equal(parseVisitDate("2026-10-15", now).ok, true, "today is allowed");
  assert.equal(parseVisitDate("2026-10-16", now).ok, false, "tomorrow is refused");
  assert.equal(parseVisitDate("2026-02-30", now).ok, false, "impossible date refused");
  assert.equal(parseVisitDate("15/10/2026", now).ok, false, "wrong format refused");
  assert.equal(parseVisitDate("", now).ok, false, "empty refused");
  const good = parseVisitDate("2026-10-12", now);
  assert.equal(good.date.getFullYear(), 2026);
  assert.equal(good.date.getMonth(), 9);
  assert.equal(good.date.getDate(), 12);
});

await asyncTest("reverifyPlace refuses a missing or invalid visit date and writes nothing", async function () {
  setAdminStub();
  globalThis.__STUB_UPDATES__ = [];
  const adminUser = { uid: "admin-1" };
  const missing = await reverifyPlace("p1", "checked kitchen", adminUser, "");
  const future = await reverifyPlace("p1", "checked kitchen", adminUser, "2099-01-01");
  assert.equal(missing.status, "validation-error");
  assert.equal(future.status, "validation-error");
  assert.equal(globalThis.__STUB_UPDATES__.length, 0);
});

await asyncTest("reverifyPlace stores the entered VISIT date as lastVerifiedAt, not the click time", async function () {
  setAdminStub();
  globalThis.__STUB_UPDATES__ = [];
  const adminUser = { uid: "admin-1" };
  const res = await reverifyPlace("p1", "checked kitchen and menu", adminUser, "2026-10-12");
  assert.equal(res.status, "ok");
  const write = globalThis.__STUB_UPDATES__[globalThis.__STUB_UPDATES__.length - 1];
  assert.ok(write.data.lastVerifiedAt instanceof Date, "lastVerifiedAt must be a Date built from the visit");
  assert.equal(write.data.lastVerifiedAt.getFullYear(), 2026);
  assert.equal(write.data.lastVerifiedAt.getMonth(), 9);
  assert.equal(write.data.lastVerifiedAt.getDate(), 12);
  assert.equal(write.data.verifiedBy, "admin-1", "the verifier is recorded");
});


await asyncTest("approvePlace refuses to publish an invalid stored place and writes nothing", async function () {
  setAdminAndPlaces({ "p-bad": validPendingPlace({ placeType: "food-truck" }) });
  globalThis.__STUB_UPDATES__ = [];
  const res = await approvePlace("p-bad", { uid: "admin-1" });
  assert.equal(res.status, "validation-error");
  assert.equal(globalThis.__STUB_UPDATES__.length, 0, "an invalid place must never be published");
});

await asyncTest("approvePlace accepts globally valid coordinates outside the former Shegaon pilot box", async function () {
  // Mumbai coordinates are valid globally (lat 19.07, lon 72.87) and must now be accepted.
  setAdminAndPlaces({ "p-mumbai": validPendingPlace({ latitude: 19.07, longitude: 72.87, address: "Station Road, Mumbai" }) });
  globalThis.__STUB_UPDATES__ = [];
  const res = await approvePlace("p-mumbai", { uid: "admin-1" });
  assert.equal(res.status, "ok", "globally valid coordinates must be approved, not rejected");
});

await asyncTest("approvePlace refuses truly invalid coordinates (out of global range)", async function () {
  // lat 200 is outside -90/90 — genuinely invalid, not just outside a region.
  setAdminAndPlaces({ "p-bad-coord": validPendingPlace({ latitude: 200, longitude: 76.69 }) });
  globalThis.__STUB_UPDATES__ = [];
  const res = await approvePlace("p-bad-coord", { uid: "admin-1" });
  assert.equal(res.status, "validation-error");
  assert.equal(globalThis.__STUB_UPDATES__.length, 0);
});

await asyncTest("approvePlace reports a missing submission as not-found and writes nothing", async function () {
  setAdminAndPlaces({});
  globalThis.__STUB_UPDATES__ = [];
  const res = await approvePlace("p-gone", { uid: "admin-1" });
  assert.equal(res.status, "not-found");
  assert.equal(globalThis.__STUB_UPDATES__.length, 0);
});

await asyncTest("approvePlace publishes a valid pending place without touching verification", async function () {
  setAdminAndPlaces({ "p-good": validPendingPlace() });
  globalThis.__STUB_UPDATES__ = [];
  const res = await approvePlace("p-good", { uid: "admin-1" });
  assert.equal(res.status, "ok");
  const write = globalThis.__STUB_UPDATES__[globalThis.__STUB_UPDATES__.length - 1];
  assert.equal(write.data.status, "published");
  assert.equal(write.data.verificationStatus, "unverified", "approval must never claim verification");
  assert.equal(write.data.approvedBy, "admin-1");
});

console.log("\nPhase 7 Admin Service test run complete: " + passed + " passed, " + failed + " failed\n");
if (failed > 0) {
  process.exit(1);
}
