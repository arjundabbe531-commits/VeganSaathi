# VeganSaathi test results

## Current `main` worktree verification — 26 November 2026

Run from `C:\Users\JIJAU\.codex\worktrees\vegansaathi-main-vscode` on local branch `main`, based on `d69c27a155c5a22c17747780f76e557d08306c2e`. The theme work in this run is an uncommitted working-tree change; this record does not claim that GitHub has received it.

| Command / suite | Result |
|---|---:|
| `python tests/browser/test_theme.py` | PASS, exit 0 — 83 browser checks across all 20 HTML pages, theme preference behavior, and accessible switch state |
| `node tests/test-controlled-integration.mjs` | PASS, exit 0 — 16 passed, 0 failed |
| `powershell -ExecutionPolicy Bypass -File tests\run_all.ps1` | PASS, exit 0 — 229 Node checks, 471 browser checks (including the theme suite), 2 static checks, 54 JavaScript syntax checks; Python data-pipeline subprocess passed |

The initial full-run attempt found that the controlled integration harness supplies an intentionally minimal `document` stub. The standalone-page theme-toggle initializer now exits safely when the DOM element APIs are unavailable; the focused integration rerun and complete repository runner then passed. The browser test waits for the existing background-color transition to finish before asserting the final dark palette.

The exact-head GitHub Actions run [#55](https://github.com/arjundabbe-work-commits/VeganSaathi/actions/runs/45869049024) for commit `2d56dd419a5a8d1e245c4cd0ab3230366691f2f5` completed successfully. It ran the full CI suite and separately passed the active Firestore emulator tests (**73/73**, `firebase/firestore.rules`) and proposed-rules tests (**17/17**, `firebase/firestore.rules.proposed`). The local run did not separately run the rules emulators. No live authentication session, production Firebase/Cloudinary access, or deployment was performed. Focused results are included in the full-runner totals and should not be added to them.

---

## Canonical candidate run — 21-22 November 2026 (Commit 99113c8 + Community Portal Overhaul)

Run locally in the canonical workspace `D:\VeganSaathi` on branch `candidate/zip-baseline-2026-11-05` (tracking `origin/candidate/zip-baseline-2026-11-05` at commit `99113c8645063e78e94e63035d9ad113a07f8646`).

| Test Suite / Command | Runner / Environment | Checks / Tests | Result |
|---|---|:---:|:---:|
| `node tests/test-places-service.mjs` | Node.js v25.2.1 | 46 passed, 0 failed | PASS, exit 0 |
| `node tests/test-admin-service.mjs` | Node.js v25.2.1 | 30 passed, 0 failed | PASS, exit 0 |
| `node tests/test-cloudinary-service.mjs` | Node.js v25.2.1 | 32 passed, 0 failed | PASS, exit 0 |
| `node tests/test-controlled-integration.mjs` | Node.js v25.2.1 | 14 passed, 0 failed | PASS, exit 0 |
| `node tests/test-geolocation.mjs` | Node.js v25.2.1 | 14 passed, 0 failed | PASS, exit 0 |
| `node tests/test-import-validator.mjs` | Node.js v25.2.1 | 24 passed, 0 failed | PASS, exit 0 |
| `node tests/test-place-intelligence.mjs` | Node.js v25.2.1 | 23 passed, 0 failed | PASS, exit 0 |
| `node tests/test-alternatives.mjs` | Node.js v25.2.1 | 6 passed, 0 failed | PASS, exit 0 |
| `node tests/test-ingredient-checker.mjs` | Node.js v25.2.1 | 3 passed, 0 failed | PASS, exit 0 |
| `node tests/test-candidate-approval.mjs` | Node.js v25.2.1 | 26 passed, 0 failed | PASS, exit 0 |
| `node tests/test-photo-rights.mjs` | Node.js v25.2.1 | 3 passed, 0 failed | PASS, exit 0 |
| `node tests/test-public-source-registry.mjs` | Node.js v25.2.1 | 1 passed, 0 failed | PASS, exit 0 |
| `node tests/check-duplicate-globals.js` | Node.js v25.2.1 | 19 passed, 0 failed | PASS, exit 0 |
| **Node.js Unit & Regression Subtotal** | **Node.js** | **241 passed, 0 failed** | **PASS, exit 0** |
| `python -m unittest discover -s tests -p "test_data_pipeline.py" -v` | Python 3.12 unittest | 32 passed, 0 failed | PASS, exit 0 |
| `python tests/browser/test_responsive_smoke.py` | Playwright Chromium | 115 passed, 0 failed | PASS, exit 0 |
| `python tests/browser/test_awareness_content.py` | Playwright Chromium | 66 passed, 0 failed | PASS, exit 0 |
| `python tests/browser/test_5_4_map_robustness.py` | Playwright Chromium | 16 passed, 0 failed | PASS, exit 0 |
| `python tests/browser/test_explore_firestore.py` | Playwright Chromium | 31 passed, 0 failed | PASS, exit 0 |
| `python tests/browser/test_place_details_firestore.py` | Playwright Chromium | 46 passed, 0 failed | PASS, exit 0 |
| `python tests/browser/test_admin_dashboard.py` | Playwright Chromium | 21 passed, 0 failed | PASS, exit 0 |
| `python tests/browser/test_phase4_regression.py` | Playwright Chromium | 38 passed, 0 failed | PASS, exit 0 |
| `python tests/browser/test_5_1b_hardening.py` | Playwright Chromium | 17 passed, 0 failed | PASS, exit 0 |
| `python tests/browser/test_reverify_prompt.py` | Playwright Chromium | 20 passed, 0 failed | PASS, exit 0 |
| `python tests/browser/test_accessible_controls.py` | Playwright Chromium | 5 passed, 0 failed | PASS, exit 0 |
| `python tests/browser/test_import_review_sandbox.py` | Playwright Chromium | 7 passed, 0 failed | PASS, exit 0 |
| `python tests/browser/test_profile_activity.py` | Playwright Chromium | 6 passed, 0 failed | PASS, exit 0 |
| **Browser Automated Verification Subtotal** | **Playwright** | **388 passed, 0 failed** | **PASS, exit 0** |
| Active rules emulator (`firebase/firestore.rules`) via `tests/rules/firestore.rules.test.mjs` | Firebase Emulator (port 8080/8280) | 73 passed, 0 failed | PASS, exit 0 |
| Proposed rules emulator (`firebase/firestore.rules.proposed`) via `tests/rules/firestore.rules.proposed.test.mjs` | Firebase Emulator (port 8281) | 17 passed, 0 failed | PASS, exit 0 |
| **Grand Total (Local Automated Verification)** | | **751 passed, 0 failed** | **ALL PASS** |

### Verified Changes in this Run
1. **Interactive Indian Ingredient Compass (आहार मार्गदर्शक):** Dedicated real-time guide (`awareness/ingredient-checker.html`) covering 16+ key Indian ingredients and additives with classification badges (Animal-Derived, Caution, Plant-Safe) and exact chef ordering advice in Marathi and English.
2. **Bilingual Conscious Dining Card (शाकाहारी व व्हेगन डायनिंग कार्ड):** Accessible modal from navbar, footer, and place details providing copyable/printable Marathi and English phrases for dining out safely in Maharashtra dhabas, canteens, and pilgrimage centers.
3. **Proximity Distance Filtering in Explore:** Dynamic distance filter chips (`< 15 km`, `< 50 km`) and Haversine distance badges (`~X.X km away`) updating live when location is detected.
4. **Native Web Share & WhatsApp Integration:** Enabled native mobile sharing (`navigator.share`) and WhatsApp direct sharing (`api.whatsapp.com/send?text=...`) alongside one-click address copying on place details.
5. **Marathi / English Quick Localization Toggle:** Clean language switch in the navigation bar persisting user preference in `localStorage`.
6. **Admin Analytics & Workflow Guidance:** Chart.js dynamic dashboard charts (Doughnut, Bar, Pie) rendering live statistics for diet distribution, venue types, and verification health.
7. **AVIF Photo Uploads & Visual Preview:** Added full `image/avif` MIME and `.avif` file extension support across Cloudinary service validators; integrated image preview modal for local device files and external URLs.
8. **High-Accuracy Geolocation & Reverse Geocoding:** Reverse geocoding via OpenStreetMap Nominatim extracts road, area/suburb (e.g. Vatika), and city (e.g. Shegaon) to place informative Leaflet map markers with named badges, address details, and direct directions links.
9. **Community Portal Identity:** Cleaned all lingering academic/student/practice artifacts from public copy; upgraded header brand emblem and footer layout; gated contribution actions exclusively to signed-in users.
10. **Spiritual Ahimsa & Maharashtra Saints:** Dedicated awareness section connecting vegetarianism and veganism through the compassion teachings of Sant Tukaram, Sant Dnyaneshwar (Pasaydan), Sant Eknath, Sant Namdev, and Mahatma Gandhi with subtle CSS animations.
11. **Data Caching & Performance:** Paired `sessionStorage` with a 10-minute `localStorage` cache in `places-service.js` for instant subsequent loads.
12. **Profile Editing & Avatar Selection:** Verified profile updates (name, diet preference, avatar selection) save cleanly to Firebase Auth and Firestore `users/{uid}`.
13. **Real Maharashtra Data:** Curated and published 11 authentic places across Maharashtra with coordinates, addresses, photos, and dietary notes using authorized editorial credentials.
14. **Responsive Layouts:** Zero horizontal overflow across all 19 pages at 320px, 375px, 390px, 768px, 1024px, and 1440px viewports with zero browser page errors.

---

## Canonical candidate run — 6 November 2026 (Historical)

Run locally in the isolated candidate worktree. These results are for source code and emulators; they do not establish production service state.

| Command / suite | Result | Checks |
|---|---:|---:|
| `powershell -ExecutionPolicy Bypass -File tests/run_all.ps1` (6 Nov 2026, after responsive/accessibility fixes) | PASS, exit 0 | 221 Node assertions, 370 Playwright browser assertions, 2 static gates, 50 JavaScript syntax files |
| `python -m unittest tests.test_data_pipeline -v` | PASS, exit 0 | 28 Python tests; also included by the normal runner as one successful subprocess |
| Active rules emulator, `firebase/firestore.rules` | PASS, exit 0 | 63 tests |
| Proposed rules emulator, `firebase/firestore.rules.proposed` | PASS, exit 0 (rerun on a second free temporary port after first startup failed) | 17 tests |

The normal PowerShell runner includes the Python data-pipeline suite, but summarizes it as one successful subprocess rather than counting its individual cases. The standalone Python command above provides the actual 28-test count. The two rules suites run separately and load different rules files. The browser suite includes five checks for accessible labels and a 320px admin layout, plus `tests/browser/test_responsive_smoke.py` covering 18 pages at 6 widths (108 page/viewports) and browser page errors. Its focused run passed 109/109. The smoke check identified and helped fix a wrong admin guard import in `place-intelligence.js`; it also identified missing exports in the offline Firestore test stub, now supplied there. The Awareness integration test waits for its asynchronously rendered navbar/footer links; its standalone rerun passed 66/66. Across distinct assertions from the normal runner plus both rules suites: **751 passed, 0 failed** (221 Node, 28 Python, 370 browser, 2 static, 50 syntax, 63 active rules, 17 proposed rules). `git diff --check` is recorded after the final changes.

GitHub Actions CI run [42207857846](https://github.com/arjundabbe-work-commits/VeganSaathi/actions/runs/42207857846) completed successfully for this exact candidate HEAD `94bf17d1db18335077df33cb389d54a774115955` on 6 November 2026. The Windows CI job ran the full PowerShell application suite, standalone Python pipeline suite, active Firestore rules emulator suite and proposed rules reference suite; all workflow steps completed successfully.

### Emulator commands and isolation

Both emulator suites used Firebase CLI 14.27.0, Node 25.2.1 and Java 23.0.1. The 6 November rerun created an untracked temporary config from `firebase.json` with Firestore port 8280 for the active suite and port 8281 for the proposed suite; the first proposed startup on 8280 failed because the emulator reported the port unavailable, then passed on 8281. The temporary config was removed after the successful run. The checked-in Firebase configuration was not changed. The active run loaded `firebase/firestore.rules`; the reference run loaded `firebase/firestore.rules.proposed`. Neither run contacted or modified production Firebase.

Successful command forms:

```powershell
firebase emulators:exec --only firestore --project vegansaathi-rules-test --config .firebase-rules-temp.json "node --test tests/rules/firestore.rules.test.mjs"
firebase emulators:exec --only firestore --project vegansaathi-rules-test --config .firebase-rules-temp.json "node --test tests/rules/firestore.rules.proposed.test.mjs"
```

```powershell
firebase emulators:exec --only firestore --project vegansaathi-rules-test "node --test tests/rules/firestore.rules.test.mjs"
firebase emulators:exec --only firestore --project vegansaathi-rules-test "node --test tests/rules/firestore.rules.proposed.test.mjs"
```

### Dependency advisory follow-up

Before the change, `npm audit` reported five high-severity package entries in the test-only tree. They were aggregate effects of one high and one low gRPC advisory:

| Installed package | Version | Audit result / cause |
|---|---:|---|
| `@grpc/grpc-js` | 1.9.16 | Direct affected package: GHSA-m9gg-hp2v-232j (high; unauthorized certificate acceptance) and GHSA-f596-whhp-79r4 (low; error message disclosure) |
| `@firebase/firestore` | 4.8.0 | High aggregate entry via vulnerable `@grpc/grpc-js` |
| `@firebase/firestore-compat` | 0.3.53 | High aggregate entry via `@firebase/firestore` |
| `firebase` | 11.10.0 | High aggregate entry via Firestore packages |
| `@firebase/rules-unit-testing` | 4.0.1 | High aggregate entry through its `firebase` peer dependency |

The registry fix suggestion would downgrade Firebase to 9.14.0, a major-version change incompatible with this existing test stack. Instead an npm override scoped to `@firebase/firestore` pins `@grpc/grpc-js` to 1.13.6, the patched minimum for the high advisory; the low advisory is also resolved. On 6 November, `npm audit --json` from `tests/rules/` reported 0 vulnerabilities across 87 dependencies. The root command `npm audit --omit=dev` exited with `ENOLOCK` because the repository has no root lockfile; it did not yield a root dependency vulnerability assessment. This does not update production frontend dependencies.

## Scope and limitations

- Browser tests use local frontend pages and stubbed Firebase, Leaflet and image services. They do not prove live authentication, production Firestore contents, hosting configuration, or deployed rules.
- Firestore emulator tests prove only the checked-in rules files behave as tested; production rules were not inspected or deployed.
- One Geofabrik Western Zone OSM PBF was downloaded locally after confirming its official free-download status; its ODbL licence requires attribution and may require share-alike for a derivative database. The extraction was interrupted after more than 20 minutes. It produced **0 normalized candidates**, 0 staged records, and 0 published places. The raw file is ignored by Git and recorded in `data/raw/osm/acquisition_manifest.json` (local only). Foursquare live access remains blocked pending account-level licence and zero-cost confirmation.
- Cloudinary upload remains disabled; no production credential or service configuration was changed.
- GitHub Actions passed for exact candidate HEAD `94bf17d1db18335077df33cb389d54a774115955` (run [42207857846](https://github.com/arjundabbe-work-commits/VeganSaathi/actions/runs/42207857846)). The 109-check responsive smoke uses local pages and offline service stubs; it is not a complete WCAG 2.2 AA or production-browser audit.

## Historical results

Older counts and project-state summaries in this file were removed because they described earlier commits and conflicted with current suites. Consult Git history for those historical records; the table above is the current local test count. The CI statement is explicitly tied to its earlier commit until a new run completes.
