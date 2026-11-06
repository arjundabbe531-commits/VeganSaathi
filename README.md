# VeganSaathi

**Connecting People. Promoting Veganism.**

An independent, community-driven vegan discovery and awareness platform for Maharashtra and beyond.

## Problem Statement

Existing food-discovery apps use a crude veg/non-veg binary and cover mainly restaurants in
big cities, leaving local eateries, student messes, and the vegan/vegetarian/eggetarian/Jain
distinction underserved. See `docs/PROJECT_SPEC.md` for the full problem statement and supporting research.

## Objectives

1. Help users discover vegan-friendly and relevant food places across Maharashtra and India.
2. Let the community contribute new places and information.
3. Provide a "last verified" trust mechanism.
4. Let users report outdated/incorrect information.
5. Promote vegan awareness through credible, clearly-sourced content.
6. Build a foundation that could expand later without a rebuild.

## Features (v1 / MVP)

- Firebase Authentication (email/password + Google)
- Dietary profile (vegan / vegetarian / eggetarian / Jain)
- Place discovery — list + map (Leaflet/OpenStreetMap) with search and filters
- Place Details with diet badges and "last verified" trust indicator
- Community place submission → admin approval workflow
- Reviews and "Report Incorrect Information"
- Saved places
- Admin dashboard (approve/reject places, resolve reports, moderate reviews, re-verify)
- Vegan awareness content pages

## Technology Stack

- **Frontend:** HTML5, CSS3, vanilla JavaScript, Bootstrap
- **Map:** Leaflet.js + OpenStreetMap
- **Backend-as-a-Service:** Firebase (Authentication, Firestore, Hosting)
- **Media storage:** Cloudinary (planned for a later phase — place/review photos; not yet implemented)
- No custom server, no separate database engine, no unnecessary frameworks.

## Architecture

See `docs/TECHNICAL_ARCHITECTURE.md` for the full system diagram and folder layout.

## Folder Structure

```
VeganSaathi/
├── docs/        → project specification, schema, architecture, plans, status
├── research/    → fieldwork templates, survey drafts, master research package
├── scripts/     → offline validation and data pipeline tools (validate-import.mjs)
├── frontend/    → HTML/CSS/JS source
├── backend/     → reserved (Cloud Functions only if strictly needed)
├── firebase/    → firebase.json, security rules, indexes
├── tests/       → unit and browser test suites
└── assets/      → images/icons
```

## Local Development (once Phase 3 is complete)

1. Install the Firebase CLI: `npm install -g firebase-tools`
2. `firebase login`
3. `firebase init` (select Hosting, Firestore — use existing project config in
   `firebase/`)
4. Serve locally: `firebase emulators:start` or open `frontend/index.html` directly for
   static-only testing.
5. Deploy: `firebase deploy`

**Never commit** `firebase/` secrets, `.env` files, or API keys that must remain private.
The Firebase client config itself (project ID, public API key) is safe to include in
frontend source — see `docs/TECHNICAL_ARCHITECTURE.md` §4 for why.

## Testing

See `docs/TEST_RESULTS.md` for the canonical, up-to-date test count and suite-by-suite
results. The figures there supersede any number quoted elsewhere, including older text in
other docs — this project has been built across several sessions and tools, and test counts
have changed as suites were added; `TEST_RESULTS.md` is the one place to trust.

**Everything below runs locally, with no live Firebase project or network access needed,
except the Firestore Emulator step, which needs Java and the Firebase CLI.**

```bash
# Node unit tests, duplicate-global check, and the rules-fixture static check:
# On Windows PowerShell:
powershell -ExecutionPolicy Bypass -File tests/run_all.ps1

# On Linux, macOS, or Git Bash:
bash tests/run_all.sh

# Individual Node unit test suites:
node tests/test-places-service.mjs
node tests/test-admin-service.mjs
node tests/test-geolocation.mjs
node tests/test-import-validator.mjs
node tests/test-cloudinary-service.mjs
node tests/test-controlled-integration.mjs

# Offline Research Import Validator:
node scripts/validate-import.mjs tests/fixtures/sample_research_places.csv --report research/sample_validation_report.json

# Offline Admin Research Reviewer (Sandbox):
# Open frontend/admin/import-review.html in any browser.
```

Firestore security-rules tests run separately, against the **Firestore Emulator** (they
exercise the real rules engine, not a stub):

```powershell
npm install -g firebase-tools
cd tests\rules
npm install
cd ..\..
firebase emulators:exec --only firestore --project vegansaathi-rules-test "node --test tests/rules/firestore.rules.test.mjs"
```

See `tests/rules/README.md` for the full setup and for the separate "proposed changes" suite
(`firestore.rules.proposed.test.mjs`), which is expected to fail until the hardening changes
in `docs/FIREBASE_SECURITY.md` are actually applied.

**What is and isn't verified by these tests:** `tests/run_all.sh` proves application logic
and rendering against stubbed services. The emulator suite proves the rules file's actual
behaviour. Neither proves the live Firebase project works — that needs a manual pass with
a real account, documented in `docs/PROJECT_STATUS.md`.

## Community Engagement & Fieldwork

Community fieldwork, surveys, place discovery, and the verification workflow are
documented in `docs/FIELDWORK_GUIDE.md` and `docs/CEP_REQUIREMENTS.md`.

## Current Status

See `docs/PROJECT_STATUS.md` for what's built, in progress, and blocked.

## Future Scope (explicitly deferred, not v1)

Dish-level tagging, Marathi/Hindi dietary phrase-card generator, a curated ingredient
decoder, an event/RSVP dietary-headcount tool, and enhanced server-side geolocation radius queries.
