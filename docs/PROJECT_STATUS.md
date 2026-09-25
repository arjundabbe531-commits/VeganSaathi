# PROJECT_STATUS.md — VeganSaathi

*Update this file at the end of every development phase. This is the single source of
truth for "where the project currently stands" — for the team and for any AI assistant
(this one, or Codex) picking the project back up.*

## Completed
- Phase 0 — Environment audit
- Phase 1 — Foundation docs (PROJECT_SPEC, DATABASE_SCHEMA, TECHNICAL_ARCHITECTURE,
  DEVELOPMENT_PLAN, USER_FLOWS, UI_PLAN, CEP_REQUIREMENTS, README)
- Phase 2 — Static frontend shell: 12 pages, shared navbar/footer, reusable components,
  Leaflet+OSM map, client-side-only form validation, clearly-labeled mock data. Verified
  with a live headless-browser pass (zero console errors, zero overflow, 25/25 interaction
  checks across mobile/tablet/desktop). Full detail in `docs/PHASE_2_NOTES.md`.
- Phase 3 — Firebase Foundation:
  - `firebase/firestore.rules` — full security model (visitor/user/admin), no
    `allow read, write: if true` anywhere, validated for balanced syntax.
  - `firebase/firestore.indexes.json` — the one composite index the schema needs
    (`places`: `status` + `dietTags` array-contains), defined ahead of Phase 5.
  - `firebase.json` (project root) — wires the CLI to the files above plus
    `hosting.public: "frontend"`. Deliberately placed at the root rather than inside
    `firebase/`, see `docs/TECHNICAL_ARCHITECTURE.md` for why.
  - `frontend/js/firebase-config.js` — placeholder public web config (not a secret; see
    `docs/FIREBASE_SECURITY.md`), ready to be filled with real values.
  - `frontend/js/firebase-init.js` — the one place `initializeApp()` is called, exporting
    `getFirebaseAuth()`/`getFirebaseDb()`. **Not yet imported by any page.**
  - `docs/FIREBASE_SETUP.md`, `docs/FIREBASE_SECURITY.md` — setup guide + access-model docs.
  - Corrected two real schema issues: `reports.reason` value `closed` renamed to
    `place-closed`; added `places.submittedByName`/`reviews.authorName` (denormalized
    display names) so the UI doesn't need broad read access to `users`.
- Phase 3.5 — Architecture correction (during the Phase 4 audit): **removed Firebase
  Storage from the project entirely.** The project's media-storage plan changed to
  Cloudinary (a later, not-yet-implemented phase) partway through Phase 3, and Phase 3's
  own output hadn't caught up — `firebase-init.js` still imported/initialized
  `getStorage()`, `firebase/storage.rules` still existed, and `firebase.json` still had a
  `storage` section. All three are now removed, and every doc that described Firebase
  Storage as part of the stack (`README.md`, `TECHNICAL_ARCHITECTURE.md`,
  `FIREBASE_SETUP.md`, `FIREBASE_SECURITY.md`, `DATABASE_SCHEMA.md`, `DEVELOPMENT_PLAN.md`,
  `PHASE_2_NOTES.md`) has been corrected to say Firebase Auth + Firestore + Cloudinary
  (Cloudinary not yet implemented), not Firebase Storage. This was safe to do without a
  real Firebase project, since it's a codebase/documentation correction, not something
  that needs live testing.

## BLOCKED — Phase 4 (Authentication + User Profile) has NOT started
`frontend/js/firebase-config.js` still contains **all 6 placeholder values**
(`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId` are all
`REPLACE_WITH_YOUR_...`). No real Firebase Web app config has been inserted yet, even
though a real Firebase project (`vegansaathi-88d2f`) has reportedly been created.

**No authentication or user-profile code has been written or wired up.** Writing
`auth-service.js`, `user-service.js`, or connecting `login.html`/`register.html`/
`profile.html` to Firebase now — using placeholder credentials that cannot actually
authenticate anyone — would produce code nobody can verify works, and this project's own
Phase 4 instructions were explicit: do not pretend authentication is connected if the
configuration is missing. So none of it exists yet.

**To unblock:** paste the real config object from Firebase Console → Project settings →
General → Your apps → Web app → "SDK setup and configuration" into
`frontend/js/firebase-config.js`, replacing every placeholder. See
`docs/FIREBASE_SETUP.md` steps 1–2 (project/app already exist per this session — just the
config copy-paste and Auth/Firestore enablement, if not already done, remain).

## User Action Required (cannot be done from this environment)
1. Confirm Authentication is enabled in the Firebase Console for `vegansaathi-88d2f`
   (Email/Password + Google sign-in methods) — see `docs/FIREBASE_SETUP.md` step 3.
2. Confirm Firestore is enabled (production mode) — step 4.
3. **Paste the real Web app config into `frontend/js/firebase-config.js`** (this is the
   actual blocker — see above).
4. Install the Firebase CLI locally (`npm install -g firebase-tools`) — this sandbox has no
   outbound network access, so this genuinely could not be done here.
5. Run `firebase login`, then `firebase use --add` from the project root, selecting
   `vegansaathi-88d2f`.
6. Deploy the rules: `firebase deploy --only firestore:rules,firestore:indexes`.
7. Come back and ask for Phase 4 again — real authentication code can then be written and
   actually tested against the real project.

## Not Started
- Phase 4 — Authentication + User Profile (blocked, see above).
- Phase 5 — Places (Firestore-backed Explore/Place Details, replacing `mock-data.js`;
  real fieldwork seed data — see `docs/CEP_REQUIREMENTS.md`, do not fabricate this).
- Phase 6 — Community features (submit place, reviews, reports, saved places wired to
  Firestore).
- Phase 7 — Admin backend (real permission checks, moderation actions wired to Firestore).
- Phase 8 — Vegan awareness content sourcing/citation review.
- Phase 9 — QA pass, `docs/TEST_PLAN.md`/`docs/TEST_RESULTS.md`.
- Firebase Hosting deployment — deferred until there's real functionality beyond the
  Phase 2 static shell to serve.
- Cloudinary integration — not started; no upload code, presets, or credentials exist
  anywhere in this codebase.
- `docs/FIELDWORK_GUIDE.md`, `docs/COMMUNITY_SURVEY.md` — scheduled for Phase 5.
- `docs/AUTHENTICATION.md`, `docs/PHASE_4_TEST_RESULTS.md` — not created; would describe
  work that doesn't exist yet.

## Known Bugs
- None in existing (Phase 0–3) work. Phase 2's verification pass (see
  `docs/PHASE_2_NOTES.md`) found and fixed two real issues; the Phase 3.5 Storage removal
  was re-validated (JSON/JS syntax checks, see "Test Status") with zero regressions.

## Firebase Setup State
- **Rules and config: written, not yet deployed.** `firebase/firestore.rules` and
  `firebase/firestore.indexes.json` are ready but nothing has been pushed to Firestore yet.
- **Web app config: still placeholder.** See "BLOCKED" above — this is the actual gate on
  all of Phase 4.
- **No Storage.** Confirmed removed from `firebase-init.js`, `firebase.json`, and the
  `firebase/` folder — this project does not and will not use Firebase Storage.

## Test Status
- Phase 2: still green — JS syntax check and local-link-resolution check both pass.
- Phase 3: `firebase.json` and `firebase/firestore.indexes.json` are valid JSON.
  `firebase/firestore.rules` has balanced braces/parens/brackets and follows documented
  Rules v2 syntax. `firebase-config.js`/`firebase-init.js` pass `node --check`;
  `firebase-config.js` was actually imported as an ES module to confirm its exports.
  **Still not validated (no Firebase CLI/network access in this environment):** an actual
  `firebase deploy`, or the Firebase Console's own rules linter.
- Phase 3.5 (Storage removal): re-ran the JSON validity check on `firebase.json` and the
  `node --check` syntax check on `firebase-init.js` after editing both — both still pass.
  Confirmed `git rm` removed `firebase/storage.rules` cleanly.
- Phase 4: no tests — no code was written.

## Documentation Status
- Phase 1 docs: complete.
- Phase 2: `docs/PHASE_2_NOTES.md` complete (Storage references corrected).
- Phase 3: `docs/FIREBASE_SETUP.md` and `docs/FIREBASE_SECURITY.md` complete (Storage
  sections removed/replaced with the Cloudinary note); `docs/TECHNICAL_ARCHITECTURE.md`
  and `docs/DATABASE_SCHEMA.md` updated to match.
- `docs/FIELDWORK_GUIDE.md`, `docs/COMMUNITY_SURVEY.md`, `docs/TEST_PLAN.md`,
  `docs/TEST_RESULTS.md`, `docs/AUTHENTICATION.md`, `docs/PHASE_4_TEST_RESULTS.md`: not yet
  created.

## Next Task
- Complete the "User Action Required" steps above — specifically, paste the real Firebase
  Web config into `frontend/js/firebase-config.js` — then ask for Phase 4 again.
