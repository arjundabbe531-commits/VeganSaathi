# USER_FLOWS.md — VeganSaathi

## Flow 1 — New Visitor Browsing (no account)
Home → Explore (list/map) → apply diet filter (e.g. Vegan) → open a Place Detail →
read tags, price, last-verified date, reviews → (optional) prompted to sign up to
review/save/report.

## Flow 2 — Registration → Login → First Use
Home → "Sign Up" → enter name/email/password (or Google sign-in) → set dietary preference
→ redirected to Explore, now filtered by default to their preference → browse → log out
→ log back in later, preference is remembered.

## Flow 3 — Submitting a New Place (core community action)
Logged-in user → Explore → "Submit a Place" → fill form (name, type, address, map
location, diet tags, price range, description, optional photo) → submit → confirmation
shown: "Submitted — pending review" → place is NOT publicly visible yet → appears in
admin's Pending queue → admin approves → place becomes visible on Explore with
`status: published`, `verificationStatus: unverified` until admin also marks it verified.

## Flow 4 — Reviewing a Place
Logged-in user → Place Detail → "Write a Review" → rating + comment → submit → review
appears on the page immediately → author can delete their own review later from Profile.

## Flow 5 — Reporting Incorrect Information
Logged-in user → Place Detail → "Report Incorrect Information" → select reason (closed /
wrong diet info / wrong address / temporarily unavailable / outdated / other) → optional
description → submit → confirmation shown → report enters admin's Reports queue.

## Flow 6 — Saving a Place
Logged-in user → Place Detail → "Save" icon → place added to Profile → "Saved Places" tab
→ user can remove it from there or from the Place Detail page.

## Flow 7 — Admin Moderation
Admin login → Admin Dashboard → Overview (counts: pending places, open reports, total
published places) → Pending Places tab → review a submission → Approve (place goes live)
or Reject (place stays hidden, submitter is not publicly notified in v1) → Reports tab →
open a report → Resolve (optionally edit the place first) or Dismiss → Reviews tab →
remove any inappropriate review.

## Flow 8 — Re-Verification (admin, field-visit driven)
Admin (after physically re-checking a place during fieldwork) → Place Detail (admin view)
or Admin Dashboard → "Mark Re-Verified" → `lastVerifiedAt` updates to today → public Place
Detail page now shows the new date.

## Flow 9 — Password Reset
Login page → "Forgot password?" → enter email → Firebase sends reset email → user follows
link → sets new password → returns to login.

---

**Design rule threaded through every flow:** browsing is always open to everyone;
*contribution* (submit, review, report, save) always requires login; *trust-affecting*
actions (approve, verify, resolve, remove) are always admin-only, enforced by Firestore
Security Rules, not just hidden buttons.
