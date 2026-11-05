/* ==========================================================================
   VeganSaathi — tests/test-cloudinary-service.mjs
   Unit tests for Cloudinary service layer: validation, URL optimization,
   mock/offline pathway, progress tracking, and error handling.
   ========================================================================== */

import assert from "node:assert/strict";
import {
  validateImageFile,
  buildOptimizedImageUrl,
  isValidCloudinaryUrl,
  uploadImageToCloudinary,
  validateDirectImageUrl,
  uploadRemoteImageToCloudinary
} from "../frontend/js/cloudinary-service.js";
import { CLOUDINARY_CONFIG } from "../frontend/js/cloudinary-config.js";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`PASS - ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL - ${name}`);
    console.error(err);
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`PASS - ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL - ${name}`);
    console.error(err);
  }
}

console.log("Starting Cloudinary Service tests...\n");

/* ---------------- 1. validateImageFile ---------------- */

test("validateImageFile: rejects missing or null file", () => {
  assert.equal(validateImageFile(null).valid, false);
  assert.equal(validateImageFile(undefined).valid, false);
});

test("validateImageFile: rejects empty zero-byte file", () => {
  const emptyFile = { size: 0, type: "image/jpeg", name: "empty.jpg" };
  const res = validateImageFile(emptyFile);
  assert.equal(res.valid, false);
  assert.match(res.error, /empty/i);
});

test("validateImageFile: rejects files exceeding 5 MB limit", () => {
  const overFile = {
    size: 5 * 1024 * 1024 + 1, // 5 MB + 1 byte
    type: "image/jpeg",
    name: "photo.jpg"
  };
  const res = validateImageFile(overFile);
  assert.equal(res.valid, false);
  assert.match(res.error, /exceeds maximum allowed size/i);
});

test("validateImageFile: accepts files at boundary size (5 MB)", () => {
  const boundaryFile = {
    size: 5 * 1024 * 1024,
    type: "image/jpeg",
    name: "boundary.jpg"
  };
  const res = validateImageFile(boundaryFile);
  assert.equal(res.valid, true);
});

test("validateImageFile: accepts valid JPG, PNG, and WebP MIME types", () => {
  assert.equal(validateImageFile({ size: 1024, type: "image/jpeg", name: "food.jpg" }).valid, true);
  assert.equal(validateImageFile({ size: 1024, type: "image/png", name: "food.png" }).valid, true);
  assert.equal(validateImageFile({ size: 1024, type: "image/webp", name: "food.webp" }).valid, true);
});

test("validateImageFile: accepts valid file by extension if MIME is missing", () => {
  assert.equal(validateImageFile({ size: 2048, type: "", name: "storefront.JPG" }).valid, true);
  assert.equal(validateImageFile({ size: 2048, type: "", name: "menu.webp" }).valid, true);
  assert.equal(validateImageFile({ size: 2048, type: "", name: "banner.png" }).valid, true);
});

test("validateImageFile: rejects non-image or dangerous extensions (PDF, SVG, EXE)", () => {
  assert.equal(validateImageFile({ size: 1024, type: "application/pdf", name: "doc.pdf" }).valid, false);
  assert.equal(validateImageFile({ size: 1024, type: "image/svg+xml", name: "logo.svg" }).valid, false);
  assert.equal(validateImageFile({ size: 1024, type: "application/octet-stream", name: "bad.exe" }).valid, false);
});

test("validateImageFile: rejects file when MIME is disallowed even if extension is allowed (MIME spoofing)", () => {
  // SVG with .jpg extension
  const svgSpoof = { size: 1024, type: "image/svg+xml", name: "exploit.jpg" };
  const res1 = validateImageFile(svgSpoof);
  assert.equal(res1.valid, false);
  assert.match(res1.error, /unsupported image format/i);

  // PDF with .png extension
  const pdfSpoof = { size: 1024, type: "application/pdf", name: "invoice.png" };
  const res2 = validateImageFile(pdfSpoof);
  assert.equal(res2.valid, false);
  assert.match(res2.error, /unsupported image format/i);

  // HTML with .webp extension
  const htmlSpoof = { size: 1024, type: "text/html", name: "script.webp" };
  const res3 = validateImageFile(htmlSpoof);
  assert.equal(res3.valid, false);
  assert.match(res3.error, /unsupported image format/i);
});

test("validateImageFile: rejects file when extension is disallowed even if MIME is allowed (extension spoofing)", () => {
  // Executable disguised with image MIME
  const exeSpoof = { size: 1024, type: "image/jpeg", name: "payload.exe" };
  const res1 = validateImageFile(exeSpoof);
  assert.equal(res1.valid, false);
  assert.match(res1.error, /unsupported image format/i);

  // SVG file with image/png MIME
  const svgExtSpoof = { size: 1024, type: "image/png", name: "vector.svg" };
  const res2 = validateImageFile(svgExtSpoof);
  assert.equal(res2.valid, false);
  assert.match(res2.error, /unsupported image format/i);
});

test("validateImageFile: accepts Blob with valid MIME and no filename", () => {
  const blobFile = { size: 2048, type: "image/jpeg", name: "" };
  assert.equal(validateImageFile(blobFile).valid, true);
});

/* ---------------- 2. buildOptimizedImageUrl ---------------- */

test("buildOptimizedImageUrl: returns empty string for missing or non-string URLs", () => {
  assert.equal(buildOptimizedImageUrl(""), "");
  assert.equal(buildOptimizedImageUrl(null), "");
  assert.equal(buildOptimizedImageUrl(undefined), "");
  assert.equal(buildOptimizedImageUrl(12345), "");
});

test("buildOptimizedImageUrl: leaves non-Cloudinary URLs unmodified", () => {
  const external = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c";
  assert.equal(buildOptimizedImageUrl(external), external);
});

test("buildOptimizedImageUrl: injects default 800x450 transformations into Cloudinary URL", () => {
  const raw = "https://res.cloudinary.com/vegansaathi/image/upload/v12345/vegansaathi/places/p1_sample.jpg";
  const expected = "https://res.cloudinary.com/vegansaathi/image/upload/c_fill,g_auto,w_800,h_450,q_auto,f_auto/v12345/vegansaathi/places/p1_sample.jpg";
  assert.equal(buildOptimizedImageUrl(raw), expected);
});

test("buildOptimizedImageUrl: respects custom dimensions (e.g. 400x260 for thumbnail)", () => {
  const raw = "https://res.cloudinary.com/vegansaathi/image/upload/v12345/vegansaathi/places/p1_thumb.jpg";
  const expected = "https://res.cloudinary.com/vegansaathi/image/upload/c_fill,g_auto,w_400,h_260,q_auto,f_auto/v12345/vegansaathi/places/p1_thumb.jpg";
  assert.equal(buildOptimizedImageUrl(raw, 400, 260), expected);
});

test("buildOptimizedImageUrl: does not double-inject if transformation is already present", () => {
  const alreadyTransformed = "https://res.cloudinary.com/vegansaathi/image/upload/c_fill,g_auto,w_400,h_260,q_auto,f_auto/v12345/sample.jpg";
  assert.equal(buildOptimizedImageUrl(alreadyTransformed, 800, 450), alreadyTransformed);
});

test("buildOptimizedImageUrl: rejects unsafe URL schemes (javascript, data, vbscript)", () => {
  assert.equal(buildOptimizedImageUrl("javascript:alert(1)"), "");
  assert.equal(buildOptimizedImageUrl("data:text/html,<script>alert(1)</script>"), "");
  assert.equal(buildOptimizedImageUrl("vbscript:msgbox(1)"), "");
  assert.equal(buildOptimizedImageUrl("file:///etc/passwd"), "");
});

/* ---------------- 2b. isValidCloudinaryUrl ---------------- */

test("isValidCloudinaryUrl: accepts valid HTTPS Cloudinary URL", () => {
  const valid = "https://res.cloudinary.com/vegansaathi/image/upload/v12345/vegansaathi/places/p1_sample.jpg";
  assert.equal(isValidCloudinaryUrl(valid), true);
});

test("isValidCloudinaryUrl: rejects unsafe or non-Cloudinary schemes and domains", () => {
  assert.equal(isValidCloudinaryUrl("javascript:alert(1)"), false);
  assert.equal(isValidCloudinaryUrl("data:image/png;base64,iVBORw0KGgo="), false);
  assert.equal(isValidCloudinaryUrl("http://res.cloudinary.com/vegansaathi/image/upload/sample.jpg"), false);
  assert.equal(isValidCloudinaryUrl("https://evil.com/res.cloudinary.com/image/upload/sample.jpg"), false);
  assert.equal(isValidCloudinaryUrl(""), false);
  assert.equal(isValidCloudinaryUrl(null), false);
});

/* ---------------- 3. uploadImageToCloudinary ---------------- */

await asyncTest("uploadImageToCloudinary: rejects invalid file before network dispatch", async () => {
  const res = await uploadImageToCloudinary(null);
  assert.equal(res.success, false);
  assert.match(res.error, /please select an image/i);
});

await asyncTest("uploadImageToCloudinary: executes offline/demo pathway when unconfigured", async () => {
  CLOUDINARY_CONFIG.isConfigured = false;
  const progressReports = [];
  const fakeFile = {
    size: 1024 * 50,
    type: "image/jpeg",
    name: "test_dish.jpg"
  };

  const res = await uploadImageToCloudinary(fakeFile, {
    onProgress: (p) => progressReports.push(p)
  });

  assert.equal(res.success, true);
  assert.equal(res.isMock, true);
  assert.ok(typeof res.secureUrl === "string" && res.secureUrl.length > 0);
  assert.deepEqual(progressReports, [30, 75, 100], "progress milestones dispatched");
});

await asyncTest("uploadImageToCloudinary: dispatches to REST API when configured and handles success", async () => {
  CLOUDINARY_CONFIG.isConfigured = true;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, opts) => {
    assert.match(url, /api\.cloudinary\.com/);
    assert.equal(opts.method, "POST");
    return {
      ok: true,
      status: 200,
      json: async () => ({
        secure_url: "https://res.cloudinary.com/vegansaathi/image/upload/v123/vegansaathi/places/real_dish.jpg",
        public_id: "vegansaathi/places/real_dish",
        format: "jpg",
        width: 1200,
        height: 800
      })
    };
  };

  try {
    const fakeFile = {
      size: 1024 * 100,
      type: "image/jpeg",
      name: "real_dish.jpg"
    };
    const res = await uploadImageToCloudinary(fakeFile);
    assert.equal(res.success, true);
    assert.equal(res.isMock, false);
    assert.equal(res.secureUrl, "https://res.cloudinary.com/vegansaathi/image/upload/v123/vegansaathi/places/real_dish.jpg");
    assert.equal(res.publicId, "vegansaathi/places/real_dish");
  } finally {
    globalThis.fetch = originalFetch;
    CLOUDINARY_CONFIG.isConfigured = false;
  }
});

await asyncTest("uploadImageToCloudinary: handles API error response gracefully", async () => {
  CLOUDINARY_CONFIG.isConfigured = true;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: false,
    status: 400,
    json: async () => ({
      error: { message: "Upload preset not found" }
    })
  });

  try {
    const fakeFile = {
      size: 1024 * 100,
      type: "image/jpeg",
      name: "dish.jpg"
    };
    const res = await uploadImageToCloudinary(fakeFile);
    assert.equal(res.success, false);
    assert.equal(res.error, "Upload preset not found");
  } finally {
    globalThis.fetch = originalFetch;
    CLOUDINARY_CONFIG.isConfigured = false;
  }
});

await asyncTest("uploadImageToCloudinary: handles network fetch disconnection", async () => {
  CLOUDINARY_CONFIG.isConfigured = true;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    throw new Error("Failed to fetch (network disconnected)");
  };

  try {
    const fakeFile = {
      size: 1024 * 100,
      type: "image/jpeg",
      name: "dish.jpg"
    };
    const res = await uploadImageToCloudinary(fakeFile);
    assert.equal(res.success, false);
    assert.match(res.error, /network disconnected/i);
  } finally {
    globalThis.fetch = originalFetch;
    CLOUDINARY_CONFIG.isConfigured = false;
  }
});

await asyncTest("uploadImageToCloudinary: rejects API response when secure_url is HTTP or non-Cloudinary", async () => {
  CLOUDINARY_CONFIG.isConfigured = true;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      // Insecure HTTP scheme returned by hostile proxy
      secure_url: "http://res.cloudinary.com/vegansaathi/image/upload/dish.jpg",
      public_id: "vegansaathi/places/dish"
    })
  });

  try {
    const fakeFile = {
      size: 1024 * 100,
      type: "image/jpeg",
      name: "dish.jpg"
    };
    const res = await uploadImageToCloudinary(fakeFile);
    assert.equal(res.success, false);
  } finally {
    globalThis.fetch = originalFetch;
    CLOUDINARY_CONFIG.isConfigured = false;
  }
});

await asyncTest("uploadImageToCloudinary: handles XHR abort cancellation gracefully", async () => {
  CLOUDINARY_CONFIG.isConfigured = true;
  const originalXHR = globalThis.XMLHttpRequest;

  // Mock XMLHttpRequest
  class MockXHR {
    constructor() {
      this.upload = {};
    }
    open() {}
    send() {
      setTimeout(() => {
        if (typeof this.onabort === "function") {
          this.onabort();
        }
      }, 10);
    }
  }

  globalThis.XMLHttpRequest = MockXHR;

  try {
    const fakeFile = {
      size: 1024 * 100,
      type: "image/jpeg",
      name: "dish.jpg"
    };
    const res = await uploadImageToCloudinary(fakeFile, {
      onProgress: () => {}
    });
    assert.equal(res.success, false);
    assert.match(res.error, /cancelled/i);
  } finally {
    globalThis.XMLHttpRequest = originalXHR;
    CLOUDINARY_CONFIG.isConfigured = false;
  }
});

/* ==========================================================================
   Remote Image & URL Ingestion Tests (Priority 1)
   ========================================================================== */

test("validateDirectImageUrl: rejects missing or non-string inputs", () => {
  assert.equal(validateDirectImageUrl("").valid, false);
  assert.equal(validateDirectImageUrl(null).valid, false);
  assert.equal(validateDirectImageUrl(undefined).valid, false);
  assert.equal(validateDirectImageUrl(123).valid, false);
});

test("validateDirectImageUrl: rejects unsafe schemes and non-HTTPS URLs", () => {
  assert.equal(validateDirectImageUrl("javascript:alert(1)").valid, false);
  assert.equal(validateDirectImageUrl("data:image/png;base64,123").valid, false);
  assert.equal(validateDirectImageUrl("file:///C:/secret.png").valid, false);
  assert.equal(validateDirectImageUrl("http://example.com/photo.jpg").valid, false);
});

test("validateDirectImageUrl: rejects web pages, search results, and video links", () => {
  assert.equal(validateDirectImageUrl("https://www.google.com/search?q=vegan+food").valid, false);
  assert.equal(validateDirectImageUrl("https://www.instagram.com/p/abc123/").valid, false);
  assert.equal(validateDirectImageUrl("https://www.youtube.com/watch?v=12345").valid, false);
  assert.equal(validateDirectImageUrl("https://en.wikipedia.org/wiki/Veganism").valid, false);
});

test("validateDirectImageUrl: accepts valid direct HTTPS images and CDNs", () => {
  assert.equal(validateDirectImageUrl("https://example.com/photos/dosa.jpg").valid, true);
  assert.equal(validateDirectImageUrl("https://example.com/photos/curd.png").valid, true);
  assert.equal(validateDirectImageUrl("https://example.com/photos/mithai.webp").valid, true);
  assert.equal(validateDirectImageUrl("https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800").valid, true);
  assert.equal(validateDirectImageUrl("https://res.cloudinary.com/vegansaathi/image/upload/v1/dish.jpg").valid, true);
});

await asyncTest("uploadRemoteImageToCloudinary: rejects invalid remote URL before network request", async () => {
  const res = await uploadRemoteImageToCloudinary("javascript:void(0)");
  assert.equal(res.success, false);
  assert.match(res.error, /unsafe url scheme|invalid/i);
});

await asyncTest("uploadRemoteImageToCloudinary: unconfigured/demo mode returns mock result safely", async () => {
  CLOUDINARY_CONFIG.isConfigured = false;
  const res = await uploadRemoteImageToCloudinary("https://images.unsplash.com/photo-1540420773420-3366772f4999");
  assert.equal(res.success, true);
  assert.equal(res.isMock, true);
});

await asyncTest("uploadRemoteImageToCloudinary: posts valid remote URL when configured", async () => {
  CLOUDINARY_CONFIG.isConfigured = true;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    assert.match(url, /api\.cloudinary\.com/);
    assert.equal(options.method, "POST");
    return {
      ok: true,
      status: 200,
      json: async () => ({
        secure_url: "https://res.cloudinary.com/vegansaathi/image/upload/v999/vegansaathi/places/remote_mirror.jpg",
        public_id: "vegansaathi/places/remote_mirror"
      })
    };
  };

  try {
    const res = await uploadRemoteImageToCloudinary("https://example.com/my-vegan-dish.jpg");
    assert.equal(res.success, true);
    assert.equal(res.isMock, false);
    assert.equal(res.secureUrl, "https://res.cloudinary.com/vegansaathi/image/upload/v999/vegansaathi/places/remote_mirror.jpg");
  } finally {
    globalThis.fetch = originalFetch;
    CLOUDINARY_CONFIG.isConfigured = false;
  }
});

console.log("\n========================================");
console.log(`Cloudinary Tests: ${passed} passed, ${failed} failed.`);
console.log("========================================\n");

if (failed > 0) {
  process.exit(1);
}
