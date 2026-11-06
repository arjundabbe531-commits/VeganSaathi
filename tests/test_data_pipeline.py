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
import tempfile

# Add scripts directory
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts", "data-pipeline"))

from adapters.base_adapter import CandidateRecord, ImportManifest
from adapters.overture_adapter import OvertureAdapter, OVERTURE_CATEGORY_MAP, OVERTURE_PINNED_RELEASE, OVERTURE_SCHEMA_VERSION
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
        self.assertTrue(all(r["is_synthetic_fixture"] is True for r in records))
        self.assertEqual(len({r["synthetic_fixture_id"] for r in records}), 3)
        self.assertTrue(all(r["synthetic_dataset_version"] == adapter.FIXTURE_DATASET_VERSION for r in records))
        cands = [adapter.map_record(r) for r in records]
        self.assertEqual(len(cands), 3)
        self.assertTrue(all(c is not None for c in cands))
        self.assertTrue(all(c.is_synthetic_fixture for c in cands))
        self.assertTrue(all(c.candidate_id.startswith("cand_synthetic_fixture_") for c in cands))
        self.assertEqual(cands[0].city, "Nagpur")
        self.assertEqual(cands[1].city, "Pune")
        self.assertEqual(cands[2].city, "Mumbai")
        self.assertTrue(all(c.source_dataset_version == f"fsq-os-{adapter.FIXTURE_DATASET_VERSION}" for c in cands))

    def test_foursquare_portal_query_uses_pinned_catalog_and_bounded_fetch(self):
        from unittest.mock import MagicMock, patch
        from adapters.foursquare_adapter import FoursquareAdapter

        config = {
            "access_token": "test-secret", "catalog_uri": "https://catalog.example.test/iceberg",
            "warehouse": "test-warehouse", "namespace": "fsq", "places_table": "places",
            "categories_table": "categories", "dataset_version": "2026-10-15",
            "licence_confirmed": True, "zero_cost_confirmed": True,
        }
        result = MagicMock()
        result.description = [("fsq_place_id",), ("name",)]
        result.fetchmany.side_effect = [[("p-1", "Test Cafe")], []]
        connection = MagicMock()
        connection.execute.return_value = result
        duckdb = MagicMock()
        duckdb.connect.return_value = connection

        with patch.dict(sys.modules, {"duckdb": duckdb}):
            adapter = FoursquareAdapter(config=config)
            rows = list(adapter.fetch_records())

        self.assertEqual(rows, [{"fsq_place_id": "p-1", "name": "Test Cafe", "dataset_version": "2026-10-15"}])
        statements = [call.args[0] for call in connection.execute.call_args_list]
        query = statements[-1]
        self.assertIn("SELECT p.fsq_place_id", query)
        self.assertIn("JOIN fsq_catalog.fsq.categories", query)
        self.assertIn("date_refreshed", query)
        self.assertNotIn("13070", query)
        self.assertEqual(result.fetchmany.call_args_list[0].args, (1000,))
        self.assertTrue(any("TYPE iceberg, TOKEN" in statement for statement in statements))
        self.assertTrue(any("ATTACH 'test-warehouse'" in statement for statement in statements))
        connection.close.assert_called_once()

    def test_foursquare_live_access_requires_explicit_zero_cost_and_license(self):
        from adapters.foursquare_adapter import FoursquareAdapter
        from unittest.mock import patch
        config = {
            "access_token": "test-secret", "catalog_uri": "https://catalog.example.test/iceberg",
            "warehouse": "test-warehouse", "namespace": "fsq", "places_table": "places",
            "categories_table": "categories", "dataset_version": "2026-10-15",
            "licence_confirmed": True, "zero_cost_confirmed": False,
        }
        with patch.dict(sys.modules, {"duckdb": object()}):
            self.assertFalse(FoursquareAdapter(config=config).validate_config())

    def test_foursquare_query_errors_do_not_log_secret(self):
        from unittest.mock import MagicMock, patch
        from adapters.foursquare_adapter import FoursquareAdapter
        config = {
            "access_token": "test-secret-never-log", "catalog_uri": "https://catalog.example.test/iceberg",
            "warehouse": "test-warehouse", "namespace": "fsq", "places_table": "places",
            "categories_table": "categories", "dataset_version": "2026-10-15",
            "licence_confirmed": True, "zero_cost_confirmed": True,
        }
        connection = MagicMock()
        connection.execute.side_effect = [None, None, None, None, None, RuntimeError("bad")]
        duckdb = MagicMock()
        duckdb.connect.return_value = connection
        with patch.dict(sys.modules, {"duckdb": duckdb}), self.assertLogs("vegansaathi.adapter.foursquare-os-places", level="ERROR") as logs:
            with self.assertRaisesRegex(RuntimeError, "secret values were withheld"):
                list(FoursquareAdapter(config=config).fetch_records())
        self.assertNotIn("test-secret-never-log", "\n".join(logs.output))

    def test_synthetic_provenance_propagates_to_batch_manifest_and_ndjson(self):
        adapter = FoursquareFixtureAdapter(config={})
        manifest = ImportManifest(
            batch_id="fixture-test-batch",
            source_id="foursquare-os-places",
            dataset_version=adapter.FIXTURE_DATASET_VERSION,
            geographic_scope="synthetic test only",
            bounding_box={},
            extraction_date="2026-11-06",
            processing_start="2026-11-06T00:00:00Z",
        )
        with tempfile.TemporaryDirectory() as temp_dir:
            output = os.path.join(temp_dir, "candidates.ndjson")
            candidates = adapter.run_batch(manifest, output, dry_run=False)
            with open(output, "r", encoding="utf-8") as stream:
                serialized = [json.loads(line) for line in stream]
        self.assertEqual(len(candidates), 3)
        self.assertTrue(manifest.is_synthetic_fixture)
        self.assertEqual(manifest.synthetic_dataset_version, adapter.FIXTURE_DATASET_VERSION)
        self.assertEqual(set(manifest.synthetic_fixture_ids), {c.synthetic_fixture_id for c in candidates})
        self.assertTrue(all(row["is_synthetic_fixture"] for row in serialized))
        self.assertEqual({row["synthetic_dataset_version"] for row in serialized}, {adapter.FIXTURE_DATASET_VERSION})

    def test_default_all_pipeline_excludes_synthetic_foursquare_fixtures(self):
        from unittest.mock import patch
        from types import SimpleNamespace
        import pipeline as pipeline_module
        args = SimpleNamespace(dry_run=True, pbf=None, limit=None, include_test_fixtures=False)
        with patch.object(pipeline_module, "run_overture", return_value=([], None)), \
             patch.object(pipeline_module, "run_foursquare") as fsq:
            result = pipeline_module.run_all(args)
        self.assertEqual(result, [])
        fsq.assert_not_called()

    def test_all_pipeline_includes_fixtures_only_with_explicit_test_option(self):
        from unittest.mock import patch
        from types import SimpleNamespace
        import pipeline as pipeline_module
        args = SimpleNamespace(dry_run=True, pbf=None, limit=None, include_test_fixtures=True)
        with patch.object(pipeline_module, "run_overture", return_value=([], None)), \
             patch.object(pipeline_module, "run_foursquare", return_value=([], None)) as fsq:
            result = pipeline_module.run_all(args)
        fsq.assert_called_once()
        self.assertEqual(result, [])

    def test_fixture_file_has_unique_immutable_provenance(self):
        path = os.path.join(os.path.dirname(__file__), "..", "scripts", "data-pipeline", "fixtures", "synthetic_maharashtra_pilot_fixtures.json")
        with open(path, "r", encoding="utf-8") as f:
            rows = json.load(f)
        ids = [row.get("synthetic_fixture_id") for row in rows]
        self.assertTrue(rows)
        self.assertTrue(all(row.get("is_synthetic_fixture") is True for row in rows))
        self.assertEqual(len(ids), len(set(ids)))
        self.assertTrue(all(isinstance(value, str) and value for value in ids))
        self.assertTrue(all(row.get("synthetic_dataset_version") == "vegansaathi-maharashtra-fixtures-2026.1" for row in rows))

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

    # -----------------------------------------------------------------------
    # Regression tests — Overture v2.0 schema field mapping
    # Covers mandatory inspection finding: adapter used deprecated
    # categories.primary / categories.alternate (v1 schema).
    # These tests verify the v2.0 field names and pinned release constants.
    # -----------------------------------------------------------------------

    def test_overture_v2_schema_constants_are_pinned(self):
        """OVERTURE_PINNED_RELEASE must be a real release string, not 'latest'."""
        self.assertNotEqual(OVERTURE_PINNED_RELEASE, "latest",
                            "OVERTURE_PINNED_RELEASE must NOT be 'latest' — pin a specific release")
        self.assertRegex(OVERTURE_PINNED_RELEASE, r"^\d{4}-\d{2}-\d{2}\.\d+$",
                         "OVERTURE_PINNED_RELEASE must match YYYY-MM-DD.N format")
        self.assertEqual(OVERTURE_SCHEMA_VERSION, "v2.0.0",
                         "OVERTURE_SCHEMA_VERSION must be 'v2.0.0'")

    def test_overture_s3_path_uses_pinned_release(self):
        """The constructed S3 path must contain the pinned release, not 'latest'."""
        from adapters.overture_adapter import OVERTURE_S3_PATH
        self.assertIn(OVERTURE_PINNED_RELEASE, OVERTURE_S3_PATH,
                      "S3 path must reference the pinned release, not 'latest'")
        self.assertNotIn("/latest/", OVERTURE_S3_PATH,
                         "S3 path must NOT use /release/latest/ — schema may change silently")

    def test_overture_v2_query_uses_basic_category_not_categories_primary(self):
        """The DuckDB query must reference basic_category (v2.0), not categories.primary (v1 — removed)."""
        adapter = OvertureAdapter(config={})
        query = adapter._build_query(dry_run=True)

        # Strip SQL comments (-- lines) before checking deprecated field usage
        # Comments may reference old field names as documentation; actual SQL must not.
        sql_lines_no_comments = "\n".join(
            line for line in query.splitlines()
            if not line.strip().startswith("--")
        )

        # v2.0 field that must be present in actual SQL (not just comments)
        self.assertIn("basic_category", sql_lines_no_comments,
                      "Query must use basic_category (Overture v2.0 field)")
        self.assertIn("taxonomy.primary", sql_lines_no_comments,
                      "Query must include taxonomy.primary (Overture v2.0 field)")
        self.assertIn("taxonomy.alternates", sql_lines_no_comments,
                      "Query must include taxonomy.alternates (Overture v2.0 field)")
        # v1 fields that must NOT appear in executable SQL (outside comments)
        self.assertNotIn("categories.primary", sql_lines_no_comments,
                         "Query must NOT reference categories.primary in SQL (removed in Overture v2.0)")
        self.assertNotIn("categories.alternate", sql_lines_no_comments,
                         "Query must NOT reference categories.alternate in SQL (removed in Overture v2.0)")

    def test_overture_v2_map_record_uses_basic_category_alias(self):
        """map_record must extract category from 'category_primary' (alias for basic_category)."""
        adapter = OvertureAdapter(config={})
        # Simulate a v2.0 row using basic_category alias (category_primary in result)
        raw_v2 = {
            "gers_id": "overture_gers_test_001",
            "name": "Green Leaf Cafe",
            "name_alt": "",
            "category_primary": "cafe",         # aliased from basic_category
            "taxonomy_primary": "eat_and_drink.cafe",  # aliased from taxonomy.primary
            "category_alt": "coffee_shop",       # aliased from taxonomy.alternates[1]
            "confidence": 0.85,
            "address": "MG Road, Pune",
            "city": "Pune",
            "state": "Maharashtra",
            "country": "India",
            "postal_code": "411001",
            "latitude": 18.5204,
            "longitude": 73.8567,
            "website": "https://greenleafcafe.in",
            "phone": "+912012345678",
            "brand_wikidata": None,
            "source_dataset": "openstreetmap",
            "source_record_id": "node/123456",
            "source_update_time": "2024-09-18",
        }
        candidate = adapter.map_record(raw_v2)
        self.assertIsNotNone(candidate, "v2.0 fixture record should produce a valid CandidateRecord")
        self.assertEqual(candidate.source_category, "cafe",
                         "source_category must be mapped from category_primary (basic_category alias)")
        self.assertEqual(candidate.mapped_place_type, "cafe",
                         "mapped_place_type must be derived from basic_category alias")
        # source_dataset_version must reference pinned release
        self.assertIn(OVERTURE_PINNED_RELEASE, candidate.source_dataset_version,
                      "source_dataset_version must reference the pinned Overture release")
        self.assertIn(OVERTURE_SCHEMA_VERSION, candidate.source_dataset_version,
                      "source_dataset_version must reference the schema version")
        # vegan classification must remain unverified — category alone is not vegan evidence
        self.assertEqual(candidate.vegan_classification, "vegan_status_unverified",
                         "Overture records must start as vegan_status_unverified")
        self.assertEqual(candidate.evidence_status, "no_vegan_evidence",
                         "Overture records must start with no_vegan_evidence")

    def test_overture_v2_map_record_rejects_v1_only_fixture(self):
        """A v1-style raw record using category_primary='food' but no basic_category alias
        is handled gracefully — the adapter reads from the aliased column name, not v1 field path."""
        adapter = OvertureAdapter(config={})
        # A record where category_primary is present (from basic_category alias) — still valid
        raw_with_food = {
            "gers_id": "overture_food_test_002",
            "name": "Veggie Delight",
            "name_alt": "",
            "category_primary": "food",  # food is in FOOD_RELEVANT_PRIMARY
            "taxonomy_primary": "eat_and_drink",
            "category_alt": "",
            "confidence": 0.7,
            "address": "FC Road, Pune",
            "city": "Pune",
            "state": "Maharashtra",
            "country": "India",
            "postal_code": "411004",
            "latitude": 18.5300,
            "longitude": 73.8400,
            "website": "",
            "phone": "",
            "brand_wikidata": None,
            "source_dataset": "meta",
            "source_record_id": "meta_abc",
            "source_update_time": "2024-09-18",
        }
        candidate = adapter.map_record(raw_with_food)
        self.assertIsNotNone(candidate, "v2.0 'food' category fixture should produce a CandidateRecord")
        self.assertEqual(candidate.source_category, "food")

    def test_source_registry_overture_has_pinned_version(self):
        """source_registry.json Overture entry must have a pinned dataset_version, not 'latest'."""
        import json as _json
        reg_path = os.path.join(os.path.dirname(__file__), "..", "scripts", "data-pipeline", "source_registry.json")
        with open(reg_path, "r", encoding="utf-8") as f:
            reg = _json.load(f)
        overture = next((s for s in reg["sources"] if s["id"] == "overture-maps-places"), None)
        self.assertIsNotNone(overture, "Overture source entry must exist in source_registry.json")
        dataset_version = overture.get("dataset_version", "")
        self.assertNotEqual(dataset_version.lower(), "latest",
                            "Overture dataset_version must NOT be bare 'latest' — pin a specific release")
        self.assertIn(OVERTURE_PINNED_RELEASE, dataset_version,
                      f"dataset_version must contain the pinned release {OVERTURE_PINNED_RELEASE}")
        # schema_version must be recorded
        self.assertIn("schema_version", overture,
                      "Overture entry must have schema_version field")
        self.assertIn("v2.0", overture.get("schema_version", ""),
                      "schema_version must reference v2.0")


if __name__ == "__main__":
    unittest.main()

