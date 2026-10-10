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
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
register("./firebase-stub-loader.mjs", import.meta.url);

const { normalizePlace, fetchPublishedPlaces, fetchPlaceById } = await import(
  path.join(__dirname, "..", "frontend", "js", "places-service.js")
);

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

test("8c. swapped/out-of-pilot-box coordinates are rejected", function () {
  // Shegaon's real lat/lon swapped -> latitude becomes ~76, far outside the
  // pilot box (20.70-20.90), which is exactly the swap this check exists to catch.
  const raw = basePlace({ latitude: 76.6977, longitude: 20.7935 });
  assert.equal(normalizePlace(raw), null);
});

test("8d. coordinates from a totally different city are rejected", function () {
  const raw = basePlace({ latitude: 19.0760, longitude: 72.8777 }); // Mumbai
  assert.equal(normalizePlace(raw), null);
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
   Summary
   ========================================================================== */
console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed > 0 ? 1 : 0);
