# DATABASE_SCHEMA.md — VeganSaathi (Cloud Firestore)

Firestore is a NoSQL document database. Collections below are top-level unless noted.
Document ID = Firestore auto-ID unless stated otherwise.

---

## Collection: `users`
Document ID = Firebase Auth UID (so a user's auth account and profile share one ID).

| Field | Type | Required | Purpose |
|---|---|---|---|
| name | string | yes | Display name |
| email | string | yes | From Firebase Auth (mirrored for convenience) |
| dietPreference | string (enum) | yes | vegan / vegetarian / eggetarian / jain / unspecified |
| area | string | no | Approximate locality (e.g. "SSGMCE Hostel Block A") — never exact address |
| role | string (enum) | yes | "user" or "admin" — **never client-writable, see security rules** |
| profileImageUrl | string | no | Cloudinary URL (future phase — not yet implemented) |
| createdAt | timestamp | yes | Set on account creation |

## Collection: `places`

**Document ID.** Team-seeded places use a **readable, stable slug** (lowercase letters,
numbers, hyphens — e.g. `ssgmce-main-canteen`), typed in by hand in the Firebase Console.
Once created a slug is **never renamed**, because reviews and reports will reference it.
Community submissions (Phase 6) use auto-generated IDs.

| Field | Type | Required | Purpose |
|---|---|---|---|
| name | string | yes | Place name, 2–100 characters |
| description | string | no | Short factual description, ≤ 500 characters |
| placeType | string (enum) | yes | restaurant / mess / canteen / cafe / dhaba / other |
| address | string | yes | Human-readable address. Free text; informal is fine for messes and hostels |
| area | string | no | Short landmark/locality shown on cards (e.g. "near hostel gate" or neighborhood) |
| city | string | no | City, town or municipality (e.g. "Shegaon", "Pune", "London") |
| state | string | no | State, province or administrative region (e.g. "Maharashtra", "Greater London") |
| country | string | no | Country name (e.g. "India", "United Kingdom", "Japan") |
| postalCode | string | no | Postal code or PIN code (e.g. "444203", "W1D 4HA") |
| latitude | number | yes | For map pin. Validated globally against `COORD_BOUNDS` (lat -90 to 90, lon -180 to 180) |
| longitude | number | yes | For map pin. Validated globally against `COORD_BOUNDS` (lat -90 to 90, lon -180 to 180) |
| dietTags | array<string> | yes, non-empty | Internal dietary discovery values. Public VeganSaathi surfaces show only a supported vegan classification; approval never infers vegetarian, eggetarian, or Jain from vegan evidence. |
| dietNotes | string | no | What the team was told, in plain words (e.g. dish-level caveats). The honesty layer that the tags alone cannot carry. ≤ 300 characters |
| priceRange | string (enum) | no | budget / moderate / premium (thresholds agreed by the team — see `docs/FIELDWORK_GUIDE.md`). If missing, the UI shows "Price not listed" |
| openingInfo | string | no | Free-text opening information, only if confirmed |
| imageUrl | string | no | Primary image URL (HTTP/HTTPS URL) |
| status | string (enum) | yes | pending / published / rejected — **admin-controlled**. Controls visibility only |
| verificationStatus | string (enum) | yes | unverified / verified. **admin-controlled** |
| veganClassification | string (enum) | conditional | fully_vegan / vegan_friendly / verified_vegan_options / vegan_status_unverified / vegan_claim_conflicting. The class describes whole-venue status versus available options; a specific option does not imply an entirely vegan venue. |
| evidenceStatus | string (enum) | conditional | Reviewed dietary evidence state. Discovery leads, stale or conflicting evidence cannot support a public vegan classification. |
| evidenceRefs | array<map> | conditional | Public-safe dietary evidence summary (claim, HTTPS source URL, last-checked date, strength, validity, excerpt). Full reviewed source metadata remains in `verificationHistory`. |
| verificationDimensions | map | conditional | Separate business identity, address, coordinate, operation, physical-visit, dietary-evidence and photo-rights dimensions. `address_confirmed` and `coordinates_supported` require claim-specific evidence. |
| lastVerifiedAt | timestamp | conditional | **Required when `verificationStatus == "verified"`.** Date of the most recent documented review. It is not proof of a physical visit; see `verificationDimensions.physically_visited`. |
| verificationNote | string | no | What was checked and how, ≤ 300 characters |
| source | string (enum) | yes | `fieldwork` (entered by the team from a real visit) or `community` (submitted by a user or imported from external research). Powers the CEP metrics |
| submittedBy | string (uid) | yes | Reference to `users` doc — used by security rules for ownership checks. For team-seeded places, the uid of the teammate who entered it |
| submittedByName | string | yes | Denormalized display name, captured at submission time, so the admin dashboard and public UI can show "submitted by X" without a second read of the `users` collection |
| createdAt | timestamp | yes | Document creation timestamp |
| updatedAt | timestamp | yes | Document last updated timestamp |

### Three-Tier Data Separation Model

To protect public performance, privacy, and schema simplicity while supporting deep research provenance, place data is strictly separated into three tiers:

1. **Tier 1 — Public Application Document (Cloud Firestore `places` collection)**:
   The lean, optimized schema shown in the table above. Directly queried and rendered by the web application (`explore.html`, `place-details.html`, `map`). Contains only fields verified as safe, necessary, and rendered in the UI.

2. **Tier 2 — Research & Provenance Ledger (`research/` offline datasets & audit artifacts)**:
   The rich research dataset (e.g., `places_master.csv`, `place_sources.csv`, `place_images.csv`). Preserves deep auditability:
   - Specific branch names, alternate spellings, and local script names.
   - Granular dietary option breakdowns (`vegan_options_status`, `cross_contact_information`).
   - Multiple documentation source URLs, review aggregators, and menu links.
   - Multiple candidate images with author attribution, source page URLs, and copyright/license rights status.
   - Operating status check dates and researcher provenance.
   *These fields are never dumped wholesale into public Firestore documents.*

3. **Tier 3 — Import Validation Metadata (Internal Pipeline State)**:
   Operational metadata evaluated exclusively by `scripts/validate-import.mjs` during the offline reconciliation process:
   - `classification`: `IMPORT_ELIGIBLE`, `IMPORT_ELIGIBLE_WITH_ADVISORIES`, or `BLOCKED_PRELIMINARY_LEAD`.
   - `blockers`: Explicit blocking reasons (e.g. `COORDINATES_MISSING`).
   - `advisories`: Quality warnings (e.g. `MISSING_SOURCE_URLS`, `SUSPICIOUS_NULL_ISLAND`).
   - `sourceId`: Traces each generated import row back to the source research record.
   *This metadata controls whether an import row is generated; it is not written to production Firestore documents.*

### Status and verification model

`status` controls **visibility**. `verificationStatus` + `lastVerifiedAt` communicate the date of a documented review. `veganClassification` and claim-specific evidence communicate dietary claims. Physical visits are recorded separately.

| `status` | `verificationStatus` | Meaning | Visible to visitors? |
|---|---|---|---|
| pending | unverified | Submitted, awaiting review | No |
| published | unverified | Approved but not yet visited | Yes — shown as "Not yet verified" |
| published | verified | A reviewer completed the evidence-backed review recorded in `verificationHistory` | Yes — "Verified, last checked {date}" |
| rejected | any | Declined | No |

A `verified` document without `lastVerifiedAt` is invalid; the UI treats it as "Not yet
verified".

### Last-verified model and the 90-day freshness cue

`verificationStatus: "verified"` does not by itself mean someone physically visited or that
the entire venue is vegan. The `physically_visited` dimension is true only when a visit
evidence reference is recorded. Vegan classification is claim-specific and requires current
dietary evidence. Every decision's complete evidence references are retained immutably in
`verificationHistory`.

The UI may show a soft **"re-check due"** cue when `lastVerifiedAt` is more than **90 days**
old. This cue is presentation only: it **never** changes `verificationStatus` automatically.
Only a person, after a visit, changes verification data. The absolute date is always shown.

### Validation notes

- **Console writes bypass security rules**, so a wrong type or a wrongly capitalised enum
  (`"Vegan"`) is not caught by the database. `normalizePlace()` in `frontend/js/places-service.js`
  skips invalid documents with a console warning instead of crashing the page.
- **List queries must include `where("status", "==", "published")`.** Firestore rules are
  not filters; a visitor's list query without it is rejected.
- **`source` is strictly enforced by rules in Phase 6.** Client place submissions must have `source == "community"`, `submittedBy == request.auth.uid`, `status == "pending"`, and `verificationStatus == "unverified"`. Submitter edits on pending submissions preserve `source == "community"`, `submittedBy`, and `createdAt`, preventing fieldwork metric spoofing or privilege escalation.
- **Coordinates & pilot bounds:** Latitude and longitude must be numbers within `PILOT_BOUNDS` (lat 20.70–20.90, lon 76.55–76.80) enforced both client-side and server-side in security rules.
- **Privacy:** `submittedBy` / `submittedByName` are readable by anyone on a published place (rules work per document). For pending places, only the submitter and admins may read.

## Collection: `reviews`

| Field | Type | Required | Purpose |
|---|---|---|---|
| placeId | string | yes | Reference to `places` doc |
| userId | string (uid) | yes | Reviewer — used by security rules for author-only delete |
| authorName | string | yes | Denormalized display name, captured at review-creation time, so reviews can be shown publicly without granting read access to the `users` collection |
| rating | number (1–5) | yes | |
| comment | string | no | Short text, length-capped client + rule-side |
| createdAt | timestamp | yes | |

## Collection: `reports`

| Field | Type | Required | Purpose |
|---|---|---|---|
| placeId | string | yes | Reference to `places` doc |
| reporterId | string (uid) | yes | |
| reason | string (enum) | yes | place-closed / wrong-diet-info / wrong-address / temporarily-unavailable / outdated / other |
| description | string | no | Free text detail |
| status | string (enum) | yes | pending / resolved / dismissed — admin-controlled |
| createdAt | timestamp | yes | |
| resolvedAt | timestamp | no | |

## Collection: `savedPlaces`
Document ID = `{uid}_{placeId}` (composite key, avoids duplicate saves without a query).

| Field | Type | Required | Purpose |
|---|---|---|---|
| userId | string (uid) | yes | |
| placeId | string | yes | |
| createdAt | timestamp | yes | |

## Collection: `editSuggestions` (Should-Have, not MVP-blocking)

| Field | Type | Required | Purpose |
|---|---|---|---|
| placeId | string | yes | |
| suggestedBy | string (uid) | yes | |
| changes | map | yes | Field → proposed new value |
| status | string (enum) | yes | pending / applied / dismissed |
| createdAt | timestamp | yes | |

---

## Notes on Design Choices

- **`dietCategories` is not a separate collection.** The four values are fixed and small
  enough to hardcode as an enum in both frontend and security rules — a lookup collection
  would add a network round-trip for no real benefit at this scale.
- **`status` on `places` is separate from `verificationStatus`.** `status` controls
  visibility (is it public at all); `verificationStatus`/`lastVerifiedAt` communicates
  trust once it *is* public. A place can be published but not yet re-verified recently.
- **No collection stores plaintext passwords.** Firebase Authentication handles credentials
  entirely outside Firestore.
- **Indexes:** Firestore auto-indexes single fields. Composite indexes defined in `firebase/firestore.indexes.json` include:
  1. `places`: `status ASC` + `dietTags CONTAINS` (for filtered published queries).
  2. `places`: `submittedBy ASC` + `createdAt DESC` (for submitter dashboard/profile).
  3. `reviews`: `placeId ASC` + `createdAt DESC` (for place detail reviews sorted newest-first).
  4. `reviews`: `userId ASC` + `createdAt DESC` (for user profile reviews).
  5. `savedPlaces`: `userId ASC` + `createdAt DESC` (for user saved places list).
  In client code, in-memory sorting is additionally applied as a resilient fallback.

## Phase 3 Corrections (fixed during the Firebase Foundation pass)

- **`reports.reason` no longer includes the value `closed`.** It's renamed to
  `place-closed`. The original name read as if it were a *status* ("this report is
  closed") when it's actually describing the *place* the report is about ("this place has
  closed down") — a real ambiguity sitting right next to the actual `status` field
  (`pending` / `resolved` / `dismissed`), which could confuse both future developers
  writing rules/queries and anyone reading exported report data. `frontend/place-details.html`'s
  report form was updated to match (`value="place-closed"`), same visible label ("Place no
  longer exists").
- **Added `places.submittedByName` and `reviews.authorName`.** The original schema only
  stored `submittedBy`/`userId` (a bare uid) with no way to display a human-readable name
  without a second read of that person's `users` document. Rather than widen read access
  to the `users` collection just to support that (which would expose every user's email
  address to a broader audience than necessary), each place/review now stores a
  denormalized display name captured at write time. This keeps `firebase/firestore.rules`
  tight: `users/{uid}` stays readable only by its owner and by admins.

## Verification and admin-written fields (added by the integration)

These fields are written by `frontend/js/admin-service.js`. The security rules allow admins
to write any field on `places`, so this list is documentation, not enforcement.

| Field | Type | Written by | Meaning |
|---|---|---|---|
| `lastVerifiedAt` | timestamp | `reverifyPlace` | The date of the PHYSICAL VISIT entered by the admin, stored at local noon. It is never the time a button was pressed. |
| `verificationNote` | string (max 300) | `reverifyPlace` | What was checked at the visit. Required; never a default claim. |
| `verifiedBy` | string (uid) | `reverifyPlace` | The admin who recorded the verification. |
| `verifiedAt` | timestamp | `reverifyPlace` | When the verification was recorded in the system (server time). Distinct from `lastVerifiedAt`. |
| `approvedBy`, `approvedAt` | string, timestamp | `approvePlace` | Who approved a submission, and when. |
| `rejectedBy`, `rejectedAt`, `rejectionReason` | string, timestamp, string | `rejectPlace` | Who rejected a submission, when, and why. (Corrects an earlier wrong field name `rejectReason`.) |

Reports and reviews written by admins: `resolvedBy`, `resolvedAt`, `dismissedBy` on
`reports`; admins delete `reviews` without recording an actor.

**Limitation:** the app does not yet check that `lastVerifiedAt` is after the place was
submitted. The visit date is validated only as a real, non-future calendar date.
