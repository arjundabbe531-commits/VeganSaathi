# CEP_REQUIREMENTS.md — VeganSaathi

This document exists so the project can demonstrably satisfy the Community Engagement
Project requirement, not just function as a web app. Every item below must be backed by
real, dated evidence — nothing here is pre-filled with invented numbers.

## The 8-Step CEP Story We Need to Be Able to Tell

1. **We researched the community.** (Prior research phase — problem areas, competitor
   analysis, India-specific dietary taxonomy.)
2. **We identified real problems.** (See `PROJECT_SPEC.md` §1.)
3. **We interacted with community members.** (Surveys + interviews — see below.)
4. **We collected real local information.** (Fieldwork — see `FIELDWORK_GUIDE.md`.)
5. **We built a digital solution.** (This codebase.)
6. **Community members can contribute information.** (Submit Place, Reviews, Reports.)
7. **The information can be reviewed/verified.** (Admin approval + re-verification flow.)
8. **We measured/documented the impact.** (Metrics below, filled in only with real data.)

## Required Supporting Documents (create alongside fieldwork, not fabricated in advance)
- `docs/FIELDWORK_GUIDE.md` — **written (Phase 5, Task 5.0).** What to record per site
  visit, what "verified" and each diet tag mean, how to capture coordinates, consent and
  privacy rules, and how to enter a place in the Firebase Console.
- `docs/COMMUNITY_SURVEY.md` — survey questions for vegan/vegetarian/Jain/eggetarian
  students, hostel residents, general users, and vendors. Target roughly 100–150
  respondents for the survey and 8–15 short interviews, as an exploratory (not
  statistically representative) sample.
- `research/place_data_template.csv` — **created (Phase 5, Task 5.0), headers only.** The
  exact fields fieldwork entries must capture before they go into Firestore. Keep filled
  ledgers in a private Google Sheet: the repository is public, and `.gitignore` blocks any
  other file in `research/`.

## Ethics & Consent (non-negotiable)
- Tell participants plainly this is a college project, not a company.
- Keep survey responses anonymous by default.
- Get explicit consent before recording/quoting anyone by name or using a vendor's name
  in the app.
- Collect only what's needed — no full names/phone numbers/exact addresses in the survey
  itself.
- Never publish a place's information without the vendor's knowledge; ideally with their
  agreement to be listed and periodically re-checked.

## Impact Metrics to Track (populate with real numbers only, as they happen)

| Metric | Value |
|---|---|
| Places researched via fieldwork | *(fill in)* |
| Field visits conducted | *(fill in)* |
| Community members surveyed | *(fill in)* |
| Interviews conducted | *(fill in)* |
| Community-submitted places (post-launch) | *(fill in)* |
| Verified/re-verified listings | *(fill in)* |
| Reports received / resolved | *(fill in)* |

Do not put placeholder numbers into the final report or demo — an honest "we collected X
so far" is stronger evidence of genuine engagement than an invented total.

## Scope Boundary
The pilot dataset target is **15–30 real, visited places** around SSGMCE and nearby
Shegaon (see prior research, Part 15). This is intentionally small enough to be fully
fieldwork-backed within one semester — do not pad it with unverified entries to look more
complete.
