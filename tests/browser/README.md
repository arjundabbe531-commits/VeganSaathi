# tests/browser/

Playwright-based browser test suites for VeganSaathi. Each `test_*.py` file is
self-contained: it starts its own local static-file server over `frontend/`, launches a
real headless Chromium, and tears both down when it finishes.

## Why these exist

CDN requests (Bootstrap, Leaflet, the Firebase SDK) and the real Firebase backend aren't
reachable from every environment this project gets developed in — some sandboxes have no
outbound network access at all. These suites redirect those requests to local, offline
stubs in `stub-assets/` (see `common.py`), so the actual, unmodified page code can still be
exercised in a real browser. **The stubs are test-only** — they're never loaded by the real
site; every page's own `<script>`/`<link>` tags still point at the real CDN URLs and the
real Firebase project when actually deployed.

## Prerequisites

```bash
pip install playwright
playwright install chromium
```

## Running a suite

```bash
python3 tests/browser/test_phase4_regression.py
python3 tests/browser/test_5_1b_hardening.py
python3 tests/browser/test_explore_firestore.py
python3 tests/browser/test_5_4_map_robustness.py
```

Each prints `PASS`/`FAIL` per check and exits non-zero if anything failed.

## Files

- `common.py` — shared helpers: the CDN/Firebase-stub route handler, a context manager
  that starts/stops the local frontend server, and a tiny pass/fail logger. Not a test
  itself.
- `stub-assets/` — the offline stand-ins: real (vendored) Bootstrap CSS/JS, a minimal
  Leaflet stub, and minimal Firebase Auth/Firestore stubs controlled by `window.__STUB_*__`
  globals set from each test (see the stub files' own header comments for exactly which
  globals each one reads).
- `test_phase4_regression.py` — Authentication + Profile (register, login, Google,
  logout, guards, navbar).
- `test_5_1b_hardening.py` — XSS-escaping and the diet-badge/`mock-data.js` independence
  check.
- `test_explore_firestore.py` — Task 5.3: Explore's loading/empty/error states, search,
  filters, sort, the 90-day freshness cue, invalid-document handling, and the no-mock-
  fallback guarantee.
- `test_5_4_map_robustness.py` — Task 5.4: the Explore map's `layerGroup` usage, marker
  re-rendering without duplication, coordinate revalidation against the pilot bounding
  box, `invalidateSize()` firing on every List→Map switch, and popup escaping.

## Adding a new suite

Import `BASE_URL`, `LocalFrontendServer`, `log`, `make_route_handler`, and `summary` from
`common.py` rather than re-implementing the server/routing boilerplate. If a new page
needs a Firebase SDK call this project's stubs don't yet support, extend the relevant file
in `stub-assets/` (it's plain JS matching the real SDK's export names/signatures) rather
than writing a one-off stub inside the test file itself — keep as much of the stubbing
shared and reusable as the Node-side `tests/node-firebase-stub/` already is for the unit
tests.
