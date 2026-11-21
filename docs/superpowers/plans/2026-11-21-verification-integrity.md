# VeganSaathi Source and Verification Integrity Plan

> For agentic workers: use test-driven development for each task; preserve the existing candidate branch and keep merge and production deployment separate.

**Goal:** Ensure approved imported places are visible to public discovery and every verified place state is backed by a linked, immutable verification-history event.

**Architecture:** Keep the canonical public source enum aligned with the import approval output. Use a reciprocal Firestore transaction invariant: the place points to a history record, and that history record points back to the place and matches its reviewer, verification dimensions, event type and timestamp. Manual re-verification and import approval both use transactions. Admin edits to core place facts clear the current verification claim while preserving the immutable historical record.

**Tech Stack:** Browser JavaScript ES modules, Firebase Firestore transactions and Security Rules v2, Node.js tests, Firestore Emulator.

**Spec:** Existing project contracts in docs/DATABASE_SCHEMA.md, docs/FIREBASE_SECURITY.md, frontend/js/candidate-approval.js, frontend/js/places-service.js and frontend/js/admin-service.js.

## Global Constraints

- Work only on candidate/zip-baseline-2026-11-05; do not merge PR #1.
- Do not deploy Firestore rules, Hosting, Cloudinary or production data.
- Keep the ₹0 constraint; do not add paid services or dependencies.
- User submissions remain source community; only the admin/import workflow may create source import.
- A verified state must have a same-transaction, immutable verificationHistory record linked by verificationHistoryId.
- Never claim a physical visit from a generic review; only the manual visit-confirmation path sets physically_visited true.

## Review Focus

- Imported candidate → approved Firestore place → public normalization must remain continuous.
- A direct admin create/update must not set verificationStatus verified without a matching immutable history event.
- A history event without a reciprocal place link must be rejected.
- Re-verification must fail closed for missing, unpublished or unreadable places.
- Editing identity, address, coordinates or dietary facts must not leave a previous verification claim active.

---

### Task 1: Align the imported source contract

Files: frontend/js/places-service.js, frontend/js/candidate-approval.js, docs/DATABASE_SCHEMA.md, docs/FIREBASE_SECURITY.md, tests/test-places-service.mjs, tests/test-candidate-approval.mjs.

- [ ] Add a regression test proving import source normalizes to a public place.
- [ ] Run the test and verify it fails because import is currently rejected.
- [x] Add import to the public normalizer source allowlist; preserve fieldwork and community.
- [x] Link the approved place to the history record created in the same transaction.
- [x] Document the distinct fieldwork, community and import source meanings.
- [ ] Run the affected Node tests.

### Task 2: Enforce immutable linked verification history

Files: frontend/js/admin-service.js, firebase/firestore.rules, tests/node-firebase-stub/firebase-firestore.js, tests/test-admin-service.mjs, tests/rules/firestore.rules.test.mjs, docs/DATABASE_SCHEMA.md, docs/FIREBASE_SECURITY.md.

- [ ] Add emulator tests for rejected verified writes without history, an approved candidate/place/history transaction, rejected re-verification without history, successful re-verification with reciprocal links, and immutable history.
- [ ] Run the emulator suite and confirm new authorization tests fail against the current rules.
- [x] Change manual re-verification to read the published place and write place plus history atomically.
- [x] Require reciprocal link, reviewer, event, dimensions and timestamp consistency in active rules; prohibit history update/delete.
- [x] Make admin edits to core place facts clear current verification and dietary evidence claims, leaving old immutable history intact.
- [x] Update schema/security documentation to match the enforced behavior.
- [ ] Run all Node, Python, browser, static and active Firestore Emulator suites; report any environment-limited checks honestly.