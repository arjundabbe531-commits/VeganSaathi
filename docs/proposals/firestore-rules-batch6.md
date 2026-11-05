# Proposed Firestore rules changes (NOT APPLIED)

**Status:** proposal only. `firebase/firestore.rules` is unchanged by this integration.
**Why not applied:** this environment has Java but no Firebase CLI and no network access, so
the rules cannot be compiled or run against the emulator here. A syntax or logic error would
block every write in the app once deployed. These changes must be tested with the emulator
(see `tests/rules/README.md`) before deployment.

**A complete, ready-to-diff file now exists:** `firebase/firestore.rules.proposed` has R1, R2
and R3 folded into the full rules file (not just the snippets below), so it can be compared
directly against `firebase/firestore.rules` or swapped in for an emulator run. It is not read
by Firebase and has no effect until someone deliberately copies it over the active file. A
static check (brace/paren/bracket balance) was run against it; this is not a substitute for
compiling it with the Firebase CLI, which this environment cannot do.

**R3 was implemented slightly more precisely than first sketched below:** instead of requiring
every update to include a fixed field list (`hasOnly()` on the whole resulting document, which
would reject a legitimate update of just `name`), the proposed file restricts `hasOnly()` to
`request.resource.data.diff(resource.data).affectedKeys()` — the fields the update actually
changes. This still blocks an unknown field or a role/email change, but allows a normal partial
profile edit. This refinement is itself unverified; confirm the `diff()`/`affectedKeys()`
behaviour against the emulator before trusting it.

## Change R1 — bound review comments and report descriptions

The client now refuses comments and descriptions over 500 characters. The rules must
enforce the same limit, because a direct SDK write bypasses the client.

```
// reviews, inside allow create, add:
&& (!('comment' in request.resource.data) || request.resource.data.comment.size() <= 500)

// reports, inside allow create, add:
&& (!('description' in request.resource.data) || request.resource.data.description.size() <= 500)
```

## Change R2 — a review may only attach to a published place

Currently any signed-in user can create a public review for any `placeId`, including a
pending, rejected or non-existent place. Proposed addition to `reviews` create:

```
&& exists(/databases/$(database)/documents/places/$(request.resource.data.placeId))
&& get(/databases/$(database)/documents/places/$(request.resource.data.placeId)).data.status == "published"
```

**Open question before applying R2:** confirm with the emulator that `get()` on a `places`
document succeeds for a signed-in non-admin writer. If it does not, R2 must be dropped or
replaced with a check done by a trusted server function.

## Change R3 — restrict `users` updates to known fields

The `users` update rule does not validate `dietPreference` or restrict which keys a user may
write. Proposed addition to `users` update:

```
&& request.resource.data.keys().hasOnly(['uid','name','email','dietPreference','role','createdAt','updatedAt'])
&& request.resource.data.dietPreference in ['vegan','vegetarian','eggetarian','jain','unspecified']
```

Check the exact field list against `docs/DATABASE_SCHEMA.md` and the profile page before
applying. A missing field in the allow-list would break profile saves.

## Not proposed here (see CLAUDE_REVIEW_REPORT.md §3.4)

- `createdAt == request.time` on `places` create (backdating) — needs an emulator test of
  `serverTimestamp()` behaviour first.
- `imageUrl` restriction — belongs with Phase 6 photo work (F2).
