# VeganSaathi test results

## Canonical candidate run — 6 November 2026

Run locally in the isolated candidate worktree. These results are for source code and emulators; they do not establish production service state.

| Command / suite | Result | Checks |
|---|---:|---:|
| `powershell -ExecutionPolicy Bypass -File tests/run_all.ps1` (6 Nov 2026, after OSM registry update) | PASS, exit 0 | 221 Node assertions, 256 Playwright browser assertions, 2 static gates, 50 JavaScript syntax files |
| `python -m unittest tests.test_data_pipeline -v` | PASS, exit 0 | 28 Python tests |
| Active rules emulator, `firebase/firestore.rules` | PASS, exit 0 | 63 tests |
| Proposed rules emulator, `firebase/firestore.rules.proposed` | PASS, exit 0 (rerun on a second free temporary port after first startup failed) | 17 tests |

The normal PowerShell runner includes the Python data-pipeline suite, but summarizes it as one successful subprocess rather than counting its individual cases. The standalone Python command above provides the actual 28-test count. The two rules suites run separately and load different rules files. Across the distinct checks above: **637 passed, 0 failed**. The full runner passed after the source registry update; the later changes only refined source notes and documentation. `git diff --check` also passed (Git emitted only line-ending normalization warnings).

GitHub Actions CI run [42194114803](https://github.com/arjundabbe531-commits/VeganSaathi/actions/runs/42194114803) completed successfully for PR head `bb8b45d83bb4ac1624a2439e2cfe8eff08939831`. The `pull_request` job checked out GitHub's generated merge ref `57873d175c075ac853cf2d4418a681478ecdb3cb`, combining that candidate with `main` at `aedac7196ee48a45f06cdc3442effc4a05fd094c`. The full local runner above passed on candidate HEAD itself.

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
- GitHub Actions passed for the PR merge ref associated with the candidate head; the local runner passed on the exact candidate HEAD. The CI run does not test production configuration.

## Historical results

Older counts and project-state summaries in this file were removed because they described earlier commits and conflicted with current suites. Consult Git history for those historical records; the table above is the only current test count.
