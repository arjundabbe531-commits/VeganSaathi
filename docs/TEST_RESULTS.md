# VeganSaathi test results

## Canonical candidate run — 6 November 2026

Run locally in the isolated candidate worktree. These results are for source code and emulators; they do not establish production service state.

| Command / suite | Result | Checks |
|---|---:|---:|
| `powershell -ExecutionPolicy Bypass -File tests/run_all.ps1` | PASS, exit 0 | 221 Node assertions, 256 Playwright browser assertions, 2 static gates, 50 JavaScript syntax files |
| `python -m unittest tests.test_data_pipeline -v` | PASS, exit 0 | 28 Python tests |
| Active rules emulator, `firebase/firestore.rules` | PASS, exit 0 | 63 tests |
| Proposed rules emulator, `firebase/firestore.rules.proposed` | PASS, exit 0 | 17 tests |

The normal PowerShell runner includes the Python data-pipeline suite, but summarizes it as one successful subprocess rather than counting its individual cases. The standalone Python command above provides the actual 28-test count. The two rules suites run separately and load different rules files. Across the distinct checks above: **637 passed, 0 failed**. The full runner was run after the final code and test changes; documentation-only changes followed.

### Emulator commands and isolation

Both emulator suites used Firebase CLI 14.27.0, Node 25.2.1 and Java 23.0.1. Because local emulator ports 8080 and 8181 were occupied, each run used a temporary copy of `firebase.json` with a free Firestore port. The checked-in Firebase configuration was not changed. The active run loaded `firebase/firestore.rules`; the reference run loaded `firebase/firestore.rules.proposed`. Neither run contacted or modified production Firebase.

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

The registry fix suggestion would downgrade Firebase to 9.14.0, a major-version change incompatible with this existing test stack. Instead an npm override scoped to `@firebase/firestore` pins `@grpc/grpc-js` to 1.13.6, the patched minimum for the high advisory; the low advisory is also resolved. After `npm ci`, `npm audit --json` reported 0 vulnerabilities. This does not update production frontend dependencies.

## Scope and limitations

- Browser tests use local frontend pages and stubbed Firebase, Leaflet and image services. They do not prove live authentication, production Firestore contents, hosting configuration, or deployed rules.
- Firestore emulator tests prove only the checked-in rules files behave as tested; production rules were not inspected or deployed.
- No real place data was acquired or imported. The Foursquare live access path remains blocked pending account-level licence and zero-cost confirmation.
- Cloudinary upload remains disabled; no production credential or service configuration was changed.
- No GitHub Actions run exists yet; the workflow was added in this candidate and awaits a PR-triggered run.

## Historical results

Older counts and project-state summaries in this file were removed because they described earlier commits and conflicted with current suites. Consult Git history for those historical records; the table above is the only current test count.
