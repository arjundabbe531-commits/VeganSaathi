# PROJECT_STATUS.md — VeganSaathi

*Update this file at the end of every development phase. This is the single source of
truth for "where the project currently stands" — for the team and for any AI assistant
(this one, or Codex) picking the project back up.*

## Completed
- Phase 0 — Environment audit
- Phase 1 — Foundation docs
- Phase 2 — Static frontend shell (12 pages, mock data, components, Leaflet map).
  Verified with a live headless-browser pass. See `docs/PHASE_2_NOTES.md`.
- Phase 3 — Firebase Foundation: `firebase/firestore.rules`, `firebase/firestore.indexes.json`,
  `firebase.json`, `firebase-config.js`/`firebase-init.js` scaffolding, `docs/FIREBASE_SETUP.md`,
  `docs/FIREBASE_SECURITY.md`. Firebase Storage was later removed from the architecture
  entirely — this project uses Cloudinary (not yet implemented) for media instead.

## In Progress — Phase 4 (Authentication + User Profile)

**Real Firebase project connected.** `frontend/js/firebase-config.js` holds real values for
project `vegansaathi-88d2f` (confirmed present, values not reproduced here — see
`docs/FIREBASE_SECURITY.md` for why that's fine to keep in the repo).

**Implemented and passing a stubbed-SDK test suite (34 checks — see
`docs/PHASE_4_TEST_RESULTS.md` for exactly what that does and doesn't prove):**
- Email/password registration, writing `users/{uid}` with `role` hard-coded to `"user"`.
- Email/password login, with Remember-me controlling session persistence.
- Google sign-in, creating a profile only on first sign-in (never overwriting an existing
  one).
- Password reset.
- Logout.
- A shared `onAuthChange` listener (`auth-state.js`) driving a navbar that switches between
  Login/Register and Profile/Logout **live, without a page reload**.
- A real Firestore-backed Profile page (`profile-page.js`), replacing the old Phase 2 mock
  data entirely, including an explicit error state for the (shouldn't-normally-happen) case
  of a signed-in user with no Firestore profile document.
- Authentication guards on Submit Place, Save/Review/Report (Place Details), and the whole
  Saved Places page — disabled controls with explanatory text when signed out; the guard
  re-checks at the moment of the actual click/submit, not just at page load.

**Cleanup pass:** `docs/TECHNICAL_ARCHITECTURE.md` resynchronized with the actual current
file list (it still described Phase-3-era placeholders and two files that were never
actually created under those names). A real UI bug found and fixed: `profile.html`'s error
message wasn't cleared on sign-out, so a stale error could sit on screen underneath the
"please sign in" prompt — `profile-page.js` now clears it at the start of every auth-state
transition. 4 new tests confirm the fix; see `docs/PHASE_4_TEST_RESULTS.md`.

**A real bug found and fixed:** `logoutUser()` called the old v8 `auth.signOut()`, which
does not exist on this project's modular `Auth` object — clicking Logout would have thrown
a runtime error. Fixed to the modular `signOut(auth)`. Full detail in
`docs/PHASE_4_TEST_RESULTS.md`.

**Two smaller issues found and fixed:**
- `submit-place.html` loaded `auth-ui.js` (which uses ES `import`) as a classic script —
  a hard syntax error that silently broke the page. Replaced with a dedicated
  `submit-place-guard.js`, loaded correctly as a module.
- `login.html`'s Google button still had Phase-2 leftover `disabled`/"coming in Phase 4"
  markup (JS patched it at runtime, but was fragile). Cleaned up directly in the HTML.

**Stale documentation corrected:** `firebase-config.js` and `firebase-init.js` header
comments no longer claim placeholder config / "not yet imported" / reference the deleted
`firebase/storage.rules`.

## NOT YET DONE — before Phase 4 can be marked fully complete
Everything above was verified with static checks and a stubbed-Firebase-SDK headless-browser
test suite in a sandbox with no outbound network access. **None of it has been run against
the real `vegansaathi-88d2f` project in a real browser yet.** Specifically still needed:
1. A real registration, confirmed in the Firebase Console (Authentication tab + Firestore
   `users` collection).
2. A real login, logout, and refresh-while-logged-in.
3. A real password-reset email, confirmed received.
4. A real Google OAuth sign-in, completed end-to-end.
5. A manual responsive check (mobile/tablet/desktop) in an actual browser.
6. A check of the actual browser console for anything the stub test couldn't surface.

## Not Started
- Phase 5 — Places (Firestore-backed Explore/Place Details; real fieldwork seed data — see
  `docs/CEP_REQUIREMENTS.md`, do not fabricate this).
- Phase 6 — Community features (submit place, reviews, reports, saved places wired to
  Firestore for real; Cloudinary image upload).
- Phase 7 — Admin backend (real permission checks, moderation actions; admin-aware navbar
  item; route protection for `admin/dashboard.html` — none of this exists yet, it's a
  static shell with mock data and no auth check at all).
- Phase 8 — Vegan awareness content sourcing/citation review.
- Phase 9 — QA pass, `docs/TEST_PLAN.md`.
- Profile editing (name/diet preference are currently read-only after registration).
- Firebase Hosting deployment.

## Known Bugs
- None outstanding. See "In Progress" above for what was found and fixed this phase.

## Firebase Setup State
- Real project (`vegansaathi-88d2f`) connected, real config in `firebase-config.js`.
- `firebase/firestore.rules` reviewed against Phase 4's actual code and found to already be
  correct — not modified.
- Still unconfirmed from this sandbox: whether rules have actually been deployed
  (`firebase deploy --only firestore:rules,firestore:indexes`) — do this if it hasn't
  happened yet, since Firestore defaults to denying everything until rules are deployed.
- No Firebase Storage anywhere in the codebase (confirmed via full-repo search).

## Test Status
See `docs/PHASE_4_TEST_RESULTS.md` for the complete breakdown (static checks, the 34-check
stubbed-SDK browser suite, the security/ownership review, and exactly what still needs a
real browser).

## Documentation Status
- Phase 1–3 docs: complete, Storage references removed.
- Phase 4: `docs/AUTHENTICATION.md` (architecture) and `docs/PHASE_4_TEST_RESULTS.md`
  (test results) created. `docs/DEVELOPMENT_PLAN.md` updated to reflect actual Phase 4
  progress.
- Still not created: `docs/FIELDWORK_GUIDE.md`, `docs/COMMUNITY_SURVEY.md`,
  `docs/TEST_PLAN.md` — scheduled for Phases 5/9.

## Next Task
1. Run the real-browser checks listed under "NOT YET DONE" above, against the real
   Firebase project.
2. Once those pass, mark Phase 4 complete and begin Phase 5 — Places.
