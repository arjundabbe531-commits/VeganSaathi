# UI_PLAN.md — VeganSaathi

## Visual Direction
- Clean, welcoming, trustworthy, plant-based — not a copied food-delivery app.
- Accessible green/natural palette as the primary accent, neutral background, high-contrast
  text (verify contrast ratios, don't rely on green alone to signal meaning — pair color
  with icons/labels for accessibility).
- Rounded cards used carefully (place cards, badges) — not applied to every element.
- Readable typography; avoid decorative fonts for body text.
- Indian/local visual character over generic corporate stock-photo feel where practical
  (e.g. imagery/language reflecting SSGMCE and Shegaon, not a generic Western vegan brand
  look).

## Diet Badge System
Each place/user diet tag gets a small, consistent badge so users can scan quickly:
- Vegan — distinct color + leaf-style icon
- Vegetarian — distinct color
- Eggetarian — distinct color
- Jain — distinct color
Badges always paired with a text label, never color-only (accessibility).

## Trust Indicator
"Last verified: [date]" shown prominently on every Place card and Place Detail page,
visually distinct from the diet badges (e.g. a small checkmark + muted date text), with
copy that never implies permanent safety — something like *"Verified by our team as of
this date — always confirm specifics with the vendor."*

## Pages (v1)

| Page | Key sections |
|---|---|
| Home | Hero (tagline + mission), Explore CTA, "Nearby Vegan-Friendly Places" preview, "Why VeganSaathi", awareness teaser, community CTA, footer |
| Explore | Filter bar (diet, place type, price, verified-only), toggle list/map, place cards |
| Place Details | Photo, name, badges, address, embedded map, price range, verification status + last-verified date, description, reviews list, "Write a Review", "Report Incorrect Information", Save button |
| Submit a Place | Form: name, type, address, map-pin picker, diet tags, price range, description, photo upload |
| Login / Register | Email+password fields, Google sign-in button, "Forgot password?" link |
| Profile | Name, dietary preference (editable), My Submissions (with status), My Reviews, Saved Places |
| Awareness | What is Veganism, Vegetarian vs Vegan, Common Misconceptions, Getting Started, Plant-Based Indian Foods, FAQ — each a short, sourced static page |
| Admin Dashboard | Overview counts, Pending Places, Published Places, Reports, Reviews, Users |

## Navigation
Persistent top nav: **Home · Explore · Submit a Place · Awareness · Profile/Login**.
Admin gets an additional **Admin** nav item, visible only when `role == "admin"`.
Footer: About/CEP note, contact, links to Awareness pages.

## Responsive Requirements
Tested at minimum: desktop (≥1200px), tablet (~768px), mobile (≤480px).
Must avoid: horizontal scroll, nav overflow, map exceeding viewport width, forms wider
than the screen, oversized touch targets. Map and filter bar collapse to stacked/mobile
layout below tablet width (e.g. filters in a collapsible panel on mobile).

## What We're Deliberately Not Doing
No animation-heavy interactions, no infinite-scroll feed, no chat UI, no complex
onboarding wizard — a straightforward, fast-loading, mobile-usable interface beats a
flashy but harder-to-finish one.
