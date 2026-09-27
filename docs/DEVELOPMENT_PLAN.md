# DEVELOPMENT_PLAN.md — VeganSaathi

Work proceeds in phases. Each phase ends with something runnable/testable before the next
begins. Do not skip ahead to later phases while an earlier one is incomplete.

## Phase 0 — Environment Audit ✅ (this session)
- Confirmed empty workspace, no existing VeganSaathi project.
- Confirmed available tooling: Node v22, Git, Python 3.12; no Firebase CLI / no network
  install access in this analysis session (install it in your actual local/Codex
  environment).
- Created folder structure.

## Phase 1 — Product & Architecture Docs ✅ (this session)
- `PROJECT_SPEC.md`, `DATABASE_SCHEMA.md`, `TECHNICAL_ARCHITECTURE.md`,
  `DEVELOPMENT_PLAN.md`, `USER_FLOWS.md`, `UI_PLAN.md`, `CEP_REQUIREMENTS.md`, `README.md`.

## Phase 2 — Base Frontend (static, mock data) ✅ complete, verified
- Common navbar, footer, responsive layout (Bootstrap grid).
- Homepage (hero, mission, "Explore" CTA, awareness teaser).
- Explore page shell with hardcoded/mock place cards (no Firebase yet).
- Place Details shell.
- Login/Register screens (UI only, no working auth yet).
- **Exit test:** every page renders correctly and responsively at desktop, ~768px, and
  mobile widths with no horizontal overflow. — **Passed**, verified with a real headless
  browser (see `docs/PHASE_2_NOTES.md`), zero overflow/console errors across all 12 pages.

## Phase 3 — Firebase Project Setup ✅ foundation complete — real project creation is a user action
- Create Firebase project, enable Authentication, Firestore, Hosting (not Storage — this
  project uses Cloudinary for media instead, see `docs/TECHNICAL_ARCHITECTURE.md` §1). —
  **User
  action required**, see `docs/FIREBASE_SETUP.md` and `docs/PROJECT_STATUS.md`; cannot be
  done from this sandbox (no outbound network access).
- Add `firebase-config.js` (public config, not a secret). — **Done**, placeholder values
  ready for the real project's config.
- Write initial `firestore.rules` (locked down, not `allow read, write: if true`). —
  **Done**, plus `storage.rules` and `firestore.indexes.json`. Full model documented in
  `docs/FIREBASE_SECURITY.md`.
- **Exit test:** `firebase deploy` succeeds and serves the Phase 2 static pages. — **Not
  yet attempted**; requires the Firebase CLI and a real project (see "User Action
  Required" in `docs/PROJECT_STATUS.md`). Hosting deploy is intentionally deferred past
  this phase regardless — see Phase 3's scope note below.

## Phase 4 — Authentication ⚙️ IN PROGRESS — core flows implemented and tested; QA still pending
- Register, login, logout, password reset, auth-state listener. — **Register, login,
  Google sign-in, and password reset are implemented** (`auth-ui.js`). **Auth-state
  listener, dynamic navbar, and logout are implemented** (`auth-state.js`, `app.js`).
- Gate contribution actions (submit/review/report/save) behind login; browsing stays open.
  — **Implemented**: Submit Place, Save/Review/Report on Place Details, and the whole
  Profile/Saved Places pages are all gated (disabled controls or a sign-in prompt),
  everything else stays open to visitors.
- **Exit test:** a fresh account can register, log in, log out, reset password; an
  unauthenticated visitor can still browse Explore/Place Details. — **Verified as far as
  this sandbox allows**: a stubbed-Firebase-SDK test suite (34 checks) confirms the
  register/login/Google/logout code paths execute correctly and the navbar/guards update
  live with zero console errors, across signed-out, signed-in, and orphaned-profile
  scenarios. **Not yet verified**: an actual run against the real `vegansaathi-88d2f`
  project in a real browser (this sandbox has no outbound network access to reach Firebase
  itself) — see `docs/PHASE_4_TEST_RESULTS.md` for exactly what was and wasn't tested, and
  do this real-browser pass before marking Phase 4 fully complete.
- Real bug found and fixed during this pass: `logoutUser()` called `auth.signOut()` (the
  old v8 namespaced API), which does not exist on the modular `Auth` object this project
  uses — clicking Logout would have thrown `TypeError: auth.signOut is not a function`.
  Fixed to `signOut(auth)`. See `docs/PHASE_4_TEST_RESULTS.md`.

## Phase 5 — Places (core feature)
- Firestore `places` collection wired to Explore page (replace mock data).
- Seed data entered manually from `research/place_data_template.csv` (real fieldwork only —
  see `CEP_REQUIREMENTS.md`).
- Search + filter by diet tag, place type, price range.
- Leaflet/OSM map view alongside list view.
- Place Details page pulling real Firestore data, showing "last verified" date.
- **Exit test:** filtering and search return correct results against real seed data; map
  pins match list entries.

## Phase 6 — Community Features
- Submit New Place form → writes with `status: "pending"`.
- Reviews (create, list on Place Details, author-only delete).
- Report Incorrect Information form.
- Saved Places (simple add/remove, shown on Profile).
- **Exit test:** a submitted place does NOT appear on public Explore until approved;
  reviews/reports/saved-places all respect the security rules from Phase 3.

## Phase 7 — Admin
- Admin auth check (role field on `users` doc).
- Dashboard: pending places (approve/reject/edit), published places (edit/disable, mark
  re-verified), reports queue (resolve/dismiss), review moderation (remove).
- **Exit test:** a non-admin account cannot reach or use any admin action, even by
  directly calling the same Firestore write (verified against the security rules, not
  just hidden UI).

## Phase 8 — Vegan Awareness Content
- What is Veganism, Vegetarian vs Vegan, Common Misconceptions, Getting Started,
  Plant-Based Indian Foods, FAQ — static pages, clearly sourced, no medical claims.

## Phase 9 — QA
- Systematic pass over auth, permissions, forms/validation, reads/writes, filters, map,
  reviews, reports, admin actions, responsive layout, and security rules.
- Record results in `docs/TEST_RESULTS.md` (created at this phase).

## Ongoing Throughout
- Update `PROJECT_STATUS.md` at the end of every phase.
- Meaningful Git commits per phase (see `README.md` for suggested messages).
- No secrets committed; `.gitignore` maintained from Phase 3 onward.

## Explicitly Deferred (not this semester)
Dish-level tagging, Marathi/Hindi phrase-card tool, ingredient decoder, event/RSVP tool,
expansion beyond Shegaon, food-donation logistics.
