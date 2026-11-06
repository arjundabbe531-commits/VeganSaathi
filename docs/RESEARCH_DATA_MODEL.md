# Research candidate and dietary evidence model

This is the target model for private research. It does not represent currently acquired coverage. The current candidate implementation does not yet persist all per-category claims in this shape.

## Record separation

Keep four entities separate:

1. **Source record:** source/provider ID, source name, dataset/release, retrieval date, licence, attribution and permitted-use decision.
2. **Place candidate:** stable internal ID, business/branch identity, place taxonomy, address and coordinates with separate evidence, operating status, duplicate state and reviewer state.
3. **Dietary claim:** one claim for one category and scope. Do not store a single venue-wide `dietTags` array as proof that every category has equal evidence.
4. **Evidence reference:** exact source/artifact, claim supported, source type, capture/check dates, excerpt or reviewer observation, rights context, reviewer and decision history.

Synthetic fixtures remain a separate test-only entity with explicit fixture identity and dataset version. A record marked synthetic cannot be converted to a place candidate by editing its name or provider ID.

## Dietary claim shape

Each private claim should include:

| Field | Meaning |
|---|---|
| `category` | `vegan`, `vegetarian`, `eggetarian` or `jain`; these are distinct and never inferred from one another |
| `scope` | `venue`, `menu_item`, `dish`, `ingredient`, `preparation` or `service_option` |
| `classification` | Category-specific value. Vegan claims distinguish `fully_vegan_venue`, `vegan_friendly_options`, `verified_vegan_option`, `conflicting` and `unverified`; other categories use their own reviewed status and scope |
| `evidence_status` | `current`, `stale`, `conflicting`, `insufficient` or `unverified` |
| `evidence_refs` | References supporting this exact claim, with reviewer, dates and rights/attribution context |
| `review_history` | Immutable decision, reviewer, timestamp, previous status and evidence snapshot |

A venue being vegetarian, eggetarian or Jain does not establish a vegan claim. One vegan dish does not establish a fully vegan venue. A public VeganSaathi badge requires a qualifying current vegan claim and the corresponding production approval gate. Under the current charter, other dietary claims remain internal research information rather than public product categories.

## Independent verification dimensions

Business existence, current operating status, identity/branch, address, coordinates, dietary claims and photo publication rights each require their own evidence status. A complete address string or map coordinate does not by itself set `address_confirmed` or `coordinates_confirmed`. Vendor statements, online menus, direct observations and third-party directories retain their source types and are not interchangeable.

## Implementation boundary

Current production-facing code still includes `dietTags`, `veganClassification`, `verificationDimensions.vegan_options_verified` and claim-specific `evidenceRefs`. This target schema is a gap record, not a migration or authorization to write production data. Implement storage only after a migration, strict validation, Firestore rules and test plan are reviewed. No external data should be acquired until access cost, licence, attribution and permitted use are verified as zero-cost and allowed.
