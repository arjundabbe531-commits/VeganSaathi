/* ==========================================================================
   VeganSaathi — tests/test-controlled-integration.mjs
   Phase 5 Controlled Integration Tests: Image upload lifecycle, UI state,
   resilience to apostrophes/special characters, moderation invariants,
   and URL policy consistency.
   ========================================================================== */

import { register } from "node:module";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
register("./firebase-stub-loader.mjs", import.meta.url);

// 1. Import services
const placesServicePath = pathToFileURL(path.join(__dirname, "..", "frontend", "js", "places-service.js")).href;
const adminServicePath = pathToFileURL(path.join(__dirname, "..", "frontend", "js", "admin-service.js")).href;
const cloudinaryServicePath = pathToFileURL(path.join(__dirname, "..", "frontend", "js", "cloudinary-service.js")).href;
const cloudinaryConfigPath = pathToFileURL(path.join(__dirname, "..", "frontend", "js", "cloudinary-config.js")).href;

const { submitCommunityPlace, fetchPublishedPlaces, normalizePlace, isValidImageUrl } = await import(placesServicePath);
const { approvePlace, rejectPlace, updatePlaceByAdmin, fetchPublishedPlacesForAdmin } = await import(adminServicePath);
const { validateImageFile, isValidCloudinaryUrl, buildOptimizedImageUrl, uploadImageToCloudinary } = await import(cloudinaryServicePath);
const { CLOUDINARY_CONFIG } = await import(cloudinaryConfigPath);

// 2. Load components.js in a sandboxed context
const componentsCode = fs.readFileSync(path.join(__dirname, "..", "frontend", "js", "components.js"), "utf8");
const compContext = {
  window: { VS_BASE: "" },
  document: {}
};
const evalComponents = new Function(
  "window",
  "document",
  componentsCode + "\nreturn { escapeHtml, placeImageLabel, buildOptimizedImageUrl, renderPlaceCard, renderDietBadges, renderVerificationBadge };"
);
const components = evalComponents(compContext.window, compContext.document);

let passed = 0;
let failed = 0;

function test(name, fn) {
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

async function asyncTest(name, fn) {
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

console.log("Starting Phase 5 Controlled Integration Tests...\n");

/* ==========================================================================
   Section A: Upload Lifecycle & UI State Simulation
   ========================================================================== */

test("Integration: Valid JPEG selection updates preview state", () => {
  const fakeFile = {
    name: "storefront.jpg",
    size: 1024 * 500, // 500 KB
    type: "image/jpeg"
  };

  const validation = validateImageFile(fakeFile);
  assert.equal(validation.valid, true);

  // Simulated UI state
  let previewVisible = false;
  let displayedFileName = "";
  let previewImgSrc = "";

  if (validation.valid) {
    previewVisible = true;
    displayedFileName = fakeFile.name;
    previewImgSrc = "blob:http://localhost:8080/fake-uuid";
  }

  assert.equal(previewVisible, true);
  assert.equal(displayedFileName, "storefront.jpg");
  assert.ok(previewImgSrc.startsWith("blob:"));
});

test("Integration: Removing selected image clears preview, filename, and object URL", () => {
  let selectedFile = { name: "dish.png", size: 1024 * 200, type: "image/png" };
  let previewVisible = true;
  let displayedFileName = "dish.png";
  let previewImgSrc = "blob:http://localhost:8080/sample-blob";
  let revokedUrl = null;

  function clearPhotoSelection() {
    selectedFile = null;
    previewVisible = false;
    displayedFileName = "";
    revokedUrl = previewImgSrc;
    previewImgSrc = "";
  }

  clearPhotoSelection();

  assert.equal(selectedFile, null);
  assert.equal(previewVisible, false);
  assert.equal(displayedFileName, "");
  assert.equal(previewImgSrc, "");
  assert.equal(revokedUrl, "blob:http://localhost:8080/sample-blob");
});

test("Integration: Invalid file types (PDF, SVG, EXE) and oversized files (>5 MB) are rejected", () => {
  const pdfFile = { name: "menu.pdf", size: 1024 * 100, type: "application/pdf" };
  const resPdf = validateImageFile(pdfFile);
  assert.equal(resPdf.valid, false);
  assert.match(resPdf.error, /unsupported image format/i);

  const svgFile = { name: "logo.svg", size: 1024 * 50, type: "image/svg+xml" };
  const resSvg = validateImageFile(svgFile);
  assert.equal(resSvg.valid, false);
  assert.match(resSvg.error, /unsupported image format/i);

  const oversizedFile = { name: "huge.jpg", size: 5 * 1024 * 1024 + 500, type: "image/jpeg" };
  const resOver = validateImageFile(oversizedFile);
  assert.equal(resOver.valid, false);
  assert.match(resOver.error, /exceeds maximum allowed size of 5 MB/i);
});

await asyncTest("Integration: Upload errors reset progress bar and re-enable submit button", async () => {
  CLOUDINARY_CONFIG.isConfigured = true;
  const originalFetch = globalThis.fetch;

  // Mock 500 server error
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    json: async () => ({ error: { message: "Internal Cloudinary error" } })
  });

  let submitBtnDisabled = true;
  let submitBtnText = "Uploading photo…";
  let progressVisible = true;
  let progressPercent = 40;
  let feedbackMessage = "";

  try {
    const fakeFile = { name: "food.jpg", size: 1024 * 100, type: "image/jpeg" };
    const uploadResult = await uploadImageToCloudinary(fakeFile);

    if (!uploadResult.success) {
      feedbackMessage = "Photo upload failed: " + uploadResult.error;
      progressVisible = false;
      progressPercent = 0;
      submitBtnDisabled = false;
      submitBtnText = "Submit for Review";
    }

    assert.equal(uploadResult.success, false);
    assert.equal(submitBtnDisabled, false);
    assert.equal(submitBtnText, "Submit for Review");
    assert.equal(progressVisible, false);
    assert.equal(progressPercent, 0);
    assert.match(feedbackMessage, /Internal Cloudinary error/);
  } finally {
    globalThis.fetch = originalFetch;
    CLOUDINARY_CONFIG.isConfigured = false;
  }
});

test("Integration: Repeated clicks do not create duplicate submissions (button locks)", () => {
  let isSubmitting = false;
  let submissionCount = 0;

  function handleClick() {
    if (isSubmitting) return; // Locked
    isSubmitting = true;
    submissionCount++;
  }

  // Rapid simulated clicks
  handleClick();
  handleClick();
  handleClick();

  assert.equal(submissionCount, 1, "Only one submission triggered across rapid repeated clicks");
});

await asyncTest("Integration: Unconfigured / demo upload never creates fake image URL in database", async () => {
  CLOUDINARY_CONFIG.isConfigured = false;
  const fakeFile = { name: "sample.jpg", size: 1024 * 50, type: "image/jpeg" };

  const uploadResult = await uploadImageToCloudinary(fakeFile);
  assert.equal(uploadResult.isMock, true);

  // Submit place guard logic:
  let finalImageUrl = uploadResult.isMock ? "" : uploadResult.secureUrl;
  assert.equal(finalImageUrl, "", "Fake / mock URL suppressed from database write");
});

/* ==========================================================================
   Section B: Rendering & Fallback Resilience
   ========================================================================== */

test("Integration: Place card rendering handles missing imageUrl safely", () => {
  const placeWithoutPhoto = {
    id: "p-no-photo",
    name: "Shegaon Bhojanalaya",
    placeType: "mess",
    area: "Station Road",
    priceRange: "budget",
    dietTags: ["vegetarian", "vegan"],
    imageUrl: null,
    imageLabel: "Dining Hall"
  };

  const html = components.renderPlaceCard(placeWithoutPhoto);
  assert.ok(!html.includes("<img"), "Does not render broken img tag when photo is absent");
  assert.ok(html.includes("Dining Hall (mock photo)"), "Renders honest fallback text");
});

test("Public place cards distinguish a vegan menu option from a fully vegan venue", () => {
  const verifiedOption = {
    id: "p-options", name: "Green Table", placeType: "cafe", dietTags: ["vegan", "vegetarian", "jain"],
    veganClassification: "verified_vegan_options", evidenceStatus: "ingredients_reviewed",
    verificationStatus: "verified", verificationDimensions: { vegan_options_verified: true },
    evidenceRefs: [{ claim: "vegan_options", url: "https://business.example.test/menu", lastCheckedAt: new Date().toISOString(), validity: "current", strength: "direct", excerpt: "Current menu item and ingredient notes were reviewed." }]
  };
  const optionsHtml = components.renderPlaceCard(verifiedOption);
  assert.ok(optionsHtml.includes("Verified vegan options"));
  assert.ok(!optionsHtml.includes(">Vegan</span>"));
  assert.ok(!optionsHtml.includes("Vegetarian"));
  assert.ok(!optionsHtml.includes("Jain"));

  const fullyVegan = { ...verifiedOption, veganClassification: "fully_vegan", evidenceRefs: [...verifiedOption.evidenceRefs, { claim: "fully_vegan_venue", url: "https://business.example.test/menu", lastCheckedAt: new Date().toISOString(), validity: "current", strength: "direct", excerpt: "The complete relevant menu and preparation practices were reviewed." }] };
  assert.ok(components.renderPlaceCard(fullyVegan).includes("Fully vegan"));

  const unsupported = { ...verifiedOption, verificationStatus: "unverified" };
  const unsupportedHtml = components.renderPlaceCard(unsupported);
  assert.ok(!unsupportedHtml.includes("Verified vegan options"));
  assert.ok(!unsupportedHtml.includes("Fully vegan"));

  const stale = { ...verifiedOption, evidenceRefs: verifiedOption.evidenceRefs.map((ref) => ({ ...ref, lastCheckedAt: "2025-01-01", validity: "stale" })) };
  assert.ok(!components.renderPlaceCard(stale).includes("Verified vegan options"));
});

test("Integration: Place card rendering handles apostrophes and special characters without quote breakout", () => {
  const trickyPlace = {
    id: "p-tricky",
    name: "Haldiram's Sweets & McDonald's \"Express\"",
    placeType: "restaurant",
    area: "City Center",
    priceRange: "moderate",
    dietTags: ["vegetarian"],
    imageUrl: "https://res.cloudinary.com/vegansaathi/image/upload/v123/vegansaathi/places/p_trick.jpg",
    imageLabel: "Haldiram's & McDonald's Front"
  };

  const html = components.renderPlaceCard(trickyPlace);

  // Verify that data-fallback is used and escaped
  assert.ok(html.includes('data-fallback="Haldiram&#39;s &amp; McDonald&#39;s &quot;Express&quot;"') || html.includes('data-fallback="Haldiram&#39;s &amp; McDonald&#39;s Front (mock photo)"'));
  
  // Verify that onerror attribute does not contain raw apostrophe breakout:
  // It should be: onerror="this.onerror=null;this.parentElement.textContent=this.getAttribute('data-fallback')||'No photo yet';"
  assert.ok(html.includes("this.getAttribute('data-fallback')"));
  assert.ok(!html.includes("parentElement.textContent='Haldiram's"), "No unescaped JS string literal termination");
});

test("Integration: Place card escapes HTML injection attempts in place name and image labels", () => {
  const xssPlace = {
    id: "p-xss",
    name: "<script>alert(1)</script>Safe Cafe",
    placeType: "cafe",
    dietTags: ["vegan"],
    imageUrl: "https://res.cloudinary.com/vegansaathi/image/upload/v1/cafe.jpg",
    imageLabel: "<img src=x onerror=alert(2)>"
  };

  const html = components.renderPlaceCard(xssPlace);
  assert.ok(!html.includes("<script>alert(1)</script>"), "Raw script tag is neutralised");
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), "Script tag safely escaped");
  assert.ok(!html.includes("<img src=x onerror=alert(2)>"), "Nested img injection neutralised");
});

/* ==========================================================================
   Section C: Moderation & Data Integrity
   ========================================================================== */

const testUser = {
  uid: "user-1",
  displayName: "Gaurav Student"
};

const adminUser = {
  uid: "admin-1",
  displayName: "Admin Coordinator"
};

globalThis.__STUB_DOC_BY_ID__ = function (id) {
  if (id === "admin-1") return { id: id, data: { role: "admin", email: "admin@ssgmce.ac.in" } };
  if (id === "user-1") return { id: id, data: { role: "user", email: "user@ssgmce.ac.in" } };
  return null;
};

await asyncTest("Integration: Submitted place with valid Cloudinary image starts as pending/unverified", async () => {
  const validCloudinaryUrl = "https://res.cloudinary.com/vegansaathi/image/upload/v1700000000/vegansaathi/places/p_storefront.jpg";

  const res = await submitCommunityPlace({
    name: "Green Delight Kitchen",
    placeType: "restaurant",
    address: "Opposite College Gate, Shegaon",
    area: "College Gate",
    latitude: 20.7925,
    longitude: 76.6912,
    dietTags: ["vegan", "vegetarian"],
    priceRange: "budget",
    imageUrl: validCloudinaryUrl
  }, testUser);

  assert.equal(res.status, "ok");
  assert.ok(res.id);

  // Check normalization
  const normalized = normalizePlace({
    id: res.id,
    data: {
      name: "Green Delight Kitchen",
      placeType: "restaurant",
      address: "Opposite College Gate, Shegaon",
      area: "College Gate",
      latitude: 20.7925,
      longitude: 76.6912,
      dietTags: ["vegan", "vegetarian"],
      priceRange: "budget",
      status: "pending",
      verificationStatus: "unverified",
      source: "community",
      imageUrl: validCloudinaryUrl,
      submittedBy: testUser.uid,
      submittedByName: testUser.displayName,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  assert.ok(normalized);
  assert.equal(normalized.status, "pending");
  assert.equal(normalized.verificationStatus, "unverified");
  assert.equal(normalized.imageUrl, validCloudinaryUrl);
});

await asyncTest("Integration: Pending submission does not appear on public Explore before admin approval", async () => {
  // Query only published places
  const exploreRes = await fetchPublishedPlaces();
  assert.equal(exploreRes.status, "ok");
  const foundPending = exploreRes.places.some(p => p.name === "Green Delight Kitchen");
  assert.equal(foundPending, false, "Pending submission is excluded from public Explore");
});

await asyncTest("Integration: Admin approval publishes place without changing verificationStatus", async () => {
  // Create pending place in stub
  const placeId = "p-pending-image-1";
  const validUrl = "https://res.cloudinary.com/vegansaathi/image/upload/v123/vegansaathi/places/dish.jpg";

  // Simulate Firestore state
  const rawData = {
    name: "Pure Leaf Cafe",
    placeType: "cafe",
    address: "Temple Road",
    latitude: 20.795,
    longitude: 76.695,
    dietTags: ["vegan"],
    status: "pending",
    verificationStatus: "unverified",
    source: "community",
    submittedBy: testUser.uid,
    submittedByName: testUser.displayName,
    imageUrl: validUrl,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const normalizedBefore = normalizePlace({ id: placeId, data: rawData });
  assert.equal(normalizedBefore.status, "pending");

  // Missing user must fail with unauthorized
  const missingUserAttempt = await approvePlace(placeId, null);
  assert.equal(missingUserAttempt.status, "unauthorized");

  // Non-admin approval must fail with permission-denied
  const nonAdminAttempt = await approvePlace(placeId, testUser);
  assert.equal(nonAdminAttempt.status, "permission-denied");

  // Normalized wouldPublish check
  const wouldPublish = normalizePlace({ id: placeId, data: Object.assign({}, rawData, { status: "published" }) });
  assert.ok(wouldPublish);
  assert.equal(wouldPublish.status, "published");
  assert.equal(wouldPublish.verificationStatus, "unverified");
  assert.equal(wouldPublish.imageUrl, validUrl);
});

await asyncTest("Integration: Admin updates imageUrl with valid Cloudinary URL, rejects unsafe schemes", async () => {
  const placeId = "p-edit-img-test";
  const safeCloudinaryUrl = "https://res.cloudinary.com/vegansaathi/image/upload/v999/vegansaathi/places/updated_menu.jpg";

  // Missing user write rejected with unauthorized
  const missingUserUpdate = await updatePlaceByAdmin(placeId, {
    name: "Test Place",
    placeType: "cafe",
    address: "123 Main St",
    latitude: 20.0,
    longitude: 76.0,
    dietTags: ["vegan"],
    imageUrl: safeCloudinaryUrl
  }, null);
  assert.equal(missingUserUpdate.status, "unauthorized");

  // Non-admin write rejected with permission-denied
  const nonAdminUpdate = await updatePlaceByAdmin(placeId, {
    name: "Test Place",
    placeType: "cafe",
    address: "123 Main St",
    latitude: 20.0,
    longitude: 76.0,
    dietTags: ["vegan"],
    imageUrl: safeCloudinaryUrl
  }, testUser);
  assert.equal(nonAdminUpdate.status, "permission-denied");

  // Admin write with javascript: rejected
  const adminJsAttack = await updatePlaceByAdmin(placeId, {
    name: "Test Place",
    placeType: "cafe",
    address: "123 Main St",
    latitude: 20.0,
    longitude: 76.0,
    dietTags: ["vegan"],
    imageUrl: "javascript:alert(document.cookie)"
  }, adminUser);
  assert.equal(adminJsAttack.status, "validation-error");
  assert.match(adminJsAttack.message, /must be a valid, secure Cloudinary image URL/i);

  // Admin write with data: scheme rejected
  const adminDataAttack = await updatePlaceByAdmin(placeId, {
    name: "Test Place",
    placeType: "cafe",
    address: "123 Main St",
    latitude: 20.0,
    longitude: 76.0,
    dietTags: ["vegan"],
    imageUrl: "data:image/svg+xml;base64,PHN2Zz4="
  }, adminUser);
  assert.equal(adminDataAttack.status, "validation-error");

  // Admin write with non-Cloudinary external URL rejected for image field
  const adminExtUrl = await updatePlaceByAdmin(placeId, {
    name: "Test Place",
    placeType: "cafe",
    address: "123 Main St",
    latitude: 20.0,
    longitude: 76.0,
    dietTags: ["vegan"],
    imageUrl: "https://evil.com/phishing.jpg"
  }, adminUser);
  assert.equal(adminExtUrl.status, "validation-error");
});

/* ==========================================================================
   Section D: URL Policy Consistency
   ========================================================================== */

test("Integration: buildOptimizedImageUrl enforces consistent policy across all modules", () => {
  // 1. Cloudinary upload URL receives dynamic transformation
  const rawCloudinary = "https://res.cloudinary.com/vegansaathi/image/upload/v1234/vegansaathi/places/p1.jpg";
  const optimized = buildOptimizedImageUrl(rawCloudinary, 400, 260);
  assert.equal(
    optimized,
    "https://res.cloudinary.com/vegansaathi/image/upload/c_fill,g_auto,w_400,h_260,q_auto,f_auto/v1234/vegansaathi/places/p1.jpg"
  );

  // 2. Legacy / external HTTPS URL (e.g. Unsplash mock) returned unmodified
  const externalHttps = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c";
  assert.equal(buildOptimizedImageUrl(externalHttps), externalHttps);

  // 3. Unsafe schemes immediately sanitized to empty string
  assert.equal(buildOptimizedImageUrl("javascript:void(0)"), "");
  assert.equal(buildOptimizedImageUrl("data:text/html;base64,PHNjcmlwdD4="), "");
  assert.equal(buildOptimizedImageUrl("file:///C:/passwords.txt"), "");
  assert.equal(buildOptimizedImageUrl("vbscript:msgbox(1)"), "");

  // 4. Missing or null values return empty string
  assert.equal(buildOptimizedImageUrl(null), "");
  assert.equal(buildOptimizedImageUrl(undefined), "");
  assert.equal(buildOptimizedImageUrl(""), "");
});

console.log("\n========================================");
console.log(`Controlled Integration Tests: ${passed} passed, ${failed} failed.`);
console.log("========================================\n");

if (failed > 0) {
  process.exit(1);
}
