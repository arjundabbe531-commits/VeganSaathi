# IMPORT_WORKFLOW.md — VeganSaathi Research Import Runbook

This runbook documents the offline validation, reconciliation, and staging pipeline for ingesting external research records into VeganSaathi.

---

## 1. Overview & Architecture

To protect user trust, avoid broken map coordinates, and uphold dietary accuracy, VeganSaathi does **not** allow direct bulk uploading of unverified CSVs into Cloud Firestore.

Instead, data flows through a three-stage offline pipeline:

```
[ Research Master ] (e.g. places_master.csv / places_master.json)
       │
       ▼
[ Offline Validation Tool ] (scripts/validate-import.mjs)
       ├── Evaluates field formats, coordinate ranges & enums
       ├── Flags duplicates & non-verified online research
       └── Produces:
            ├── Validation Report (JSON / console)
            └── Staged App Import CSV (places_app_import.csv)
       │
       ▼
[ Admin Dashboard Review ] (Gated queue: status == "pending")
       │
       ▼
[ Firestore Publication ] (status == "published", unverified until visited)
```

---

## 2. Validation Tool Usage & Commands

The project includes an offline validator: `scripts/validate-import.mjs` (pure Node.js ESM, zero external dependencies).

### Common Commands

1. **Inspect a Research Dataset (Console Summary)**:
   ```bash
   node scripts/validate-import.mjs research/master_package/places_master.csv
   ```

2. **Generate a Machine-Readable JSON Validation Report**:
   ```bash
   node scripts/validate-import.mjs research/master_package/places_master.csv --report research/validation_report.json
   ```

3. **Validate and Generate Clean App Import CSV**:
   ```bash
   node scripts/validate-import.mjs tests/fixtures/sample_research_places.csv --out research/places_app_import.csv --report research/sample_report.json
   ```

4. **Strict Mode (Fail if any warnings/advisories exist)**:
   ```bash
   node scripts/validate-import.mjs <input.csv> --strict
   ```

---

## 3. Classification Policy

Records processed by `scripts/validate-import.mjs` are classified into three distinct categories:

| Classification | Meaning | Handled In App Import Output |
|---|---|---|
| `IMPORT_ELIGIBLE` | All required fields (`name`, `placeType`, `address`, `latitude`, `longitude`, `dietTags`) are valid and within bounds. No blocking errors or quality warnings. | **Included** in output CSV with `status: "pending"`, `verificationStatus: "unverified"`. |
| `IMPORT_ELIGIBLE_WITH_ADVISORIES` | All required fields for Firestore are valid, but advisories exist (e.g. missing optional city/country, missing source URLs, non-ISO currency code). | **Included** in output CSV for admin visibility; advisories noted in report. |
| `BLOCKED_PRELIMINARY_LEAD` | Missing one or more critical fields required for app rendering (e.g., missing coordinates, invalid place type, missing diet tags). | **Excluded** from app import CSV. Preserved in research master as a lead requiring fieldwork. |

---

## 4. Analysis of Gemini's Initial Research Package

Running `scripts/validate-import.mjs` on `research/master_package/places_master.csv` (4 records from Shegaon) yields:

```
Total research records: 4
  - Import-Eligible:          0
  - Flagged with warnings:    0
  - Blocked preliminary leads:4
Total blocking errors:        5
```

### Why These Records Are Blocked

1. **`VS-IN-MH-SHG-0001` (Beyond Temptation, Cafe)**:
   - **Blocker**: Missing coordinates (`latitude: ""`, `longitude: ""`). Cannot be placed on Leaflet explore map.
   - **Lead Preservation**: Has Plus Code `QMVX+M36` and address on Gandhi Sq. Kept in research ledger for coordinate resolution.
2. **`VS-IN-MH-SHG-0002` (Bhojanalay, Anand Sagar)**:
   - **Blocker**: Missing coordinates (`latitude: ""`, `longitude: ""`).
   - **Lead Preservation**: Operating status needs physical check (reviews ~7 years old). Kept as a visit target.
3. **`VS-IN-MH-SHG-0003` (Annapurna Veg Plaza & Hotel Nakshtra Inn)**:
   - **Blocker**: Missing coordinates (`latitude: ""`, `longitude: ""`).
   - **Lead Preservation**: Source snippet is low-detail/AI-generated aggregator text. Needs manual menu inspection.
4. **`VS-IN-MH-SHG-0004` (Athavan Garden Restaurant)**:
   - **Blocker 1**: Missing coordinates (`latitude: ""`, `longitude: ""`).
   - **Blocker 2**: Missing diet tags (`dietary_status_unknown`).
   - **Lead Preservation**: Aggregator calls it a family restaurant; meat vs veg status unconfirmed.

**Policy Outcome**: None of these 4 records are uploaded or exported to Firestore. They remain as preliminary research leads in `research/master_package/places_master.csv`.

---

## 5. Synthetic Test Fixtures

To verify the validator without using unverified real places, a synthetic test fixture is provided:
- File: `tests/fixtures/sample_research_places.csv`
- Records: 3 clearly labeled fictional test venues (London, Shegaon, Kyoto).
- Validates:
  - Header alias mapping (`streetAddress` -> `address`, `lat` -> `latitude`, `dietaryCategories` -> `dietTags`).
  - RFC 4180 CSV parsing with commas inside quotes.
  - Global coordinate acceptance across multiple continents.
  - Safe conversion into a clean import CSV (`research/sample_app_import.csv`).

The data-pipeline fixtures under `scripts/data-pipeline/fixtures/` are also explicitly marked with `is_synthetic_fixture`, a unique `synthetic_fixture_id`, and a versioned `synthetic_dataset_version`. The normal `python scripts/data-pipeline/pipeline.py all` path excludes Foursquare fixtures. Include them only for local pipeline testing with `--include-test-fixtures`; fixture candidates are refused by both Firestore staging and production approval. Fixture identity is part of the candidate document ID and cannot be edited through the candidate workflow. The dedicated `run_maharashtra_pilot.py` script writes only clearly named synthetic artifacts and no longer removes older output files.

---

## 6. Pre-Import Checklist (for Future Uploads)

Before any batch is ever uploaded to Cloud Firestore:
- [ ] Offline validation passed with zero blocking errors (`errors: 0`).
- [ ] Verification safety checked: No online research record has `verificationStatus: "verified"`.
- [ ] All coordinates fall within `[-90, 90]` and `[-180, 180]` without `0,0` placeholders.
- [ ] Dietary categories explicitly checked against menus (no automatic vegetarian -> vegan conversion).
- [ ] Source provenance IDs (`sourceId`) are preserved to trace each venue back to research notes.
- [ ] Admin approval: Staged batch is inspected in the Offline Research Import Reviewer (`frontend/admin/import-review.html`) before any Firestore staging.
- [ ] User consent: Live Firebase upload is explicitly authorized by the project lead.

---

## 7. Fieldwork Tooling & Offline Admin Inspection (Phase 3)

The pipeline is accompanied by dedicated fieldwork templates and an isolated sandbox reviewer:

1. **Fieldwork Ledgers & Evidence Tracking:**
   - `research/place_data_template.csv`: Standardized research master ledger with provenance fields.
   - `research/fieldwork_log_template.csv`: In-person visit tracking including staff roles, kitchen fat observations, and photo consent.
   - `research/source_evidence_template.csv`: Multi-tier evidence linking with confidence ratings (`high`, `medium`, `low`, `speculative`).
2. **Formula Injection Sanitization:**
   - Any cell formatted by `validate-import.mjs` beginning with `=`, `@`, `\t`, `\r`, or `+`/`-` non-numeric characters is neutralized with a single quote prefix to prevent spreadsheet macro execution.
3. **Offline Admin Review UI:**
   - Open `frontend/admin/import-review.html` in any browser.
   - Allows administrators to load JSON validation reports or CSV files, view blockers/advisories, inspect coordinate map pins, evaluate dietary uncertainties, and distinguish online research from physical fieldwork without any live database writes.

