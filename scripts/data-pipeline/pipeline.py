"""
VeganSaathi — Main Pipeline Orchestrator
==========================================
Runs the complete data acquisition and processing pipeline.

Usage:
  python pipeline.py --help
  python pipeline.py overture --dry-run
  python pipeline.py overture --output data/processed/overture_mh.ndjson
  python pipeline.py osm --pbf data/raw/osm/western-zone-latest.osm.pbf
  python pipeline.py foursquare --include-test-fixtures
  python pipeline.py foursquare  (requires verified Foursquare Portal settings)
  python pipeline.py all --dry-run
  python pipeline.py report --input data/processed/

All operations are local. Nothing writes to Firebase or Firestore.
Processed candidates are saved to data/processed/ as NDJSON files.
Manifests are saved to data/manifests/.

Zero-budget policy: No paid APIs, no cloud processing costs.
"""

from __future__ import annotations
import argparse
import json
import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from typing import List, Optional

# Add parent directories to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from adapters.base_adapter import CandidateRecord, ImportManifest
from adapters.overture_adapter import OvertureAdapter, MAHARASHTRA_BBOX as OV_BBOX
from adapters.osm_adapter import OSMAdapter, MAHARASHTRA_BBOX as OSM_BBOX
from adapters.foursquare_adapter import FoursquareAdapter, FoursquareFixtureAdapter, MAHARASHTRA_BBOX as FSQ_BBOX
from processing.deduplication import detect_duplicates, generate_dedup_report

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ]
)
logger = logging.getLogger("vegansaathi.pipeline")


def ensure_dirs():
    for d in ["data/raw", "data/processed", "data/manifests"]:
        os.makedirs(d, exist_ok=True)


def make_batch_id(source: str) -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    return f"{source}-{ts}-{uuid.uuid4().hex[:6]}"


def run_overture(args):
    """Run the Overture Maps Maharashtra extraction."""
    ensure_dirs()
    batch_id = make_batch_id("overture")
    output = args.output or f"data/processed/overture_{datetime.now().strftime('%Y%m%d')}.ndjson"
    manifest_path = f"data/manifests/{batch_id}_manifest.json"

    manifest = ImportManifest(
        batch_id=batch_id,
        source_id="overture-maps-places",
        dataset_version="latest",
        geographic_scope="Maharashtra, India",
        bounding_box=OV_BBOX,
        extraction_date=datetime.now(timezone.utc).date().isoformat(),
        processing_start=datetime.now(timezone.utc).isoformat(),
        licence="CDLA Permissive 2.0",
        licence_url="https://cdla.dev/permissive-2-0/",
        notes=f"dry_run={args.dry_run}",
    )

    adapter = OvertureAdapter(config={})
    logger.info(f"=== Overture Extraction — batch {batch_id} ===")
    logger.info(f"Output: {output}")
    logger.info(f"Dry run: {args.dry_run}")

    candidates = adapter.run_batch(
        manifest=manifest,
        output_path=output,
        dry_run=args.dry_run,
        limit=args.limit,
    )

    manifest.save(manifest_path)
    print_manifest_summary(manifest)
    return candidates, manifest


def run_osm(args):
    """Run the OSM PBF extraction."""
    ensure_dirs()
    pbf_path = args.pbf

    if not pbf_path:
        logger.error(
            "OSM adapter requires --pbf <path-to-osm.pbf>\n"
            "Download Western India extract (~250MB) from:\n"
            "  https://download.geofabrik.de/asia/india/western-zone-latest.osm.pbf\n"
            "Or full India (~1.6GB):\n"
            "  https://download.geofabrik.de/asia/india-latest.osm.pbf"
        )
        return [], None

    batch_id = make_batch_id("osm")
    output = args.output or f"data/processed/osm_{datetime.now().strftime('%Y%m%d')}.ndjson"
    manifest_path = f"data/manifests/{batch_id}_manifest.json"

    manifest = ImportManifest(
        batch_id=batch_id,
        source_id="openstreetmap-geofabrik",
        dataset_version="osm-daily",
        geographic_scope="Maharashtra, India (from Western India / India extract)",
        bounding_box=OSM_BBOX,
        extraction_date=datetime.now(timezone.utc).date().isoformat(),
        processing_start=datetime.now(timezone.utc).isoformat(),
        licence="ODbL 1.0",
        licence_url="https://www.openstreetmap.org/copyright",
        notes=f"pbf_path={pbf_path}, dry_run={args.dry_run}",
    )

    adapter = OSMAdapter(config={"pbf_path": pbf_path})
    logger.info(f"=== OSM Extraction — batch {batch_id} ===")

    candidates = adapter.run_batch(
        manifest=manifest,
        output_path=output,
        dry_run=args.dry_run,
        limit=args.limit,
    )

    manifest.save(manifest_path)
    print_manifest_summary(manifest)
    return candidates, manifest


def run_foursquare(args):
    """Run Foursquare only with verified portal settings and explicit zero-cost confirmation."""
    ensure_dirs()
    use_fixtures = getattr(args, "include_test_fixtures", False)

    batch_id = make_batch_id("foursquare")
    output = args.output or f"data/processed/fsq_{datetime.now().strftime('%Y%m%d')}.ndjson"
    manifest_path = f"data/manifests/{batch_id}_manifest.json"

    manifest = ImportManifest(
        batch_id=batch_id,
        source_id="foursquare-os-places",
        dataset_version=("vegansaathi-foursquare-fixtures-2026.1" if use_fixtures else os.environ.get("FSQ_DATASET_VERSION", "not-acquired")),
        geographic_scope="Maharashtra, India",
        bounding_box=FSQ_BBOX,
        extraction_date=datetime.now(timezone.utc).date().isoformat(),
        processing_start=datetime.now(timezone.utc).isoformat(),
        licence="Apache 2.0",
        licence_url="https://www.apache.org/licenses/LICENSE-2.0",
        notes=f"fixture_mode={use_fixtures}, dry_run={args.dry_run}",
    )

    if use_fixtures:
        logger.info("=== Foursquare Fixture Extraction (sample data, no credentials) ===")
        adapter = FoursquareFixtureAdapter(config={})
    else:
        config = {
            "access_token": os.environ.get("FSQ_ACCESS_TOKEN", ""),
            "catalog_uri": os.environ.get("FSQ_CATALOG_URI", ""),
            "warehouse": os.environ.get("FSQ_WAREHOUSE", ""),
            "namespace": os.environ.get("FSQ_NAMESPACE", ""),
            "places_table": os.environ.get("FSQ_PLACES_TABLE", ""),
            "categories_table": os.environ.get("FSQ_CATEGORIES_TABLE", ""),
            "dataset_version": os.environ.get("FSQ_DATASET_VERSION", ""),
            "licence_confirmed": os.environ.get("FSQ_LICENCE_CONFIRMED") == "Apache-2.0",
            "zero_cost_confirmed": os.environ.get("FSQ_ZERO_COST_CONFIRMED", "").lower() == "true",
        }
        adapter = FoursquareAdapter(config=config)
        if not adapter.validate_config():
            logger.warning("Foursquare access is blocked. No dataset query was attempted.")
            manifest.import_status = "blocked"
            manifest.errors.append("missing or unverified Foursquare portal settings, dataset release, licence, or zero-cost confirmation")
            manifest.notes += " | BLOCKED: requires explicit verified portal configuration; no live query attempted"
            manifest.save(manifest_path)
            print_manifest_summary(manifest)
            return [], manifest
        logger.info(f"=== Foursquare Extraction — batch {batch_id} ===")

    candidates = adapter.run_batch(
        manifest=manifest,
        output_path=output,
        dry_run=args.dry_run,
        limit=args.limit,
    )

    manifest.save(manifest_path)
    print_manifest_summary(manifest)
    return candidates, manifest


def run_all(args):
    """Run all available adapters and produce a combined deduplication report."""
    ensure_dirs()
    all_candidates: List[CandidateRecord] = []

    logger.info("=== VeganSaathi Full Maharashtra Pilot ===")

    # Overture
    cands_ov, manifest_ov = run_overture(args)
    all_candidates.extend(cands_ov)

    # OSM (only if PBF provided)
    if getattr(args, "pbf", None):
        cands_osm, _ = run_osm(args)
        all_candidates.extend(cands_osm)
    else:
        logger.info("OSM: skipped (no --pbf provided)")

    # Fixtures never enter the normal all-source pipeline. Test data requires
    # the deliberately explicit --include-test-fixtures option.
    if getattr(args, "include_test_fixtures", False):
        args_fsq = type("args", (), {
            "dry_run": args.dry_run,
            "output": None,
            "limit": args.limit,
            "include_test_fixtures": True,
        })()
        cands_fsq, _ = run_foursquare(args_fsq)
        all_candidates.extend(cands_fsq)
    else:
        logger.info("Foursquare test fixtures: excluded (pass --include-test-fixtures for isolated test data)")

    # Deduplication
    if all_candidates:
        logger.info(f"Running deduplication on {len(all_candidates)} total candidates...")
        matches = detect_duplicates(all_candidates)
        report = generate_dedup_report(all_candidates, matches)

        report_path = f"data/manifests/pilot_dedup_report_{datetime.now().strftime('%Y%m%d')}.json"
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)

        print("\n=== MAHARASHTRA PILOT REPORT ===")
        print(json.dumps(report, indent=2))
        logger.info(f"Dedup report saved: {report_path}")

    return all_candidates


def print_manifest_summary(manifest: ImportManifest):
    """Print a human-readable manifest summary."""
    print(f"\n--- Batch: {manifest.batch_id} ---")
    print(f"Source:      {manifest.source_id}")
    print(f"Status:      {manifest.import_status}")
    print(f"Input:       {manifest.input_count}")
    print(f"Candidates:  {manifest.candidate_count}")
    print(f"Rejected:    {manifest.rejected_count}")
    print(f"Duplicates:  {manifest.duplicate_count}")
    print(f"Errors:      {manifest.error_count}")
    if manifest.errors:
        for e in manifest.errors:
            print(f"  ERROR: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="VeganSaathi Place Data Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run Overture (fetches ~50 records to validate setup)
  python pipeline.py overture --dry-run

  # Full Overture Maharashtra extraction
  python pipeline.py overture --output data/processed/overture_mh.ndjson

  # OSM extraction (requires downloaded PBF)
  python pipeline.py osm --pbf data/raw/osm/western-zone-latest.osm.pbf

  # Foursquare with fixture data (no credentials needed)
  python pipeline.py foursquare --include-test-fixtures

  # Foursquare with real credentials
  # Live access is blocked until portal release, licence, and zero-cost settings are verified
  python pipeline.py foursquare

  # Run all sources and produce pilot report
  python pipeline.py all --dry-run

  # Explicitly include synthetic fixtures for pipeline testing only
  python pipeline.py all --dry-run --include-test-fixtures
        """,
    )

    subparsers = parser.add_subparsers(dest="command")

    # Overture
    p_ov = subparsers.add_parser("overture", help="Run Overture Maps extraction")
    p_ov.add_argument("--dry-run", action="store_true", help="Fetch only 50 records")
    p_ov.add_argument("--output", default=None, help="Output NDJSON path")
    p_ov.add_argument("--limit", type=int, default=None)

    # OSM
    p_osm = subparsers.add_parser("osm", help="Run OSM PBF extraction")
    p_osm.add_argument("--pbf", required=True, help="Path to .osm.pbf file")
    p_osm.add_argument("--dry-run", action="store_true")
    p_osm.add_argument("--output", default=None)
    p_osm.add_argument("--limit", type=int, default=None)

    # Foursquare
    p_fsq = subparsers.add_parser("foursquare", help="Run Foursquare OS Places extraction")
    p_fsq.add_argument("--include-test-fixtures", action="store_true",
                       help="Use synthetic fixtures for isolated testing only")
    p_fsq.add_argument("--dry-run", action="store_true")
    p_fsq.add_argument("--output", default=None)
    p_fsq.add_argument("--limit", type=int, default=None)

    # All
    p_all = subparsers.add_parser("all", help="Run all adapters and produce pilot report")
    p_all.add_argument("--dry-run", action="store_true")
    p_all.add_argument("--pbf", default=None, help="Optional OSM PBF path")
    p_all.add_argument("--limit", type=int, default=None)
    p_all.add_argument("--output", default=None)
    p_all.add_argument("--include-test-fixtures", action="store_true",
                       help="Include synthetic test fixtures; they cannot be staged or published")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    if args.command == "overture":
        run_overture(args)
    elif args.command == "osm":
        run_osm(args)
    elif args.command == "foursquare":
        run_foursquare(args)
    elif args.command == "all":
        run_all(args)


if __name__ == "__main__":
    main()

