/* ==========================================================================
   VeganSaathi — tests/test-places-service.mjs
   ============================================================================
   Plain Node.js test for Task 5.1c — no test framework, just node:assert,
   matching this project's existing testing style (see
   tests/check-duplicate-globals.js). Run with:

     node tests/test-places-service.mjs

   Uses tests/firebase-stub-loader.mjs (a Node module-resolution hook, not an
   npm package) so places-service.js can actually be imported and exercised
   in plain Node, without a network connection and without touching the
   real Firestore SDK. See that file's header comment for why this is
   necessary at all.
   ========================================================================== */

import { register } from "node:module";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
register("./firebase-stub-loader.mjs", import.meta.url);

const placesServicePath = pathToFileURL(
  path.join(__dirname, "..", "frontend", "js", "places-service.js")
).href;

const {
  normalizePlace,
  fetchPublishedPlaces,
  fetchPlaceById,
  submitCommunityPlace,
  fetchReviewsForPlace,
  submitReview,
  deleteReview,
  submitReport,
  isPlaceSaved,
  savePlace,
  unsavePlace,
  fetchSavedPlacesForUser,
  fetchUserSubmissions,
  fetchUserReviews
} = await import(placesServicePath);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log("PASS - " + name);
    passed++;
  } catch (err) {
    console.log("FAIL - " + name + " :: " + err.message);
    failed++;
  }
}

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

function stubTimestamp(isoString) {
  const d = new Date(isoString);
  return { toDate: function () { return d; } };
}

// A minimally valid, fully-populated place, reused and mutated per test so
// each case only varies the one thing it's actually testing.
function basePlace(overrides) {
  const data = Object.assign({
    name: "SSGMCE Main Canteen",
    placeType: "canteen",
    address: "SSGMCE Campus, Shegaon",
    latitude: 20.7935,
    longitude: 76.6977,
    dietTags: ["vegetarian"],
    status: "published",
    verificationStatus: "unverified",
    source: "fieldwork",
    submittedBy: "uid-teammate-1",
    submittedByName: "Test Teammate",
    createdAt: stubTimestamp("2026-09-01T12:00:00Z"),
    updatedAt: stubTimestamp("2026-09-02T12:00:00Z")
  }, overrides || {});
  return { id: overrides && overrides.__id || "ssgmce-main-canteen", data: data };
}

/* ==========================================================================
   1. Valid published place
   ========================================================================== */
test("1. valid published place normalizes successfully", function () {
  const result = normalizePlace(basePlace());
  assert.ok(result, "expected a normalized object, got null");
  assert.equal(result.id, "ssgmce-main-canteen");
  assert.equal(result.name, "SSGMCE Main Canteen");
  assert.equal(result.status, "published");
});

test("published normalization preserves only bounded public dietary evidence fields", function () {
  const result = normalizePlace(basePlace({
    dietTags: ["vegan"], veganClassification: "verified_vegan_options", evidenceStatus: "ingredients_reviewed",
    verificationStatus: "verified", lastVerifiedAt: stubTimestamp("2026-11-05T12:00:00Z"),
    verificationDimensions: { vegan_options_verified: true },
    evidenceRefs: [{ claim: "vegan_options", url: "https://business.example.test/menu", sourceType: "official_business_source", sourceOwner: "Business", lastCheckedAt: "2026-11-05", validity: "current", strength: "direct", excerpt: "Specific menu item and ingredients reviewed.", reviewerUid: "private-admin-id", reviewerNote: "Internal moderation note." }]
  }));
  assert.deepEqual(result.evidenceRefs, [{ claim: "vegan_options", url: "https://business.example.test/menu", lastCheckedAt: "2026-11-05", validity: "current", strength: "direct", excerpt: "Specific menu item and ingredients reviewed." }]);
});

/* ==========================================================================
   2. Missing optional fields get safe presentational defaults, not fabricated data
   ========================================================================== */
test("2. missing optional fields get safe presentational defaults", function () {
  const raw = basePlace();
  delete raw.data.description;
  delete raw.data.area;
  delete raw.data.priceRange;
  delete raw.data.dietNotes;
  delete raw.data.openingInfo;
  delete raw.data.imageUrl;
  const result = normalizePlace(raw);
  assert.ok(result, "expected a normalized object");
  assert.equal(result.description, "");
  assert.equal(result.area, "Area not listed");
  assert.equal(result.priceRange, "Price not listed");
  assert.equal(result.dietNotes, "");
  assert.equal(result.openingInfo, "");
  assert.equal(result.imageUrl, null);
  assert.equal(result.city, "");
  assert.equal(result.state, "");
  assert.equal(result.country, "");
  assert.equal(result.postalCode, "");
});

test("2b. present structured location fields are preserved cleanly", function () {
  const raw = basePlace({
    city: "Shegaon",
    state: "Maharashtra",
    country: "India",
    postalCode: "444203"
  });
  const result = normalizePlace(raw);
  assert.ok(result, "expected a normalized object");
  assert.equal(result.city, "Shegaon");
  assert.equal(result.state, "Maharashtra");
  assert.equal(result.country, "India");
  assert.equal(result.postalCode, "444203");
});

/* ==========================================================================
   3. Firestore Timestamp -> JS Date conversion
   ========================================================================== */
test("3. Firestore Timestamp converts to a real JS Date", function () {
  const result = normalizePlace(basePlace());
  assert.ok(result.createdAt instanceof Date, "createdAt should be a Date instance");
  assert.equal(result.createdAt.toISOString(), "2026-09-01T12:00:00.000Z");
  assert.ok(result.updatedAt instanceof Date, "updatedAt should be a Date instance");
});

/* ==========================================================================
   4. Invalid placeType
   ========================================================================== */
test("4. invalid placeType is rejected", function () {
  const raw = basePlace({ placeType: "food-truck" });
  assert.equal(normalizePlace(raw), null);
});

/* ==========================================================================
   5. Invalid dietTags
   ========================================================================== */
test("5. invalid dietTags value is rejected", function () {
  const raw = basePlace({ dietTags: ["vegan", "carnivore"] });
  assert.equal(normalizePlace(raw), null);
});

test("5b. empty dietTags array is rejected", function () {
  const raw = basePlace({ dietTags: [] });
  assert.equal(normalizePlace(raw), null);
});

/* ==========================================================================
   6. Invalid status
   ========================================================================== */
test("6. invalid status is rejected", function () {
  const raw = basePlace({ status: "archived" });
  assert.equal(normalizePlace(raw), null);
});

/* ==========================================================================
   7. Invalid verificationStatus
   ========================================================================== */
test("7. invalid verificationStatus is rejected", function () {
  const raw = basePlace({ verificationStatus: "trusted" });
  assert.equal(normalizePlace(raw), null);
});

/* ==========================================================================
   8. Invalid coordinates (missing, wrong type, and swapped/out-of-pilot-box)
   ========================================================================== */
test("8a. missing coordinates are rejected", function () {
  const raw = basePlace({ latitude: undefined, longitude: undefined });
  assert.equal(normalizePlace(raw), null);
});

test("8b. non-numeric coordinates are rejected", function () {
  const raw = basePlace({ latitude: "20.79", longitude: "76.69" });
  assert.equal(normalizePlace(raw), null);
});

test("8c. coordinates with swapped Shegaon lat/lon are accepted globally (both values are within -90/90 and -180/180)", function () {
  // Shegaon's real lat/lon swapped: latitude becomes ~76.7 (valid globally), longitude becomes ~20.8 (valid globally).
  // With global bounds, both values are in range and the place is accepted.
  // The former Shegaon PILOT_BOUNDS would have rejected this; the global COORD_BOUNDS cannot
  // detect a swap for arbitrary coordinates — admins must verify physical data.
  const raw = basePlace({ latitude: 76.6977, longitude: 20.7935 });
  const result = normalizePlace(raw);
  assert.ok(result, "swapped Shegaon coords are still within global ranges and must be accepted");
});

test("8d. coordinates from a city elsewhere in India are accepted globally", function () {
  // Mumbai coordinates — previously rejected by PILOT_BOUNDS, now globally valid.
  const raw = basePlace({ latitude: 19.0760, longitude: 72.8777 });
  const result = normalizePlace(raw);
  assert.ok(result, "Mumbai coords are valid globally and must be accepted");
});

test("8e. coordinates outside global ranges are rejected", function () {
  // lat 200 is > 90 — genuinely impossible, not just outside a region.
  const raw = basePlace({ latitude: 200, longitude: 76.69 });
  assert.equal(normalizePlace(raw), null);
  // lon -200 is < -180.
  const raw2 = basePlace({ latitude: 20.79, longitude: -200 });
  assert.equal(normalizePlace(raw2), null);
});

/* ==========================================================================
   9. verified place without lastVerifiedAt is invalid
   ========================================================================== */
test("9a. verified without lastVerifiedAt is rejected", function () {
  const raw = basePlace({ verificationStatus: "verified" });
  assert.equal(normalizePlace(raw), null);
});

test("9b. verified WITH a valid lastVerifiedAt normalizes correctly", function () {
  const raw = basePlace({
    verificationStatus: "verified",
    lastVerifiedAt: stubTimestamp("2026-09-10T12:00:00Z")
  });
  const result = normalizePlace(raw);
  assert.ok(result, "expected a normalized object");
  assert.ok(result.lastVerifiedAt instanceof Date);
  assert.equal(result.lastVerifiedAt.toISOString(), "2026-09-10T12:00:00.000Z");
});

test("9c. the 90-day freshness rule never changes verificationStatus itself", function () {
  // A verified place from over a year ago is still normalized as "verified"
  // — the soft re-check-due cue is a future UI concern, not this layer's.
  const raw = basePlace({
    verificationStatus: "verified",
    lastVerifiedAt: stubTimestamp("2024-01-01T12:00:00Z")
  });
  const result = normalizePlace(raw);
  assert.ok(result);
  assert.equal(result.verificationStatus, "verified");
});

/* ==========================================================================
   10 & 13 & 14. fetchPublishedPlaces / fetchPlaceById against the stub
   ========================================================================== */
await asyncTest("10. fetchPlaceById returns not-found for a missing document", async function () {
  globalThis.__STUB_DOC_BY_ID__ = function () { return null; };
  const result = await fetchPlaceById("does-not-exist");
  assert.equal(result.status, "not-found");
});

await asyncTest("11. fetchPlaceById surfaces permission-denied distinctly", async function () {
  const err = new Error("Missing or insufficient permissions.");
  err.code = "permission-denied";
  globalThis.__STUB_THROW__ = err;
  const result = await fetchPlaceById("some-id");
  assert.equal(result.status, "permission-denied");
});

await asyncTest("12. fetchPublishedPlaces surfaces a generic network/read error distinctly", async function () {
  const err = new Error("network unavailable");
  err.code = "unavailable";
  globalThis.__STUB_THROW__ = err;
  const result = await fetchPublishedPlaces();
  assert.equal(result.status, "error");
  assert.ok(result.error);
});

await asyncTest("13. fetchPublishedPlaces returns multiple valid places", async function () {
  globalThis.__STUB_DOCS__ = [
    basePlace({ __id: "place-a" }),
    basePlace({ __id: "place-b", name: "Second Valid Place" })
  ].map(function (p) { return { id: p.id, data: p.data }; });
  const result = await fetchPublishedPlaces();
  assert.equal(result.status, "ok");
  assert.equal(result.places.length, 2);
  const ids = result.places.map(function (p) { return p.id; }).sort();
  assert.deepEqual(ids, ["place-a", "place-b"]);
});

await asyncTest("14. an invalid document is skipped while valid documents continue loading", async function () {
  const valid1 = basePlace({ __id: "good-1" });
  const invalid = basePlace({ __id: "bad-1", placeType: "not-a-real-type" });
  const valid2 = basePlace({ __id: "good-2", name: "Another Good Place" });
  globalThis.__STUB_DOCS__ = [valid1, invalid, valid2].map(function (p) { return { id: p.id, data: p.data }; });

  const result = await fetchPublishedPlaces();
  assert.equal(result.status, "ok");
  assert.equal(result.places.length, 2, "the invalid document should be skipped, not crash the whole load");
  const ids = result.places.map(function (p) { return p.id; }).sort();
  assert.deepEqual(ids, ["good-1", "good-2"]);
});

await asyncTest("fetchPlaceById returns 'invalid' (not a fallback place) for a malformed document", async function () {
  const bad = basePlace({ __id: "malformed-1", dietTags: [] });
  globalThis.__STUB_DOC_BY_ID__ = function (id) {
    return id === "malformed-1" ? { id: bad.id, data: bad.data } : null;
  };
  const result = await fetchPlaceById("malformed-1");
  assert.equal(result.status, "invalid");
});

await asyncTest("fetchPlaceById returns the correct single place, never a fallback", async function () {
  const target = basePlace({ __id: "target-place", name: "The Actual Requested Place" });
  globalThis.__STUB_DOC_BY_ID__ = function (id) {
    return id === "target-place" ? { id: target.id, data: target.data } : null;
  };
  const result = await fetchPlaceById("target-place");
  assert.equal(result.status, "ok");
  assert.equal(result.place.id, "target-place");
  assert.equal(result.place.name, "The Actual Requested Place");
});

/* ==========================================================================
   Phase 6 Community Features Tests
   ========================================================================== */

await asyncTest("submitCommunityPlace rejects unauthenticated user", async function () {
  const result = await submitCommunityPlace({ name: "Test Place" }, null);
  assert.equal(result.status, "unauthenticated");
});

await asyncTest("submitCommunityPlace enforces pending, unverified, and community source", async function () {
  globalThis.__STUB_WRITES__ = [];
  const submission = {
    name: "Shiv Bhojanalaya",
    placeType: "mess",
    address: "Station Road, Shegaon",
    dietTags: ["vegan", "vegetarian"],
    latitude: 20.7936,
    longitude: 76.6946
  };
  const user = { uid: "user-123", email: "user@ssgmce.ac.in", displayName: "Student A" };
  const res = await submitCommunityPlace(submission, user);
  assert.equal(res.status, "ok");
  assert.ok(res.id);

  const lastWrite = globalThis.__STUB_WRITES__[globalThis.__STUB_WRITES__.length - 1];
  assert.equal(lastWrite.collection, "places");
  assert.equal(lastWrite.data.name, "Shiv Bhojanalaya");
  assert.equal(lastWrite.data.status, "pending");
  assert.equal(lastWrite.data.verificationStatus, "unverified");
  assert.equal(lastWrite.data.source, "community");
  assert.equal(lastWrite.data.submittedBy, "user-123");
  assert.equal(lastWrite.data.latitude, 20.7936);
  assert.equal(lastWrite.data.longitude, 76.6946);
});

await asyncTest("submitCommunityPlace stores imageUrl when provided", async function () {
  globalThis.__STUB_WRITES__ = [];
  const submission = {
    name: "Cafe Plantasia",
    placeType: "cafe",
    address: "MG Road, Pune",
    area: "Camp",
    latitude: 18.5204,
    longitude: 73.8567,
    dietTags: ["vegan"],
    imageUrl: "https://res.cloudinary.com/vegansaathi/image/upload/v123/p1_sample.jpg"
  };
  const user = { uid: "user-photo-1", displayName: "Tester" };
  const res = await submitCommunityPlace(submission, user);
  assert.equal(res.status, "ok");

  const lastWrite = globalThis.__STUB_WRITES__[globalThis.__STUB_WRITES__.length - 1];
  assert.equal(lastWrite.data.imageUrl, "https://res.cloudinary.com/vegansaathi/image/upload/v123/p1_sample.jpg");
});

await asyncTest("submitCommunityPlace rejects unsafe or non-Cloudinary imageUrl", async function () {
  const user = { uid: "user-photo-1" };
  const res1 = await submitCommunityPlace({
    name: "Unsafe Place",
    placeType: "cafe",
    address: "MG Road, Pune",
    latitude: 18.5204,
    longitude: 73.8567,
    dietTags: ["vegan"],
    imageUrl: "javascript:alert(1)"
  }, user);
  assert.equal(res1.status, "validation-error");

  const res2 = await submitCommunityPlace({
    name: "Non Cloudinary Place",
    placeType: "cafe",
    address: "MG Road, Pune",
    latitude: 18.5204,
    longitude: 73.8567,
    dietTags: ["vegan"],
    imageUrl: "https://evil.com/fake.jpg"
  }, user);
  assert.equal(res2.status, "validation-error");
});

await asyncTest("submitCommunityPlace rejects missing coordinates", async function () {
  const user = { uid: "user-123" };
  const res = await submitCommunityPlace({
    name: "Testing Place",
    placeType: "cafe",
    address: "Main Road",
    dietTags: ["vegan"]
  }, user);
  assert.equal(res.status, "validation-error");
});

await asyncTest("submitCommunityPlace rejects non-numeric coordinates", async function () {
  const user = { uid: "user-123" };
  const res = await submitCommunityPlace({
    name: "Testing Place",
    placeType: "cafe",
    address: "Main Road",
    dietTags: ["vegan"],
    latitude: "not-a-number",
    longitude: 76.6946
  }, user);
  assert.equal(res.status, "validation-error");
});

await asyncTest("submitCommunityPlace rejects out-of-bounds or swapped coordinates", async function () {
  const user = { uid: "user-123" };
  // lat 200 is genuinely out of global range (> 90)
  const res1 = await submitCommunityPlace({
    name: "Testing Place",
    placeType: "cafe",
    address: "Main Road",
    dietTags: ["vegan"],
    latitude: 200,
    longitude: 20.7936
  }, user);
  assert.equal(res1.status, "validation-error");

  // lon -200 is genuinely out of global range (< -180)
  const res2 = await submitCommunityPlace({
    name: "Testing Place",
    placeType: "cafe",
    address: "Main Road",
    dietTags: ["vegan"],
    latitude: 19.0760,
    longitude: -200
  }, user);
  assert.equal(res2.status, "validation-error");

  // Mumbai coords are valid globally and must be accepted now
  globalThis.__STUB_WRITES__ = [];
  const res3 = await submitCommunityPlace({
    name: "Mumbai Test Place",
    placeType: "cafe",
    address: "Marine Lines, Mumbai",
    dietTags: ["vegan"],
    latitude: 19.0760,
    longitude: 72.8777
  }, user);
  assert.equal(res3.status, "ok", "Mumbai coordinates are globally valid and must be accepted");
});

await asyncTest("submitReview rejects non-integer or out-of-range rating", async function () {
  const user = { uid: "user-123" };
  const res1 = await submitReview({ placeId: "p1", rating: 6, comment: "Great food", user: user });
  assert.equal(res1.status, "validation-error");

  const res2 = await submitReview({ placeId: "p1", rating: 0, comment: "Bad food", user: user });
  assert.equal(res2.status, "validation-error");
});

await asyncTest("submitReview writes review document successfully", async function () {
  globalThis.__STUB_WRITES__ = [];
  const user = { uid: "user-456", displayName: "Ananya" };
  const res = await submitReview({ placeId: "p1", rating: 5, comment: "Authentic vegan poha!", user: user });
  assert.equal(res.status, "ok");

  const lastWrite = globalThis.__STUB_WRITES__[globalThis.__STUB_WRITES__.length - 1];
  assert.equal(lastWrite.collection, "reviews");
  assert.equal(lastWrite.data.placeId, "p1");
  assert.equal(lastWrite.data.userId, "user-456");
  assert.equal(lastWrite.data.authorName, "Ananya");
  assert.equal(lastWrite.data.rating, 5);
});

await asyncTest("fetchReviewsForPlace returns sorted reviews", async function () {
  globalThis.__STUB_DOCS__ = [
    { id: "r1", data: { placeId: "p1", rating: 4, comment: "Good", createdAt: stubTimestamp("2026-01-01T00:00:00Z") } },
    { id: "r2", data: { placeId: "p1", rating: 5, comment: "Newest", createdAt: stubTimestamp("2026-02-01T00:00:00Z") } }
  ];
  const res = await fetchReviewsForPlace("p1");
  assert.equal(res.status, "ok");
  assert.equal(res.reviews.length, 2);
  assert.equal(res.reviews[0].id, "r2"); // newest first
});

await asyncTest("deleteReview calls deleteDoc", async function () {
  globalThis.__STUB_DELETES__ = [];
  const res = await deleteReview("r1");
  assert.equal(res.status, "ok");
  assert.equal(globalThis.__STUB_DELETES__[0], "reviews/r1");
});

await asyncTest("submitReport rejects invalid reason and saves valid report", async function () {
  const user = { uid: "user-789" };
  const badRes = await submitReport({ placeId: "p1", reason: "not-a-real-reason", user: user });
  assert.equal(badRes.status, "validation-error");

  globalThis.__STUB_WRITES__ = [];
  const goodRes = await submitReport({ placeId: "p1", reason: "place-closed", description: "Shut down", user: user });
  assert.equal(goodRes.status, "ok");

  const lastWrite = globalThis.__STUB_WRITES__[globalThis.__STUB_WRITES__.length - 1];
  assert.equal(lastWrite.collection, "reports");
  assert.equal(lastWrite.data.reason, "place-closed");
  assert.equal(lastWrite.data.status, "pending");
  assert.equal(lastWrite.data.reporterId, "user-789");
});

await asyncTest("savePlace, isPlaceSaved, and unsavePlace work correctly", async function () {
  globalThis.__STUB_WRITES__ = [];
  globalThis.__STUB_DELETES__ = [];

  const saveRes = await savePlace("p1", "u1");
  assert.equal(saveRes.status, "ok");
  assert.equal(globalThis.__STUB_WRITES__[0].path, "savedPlaces/u1_p1");

  globalThis.__STUB_DOC_BY_ID__ = function (id) {
    return id === "u1_p1" ? { id: "u1_p1", data: { userId: "u1", placeId: "p1" } } : null;
  };
  const isSaved = await isPlaceSaved("p1", "u1");
  assert.equal(isSaved, true);

  const unsaveRes = await unsavePlace("p1", "u1");
  assert.equal(unsaveRes.status, "ok");
  assert.equal(globalThis.__STUB_DELETES__[0], "savedPlaces/u1_p1");
});

await asyncTest("fetchUserSubmissions returns user's submissions", async function () {
  globalThis.__STUB_DOCS__ = [
    { id: "sub-1", data: { name: "User Mess", status: "pending", verificationStatus: "unverified", createdAt: stubTimestamp("2026-03-01T00:00:00Z") } }
  ];
  const res = await fetchUserSubmissions("u1");
  assert.equal(res.status, "ok");
  assert.equal(res.submissions.length, 1);
  assert.equal(res.submissions[0].name, "User Mess");
});

await asyncTest("fetchUserReviews returns user's reviews", async function () {
  globalThis.__STUB_DOCS__ = [
    { id: "rev-1", data: { placeId: "p1", rating: 5, comment: "Loved it!", createdAt: stubTimestamp("2026-03-02T00:00:00Z") } }
  ];
  const res = await fetchUserReviews("u1");
  assert.equal(res.status, "ok");
  assert.equal(res.reviews.length, 1);
  assert.equal(res.reviews[0].comment, "Loved it!");
});

/* ==========================================================================
   Summary
   ========================================================================== */

await asyncTest("submitCommunityPlace never publishes an email as submittedByName", async function () {
  globalThis.__STUB_WRITES__ = [];
  const submission = {
    name: "Privacy Check Place", placeType: "mess", address: "Station Road, Shegaon",
    dietTags: ["vegan"], latitude: 20.7936, longitude: 76.6946
  };
  const noName = { uid: "user-nn", email: "private.student@ssgmce.ac.in", displayName: null };
  const res = await submitCommunityPlace(submission, noName);
  assert.equal(res.status, "ok");
  const lastWrite = globalThis.__STUB_WRITES__[globalThis.__STUB_WRITES__.length - 1];
  assert.equal(lastWrite.data.submittedByName, "Community member");
  assert.ok(!String(lastWrite.data.submittedByName).includes("@"), "email leaked into a public field");
});

await asyncTest("submitReview never publishes an email as authorName", async function () {
  globalThis.__STUB_WRITES__ = [];
  const user = { uid: "user-rv", email: "private.reviewer@ssgmce.ac.in", displayName: null };
  const res = await submitReview({ placeId: "p1", rating: 4, comment: "Good thali", user: user });
  assert.equal(res.status, "ok");
  const lastWrite = globalThis.__STUB_WRITES__[globalThis.__STUB_WRITES__.length - 1];
  assert.equal(lastWrite.data.authorName, "Community member");
  assert.ok(!String(lastWrite.data.authorName).includes("@"), "email leaked into a public field");
});


await asyncTest("submitReview accepts a 500-character comment and refuses 501 with no write", async function () {
  globalThis.__STUB_WRITES__ = [];
  const user = { uid: "user-len", displayName: "Length Tester" };
  const ok = await submitReview({ placeId: "p1", rating: 4, comment: "a".repeat(500), user: user });
  assert.equal(ok.status, "ok");
  const writesBefore = globalThis.__STUB_WRITES__.length;
  const tooLong = await submitReview({ placeId: "p1", rating: 4, comment: "a".repeat(501), user: user });
  assert.equal(tooLong.status, "validation-error");
  assert.equal(globalThis.__STUB_WRITES__.length, writesBefore, "an over-long review must not be written");
});

await asyncTest("submitReport accepts a 500-character description and refuses 501 with no write", async function () {
  globalThis.__STUB_WRITES__ = [];
  const user = { uid: "user-rep" };
  const ok = await submitReport({ placeId: "p1", reason: "outdated", description: "b".repeat(500), user: user });
  assert.equal(ok.status, "ok");
  const writesBefore = globalThis.__STUB_WRITES__.length;
  const tooLong = await submitReport({ placeId: "p1", reason: "outdated", description: "b".repeat(501), user: user });
  assert.equal(tooLong.status, "validation-error");
  assert.equal(globalThis.__STUB_WRITES__.length, writesBefore, "an over-long report must not be written");
});

test("synthetic safeguard: normalizePlace rejects synthetic fixture documents", function () {
  const fixture1 = basePlace({ is_synthetic_fixture: true });
  assert.equal(normalizePlace(fixture1), null, "is_synthetic_fixture must be rejected");

  const fixture2 = basePlace({ dataset_origin: "synthetic_test_fixture" });
  assert.equal(normalizePlace(fixture2), null, "dataset_origin synthetic must be rejected");

  const fixture3 = basePlace({ name: "[TEST FIXTURE] Mock Mess" });
  assert.equal(normalizePlace(fixture3), null, "name with [TEST FIXTURE] prefix must be rejected");
});

await asyncTest("synthetic safeguard: submitCommunityPlace rejects synthetic test fixture submissions", async function () {
  globalThis.__STUB_WRITES__ = [];
  const user = { uid: "user-synth", displayName: "Tester" };
  const synthSub = {
    name: "[TEST FIXTURE] Fake Cafe",
    placeType: "cafe",
    address: "123 Test Road",
    dietTags: ["vegan"],
    latitude: 18.52,
    longitude: 73.85,
    is_synthetic_fixture: true
  };
  const res = await submitCommunityPlace(synthSub, user);
  assert.equal(res.status, "validation-error");
  assert.equal(globalThis.__STUB_WRITES__.length, 0, "synthetic fixture must not be written to database");
});

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed > 0 ? 1 : 0);
