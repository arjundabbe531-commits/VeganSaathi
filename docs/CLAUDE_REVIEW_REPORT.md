# CLAUDE_REVIEW_REPORT.md — Independent review of VeganSaathi

**Reviewed:** the uploaded `VeganSaathi-main.zip` (Antigravity handoff of 2026-10-13).
**Method:** read `docs/CLAUDE_HANDOFF.md`, read the Firestore rules and the admin, places,
submission, review, report and saved-place write paths, ran every automated suite, and wrote
targeted regression tests for the defects I could fix safely.
**Not done:** no Git operations, no Firebase deploy, no production reads or writes, no
changes to the uploaded ZIP. All edits are in a separate review copy, described in §8.

Every finding is labelled:
- **[Verified]** — observed in the code, the rules, or a test run.
- **[Inferred]** — follows from the code, but was not executed.
- **[Recommendation]** — a judgement, not a defect.

---

## 1. Overall assessment

The project is a well-structured, carefully bounded codebase. Its security model is
mostly sound: the rules deny by default, admin status is read from the database rather
than from the client, community submissions are forced to `pending` and `unverified`, and
the pilot coordinate box is enforced in the rules as well as in the client.

It is **not complete** in the sense the handoff uses. Its tests exercise stubs. No test
executes the security rules. The most important trust signal, "last verified", is written
incorrectly, and the public review feature has a privacy defect that exposes users'
email addresses by default. Those two defects matter more than any code-quality issue.

Completion status, my assessment: **code-complete for Phases 0–8 against stubs; not yet
verified against the live Firebase project; two data-integrity defects and one privacy
defect need fixing before a public demo.**

---

## 2. What was implemented well (preserve)

- **[Verified] Rules deny by default.** The final `match /{document=**}` denies everything
  not explicitly allowed.
- **[Verified] Admin is read from the database.** `isAdmin()` reads
  `users/{uid}.role` with `get()`. A client cannot send a role claim.
- **[Verified] Users cannot make themselves admin.** `users` create requires
  `role == "user"`, and update requires `role` to be unchanged.
- **[Verified] Community submissions are constrained at the server.** Create requires
  `source == "community"`, `status == "pending"`, `verificationStatus == "unverified"`,
  an allowed place type, allowed diet tags, and coordinates inside the pilot box.
- **[Verified] Owners cannot publish their own submissions.** The owner update rule keeps
  status pending, verification unverified, and `createdAt` unchanged.
- **[Verified] Reports are narrow.** Read is limited to the reporter and admins.
- **[Verified] Saved places use the `{uid}_{placeId}` key, enforced by the rules.**
- **[Verified] No Firebase Storage code.** A search of `frontend/`, `firebase/` and `tests/`
  found no `getStorage`, `firebase-storage` or upload code.
- **[Verified] Cloudinary is not implemented.** It appears only in comments and in a
  disabled file input. No credentials or upload code exist.
- **[Verified] No secrets in the upload.** No private keys, service-account files or `.env`
  files were found. The Firebase web config is the public identifier the handoff describes.
- **[Verified] Home, Explore and Place Details read live data** through `places-service.js`.
  No page script reads `MOCK_PLACES`.
- **[Verified] Form labels.** Every input, select and textarea across all pages has an
  associated `<label for>`.
- **[Verified] Heuristic XSS scan.** The 33 `innerHTML` sites in the app contain no
  unescaped variable concatenation that the scan can detect. This is a heuristic, not a
  proof.
- **[Verified] The awareness pages have disclaimers and citation cards on all six pages.**

---

## 3. Confirmed defects

### 3.1 Critical

**C1 — "Verified" can be recorded without any visit, and the code writes a false claim
by default. [Verified] — FIXED in review copy (§8).**
- `frontend/js/admin-service.js`, `reverifyPlace()`: when no note was supplied, it wrote
  `verificationNote: "Physically re-verified by project team"`.
- `frontend/js/admin-dashboard.js`, re-verify prompt: pre-filled the note with
  `"Physically visited and verified by CEP team member"`. Pressing OK recorded that claim
  without any visit.
- This breaks the project's own rule (`docs/CEP_REQUIREMENTS.md`: no invented verification).
- **Fix applied:** the service refuses an empty note with a `validation-error` and performs
  no write. The prompt starts blank and refuses an empty entry.

**C2 — "Last verified" records the click time, not the visit date. [Verified] — NOT FIXED.**
- `frontend/js/admin-service.js`, `reverifyPlace()`: writes
  `lastVerifiedAt: serverTimestamp()`.
- `docs/DATABASE_SCHEMA.md` and decision D5 require `lastVerifiedAt` to be the date of the
  real visit. The public badge shows this date as "Verified — last checked …", so an admin
  who verifies a place a week after visiting it publishes the wrong date, and one who
  verifies without a visit publishes a date that looks like a visit.
- **Why not fixed here:** the correct fix needs a date input in the admin UI, validation of
  that date (not in the future, not before the place was submitted), and a decision on the
  team's verification standard (decision F4). That is a feature change, not a defect patch.
- **Recommended fix:** add a visit-date field to the re-verify dialog, validate it, and write
  `lastVerifiedAt` as a Timestamp built from that date. Store `verifiedBy` and the note.

**C3 — Public reviews expose users' email addresses by default. [Verified] — FIXED in
review copy (§8).**
- Email/password registration never calls `updateProfile`, so `user.displayName` is null
  for these users. Confirmed in `frontend/js/auth-ui.js`.
- `frontend/js/places-service.js`, `submitReview()`: `authorName = user.displayName ||
  user.email || "Community Member"`. So the reviewer's email became `authorName`.
- `reviews` are readable by everyone (`allow read: if true`). Every reviewer without a
  display name had their email address published with the review.
- The same fallback existed in `submitCommunityPlace()` for `submittedByName`. Once an admin
  approved a place, that field became public.
- **Fix applied:** the fallback is now `"Community member"`. No email is ever written to a
  public field. Regression tests fail on the original code and pass on the fixed code (§5.3).
- **Required action outside the code [Recommendation]:** any reviews or places already
  written with an email in `authorName` or `submittedByName` must be found and cleaned.
  That is a production-data change and needs explicit authorisation. The query is
  "authorName contains `@`" on `reviews`, and "submittedByName contains `@`" on `places`.

### 3.2 High

**H1 — The handoff's central admin-protection claim is false. [Verified].**
- `docs/CLAUDE_HANDOFF.md` §4 says "every function calls `checkIsAdmin()` first". In
  `frontend/js/admin-service.js`, only `checkIsAdmin` itself is protected. The other 13
  exported functions (`approvePlace`, `rejectPlace`, `updatePlaceByAdmin`, `reverifyPlace`,
  `resolveReport`, `dismissReport`, `deleteReviewByAdmin`, and the reads) do not call it.
- Those functions accept a caller-supplied `adminUser` and check only that it is truthy.
- **Real protection:** the rules (`allow update: if isAdmin()`). I checked that these
  functions cannot succeed for a non-admin, because the rules refuse the write. So this is
  a defence-in-depth gap and a documentation error, not an open door.
- **Recommendation:** make each admin function call `checkIsAdmin(adminUser)` before
  writing, so the code's behaviour matches its documentation. Correct the handoff.

**H2 — `checkIsAdmin()` is described as "server-side" but runs in the browser. [Verified].**
- The handoff §8 asks whether it "can't be bypassed (reads Firestore server-side)". It reads
  `users/{uid}` from the client SDK. Its result only decides which UI section to show.
  Enforcement is the rules, as in H1.
- **Recommendation:** correct the handoff wording.

**H3 — Admin write paths have no test that touches them, apart from validation. [Verified].**
- `tests/test-admin-service.mjs` tests argument validation for approve, reject, resolve,
  dismiss and delete. It does not assert the payload they write, except in `reverifyPlace`.
- `tests/browser/test_admin_dashboard.py` makes 21 checks, all about access gating and stats
  display. Its stub recorded **0 writes** (`__STUB_WRITES__` / `__STUB_ADMIN` appear nowhere).
- No test verifies that approving a place sets `status: "published"`, or that rejecting one
  never publishes it.

**H4 — Nothing in the repository executes `firestore.rules`. [Verified].**
- The security boundary the handoff calls "the real security boundary" has no automated
  test. The only rules check is that the file has balanced brackets.
- **Recommendation:** add rules unit tests using `@firebase/rules-unit-testing` with the
  Firestore emulator. These must run on the user's Windows machine (the sandbox has no Java
  or network access). Suggested command, to run locally and not performed here:
  `firebase emulators:exec --only firestore "npm test"`. The first tests to write are the
  ones in §4.

### 3.3 Medium

**M1 — `mock-data.js` is still loaded by two production pages. [Verified].**
- `frontend/login.html` and `frontend/register.html` load `js/mock-data.js`. Neither page's
  scripts reference `MOCK_` identifiers, so this is dead weight, but it contradicts the
  handoff's D2 claim ("not loaded by any page in production mode").
- **Recommendation:** remove the script tag from both pages. Check the login and register
  suites still pass afterwards.

**M2 — Review comments have a minimum length but no maximum. [Verified].**
- `submitReview()` checks `textComment.length < 3`. The rules check neither the comment
  length nor the place id.
- **Recommendation:** add a maximum of 500 characters in the client and in the rule.

**M3 — Admin writes fields that the schema does not document. [Verified].**
- The code writes `approvedBy`, `approvedAt`, `rejectedBy`, `resolvedBy`, `dismissedBy`.
  `docs/DATABASE_SCHEMA.md` lists none of them.
- **Recommendation:** add them to the schema, with types and purpose.

**M4 — Approval does not validate the place it publishes. [Verified].**
- `approvePlace()` sets `status: "published"` with no check of the document's fields. Admin
  writes are unrestricted by the rules. If an approved place is malformed, `normalizePlace()`
  will silently drop it from Explore, and the admin will see "approved" with no visible
  result.
- **Recommendation:** run the same `normalizePlace()` checks before approving, and refuse
  approval with a clear message if the document would be skipped.

**M5 — Awareness content has one unverified local claim, and some directive wording.
[Verified] wording; [Inferred] that it is unverified.**
- `frontend/awareness/faq.html` says B12 tablets are "readily available at campus pharmacies
  for very affordable prices". Nothing in the project records a visit to any pharmacy. This
  is exactly the kind of local claim `CEP_REQUIREMENTS.md` forbids without fieldwork.
- `getting-started.html` and `faq.html` use "non-negotiable" and "Mandatory" for B12. The
  NHS and Harvard sources cited elsewhere say "recommended" or "advised". The phrasing should
  match the source.
- **Recommendation:** remove the campus-pharmacy sentence, or verify it during fieldwork and
  record the visit. Change "mandatory" to the source's own wording.

**M6 — The awareness tests check structure, not content. [Verified] from the check names.**
- The 66 checks in `test_awareness_content.py` are named by what they check: route loads,
  page title, h1 heading, disclaimer present, six sub-nav pills, active pill, citation card
  present, external links safe. None checks whether a factual sentence is accurate or
  sourced. The names are the evidence; I did not count assertion types.
- **Recommendation:** keep the structural checks. Add a manual content review checklist,
  signed off by a second reviewer.

**M7 — Price and area sentinel strings are written as data. [Verified].**
- `submitCommunityPlace()` writes `priceRange: "Price not listed"` and `area: "Area not
  listed"` when the user gives no value. The rules accept `"Price not listed"` as a valid
  `priceRange`. These are display strings, not data, and the schema allows the fields to be
  absent.
- **Recommendation:** omit the fields when absent. Remove `"Price not listed"` from
  `isValidPriceRange`, and make the rule accept a missing `priceRange`.

### 3.4 Low

**L1 — Rules gaps that do not open a path to privilege but weaken data integrity. [Verified].**
- `places` create does not require `createdAt` or `updatedAt` to equal `request.time`. A
  direct SDK write can backdate a submission. The client uses `serverTimestamp()`, so
  normal use is fine.
- `places` create does not constrain `imageUrl`. Phase 6 photos will need this constrained
  to the Cloudinary domain, or any external URL can be published.
- `places` create does not constrain `submittedByName` length.
- `reviews` create does not verify that `placeId` names a published place. A signed-in user
  can attach a public review to a pending, rejected or non-existent place. The review
  becomes readable by everyone.
- `reports` create does not verify `placeId` or cap `description`.
- `savedPlaces` create does not verify `placeId`.
- `users` update does not re-check `dietPreference`, and does not restrict which keys may be
  written. Arbitrary fields can be added to a user's own profile document.

**L2 — Stray files shipped in the upload. [Verified].**
- `.pytest_cache/` is in the archive. `.gitignore` does not exclude it.
- `diagnose-browser.py` is at the project root. It is a debugging script, not in any suite,
  and it is not run by `tests/run_all.sh`. Move it to `tests/` or delete it.

**L3 — Test count in the handoff is accurate but the suites report it differently. [Verified].**
- 278 = 51 Node unit checks (35 + 16) + 227 browser checks (17 + 16 + 21 + 66 + 28 + 38 +
  41). The duplicate-globals checker is a separate static check. The arithmetic and the
  per-suite counts match what I ran. Nothing is inflated.

---

## 4. Security and data-integrity summary

| Area | Status | Evidence |
|---|---|---|
| Default deny | Sound | final `match /{document=**}` |
| Admin determined from database | Sound | `isAdmin()` uses `get()` |
| Self-promotion to admin | Blocked | `users` create/update rules |
| Community submission forced to pending/unverified/community | Sound | `places` create rule |
| Owner cannot publish own submission | Sound | `places` owner-update rule |
| Coordinates restricted to pilot box | Sound, rules and client | `isValidCoordinates` |
| Reports readable by reporter and admin only | Sound | `reports` read rule |
| Reviews publicly readable | Intended, but see C3 | `reviews` read `if true` |
| Email addresses kept out of public fields | **Was broken (C3), fixed here** | `places-service.js` |
| Verification claim honest | **Was broken (C1), fixed here; date still wrong (C2)** | `admin-service.js` |
| Admin writes validated | Partial (M4) | `approvePlace` |
| Rules exercised by tests | **No (H4)** | no rules tests exist |
| Storage not used | Verified | no code |

**Priority rules tests to write first** (on the user's machine, with the emulator):
1. A signed-in user cannot set `role` to `admin` on their own `users` document.
2. A community place cannot be created with `status: "published"`, `verificationStatus:
   "verified"`, or `source: "fieldwork"`.
3. A review cannot be created with a rating outside 1–5, or with a `userId` other than the
   caller's.
4. A report cannot be read by a user other than its reporter.
5. A saved-place document cannot be created for another user's uid.
6. A non-admin cannot update or delete any `places` document they do not own.
7. A non-admin cannot read `reports` belonging to another reporter.

---

## 5. Test quality and verified execution

### 5.1 Execution

I ran the complete estate with `tests/run_all.sh` on a copy of the uploaded project, in
the review sandbox, before and after my changes:

| Suite | Type | Before | After |
|---|---|---|---|
| `tests/test-places-service.mjs` | Node unit, stubbed Firestore | 35 passed | 37 passed |
| `tests/test-admin-service.mjs` | Node unit, stubbed Firestore | 16 passed | 17 passed |
| `tests/check-duplicate-globals.js` | Static | PASS | PASS |
| `tests/browser/test_5_1b_hardening.py` | Headless Chromium, stubbed services | 17 | 17 |
| `tests/browser/test_5_4_map_robustness.py` | Headless Chromium, stubbed services | 16 | 16 |
| `tests/browser/test_admin_dashboard.py` | Headless Chromium, stubbed services | 21 | 21 |
| `tests/browser/test_awareness_content.py` | Headless Chromium | 66 | 66 |
| `tests/browser/test_explore_firestore.py` | Headless Chromium, stubbed services | 28 | 28 |
| `tests/browser/test_phase4_regression.py` | Headless Chromium, stubbed services | 38 | 38 |
| `tests/browser/test_place_details_firestore.py` | Headless Chromium, stubbed services | 41 | 41 |
| `node --check` on all JS/MJS | Static | OK | OK |

Totals: **278 before, 281 after**, all passing. The 278 figure in the handoff is accurate.
The three new passing checks are the two privacy regression tests and the one re-verify
refusal test.

### 5.2 What these results do and do not prove

- **[Verified]** the JavaScript logic and DOM behaviour run correctly against the stubbed
  Firebase SDK, in headless Chromium, with no network.
- **[Verified]** the service functions build the documented payloads, for the cases tested.
- **Not proven:** that the live project accepts any of these writes, that the rules allow or
  refuse them as the tests assume, or that a real browser behaves identically. No test in
  the repository touches the live project or the rules engine.
- **Not proven:** the admin dashboard's prompt change (C1, §8), which no browser test covers.

### 5.3 Regression tests added in this review

- `reverifyPlace REFUSES an empty note and performs no write` (fails on original code;
  passes on fixed code).
- `submitCommunityPlace never publishes an email as submittedByName` (same).
- `submitReview never publishes an email as authorName` (same).

I confirmed each fails against the original upload and passes against the fixed copy.

---

## 6. Missing requirements and external blockers

| Item | Status | Blocker |
|---|---|---|
| Real-project verification (registration, login, Google, password reset) | Not done | Needs a real browser and the live project |
| Rules deployed and matching the repository | Unknown | Needs Firebase Console check |
| Submit → admin approve → appears on Explore, live | Not done | Needs live project |
| Fieldwork: 15+ real verified places | Not done | Needs team visits |
| Community survey and interviews | Not done | Needs real respondents |
| Cloudinary photo upload | Not implemented | Needs account, preset, and decision F2 |
| Re-verify with a real visit date (C2) | Not implemented | Needs UI change and decision F4 |
| Email clean-up in production data (C3) | Not done | Needs explicit authorisation |
| Rules unit tests (H4) | Not written | Needs local Java/emulator on the user's machine |
| Admin write-path tests (H3) | Not written | Code change to the test suites |

---

## 7. Recommended improvements and removals

Each removal lists what depends on it, as requested.

**Remove**
- `mock-data.js` script tag from `login.html` and `register.html` (M1). Dependents: none
  on those pages; `test_phase4_regression.py` uses its own stub place, so it is unaffected.
- `diagnose-browser.py` from the root (L2). Dependents: none. It is not in any suite.
- `.pytest_cache/` from the archive (L2). Dependents: none.
- `"Price not listed"` as a stored value (M7). Dependents: `normalizePlace()` supplies the
  same display string for missing values, so presentation is unchanged. `isValidPriceRange`
  must change with it.

**Improve, in priority order**
1. Visit-date entry for re-verification (C2).
2. Rules unit tests for the seven cases in §4 (H4).
3. Admin write-path tests, including approve-does-not-publish-rejected (H3).
4. Make admin functions call `checkIsAdmin` (H1).
5. Validate on approval (M4).
6. Maximum length for review comments and report descriptions (M2, L1).
7. Constrain `imageUrl` before Phase 6 photos (L1).
8. Document the admin-written fields (M3).
9. Reword awareness pages (M5) and add a content-review checklist (M6).

**Do not change**
- The default-deny rules and the server-side admin check through `get()`.
- The pending/unverified enforcement on community submissions.
- The pilot coordinate box, enforced in both rules and client.
- The separate `users` read limit, which keeps emails private from other users.
- The `{uid}_{placeId}` saved-place key.
- The choice not to use Firebase Storage.
- The decision that reviews are publicly readable. Reviews need public reads to be useful,
  and the fix is to stop emails leaking (done), not to hide reviews.

**Documentation corrections required** (I did not edit the handoff itself)
- `CLAUDE_HANDOFF.md` §4: "every function calls `checkIsAdmin()` first" is false (H1).
- `CLAUDE_HANDOFF.md` §8: `checkIsAdmin()` is not server-side (H2).
- `CLAUDE_HANDOFF.md` §5 D2: `mock-data.js` is loaded by two pages (M1).
- `CLAUDE_HANDOFF.md` §9: the test count is accurate, but it should say the static
  duplicate-globals check is separate from the 278.
- `docs/DATABASE_SCHEMA.md`: missing admin-written fields (M3), and `lastVerifiedAt`
  semantics (C2).

---

## 8. Changes made in the review copy

The uploaded ZIP is unchanged. These changes are in a separate copy and are delivered in
`VeganSaathi-Claude-Review.zip` with `CHANGES.diff`, so they can be reviewed and applied or
rejected.

| File | Change | Reason | Tests rerun |
|---|---|---|---|
| `frontend/js/places-service.js` | `submittedByName` and `authorName` fallback changed from `user.email` to `"Community member"` (two sites) | C3: stop publishing email addresses | full estate |
| `frontend/js/admin-service.js` | `reverifyPlace()` refuses an empty note; the default "Physically re-verified" text is removed | C1: no fabricated verification | full estate |
| `frontend/js/admin-dashboard.js` | Re-verify prompt starts blank; an empty entry is refused with a message | C1: no pre-filled visit claim | full estate; **not covered by any browser test** |
| `tests/test-places-service.mjs` | Two new privacy regression tests | proves C3 fix | Node suite |
| `tests/test-admin-service.mjs` | One new refusal test | proves C1 fix | Node suite |
| `tests/run_all.sh` | **New file.** One command runs every suite and the static checks, and prints exact pass and fail counts per suite | addresses the missing single test entry point (C11 in the project plan, and the reproducibility gap in §6) | the whole estate was run through it |

**Not changed, deliberately:** the rules (no change needed for the fixes made), the handoff
document, the awareness pages, the schema, and any production data.

---

## 9. Items that remain unverified or require human authorisation

1. Whether the deployed rules match `firebase/firestore.rules`. Check in the Firebase Console.
2. Whether any real reviews or places already contain an email address (C3). Needs
   authorisation to query and clean production data.
3. The live behaviour of every write path. Needs a real browser on the live project.
4. Whether the awareness sources are reachable and say what the pages claim. I did not
   fetch them.
5. The admin prompt change (C1) in a real browser.
6. Whether approving a place fails safely when the place is malformed (M4).

---

## 10. Recommended order of work

1. **Authorise and run** the production-data check for emails (C3), then clean up.
2. **Decide F4** (what verified requires), then build the visit-date entry (C2).
3. **Write the rules unit tests** in §4 and run them locally with the emulator (H4).
4. **Write admin write-path tests** (H3) and make admin functions check `checkIsAdmin`
   (H1).
5. **Fix the documentation corrections** in §7, so the handoff and schema match the code.
6. **Apply the low-risk items** in §7 (M1, M2, M7, L1, L2).
7. **Run the live-project checks** on the user's machine: registration, login, a submission
   that stays pending, admin approval, a non-admin refused at the admin page and at the
   rules.
8. **Only then** run the full estate again and record results with the date.

Git, GitHub and Firebase deployment remain deferred, as instructed.
