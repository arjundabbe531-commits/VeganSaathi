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

**Document ID.** Team-seeded places use a **readable, stable slug** (lowercase letters,
numbers, hyphens — e.g. `ssgmce-main-canteen`), typed in by hand in the Firebase Console.
Once created a slug is **never renamed**, because reviews and reports will reference it.
Community submissions (Phase 6) use auto-generated IDs.

| Field | Type | Required | Purpose |
|---|---|---|---|
| name | string | yes | Place name, 2–100 characters |
| description | string | no | Short factual description, ≤ 500 characters |
| placeType | string (enum) | yes | restaurant / mess / canteen / cafe / dhaba / other |
| address | string | yes | Human-readable address. Free text; informal is fine for messes and hostels |
| area | string | no | Short landmark/locality shown on cards (e.g. "near hostel gate"). More useful than a formal address in a small town |
| latitude | number | yes | For map pin. 5 decimals. Validated client-side against a pilot bounding box to catch swapped values |
| longitude | number | yes | For map pin. 5 decimals |
| dietTags | array<string> | yes, non-empty | Subset of [vegan, vegetarian, eggetarian, jain]. A tag means **the team confirmed at least one real meal option meets that definition**. Tag every category that applies (a vegan place gets `vegan` **and** `vegetarian`); no implicit inference in code |
| dietNotes | string | no | What the team was told, in plain words (e.g. dish-level caveats). The honesty layer that the tags alone cannot carry. ≤ 300 characters |
| priceRange | string (enum) | no | budget / moderate / premium (thresholds agreed by the team — see `docs/FIELDWORK_GUIDE.md`). If missing, the UI shows "Price not listed" |
| openingInfo | string | no | Free-text opening information, only if confirmed |
| imageUrl | string | no | Cloudinary URL (future phase — not yet implemented) |
| status | string (enum) | yes | pending / published / rejected — **admin-controlled**. Controls visibility only |
| verificationStatus | string (enum) | yes | unverified / verified. **admin-controlled** |
| lastVerifiedAt | timestamp | conditional | **Required when `verificationStatus == "verified"`.** The date a team member physically visited and confirmed the details |
| verificationNote | string | no | What was checked and how, ≤ 300 characters |
| source | string (enum) | yes | `fieldwork` (entered by the team from a real visit) or `community` (submitted by a user, Phase 6). Powers the CEP metrics ("places researched via fieldwork" vs "community-submitted") |
| submittedBy | string (uid) | yes | Reference to `users` doc — used by security rules for ownership checks. For team-seeded places, the uid of the teammate who entered it |
| submittedByName | string | yes | Denormalized display name, captured at submission time, so the admin dashboard and public UI can show "submitted by X" without a second read of the `users` collection |
| createdAt | timestamp | yes | |
| updatedAt | timestamp | yes | |

### Status and verification model

`status` controls **visibility**. `verificationStatus` + `lastVerifiedAt` communicate **trust**.

| `status` | `verificationStatus` | Meaning | Visible to visitors? |
|---|---|---|---|
| pending | unverified | Submitted, awaiting review | No |
| published | unverified | Approved but not yet visited | Yes — shown as "Not yet verified" |
| published | verified | Team visited on `lastVerifiedAt` | Yes — "Verified, last checked {date}" |
| rejected | any | Declined | No |

A `verified` document without `lastVerifiedAt` is invalid; the UI treats it as "Not yet
verified".

### Last-verified model and the 90-day freshness cue

"Verified" means a team member **physically visited on the date shown and confirmed the
listed details**. It is a statement about that date only, never a guarantee.

The UI may show a soft **"re-check due"** cue when `lastVerifiedAt` is more than **90 days**
old. This cue is presentation only: it **never** changes `verificationStatus` automatically.
Only a person, after a visit, changes verification data. The absolute date is always shown.

### Validation notes

- **Console writes bypass security rules**, so a wrong type or a wrongly capitalised enum
  (`"Vegan"`) is not caught by the database. The Phase 5 data layer (`normalizePlace()`)
  will skip invalid documents with a console warning instead of crashing the page.
- **List queries must include `where("status", "==", "published")`.** Firestore rules are
  not filters; a visitor's list query without it is rejected.
- **`source` is not yet enforced by rules.** No client writes places until Phase 6; at that
  point the create rule should pin `source == "community"` so the metric cannot be spoofed.
- **Privacy:** `submittedBy` / `submittedByName` are readable by anyone on a published
  place (rules work per document). Fine for team-seeded data; revisit before Phase 6
  community submissions.

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
