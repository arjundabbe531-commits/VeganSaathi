# FIREBASE_SECURITY.md — VeganSaathi

Explains the access-control model implemented in `firebase/firestore.rules`, and the
reasoning behind it. Read this before changing the rules file — the goal is that a change
is a deliberate decision, not an accident.

**This project does not use Firebase Storage.** There is no `firebase/storage.rules` file
and no `storage` section in `firebase.json`. Media uploads (place photos, etc.) are planned
for a later phase using Cloudinary instead — see `docs/TECHNICAL_ARCHITECTURE.md` §1 for
why. If that changes in the future, this document and a new `storage.rules` file would need
to be written together, following the same reasoning as the Firestore rules below.

## The three roles

| Role | Who | Can do |
|---|---|---|
| **Visitor** | Anyone, no account | Read published places, read reviews, read awareness content (static pages, not in Firestore at all) |
| **Authenticated user** | Anyone signed in | Everything a visitor can, plus: create their own place submission, review, report, and saved places; read/update their own profile |
| **Admin** | A user whose own `users/{uid}` document has `role == "admin"` | Everything a user can, plus: approve/reject/edit/delete any place, mark a place re-verified, resolve/dismiss any report, delete any review, read any user's profile |

Nobody outside these three categories can do anything — every `match` block in
`firestore.rules` ends by falling through to a default deny (the final `match
/{document=**} { allow read, write: if false; }`).

## How admin status is determined

```js
function isAdmin() {
  return isSignedIn()
    && exists(/databases/$(database)/documents/users/$(request.auth.uid))
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
}
```

This reads the requester's **own** `users/{uid}` document from Firestore itself — never
from anything the client sends in the request. A user cannot make themselves an admin by
sending `{"role": "admin"}` in a write, because:

1. The `users` `create` rule hard-codes `request.resource.data.role == "user"` — every
   account is created as a plain user, with no way to set anything else at signup.
2. The `users` `update` rule requires `request.resource.data.role == resource.data.role` —
   the role field an update writes must match whatever it already was. A user literally
   cannot change their own `role` field through a client write, full stop.

The only way a `role` field ever becomes `"admin"` is a **direct edit in the Firebase
Console** by the project owner (Firestore Database → find the user's document → edit the
`role` field by hand) or a future trusted server-side process (e.g. a Cloud Function run by
a project owner) — never through the app's own client code, and never through these rules.

## Places: the pending → published lifecycle

| Field | Who can set it, and how |
|---|---|
| `status: "pending"` | Automatically true for every new submission — enforced by the `create` rule, not optional |
| `status: "published"` | **Admin only** |
| `status: "rejected"` | **Admin only** |
| `verificationStatus: "verified"` | **Admin only** |
| `lastVerifiedAt` | **Admin only** (set alongside `verificationStatus: "verified"`) |

A submitter can still edit their own place *while it's still pending* (fixing a typo before
review, say) but the `update` rule requires the edited document to still have
`status: "pending"` and `verificationStatus: "unverified"` afterward — so an edit can never
be used to sneak a place into "published" or "verified" state. Only an admin write can
change those two fields.

## Reviews and reports: read visibility

- **Reviews are public-read.** They only make sense attached to a place that's already
  public, and duplicating a "is the parent place published?" check on every single review
  read would add real complexity for limited benefit at this project's scale. Reviews are
  not editable after creation (`allow update: if false`) — the author can delete and repost
  instead — and only the author or an admin can delete one.
- **Reports are intentionally narrow-read**: only the reporter who filed it and admins can
  read a given report. A report can describe something unflattering about a real local
  vendor, and that shouldn't be visible to just anyone who guesses or enumerates document
  IDs.

## Why `submittedByName` / `authorName` exist instead of a broader `users` read rule

The first draft of this schema only stored a bare uid (`submittedBy` on places, `userId` on
reviews) with no way to display a human-readable name without a second read of that
person's `users` document. The tempting fix — "let any signed-in user read any `users`
document" — was rejected here, because a `users` document also holds that person's email
address, and there's no reason every user's email needs to be readable by every other user
just so their *name* can show up on a review. Instead, `places.submittedByName` and
`reviews.authorName` store a denormalized copy of the display name at the moment of
creation. This keeps `users/{uid}` readable only by its owner and by admins, full stop —
the tightest rule that still supports the actual UI.

## Media uploads (Cloudinary, not Firebase Storage)

Place photos (and any future review/profile photos) will be handled by Cloudinary in a
later phase, not by Firebase Storage — this project is intentionally kept on Firebase's
free Spark plan, which does not include meaningful Storage usage. When that phase happens,
whatever upload mechanism is chosen still needs the same practical guards a Storage rule
would have provided (real image type, a reasonable size cap, tied to a signed-in user) —
implemented in that phase's own security review, not assumed here.

## What these rules do NOT protect against

- **A malicious admin.** Whoever holds an admin account has full moderation power by
  design — the same trust model as any small team-run community platform. Keep the number
  of admin accounts small and known.
- **Data quality.** Rules validate *shape* (a rating is 1–5, a diet tag is one of four
  known values, a place type is one of six known values) but can't verify that a submitted
  place is *real* — that's what the human admin-review step in the pending → published flow
  is for.
- **Abuse via volume** (e.g. someone scripting thousands of fake reviews from one account).
  Firestore has default per-project rate limits, but nothing in this ruleset specifically
  throttles a single authenticated user — acceptable for a small CEP pilot, worth revisiting
  if the project ever grows past that.

## Before you change a rule

Ask: *does this change let someone act on data they don't own, or grant a permission the
role table above doesn't list?* If yes, it needs a matching update to this document and to
`docs/DATABASE_SCHEMA.md`, not just the rules file.
