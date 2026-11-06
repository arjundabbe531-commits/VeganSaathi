# VeganSaathi test results

## Canonical candidate run — 6 November 2026

Run locally in the isolated candidate worktree. These results are for source code and emulators; they do not establish production service state.

| Command / suite | Result | Checks |
|---|---:|---:|
| `powershell -ExecutionPolicy Bypass -File tests/run_all.ps1` (6 Nov 2026, after responsive/accessibility fixes) | PASS, exit 0 | 221 Node assertions, 370 Playwright browser assertions, 2 static gates, 50 JavaScript syntax files |
| `python -m unittest tests.test_data_pipeline -v` | PASS, exit 0 | 28 Python tests; also included by the normal runner as one successful subprocess |
| Active rules emulator, `firebase/firestore.rules` | PASS, exit 0 | 63 tests |
| Proposed rules emulator, `firebase/firestore.rules.proposed` | PASS, exit 0 (rerun on a second free temporary port after first startup failed) | 17 tests |

The normal PowerShell runner includes the Python data-pipeline suite, but summarizes it as one successful subprocess rather than counting its individual cases. The standalone Python command above provides the actual 28-test count. The two rules suites run separately and load different rules files. The browser suite includes five checks for accessible labels and a 320px admin layout, plus `tests/browser/test_responsive_smoke.py` covering 18 pages at 6 widths (108 page/viewports) and browser page errors. Its focused run passed 109/109. The smoke check identified and helped fix a wrong admin guard import in `place-intelligence.js`; it also identified missing exports in the offline Firestore test stub, now supplied there. The Awareness integration test waits for its asynchronously rendered navbar/footer links; its standalone rerun passed 66/66. Across distinct assertions from the normal runner plus both rules suites: **751 passed, 0 failed** (221 Node, 28 Python, 370 browser, 2 static, 50 syntax, 63 active rules, 17 proposed rules). `git diff --check` is recorded after the final changes.

GitHub Actions CI run [42202625220](https://github.com/arjundabbe531-commits/VeganSaathi/actions/runs/42202625220) completed successfully for the preceding candidate head `c8ffb2285eb55465a7278b77e9aa506ba5b11e33`. It predates the UI and test changes recorded here; a new candidate CI run is required before treating this revision as CI-verified.

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
- GitHub Actions passed for the previous candidate head; this current local run passed. The 109-check responsive smoke uses local pages and offline service stubs; it is not a complete WCAG 2.2 AA or production-browser audit.

## Historical results

Older counts and project-state summaries in this file were removed because they described earlier commits and conflicted with current suites. Consult Git history for those historical records; the table above is the current local test count. The CI statement is explicitly tied to its earlier commit until a new run completes.
