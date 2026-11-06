/* ==========================================================================
   VeganSaathi — tests/test-geolocation.mjs
   ============================================================================
   Unit tests for frontend/js/geolocation.js:
   - Haversine distance calculations
   - Distance formatting
   - Distance-based sorting
   - Geolocation permission / error handling fallbacks

   Run with:
     node tests/test-geolocation.mjs
   ========================================================================== */

import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const geolocationPath = pathToFileURL(
  path.join(__dirname, "..", "frontend", "js", "geolocation.js")
).href;

const {
  haversineKm,
  sortByDistance,
  formatDistance,
  requestUserLocation
} = await import(geolocationPath);

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

async function asyncTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL: ${name}`);
    console.error(err);
  }
}

// 1. haversineKm
test("haversineKm: same coordinates return 0 distance", () => {
  const pt = { lat: 20.7936, lon: 76.6946 };
  const d = haversineKm(pt, pt);
  assert.equal(Math.round(d), 0);
});

test("haversineKm: Shegaon to Mumbai calculates approximately 440-450 km", () => {
  const shegaon = { lat: 20.7936, lon: 76.6946 };
  const mumbai = { lat: 19.0760, lon: 72.8777 };
  const d = haversineKm(shegaon, mumbai);
  assert.ok(d > 430 && d < 460, `Expected distance ~445 km, got ${d}`);
});

test("haversineKm: London to Paris calculates approximately 340-350 km", () => {
  const london = { lat: 51.5074, lon: -0.1278 };
  const paris = { lat: 48.8566, lon: 2.3522 };
  const d = haversineKm(london, paris);
  assert.ok(d > 330 && d < 360, `Expected distance ~343 km, got ${d}`);
});

test("haversineKm: returns null for invalid points (missing, non-finite, null)", () => {
  assert.equal(haversineKm(null, { lat: 20, lon: 76 }), null);
  assert.equal(haversineKm({ lat: 20, lon: 76 }, null), null);
  assert.equal(haversineKm({ lat: NaN, lon: 76 }, { lat: 20, lon: 76 }), null);
  assert.equal(haversineKm({ lat: 20, lon: Infinity }, { lat: 20, lon: 76 }), null);
  assert.equal(haversineKm({ lat: "20", lon: 76 }, { lat: 20, lon: 76 }), null);
});

// 2. formatDistance
test("formatDistance: formats < 10 km with one decimal place", () => {
  assert.equal(formatDistance(0.34), "0.3 km");
  assert.equal(formatDistance(5.67), "5.7 km");
  assert.equal(formatDistance(9.94), "9.9 km");
});

test("formatDistance: formats >= 10 km rounded to nearest integer", () => {
  assert.equal(formatDistance(10.2), "10 km");
  assert.equal(formatDistance(444.6), "445 km");
});

test("formatDistance: returns null for non-finite / null / undefined values", () => {
  assert.equal(formatDistance(null), null);
  assert.equal(formatDistance(undefined), null);
  assert.equal(formatDistance(NaN), null);
  assert.equal(formatDistance(Infinity), null);
});

// 3. sortByDistance
test("sortByDistance: orders places nearest to user first without mutating input", () => {
  const user = { lat: 20.7936, lon: 76.6946 }; // Shegaon
  const places = [
    { id: "delhi", name: "Delhi Place", latitude: 28.6139, longitude: 77.2090 },
    { id: "shegaon-local", name: "Shegaon Place", latitude: 20.7950, longitude: 76.6950 },
    { id: "mumbai", name: "Mumbai Place", latitude: 19.0760, longitude: 72.8777 },
    { id: "no-coords", name: "Unpinned Place", latitude: null, longitude: null }
  ];

  const sorted = sortByDistance(places, user);
  assert.notEqual(sorted, places, "Should return a new copy, not mutate in-place");
  assert.equal(sorted[0].id, "shegaon-local");
  assert.equal(sorted[1].id, "mumbai");
  assert.equal(sorted[2].id, "delhi");
  assert.equal(sorted[3].id, "no-coords", "Places without valid coords go to the end");
});

test("sortByDistance: handles invalid userLocation gracefully", () => {
  const places = [{ id: "p1" }, { id: "p2" }];
  assert.deepEqual(sortByDistance(places, null), places);
  assert.deepEqual(sortByDistance(places, { lat: NaN, lon: 0 }), places);
});

// 4. requestUserLocation
await asyncTest("requestUserLocation: returns 'unsupported' when navigator is undefined", async () => {
  const origNavigator = globalThis.navigator;
  try {
    delete globalThis.navigator;
    const res = await requestUserLocation();
    assert.equal(res.status, "unsupported");
  } finally {
    globalThis.navigator = origNavigator;
  }
});

await asyncTest("requestUserLocation: returns 'ok' with coordinates when granted", async () => {
  const origNavigator = globalThis.navigator;
  try {
    globalThis.navigator = {
      geolocation: {
        getCurrentPosition: (success) => {
          success({ coords: { latitude: 18.5204, longitude: 73.8567 } });
        }
      }
    };
    const res = await requestUserLocation();
    assert.equal(res.status, "ok");
    assert.equal(res.lat, 18.5204);
    assert.equal(res.lon, 73.8567);
  } finally {
    globalThis.navigator = origNavigator;
  }
});

await asyncTest("requestUserLocation: returns 'denied' when permission denied (code 1)", async () => {
  const origNavigator = globalThis.navigator;
  try {
    globalThis.navigator = {
      geolocation: {
        getCurrentPosition: (success, failure) => {
          failure({ code: 1, message: "User denied Geolocation" });
        }
      }
    };
    const res = await requestUserLocation();
    assert.equal(res.status, "denied");
    assert.ok(res.message.includes("denied"));
  } finally {
    globalThis.navigator = origNavigator;
  }
});

await asyncTest("requestUserLocation: returns 'timeout' when timed out (code 3)", async () => {
  const origNavigator = globalThis.navigator;
  try {
    globalThis.navigator = {
      geolocation: {
        getCurrentPosition: (success, failure) => {
          failure({ code: 3, message: "Timeout" });
        }
      }
    };
    const res = await requestUserLocation();
    assert.equal(res.status, "timeout");
  } finally {
    globalThis.navigator = origNavigator;
  }
});

await asyncTest("requestUserLocation: returns 'unavailable' when unavailable (code 2)", async () => {
  const origNavigator = globalThis.navigator;
  try {
    globalThis.navigator = {
      geolocation: {
        getCurrentPosition: (success, failure) => {
          failure({ code: 2, message: "Position unavailable" });
        }
      }
    };
    const res = await requestUserLocation();
    assert.equal(res.status, "unavailable");
  } finally {
    globalThis.navigator = origNavigator;
  }
});

console.log("\n========================================");
console.log(`Geolocation Tests: ${passed} passed, ${failed} failed.`);
console.log("========================================\n");
process.exit(failed > 0 ? 1 : 0);
