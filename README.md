# VeganSaathi

**Connecting People. Promoting Veganism.**

A Community Engagement Project (CEP) by 3rd-semester B.E. Information Technology students
at Shri Sant Gajanan Maharaj College of Engineering (SSGMCE), Shegaon, affiliated to Sant
Gadge Baba Amravati University (SGBAU).

## Problem Statement

Existing food-discovery apps use a crude veg/non-veg binary and cover mainly restaurants in
big cities, leaving hostel messes, small local eateries, and the vegan/vegetarian/
eggetarian/Jain distinction underserved — especially in a small town like Shegaon. See
`docs/PROJECT_SPEC.md` for the full problem statement and supporting research.

## Objectives

1. Help users discover vegan-friendly and relevant food places near SSGMCE/Shegaon.
2. Let the community contribute new places and information.
3. Provide a "last verified" trust mechanism.
4. Let users report outdated/incorrect information.
5. Promote vegan awareness through credible, clearly-sourced content.
6. Build a foundation that could expand later without a rebuild.

## Features (v1 / MVP)

- Firebase Authentication (email/password + Google)
- Dietary profile (vegan / vegetarian / eggetarian / Jain)
- Place discovery — list + map (Leaflet/OpenStreetMap) with search and filters
- Place Details with diet badges and "last verified" trust indicator
- Community place submission → admin approval workflow
- Reviews and "Report Incorrect Information"
- Saved places
- Admin dashboard (approve/reject places, resolve reports, moderate reviews, re-verify)
- Vegan awareness content pages

## Technology Stack

- **Frontend:** HTML5, CSS3, vanilla JavaScript, Bootstrap
- **Map:** Leaflet.js + OpenStreetMap
- **Backend-as-a-Service:** Firebase (Authentication, Firestore, Hosting)
- **Media storage:** Cloudinary (planned for a later phase — place/review photos; not yet implemented)
- No custom server, no separate database engine, no unnecessary frameworks.

## Architecture

See `docs/TECHNICAL_ARCHITECTURE.md` for the full system diagram and folder layout.

## Folder Structure

```
VeganSaathi/
├── docs/        → project specification, schema, architecture, plans, status
├── research/    → fieldwork templates, survey drafts, seed-data CSVs
├── frontend/    → HTML/CSS/JS source
├── backend/     → reserved (Cloud Functions only if strictly needed)
├── firebase/    → firebase.json, security rules, indexes
└── assets/      → images/icons
```

## Local Development (once Phase 3 is complete)

1. Install the Firebase CLI: `npm install -g firebase-tools`
2. `firebase login`
3. `firebase init` (select Hosting, Firestore — use existing project config in
   `firebase/`)
4. Serve locally: `firebase emulators:start` or open `frontend/index.html` directly for
   static-only testing.
5. Deploy: `firebase deploy`

**Never commit** `firebase/` secrets, `.env` files, or API keys that must remain private.
The Firebase client config itself (project ID, public API key) is safe to include in
frontend source — see `docs/TECHNICAL_ARCHITECTURE.md` §4 for why.

## Testing

See `docs/TEST_PLAN.md` (created in Phase 9) and `docs/TEST_RESULTS.md` for test coverage
and results.

## Community Engagement

This project's core CEP requirement — real fieldwork, surveys, interviews, and a
verification workflow — is documented in `docs/CEP_REQUIREMENTS.md`.

## Current Status

See `docs/PROJECT_STATUS.md` for what's built, in progress, and blocked.

## Future Scope (explicitly deferred, not v1)

Dish-level tagging, Marathi/Hindi dietary phrase-card generator, a curated ingredient
decoder, an event/RSVP dietary-headcount tool, and expansion beyond Shegaon to a second
town.
