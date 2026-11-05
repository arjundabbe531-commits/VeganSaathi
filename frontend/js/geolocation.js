/* ==========================================================================
   VeganSaathi -- geolocation.js
   Optional, user-triggered geolocation helpers. Location permission is NEVER
   requested automatically on page load. Only requested when the user
   explicitly clicks "Use my location".

   LIMITATION NOTICE:
   This module provides CLIENT-SIDE DISTANCE SORTING only. It does NOT
   implement a server-side radius query. All published places are fetched,
   then sorted by distance client-side. A true radius query requires
   GeoPoint indexes or geofire-common -- deferred to a later phase.
   ========================================================================== */

function toRad(deg) { return deg * (Math.PI / 180); }

function isValidPoint(pt) {
  return pt !== null && pt !== undefined &&
    typeof pt.lat === "number" && typeof pt.lon === "number" &&
    Number.isFinite(pt.lat) && Number.isFinite(pt.lon);
}

/**
 * Straight-line distance in km using the Haversine formula.
 * Both args need { lat, lon }. Returns null if either is invalid.
 */
export function haversineKm(a, b) {
  if (!isValidPoint(a) || !isValidPoint(b)) return null;
  var R = 6371;
  var dLat = toRad(b.lat - a.lat);
  var dLon = toRad(b.lon - a.lon);
  var s = Math.sin(dLat / 2), t = Math.sin(dLon / 2);
  var chord = s * s + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * t * t;
  return R * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
}

/**
 * Request browser geolocation. MUST only be called on an explicit user action.
 * Returns Promise<{ status, lat?, lon?, message? }> where status is one of:
 *   "ok" | "denied" | "unavailable" | "timeout" | "unsupported"
 */
export function requestUserLocation() {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ status: "unsupported", message: "Geolocation is not supported by your browser." });
  }
  return new Promise(function (resolve) {
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        resolve({ status: "ok", lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      function (err) {
        if (err.code === 1) resolve({ status: "denied", message: "Location access was denied. You can still search manually." });
        else if (err.code === 3) resolve({ status: "timeout", message: "Location request timed out. Please try again or search manually." });
        else resolve({ status: "unavailable", message: "Your location is currently unavailable. Please search manually." });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  });
}

/**
 * Sort places by distance from userLocation { lat, lon }.
 * Places without valid coordinates are appended at the end (not hidden).
 * Does not mutate the input array.
 */
export function sortByDistance(places, userLocation) {
  if (!isValidPoint(userLocation) || !Array.isArray(places)) return places;
  return places.slice().sort(function (a, b) {
    var da = haversineKm(userLocation, { lat: a.latitude, lon: a.longitude });
    var db = haversineKm(userLocation, { lat: b.latitude, lon: b.longitude });
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });
}

/** Format a km distance for display. Returns null for null input. */
export function formatDistance(km) {
  if (km === null || km === undefined || !Number.isFinite(km)) return null;
  if (km < 10) return (Math.round(km * 10) / 10).toFixed(1) + " km";
  return Math.round(km) + " km";
}
