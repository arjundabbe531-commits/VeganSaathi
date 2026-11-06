# INTEGRATION_REPORT.md — VeganSaathi merged baseline

**Date:** 2026-10-15 (integration session). **Scope:** merge the independent review into the
original Antigravity project, fix the verified defects, and add the next batches of work.

## 1. Inputs

| Copy | Location | What it is |
|---|---|---|
| Original | `VeganSaathi-main.zip` (upload) | Antigravity's handoff state, 278 reported tests |
| Reviewed | separate review copy | Original plus the review fixes, `CHANGES.diff` |
| Merged | `VeganSaathi-Merged/` | This integration. Original and reviewed copies are unchanged |

Stage 1 check: the reviewed copy differed from the original in exactly the seven files listed
in `CHANGES.diff`. Nothing else had drifted.

## 2. Merged from the review (inspected hunk by hunk, then applied)

| File | Change | Why |
|---|---|---|
| `frontend/js/places-service.js` | Public display names fall back to "Community member", never an email | Privacy: emails were published in reviews and place submissions |
| `frontend/js/admin-service.js` | Re-verification refuses an empty note; no fabricated default note | Honesty: no verification claim without a recorded check |
| `frontend/js/admin-dashboard.js` | Re-verify prompt starts blank; an empty note is refused | Honesty |
| `tests/test-places-service.mjs`, `tests/test-admin-service.mjs` | Regression tests for the two fixes above | Prove the fixes |
| `tests/run_all.sh` | One command runs every suite and prints counts | Reproducibility |
| `docs/CLAUDE_REVIEW_REPORT.md` | The review itself | Record |

## 3. Integrated in this session (new, each with tests)

| Batch | File(s) | Change | Tests |
|---|---|---|---|
| 2 | `admin-service.js` | One shared `requireAdmin()` gate; all seven admin WRITE functions now confirm the caller's role from `users/{uid}`. Non-admins get `permission-denied`. | 2 new; the 8 existing call sites now model an admin profile. A non-admin refusal test fails on the pre-change code. |
| 3 | `admin-service.js`, `admin-dashboard.js` | Re-verification requires a real, non-future calendar date for the physical visit. It is stored as `lastVerifiedAt`, with `verifiedBy` and `verifiedAt`. The dashboard asks for it and does not pre-fill it. | 3 new (parser, refusals, stored value) |
| 4 | `places-service.js` | Review comments and report descriptions are capped at 500 characters, before any write | 2 boundary tests (500 accepted, 501 refused, no write) |
| 5 | `login.html`, `register.html` | Unused `mock-data.js` script tags removed | Phase 4 suite: 38/38 |
| 5 | `awareness/faq.html`, `awareness/getting-started.html` | Removed the unverified "campus pharmacies … very affordable" claim. Replaced "non-negotiable" and "Mandatory" with "essential". | Awareness suite: 66/66 |
| 6 | `docs/proposals/firestore-rules-batch6.md`, `tests/rules/` | Proposed rules changes and an emulator test suite. **Not applied, not run.** | none run here |
| 7 | `.gitignore`, `docs/DATABASE_SCHEMA.md` | Test caches excluded; verification and admin-written fields documented | n/a |

## 4. Preserved (deliberately unchanged)

- The default-deny rules and the `get()`-based admin check.
- Pending and unverified enforcement on community submissions.
- The pilot coordinate box, enforced in rules and client.
- The `users` read limit, which keeps other users' emails private.
- The `{uid}_{placeId}` saved-place key.
- Public reviews. The fix is to stop emails leaking, not to hide reviews.
- All working pages, the admin dashboard, the awareness pages, and every existing test.

## 5. Rejected

- **Blind application of `CHANGES.diff`.** Not needed: the diff was inspected and matches the
  reviewed copy exactly, so it was merged file by file.
- **Applying the proposed rules changes without the emulator.** A broken rules file would block
  all writes. They stay as a proposal until tested.

## 6. Deferred (with reason)

| Item | Reason |
|---|---|
| Apply rules R1–R3 (`docs/proposals/`) | Needs the Firestore emulator on the user's machine |
| Rule R2: reviews only on published places | Needs an emulator check that `get()` works for a non-admin writer |
| Gate the admin READ functions in the service | They take no user argument; the rules already restrict the data. Changing signatures touches the dashboard. |
| Validate a place before approving it (review M4) | Needs a decision on what happens to a place that fails validation |
| Check `lastVerifiedAt` is after the place was submitted | Needs the place's `createdAt`; the check belongs in the same visit-date step |
| Clean existing emails from production data | Production data change. Needs explicit authorisation |
| Move `diagnose-browser.py` out of the project root | Left in place; ask whether it is wanted |
| Verify the NHS and Harvard citations in the awareness pages | Sources not fetched. The wording is now conservative, but the citations are unchecked |
| Browser test for the new visit-date prompt | The existing admin browser suite does not drive the re-verify prompt |

## 7. Documents that disagree with the code (corrected here or flagged)

| Claim | Where | Actual |
|---|---|---|
| "Every admin function calls `checkIsAdmin()`" | `CLAUDE_HANDOFF.md` §4 | Now true for the seven admin WRITE functions. The seven admin READ functions still do not, and rely on the rules. |
| "`checkIsAdmin()` is server-side" | `CLAUDE_HANDOFF.md` §8 | False. It runs in the browser. The rules are the enforcement. |
| "No production page loads `mock-data.js`" | `CLAUDE_HANDOFF.md` §5 | Was false for login and register. Now true. |
| "278 tests" | handoff | 278 was accurate for the original. The current merged project has 310 test checks (65 Node + 245 browser) plus 2 static gates (runner sum 312). See `docs/TEST_RESULTS.md`. |
| "`lastVerifiedAt` is the verification date" | schema | It was the click time. Now the entered visit date. |

## 8. Known limitations after integration

1. No live Firebase verification has been performed in any session.
2. The Firestore rules have no automated test that has been run. The emulator suite is written but unrun.
3. The browser suites use stubbed Firebase, Leaflet and browser services. They show rendering and
   interaction only.
4. Existing production data may contain emails in public name fields. Not checked.
5. Re-verification does not yet check the visit date against the submission date.

## 9. Reconciliation — 2026-10-15

**The uploaded `VeganSaathi-Merged.zip` was an earlier snapshot.** It lacked the re-verification
browser test, approval validation, awareness corrections, rules-test split, emulator configuration,
and matching schema and test-result text. The working copy is the authoritative merged state;
the archive from this session supersedes the earlier one.

**Changes in this reconciliation:**
- Rules fixture: the working copy uses the shared `communityPlace()` helper, which includes
  `priceRange`. The earlier `validPending()` helper is gone from the working copy. A new static
  check (`tests/rules/check_fixture_static.py`, run by `run_all.sh`) fails if the fixture drifts from
  the place-create rule. Proven: it fails on a copy with `priceRange` removed.
- Protein claim on the misconceptions page: attribution to the NHS and ICMR-NIN removed. I had not
  verified either source for that statement. The general statement is kept.

**Awareness citations (Task 4), verified and unverified:**
- Verified against search results: the NHS "vegan diet" page says sources of B12 for vegans are
  limited and a supplement may be needed; the Vegan Society says B12 is made by micro-organisms, not
  plants, and fortified foods or supplements are the reliable sources; Harvard Health says B12 is
  found naturally only in animal products and suggests a supplement for vegans.
- Corrected: "gut bacteria" wording; "must obtain" directive; a Harvard claim about athletic recovery
  and environmental reasons (not in Harvard's text); a Harvard claim about whole-food vegan diets
  (Harvard's text concerns vegetarian diets and heart disease).
- Changed the NHS address to `nhs.uk/live-well/eat-well/how-to-eat-a-balanced-diet/the-vegan-diet/`,
  which appeared in search results. The old address had not been confirmed.
- **Still unverified:** the Harvard anchor links `health.harvard.edu/blog/...` and
  `health.harvard.edu/healthbeat/...` (not checked; the Harvard article found in search is
  `health.harvard.edu/healthy-aging-and-longevity/making-the-switch`); the Vegan Society `key-facts`
  and `general-faqs` pages; the ICMR-NIN guideline link. These need a manual check before release.

**Rules status (unchanged, stated plainly):** R1–R3 are proposals. Not applied. Not tested.
Emulator tests not run in this environment.

## 10. Master integration mission — Stage A–E summary (2026-10-15, later session)

This section records the "master integration" pass that re-audited the whole project rather
than a single defect list.

### Stage A — Baseline reconciliation

Two genuinely separate codebases exist for this project, built in parallel, not sequentially:

| Lineage | Where | What it reached |
|---|---|---|
| My own earlier task-based build | a separate working directory from an earlier phase of this engagement | Phases 0–5.5 only (Explore/Place Details/Map on Firestore). Phase 6/7 were UI shells showing "connected in a later phase" demo messages, never real Firestore writes. No admin service module, 3 awareness pages, no rules tests. |
| Antigravity's build, reviewed and reconciled by Claude | this working copy (`VeganSaathi-Merged`, descended from the uploaded `VeganSaathi-main.zip`) | Phases 0–8 with real Firestore writes for submissions/reviews/reports/saved places, a full `admin-service.js`, 6 awareness pages with a dedicated content-test suite, and a Firestore rules test harness. |

**Decision: the Antigravity-derived, reconciled lineage (this working copy) is the canonical
baseline.** It is a strict superset of the other lineage — every file compared between them
either matched or the Antigravity lineage had the more complete version (confirmed by diffing
`places-service.js`, `place-details.js`, and the shared Phase 4/5 test files directly, not by
reading either agent's summary). The other lineage contributed nothing that needed recovering.

**The `D:\VeganSaathi-main\VeganSaathi-main` vs `D:\Downloads\VeganSaathi-main\VeganSaathi-main`
path mismatch, reported in an earlier session, remains unresolved.** Both paths are locations
on the user's own Windows machine; this sandbox has no access to either and cannot determine
which local folder the user's own Antigravity/Codex tools were actually pointed at. This has
to be checked on the user's machine before any further local-vs-sandbox file comparison is
trusted.

**A Codex audit report or patch was searched for and not found** in any archive or working
copy available to this session. Only references *to* such a report exist in the project's own
docs (inherited from the Antigravity handoff). Its content is not available here and nothing
about it is assumed or invented.

### Stage B — Integration

No new merge work was needed beyond what sections 1–9 of this report already describe; Stage A
confirmed the current working copy already is the integrated result.

### Stage C — Security and functionality

- A complete, ready-to-diff `firebase/firestore.rules.proposed` file was created with R1, R2
  and R3 folded in (previously only prose snippets existed in `docs/proposals/`). It is not
  read by Firebase and has no effect on the active rules.
- R3 was implemented more precisely than the original sketch: it restricts `hasOnly()` to the
  fields an update actually touches (`diff().affectedKeys()`), rather than requiring every
  update to repeat the whole field list — this still blocks an unknown field or a role/email
  change, but doesn't break an ordinary partial edit. This refinement is itself unverified.
- **R1–R3 were deliberately NOT applied to the active `firebase/firestore.rules`.** This
  follows an explicit instruction from an earlier session in this engagement ("do not apply an
  untested rules proposal merely to declare the task complete"), which this mission's own
  instructions do not override — it says "investigate," not "apply." A syntax or logic error
  in an unverified rules file would block every write in the deployed app.
- Full regression was re-run after this and every other change in this session: 310 test
  checks and 2 static gates, 0 failures (exact figures in `docs/TEST_RESULTS.md`).

### Stage D — UI inspection

Real screenshots (not descriptions) were captured with Playwright against the stubbed local
server, at desktop (1440×900), tablet (768×1024), and mobile (375×667), for Home, Explore,
Place Details, Login, Register, Submit a Place, Saved, Admin Dashboard (both signed-out and
signed-in as admin, including the Re-Verification tab), and one awareness page.

**Finding:** most pages were already consistent — one green/neutral design system, matching
card and badge treatment, honest empty/loading/error states, and a genuinely usable admin
dashboard (stat cards, tabs, a dedicated re-verification view with the CEP freshness standard
explained inline) rather than raw tables. This is reported as observed, not assumed.

**One real, concrete problem found and fixed:** on mobile, the admin dashboard's tables
(Pending Submissions, Published Listings, Re-Verification, Reports, Reviews) overflow
horizontally inside their existing `.table-responsive` wrapper with no visual indication that
more columns exist off-screen — a user would reasonably think the layout was broken rather
than scrollable. Fixed with a small CSS-only addition: a "← Swipe to see all columns →" hint
(shown only below 768px) and a subtle edge-fade on the scroll container. No test selectors,
IDs, or classes the test suite depends on were touched. `frontend/css/styles.css` and
`frontend/admin/dashboard.html` (5 insertion points, one per table) were the only files
changed. The fix was verified by retaking the screenshot and confirming the hint renders, and
by re-running `test_admin_dashboard.py` (21/21, unchanged).

No other concrete visual defect was found in the pages inspected. This was a targeted
inspection of the most important journeys, not an exhaustive pass over every page — the
awareness pages beyond the one checked, the profile page, and desktop/tablet admin views
beyond what's listed above were not separately screenshotted in this pass.

### Stage E — Final verification and documentation

- `docs/FIREBASE_SECURITY.md` gained a "Known gaps — proposed, not yet applied" section
  listing R1–R3 against the current rules, so the security document itself (not just this
  report) states what is and isn't enforced.
- `README.md` gained a concrete "Testing" section with the actual commands for
  `tests/run_all.sh` and the Firestore Emulator rules suite, replacing a generic pointer.
- Full regression re-confirmed after all documentation and UI edits: unchanged at 310 test
  checks + 2 static gates, 0 failures.

### Unresolved after this mission

1. Firestore Emulator tests (current-behaviour and proposed) have still never been run. No
   claim of "security verified" is made anywhere in this project's docs as a result.
2. The `D:\...` path mismatch (Stage A) needs the user to check their own machine.
3. R1–R3 remain proposed only.
4. UI inspection covered the primary journeys, not every page and breakpoint combination.
5. No live Firebase or Cloudinary verification has been performed in any session.
6. GitHub is still not touched, per every prior instruction in this engagement — see the
   handover for the sync plan.
