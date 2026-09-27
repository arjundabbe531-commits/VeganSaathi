# AUTHENTICATION.md — VeganSaathi

How authentication and the user profile actually work, as of Phase 4. Read this before
changing any of `auth-ui.js`, `auth-state.js`, `firebase-init.js`, or the pages that use
them.

## Architecture at a glance

```
firebase-init.js  ──centralizes──>  initializeApp / getAuth / getFirestore
        │
        ├── auth-ui.js       — registration, login, Google sign-in, password reset, logout
        │                      (owns the actual Firebase Auth + Firestore write calls)
        │
        └── auth-state.js    — the ONE onAuthStateChanged subscription, shared by every
                                 page (navbar, guards, profile) via onAuthChange()/
                                 getCurrentUser()/fetchUserProfile()
```

Every page loads `app.js` as an ES module, which imports `onAuthChange` from
`auth-state.js` (to keep the navbar in sync) and `logoutUser` from `auth-ui.js` (to reuse
the one real `signOut()` implementation — see "Logout" below). Because ES modules are
cached per URL by the browser, importing `auth-ui.js` from multiple places (a direct
`<script type="module">` tag on `login.html`/`register.html`, plus the transitive import
from `app.js` on every page) does **not** re-run its setup twice or attach duplicate
listeners — the module executes once per page load no matter how many places import it.

## Registration (`register.html` → `auth-ui.js`)

1. Client-side validation: all fields present, password ≥ 6 characters, password matches
   confirmation.
2. `createUserWithEmailAndPassword(auth, email, password)` creates the Firebase Auth
   account.
3. `createUserProfile()` then writes `users/{uid}` in Firestore with `uid`, `name`, `email`,
   `dietPreference`, `role: "user"` (hard-coded — there is no UI path to choose any other
   role), and `createdAt: serverTimestamp()`.
4. **If step 3 fails after step 2 succeeded** (e.g. a Firestore rule rejects the write), the
   user is told plainly that their account was created but the profile could not be saved —
   never told the whole thing "succeeded" when it didn't. This is deliberate: an Auth
   account with no matching Firestore profile is a real, visible inconsistency, not a
   silently swallowed error.
5. On full success, a message is shown and the page redirects to `index.html` after 700ms —
   a real navigation, not a fake state change. Firebase's own session persistence means the
   fresh page load's `onAuthStateChanged` immediately reports the new signed-in state.

## Login (`login.html` → `auth-ui.js`)

Straightforward `signInWithEmailAndPassword`. The "Remember me" checkbox controls
`setPersistence()`: checked uses `browserLocalPersistence` (survives closing the browser),
unchecked uses `browserSessionPersistence` (cleared when the tab/browser closes).

## Google sign-in (`login.html` → `auth-ui.js`)

`signInWithPopup` with `GoogleAuthProvider`. `ensureGoogleUserProfile()` checks whether
`users/{uid}` already exists before writing anything — a returning Google user's existing
`role`, `dietPreference`, and `createdAt` are never overwritten. A first-time Google user
gets a profile with `dietPreference: "unspecified"` (there's no diet-picker step in the
Google flow) and `role: "user"` — they can set a real preference later once profile editing
exists (a later phase).

## Password reset (`login.html` → `auth-ui.js`)

`sendPasswordResetEmail(auth, email)`. Requires the email field to be filled first (it
reuses the login form's own email input rather than a separate reset form). Success and
failure both show a message via the login page's existing feedback area.

## Logout (`app.js` + `auth-ui.js`)

`logoutUser()` in `auth-ui.js` calls `signOut(auth)` — the **standalone modular function**,
not `auth.signOut()`. This distinction matters: this project loads the pure modular
Firebase SDK (`firebase-auth.js` from the CDN, not the `-compat` build), and the `Auth`
object returned by `getAuth()` has no `signOut` method of its own in that build. Calling
`auth.signOut()` throws `TypeError: auth.signOut is not a function` — this was a real bug
found and fixed during the Phase 4 audit (see `docs/PHASE_4_TEST_RESULTS.md`).

`app.js` attaches the click handler to the navbar's Logout button fresh every time the
navbar re-renders (since `renderNavbar()` replaces the button's HTML each time auth state
changes). After `logoutUser()` resolves, nothing else needs to happen manually — Firebase's
own `onAuthStateChanged` fires with `null`, and every page's `onAuthChange` subscribers
(the navbar, and any guard on the current page) react to that automatically.

## Authentication state (`auth-state.js`)

A single shared module wrapping `onAuthStateChanged`:

- `onAuthChange(callback)` — subscribes; calls back immediately with whatever's already
  known, and again on every future change. This is what the navbar and every page guard
  use.
- `getCurrentUser()` — a synchronous snapshot, for checking "is anyone signed in right
  now?" inside a click handler (e.g. the Submit Place form re-checks at submit time, not
  just at page load, in case someone signed out in another tab).
- `fetchUserProfile(uid)` — reads `users/{uid}` from Firestore. Used by `profile-page.js`.

Only one real `onAuthStateChanged` listener is ever attached per page load — `auth-state.js`
starts it once (`startListenerOnce()`) and fans the result out to as many subscribers as
that page needs, rather than each page/feature calling `onAuthStateChanged` itself.

## Navbar (`components.js` + `app.js`)

`renderNavbar(activePage, user)` renders Login+Register when `user` is falsy, or
Profile+Logout when it's a Firebase Auth `User` object. `app.js` renders once immediately
in the logged-out shape (so the page never shows a blank navbar while Firebase resolves),
then re-renders with the real state as soon as `onAuthChange`'s first callback fires, and
again on every subsequent sign-in/sign-out — without ever reloading the page.

## Profile page (`profile.html` + `profile-page.js`)

Three states, switched purely by CSS class (`d-none`), no separate routing:

- **Not yet known** (Firebase hasn't reported in): a "Loading your profile..." message.
- **Signed out**: a sign-in prompt card with Login/Register buttons.
- **Signed in**: the real `users/{uid}` document, rendered via `fetchUserProfile()`. If a
  signed-in Auth user somehow has no matching Firestore document (shouldn't normally
  happen — see the registration failure-handling above), an explicit error is shown rather
  than blank fields.

Every `onAuthChange` callback clears any previously shown error first, before deciding
which of the three states to render — so an error from a past attempt (e.g. a failed
load) never lingers on screen after signing out, signing back in, or Firebase reporting a
fresh state.

"My Submissions" and "My Reviews" show a plain "not built yet" note — those collections
don't exist until Phase 6, so there's nothing real to show, and showing mock data here
would misrepresent what the account actually has.

## Protected actions (Submit Place, Save/Review/Report on Place Details)

These live on pages with other legitimate public content (the form itself, the place's
details), so instead of hiding the whole page, the specific action control is **disabled**
with a `title` explaining why — the same pattern already used elsewhere in this app (the
Google button used to use it for a different reason; the Profile page's "Edit Profile"
button still does). Each handler also re-checks `getCurrentUser()` at the moment it runs,
not just at page load, since a control's disabled state and the actual auth state could
theoretically drift apart for a moment (e.g. multi-tab sign-out).

**This is UI convenience, not the security boundary.** The actual authorization is
`firebase/firestore.rules` — see `docs/FIREBASE_SECURITY.md`. A disabled button stops a
casual visitor from clicking; it does nothing to stop someone from calling the Firestore
SDK directly from the browser console. The rules are what actually stop that, and they
were reviewed (not changed — they already matched) during this phase; see
`docs/PHASE_4_TEST_RESULTS.md`.

## Saved Places page (`saved.html` + `saved-page.js`)

The whole page is the protected view (unlike Submit Place / Place Details, there's no
separate "public" content to preserve here), so it's gated at the page level: a sign-in
prompt replaces the entire content area when signed out. The actual saved-places data
shown when signed in is still local mock data reset from `MOCK_SAVED_PLACES` — real
per-user persistence is Phase 6.

## What Phase 4 deliberately does not do

- No real Firestore-backed Places/Reviews/Reports/Saved-Places data — Phases 5/6.
- No admin-specific navbar item or admin route protection — Phase 7.
- No profile editing (name/diet preference are read-only after registration) — a later
  phase.
- No Cloudinary/photo upload — a later phase; the disabled file input on Submit Place
  already says so.
