# DATABASE_SCHEMA.md — VeganSaathi (Cloud Firestore)

Firestore is a NoSQL document database. Collections below are top-level unless noted.
Document ID = Firestore auto-ID unless stated otherwise.

---

## Collection: `users`
Document ID = Firebase Auth UID (so a user's auth account and profile share one ID).

| Field | Type | Required | Purpose |
|---|---|---|---|
| name | string | yes | Display name |
| email | string | yes | From Firebase Auth (mirrored for convenience) |
| dietPreference | string (enum) | yes | vegan / vegetarian / eggetarian / jain / unspecified |
| area | string | no | Approximate locality (e.g. "SSGMCE Hostel Block A") — never exact address |
| role | string (enum) | yes | "user" or "admin" — **never client-writable, see security rules** |
| profileImageUrl | string | no | Cloudinary URL (future phase — not yet implemented) |
| createdAt | timestamp | yes | Set on account creation |

## Collection: `places`

| Field | Type | Required | Purpose |
|---|---|---|---|
| name | string | yes | Place name |
| description | string | no | Short description |
| placeType | string (enum) | yes | restaurant / mess / canteen / cafe / dhaba / other |
| address | string | yes | Human-readable address |
| latitude | number | yes | For map pin |
| longitude | number | yes | For map pin |
| dietTags | array<string> | yes | Subset of [vegan, vegetarian, eggetarian, jain] |
| priceRange | string (enum) | no | budget / moderate / premium |
| imageUrl | string | no | Cloudinary URL (future phase — not yet implemented) |
| status | string (enum) | yes | pending / published / rejected — **admin-controlled** |
| verificationStatus | string (enum) | yes | unverified / verified |
| lastVerifiedAt | timestamp | no | Set only when admin marks re-verified |
| submittedBy | string (uid) | yes | Reference to `users` doc — used by security rules for ownership checks |
| submittedByName | string | yes | Denormalized display name, captured at submission time, so the admin dashboard and public UI can show "submitted by X" without a second read of the `users` collection |
| createdAt | timestamp | yes | |
| updatedAt | timestamp | yes | |

## Collection: `reviews`

| Field | Type | Required | Purpose |
|---|---|---|---|
| placeId | string | yes | Reference to `places` doc |
| userId | string (uid) | yes | Reviewer — used by security rules for author-only delete |
| authorName | string | yes | Denormalized display name, captured at review-creation time, so reviews can be shown publicly without granting read access to the `users` collection |
| rating | number (1–5) | yes | |
| comment | string | no | Short text, length-capped client + rule-side |
| createdAt | timestamp | yes | |

## Collection: `reports`

| Field | Type | Required | Purpose |
|---|---|---|---|
| placeId | string | yes | Reference to `places` doc |
| reporterId | string (uid) | yes | |
| reason | string (enum) | yes | place-closed / wrong-diet-info / wrong-address / temporarily-unavailable / outdated / other |
| description | string | no | Free text detail |
| status | string (enum) | yes | pending / resolved / dismissed — admin-controlled |
| createdAt | timestamp | yes | |
| resolvedAt | timestamp | no | |

## Collection: `savedPlaces`
Document ID = `{uid}_{placeId}` (composite key, avoids duplicate saves without a query).

| Field | Type | Required | Purpose |
|---|---|---|---|
| userId | string (uid) | yes | |
| placeId | string | yes | |
| createdAt | timestamp | yes | |

## Collection: `editSuggestions` (Should-Have, not MVP-blocking)

| Field | Type | Required | Purpose |
|---|---|---|---|
| placeId | string | yes | |
| suggestedBy | string (uid) | yes | |
| changes | map | yes | Field → proposed new value |
| status | string (enum) | yes | pending / applied / dismissed |
| createdAt | timestamp | yes | |

---

## Notes on Design Choices

- **`dietCategories` is not a separate collection.** The four values are fixed and small
  enough to hardcode as an enum in both frontend and security rules — a lookup collection
  would add a network round-trip for no real benefit at this scale.
- **`status` on `places` is separate from `verificationStatus`.** `status` controls
  visibility (is it public at all); `verificationStatus`/`lastVerifiedAt` communicates
  trust once it *is* public. A place can be published but not yet re-verified recently.
- **No collection stores plaintext passwords.** Firebase Authentication handles credentials
  entirely outside Firestore.
- Indexes: Firestore auto-indexes single fields. A composite index is needed for `places`
  queries that combine `status == "published"` with a `dietTags` array-contains filter —
  defined ahead of time in `firebase/firestore.indexes.json` (see `docs/FIREBASE_SETUP.md`)
  so it's ready before Phase 5 writes that query, rather than discovered as a runtime error.

## Phase 3 Corrections (fixed during the Firebase Foundation pass)

- **`reports.reason` no longer includes the value `closed`.** It's renamed to
  `place-closed`. The original name read as if it were a *status* ("this report is
  closed") when it's actually describing the *place* the report is about ("this place has
  closed down") — a real ambiguity sitting right next to the actual `status` field
  (`pending` / `resolved` / `dismissed`), which could confuse both future developers
  writing rules/queries and anyone reading exported report data. `frontend/place-details.html`'s
  report form was updated to match (`value="place-closed"`), same visible label ("Place no
  longer exists").
- **Added `places.submittedByName` and `reviews.authorName`.** The original schema only
  stored `submittedBy`/`userId` (a bare uid) with no way to display a human-readable name
  without a second read of that person's `users` document. Rather than widen read access
  to the `users` collection just to support that (which would expose every user's email
  address to a broader audience than necessary), each place/review now stores a
  denormalized display name captured at write time. This keeps `firebase/firestore.rules`
  tight: `users/{uid}` stays readable only by its owner and by admins.
