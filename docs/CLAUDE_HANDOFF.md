# CLAUDE_HANDOFF.md — VeganSaathi

*Prepared: 2026-10-13 by Antigravity (Google Deepmind). This document is the entry point
for any independent reviewer (human or AI) taking over this project after Antigravity's
local development pass. Read this before touching anything else.*

---

## 1. What This Project Is

**VeganSaathi — Connecting People. Promoting Veganism.**

A Community Engagement Project (CEP) built by 3rd-semester B.E. Information Technology
students at SSGMCE, Shegaon (affiliated to SGBAU). It is a vegan-friendly food-discovery
and awareness platform focused on the SSGMCE campus and nearby Shegaon — a small town
underserved by major food apps.

**Not** a generic food-delivery app. **Not** a copy of Zomato. Its core differentiators:
- India's real four-level dietary taxonomy (vegan / vegetarian / eggetarian / Jain)
- Coverage of hostel messes, dhabas, and small local eateries
- A genuine "last physically verified" trust layer — the app is honest that a listing
  was checked by a real person on a specific date, and shows that date prominently
- Community place submission with admin approval workflow
- Fieldwork-backed seed data (no fabricated entries; see `docs/FIELDWORK_GUIDE.md`)

---

## 2. Project State When Handed Off

### Phase completion

| Phase | Description | Status |
|---|---|---|
| 0 | Environment audit | ✅ Complete |
| 1 | Product & architecture docs | ✅ Complete |
| 2 | Static frontend shell (mock data, 12 pages) | ✅ Complete |
| 3 | Firebase project setup, security rules, indexes | ✅ Complete (live project `vegansaathi-88d2f`) |
| 4 | Authentication (register, login, Google, password reset, logout, guards) | ✅ Complete |
| 5 | Places & Discovery (Explore, Place Details, map, Home live) | ✅ Complete |
| 6 | Community features (submit, reviews, reports, saved places, profile) | ✅ Complete |
| 7 | Admin dashboard & moderation (submissions, re-verify, reports, reviews) | ✅ Complete |
| 8 | Vegan awareness content (6 pages, sourced, disclaimers) | ✅ Complete |
| 9 | QA pass — 278 automated tests passing, 0 failing | ✅ Complete (automated) |

### What "complete" means here

"Complete" means the **code is written and passing all automated tests** with a local
offline stub in place of a live Firebase connection. The following are **not** complete
and require a real Firebase deployment to verify:

- Live email/password auth against `vegansaathi-88d2f`
- Google OAuth sign-in
- Firestore security rule enforcement on real writes
- Community submission → admin approval end-to-end (live)
- Seed data entered via the Firebase Console (fieldwork data — awaits fieldwork)
- Cloudinary image upload (deferred to a later phase — not implemented)
- Password reset email delivery

See `docs/TEST_RESULTS.md` §5 for the full list of what is *not* automated and why.

---

## 3. File Map — What to Read First

```
VeganSaathi-main/
├── README.md                         ← Start here for a project overview
├── docs/
│   ├── PROJECT_SPEC.md               ← Problem statement, objectives, what this is NOT
│   ├── DATABASE_SCHEMA.md            ← Firestore collections, fields, enums, rules
│   ├── TECHNICAL_ARCHITECTURE.md     ← Stack, folder structure, security model
│   ├── DEVELOPMENT_PLAN.md           ← Phased build log — what was done and why
│   ├── USER_FLOWS.md                 ← 9 key user journeys
│   ├── UI_PLAN.md                    ← Visual direction, page list, nav, responsive rules
│   ├── FIELDWORK_GUIDE.md            ← How team fieldwork data becomes Firestore docs
│   ├── CEP_REQUIREMENTS.md           ← Community engagement evidence requirements
│   ├── COMMUNITY_SURVEY.md           ← Survey questions (must be run with real respondents)
│   ├── FIREBASE_SETUP.md             ← How to connect to the real Firebase project
│   ├── FIREBASE_SECURITY.md          ← Security model deep dive
│   ├── TEST_RESULTS.md               ← All test results, re-run commands, gaps
│   └── PROJECT_STATUS.md             ← Phase-by-phase completion tracker
├── firebase/
│   ├── firestore.rules               ← Full Firestore security rules
│   └── firestore.indexes.json        ← Composite indexes
├── firebase.json                     ← Firebase CLI entry config (root-level)
├── frontend/
│   ├── index.html                    ← Home page (live Firestore)
│   ├── explore.html                  ← Explore page (live Firestore + Leaflet)
│   ├── place-details.html            ← Place detail (live Firestore)
│   ├── submit-place.html             ← Community submission (live Firestore)
│   ├── profile.html                  ← User profile (live Firestore)
│   ├── saved.html                    ← Saved places (live Firestore)
│   ├── login.html / register.html    ← Auth pages
│   ├── awareness/                    ← 6 vegan awareness pages (static, sourced)
│   ├── admin/dashboard.html          ← Admin dashboard (live Firestore, role-gated)
│   ├── css/styles.css                ← All custom styles
│   └── js/                           ← All JavaScript (see §4 below)
├── tests/
│   ├── test-places-service.mjs       ← 35 places-service unit tests (Node ESM)
│   ├── test-admin-service.mjs        ← 16 admin-service unit tests (Node ESM)
│   ├── check-duplicate-globals.js    ← Static: no duplicate top-level globals
│   └── browser/                      ← 7 Playwright browser test suites
└── research/
    └── place_data_template.csv       ← Fieldwork CSV template (headers only)
```

---

## 4. JavaScript Architecture

Every page loads `app.js` as `<script type="module">`. Classic scripts (`components.js`,
`mock-data.js`) load before it so their globals are available.

| File | Role |
|---|---|
| `firebase-config.js` | Public Firebase client config — safe to ship, not a secret |
| `firebase-init.js` | **The only** `initializeApp()` call. Exports `getFirebaseAuth()` / `getFirebaseDb()` |
| `auth-state.js` | **The one** `onAuthStateChanged` subscription. Exports `getCurrentUser()` / `fetchUserProfile()` |
| `auth-ui.js` | Register, login, Google sign-in, password reset, logout |
| `app.js` | Navbar/footer injection, auth subscription, Logout wiring — on every page |
| `components.js` | Navbar, footer, place card, diet badge, verification badge, awareness sub-nav |
| `places-service.js` | All Firestore data access for places, reviews, reports, saved places |
| `admin-service.js` | All admin Firestore operations — every function calls `checkIsAdmin()` first |
| `explore.js` | Explore page controller — calls `places-service.js`, manages `vsMarkersLayer` |
| `place-details.js` | Place Details controller — reviews, reports, save/unsave, auth-gated |
| `submit-place-guard.js` | Submit form — Leaflet picker, `PILOT_BOUNDS` validation, Firestore write |
| `profile-page.js` | Profile page — user's submissions and reviews from Firestore |
| `saved-page.js` | Saved Places page — `getSavedPlaces()` from Firestore |
| `admin-dashboard.js` | Admin Dashboard controller — calls `admin-service.js` for all actions |
| `mock-data.js` | **DEV ONLY** — clearly labeled `[MOCK]` in every place name; must be removed before live CEP demo |

---

## 5. Key Design Decisions (things that might look wrong but are intentional)

### D1 — No mock fallback in production pages
`fetchPublishedPlaces()` and `fetchPlaceById()` return an error state when Firestore
is unavailable — they do **not** silently fall back to `MOCK_PLACES`. This is
intentional: a silent mock fallback would let the app appear to work in production
while serving fake data, defeating the whole point of a verified listing system.

### D2 — `mock-data.js` is still in the repository
It's used by test suites that run without a live Firebase. Every mock place name is
prefixed `[MOCK]` to make it impossible to mistake for real data. Before the live CEP
demo it must be removed (or at minimum excluded from all production pages — it is not
loaded by any page in production mode, only by the stubs).

### D3 — `source` field strictly enforced by Firestore rules
Community submissions must have `source: "community"`. Team-seeded places (entered
directly in the Firebase Console) have `source: "fieldwork"`. The security rules
prevent a community user from setting `source: "fieldwork"` or from spoofing
`verificationStatus`. This distinction powers the CEP metrics.

### D4 — `users/{uid}` is readable only by owner + admin
Display names for places and reviews are stored as **denormalized copies** at write
time (`submittedByName` on places, `authorName` on reviews). This allows the UI to
show "submitted by X" without granting wider read access to the `users` collection —
see `docs/FIREBASE_SECURITY.md` for the full reasoning.

### D5 — 90-day re-check-due cue is display-only
When `lastVerifiedAt` is more than 90 days ago, `renderVerificationBadge()` in
`components.js` shows a soft "re-check due" visual cue. This **never** writes to
Firestore and never changes `verificationStatus`. Only a real admin after a real
physical visit does that.

### D6 — Coordinates validated against `PILOT_BOUNDS`
All places must have `latitude` in [20.70, 20.90] and `longitude` in [76.55, 76.80].
This prevents latitude/longitude swap errors (a very common fieldwork mistake —
Shegaon's real coords look like `20.xxx, 76.xxx`, never `76.xxx, 20.xxx`). Enforced
both client-side (`places-service.js` exports `PILOT_BOUNDS`) and in Firestore rules.

### D7 — Firebase Storage is deliberately NOT used
Media uploads will use Cloudinary in a later phase. Using Firebase Storage would
require the Blaze (paid) plan. Nothing in this codebase imports or references Firebase
Storage — `firebase-init.js` exports only Auth and Firestore, and `firebase.json` has
no `storage` section.

---

## 6. Testing Infrastructure

### How to re-run all tests

```powershell
# From the project root: d:\VeganSaathi-main\VeganSaathi-main
# For browser tests, the venv python and PLAYWRIGHT_BROWSERS_PATH are required:
$env:PLAYWRIGHT_BROWSERS_PATH = "D:\VeganSaathi-Playwright-Browsers"

# Unit tests (no browser, no network)
node tests/test-places-service.mjs          # expect: 35 passed, 0 failed
node tests/test-admin-service.mjs           # expect: 16 passed, 0 failed

# Static analysis
node tests/check-duplicate-globals.js       # expect: PASS (15 pages)
Get-ChildItem frontend/js/*.js,tests/*.mjs | ForEach-Object { node --check $_.FullName }
                                             # expect: no output = all clean

# Browser tests (requires Playwright Chromium installed in venv)
.\.venv\Scripts\python.exe -u tests/browser/test_phase4_regression.py      # 38 tests
.\.venv\Scripts\python.exe -u tests/browser/test_5_1b_hardening.py         # 17 tests
.\.venv\Scripts\python.exe -u tests/browser/test_explore_firestore.py      # 28 tests
.\.venv\Scripts\python.exe -u tests/browser/test_5_4_map_robustness.py     # 16 tests
.\.venv\Scripts\python.exe -u tests/browser/test_place_details_firestore.py # 41 tests
.\.venv\Scripts\python.exe -u tests/browser/test_admin_dashboard.py         # 21 tests
.\.venv\Scripts\python.exe -u tests/browser/test_awareness_content.py       # 66 tests
```

**Total verified on 2026-10-13:** 278 passed, 0 failed.

### How browser tests work (important for understanding stub setup)

All browser tests:
1. Start a local `http.server` on a random port serving `frontend/`.
2. Route CDN requests (Bootstrap, Leaflet, Firebase SDK) to offline stubs in
   `tests/browser/stub-assets/`.
3. Inject a Firestore/Auth stub that mimics Firebase's JavaScript SDK surface.
4. Run entirely headlessly — no outbound network access.

This means the browser tests are NOT testing a live Firebase connection. They are testing
the JavaScript logic, DOM rendering, state transitions, and user interaction flows.

---

## 7. What Still Needs to Happen (pre-launch checklist)

These are the items that Antigravity could NOT complete because they require real-world
actions (physical fieldwork, live Firebase, real accounts):

### Fieldwork & Data (CRITICAL for CEP validity)
- [ ] Conduct survey (see `docs/COMMUNITY_SURVEY.md`) — target 100–150 respondents
- [ ] Conduct 8–15 short interviews (student + vendor)
- [ ] Make real site visits to SSGMCE campus + Shegaon eateries (15–30 places)
- [ ] Apply `docs/FIELDWORK_GUIDE.md` checklist for every visited place
- [ ] Enter verified places in Firebase Console with correct field types
- [ ] Double-check each entry before setting `status: "published"`
- [ ] Confirm no `[TEST — DELETE]` documents remain before any demo

### Firebase Live Verification
- [ ] Register a real test account at `vegansaathi-88d2f`
- [ ] Verify registration, login, Google sign-in, password reset email delivery
- [ ] Submit a test community place and verify it stays `status: "pending"`
- [ ] Log in as admin, approve the test place, verify it appears on Explore
- [ ] Verify a non-admin user cannot reach `admin/dashboard.html` or execute writes
- [ ] Run `firebase deploy` and confirm hosting serve is correct
- [ ] Test Rules Playground or manual security rule verification

### Documentation
- [ ] Fill in real numbers in `docs/COMMUNITY_SURVEY.md`'s results table (after survey)
- [ ] Fill in real numbers in `docs/CEP_REQUIREMENTS.md`'s impact metrics
- [ ] If team has a faculty supervisor or ethics review, document it in `CEP_REQUIREMENTS.md`

---

## 8. What Claude Should Look At

Claude is invited to review anything — there are no off-limits areas. Specific things
worth your attention:

1. **`firebase/firestore.rules`** — This is the real security boundary. Check:
   - Admin role verification uses server-side `get()` on `users/{uid}`, not a client-sent claim
   - `source` field is enforced client → server correctly
   - Community submissions cannot set `verificationStatus: "verified"` directly
   - Reports can only be created by authenticated users (not public)

2. **`frontend/js/places-service.js` and `admin-service.js`** — Check:
   - `normalizePlace()` covers all the edge cases a bad Firebase Console entry could create
   - `PILOT_BOUNDS` is exported correctly and re-used (not duplicated) in `explore.js`
   - `checkIsAdmin()` can't be bypassed (it reads Firestore server-side, not a client cookie)

3. **`tests/browser/common.py`** — The shared stub infrastructure. Understanding this is
   key to understanding why the browser tests pass without a live Firebase.

4. **`frontend/awareness/*.html`** — Check:
   - `vs-disclaimer-box` is present and says "educational, not medical advice"
   - `vs-reference-card` cites real, checkable sources (not invented)
   - No medical claims, no health promises, no "veganism cures X"

5. **`docs/FIELDWORK_GUIDE.md`** — Check that the ethics rules are actually enforceable
   in practice and that the "what verified means" section is unambiguous.

6. **`mock-data.js` coupling** — Verify that `[MOCK]` places could not accidentally appear
   on a production page if someone makes an error loading scripts.

---

## 9. Contacts, Project IDs, and Environment

| Item | Value |
|---|---|
| Firebase project ID | `vegansaathi-88d2f` |
| Firebase project name | VeganSaathi |
| Firestore pilot area (Shegaon) | lat 20.70–20.90, lon 76.55–76.80 |
| Institution | SSGMCE, Shegaon (SGBAU) |
| Course | B.E. Information Technology, Semester 3 |
| Playwright browsers path (local) | `D:\VeganSaathi-Playwright-Browsers` |
| Python venv | `.venv\Scripts\python.exe` (in project root) |
| Node version | v22 |

The Firebase client config in `firebase-config.js` contains real values for the
`vegansaathi-88d2f` project. This is intentional and safe — it's a public client
identifier, not a secret. See `TECHNICAL_ARCHITECTURE.md` §4 and `FIREBASE_SECURITY.md`.

---

## 10. A Note on Honesty

Every design decision, test, and document in this project was written with one rule:
**do not fabricate**. No invented field research, no made-up place counts, no
test results that were not actually run. Where something was not yet done (fieldwork,
live Firebase verification), it is documented as "not yet done" — not claimed as complete.

`docs/CEP_REQUIREMENTS.md` says it plainly: "An honest 'we collected X so far' is
stronger evidence of genuine engagement than an invented total."

Claude: if you find anything in this codebase that contradicts that rule — a claim that
something works without evidence, a fabricated place or survey result, or a test that
passes by mocking itself — please flag it. That matters more than any code quality issue.
