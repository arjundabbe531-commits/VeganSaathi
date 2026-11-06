/* ==========================================================================
   VeganSaathi — scripts/validate-import.mjs
   ============================================================================
   Offline CSV Research Import Validator & Normalizer.
   Validates research data against the canonical VeganSaathi place schema
   without requiring live Firebase access.

   Usage:
     node scripts/validate-import.mjs <input.csv> [options]

   Options:
     --out <file.csv>        Output clean, normalized CSV for app import
     --report <file.json>    Output machine-readable JSON validation report
     --strict                Treat warnings as errors (refuse output on warnings)
     --quiet                 Suppress console output except final summary
   ========================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// -----------------------------------------------------------------------------
// Constants & Allowed Enums
// -----------------------------------------------------------------------------
export const VALID_PLACE_TYPES = [
  "restaurant",
  "mess",
  "canteen",
  "cafe",
  "dhaba",
  "other"
];

export const VALID_DIET_TAGS = ["vegan", "vegetarian", "eggetarian", "jain"];

export const VALID_PRICE_RANGES = ["budget", "moderate", "premium", "Price not listed"];

export const VALID_STATUSES = ["pending", "published", "rejected"];

export const VALID_VERIFICATION_STATUSES = ["unverified", "verified"];

export const VALID_SOURCES = ["fieldwork", "community"];

export const COORD_BOUNDS = {
  minLat: -90,
  maxLat: 90,
  minLon: -180,
  maxLon: 180
};

// -----------------------------------------------------------------------------
// Alias Mapping Dictionary
// -----------------------------------------------------------------------------
const HEADER_ALIASES = {
  // ID / Key
  id: "id",
  docid: "id",
  doc_id: "id",
  placeid: "id",
  place_id: "id",
  slug: "id",
  sourceid: "sourceId",
  source_id: "sourceId",
  researchid: "sourceId",
  research_id: "sourceId",
  recordid: "sourceId",
  record_id: "sourceId",

  // Name & Branch
  name: "name",
  placename: "name",
  place_name: "name",
  restaurantname: "name",
  restaurant_name: "name",
  branch: "branch",
  branchname: "branch",
  branch_name: "branch",

  // Type & Description
  placetype: "placeType",
  place_type: "placeType",
  appplacetype: "placeType",
  app_place_type: "placeType",
  type: "placeType",
  category: "placeType",
  description: "description",
  desc: "description",

  // Location / Address
  address: "address",
  streetaddress: "address",
  street_address: "address",
  fulladdress: "address",
  full_address: "address",
  area: "area",
  locality: "area",
  neighborhood: "area",
  suburb: "area",
  city: "city",
  town: "city",
  state: "state",
  province: "state",
  region: "state",
  stateregion: "state",
  state_region: "state",
  country: "country",
  nation: "country",
  postalcode: "postalCode",
  postal_code: "postalCode",
  pincode: "postalCode",
  zip: "postalCode",
  zipcode: "postalCode",

  // Coordinates
  latitude: "latitude",
  lat: "latitude",
  longitude: "longitude",
  lon: "longitude",
  lng: "longitude",
  long: "longitude",

  // Diet & Evidence
  diettags: "dietTags",
  diet_tags: "dietTags",
  appdiettags: "dietTags",
  app_diet_tags: "dietTags",
  dietarycategories: "dietTags",
  dietary_categories: "dietTags",
  diets: "dietTags",
  dietnotes: "dietNotes",
  diet_notes: "dietNotes",
  dietaryevidence: "dietNotes",
  dietary_evidence: "dietNotes",
  dietevidence: "dietNotes",

  // Price & Hours
  pricerange: "priceRange",
  price_range: "priceRange",
  price: "priceRange",
  currency: "currency",
  pricecurrency: "currency",
  price_currency: "currency",
  openinginfo: "openingInfo",
  opening_info: "openingInfo",
  hours: "openingInfo",
  openinghours: "openingInfo",
  opening_hours: "openingInfo",

  // Media
  imageurl: "imageUrl",
  image_url: "imageUrl",
  primaryimageurl: "imageUrl",
  primary_image_url: "imageUrl",
  image: "imageUrl",
  imageattribution: "imageAttribution",
  image_attribution: "imageAttribution",
  imagelicense: "imageLicense",
  image_license: "imageLicense",
  rightscleared: "rightsCleared",
  rights_cleared: "rightsCleared",
  evidencesummary: "evidenceSummary",
  evidence_summary: "evidenceSummary",

  // Sources & Verification
  sourceurls: "sourceUrls",
  source_urls: "sourceUrls",
  sources: "sourceUrls",
  sourceurl: "sourceUrls",
  source_url: "sourceUrls",
  evidenceurl: "sourceUrls",
  evidence_url: "sourceUrls",
  status: "status",
  appstatus: "status",
  app_status: "status",
  verificationstatus: "verificationStatus",
  verification_status: "verificationStatus",
  appverificationstatus: "verificationStatus",
  app_verification_status: "verificationStatus",
  lastverifiedat: "lastVerifiedAt",
  last_verified_at: "lastVerifiedAt",
  applastverifiedat: "lastVerifiedAt",
  app_last_verified_at: "lastVerifiedAt",
  visitdate: "lastVerifiedAt",
  visit_date: "lastVerifiedAt",
  verificationnote: "verificationNote",
  verification_note: "verificationNote",
  appverificationnote: "verificationNote",
  app_verification_note: "verificationNote",
  source: "source",
  sourcetype: "source",
  source_type: "source",
  appsource: "source",
  app_source: "source",
  submittedbyname: "submittedByName",
  submitted_by_name: "submittedByName",
  researcher: "submittedByName",
  investigator: "submittedByName",
  researchstatus: "researchStatus",
  research_status: "researchStatus"
};

// -----------------------------------------------------------------------------
// Robust RFC 4180 CSV Parser
// -----------------------------------------------------------------------------
export function parseCSV(text) {
  if (typeof text !== "string") return [];
  // Strip UTF-8 BOM if present
  const cleanText = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;

  const rows = [];
  let currentRow = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: ""
          currentField += '"';
          i++;
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = "";
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else if (char === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
  }

  // Push final field/row if anything remains
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  // Filter out any trailing completely empty lines
  while (rows.length > 0 && rows[rows.length - 1].every(cell => !cell.trim())) {
    rows.pop();
  }

  return rows;
}

// -----------------------------------------------------------------------------
// CSV Formatter (escapes quotes, wraps complex fields, mitigates formula injection)
// -----------------------------------------------------------------------------
export function formatCSVRow(fields) {
  return fields
    .map(val => {
      if (val === null || val === undefined) return "";
      let str = String(val);
      // CSV Formula Injection mitigation (CWE-1236):
      // Prepend single quote if cell starts with =, @, \t, \r, or +/- followed by non-digit
      if (/^[=@\t\r]/.test(str) || /^[+\-][^0-9]/.test(str)) {
        str = "'" + str;
      }
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    })
    .join(",");
}

// -----------------------------------------------------------------------------
// Haversine Distance Helper (for duplicate detection)
// -----------------------------------------------------------------------------
function toRad(deg) { return deg * (Math.PI / 180); }

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Normalize name string for similarity matching
function cleanName(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// -----------------------------------------------------------------------------
// Validation & Normalization Engine
// -----------------------------------------------------------------------------
export function validateAndNormalizeRows(rawRows) {
  if (!rawRows || rawRows.length < 2) {
    return {
      success: false,
      errors: [{ row: 0, field: "file", message: "CSV file is empty or missing data rows." }],
      warnings: [],
      records: []
    };
  }

  const rawHeaders = rawRows[0];
  const canonicalHeaders = [];
  const headerMap = {}; // normalized canonical name -> column index
  const seenCanonical = new Map();
  const errors = [];
  const warnings = [];
  const records = [];

  rawHeaders.forEach((h, idx) => {
    const rawClean = h.trim();
    if (!rawClean) {
      warnings.push({
        row: 1,
        field: `column_${idx + 1}`,
        code: "EMPTY_HEADER",
        message: `Column header ${idx + 1} is empty or blank.`
      });
      return;
    }
    const lookupKey = rawClean.toLowerCase().replace(/[^a-z0-9_]/g, "");
    const mapped = HEADER_ALIASES[lookupKey] || rawClean;
    canonicalHeaders.push(mapped);

    if (seenCanonical.has(mapped)) {
      warnings.push({
        row: 1,
        field: mapped,
        code: "DUPLICATE_HEADER",
        message: `Duplicate header for field "${mapped}" found at column ${idx + 1} (previous at column ${seenCanonical.get(mapped) + 1}). Later column will take precedence.`
      });
    }
    seenCanonical.set(mapped, idx);
    headerMap[mapped] = idx;
  });

  const seenIds = new Map();
  const seenSourceIds = new Map();

  // Parse each data row
  for (let r = 1; r < rawRows.length; r++) {
    const rowNum = r + 1; // 1-indexed line number in CSV
    const row = rawRows[r];

    // Helper to get raw cell by canonical name
    const getVal = (canonicalKey) => {
      const idx = headerMap[canonicalKey];
      if (idx === undefined || idx >= row.length) return "";
      return row[idx] ? row[idx].trim() : "";
    };

    const rowErrors = [];
    const rowWarnings = [];

    // 1. Identification & Provenance
    const rawId = getVal("id");
    const rawSourceId = getVal("sourceId");
    const sourceId = rawSourceId || rawId || `research-row-${rowNum}`;
    const id = rawId || (getVal("name") ? cleanName(getVal("name")).replace(/\s+/g, "-") : sourceId);

    if (sourceId && seenSourceIds.has(sourceId)) {
      rowWarnings.push({
        row: rowNum,
        field: "sourceId",
        code: "DUPLICATE_SOURCE_ID",
        message: `Duplicate sourceId "${sourceId}" already seen in row ${seenSourceIds.get(sourceId)}.`
      });
    } else if (sourceId) {
      seenSourceIds.set(sourceId, rowNum);
    }

    if (id && seenIds.has(id)) {
      rowWarnings.push({
        row: rowNum,
        field: "id",
        code: "DUPLICATE_ID",
        message: `Duplicate place id "${id}" already seen in row ${seenIds.get(id)}.`
      });
    } else if (id) {
      seenIds.set(id, rowNum);
    }

    // 2. Name & Branch
    let name = getVal("name");
    const branch = getVal("branch");
    if (branch && !name.toLowerCase().includes(branch.toLowerCase())) {
      name = `${name} (${branch})`;
    }

    if (!name) {
      rowErrors.push({ row: rowNum, field: "name", message: "Place name is required." });
    } else if (name.length < 2 || name.length > 100) {
      rowErrors.push({ row: rowNum, field: "name", message: `Place name must be between 2 and 100 characters (got ${name.length}).` });
    }

    // Synthetic Safeguard: Reject synthetic test fixtures from production import
    const isSynthetic = (
      getVal("is_synthetic_fixture") === "true" ||
      getVal("dataset_origin") === "synthetic_test_fixture" ||
      sourceId.toLowerCase().includes("synthetic") ||
      name.startsWith("[TEST FIXTURE]")
    );
    if (isSynthetic) {
      rowErrors.push({
        row: rowNum,
        field: "is_synthetic_fixture",
        message: "SAFEGUARD ENFORCED: Record is flagged as a synthetic test fixture and is strictly blocked from public application import."
      });
    }

    // 3. Place Type
    let placeType = getVal("placeType").toLowerCase();
    if (!placeType) {
      rowErrors.push({ row: rowNum, field: "placeType", message: "Place type is required." });
    } else if (!VALID_PLACE_TYPES.includes(placeType)) {
      rowErrors.push({
        row: rowNum,
        field: "placeType",
        message: `Invalid place type "${placeType}". Must be one of: ${VALID_PLACE_TYPES.join(", ")}.`
      });
    }

    // 4. Address & Structured Location
    const address = getVal("address");
    if (!address) {
      rowErrors.push({ row: rowNum, field: "address", message: "Address is required." });
    } else if (address.length > 300) {
      rowErrors.push({ row: rowNum, field: "address", message: `Address exceeds 300 characters (got ${address.length}).` });
    }

    const area = getVal("area") || "Area not listed";
    const city = getVal("city");
    const state = getVal("state");
    const country = getVal("country");
    const postalCode = getVal("postalCode");

    if (!city) {
      rowWarnings.push({ row: rowNum, field: "city", message: "City/Town is missing. Recommended for global discovery." });
    }
    if (!country) {
      rowWarnings.push({ row: rowNum, field: "country", message: "Country is missing. Recommended for global discovery." });
    }

    // 5. Coordinates
    const rawLat = getVal("latitude");
    const rawLon = getVal("longitude");
    const lat = (rawLat !== null && rawLat !== undefined && rawLat.trim() !== "") ? Number(rawLat) : NaN;
    const lon = (rawLon !== null && rawLon !== undefined && rawLon.trim() !== "") ? Number(rawLon) : NaN;

    if (isNaN(lat) || isNaN(lon)) {
      rowErrors.push({
        row: rowNum,
        field: "coordinates",
        code: "COORDINATES_MISSING",
        message: `Coordinates are missing or non-numeric (got lat: "${rawLat}", lon: "${rawLon}"). Record is blocked from public app import.`
      });
    } else {
      if (lat < COORD_BOUNDS.minLat || lat > COORD_BOUNDS.maxLat) {
        rowErrors.push({
          row: rowNum,
          field: "latitude",
          code: "COORDINATES_OUT_OF_RANGE",
          message: `Latitude ${lat} is outside valid geographic range [-90, 90].`
        });
      }
      if (lon < COORD_BOUNDS.minLon || lon > COORD_BOUNDS.maxLon) {
        rowErrors.push({
          row: rowNum,
          field: "longitude",
          code: "COORDINATES_OUT_OF_RANGE",
          message: `Longitude ${lon} is outside valid geographic range [-180, 180].`
        });
      }
      if (lat === 0 && lon === 0) {
        rowWarnings.push({
          row: rowNum,
          field: "coordinates",
          code: "NULL_ISLAND",
          message: "Coordinates are exactly [0, 0] (Null Island); verify if this is placeholder data."
        });
      }

      // Locality sanity check (e.g. India bounding box)
      const normCountry = (country || "").trim().toLowerCase();
      if (normCountry === "india" || normCountry === "in") {
        if (lat < 6.0 || lat > 37.5 || lon < 68.0 || lon > 98.0) {
          rowWarnings.push({
            row: rowNum,
            field: "coordinates",
            code: "LOCALITY_COORDINATE_MISMATCH",
            message: `Coordinates [${lat}, ${lon}] appear to be outside India (declared country: "${country}"). Verify if coordinates or country were swapped.`
          });
        }
      }
    }

    // 6. Dietary Categories (STRICT DIETARY INTEGRITY)
    const rawDiet = getVal("dietTags");
    let dietTags = [];
    if (rawDiet) {
      dietTags = rawDiet
        .split(/[;,|]/)
        .map(t => t.trim().toLowerCase())
        .filter(Boolean);
    }

    if (dietTags.length === 0) {
      rowErrors.push({ row: rowNum, field: "dietTags", message: "At least one valid diet tag is required (vegan, vegetarian, eggetarian, jain)." });
    } else {
      const invalidTags = dietTags.filter(t => !VALID_DIET_TAGS.includes(t));
      if (invalidTags.length > 0) {
        rowErrors.push({
          row: rowNum,
          field: "dietTags",
          message: `Contains invalid diet tags: "${invalidTags.join(", ")}". Allowed: ${VALID_DIET_TAGS.join(", ")}.`
        });
      }
    }

    const dietNotes = getVal("dietNotes");
    if (dietNotes.length > 300) {
      rowErrors.push({ row: rowNum, field: "dietNotes", message: `Diet notes exceed 300 characters (got ${dietNotes.length}).` });
    }

    // Vegan evidence check: flag vegetarian venues or dairy notes tagged vegan without supporting evidence
    if (dietTags.includes("vegan")) {
      const descVal = getVal("description");
      const nameAndDesc = `${name} ${descVal}`.toLowerCase();
      const notesLower = dietNotes.toLowerCase();
      const combined = `${nameAndDesc} ${notesLower} ${getVal("evidenceSummary")}`.toLowerCase();

      const isExplicitlyVegetarian = /(pure\s+veg|pure\s+vegetarian|shakahari|bhojanalaya)/i.test(nameAndDesc);
      const mentionsDairy = /(ghee|butter|paneer|curd|cream|dairy|milk\b)/i.test(notesLower);
      const hasVeganAffirmation = /(vegan|plant[-\s]?based|dairy[-\s]?free|no\s+(dairy|ghee|butter|milk|paneer)|without\s+(dairy|ghee|butter|milk|paneer)|soya?|tofu|cashew|almond|vegetable\s+oil|\boil\b)/i.test(combined);

      if (isExplicitlyVegetarian && !hasVeganAffirmation) {
        rowWarnings.push({
          row: rowNum,
          field: "dietNotes",
          code: "VEGAN_EVIDENCE_UNCERTAIN",
          message: `Place is identified as pure-vegetarian in name/description but tagged 'vegan' without explicit confirmation of dairy-free or ghee-free options in dietNotes.`
        });
      } else if (mentionsDairy && !hasVeganAffirmation) {
        rowWarnings.push({
          row: rowNum,
          field: "dietNotes",
          code: "VEGAN_EVIDENCE_UNCERTAIN",
          message: `Record mentions dairy/ghee in dietNotes and is tagged 'vegan', but lacks explicit confirmation of dairy-free preparation.`
        });
      }
    }

    // 7. Price & Currency
    let priceRange = getVal("priceRange");
    if (!priceRange) {
      priceRange = "Price not listed";
    } else {
      const lower = priceRange.toLowerCase();
      if (lower === "budget" || lower === "moderate" || lower === "premium") {
        priceRange = lower;
      } else if (priceRange !== "Price not listed") {
        rowErrors.push({
          row: rowNum,
          field: "priceRange",
          message: `Invalid priceRange "${priceRange}". Must be budget, moderate, premium, or "Price not listed".`
        });
      }
    }

    const currency = getVal("currency");
    if (currency && !/^[A-Z]{3}$/.test(currency)) {
      rowWarnings.push({ row: rowNum, field: "currency", message: `Currency code "${currency}" is not a 3-letter ISO code (e.g. INR, USD, GBP).` });
    }

    // 8. Description & Opening Info
    const description = getVal("description");
    if (description.length > 500) {
      rowErrors.push({ row: rowNum, field: "description", message: `Description exceeds 500 characters (got ${description.length}).` });
    }
    const openingInfo = getVal("openingInfo");

    // 9. Status & Verification (CRITICAL VERIFICATION SAFETY)
    let status = getVal("status").toLowerCase();
    if (!status) {
      status = "pending"; // default safety for imported research
    } else if (!VALID_STATUSES.includes(status)) {
      rowErrors.push({ row: rowNum, field: "status", message: `Invalid status "${status}". Allowed: ${VALID_STATUSES.join(", ")}.` });
    }

    let verificationStatus = getVal("verificationStatus").toLowerCase();
    if (!verificationStatus) {
      verificationStatus = "unverified";
    } else if (!VALID_VERIFICATION_STATUSES.includes(verificationStatus)) {
      rowErrors.push({
        row: rowNum,
        field: "verificationStatus",
        message: `Invalid verificationStatus "${verificationStatus}". Allowed: ${VALID_VERIFICATION_STATUSES.join(", ")}.`
      });
    }

    const rawVisitDate = getVal("lastVerifiedAt");
    let lastVerifiedAt = "";
    const verificationNote = getVal("verificationNote");

    // Enforcement: Online research CANNOT be imported as physically verified!
    const rawSource = getVal("source").toLowerCase();
    const isOnlineResearch = rawSource.includes("online") || rawSource.includes("research") || rawSource === "" || rawSource === "community";

    if (verificationStatus === "verified") {
      if (isOnlineResearch) {
        rowErrors.push({
          row: rowNum,
          field: "verificationStatus",
          message: "Online research records cannot be marked 'verified'. Verification requires a physical in-person team visit."
        });
      }

      if (!rawVisitDate) {
        rowErrors.push({
          row: rowNum,
          field: "lastVerifiedAt",
          message: "Places marked 'verified' must include a valid visit date in lastVerifiedAt."
        });
      } else {
        const parsedDate = new Date(rawVisitDate);
        if (isNaN(parsedDate.getTime())) {
          rowErrors.push({ row: rowNum, field: "lastVerifiedAt", message: `Malformed visit date: "${rawVisitDate}".` });
        } else if (parsedDate.getTime() > Date.now()) {
          rowErrors.push({ row: rowNum, field: "lastVerifiedAt", message: "Visit date cannot be in the future." });
        } else {
          lastVerifiedAt = parsedDate.toISOString();
        }
      }
    } else {
      // Unverified places should NOT carry a verification date
      if (rawVisitDate) {
        rowWarnings.push({
          row: rowNum,
          field: "lastVerifiedAt",
          message: "lastVerifiedAt was provided for an unverified place. Clearing to preserve trust integrity."
        });
      }
      lastVerifiedAt = "";
    }

    // Map source enum
    let source = (rawSource.includes("fieldwork") || rawSource.includes("in_person")) ? "fieldwork" : "community";

    // 10. Image URL & Media Attribution
    const imageUrl = getVal("imageUrl");
    const imageAttribution = getVal("imageAttribution");
    const imageLicense = getVal("imageLicense");
    if (imageUrl) {
      if (!/^https?:\/\//i.test(imageUrl)) {
        rowErrors.push({ row: rowNum, field: "imageUrl", message: `Image URL must be a valid HTTP/HTTPS URL (got "${imageUrl}").` });
      }
      if (!imageAttribution && !imageLicense) {
        rowWarnings.push({
          row: rowNum,
          field: "imageLicense",
          code: "IMAGE_RIGHTS_MISSING",
          message: `Image URL was provided without imageAttribution or imageLicense metadata. High risk of copyright infringement.`
        });
      }
    }

    const sourceUrls = getVal("sourceUrls");
    if (!sourceUrls && isOnlineResearch) {
      rowWarnings.push({ row: rowNum, field: "sourceUrls", message: "Missing source/evidence URLs for online research record." });
    }

    const submittedByName = getVal("submittedByName") || "Research Team";

    // Accumulate errors/warnings
    errors.push(...rowErrors);
    warnings.push(...rowWarnings);

    const isBlocked = rowErrors.length > 0;
    const classification = isBlocked
      ? "BLOCKED_PRELIMINARY_LEAD"
      : (rowWarnings.length > 0 ? "IMPORT_ELIGIBLE_WITH_ADVISORIES" : "IMPORT_ELIGIBLE");

    // Build canonical app-import record
    records.push({
      rowIndex: rowNum,
      sourceId: sourceId,
      id: id,
      name: name,
      placeType: placeType,
      description: description,
      address: address,
      area: area,
      city: city,
      state: state,
      country: country,
      postalCode: postalCode,
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lon) ? lon : null,
      dietTags: dietTags,
      dietNotes: dietNotes,
      priceRange: priceRange,
      currency: currency,
      openingInfo: openingInfo,
      imageUrl: imageUrl || "",
      status: status,
      verificationStatus: verificationStatus,
      lastVerifiedAt: lastVerifiedAt,
      verificationNote: verificationNote,
      source: source,
      submittedByName: submittedByName,
      sourceUrls: sourceUrls,
      isValid: !isBlocked,
      classification: classification,
      blockers: rowErrors.map(e => e.message),
      advisories: rowWarnings.map(w => w.message)
    });
  }

  // ---------------------------------------------------------------------------
  // Conservative Duplicate Detection Pass
  // ---------------------------------------------------------------------------
  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i];
      const b = records[j];

      const cleanA = cleanName(a.name);
      const cleanB = cleanName(b.name);

      let isDuplicate = false;
      let reason = "";

      // Check 1: Identical coordinates (< 20m)
      if (a.latitude !== null && a.longitude !== null && b.latitude !== null && b.longitude !== null) {
        const dist = haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude);
        if (dist < 20) {
          isDuplicate = true;
          reason = `Identical coordinates (${dist.toFixed(1)}m apart)`;
        } else if (dist < 500 && (cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA))) {
          isDuplicate = true;
          reason = `Similar name ("${a.name}" vs "${b.name}") within ${(dist).toFixed(0)}m`;
        }
      }

      // Check 2: Exact same name and city/address
      if (!isDuplicate && cleanA === cleanB && cleanA.length > 3) {
        if (a.city && b.city && a.city.toLowerCase() === b.city.toLowerCase()) {
          isDuplicate = true;
          reason = `Identical name in same city (${a.city})`;
        } else if (a.address && b.address && a.address.toLowerCase() === b.address.toLowerCase()) {
          isDuplicate = true;
          reason = `Identical name and address`;
        }
      }

      if (isDuplicate) {
        warnings.push({
          row: b.rowIndex,
          field: "duplicate",
          message: `Probable duplicate of row ${a.rowIndex} ("${a.name}", ID: ${a.sourceId}): ${reason}.`
        });
      }
    }
  }

  return {
    success: errors.length === 0,
    errors: errors,
    warnings: warnings,
    records: records
  };
}

// -----------------------------------------------------------------------------
// Formatted App Import CSV Generator
// -----------------------------------------------------------------------------
export function generateAppImportCSV(records) {
  const headers = [
    "id",
    "name",
    "placeType",
    "description",
    "address",
    "area",
    "city",
    "state",
    "country",
    "postalCode",
    "latitude",
    "longitude",
    "dietTags",
    "dietNotes",
    "priceRange",
    "openingInfo",
    "imageUrl",
    "status",
    "verificationStatus",
    "lastVerifiedAt",
    "verificationNote",
    "source",
    "submittedByName",
    "sourceId"
  ];

  const lines = [formatCSVRow(headers)];
  const sortedRecords = [...records].sort((a, b) => a.rowIndex - b.rowIndex);

  sortedRecords.forEach(rec => {
    if (!rec.isValid) return; // Skip invalid records from import payload
    const rowValues = [
      rec.id,
      rec.name,
      rec.placeType,
      rec.description,
      rec.address,
      rec.area,
      rec.city,
      rec.state,
      rec.country,
      rec.postalCode,
      rec.latitude,
      rec.longitude,
      rec.dietTags.join(";"),
      rec.dietNotes,
      rec.priceRange,
      rec.openingInfo,
      rec.imageUrl,
      rec.status,
      rec.verificationStatus,
      rec.lastVerifiedAt,
      rec.verificationNote,
      rec.source,
      rec.submittedByName,
      rec.sourceId
    ];
    lines.push(formatCSVRow(rowValues));
  });

  return lines.join("\n") + "\n";
}

// -----------------------------------------------------------------------------
// CLI Runner
// -----------------------------------------------------------------------------
function runCLI() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
VeganSaathi Research Import Validator
Usage: node scripts/validate-import.mjs <input.csv> [options]

Options:
  --out <file.csv>        Output clean, normalized CSV for app import
  --report <file.json>    Output machine-readable JSON validation report
  --strict                Fail if any warnings are detected
  --quiet                 Suppress non-essential console logs
`);
    process.exit(args.length === 0 ? 1 : 0);
  }

  const inputFile = args[0];
  let outFile = null;
  let reportFile = null;
  let strict = false;
  let quiet = false;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--out" && args[i + 1]) {
      outFile = args[++i];
    } else if (args[i] === "--report" && args[i + 1]) {
      reportFile = args[++i];
    } else if (args[i] === "--strict") {
      strict = true;
    } else if (args[i] === "--quiet") {
      quiet = true;
    }
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`Error: input file "${inputFile}" does not exist.`);
    process.exit(1);
  }

  const csvText = fs.readFileSync(inputFile, "utf8");
  const rawRows = parseCSV(csvText);
  const result = validateAndNormalizeRows(rawRows);

  if (!quiet) {
    const eligible = result.records.filter(r => r.classification === "IMPORT_ELIGIBLE").length;
    const flagged = result.records.filter(r => r.classification === "FLAGGED").length;
    const blocked = result.records.filter(r => r.classification === "BLOCKED_PRELIMINARY_LEAD").length;

    console.log("=================================================");
    console.log(`Validation Report for: ${inputFile}`);
    console.log(`Total research records: ${rawRows.length - 1}`);
    console.log(`  - Import-Eligible:          ${eligible}`);
    console.log(`  - Flagged with warnings:    ${flagged}`);
    console.log(`  - Blocked preliminary leads:${blocked}`);
    console.log(`Total blocking errors:   ${result.errors.length}`);
    console.log(`Total advisories:        ${result.warnings.length}`);
    console.log("=================================================");

    console.log("\n📋 RECORD CLASSIFICATION SUMMARY:");
    result.records.forEach(r => {
      const icon = r.isValid ? "✅" : "⏸️";
      console.log(`  [Row ${r.rowIndex}] ${icon} ${r.sourceId}: "${r.name}" -> ${r.classification}`);
      if (r.blockers && r.blockers.length > 0) {
        r.blockers.forEach(b => console.log(`      ↳ Blocker: ${b}`));
      }
      if (r.advisories && r.advisories.length > 0) {
        r.advisories.forEach(a => console.log(`      ↳ Advisory: ${a}`));
      }
    });

    if (result.errors.length > 0) {
      console.log("\n❌ BLOCKING ERRORS (must be resolved before app import):");
      result.errors.forEach(e => {
        console.log(`  [Row ${e.row}] ${e.field}: ${e.message}`);
      });
    }

    if (result.warnings.length > 0) {
      console.log("\n⚠️ WARNINGS / ADVISORIES:");
      result.warnings.forEach(w => {
        console.log(`  [Row ${w.row}] ${w.field}: ${w.message}`);
      });
    }
  }

  if (reportFile) {
    const reportData = {
      inputFile: path.resolve(inputFile),
      timestamp: new Date().toISOString(),
      summary: {
        totalRows: rawRows.length - 1,
        importEligible: result.records.filter(r => r.isValid).length,
        blockedPreliminaryLeads: result.records.filter(r => !r.isValid).length,
        errorCount: result.errors.length,
        warningCount: result.warnings.length
      },
      records: result.records.map(r => ({
        rowIndex: r.rowIndex,
        sourceId: r.sourceId,
        name: r.name,
        classification: r.classification,
        blockers: r.blockers,
        advisories: r.advisories
      })),
      errors: result.errors,
      warnings: result.warnings
    };
    fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2), "utf8");
    if (!quiet) console.log(`\nReport written to: ${reportFile}`);
  }

  const hasBlockingIssues = result.errors.length > 0 || (strict && result.warnings.length > 0);

  if (hasBlockingIssues) {
    if (!quiet) {
      console.log("\nℹ️ POLICY NOTICE:");
      console.log("  Preliminary research records are preserved in the research dataset.");
      console.log("  They are BLOCKED from public Firestore import until venue coordinates");
      console.log("  and dietary evidence are established via fieldwork or verified primary menus.");
      console.log("  Public app import CSV will not include blocked leads.");
    }
    process.exit(1);
  }

  if (outFile) {
    const outputCSV = generateAppImportCSV(result.records);
    fs.writeFileSync(outFile, outputCSV, "utf8");
    if (!quiet) console.log(`\n✅ Validated output successfully written to: ${outFile}`);
  }

  if (!quiet) console.log("\n✅ Validation PASSED.");
  process.exit(0);
}

// Auto-run CLI if invoked directly
const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFilePath)) {
  runCLI();
}
