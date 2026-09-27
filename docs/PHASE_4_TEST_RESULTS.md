# PHASE_4_TEST_RESULTS.md — VeganSaathi

## Environment constraint, stated plainly

This sandbox has **no outbound network access** — not to npm, not to Firebase's real
servers, not to the CDN hosts these pages load from in production. That means the tests
below could not run against the real `vegansaathi-88d2f` Firebase project, and nothing
here should be read as "verified end-to-end against real Firebase." What follows is what
*was* actually verified, using two independent methods, and — separately — what still
needs a real browser with real internet access to confirm.

## Method 1 — Static checks (no browser)

| Check | Result |
|---|---|
| `node --check` on every `.js` file in `frontend/js/` | All pass |
| HTML tag-balance check across all 12 pages | No mismatches |
| Every local `href`/`src` resolves to a real file | No broken links |

## Method 2 — Headless-browser test against a stub Firebase SDK

Since the real Firebase servers aren't reachable here, a stub SDK was built matching the
**exact export names and call signatures** this codebase actually uses (`initializeApp`,
`getAuth`, `getFirestore`, `onAuthStateChanged`, `signOut`,
`createUserWithEmailAndPassword`, `signInWithEmailAndPassword`, `sendPasswordResetEmail`,
`signInWithPopup`, `GoogleAuthProvider`, persistence functions, `doc`/`getDoc`/`setDoc`/
`serverTimestamp`). A real headless Chromium (via Playwright) then loaded the actual,
unmodified project pages over `localhost`, with only the CDN network requests intercepted
and redirected to this stub — application code was not changed to make this possible.

This proves the actual code executes correctly against an SDK with the real shape — it
does **not** prove Firebase's real servers will accept the writes, that the real
`vegansaathi-88d2f` project's rules are deployed correctly, or that a real Google OAuth
popup completes correctly. Those need a real browser and a real internet connection.

**34 checks, all passing** (30 from the original Phase 4 pass, plus 4 added during a
follow-up cleanup pass — see "Cleanup pass" below):

**Signed-out scenario (9 checks)** — navbar shows Login/Register; Profile shows a sign-in
prompt; Saved Places shows a sign-in prompt; Submit Place's submit button is disabled with
an explanatory note; Place Details' Save/Review/Report controls are all disabled; zero
uncaught page errors; zero console errors.

**Signed-in scenario (13 checks)** — navbar shows Profile/Logout (and not Login); Profile
loads and displays the correct name/email/diet from the stub Firestore document; Saved
Places shows its content; Submit Place's button is enabled; Place Details' Save/Review/
Report controls are enabled, the Save button actually toggles state on click, and a valid
review/report submission reaches the expected "Phase 6" demo message (not an auth-required
message); clicking Logout actually calls the stub's `signOut()` and the navbar flips back
to the logged-out state **live, with no page reload**; zero uncaught errors; zero console
errors.

**Edge case (2 checks)** — a Firebase Auth user with no matching Firestore profile document
(shouldn't normally happen, but `profile-page.js` has an explicit path for it) shows a
clear error message rather than silently rendering blank fields; zero uncaught errors.

**Auth flow checks (9 checks)** — registration with valid input shows a success message and
actually attempts a `users/{uid}` Firestore write with `role` hard-coded to `"user"` and
the chosen `dietPreference` field correctly named and valued; login with valid credentials
shows a success message; the Google sign-in button no longer shows the stale "coming in
Phase 4" label and isn't disabled by default; clicking it completes and shows a success
message; zero uncaught errors across the whole flow.

## Cleanup pass (post-implementation)

A follow-up pass synchronized documentation with the actual code and fixed one small UI
edge case, per its own explicit request. Four new checks were added to the same stub-SDK
suite to cover it directly, rather than taking the fix on faith:

- **Bug**: `profile.html`'s error message (shown when a signed-in user has no matching
  Firestore profile) was never cleared on sign-out — a stale error could sit on screen
  underneath the "please sign in" prompt after logging out.
- **Fix**: `profile-page.js` now clears the error at the start of every auth-state
  transition (`hideError()`), before deciding what to render next — covering both signing
  out and starting a fresh profile load.
- **New checks (4)**: sign in as an "orphan" stub user with no profile (confirms the error
  shows, as a precondition) → call the real `logoutUser()` against the reactive stub →
  confirm the error is now hidden and the signed-out prompt shows in its place → confirm
  zero uncaught errors through the whole sequence. All 4 pass.
- `docs/TECHNICAL_ARCHITECTURE.md` was also resynchronized with the actual current file
  list (`auth-state.js`, `profile-page.js`, `saved-page.js`, `submit-place-guard.js`, etc.)
  — it previously still described Phase-3-era placeholders and two files
  (`auth-service.js`, `user-service.js`) that were never actually created under those
  names.

## A real bug this testing found and the fix

While reviewing `logoutUser()` line by line (not caught by the stub test until after the
fix was already applied, since the fix was made during code review before the stub
existed), it called `auth.signOut()` — the Firebase v8 namespaced API. This project loads
the pure v9+ modular SDK, where the `Auth` object returned by `getAuth()` has **no**
`signOut` instance method; only the standalone `signOut(auth)` function exists. Confirmed
against Firebase's own current documentation (`firebase.google.com/docs/auth/web/...`, and
a migration guide showing the exact `auth.signOut()` → `signOut(auth)` change). As written,
clicking Logout in a real browser would have thrown `TypeError: auth.signOut is not a
function` and left the user stuck signed in with a broken button. Fixed by importing
`signOut` from `firebase-auth.js` and calling `signOut(auth)`.

## Security / ownership review (Section 9)

`firebase/firestore.rules` was reviewed against the actual write shapes used by the Phase 4
code — not modified, because it already matched:

- `users.create` requires `role == "user"` and a valid `dietPreference` — matches exactly
  what `createUserProfile()`/`ensureGoogleUserProfile()` write. A user cannot register as
  admin; there is no UI path that would even attempt it.
- `users.update` requires the role field to stay equal to its previous value — a signed-in
  user cannot change their own role via any client write, full stop (there's no profile-
  edit feature yet in the UI to even try this through, but the rule holds regardless of
  what the UI does or doesn't expose).
- `users.read` only allows the document's own owner or an admin — `fetchUserProfile()`
  will only ever succeed for the signed-in visitor's own uid, confirmed by construction
  (the code always calls it with `user.uid` from the current auth state, never an
  arbitrary id).
- No rule needed tightening. No rule was weakened.

## What still needs a real browser + real internet connection

- An actual registration against `vegansaathi-88d2f`, confirming the Firebase Auth user
  and the `users/{uid}` Firestore document both really appear in the Firebase Console.
- An actual login, logout, and page-refresh-while-logged-in (confirming persisted session
  behavior the stub can't simulate).
- An actual password-reset email arriving in a real inbox.
- An actual Google OAuth popup completing end-to-end.
- Responsive layout eyeballed in a real browser (the stub tests checked functional
  state, not visual layout, beyond the screenshots taken in this sandbox using the same
  stub).
- Browser console checked for any warning this stub wouldn't surface (e.g. a real Firebase
  SDK deprecation notice).

## Verdict

Phase 4's core logic is implemented, internally consistent, and passes every test this
sandbox can actually run — including one genuine bug found and fixed. It should **not**
be marked fully complete until the real-browser pass above happens against the live
Firebase project.
