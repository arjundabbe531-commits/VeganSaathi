# TECHNICAL_ARCHITECTURE.md — VeganSaathi

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | HTML5 + CSS3 + Vanilla JavaScript + Bootstrap | Team already knows HTML/CSS; no build pipeline to learn or debug under deadline |
| Map | Leaflet.js + OpenStreetMap | No billing-enabled API key required (unlike Google Maps JS API) |
| Auth | Firebase Authentication | Email/password + Google sign-in, no custom auth server |
| Database | Cloud Firestore | Serverless NoSQL, generous free tier, pairs natively with Auth |
| Media storage | Cloudinary (planned, later phase) | Place/review photos — **not Firebase Storage**, see note below |
| Hosting | Firebase Hosting | One project, one deploy command, free tier is enough for a CEP pilot |
| Backend server | **None (BaaS only)** | Firestore Security Rules + Cloud Functions (only if strictly needed later) replace a custom Node/Express server |

No MongoDB, PostgreSQL, MySQL, Express, Docker, or cloud infra beyond Firebase. If a real
server-side need appears later (e.g. sending an email notification), a single small Cloud
Function is preferred over standing up a separate server.

**Firebase Storage is deliberately not part of this project.** Media (place photos, and
any review/profile photos added later) will use Cloudinary instead, in a later phase — not
yet implemented as of Phase 4. This keeps the project on Firebase's Spark (free) plan,
since Firebase Storage requires the paid Blaze plan to use meaningfully. Nothing in this
codebase initializes, imports, or references Firebase Storage — `firebase-init.js`
exports only `getFirebaseAuth()`/`getFirebaseDb()`, and `firebase.json` has no `storage`
section.

## 2. High-Level System Diagram (textual)

```
Browser (HTML/CSS/JS + Bootstrap + Leaflet)
        |
        |  Firebase SDK (client-side calls)      Cloudinary (later phase, images only)
        v                                          ^
+-------------------------------------------+       |
|              Firebase Project              |------+
|  Authentication | Firestore                |
|  Hosting (serves the static frontend)       |
+-------------------------------------------+
```

There is no intermediate application server. The browser talks to Firebase directly
through the Firebase JS SDK, and Firestore Security Rules are the only access-control
layer — this is the standard, supported pattern for a BaaS architecture and is appropriate
for this project's scale.

## 3. Folder Structure

```
VeganSaathi/
├── docs/            → all planning/spec/status documentation
├── research/         → fieldwork templates, survey drafts, seed-data CSVs
├── frontend/          → HTML/CSS/JS source (pages, components, styles)
├── backend/            → reserved; only used if a Cloud Function becomes necessary
├── firebase/            → firestore.rules, firestore.indexes.json
├── firebase.json          → Firebase CLI entry config (project root — see note below)
├── assets/                → images/icons used by the frontend
└── README.md
```

**`firebase.json` lives at the project root, not inside `firebase/`.** The Firebase CLI
looks for `firebase.json` in the directory you run its commands from by default; keeping it
at the root means the team can just run `firebase deploy` from the project folder, instead
of typing `--config firebase/firebase.json` on every command. The actual rules and index
definitions still live in `firebase/`, as planned — `firebase.json` just points at them:

```json
{
  "firestore": { "rules": "firebase/firestore.rules", "indexes": "firebase/firestore.indexes.json" },
  "hosting": { "public": "frontend", "ignore": ["firebase.json", "**/.*", "**/node_modules/**"], "rewrites": [] }
}
```

There is no `storage` section — this project does not use Firebase Storage (see §1).

Frontend internal structure (Phase 2 pages + Phase 3 Firebase foundation):

```
frontend/
├── index.html
├── explore.html
├── place-details.html
├── submit-place.html
├── profile.html
├── saved.html
├── login.html
├── register.html
├── awareness/
│   ├── what-is-veganism.html
│   ├── vegetarian-vs-vegan.html
│   ├── misconceptions.html
│   ├── getting-started.html
│   ├── plant-based-indian-foods.html
│   └── faq.html
├── admin/
│   └── dashboard.html
├── css/
│   └── styles.css
└── js/
    ├── firebase-config.js      Public Firebase client config for project vegansaathi-88d2f.
    │                           Safe to commit — not a secret (see §4 Security Model).
    ├── firebase-init.js        The ONLY place initializeApp() is called. Exports
    │                           getFirebaseAuth() and getFirebaseDb().
    ├── auth-state.js           Single onAuthStateChanged subscription. Exports
    │                           onAuthChange(), getCurrentUser(), fetchUserProfile().
    ├── auth-ui.js              Firebase Auth/Firestore calls for register, login,
    │                           Google sign-in, password reset, logout.
    ├── app.js                  Loaded as ES module on every page. Injects navbar/footer,
    │                           subscribes to auth state, wires Logout.
    ├── components.js           Navbar, footer, place card, diet badge, verification
    │                           badge, and awareness sub-nav render helpers.
    │                           renderNavbar() is auth-aware and isAdmin-aware.
    │                           renderVerificationBadge() implements the 90-day
    │                           re-check-due cue (display-only — never writes Firestore).
    ├── places-service.js       Centralized Firestore data-access layer for places.
    │                           Exports: PILOT_BOUNDS, normalizePlace(),
    │                           fetchPublishedPlaces(), fetchPlaceById(),
    │                           submitNewPlace(), submitReview(), deleteReview(),
    │                           submitReport(), savePlace(), unsavePlace(),
    │                           getSavedPlaces(), getUserSubmissions(), getUserReviews().
    ├── admin-service.js        Admin-only Firestore operations. All functions call
    │                           checkIsAdmin() first. Exports: fetchAdminOverviewStats(),
    │                           fetchPendingSubmissions(), approvePlace(), rejectPlace(),
    │                           fetchPublishedPlacesForAdmin(), updatePlaceByAdmin(),
    │                           reverifyPlace(), fetchAdminReports(), resolveReport(),
    │                           dismissReport(), fetchAdminReviews(), deleteReviewByAdmin(),
    │                           fetchAdminUsersList().
    ├── explore.js              Explore page controller. Calls fetchPublishedPlaces(),
    │                           applies client-side search/filter/sort, manages
    │                           Leaflet vsMarkersLayer via layerGroup.
    ├── place-details.js        Place Details page controller. Calls fetchPlaceById(),
    │                           handles reviews, reports, save/unsave. All contribution
    │                           actions gated behind auth.
    ├── submit-place-guard.js   Auth guard + form controller for submit-place.html.
    │                           Calls submitNewPlace(); validates coords against
    │                           PILOT_BOUNDS; includes Leaflet coordinate picker.
    ├── profile-page.js         Profile page controller. Loads users/{uid} document;
    │                           renders submissions and reviews tabs.
    ├── saved-page.js           Saved Places page controller. Calls getSavedPlaces();
    │                           renders saved place cards.
    ├── admin-dashboard.js      Admin Dashboard controller. Renders all admin tabs;
    │                           calls admin-service.js for all moderation actions.
    └── mock-data.js            DEV-ONLY mock data (clearly labeled [MOCK] in every
                                place name). Used only by test suites; no production
                                page loads it for real content. Must be removed before
                                the live CEP demo.
```

Every page loads `app.js` as `<script type="module">`, since it imports from `auth-state.js`
(which imports from `firebase-init.js`) and from `auth-ui.js` (to reuse the one real
`logoutUser()`/`signOut()` implementation). `mock-data.js` and `components.js` are still
loaded as plain classic scripts *before* `app.js` in every page, so their globals
(`renderNavbar`, `MOCK_PLACES`, etc.) are already on `window` by the time the module scripts
that follow them run — see `docs/AUTHENTICATION.md` for the full reasoning and
`docs/PHASE_4_TEST_RESULTS.md` for how this was verified.

## 4. Security Model (summary — full rules live in `firebase/firestore.rules`; full
explanation in `docs/FIREBASE_SECURITY.md`)

- Firebase's client-side config object (API key, project ID, etc.) is **safe to include in
  frontend code** — it identifies the project, it does not authorize access. Actual access
  control is enforced entirely by Firestore Security Rules, not by hiding the config.
- Never set `allow read, write: if true;` in production rules — and this project's rules
  don't, anywhere.
- Visitors (unauthenticated): read published places, read reviews, read awareness content
  (the awareness pages are static HTML, not Firestore data, so they need no rule at all).
- Authenticated users: create their own reviews/submissions/reports/saved places; update
  only their own profile's editable fields; cannot set `role`, `status`, or
  `verificationStatus` themselves — enforced field-by-field in the rules, not just hidden
  in the UI.
- Admin (`role == "admin"` on their own `users` doc, read server-side by the rule via
  `get()` — never trusted from the client's request payload): can update `places.status`,
  `places.verificationStatus`, `places.lastVerifiedAt`, `reports.status`; can delete
  reviews and places.
- `places.submittedByName` / `reviews.authorName` store a denormalized display name at
  write time, specifically so the `users` collection's read rule can stay narrow (owner +
  admin only) without breaking the UI's need to show "submitted by X" / a reviewer's name —
  see `docs/FIREBASE_SECURITY.md` for the full reasoning.
- Real `.env`/secret values (if any Cloud Function is added later) are never committed —
  `.gitignore` excludes them, and `.firebaserc` too (it's project-specific, not something
  to share via Git — each teammate creates their own via `firebase use --add`).

## 5. Why This Architecture Fits a Semester-3 CEP

- Every layer is either something the team already knows (HTML/CSS/JS) or a managed
  service with strong official documentation (Firebase).
- No server to provision, patch, or keep running for the demo.
- Firestore's document model maps directly onto the six collections in
  `DATABASE_SCHEMA.md` with no ORM or migration tooling needed.
- Deployment is `firebase deploy` — a single command a student can run and re-run.
