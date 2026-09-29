# FIELDWORK_GUIDE.md — Collecting Real Place Data

This guide is how the team turns real visits into trustworthy listings. VeganSaathi's whole
value is that a listing was checked by a person on a specific date. Everything here exists
to protect that.

## The five rules

1. **Never invent data.** No made-up places, coordinates, prices, dietary claims, reviews or
   verification dates. If you don't know a value, leave the optional field empty. A smaller,
   honest map beats a fuller, fabricated one.
2. **Visit in person before marking anything `verified`.** A phone call, a friend's word or a
   Google listing is not verification.
3. **Claim only what you confirmed.** If staff couldn't tell you whether a dish has ghee,
   that is "not confirmed" — do not tag it vegan.
4. **Ask before you record or photograph.** Tell vendors this is a college project, not a
   company (see "Consent and privacy").
5. **Keep the ledger private.** The GitHub repository is **public**. Never commit a filled-in
   fieldwork sheet. Keep it in a private Google Sheet shared only with the team.

## Before you go

- Two teammates per visit where possible (one talks, one records). It also makes the
  visit easier to double-check later.
- Decide the price-range thresholds **as a team** after your first few visits, then write them
  in the table below so everyone applies the same rule.
- Bring the question list below, and a way to record coordinates on your phone.

### Price-range thresholds (team fills this in — do not guess)

| Value | Team-agreed rule (typical full meal, per person) |
|---|---|
| `budget` | *to be agreed by the team* |
| `moderate` | *to be agreed by the team* |
| `premium` | *to be agreed by the team* |

## What "verified" means

`verified` means: **a team member physically visited on the date recorded in
`lastVerifiedAt` and confirmed the listed details** (for dietary claims, by asking staff
about specific dishes and/or checking the menu). It is a statement about that date only,
never a guarantee. The site says so on every listing.

If a place is added but not yet visited, use `verificationStatus = unverified` and leave
`lastVerifiedAt` empty. A `verified` place **must** have `lastVerifiedAt`.

Re-verification: when you revisit, update `lastVerifiedAt`, `verificationNote` and
`updatedAt`. The site shows a soft "re-check due" cue after 90 days, but that cue never
changes `verificationStatus` on its own — only a person does, after a visit.

## What each diet tag means

A tag means **the team confirmed that at least one real meal option meets that
definition.** Tag every category that applies. There is no automatic inference, so a place
that is vegan should be tagged both `vegan` **and** `vegetarian`.

| Tag | Use it only if you confirmed at least one full meal option that… |
|---|---|
| `vegetarian` | contains no meat, fish, poultry or egg. Dairy is fine. |
| `eggetarian` | contains no meat, fish or poultry. Egg is fine. |
| `jain` | is free of meat, fish, egg **and** root/underground vegetables (onion, garlic, potato, carrot, ginger, radish, beetroot). Jain practice varies by person and sect — describe what you confirmed in `dietNotes`. |
| `vegan` | contains **no animal products at all**: no meat, fish, egg, dairy (ghee, butter, curd, paneer, milk), or honey. **Vegetarian does not mean vegan** — Indian vegetarian cooking is dairy-heavy. |

### Questions to ask (per dish, not "is this vegan?")

- Is there ghee, butter, cream, curd, paneer or milk in this dish? Can it be made without?
- Is honey or a milk-based sweetener used?
- Is egg used (including in gravies, breads, or fried batter)?
- For Jain: any onion, garlic or root vegetables in this dish?
- Is the same oil, tawa or kadhai shared with non-vegetarian cooking?

Record what you were **told**, in plain words, in `dietNotes` — e.g. *"Dal made with oil, not
ghee, if asked at the counter (confirmed with the cook)."* Do not turn a hopeful answer into
a certainty.

## Recording coordinates

1. Stand at (or long-press) the exact entrance on OpenStreetMap or Google Maps.
2. Copy the coordinates. **Latitude comes first, then longitude.** Shegaon is roughly
   **20.8 (lat), 76.7 (lng)**; if your numbers look like `76.7, 20.8` they are swapped.
3. Record **5 decimal places** (about 1 metre). Numbers only, no degree symbols.
4. Double-check by pasting the pair back into the map and confirming it lands on the place.

## Field reference

"→ Firestore" columns become fields on the `places` document (see `docs/DATABASE_SCHEMA.md`
for the authoritative definition). "Sheet only" columns never go into Firestore.

| Sheet column | Destination | Format / rule | Required? |
|---|---|---|---|
| `docId` | Firestore document ID | Lowercase letters, numbers and hyphens, e.g. `<place-name-slug>`. **Unique. Never rename it after creating the document.** | Yes |
| `name` | → `name` | 2–100 characters, as shown on the signboard | Yes |
| `placeType` | → `placeType` | One of `restaurant`, `mess`, `canteen`, `cafe`, `dhaba`, `other` | Yes |
| `address` | → `address` | Free text; informal is fine for messes/hostels | Yes |
| `area` | → `area` | Short landmark/locality shown on cards, e.g. "near hostel gate" | Optional |
| `latitude` | → `latitude` | Number, 5 decimals | Yes |
| `longitude` | → `longitude` | Number, 5 decimals | Yes |
| `dietTags` | → `dietTags` | Pipe-separated in the sheet (`vegan\|vegetarian`); an **array** of strings in Firestore. Allowed: `vegan`, `vegetarian`, `eggetarian`, `jain`. At least one. | Yes |
| `dietNotes` | → `dietNotes` | What you were told, ≤ 300 characters | Optional (strongly encouraged) |
| `priceRange` | → `priceRange` | `budget`, `moderate` or `premium` per the table above | Optional |
| `openingInfo` | → `openingInfo` | Free text, e.g. "Mon–Sat, lunch and dinner" — only if confirmed | Optional |
| `description` | → `description` | ≤ 500 characters, factual | Optional |
| `verificationStatus` | → `verificationStatus` | `verified` or `unverified` | Yes |
| `lastVerifiedAt` | → `lastVerifiedAt` | Date of the visit. **Timestamp** type in Firestore. Required when `verified`. | Conditional |
| `verificationNote` | → `verificationNote` | What was checked and how, ≤ 300 characters | Optional |
| `source` | → `source` | `fieldwork` for everything the team enters | Yes |
| `status` | → `status` | `published` only after a teammate has double-checked the entry; otherwise `pending` | Yes |
| `submittedByName` | → `submittedByName` | The teammate who entered it (a name the team is happy to show publicly) | Yes |
| `visitDate` | Sheet only | Date of the visit | — |
| `visitedBy` | Sheet only | Who visited | — |
| `vendorInformed` | Sheet only | yes / no — did you explain the project? | — |
| `vendorConsentToList` | Sheet only | yes / no / verbal | — |
| `photoConsent` | Sheet only | yes / no — for the later image phase | — |
| `internalNotes` | Sheet only | Anything the team should remember | — |

`submittedBy` (the teammate's Firebase user id) is looked up once per teammate — Firebase
Console → Authentication → Users → copy the **User UID** — and is not a per-row column.

`createdAt` and `updatedAt` are Firestore **timestamps** set when you create/edit the
document.

## Entering a place in the Firebase Console

Team-seeded places are entered by hand in the Console (decision D1). It takes a few
minutes per place.

1. Firebase Console → **Firestore Database** → collection **places**.
2. **Add document**. Type the `docId` slug into **Document ID** (do not use Auto-ID for
   team-seeded places).
3. Add each field with the **correct type**. Typing the wrong type is the most common
   mistake, and **the Console does not run our security rules**, so nothing will warn you:

   | Field(s) | Console type |
   |---|---|
   | `name`, `placeType`, `address`, `area`, `dietNotes`, `priceRange`, `openingInfo`, `description`, `verificationStatus`, `verificationNote`, `source`, `status`, `submittedBy`, `submittedByName` | **string** |
   | `latitude`, `longitude` | **number** |
   | `dietTags` | **array** of strings |
   | `lastVerifiedAt`, `createdAt`, `updatedAt` | **timestamp** |

4. Enums are lowercase exactly as listed above. `"Vegan"` is **not** `"vegan"`.
5. Save, then open the site's Explore page and confirm the place appears and its diet
   badges, verification line and map pin look right.

Do **not** set `status` to `published` for your own entry until a teammate has checked it
against the ledger.

## Consent and privacy

- Tell staff plainly: *this is a college project (SSGMCE), the information will appear on a
  student-run website, and you can ask us to change or remove it.* Note their answer in
  `vendorConsentToList`.
- Record roles, not people: write "mess manager", not a name or phone number. Personal
  details of vendor staff do not belong in this project at all.
- Ask before taking any photograph. Photos are for the later image phase; record consent in
  `photoConsent` and do not store photos in the repository.
- If a vendor asks to be removed or corrected, do it promptly and note it in
  `internalNotes`.

## Before you call a place "done" — checklist

- [ ] Visited in person; `lastVerifiedAt` is the real visit date
- [ ] Every diet tag is backed by a dish you asked about
- [ ] `dietNotes` records what you were told, in plain words
- [ ] Coordinates checked on the map (latitude first; lands on the place)
- [ ] `docId` is a unique, stable slug
- [ ] All Console field types match the table
- [ ] A teammate double-checked the entry before `status = published`
- [ ] The place displays correctly on Explore, Place Details and the map

## If you enter a test document

If the code is ready before real data is, a single test document is acceptable **only if**
its name starts with `[TEST — DELETE]` and it is deleted before any demo or deployment.
Better: do a short campus visit first, so real records exist from day one. "No `[TEST]`
documents remain" is a Phase 9 checklist item.
