# PROJECT_SPEC.md — VeganSaathi

**Tagline:** Connecting People. Promoting Veganism.
**Category:** Community Engagement Project (CEP) + Vegan/Vegetarian Food Discovery + Awareness Portal
**Institution:** Shri Sant Gajanan Maharaj College of Engineering (SSGMCE), Shegaon
**University:** Sant Gadge Baba Amravati University (SGBAU)
**Course context:** B.E. Information Technology, Semester 3
**Initial pilot area:** SSGMCE campus + nearby Shegaon

---

## 1. Problem Statement

Existing food-discovery platforms (HappyCow, Zomato, Swiggy) classify Indian dietary needs
as a simple veg/non-veg binary and cover mainly listed restaurants in dense metro markets.
This leaves three groups underserved:

1. **Hostel residents and local students**, whose mess/canteen/dhaba options never appear
   on any major platform.
2. **Vegan and Jain eaters**, whose needs are meaningfully different from generic
   "vegetarian" and are rarely distinguished by existing apps.
3. **Travellers and pilgrims** passing through a small town (Shegaon, home to the Shri
   Gajanan Maharaj Sansthan) with no reliable, locally-verified information source.

No tool combines India's real dietary taxonomy (vegan / vegetarian / eggetarian / Jain)
with hostel/mess coverage, small-town density, and a genuine field-verified trust layer.

## 2. Objectives

| # | Objective |
|---|---|
| 1 | Help users discover vegan-friendly and relevant food places near SSGMCE/Shegaon |
| 2 | Allow the community to contribute new places and information |
| 3 | Create a verification mechanism ("last verified") to build trust |
| 4 | Let users report outdated or incorrect information |
| 5 | Promote awareness of veganism through credible, clearly-sourced content |
| 6 | Build a foundation that could later expand geographically or in feature depth |

## 3. What This Project Is NOT

- Not a recipe blog
- Not a generic social-media clone
- Not a generic restaurant directory copying Zomato's veg filter
- Not a CRUD demo with no real community data
- Not a food-delivery, payment, or e-commerce platform
- Not a medical/nutrition prescription tool
- Not a nationwide platform in version 1

## 4. Target Users

1. **SSGMCE students** (hostel residents and day scholars) — vegan, vegetarian, eggetarian,
   or Jain, looking for suitable food near campus.
2. **Local Shegaon residents** with vegan/vegetarian/Jain dietary needs.
3. **Travellers and pilgrims** visiting the Gajanan Maharaj temple who need fast, reliable
   local food information.
4. **Local vendors** (mess contractors, dhaba/restaurant owners) willing to be listed and
   periodically re-verified.
5. **Admin (project team / faculty coordinator)** — moderates submissions, reports, and
   reviews.

## 5. Dietary Category Model

VeganSaathi is vegan-branded but does **not** exclude other real dietary categories, and
does **not** claim vegetarian food is automatically vegan-safe. Every place and every user
profile uses the same controlled set of values:

- Vegan
- Vegetarian (lacto-vegetarian, i.e. dairy allowed, no egg/meat/fish)
- Eggetarian (vegetarian + eggs)
- Jain (no onion, garlic, or root vegetables; strict lacto-vegetarian)
- Prefer not to specify (user profile only)

A place can carry more than one tag (e.g. "vegetarian AND Jain-friendly"), and vegan-ness
is always tracked as its own explicit flag rather than inferred from "vegetarian."

## 6. Core Modules (v1 / MVP)

1. Landing / Home
2. Authentication (register, login, logout, password reset)
3. User Profile (dietary preference, saved places, own submissions/reviews)
4. Place Discovery (Explore — list + map)
5. Search and Filters
6. Place Details (with "last verified" trust indicator)
7. Community Place Submission (pending → admin review → published/rejected)
8. Reviews
9. Report Incorrect Information
10. Re-Verification (admin-only)
11. Saved Places
12. Vegan Awareness content (What is Veganism, Vegetarian vs Vegan, Myths, FAQ)
13. Admin Dashboard (submissions, reports, reviews, users, verification)

## 7. Explicitly Out of Scope for v1

Food delivery, payments/e-commerce, complex chat/messaging, food-donation logistics, full
ingredient certification, medical/nutrition diagnosis, AI recommendation engine, large
social feed, nationwide expansion, native mobile app, microservices, unnecessary third-party
APIs. (See `DEVELOPMENT_PLAN.md` for what may become Phase 2+ later.)

## 8. Success Criteria

A working, understandable, deployable CEP project — not the largest possible application.
Concretely: authentication works, a real seeded dataset of SSGMCE/Shegaon places exists,
users can submit/review/report, admin can moderate, and the whole thing is documented well
enough that another developer (or another AI, e.g. Codex) could pick it up cleanly.

## 9. Related Documents

- `DATABASE_SCHEMA.md` — Firestore collections and fields
- `TECHNICAL_ARCHITECTURE.md` — stack and system design
- `DEVELOPMENT_PLAN.md` — phased build order
- `USER_FLOWS.md` — step-by-step user journeys
- `UI_PLAN.md` — pages, layout, visual direction
- `CEP_REQUIREMENTS.md` — community-engagement evidence plan
- `PROJECT_STATUS.md` — living status tracker (created once build starts)
