# PHASE_2_NOTES.md — Static Frontend Shell

## What Was Built
A fully navigable, responsive static frontend for VeganSaathi using HTML5, CSS3, vanilla
JavaScript, Bootstrap 5, and Leaflet + OpenStreetMap. No backend, no Firebase, no real
authentication or persistence — everything runs against in-memory mock data.

## Files Created

```
frontend/
├── index.html                       Home page
├── explore.html                     Search/filter + list/map view
├── place-details.html               Place detail, reviews, report/save UI
├── login.html                       Login UI (validation only)
├── register.html                    Register UI (validation only)
├── submit-place.html                Submit-a-place form (validation only)
├── profile.html                     Mock signed-in profile
├── saved.html                       Saved places (local-only toggle)
├── awareness/
│   ├── what-is-veganism.html
│   ├── vegetarian-vs-vegan.html
│   └── faq.html
├── admin/
│   └── dashboard.html               Admin shell, mock stats/tables, all actions disabled
├── css/styles.css                   Full visual identity (see below)
└── js/
    ├── app.js                       Injects navbar/footer on every page
    ├── mock-data.js                 All mock places/reviews/users/reports, clearly labeled
    ├── components.js                renderNavbar, renderFooter, renderPlaceCard,
    │                                 renderDietBadges, renderVerificationBadge, renderReviewCard
    ├── explore.js                   Search/filter logic + Leaflet map for Explore
    ├── place-details.js             Reads ?id= from URL, renders detail + reviews + map
    └── auth-ui.js                   Client-side-only validation for login/register/submit
```

## Key UI Decisions

- **Shared navbar/footer via JS injection, not copy-pasted HTML.** Every page has a
  `<div id="navbar-placeholder">` / `<div id="footer-placeholder">`, filled by
  `components.js` + `app.js`. Each page sets `window.VS_BASE` (`""` at root, `"../"` one
  folder deep) so the same render functions produce correct relative links everywhere.
- **Diet badges are color-coded but always paired with text** (vegan/vegetarian/
  eggetarian/Jain), per `docs/UI_PLAN.md`'s accessibility requirement — never color alone.
- **"Last verified" trust indicator** is visually distinct from diet badges (a colored dot
  + muted date text) and every instance includes a disclaimer that it isn't a permanent
  guarantee, matching the "no exaggerated claims" instruction.
- **Every not-yet-wired action says so explicitly** (login, register, submit place, write
  review, report, admin buttons) instead of silently doing nothing or pretending to save —
  e.g. "Demo: this report will be connected to the admin review queue in a later phase.
  Nothing was saved."
- **All admin action buttons are visually disabled** with a title attribute explaining why,
  rather than looking clickable and doing nothing.

## Mock Data

All mock data lives in one file, `js/mock-data.js`, with a large comment block at the top
and `[MOCK]` prefixes on every name so it can never be mistaken for real fieldwork data.
Covers 6 places, 4 reviews, 1 sample user profile, sample submissions/saved places, and
sample admin stats/pending queue/reports.

## Known Limitations (expected at this phase)

- No real authentication, persistence, or backend — by design, per Phase 2 scope.
- Bootstrap and Leaflet are loaded from CDNs (jsdelivr / unpkg), so an internet
  connection is required to see the pages styled/mapped correctly in a browser — this
  matches the approved stack in `docs/TECHNICAL_ARCHITECTURE.md`.
- Photo upload inputs are present but disabled (no media upload service is connected yet; planned via Cloudinary in a later phase, not Firebase Storage — see docs/TECHNICAL_ARCHITECTURE.md).
- Awareness page content is a starting draft, flagged for source review before final
  submission — see `docs/CEP_REQUIREMENTS.md`.

## Tests Performed

### Static checks (initial Phase 2 build)
- `node --check` on every `.js` file — all pass, no syntax errors.
- Automated tag-balance check across all 12 HTML files — no mismatches.
- Automated cross-check of every `getElementById` call in `auth-ui.js` against the ids
  present on `login.html`/`register.html`/`submit-place.html` — the only "missing" ids are
  expected, since `auth-ui.js` is shared across all three pages and each `wire*Form`
  function guards with `if (!form) return;` before touching a page that doesn't have it.
- Automated check that every local `href`/`src` in every page resolves to a real file —
  all pass.

### Live browser verification (Phase 2 final check, added after initial build)
This sandbox has no outbound network access to the real CDNs, so a real headless Chromium
(via Playwright, already available in this environment) was pointed at the frontend served
over `http://127.0.0.1:8000`, with CDN requests intercepted and served from a local test
mirror (a real Bootstrap 5.3.2 build found in this environment + a minimal Leaflet stub
sufficient to exercise our own code paths). This is a test-harness technique only — the
real deployed site still loads real Bootstrap 5.3.3 and real Leaflet 1.9.4 from
`cdn.jsdelivr.net`/`unpkg.com` exactly as written in each page's `<script>`/`<link>` tags;
nothing about the actual pages was changed to make this possible.

**Results — all 12 pages, at mobile (375px)/tablet (768px)/desktop (1280px):**
- Zero console errors, zero uncaught JS exceptions, zero horizontal-overflow occurrences,
  navbar and footer both rendered, on every page after fixes (see "Problems Found and
  Fixed" below).
- 25 targeted interaction checks all pass: mobile nav toggle, featured-card rendering,
  Explore search/diet-filter/map-toggle, Place Details reviews/save-button/review-form/
  report-form, Login/Register validation (empty fields, short password, mismatched
  password), Submit Place empty-field validation, FAQ accordion, Admin tab switching and
  pending-table rendering, all admin action buttons confirmed disabled, Saved-place
  removal.
- Visual spot-check via full-page screenshots at all three breakpoints for Home, Explore,
  Place Details, and Admin Dashboard — layout stacks correctly on mobile, cards/badges/
  filters/tables all readable, no clipped content.

## Problems Found and Fixed (this verification pass)

1. **Accidental empty directory `frontend/{css,js,assets,awareness,admin}`.** Leftover
   from an early `mkdir -p` call that didn't get brace-expanded by the shell in this
   environment. Confirmed empty and referenced nowhere in any file, then removed.

2. **Place Details actions could silently stop working if the map failed to load.**
   `place-details.js` called `initDetailMap(place)` before `wireActionButtons(place)` in
   the same `DOMContentLoaded` handler, with no error handling. If Leaflet fails to load
   for *any* reason (slow/offline connection during a live demo, an ad blocker, a CDN
   hiccup), the thrown error stopped the rest of the handler from running — meaning Save,
   Write Review, and Report Incorrect Information would do nothing at all, with no
   indication to the user. **Fix:** action buttons are now wired first, and the map
   initialization runs afterward inside its own try/catch, falling back to a plain-text
   "Map preview is unavailable right now" message instead of breaking the page.
3. **Same defensive gap on Explore's map toggle**, at lower severity (search/filter/list
   view didn't depend on the map). Wrapped `initMapIfNeeded`/`renderMapMarkers` calls in
   try/catch with an equivalent fallback message, both on the initial Map-view click and
   on later filter changes while the map is open.
4. **`#vs-detail-map` had no border/rounded-corner/background styling**, unlike `#vs-map`
   on Explore — visually it was a blank, unbounded rectangle (and the new fallback message
   above would have floated with no visual container). Fixed by sharing the same styling
   rule between `#vs-map` and `#vs-detail-map` in `styles.css`.

None of these were features being added — all are within Phase 2's existing scope
(robustness/UI fixes to already-built pages), per the "fix only Phase 2 problems" scope
for this pass.

## Remaining Limitations (expected, not bugs)
- Still no real authentication, persistence, or backend — correct for this phase.
- A real internet connection is still required to load the actual Bootstrap/Leaflet CDN
  assets when someone opens the site normally (unrelated to the fixes above).
- Photo upload inputs remain disabled — media uploads are planned via Cloudinary in a later phase, not Firebase Storage (see docs/TECHNICAL_ARCHITECTURE.md).
- Awareness content is still a sourced draft pending final citation review.

## Verdict
Phase 2 is verified and ready for Phase 3 (Firebase integration).

## Files Modified
- `docs/PROJECT_STATUS.md` — updated to reflect Phase 2 completion (see below).

## Next Recommended Task
Phase 3 — Firebase project setup (Authentication, Firestore, Hosting — not Storage) and initial
`firestore.rules`, per `docs/DEVELOPMENT_PLAN.md`.
