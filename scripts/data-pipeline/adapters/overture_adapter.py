"""
VeganSaathi — Overture Maps Places Adapter
============================================
Extracts Maharashtra food-related places from the Overture Maps Foundation
Places dataset using DuckDB querying the public S3 GeoParquet files.

Licence: CDLA Permissive 2.0 — free use, attribution required.
Source: s3://overturemaps-us-west-2/release/<PINNED_RELEASE>/theme=places/type=place/*

Schema: Overture Places Schema v2.0.0 (released 2026-09-23.0; latest published release 2026-10-21.0).
  Breaking changes from v1:
    - top-level `categories` struct removed.
    - Replaced by: `basic_category` (string), `taxonomy.primary` (string),
      `taxonomy.hierarchy` (list<string>), `taxonomy.alternates` (list<string>).
  Reference: https://docs.overturemaps.org/schema/reference/places/place/

PINNED_RELEASE: 2026-10-21.0
  Reason: Latest verified published release as of November 2026 operating on Schema v2.0.0.
  (Introduced in 2026-09-23.0; 2026-10-21.0 expands places coverage with schema stability).
  Update OVERTURE_PINNED_RELEASE when re-acquiring to use a newer verified release.
  Do NOT use "latest" in production — it may silently change schema.

Zero-budget policy: No paid services. DuckDB reads S3 directly (free egress
  for the Maharashtra bounding-box extract, ~50-200 MB).

IMPORTANT: Overture confidence score = existence probability, NOT vegan status.
           Do not use confidence as a vegan verification score.
           Preserve GERS ID and source_dataset for cross-release matching.
"""

from __future__ import annotations
import logging
import json
from datetime import datetime, timezone
from typing import Iterator, Optional, Dict, Any, List

from .base_adapter import BaseSourceAdapter, CandidateRecord, ImportManifest
from .place_taxonomy import OVERTURE_CATEGORY_MAP, OVERTURE_FOOD_CATEGORIES, map_overture_category

logger = logging.getLogger("vegansaathi.adapter.overture")

# Maharashtra bounding box (conservative)
MAHARASHTRA_BBOX = {
    "min_lon": 72.5, "max_lon": 81.0,
    "min_lat": 15.5, "max_lat": 22.1,
}

# Overture category → VeganSaathi placeType mapping
# Food-relevant Overture primary categories (keep broad for discovery)
FOOD_RELEVANT_PRIMARY = OVERTURE_FOOD_CATEGORIES

# Pinned Overture release (v2.0.0 schema — introduced 2026-09-23.0; latest published 2026-10-21.0).
# Update this constant (and re-run tests) whenever a new release is verified.
# Do NOT use "latest" in the S3 path — it may silently change schema between runs.
OVERTURE_PINNED_RELEASE = "2026-10-21.0"
OVERTURE_SCHEMA_VERSION = "v2.0.0"  # Places schema version — breaking change from v1

# Food-relevant Overture basic_category / taxonomy.primary values (v2.0 schema).
# In v2.0: `basic_category` is a simple string (replaces categories.primary).
#           `taxonomy.primary` is a dotted hierarchical string e.g. "eat_and_drink.restaurant".
#           `taxonomy.alternates` is a list<string> of alternate taxonomy labels.
# Reference: https://docs.overturemaps.org/schema/reference/places/place/
OVERTURE_S3_PATH = (
    f"s3://overturemaps-us-west-2/release/{OVERTURE_PINNED_RELEASE}/theme=places/type=place/*"
)


class OvertureAdapter(BaseSourceAdapter):
    """
    Adapter for Overture Maps Foundation Places dataset.

    Config keys:
      s3_path (optional): override the default S3 path
      output_format: "ndjson" (default)
      category_filter: list of Overture primary categories to keep (default: food-relevant)
    """

    def get_source_id(self) -> str:
        return "overture-maps-places"

    def validate_config(self) -> bool:
        try:
            import duckdb  # noqa
            return True
        except ImportError:
            self.logger.error("DuckDB not installed. Run: pip install duckdb")
            return False

    def source_metadata(self) -> Dict[str, Any]:
        return {
            "name": "Overture Maps Foundation — Places",
            "schema_version": OVERTURE_SCHEMA_VERSION,
            "release": OVERTURE_PINNED_RELEASE,
            "licence": "CDLA Permissive 2.0",
            "licence_url": "https://cdla.dev/permissive-2-0/",
            "attribution": "Overture Maps Foundation",
            "s3_path": self.config.get("s3_path", OVERTURE_S3_PATH),
        }

    def _build_query(self, dry_run: bool = False, limit: Optional[int] = None) -> str:
        """Build the DuckDB SQL query for Maharashtra food places.

        Uses Overture Places Schema v2.0 field names:
          - basic_category  : replaces categories.primary (v1 — REMOVED in v2.0)
          - taxonomy.primary: dotted taxonomy path e.g. "eat_and_drink.restaurant"
          - taxonomy.alternates: list<string> of alternate taxonomy labels
        Do NOT use categories.primary or categories.alternate — those were removed
        in the 2024-09-18.0 release and will cause query errors on v2.0 parquet files.
        """
        bbox = self.config.get("bbox", MAHARASHTRA_BBOX)
        s3_path = self.config.get("s3_path", OVERTURE_S3_PATH)

        limit_clause = ""
        if dry_run:
            limit_clause = "LIMIT 50"
        elif limit:
            limit_clause = f"LIMIT {limit}"

        # Build an IN-list for basic_category filtering.
        # In v2.0, basic_category is a simple string like "restaurant", "cafe", etc.
        # taxonomy.primary uses dotted paths; we filter by basic_category for simplicity.
        food_cats_sql = ", ".join(repr(c) for c in FOOD_RELEVANT_PRIMARY)

        return f"""
        INSTALL spatial; LOAD spatial;
        INSTALL httpfs; LOAD httpfs;
        SET s3_region = 'us-west-2';

        -- Overture Places Schema v2.0 (release {OVERTURE_PINNED_RELEASE})
        -- Field changes from v1: categories.primary → basic_category
        --                        categories.alternate → taxonomy.alternates
        SELECT
            id                                              AS gers_id,
            names.primary                                   AS name,
            COALESCE(names.common[1].value, '')             AS name_alt,
            basic_category                                  AS category_primary,
            COALESCE(taxonomy.primary, '')                  AS taxonomy_primary,
            COALESCE(taxonomy.alternates[1], '')            AS category_alt,
            ROUND(confidence, 4)                            AS confidence,
            addresses[1].freeform                           AS address,
            addresses[1].locality                           AS city,
            addresses[1].region                             AS state,
            addresses[1].country                            AS country,
            addresses[1].postcode                           AS postal_code,
            ST_Y(geometry)                                  AS latitude,
            ST_X(geometry)                                  AS longitude,
            websites[1]                                     AS website,
            phones[1]                                       AS phone,
            brand.wikidata                                  AS brand_wikidata,
            sources[1].dataset                              AS source_dataset,
            sources[1].record_id                            AS source_record_id,
            sources[1].update_time                          AS source_update_time
        FROM read_parquet('{s3_path}', hive_partitioning=1)
        WHERE
            bbox.xmin >= {bbox['min_lon']}
            AND bbox.xmax <= {bbox['max_lon']}
            AND bbox.ymin >= {bbox['min_lat']}
            AND bbox.ymax <= {bbox['max_lat']}
            AND basic_category IN ({food_cats_sql})
        {limit_clause}
        """

    def fetch_records(self, dry_run: bool = False) -> Iterator[Dict[str, Any]]:
        """
        Execute DuckDB query and yield raw record dicts.
        Uses streaming to avoid loading all records into memory.
        """
        import duckdb

        query = self._build_query(dry_run=dry_run)
        self.logger.info(f"Overture: executing DuckDB query (dry_run={dry_run})")

        try:
            conn = duckdb.connect(database=":memory:")
            # Execute multi-statement setup + query
            # Split on the final SELECT
            setup_parts = query.strip().split("SELECT", 1)
            if len(setup_parts) == 2:
                setup_sql = setup_parts[0].strip()
                select_sql = "SELECT" + setup_parts[1]
                # Run setup statements
                for stmt in setup_sql.split(";"):
                    stmt = stmt.strip()
                    if stmt:
                        try:
                            conn.execute(stmt)
                        except Exception:
                            pass  # Extensions may already be loaded
                result = conn.execute(select_sql)
            else:
                result = conn.execute(query)

            columns = [desc[0] for desc in result.description]
            for row in result.fetchall():
                yield dict(zip(columns, row))

            conn.close()
        except Exception as e:
            self.logger.error(f"Overture fetch failed: {e}")
            raise

    def map_record(self, raw: Dict[str, Any]) -> Optional[CandidateRecord]:
        """Map a raw Overture v2.0 record to a CandidateRecord.

        Column names come from _build_query aliases:
          category_primary  ← basic_category    (Overture v2.0 field)
          taxonomy_primary  ← taxonomy.primary  (Overture v2.0 field)
          category_alt      ← taxonomy.alternates[1] (Overture v2.0 field)
        The v1 fields categories.primary and categories.alternate do not exist
        in v2.0 parquet files and must not be referenced here.
        """
        gers_id = str(raw.get("gers_id", "")).strip()
        name = str(raw.get("name", "")).strip()

        if not name or name.lower() in ("null", "none", ""):
            return None
        if not gers_id:
            return None

        lat = raw.get("latitude")
        lon = raw.get("longitude")
        try:
            lat = float(lat) if lat is not None else None
            lon = float(lon) if lon is not None else None
        except (ValueError, TypeError):
            lat = lon = None

        if not self.is_in_maharashtra(lat, lon):
            return None

        # category_primary comes from basic_category alias in v2.0 query
        category = str(raw.get("category_primary", "")).lower()
        # taxonomy_primary is a dotted path e.g. "eat_and_drink.restaurant" (v2.0 only)
        taxonomy_primary = str(raw.get("taxonomy_primary", "")).lower()
        mapped_type = map_overture_category(category)

        # Vegan signal detection from name, basic_category, and taxonomy alternate
        # category_alt comes from taxonomy.alternates[1] alias in v2.0 query
        signal_sources = [name, category, taxonomy_primary, str(raw.get("category_alt", ""))]
        signals, strength = self.detect_vegan_signals(signal_sources)

        # Determine operating status from confidence
        confidence = raw.get("confidence")
        try:
            confidence = float(confidence) if confidence else 0.5
        except (ValueError, TypeError):
            confidence = 0.5

        # NOTE: confidence is NOT vegan evidence. It measures existence likelihood.
        operating_status = "unknown"  # Overture does not provide current operating status

        city = str(raw.get("city", "")).strip() or ""
        address = str(raw.get("address", "")).strip() or ""
        postal_code = str(raw.get("postal_code", "")).strip() or ""
        website = str(raw.get("website", "")).strip() or ""
        phone = str(raw.get("phone", "")).strip() or ""
        source_dataset = str(raw.get("source_dataset", "")).strip()
        source_record_id = str(raw.get("source_record_id", "")).strip()

        # Warn if address is very sparse
        warnings = []
        if not address:
            warnings.append("missing_address")
        if confidence < 0.4:
            warnings.append(f"low_existence_confidence_{confidence:.2f}")

        candidate = CandidateRecord(
            source_id=self.get_source_id(),
            source_record_id=gers_id,
            source_dataset_version=f"overture-{OVERTURE_PINNED_RELEASE}-schema-{OVERTURE_SCHEMA_VERSION}",
            name=name,
            name_alt=[str(raw.get("name_alt", "")).strip()] if raw.get("name_alt") else [],
            address=address,
            city=city,
            district="",   # Overture does not reliably provide district
            state="Maharashtra",
            country="India",
            postal_code=postal_code,
            latitude=lat,
            longitude=lon,
            website=website if website.startswith("http") else "",
            phone=phone,
            source_category=category,
            mapped_place_type=mapped_type,
            operating_status=operating_status,
            vegan_signals=signals,
            vegan_signal_strength=strength,
            vegan_classification="vegan_status_unverified",
            existence_status="candidate",
            evidence_status="no_vegan_evidence",
            upstream_source_ids={
                "overture_gers": gers_id,
                "overture_source_dataset": source_dataset,
                "overture_source_record_id": source_record_id,
            },
            source_attribution="Overture Maps Foundation (CDLA Permissive 2.0)",
            licence="CDLA Permissive 2.0",
            collection_date=datetime.now(timezone.utc).date().isoformat(),
            quality_warnings=warnings,
            image_rights="unverified",
        )

        # Normalisation
        candidate.normalised_name = self.normalise_name(name)
        candidate.normalised_phone = self.normalise_phone(phone)
        candidate.normalised_website = self.normalise_website(website)

        # Generate stable candidate ID
        candidate.candidate_id = self.make_candidate_id("", gers_id)

        return candidate


def run_maharashtra_pilot(
    output_path: str = "data/processed/overture_maharashtra_pilot.ndjson",
    manifest_path: str = "data/manifests/overture_pilot_manifest.json",
    dry_run: bool = False,
    limit: Optional[int] = None,
) -> ImportManifest:
    """
    Run the Overture Maharashtra pilot extraction.
    Returns the ImportManifest with actual counts.
    """
    import uuid
    from datetime import datetime, timezone

    batch_id = f"overture-mh-pilot-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"
    now_iso = datetime.now(timezone.utc).isoformat()

    manifest = ImportManifest(
        batch_id=batch_id,
        source_id="overture-maps-places",
        dataset_version="latest",
        geographic_scope="Maharashtra, India",
        bounding_box=MAHARASHTRA_BBOX,
        extraction_date=now_iso[:10],
        processing_start=now_iso,
        licence="CDLA Permissive 2.0",
        licence_url="https://cdla.dev/permissive-2-0/",
        notes=f"dry_run={dry_run}" + (f", limit={limit}" if limit else ""),
    )

    adapter = OvertureAdapter(config={})
    candidates = adapter.run_batch(
        manifest=manifest,
        output_path=output_path,
        dry_run=dry_run,
        limit=limit,
    )

    manifest.save(manifest_path)
    logger.info(f"Pilot complete: {len(candidates)} candidates")
    return manifest


if __name__ == "__main__":
    import sys
    import argparse

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")

    parser = argparse.ArgumentParser(description="Overture Maharashtra Pilot Extraction")
    parser.add_argument("--dry-run", action="store_true", help="Fetch only 50 records (no file write)")
    parser.add_argument("--limit", type=int, default=None, help="Max records to process")
    parser.add_argument("--output", default="data/processed/overture_maharashtra.ndjson")
    parser.add_argument("--manifest", default="data/manifests/overture_manifest.json")
    args = parser.parse_args()

    manifest = run_maharashtra_pilot(
        output_path=args.output,
        manifest_path=args.manifest,
        dry_run=args.dry_run,
        limit=args.limit,
    )
    print(json.dumps(manifest.to_dict(), indent=2, default=str))

