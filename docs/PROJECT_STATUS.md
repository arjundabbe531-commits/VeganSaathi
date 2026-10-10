# PROJECT_STATUS.md — VeganSaathi

*Update this file at the end of every development phase. This is the single source of
truth for "where the project currently stands" — for the team and for any AI assistant
(this one, or Codex) picking the project back up.*

## Completed
- Phase 0 — Environment audit
- Phase 1 — Foundation docs
- Phase 2 — Static frontend shell (12 pages, mock data, components, Leaflet map). Verified
  with a live headless-browser pass. See `docs/PHASE_2_NOTES.md`.
- Phase 3 — Firebase Foundation: `firebase/firestore.rules`, `firebase/firestore.indexes.json`,
  `firebase.json`, `firebase-config.js`/`firebase-init.js` scaffolding, `docs/FIREBASE_SETUP.md`,
  `docs/FIREBASE_SECURITY.md`. Firebase Storage was later removed from the architecture
  entirely — this project uses Cloudinary (not yet implemented) for media instead.
- Phase 4 — Authentication + User Profile: real Firebase project (`vegansaathi-88d2f`)
  connected; registration, login, Google sign-in, password reset, logout, and a shared
  `onAuthChange` listener driving a live (no-reload) Login/Register ↔ Profile/Logout
  navbar; a real Firestore-backed Profile page; auth guards on Submit Place,
  Save/Review/Report, and Saved Places. Full detail in `docs/AUTHENTICATION.md` and
  `docs/PHASE_4_TEST_RESULTS.md`. Marked complete per commit `5cefbf5`.

## In Progress — Phase 5 (Places + Discovery)
Full approved plan: `docs/PHASE_5_PLAN.md` (decisions D1–D5 settled there).

**Done so far:**
- **Task 5.0** — docs + fieldwork prerequisites (`docs/FIELDWORK_GUIDE.md`,
  `research/place_data_template.csv`, schema finalized in `docs/DATABASE_SCHEMA.md`).
- **Task 5.1** — behavior-neutral hardening of shared components. Fixed a real bug: two
  classic scripts (`mock-data.js` and `components.js`) both declared a top-level
  `DIET_TAG_LABELS` const, which crashed every page's navbar; also closed real XSS gaps
  (unescaped place/review data reaching `innerHTML` in the Explore map popup,
  `place-details.js`'s map popup, `saved-page.js`, and the admin dashboard's tables).
- **Task 5.2** (`docs/PHASE_5_PLAN.md`'s number; the task that implemented it was labeled
  "Task 5.1c" — same deliverable, not reconciled, flagged for the team to pick one
  numbering) — `frontend/js/places-service.js`: `fetchPublishedPlaces()`,
  `fetchPlaceById(id)`, `normalizePlace()`. The single Firestore data-access layer for
  Places. Unit-tested in plain Node via a custom module-resolution hook (see
  `tests/firebase-stub-loader.mjs`) since Node can't import the `https://` CDN URLs this
  project's browser code uses.
- **Task 5.3** — Explore migrated from mock data to real Firestore data, via
  `places-service.js` only (no direct Firestore access in `explore.js`, no second
  Firebase initialization). See "Task 5.3 detail" below.
- **Task 5.4** — **Leaflet map robustness**: a real `layerGroup` replaces
  manual marker-array tracking, coordinates are revalidated against the pilot bounding box
  before a marker is created, and `invalidateSize()` fires on every List→Map switch. See
  "Task 5.4 detail" below.

**Not started:** 5.5 (Place Details on Firestore), 5.6 (Home featured places on
Firestore), 5.7 (remove remaining mock dependence from public pages), 5.8 (real fieldwork
data entry + final Phase 5 QA).

### Task 5.3 detail — Explore → Firestore

- **Data source:** `explore.js` calls `fetchPublishedPlaces()` from `places-service.js`
  exactly once per page load (no direct Firestore import, no second `initializeApp()`).
  All published places are cached client-side; search/filter/sort all run against that
  cached array — no re-querying Firestore on every keystroke or filter click.
- **States implemented:** loading (shown immediately, before the fetch resolves) → one of
  error (generic Firestore/network failures and `permission-denied` both show the same
  friendly message, with the technical detail only in `console.error`) / empty-database
  (zero published places exist at all — distinct wording from the filter-empty case) /
  listView (data loaded, proceeds to the existing filtered-results rendering, which keeps
  its own separate "no places match your filters" state for when filters exclude
  everything).
- **No mock-data fallback anywhere** in `explore.js`, including on error — confirmed by a
  dedicated test (`tests/browser/test_explore_firestore.py`, check 12) that Firestore
  failing never results in any of the old mock place names appearing on the page.
  `explore.html` no longer loads `mock-data.js` at all (removed — Explore has no use for
  it anymore); `explore.js` is now loaded as `<script type="module">`.
- **Search/filters:** unchanged behavior, now operating on real Firestore-normalized
  place objects instead of `MOCK_PLACES`.
- **Sort:** browser-side — verified places first, then most recently verified, then name.
  No Firestore `orderBy()`, no new composite index.
- **90-day freshness cue (D5):** implemented in the *shared* `renderVerificationBadge()`
  in `components.js` (not duplicated per-page), so Place Details and the admin dashboard
  will get it too once they're migrated. A verified place whose `lastVerifiedAt` is more
  than 90 days old shows a small "(re-check due)" note next to its verification badge —
  display-only; `verificationStatus` itself and the actual verified date are never changed
  or hidden. Confirmed not to alter the appearance of any existing mock-data page (none of
  the mock places' verification dates are currently >90 days old).
- **Invalid documents:** `places-service.js` already skips and warns on them;
  `explore.js` simply renders whatever valid places come back — confirmed a malformed
  document among valid ones doesn't crash the page or appear in the results.
- **Map:** received real data as a side effect of this task (it already took a `places`
  array as a parameter); the robustness work itself (`layerGroup`, coordinate
  revalidation, `invalidateSize()`) was done in Task 5.4 — see below.

**Real test-infrastructure gap closed this task:** the Phase 4 and Task 5.1b browser-test
suites had only ever existed in an unversioned scratch location — not actually committed
to this repository. "Run the existing regression suite" was, strictly, not something
anyone but the AI session that wrote them could have done. Both are now committed at
`tests/browser/test_phase4_regression.py` and `tests/browser/test_5_1b_hardening.py`,
runnable directly (`python3 tests/browser/test_phase4_regression.py`) by anyone with
Playwright installed — see `tests/browser/README.md`. Porting them also surfaced a real
correctness problem: the 5.1b suite's Explore XSS check worked by mutating `MOCK_PLACES`,
which this task's migration made irrelevant to that page — left as-is, it would have
silently stopped testing anything on Explore while still reporting PASS. It's been
corrected to inject through the Firestore stub instead (see that file's header comment).

### Task 5.4 detail — Leaflet map robustness

- **LayerGroup:** `explore.js` creates one `L.layerGroup()` (`vsMarkersLayer`), added to
  the map once in `initMapIfNeeded()`. Every re-render calls `vsMarkersLayer.clearLayers()`
  once, then adds the new set of markers via `addLayer()` — replacing the old pattern of
  tracking markers in a plain array and calling `removeLayer()` on each one individually.
- **Coordinate revalidation:** before creating a marker, `isValidMapCoordinate()` checks
  the place's latitude/longitude against the *same* `PILOT_BOUNDS` constant
  `places-service.js`'s `normalizePlace()` already validates against — exported from there
  (one-line change, no behavior change to that file) rather than duplicated as a second,
  possibly-drifting copy. A place that fails this check gets no marker (logged via
  `console.warn` with its name/id/coordinates) but is otherwise untouched — it still
  appears normally in the list view. No coordinate is ever "corrected."
- **invalidateSize():** called every time the Map view button is clicked, after the
  container's `d-none` is removed — not just the first time. This matters because Leaflet
  can report a stale or zero size for a container that was hidden via CSS in between
  switches; calling it only once (e.g. only inside the lazy `initMapIfNeeded()`) would miss
  every subsequent switch back to Map view.
- **Filter/search interaction while on Map view:** `renderResults()`'s existing
  `if (vsMap) { renderMapMarkers(results); }` guard was already in place from Task 5.3 and
  needed no changes — it now calls the new `layerGroup`-based `renderMapMarkers()`
  automatically.
- **Popup escaping:** unchanged — still `escapeHtml()` on the place name and type, and
  `placeDetailsUrl()` (which itself escapes) for the link.

- **Task 5.5** — **Place Details migrated to Firestore** via `fetchPlaceById(id)` in
  `places-service.js`. The URL `?id=` is read safely (a missing id is handled explicitly,
  not treated as a valid lookup). Every service result is handled explicitly: success
  renders; `not-found` and `invalid` show "This place isn't available"; `permission-denied`
  and generic errors show "Unable to load this place right now"; loading shows its own
  state. **No fetch-all lookup and no `MOCK_PLACES` / `MOCK_PLACES[0]` fallback** in
  `place-details.js` — the only remaining `MOCK_*` references in that file are
  `MOCK_REVIEWS` and `MOCK_SAVED_PLACES`, deliberately kept as the Phase 6 UI shell.
  Image label uses the shared `placeImageLabel()` helper; no `imageLabel` field was added
  to the Firestore schema. Escaping, the verification badge and last-verified date, and the
  Leaflet detail map (fed by the normalized, pilot-bounds-validated coordinates) are all
  preserved. Missing/invalid coordinates and missing optional fields do not crash the page.
  Test results and what they do and don't prove are under "Test Status" below.

## Not Started
- Phase 5 Tasks 5.5–5.8 (see above).
- Phase 6 — Community features (submit place, reviews, reports, saved places wired to
  Firestore for real; Cloudinary image upload).
- Phase 7 — Admin backend (real permission checks, moderation actions; admin-aware navbar
  item; route protection for `admin/dashboard.html` — none of this exists yet, it's a
  static shell with mock data and no auth check at all).
- Phase 8 — Vegan awareness content sourcing/citation review.
- Phase 9 — QA pass, `docs/TEST_PLAN.md`.
- Profile editing (name/diet preference are currently read-only after registration).
- Firebase Hosting deployment.

## Known limitations (Task 5.5)
- Place Details' Reviews section and Save/Report/Review controls are still local demo data
  and demo messages, deliberately preserved as the Phase 6 UI shell. A real Firestore place
  will simply show "no reviews yet" and "not saved" honestly; nothing is fabricated.
- Real-project verification is still outstanding: load `place-details.html?id=<real id>`
  against `vegansaathi-88d2f` in a real browser, confirm a published place renders and an
  unknown id shows "isn't available", and confirm `firebase/firestore.rules` is deployed
  (a drift there would show "Unable to load" for every visitor).
- The pilot coordinate box (`PILOT_BOUNDS`) is an assumption, not fieldwork-confirmed.

## Known Bugs
None outstanding in Explore or the shared components touched this task. Phase 4's own
known-issues list (real-browser verification against the live Firebase project — see
`docs/PHASE_4_TEST_RESULTS.md`) is unchanged by this task.

## Firebase Setup State
- Real project (`vegansaathi-88d2f`) connected, real config in `firebase-config.js`.
- `firebase/firestore.rules` unchanged by Task 5.3 — the places-read rule already matched
  what `fetchPublishedPlaces()`'s `where("status", "==", "published")` query needs.
- Still worth confirming directly in the Firebase Console: that the deployed rules
  actually match this repository's `firebase/firestore.rules` (Firestore denies by default
  until rules are deployed, and a drift here would make Explore fail with
  `permission-denied` for every real visitor even though the code is correct).
- No Firebase Storage anywhere in the codebase.

## Test Status
**Task 5.5 (Place Details → Firestore), exact results from this session:**
- `tests/browser/test_place_details_firestore.py` — **41 passed, 0 failed.** Stubbed
  Firestore + headless browser; covers valid render, correct id requested, unknown/missing
  id, invalid document, permission-denied, generic error, no fallback, escaping, verified
  and unverified badges, map marker creation, out-of-bounds and missing coordinates, and
  missing optional fields.
- Regressions run after 5.5: `test_5_4_map_robustness.py` 16/16 PASS;
  `test_explore_firestore.py` 28/28 PASS; `test_phase4_regression.py` 38/38 PASS;
  `test_5_1b_hardening.py` 17/17 PASS; `tests/test-places-service.mjs` 22/22 PASS (Node,
  stubbed SDK); `tests/check-duplicate-globals.js` PASS (12 pages); `node --check` on the
  changed and shared JS files: OK.
- **Test type, stated plainly:** all of the above are *stubbed/automated* tests (a
  stubbed Firestore SDK and Leaflet in a headless Chromium, or stubbed SDK in Node).
  **No real browser session against the live `vegansaathi-88d2f` project was performed,
  and no real Firestore read/write was made.** Real-project verification remains a manual
  step (see "Known limitations").

**Earlier results (Tasks 5.1–5.4), retained:**
- **Task 5.4:** `tests/browser/test_5_4_map_robustness.py` — 16/16 pass, covering all 12
  required scenarios (several split into sub-assertions). Notably confirms
  `clearLayers()` fires on every re-render (not just once), `invalidateSize()` fires on
  every List→Map switch specifically (checked across 3 repeated switches, not just the
  first), an out-of-pilot-bounds coordinate is skipped without any uncaught error while
  the remaining valid places still get markers, and a malicious place name in a popup
  renders as escaped text, not live markup.
- **Task 5.3:** `tests/browser/test_explore_firestore.py` — 28/28 pass (unaffected by this
  task, re-confirmed).
- **Full regression, re-run after Task 5.4's changes:**
  `tests/browser/test_phase4_regression.py` — 38/38 pass (including place-details.html's
  own, separate, untouched map — confirms the shared Leaflet test stub's extension for
  Task 5.4 didn't break the older direct `marker().addTo(map)` pattern that file still
  uses). `tests/browser/test_5_1b_hardening.py` — 17/17 pass.
  `tests/check-duplicate-globals.js` — clean, 12/12 pages. `tests/test-places-service.mjs`
  — 22/22 pass (re-confirmed after exporting `PILOT_BOUNDS`, a no-op change to that file's
  actual behavior). `node --check` on every JS/MJS file in the project, and the HTML
  tag-balance/local-link-resolution checks — all clean.
- **Still not possible from this sandbox:** a real-browser run against the actual
  `vegansaathi-88d2f` Firestore (no outbound network access here) — all of the above uses
  a stub Firestore SDK matching the real one's exact call signatures, not the real
  backend. See `docs/PHASE_4_TEST_RESULTS.md` for the same caveat as it applies to Auth.

## Documentation Status
- Phase 1–4 docs: complete.
- Phase 5: `docs/PHASE_5_PLAN.md`, `docs/DATABASE_SCHEMA.md`, `docs/FIELDWORK_GUIDE.md`,
  `research/place_data_template.csv` all in place. `docs/DEVELOPMENT_PLAN.md` updated with
  Task 5.3 and 5.4's status. `tests/browser/README.md` documents how to run every browser
  suite.
- Still not created: `docs/COMMUNITY_SURVEY.md`, `docs/TEST_PLAN.md` — scheduled later.

## Next Task
Task 5.6 — Home (index.html) featured places on Firestore. (Task 5.5 is complete; the
previous next-task note below is superseded.)

(Superseded, retained for history) Task 5.5 — Place Details on Firestore: replace `place-details.js`'s `MOCK_PLACES`/
`MOCK_REVIEWS` lookup with `fetchPlaceById()` from `places-service.js`, including a
genuine not-found state (no falling back to the first mock place for an unknown id, which
is what the current mock-data implementation still does).
