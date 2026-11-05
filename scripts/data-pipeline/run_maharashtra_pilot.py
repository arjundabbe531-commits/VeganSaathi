"""
VeganSaathi — Maharashtra Pilot Execution Script
=================================================
Runs candidate normalization, quality scoring, deduplication, and manifest
generation for the Maharashtra pilot across Nagpur, Pune, Mumbai, and Shegaon/Akola.

Outputs:
- data/processed/maharashtra_pilot_candidates.ndjson
- data/manifests/maharashtra_pilot_manifest.json
- data/manifests/maharashtra_pilot_report.json

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
    fixture_path = os.path.join(base_dir, "fixtures", "maharashtra_pilot_data.json")
    
    os.makedirs(os.path.join(base_dir, "../../data/processed"), exist_ok=True)
    os.makedirs(os.path.join(base_dir, "../../data/manifests"), exist_ok=True)
    
    output_ndjson = os.path.join(base_dir, "../../data/processed/maharashtra_pilot_candidates.ndjson")
    manifest_path = os.path.join(base_dir, "../../data/manifests/maharashtra_pilot_manifest.json")
    report_path = os.path.join(base_dir, "../../data/manifests/maharashtra_pilot_report.json")

    print(f"Loading Maharashtra pilot data from {fixture_path}...")
    with open(fixture_path, "r", encoding="utf-8") as f:
        raw_places = json.load(f)

    batch_id = f"mh-pilot-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"
    manifest = ImportManifest(
        batch_id=batch_id,
        source_id="multi-source-pilot (Overture, OSM, Fieldwork)",
        dataset_version="pilot-2026.1",
        geographic_scope="Maharashtra: Nagpur, Pune, Mumbai, Shegaon, Akola",
        bounding_box={"min_lat": 18.0, "max_lat": 22.0, "min_lon": 72.5, "max_lon": 80.0},
        extraction_date=datetime.now(timezone.utc).date().isoformat(),
        processing_start=datetime.now(timezone.utc).isoformat(),
        licence="CDLA Permissive 2.0 / ODbL 1.0",
        licence_url="https://cdla.dev/permissive-2-0/",
        notes="Maharashtra 5-region pilot dataset including deduplication and quality scoring",
    )

    candidates = []
    with open(output_ndjson, "w", encoding="utf-8") as out_f:
        for p in raw_places:
            cand = CandidateRecord(
                candidate_id=f"cand_{p['source_id'][:7]}_{p['source_record_id']}",
                source_id=p["source_id"],
                source_record_id=p["source_record_id"],
                source_dataset_version=p["source_dataset_version"],
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
                upstream_source_ids=p.get("upstream_source_ids", {}),
                source_attribution=p.get("source_attribution", ""),
                licence=p.get("licence", ""),
                collection_date=datetime.now(timezone.utc).date().isoformat(),
            )
            cand.compute_quality_flags()
            cand.normalised_name = cand.name.lower().strip()
            cand.normalised_phone = "".join(c for c in cand.phone if c.isdigit())[-10:] if cand.phone else ""
            cand.normalised_website = cand.website.lower().replace("https://", "").replace("http://", "").replace("www.", "").rstrip("/") if cand.website else ""

            candidates.append(cand)
            manifest.input_count += 1
            manifest.candidate_count += 1
            out_f.write(cand.to_json() + "\n")

    # Run deduplication
    print(f"Running deduplication on {len(candidates)} candidates...")
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

    print("\n==========================================")
    print("  MAHARASHTRA PILOT EXECUTION SUMMARY")
    print("==========================================")
    print(f"Total Candidates:   {manifest.candidate_count}")
    print(f"Duplicates Flagged: {manifest.duplicate_count}")
    print(f"Cities Covered:     {list(report['by_city'].keys())}")
    print(f"Places by Type:     {report['by_place_type']}")
    print(f"Vegan Signals:      {report['vegan_signals']}")
    print(f"Manifest written:   {manifest_path}")
    print(f"Candidates file:    {output_ndjson}")
    print(f"Quality report:     {report_path}")
    print("==========================================\n")


if __name__ == "__main__":
    main()
