# SCHEMA_MAPPING.md — VeganSaathi Research-to-App Harmonization

This document defines the canonical reconciliation specification between **Research Master Datasets** (produced by desk research, web scraping, and field interviews) and the **VeganSaathi Application Schema** (stored in Cloud Firestore `places` and consumed by the web UI).

---

## 1. Executive Summary

VeganSaathi is designed to be an evidence-backed food discovery platform. To maintain trust, performance, and data integrity:

1. **The application schema and research schema serve different purposes.** Public Firestore documents store only what is needed for user discovery, filtering, map pins, and trust badges. The research master stores deep audit provenance, source URLs, licensing status, and candidate image arrays.
2. **Online research is NOT physical verification.** An aggregator listing or website menu cannot grant `verificationStatus = "verified"`. In-person fieldwork is required for physical verification.
3. **Vegetarian is NOT Vegan.** Vegan requires 100% plant-based meal confirmation (no dairy, ghee, honey, eggs, or meat). A vegetarian eatery with ghee or milk must never be tagged `vegan` without verified vegan dish options.
4. **Legitimate preliminary leads must be preserved without polluting the app.** Records lacking coordinates or dietary confirmation remain in the research ledger as `BLOCKED_PRELIMINARY_LEAD` until fieldwork establishes the missing data.

---

## 2. Field-by-Field Mapping Specification

| App Field (Firestore `places`) | App Type | Research Field (`places_master.csv`) | Documented Aliases | Normalization & Safety Rule |
|---|---|---|---|---|
| `id` | `string` | Derived from `record_id` / `place_name` | `docId`, `placeId`, `slug` | Lowercase alphanumeric slug (e.g. `green-bistro`). If absent, generated from sanitized name or `sourceId`. |
| `name` | `string` | `place_name` (+ `branch_name` if present) | `placename`, `restaurant_name` | Required, 2–100 characters. If `branch_name` exists and is not in the name, formatted as `Name (Branch)`. |
| `placeType` | `string (enum)` | `app_place_type` \|\| `place_type` | `type`, `category` | Required enum: `restaurant`, `mess`, `canteen`, `cafe`, `dhaba`, `other`. Normalized to lowercase. |
| `description` | `string` | `description` | `desc` | Factual description, max 500 chars. Defaults to `""`. |
| `address` | `string` | `address` | `street_address`, `full_address` | Required, max 300 chars. Full street address. |
| `area` | `string` | `area` | `locality`, `neighborhood`, `suburb` | Locality or landmark shown on cards. Defaults to `"Area not listed"`. |
| `city` | `string` | `city` | `town` | City/municipality name (e.g. Shegaon, Pune, London). Preserved in Firestore. |
| `state` | `string` | `state_region` | `state`, `province`, `region` | State or administrative region (e.g. Maharashtra). Preserved in Firestore. |
| `country` | `string` | `country` | `nation` | Country name (e.g. India, United Kingdom). Preserved in Firestore. |
| `postalCode` | `string` | `postal_code` | `pincode`, `zip`, `zipcode` | Postal / PIN code (e.g. 444203). Preserved in Firestore. |
| `latitude` | `number` | `latitude` | `lat` | **Required for public app.** Must be a finite number within global range `[-90, 90]`. Missing lat blocks app import. |
| `longitude` | `number` | `longitude` | `lon`, `lng`, `long` | **Required for public app.** Must be a finite number within global range `[-180, 180]`. Missing lon blocks app import. |
| `dietTags` | `array<string>` | `app_diet_tags` \|\| `diet_tags` | `dietary_tags`, `dietaryCategories` | **Required.** Subset of `["vegan", "vegetarian", "eggetarian", "jain"]`. Must contain at least one tag. Semicolon-delimited in CSV. |
| `dietNotes` | `string` | `diet_notes` | `dietary_evidence`, `diet_notes` | Factual honesty notes on dishes or preparation, max 300 chars. |
| `priceRange` | `string (enum)` | `price_range` | `price`, `priceRange` | Enum: `budget`, `moderate`, `premium`, or sentinel `"Price not listed"`. Defaults to `"Price not listed"`. |
| `openingInfo` | `string` | `opening_info` | `hours`, `opening_hours` | Free-text opening hours. Defaults to `""`. |
| `imageUrl` | `string \| null`| `primary_image_url` | `image_url`, `image` | Primary image URL. Must be valid `http://` or `https://`. Defaults to `null`. |
| `status` | `string (enum)` | `app_status` | `status` | Enum: `pending`, `published`, `rejected`. For research imports, always defaults to `pending` for admin review. |
| `verificationStatus` | `string (enum)` | `app_verification_status` | `verification_status` | Enum: `unverified`, `verified`. **Must be `unverified` for all desk research.** |
| `lastVerifiedAt` | `timestamp \| null` | `app_last_verified_at` | `visitDate`, `last_verified_at` | Date of physical fieldwork visit. **Must be null/empty for desk research.** |
| `verificationNote` | `string` | `app_verification_note` | `verification_note` | Details of physical visit. Defaults to `""`. |
| `source` | `string (enum)` | `app_source` | `source`, `source_type` | `fieldwork` (physical team visit) or `community` (external research / community submission). |
| `submittedByName` | `string` | `submittedByName` | `researcher`, `investigator` | Display name of the contributor or research team (e.g. `"Research Team"`). |
| *(audit tracking)* | `string` | `record_id` | `sourceId`, `researchId` | Preserved in import tracking logs to trace back to research master. |

---

## 3. Analysis & Reconciliation of Gemini's Research Package

Gemini supplied `VeganSaathi-Research-Master-Package.zip` containing 4 research candidate records from Shegaon in `places_master.csv`. Running our offline validator (`scripts/validate-import.mjs`) against these records yields the following analysis:

```
Total research records: 4
  - Import-Eligible:          0
  - Blocked preliminary leads:4
Total blocking errors:        5
```

### Record-by-Record Breakdown

| Record ID | Venue Name | Place Type | Declared Diets | Coordinates | Validation Result | Action Required Before Import |
|---|---|---|---|---|---|---|
| `VS-IN-MH-SHG-0001` | **Beyond Temptation** | `cafe` | `vegetarian` | Missing (`""`, `""`) | ⏸️ **BLOCKED** | Obtain venue coordinates (Plus Code `QMVX+M36` needs pinpointing); verify if vegan options exist beyond dairy shakes. |
| `VS-IN-MH-SHG-0002` | **Bhojanalay (Anand Sagar)** | `canteen` | `vegetarian` | Missing (`""`, `""`) | ⏸️ **BLOCKED** | Obtain venue coordinates; confirm operating status (reviews are ~7 yrs old); verify whether breakfast poha/upma uses ghee. |
| `VS-IN-MH-SHG-0003` | **Annapurna Veg Plaza & Hotel Nakshtra Inn** | `restaurant` | `vegetarian` | Missing (`""`, `""`) | ⏸️ **BLOCKED** | Obtain venue coordinates; obtain PIN code; verify actual menu (current source is auto-generated aggregator snippet). |
| `VS-IN-MH-SHG-0004` | **Athavan Garden Restaurant** | `restaurant` | **None** (`dietary_status_unknown`) | Missing (`""`, `""`) | ⏸️ **BLOCKED** | Obtain venue coordinates; identify dietary category (currently missing diet tags; non-veg vs veg unknown). |

### Conclusion on Initial Research Batch
Gemini's research team honestly reported data limitations in `data_quality_report.md` ("Records: 4. Coordinates: 0. Vegan evidence: 0. Field visits: 0."). 

Our validation workflow accurately identified these exact limitations. **None of the four records can be imported into Firestore today because publishing venues without coordinates or diet tags breaks map discovery and search contracts.** They remain safely preserved in `research/master_package/places_master.csv` as preliminary leads for future fieldwork.

---

## 4. Dietary Taxonomy & Uncertainty Policy

VeganSaathi models four dietary categories. The table below governs how research data maps to tags:

| Dietary Category | Definition | Research Evidence Requirement | Automatic Inference Permitted? |
|---|---|---|---|
| `vegan` | 100% plant-based (no dairy, ghee, honey, gelatin, egg, meat, poultry, seafood) | Must have confirmed specific menu items prepared without dairy/ghee. | **NO.** A vegetarian restaurant is NOT automatically tagged vegan. |
| `vegetarian` | Lacto-ovo vegetarian (no meat, fish, poultry; dairy is allowed) | Menu confirmed meat-free and fish-free. | Yes, if venue is an established pure-veg eatery. |
| `eggetarian` | Vegetarian dishes plus egg options (no meat or fish) | Menu confirms egg dishes alongside vegetarian options. | Only with menu evidence. |
| `jain` | Vegetarian prepared without root vegetables (no onion, garlic, potato, carrots) | Must have confirmed Jain preparation options upon request. | **NO.** Never assume a vegetarian restaurant has Jain food. |

### Rule on Mixed Menus & Uncertainty
- If staff or menus cannot confirm whether cooking oil or ghee is used, **do not add the `vegan` tag**.
- State the uncertainty clearly in `dietNotes`: e.g. `"Pure vegetarian restaurant; rotis and gravies may contain dairy/ghee. Vegan suitability unconfirmed."`

---

## 5. Image & Media Contract

1. **Current Application Contract**:
   - The application schema supports a single string field: `imageUrl`.
   - The UI displays place images or a clean initial badge fallback when `imageUrl` is `null`.
   - Cloudinary integration is deferred; no image uploads or credentials are implemented in this phase.

2. **Research Master Contract**:
   - The research dataset (`place_images.csv`) supports multiple candidate images.
   - For each candidate image, the research ledger preserves:
     - `image_id`
     - `image_url`
     - `page_url` (where the image was discovered)
     - `credit` / photographer attribution
     - `rights_status` (e.g. `public_domain`, `cc_by`, `permission_required`, `unknown`)
     - `caption`
   - When preparing an app import, the validator selects one approved, rights-cleared candidate as `imageUrl`. Candidates with unknown rights status are not pushed to the public app.

---

## 6. Verification and Moderation Safety

| Provenance Level | `source` Value | `verificationStatus` | `lastVerifiedAt` | Moderation Workflow |
|---|---|---|---|---|
| **Online Research / Web Scrape** | `community` | `unverified` | `null` | Imported as `pending`. Must be approved by an administrator in the admin dashboard before appearing publicly. |
| **Community User Submission** | `community` | `unverified` | `null` | Created as `pending` via `submit-place.html`. Gated by Firestore rules. |
| **Physical Team Fieldwork** | `fieldwork` | `verified` | `Timestamp` (visit date) | Stored only after a physical in-person visit with date, verified by teammate UID, and documented visit notes. |

Online research is **never** given `verified` status upon import.
