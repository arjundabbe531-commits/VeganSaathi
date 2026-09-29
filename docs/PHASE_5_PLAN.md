# PHASE_5_PLAN.md — Real Places + Discovery

**Status:** Approved by the project team. Decisions D1–D5 below are settled.
**Scope:** Move Explore, Place Details, Home's featured places and the map from mock data to
real Firestore data, for the SSGMCE + hostel/mess/canteen + nearby Shegaon pilot.
**Not in scope:** community writes (Phase 6), Cloudinary uploads (Phase 6), admin
moderation (Phase 7), "near me" geolocation, fuzzy search, pagination, marker clustering.

## Approved decisions

| ID | Decision | Outcome |
|---|---|---|
| D1 | How team-seeded places are entered | Through the **Firebase Console**, by hand. No import code, no rule change. Revisit an admin import page in Phase 7. |
| D2 | Document IDs | **Readable, stable slugs** for team-seeded places (e.g. `ssgmce-main-canteen`); never renamed once created, because reviews and reports will reference them. Community submissions use auto-generated IDs later. |
| D3 | Saved page in Phase 5 | An **honest empty state** for signed-in users. No mock places on any public page. Real Saved Places belongs to Phase 6. |
| D4 | New optional schema fields | `area`, `dietNotes`, `openingInfo`, `verificationNote`, `source`. See `docs/DATABASE_SCHEMA.md`. |
| D5 | Freshness cue | **90 days**, used only as a soft "re-check due" cue in the UI. It must **never** automatically change `verificationStatus`. The absolute date is always shown. |

## Key architecture choices

1. **Fetch all published places in one query and filter in the browser.** The pilot is
   15–30 places. This needs no new indexes, allows substring search, and avoids Firestore's
   query limits (no `array-contains-all`, no full-text search).
2. **One data-access module (`places-service.js`)** returns the same object shape the mock
   data uses today, so UI code changes are small.
3. **Do not add `orderBy` to the query.** `where("status","==","published")` plus
   `orderBy("name")` would require a composite index and fail at runtime. Sort in the
   browser: verified first, then most recently verified, then name.
4. **Every list query must include `where("status","==","published")`.** Firestore rules are
   not filters — a list query without it is rejected for visitors.
5. **Diet tags mean "the team confirmed at least one real meal option meets this
   definition."** Tag every category that applies (a vegan place gets `vegan` **and**
   `vegetarian`). The code performs no implicit inference. Nuance lives in `dietNotes`.

## Task sequence

| Task | Work | Exit check |
|---|---|---|
| 5.0 | Docs + fieldwork prerequisites: this plan, `FIELDWORK_GUIDE.md`, `research/place_data_template.csv`, schema update | Team agrees on field definitions |
| **5.1** | **Behaviour-neutral hardening of shared components** (see below) | Suite still passes; no visual change |
| 5.2 | `places-service.js`: `fetchPublishedPlaces()`, `fetchPlaceById()`, `normalizePlace()` + unit tests | Bad docs are skipped with a warning, never crash the page |
| 5.3 | Explore on Firestore: loading, empty-database, no-results and error states; 90-day soft cue | Filters behave exactly as they do today |
| 5.4 | Leaflet map from real data (`layerGroup`, coordinate validation, `invalidateSize()`) | Pins match the list |
| 5.5 | Place Details on Firestore: not-found state, **no mock fallback** | An unknown/unpublished id shows "not available" |
| 5.6 | Home featured places on Firestore, with an honest empty state | Works with 0, 1 and many places |
| 5.7 | Remove mock dependence from public pages; Saved empty state (D3); replace the "mock data" dev notices | No `MOCK_` on any public page |
| 5.8 | Enter real data, run the incognito-visitor rules test and the QA checklist, update docs | Phase 5 exit test in `DEVELOPMENT_PLAN.md` passes |

### Task 5.1 — shared-component hardening (first coding task)

- Move `DIET_TAG_LABELS` out of `mock-data.js` into `components.js` (it is real config, and
  `renderDietBadges` depends on it — removing `mock-data.js` from a page would otherwise
  silently break every diet badge).
- Add `escapeHtml()` and `formatDate()`.
- Escape dynamic place/review/popup text that is inserted through `innerHTML`.
- Add safe fallbacks for a missing image, area and price.
- Encode place ids in every generated link.
- **Acceptance:** no intended visual change; all existing Phase 4 tests still pass; two new
  regression checks (a name containing `<b>` renders as literal text; diet badges render on
  a page that does not load `mock-data.js`); no Firestore, Cloudinary, community-write or
  admin work.

## Firestore queries, indexes and rules

| Query | Index needed? |
|---|---|
| `where("status","==","published")` | No (single field, automatic) |
| `getDoc(places/{id})` | No |

The composite index already in `firestore.indexes.json` (`status` + `dietTags`
array-contains) is not used by this design. It is harmless and is kept as reserved for a
possible future server-side query.

**Rules considerations**

1. Reads work as written provided every list query includes the `status` filter. A visitor
   reading an unpublished document receives `permission-denied`; the UI treats that the same
   as "not found".
2. Console writes bypass security rules, so a typo (`"Vegan"`, a string where an array is
   expected) will not be caught by the database. `normalizePlace()` is the safety net.
3. **Privacy note for Phase 6.** Rules work per document, so `submittedBy` and
   `submittedByName` are publicly readable on published places. Acceptable for team-seeded
   data (the team consents). Before community submissions exist, decide whether to store
   submitter names at all.
4. **Phase 6 rule tightening** (not done now, because no client writes places yet): pin
   `source == "community"` on user creates; validate `priceRange`, coordinate types/ranges
   and string lengths.

## Testing plan

- **Unit tests** for `normalizePlace()`: valid, missing field, wrong type, unknown tag,
  swapped coordinates, Timestamp input.
- **Stubbed-browser suite** (same method as Phase 4), with the Firestore stub extended for
  `collection`, `query`, `where`, `getDocs`. Cases: loading, empty database, filters
  excluding everything, fetch error, permission-denied, invalid docs skipped, unknown id,
  map opened before and after data loads.
- **Real-Firebase manual checks:** load Explore and Place Details **signed out in an
  incognito window** (the most important rules test); confirm a `pending` document never
  appears; use the Console Rules Playground to confirm a visitor cannot read a pending
  document.
- **Regression:** the full existing suite after every task.
- **Data QA checklist:** every published place has valid coordinates, valid tags and a real
  visit date, and no `[TEST]` documents remain.

## Fieldwork and data prerequisites

Created in Task 5.0: `docs/FIELDWORK_GUIDE.md` and `research/place_data_template.csv`
(headers only, deliberately no example row, so a fake row cannot be imported by accident).

- The spreadsheet is the fieldwork ledger. Its columns are marked either "→ Firestore" or
  "sheet only". Visit dates, visitor names, vendor consent and contact notes stay in the
  sheet only, so no vendor personal data reaches a public database.
- **Do not fabricate places.** The first real records should come from a short campus
  visit (3 places is enough to start testing). If code is ready before real data is, use a
  single clearly named `[TEST — DELETE]` document and add "no `[TEST]` documents remain" to
  the Phase 9 checklist.

## Risks and likely bugs

1. Swapped latitude/longitude puts a pin in the wrong country → validate against a pilot
   bounding box, warn, skip only the marker.
2. A Leaflet map initialised or shown while hidden renders mis-sized → call `invalidateSize()`
   whenever the map view is shown.
3. The map is opened before the async fetch finishes → re-render markers when data arrives.
4. A Firestore `Timestamp` printed raw shows `[object Object]` → convert with `.toDate()`.
5. A missing `priceRange` must show "Price not listed" and be excluded only when a price
   filter is active.
6. Two different empty states are needed: "no places yet" (empty database) versus "no
   matches" (filters exclude everything).
7. A missing composite index fails at runtime → avoided by not using `orderBy`.
8. Unescaped text → addressed in Task 5.1, and most important once Phase 6 data flows through.
9. Mock data left loaded on a public build → guarded by the Task 5.7 grep.
10. Read volume (~30 reads per Home/Explore load) is fine on the Spark plan; no caching in
    the first pass.
