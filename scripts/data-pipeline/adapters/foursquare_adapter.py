"""
VeganSaathi — Foursquare Open Source Places Adapter
=====================================================
Adapter for the Foursquare OS Places dataset (Apache 2.0).

Access method: Foursquare Places Portal (places.foursquare.com), using its
Iceberg catalog with DuckDB. Official documentation describes the dataset as
free; project account access, quotas, and zero-cost terms remain unverified.

BLOCKED STATUS: Live access is disabled until the owner verifies portal access,
the exact release, licence and project-level zero-cost terms. No fallback API,
mirror or alternate distribution is used.

Licence: Apache 2.0
Attribution: Must retain NOTICE file. See data/raw/fsq-notice/NOTICE.
"""

from __future__ import annotations
import logging
import re
from datetime import datetime, timezone
from typing import Iterator, Optional, Dict, Any, List

from .base_adapter import BaseSourceAdapter, CandidateRecord
from .place_taxonomy import map_foursquare_categories

logger = logging.getLogger("vegansaathi.adapter.foursquare")

# Maharashtra bounds
MAHARASHTRA_BBOX = {
    "min_lat": 15.5, "max_lat": 22.1,
    "min_lon": 72.5, "max_lon": 81.0,
}

ATTRIBUTION = "Foursquare Open Source Places (Apache 2.0)"

FOOD_CATEGORY_NAMES = {
    "bakery", "cafe", "café", "coffee shop", "dessert shop", "food court", "food market", "grocery store",
    "ice cream parlor", "ice cream shop", "juice bar", "restaurant", "sweet shop", "supermarket", "tea room",
    "vegan and vegetarian restaurant", "vegetarian / vegan restaurant", "food and drink shop",
}


class FoursquareAdapter(BaseSourceAdapter):
    """
    Adapter for Foursquare Open Source Places dataset.

    Config keys:
      access_token (required): FSQ access token from places.foursquare.com
        Can also be set via FSQ_ACCESS_TOKEN environment variable.
      catalog_uri: Iceberg REST catalog URI copied from the Places Portal
      warehouse: Iceberg warehouse/catalog identifier copied from the portal
      namespace: Iceberg namespace (default: "fsq")
      places_table/categories_table: table names copied from the portal
      dataset_version: pinned release identifier copied from the portal
      licence_confirmed/zero_cost_confirmed: explicit owner confirmations
    """

    def get_source_id(self) -> str:
        return "foursquare-os-places"

    def validate_config(self) -> bool:
        required = ["access_token", "catalog_uri", "warehouse", "namespace", "places_table",
                    "categories_table", "dataset_version"]
        missing = [key for key in required if not str(self.config.get(key, "")).strip()]
        if missing:
            self.logger.error("Foursquare acquisition blocked; missing portal settings: %s", ", ".join(missing))
            return False
        if str(self.config["dataset_version"]).strip().lower() == "latest":
            self.logger.error("Foursquare acquisition blocked; dataset_version must be a pinned portal release.")
            return False
        if self.config.get("licence_confirmed") is not True or self.config.get("zero_cost_confirmed") is not True:
            self.logger.error("Foursquare acquisition blocked; licence and zero-cost confirmations are required.")
            return False
        for key in ("namespace", "places_table", "categories_table"):
            if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", str(self.config[key])):
                self.logger.error("Foursquare acquisition blocked; invalid SQL identifier in %s.", key)
                return False
        if not str(self.config["catalog_uri"]).startswith("https://"):
            self.logger.error("Foursquare acquisition blocked; catalog_uri must use HTTPS.")
            return False

        # Check DuckDB availability
        try:
            import duckdb  # noqa
        except ImportError:
            self.logger.error("DuckDB not installed. Run: pip install duckdb")
            return False

        return True

    def source_metadata(self) -> Dict[str, Any]:
        return {
            "name": "Foursquare Open Source Places",
            "version": str(self.config.get("dataset_version", "not-acquired")),
            "licence": "Apache 2.0",
            "licence_url": "https://www.apache.org/licenses/LICENSE-2.0",
            "attribution": ATTRIBUTION,
            "notice": "Must retain Apache 2.0 NOTICE file (data/raw/fsq-notice/NOTICE)",
        }

    def fetch_records(self, dry_run: bool = False) -> Iterator[Dict[str, Any]]:
        """
        Query Foursquare Iceberg catalog via DuckDB.
        Requires a valid access token.
        """
        if not self.validate_config():
            raise RuntimeError("Foursquare access is blocked by missing or unverified configuration.")
        import duckdb
        sql_token = str(self.config["access_token"]).replace("'", "''")
        sql_uri = str(self.config["catalog_uri"]).replace("'", "''")
        sql_warehouse = str(self.config["warehouse"]).replace("'", "''")
        query = self._build_query(
            self.config["namespace"], self.config["places_table"], self.config["categories_table"],
            f"LIMIT {int(self.config.get('dry_run_limit', 100))}" if dry_run else "",
        )
        self.logger.info("Foursquare: querying configured Iceberg REST catalog (dry_run=%s)", dry_run)
        conn = None
        try:
            conn = duckdb.connect(database=":memory:")
            conn.execute("INSTALL iceberg")
            conn.execute("LOAD iceberg")
            conn.execute("LOAD httpfs")
            conn.execute(f"CREATE SECRET fsq_iceberg_secret (TYPE iceberg, TOKEN '{sql_token}')")
            conn.execute(
                f"ATTACH '{sql_warehouse}' AS fsq_catalog "
                f"(TYPE iceberg, SECRET fsq_iceberg_secret, ENDPOINT '{sql_uri}')"
            )
            result = conn.execute(query)
            columns = [desc[0] for desc in result.description]
            while True:
                rows = result.fetchmany(1000)
                if not rows:
                    break
                for row in rows:
                    record = dict(zip(columns, row))
                    record["dataset_version"] = self.config["dataset_version"]
                    yield record
        except Exception as e:
            self.logger.error("Foursquare catalogue query failed (%s); check token, portal connection details and local DuckDB extensions.", type(e).__name__)
            raise RuntimeError("Foursquare catalogue query failed; secret values were withheld from logs.") from None
        finally:
            if conn is not None:
                conn.close()

    @staticmethod
    def _build_query(namespace: str, places_table: str, categories_table: str, limit_clause: str = "") -> str:
        """Build a food-category query using Foursquare's Categories taxonomy."""
        return f"""
            SELECT p.fsq_place_id, p.name, p.latitude, p.longitude, p.address,
                   p.locality AS city, p.region AS state, p.country,
                   p.postcode AS postal_code, p.tel AS phone, p.website, p.email,
                   p.fsq_category_ids AS category_ids,
                   p.fsq_category_labels AS category_labels,
                   p.date_created, p.date_refreshed, p.date_closed, p.unresolved_flags
            FROM fsq_catalog.{namespace}.{places_table} AS p
            WHERE p.latitude BETWEEN {MAHARASHTRA_BBOX['min_lat']} AND {MAHARASHTRA_BBOX['max_lat']}
              AND p.longitude BETWEEN {MAHARASHTRA_BBOX['min_lon']} AND {MAHARASHTRA_BBOX['max_lon']}
              AND p.country = 'IN'
              AND EXISTS (
                  SELECT 1
                  FROM UNNEST(p.fsq_category_ids) AS fsq(category_id)
                  JOIN fsq_catalog.{namespace}.{categories_table} AS c
                    ON c.category_id = fsq.category_id
                  WHERE lower(c.category_name) LIKE '%restaurant%'
                     OR lower(c.category_name) LIKE '%bakery%'
                     OR lower(c.category_name) IN ({', '.join(repr(value) for value in sorted(FOOD_CATEGORY_NAMES))})
                     OR lower(c.level2_category_name) LIKE '%grocery%'
                     OR lower(c.level2_category_name) LIKE '%food store%'
              )
              AND p.date_closed IS NULL
            {limit_clause}
        """.strip()

    def map_record(self, raw: Dict[str, Any]) -> Optional[CandidateRecord]:
        name = str(raw.get("name", "")).strip()
        if not name:
            return None

        fsq_id = str(raw.get("fsq_place_id", "")).strip()
        lat = raw.get("latitude")
        lon = raw.get("longitude")
        try:
            lat = float(lat)
            lon = float(lon)
        except (TypeError, ValueError):
            lat = lon = None

        if not self.is_in_maharashtra(lat, lon):
            return None

        labels = raw.get("category_labels", [])
        if isinstance(labels, str):
            labels = [labels]
        category_label = " | ".join(str(label) for label in labels if label).lower()
        city = str(raw.get("city", "")).strip()
        address = str(raw.get("address", "")).strip()
        postal_code = str(raw.get("postal_code", "")).strip()
        phone = str(raw.get("phone", "")).strip()
        website = str(raw.get("website", "")).strip()
        email = str(raw.get("email", "")).strip()

        mapped_type = map_foursquare_categories(labels)

        signals, strength = self.detect_vegan_signals([name, category_label])

        candidate = CandidateRecord(
            source_id=self.get_source_id(),
            source_record_id=fsq_id,
            source_dataset_version=f"fsq-os-{raw.get('dataset_version') or raw.get('synthetic_dataset_version') or self.config.get('dataset_version', 'unknown')}",
            name=name,
            address=address,
            city=city,
            state="Maharashtra",
            country="India",
            postal_code=postal_code,
            latitude=lat,
            longitude=lon,
            website=website if website.startswith("http") else "",
            phone=phone,
            email=email,
            source_category=category_label,
            mapped_place_type=mapped_type,
            vegan_signals=signals,
            vegan_signal_strength=strength,
            vegan_classification="vegan_status_unverified",
            existence_status="candidate",
            evidence_status="no_vegan_evidence",
            upstream_source_ids={"fsq_id": fsq_id},
            source_attribution=ATTRIBUTION,
            licence="Apache 2.0",
            collection_date=datetime.now(timezone.utc).date().isoformat(),
            image_rights="unverified",
        )

        candidate.normalised_name = self.normalise_name(name)
        candidate.normalised_phone = self.normalise_phone(phone)
        candidate.normalised_website = self.normalise_website(website)
        candidate.candidate_id = self.make_candidate_id("", fsq_id)

        return candidate


# ---------------------------------------------------------------------------
# Fixture-based testing support (for unit tests without real credentials)
# ---------------------------------------------------------------------------

class FoursquareFixtureAdapter(FoursquareAdapter):
    """
    Test adapter using fixture data — no credentials required.
    Used in tests/test-import-validator.mjs and pytest suites.
    """

    FIXTURE_RECORDS = [
        {
            "fsq_place_id": "fixture_fsq_001",
            "name": "Green Leaf Vegan Café",
            "latitude": 21.1458, "longitude": 79.0882,
            "address": "15 Dharampeth, Nagpur", "city": "Nagpur",
            "state": "Maharashtra", "country": "IN",
            "postal_code": "440010", "phone": "+917122555001",
            "website": "https://greenleafcafe.in",
            "email": "hello@greenleafcafe.in",
            "category_ids": ["4d4b7105d754a06374d81259"], "category_labels": ["Dining and Drinking > Restaurant"],
        },
        {
            "fsq_place_id": "fixture_fsq_002",
            "name": "Pune Organic Kitchen",
            "latitude": 18.5204, "longitude": 73.8567,
            "address": "22 Koregaon Park, Pune", "city": "Pune",
            "state": "Maharashtra", "country": "IN",
            "postal_code": "411001", "phone": "+912025555002",
            "website": "https://puneorganickitchen.com",
            "email": "",
            "category_ids": ["4d4b7105d754a06374d81259"], "category_labels": ["Dining and Drinking > Restaurant"],
        },
        {
            "fsq_place_id": "fixture_fsq_003",
            "name": "Mumbai Plant House",
            "latitude": 19.0760, "longitude": 72.8777,
            "address": "8 Bandra West, Mumbai", "city": "Mumbai",
            "state": "Maharashtra", "country": "IN",
            "postal_code": "400050", "phone": "+912225555003",
            "website": "https://mumbaiplant.house",
            "email": "",
            "category_ids": ["4d4b7105d754a06374d81259"], "category_labels": ["Dining and Drinking > Restaurant"],
        },
    ]
    FIXTURE_DATASET_VERSION = "vegansaathi-foursquare-fixtures-2026.1"

    def validate_config(self) -> bool:
        return True  # No credentials needed for fixtures

    def fetch_records(self, dry_run: bool = False) -> Iterator[Dict[str, Any]]:
        for row in self.FIXTURE_RECORDS:
            record = dict(row)
            fixture_id = record["fsq_place_id"]
            record.update({
                "is_synthetic_fixture": True,
                "synthetic_fixture_id": fixture_id,
                "synthetic_dataset_version": self.FIXTURE_DATASET_VERSION,
            })
            yield record

    def map_record(self, raw: Dict[str, Any]) -> Optional[CandidateRecord]:
        candidate = super().map_record(raw)
        if candidate is None:
            return None
        fixture_id = str(raw["synthetic_fixture_id"])
        candidate.is_synthetic_fixture = True
        candidate.synthetic_fixture_id = fixture_id
        candidate.synthetic_dataset_version = str(raw["synthetic_dataset_version"])
        candidate.candidate_id = f"cand_synthetic_fixture_{fixture_id}"
        return candidate
