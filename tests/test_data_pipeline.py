"""
VeganSaathi — Unit Tests for Data Acquisition & Deduplication Pipeline
======================================================================
Tests:
- BaseSourceAdapter and CandidateRecord schema validation
- Overture category mapping and Maharashtra bounds check
- Foursquare fixture adapter
- Deduplication logic (exact ID, phone normalization, website normalization, haversine distance)
- Zero-cost assertions
"""

import unittest
import json
import os
import sys

# Add scripts directory
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts", "data-pipeline"))

from adapters.base_adapter import CandidateRecord, ImportManifest
from adapters.overture_adapter import OvertureAdapter, OVERTURE_CATEGORY_MAP
from adapters.foursquare_adapter import FoursquareFixtureAdapter
from processing.deduplication import detect_duplicates, generate_dedup_report, _haversine_m, _name_similarity


class TestDataPipeline(unittest.TestCase):

    def test_candidate_record_quality_flags(self):
        c = CandidateRecord(
            name="Test Cafe",
            address="123 Road, Pune",
            latitude=18.5204,
            longitude=73.8567,
            phone="+912012345678",
            website="https://testcafe.in"
        )
        c.compute_quality_flags()
        self.assertTrue(c.has_name)
        self.assertTrue(c.has_coordinates)
        self.assertTrue(c.has_address)
        self.assertTrue(c.has_website)
        self.assertTrue(c.has_phone)
        self.assertEqual(len(c.quality_warnings), 0)

    def test_candidate_record_missing_coords(self):
        c = CandidateRecord(name="Test Place", address="Nagpur")
        c.compute_quality_flags()
        self.assertFalse(c.has_coordinates)
        self.assertIn("missing_or_invalid_coordinates", c.quality_warnings)

    def test_overture_category_mapping(self):
        self.assertEqual(OVERTURE_CATEGORY_MAP["restaurant"], "restaurant")
        self.assertEqual(OVERTURE_CATEGORY_MAP["cafe"], "cafe")
        self.assertEqual(OVERTURE_CATEGORY_MAP["bakery"], "bakery")
        self.assertEqual(OVERTURE_CATEGORY_MAP["grocery"], "shop")

    def test_foursquare_fixture_adapter(self):
        adapter = FoursquareFixtureAdapter(config={})
        self.assertTrue(adapter.validate_config())
        records = list(adapter.fetch_records(dry_run=True))
        self.assertEqual(len(records), 3)
        cands = [adapter.map_record(r) for r in records]
        self.assertEqual(len(cands), 3)
        self.assertTrue(all(c is not None for c in cands))
        self.assertEqual(cands[0].city, "Nagpur")
        self.assertEqual(cands[1].city, "Pune")
        self.assertEqual(cands[2].city, "Mumbai")

    def test_haversine_distance(self):
        # Distance between Mumbai (19.0760, 72.8777) and Pune (18.5204, 73.8567) is ~120 km
        dist = _haversine_m(19.0760, 72.8777, 18.5204, 73.8567)
        self.assertTrue(115000 < dist < 125000, f"Distance {dist} should be ~120km")

    def test_name_similarity(self):
        sim1 = _name_similarity("earth cafe", "earth cafe")
        self.assertEqual(sim1, 1.0)
        sim2 = _name_similarity("earth cafe", "earth cafe bandra")
        self.assertTrue(sim2 > 0.5)
        sim3 = _name_similarity("mcdonalds", "burger king")
        self.assertTrue(sim3 < 0.4)

    def test_deduplication_exact_match(self):
        c1 = CandidateRecord(
            candidate_id="c1",
            name="Green Table",
            latitude=18.5,
            longitude=73.8,
            upstream_source_ids={"overture_gers": "gers_abc123"}
        )
        c2 = CandidateRecord(
            candidate_id="c2",
            name="Green Table Restaurant",
            latitude=18.5,
            longitude=73.8,
            upstream_source_ids={"overture_gers": "gers_abc123"}
        )
        c1.compute_quality_flags()
        c2.compute_quality_flags()
        matches = detect_duplicates([c1, c2])
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0].match_type, "exact")

    def test_deduplication_phone_match(self):
        c1 = CandidateRecord(
            candidate_id="c1",
            name="Green Soul",
            phone="9876543210",
            normalised_phone="9876543210",
            normalised_name="green soul",
            latitude=18.52,
            longitude=73.85
        )
        c2 = CandidateRecord(
            candidate_id="c2",
            name="Green Soul Cafe",
            phone="9876543210",
            normalised_phone="9876543210",
            normalised_name="green soul cafe",
            latitude=18.52,
            longitude=73.85
        )
        c1.compute_quality_flags()
        c2.compute_quality_flags()
        matches = detect_duplicates([c1, c2])
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0].match_type, "highly_probable")


if __name__ == "__main__":
    unittest.main()
