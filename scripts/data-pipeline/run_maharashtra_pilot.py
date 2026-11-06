"""
VeganSaathi — Synthetic Demonstration Pilot Execution Script
============================================================
Runs candidate normalization, quality scoring, deduplication, and manifest
generation for the synthetic test fixtures across Maharashtra (Nagpur, Pune,
Mumbai, Shegaon, and Akola).

IMPORTANT:
This script processes PROJECT-CREATED SYNTHETIC TEST FIXTURES ONLY.
It does NOT perform genuine external extraction or fieldwork verification.
Its purpose is unit and integration testing of the data ingestion pipeline.

Outputs:
- data/processed/synthetic_pilot_candidates.ndjson
- data/manifests/synthetic_pilot_manifest.json
- data/manifests/synthetic_pilot_report.json

Zero-budget: runs 100% locally with zero cloud or API costs.
"""

import json
import os
import sys
from datetime import datetime, timezone

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from adapters.base_adapter import CandidateRecord, ImportManifest
from processing.deduplication import detect_duplicates, generate_dedup_report


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    fixture_path = os.path.join(base_dir, "fixtures", "synthetic_maharashtra_pilot_fixtures.json")

    os.makedirs(os.path.join(base_dir, "../../data/processed"), exist_ok=True)
    os.makedirs(os.path.join(base_dir, "../../data/manifests"), exist_ok=True)

    output_ndjson = os.path.join(base_dir, "../../data/processed/synthetic_pilot_candidates.ndjson")
    manifest_path = os.path.join(base_dir, "../../data/manifests/synthetic_pilot_manifest.json")
    report_path = os.path.join(base_dir, "../../data/manifests/synthetic_pilot_report.json")

    print(f"Loading synthetic demonstration fixtures from {fixture_path}...")
    with open(fixture_path, "r", encoding="utf-8") as f:
        raw_places = json.load(f)

    batch_id = f"synthetic-test-pilot-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"
    manifest = ImportManifest(
        batch_id=batch_id,
        source_id="synthetic-demonstration-fixture",
        dataset_version="synthetic-fixtures-2026.1",
        geographic_scope="Maharashtra synthetic test coverage (Nagpur, Pune, Mumbai, Shegaon, Akola)",
        bounding_box={"min_lat": 18.0, "max_lat": 22.0, "min_lon": 72.5, "max_lon": 80.0},
        extraction_date=datetime.now(timezone.utc).date().isoformat(),
        processing_start=datetime.now(timezone.utc).isoformat(),
        licence="Project Test Fixture (Not a live upstream export)",
        licence_url="",
        notes=(
            "SYNTHETIC TEST FIXTURE ONLY: This batch processes project-created test records "
            "to validate data normalization, quality scoring, and deduplication logic. "
            "No genuine upstream Overture, OSM, or fieldwork extraction occurred in this run. "
            "These records must NEVER be published or imported as verified real-world businesses."
        ),
        is_synthetic_fixture=True,
        synthetic_dataset_version="vegansaathi-maharashtra-fixtures-2026.1",
    )

    candidates = []
    with open(output_ndjson, "w", encoding="utf-8") as out_f:
        for p in raw_places:
            cand = CandidateRecord(
                candidate_id=f"cand_synthetic_fixture_{p['synthetic_fixture_id']}",
                source_id="synthetic-demonstration-fixture",
                source_record_id=p["source_record_id"],
                source_dataset_version="synthetic-test-fixture",
                is_synthetic_fixture=True,
                synthetic_fixture_id=p["synthetic_fixture_id"],
                synthetic_dataset_version=p["synthetic_dataset_version"],
                batch_id=batch_id,
                name=p["name"],
                name_alt=p.get("name_alt", []),
                brand=p.get("brand", ""),
                address=p["address"],
                area=p.get("area", ""),
                city=p["city"],
                district=p.get("district", ""),
                state=p.get("state", "Maharashtra"),
                country=p.get("country", "India"),
                postal_code=p.get("postal_code", ""),
                latitude=p.get("latitude"),
                longitude=p.get("longitude"),
                location_confidence=p.get("location_confidence", "unknown"),
                website=p.get("website", ""),
                phone=p.get("phone", ""),
                email=p.get("email", ""),
                source_category=p.get("source_category", ""),
                mapped_place_type=p.get("mapped_place_type", "restaurant"),
                operating_status=p.get("operating_status", "open"),
                vegan_signals=p.get("vegan_signals", []),
                vegan_signal_strength=p.get("vegan_signal_strength", "none"),
                vegan_classification="vegan_status_unverified",
                existence_status="candidate",
                evidence_status="no_vegan_evidence",
                upstream_source_ids=p.get("upstream_source_ids", {"synthetic_fixture_id": p["source_record_id"]}),
                source_attribution="VeganSaathi Synthetic Test Fixture",
                licence="Test Data",
                collection_date=datetime.now(timezone.utc).date().isoformat(),
            )
            cand.compute_quality_flags()
            cand.normalised_name = cand.name.lower().strip()
            cand.normalised_phone = "".join(c for c in cand.phone if c.isdigit())[-10:] if cand.phone else ""
            cand.normalised_website = cand.website.lower().replace("https://", "").replace("http://", "").replace("www.", "").rstrip("/") if cand.website else ""

            candidates.append(cand)
            manifest.synthetic_fixture_ids.append(p["synthetic_fixture_id"])
            manifest.input_count += 1
            manifest.candidate_count += 1
            out_f.write(cand.to_json() + "\n")

    # Run deduplication
    print(f"Running deduplication on {len(candidates)} synthetic candidates...")
    matches = detect_duplicates(candidates)
    manifest.duplicate_count = len(matches)

    # Save manifest
    manifest.processing_end = datetime.now(timezone.utc).isoformat()
    manifest.import_status = "complete"
    manifest.output_path = output_ndjson
    manifest.save(manifest_path)

    # Generate and save report
    report = generate_dedup_report(candidates, matches)
    report["batch_id"] = batch_id
    report["is_synthetic_fixture"] = True
    report["dataset_origin"] = "synthetic_maharashtra_pilot_fixtures.json"
    report["batch_purpose"] = "pipeline_unit_and_flow_testing"
    report["real_world_verification_status"] = "none (synthetic demonstration fixture only)"
    report["duplicate_pairs"] = [
        {
            "a": m.candidate_a_id,
            "b": m.candidate_b_id,
            "type": m.match_type,
            "score": m.match_score,
            "signals": m.match_signals,
        }
        for m in matches
    ]
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print("\n==================================================")
    print("  SYNTHETIC DEMONSTRATION PILOT EXECUTION SUMMARY")
    print("==================================================")
    print("  INPUT TYPE:         Synthetic Demonstration Fixture")
    print(f"  SYNTHETIC RECORDS:  {manifest.candidate_count}")
    print(f"  DUPLICATES DETECTED:{manifest.duplicate_count}")
    print(f"  TEST CITIES:        {list(report['by_city'].keys())}")
    print(f"  VERIFICATION STATUS:None (test fixtures only)")
    print(f"  MANIFEST WRITTEN:   {manifest_path}")
    print(f"  CANDIDATES NDJSON:  {output_ndjson}")
    print(f"  QUALITY REPORT:     {report_path}")
    print("==================================================\n")


if __name__ == "__main__":
    main()
