# VeganSaathi

**Connecting People. Promoting Veganism.**

An independent, community-driven vegan discovery and awareness platform for Maharashtra and beyond.

## Problem Statement

Existing food-discovery apps rely on crude "pure veg" or generic "veg/non-veg" filters, making it difficult to find genuine vegan food. Hidden dairy (ghee, butter, paneer, milk solids, curd) is widespread in Indian dining, leaving plant-based eaters with few reliable resources to verify what is actually vegan. Most directories also overlook regional cities, towns, and everyday eateries, lacking credible, evidence-backed verification.

## Objectives

1. **Vegan-First Discovery:** Help users discover 100% vegan dining spots and eateries with verified, distinct vegan options across Maharashtra and India.
2. **Evidence-Based Verification:** Provide a transparent trust mechanism that distinguishes physical visits, menu audits, and owner confirmations from unverified claims.
3. **Plant-Based Awareness:** Offer evidence-backed educational content on vegan nutrition, Indian plant-based swaps, and common misconceptions.
4. **Community Contributions:** Empower community members to submit new vegan places, upload verified photos, and report inaccurate information.
5. **Transparency & Open Data:** Build a trustworthy, rights-cleared discovery directory maintained under strict data hygiene.

## Features (v1 / MVP)

- **Firebase Authentication:** Email/password and persistent sessions
- **Dietary Profile:** Customized preference management (vegan, vegetarian, eggetarian, Jain)
- **Place Discovery:** Interactive map (Leaflet.js + OpenStreetMap) with location names, city filtering, and live GPS proximity (< 15 km, < 50 km)
- **Verified Place Details:** Authentic venue photography, GPS coordinates, area addresses, verified dietary tags, and direct share/directions actions
- **Indian Ingredient & Additives Compass:** Interactive searchable guide ("Can I Eat This? / आहार मार्गदर्शक") covering 16+ common Indian food additives with Marathi communication phrases
- **Bilingual Conscious Dining Card:** Quick-copy zero-dairy dietary request cards in Marathi (*मराठी संवाद*) and English
- **Community Submissions:** Authenticated community place suggestions with client-side image compression and Cloudinary media uploads
- **Visual Admin Dashboard:** Essential moderation queue, live analytics with CSS charts, and evidence-linked verification
- **Vegan Awareness Hub:** Evidence-backed nutritional guides, philosophical insights from Maharashtrian saints, and common misconceptions debunked
- **Responsive & Accessible Design:** Clean, lightweight mobile-first UI with zero framework bloat and fast data caching (< 5ms cached lookups)

## Technology Stack

- **Frontend:** HTML5, CSS3, Vanilla ES Modules, Bootstrap 5.3
- **Mapping:** Leaflet.js + OpenStreetMap
- **Backend-as-a-Service:** Firebase Authentication & Cloud Firestore
- **Hosting:** Firebase Hosting (Free Spark Plan) &mdash; Live at [vegansaathi-88d2f.web.app](https://vegansaathi-88d2f.web.app)
- **Media Optimization:** Cloudinary REST API with automatic WebP/AVIF delivery and client-side canvas pre-compression
- **Testing:** Node.js ESM test runners, Python unittest, Playwright browser test suite, and Firestore emulator rules verification

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

## Local Development

1. Install the Firebase CLI: `npm install -g firebase-tools`
2. `firebase login`
3. Serve locally: `firebase emulators:start` or use a local static server for
   static-only testing.
4. Production changes require owner review. Hosting releases must use the explicitly authorized Hosting-only process after release gates pass. Never use an unrestricted `firebase deploy` command.

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
# Full local suite: Node tests, Python data-pipeline tests, static checks,
# stubbed browser tests, and JS/MJS syntax gates.
# On Windows PowerShell:
powershell -ExecutionPolicy Bypass -File tests/run_all.ps1

# On Linux, macOS, or Git Bash:
bash tests/run_all.sh

# Python data-pipeline adapter and deduplication unit tests:
python -m unittest tests.test_data_pipeline -v

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
npm ci
cd ..\..
firebase emulators:exec --only firestore --project vegansaathi-rules-test "node --test tests/rules/firestore.rules.test.mjs"
```

See `tests/rules/README.md` for the full setup and separate active and proposed suites. The
proposed suite exercises `firebase/firestore.rules.proposed`; its results do not describe the
active rules file. Current exact counts and commands are in `docs/TEST_RESULTS.md`.

The historical Maharashtra lead CSV is absent, and the research template contains only its
header. One official Geofabrik Western Zone OSM PBF (221,972,848 bytes) was downloaded to
ignored local storage on 2026-11-06 after verifying its free download and ODbL terms. Its
extraction was interrupted after more than 20 minutes: **0 normalized candidates, 0 staged
records, and 0 published places**. The raw archive and checksum record remain under ignored
`data/raw/osm/`; no candidate data was imported into Firestore.
The Place Intelligence registry is served as a generated allowlisted projection in
`frontend/data/source_registry.json`; regenerate it from the internal registry with
`node scripts/build-public-source-registry.mjs`. Internal source notes and acquisition details
remain outside the Hosting public directory.

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
