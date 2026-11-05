# IMPORT_REVIEW_WORKFLOW.md — Safe Research-to-App Staging & Review Pipeline

This document defines the official, human-in-the-loop review workflow for safely consuming research data in VeganSaathi.
To protect dietary trust and database integrity, **no research data is ever uploaded directly into public Firestore documents without strict multi-stage validation and manual admin approval.**

---

## 1. The Eight-Stage Review Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       VEGANSAATHI RESEARCH PIPELINE                        │
└─────────────────────────────────────────────────────────────────────────────┘

  [Stage 1: Lead Identification]
         │ (Online desk research, directory leads, community tip-offs)
         ▼
  [Stage 2: Evidence Collection & Fieldwork]
         │ (In-person kitchen visits, menu photography, ingredient checks)
         ▼
  [Stage 3: Offline Data-Quality Validation]
         │ (Automated schema, coordinates, diet tags, rights check via validator)
         ▼
  [Stage 4: Editorial & Verification Review]
         │ (Lead researcher checks blockers, advisories, and evidence levels)
         ▼
  [Stage 5: Approved Staging File Creation]
         │ (Generates clean import payload with status: "pending", unverified)
         ▼
  [Stage 6: Authenticated Admin Review (Local / Staging UI)]
         │ (Admins inspect candidates in isolated mock UI or moderation queue)
         ▼
  [Stage 7: Manual Approval & Publication]
         │ (Admin promotes listing to status: "published")
         ▼
  [Stage 8: Freshness & Re-Verification Cycle]
           (90-day physical re-check tracking)
```

---

## 2. Stage Breakdown & Responsible Roles

### Stage 1: Lead Identification (Research Lead)
- **Inputs:** Community surveys, campus recommendations, directory searches (Google Maps, Zomato).
- **Status:** Unverified preliminary lead.
- **Rules:** Assigned a stable ID (e.g., `VS-IN-MH-SHG-0001`). If coordinates or dietary evidence are missing, record remains in Tier 2 Research Master Ledger only; **never pushed to the app**.

### Stage 2: Evidence Collection & Fieldwork (Fieldwork Team)
- **Inputs:** In-person visits and primary menu checks.
- **Documentation:**
  - Log visit in `research/fieldwork_log_template.csv`.
  - Log sources in `research/source_evidence_template.csv`.
  - Record exact coordinate pins on entrance doorways.
  - Document specific dish inquiries in `dietNotes`.
- **Photo Rights:** Ensure photos taken have vendor consent or open licensing.

### Stage 3: Offline Data-Quality Validation (`validate-import.mjs`)
- **Execution:**
  ```bash
  node scripts/validate-import.mjs research/master_places.csv --report research/validation_report.json --out research/staging_app_import.csv
  ```
- **Automated Enforcements:**
  1. Coordinate validation: Numeric, bounded `[-90, 90]` and `[-180, 180]`, no `[0, 0]` Null Island.
  2. Geographic sanity: Coordinates must match declared country/locality.
  3. Strict diet tags: Must be subset of `vegan`, `vegetarian`, `eggetarian`, `jain`.
  4. Vegan evidence check: If tagged `vegan`, requires explicit dietary note verifying no-dairy/no-ghee.
  5. Verification safety: Online research cannot be marked `verified`. `lastVerifiedAt` strictly cleared for unverified places.
  6. Duplicate detection: Flags duplicate IDs and venues within 20m.
  7. CSV formula-injection protection: Sanitize `=,+,-,@` prefixes.

### Stage 4: Editorial & Verification Review (Data Manager)
- **Action:** Inspect the machine-readable `validation_report.json`.
- **Classification Criteria:**
  - `BLOCKED_PRELIMINARY_LEAD`: Missing coordinates, invalid diet tags, or out-of-range bounds. **Permanently blocked from staging.**
  - `IMPORT_ELIGIBLE_WITH_ADVISORIES`: Valid coordinates and tags, but missing optional fields (e.g. city, country, or media license). Editorial team resolves advisories.
  - `IMPORT_ELIGIBLE`: Fully compliant records.

### Stage 5: Approved Staging File Creation (Data Manager)
- The validator outputs `staging_app_import.csv` containing **only** `IMPORT_ELIGIBLE` records.
- Staged records are formatted with:
  - `status: "pending"` (or explicitly isolated).
  - `verificationStatus: "unverified"` (unless backed by physical visit log in Stage 2).
  - `source: "fieldwork"` or `"community"`.

### Stage 6: Authenticated Admin Review (Local Review UI)
- Admins load the staging payload into the **Offline Admin Research Review Tool** (`frontend/admin/import-review.html`).
- Admins inspect:
  - Coordinate pin landing location.
  - Dietary evidence notes (oil vs. butter/ghee confirmation).
  - Source URLs and photo rights status.
  - Verification trail (fieldwork log ID and visit date).

### Stage 7: Manual Approval & Publication (Authorized Admin)
- In accordance with safety policies, authenticated admins approve entries in the admin interface:
  - Approval updates `status: "published"`.
  - `verificationStatus` remains `unverified` unless authorized by a confirmed physical visit log.
  - `createdAt` and `updatedAt` timestamps recorded.

### Stage 8: 90-Day Freshness Cycle (Admin & Fieldwork Team)
- Published listings trigger a freshness warning after 90 days.
- Fieldwork teams re-visit the location to confirm that recipes, cooking fats, or management have not changed.
- Physical re-verification requires an in-person visit date entered into the admin dashboard with a mandatory verification note.

---

## 3. Schema & Status Compatibility Matrix

To prevent breaking existing applications or Firestore security rules, all imported records strictly map to canonical Firestore schemas:

| Field | Ingestion Value | Firestore Rule Enforcement | Fallback Default |
|---|---|---|---|
| `status` | `"pending"` | Must be one of `pending`, `published`, `rejected` | `"pending"` |
| `verificationStatus` | `"unverified"` or `"verified"` | Must be one of `unverified`, `verified` | `"unverified"` |
| `lastVerifiedAt` | ISO String / null | Valid past timestamp if verified; null if unverified | `null` |
| `source` | `"fieldwork"` / `"community"` | Must be one of `fieldwork`, `community` | `"fieldwork"` |
| `dietTags` | Array of strings | Subset of `vegan`, `vegetarian`, `eggetarian`, `jain` | Required |
| `latitude` | Number `[-90, 90]` | Finite float | Required |
| `longitude` | Number `[-180, 180]` | Finite float | Required |

---

## 4. Emergency Rollback Protocol

If an error or invalid record is identified after publication:
1. Locate document ID in Firestore.
2. In the Admin Dashboard (`dashboard.html`), click **Reject** or **Update** to transition status to `rejected` or update coordinates immediately.
3. If bulk correction is needed, an admin script updates `status: "rejected"` for the batch based on `sourceId`.
4. Log incident in `docs/TEST_RESULTS.md` for post-mortem analysis.
