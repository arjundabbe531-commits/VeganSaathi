"""
VeganSaathi — Foursquare Open Source Places Adapter
=====================================================
Adapter for the Foursquare OS Places dataset (Apache 2.0).

Access method: Foursquare Places Portal (places.foursquare.com) — requires
free registration and an access token. Data is served via Apache Iceberg
catalog; can be queried with DuckDB, PyIceberg, etc.

BLOCKED STATUS: This adapter is implemented but cannot run until
the project owner registers at https://places.foursquare.com/ and
provides FSQ_ACCESS_TOKEN in the environment. No purchase required.
Free registration only.

Alternative access: Hugging Face mirror (may require community approval).

Licence: Apache 2.0
Attribution: Must retain NOTICE file. See data/raw/fsq-notice/NOTICE.
"""

from __future__ import annotations
import logging
import os
import json
from datetime import datetime, timezone
from typing import Iterator, Optional, Dict, Any, List

from .base_adapter import BaseSourceAdapter, CandidateRecord

logger = logging.getLogger("vegansaathi.adapter.foursquare")

# Maharashtra bounds
MAHARASHTRA_BBOX = {
    "min_lat": 15.5, "max_lat": 22.1,
    "min_lon": 72.5, "max_lon": 81.0,
}

ATTRIBUTION = "Foursquare Open Source Places (Apache 2.0)"

# FSQ category IDs for food/dining — subset of their 1000+ category taxonomy
FSQ_FOOD_CATEGORY_IDS = {
    # Food & Drink top-level categories — IDs from FSQ public taxonomy
    "13000",  # Dining and Drinking (parent)
    "13065",  # Restaurant
    "13032",  # Café
    "13031",  # Coffee Shop
    "13040",  # Fast Food Restaurant
    "13025",  # Bakery
    "13055",  # Dessert Shop
    "13045",  # Ice Cream Parlor
    "13070",  # Vegetarian / Vegan Restaurant
    "13071",  # Vegan Restaurant (if separate)
    "13060",  # Juice Bar
    "13037",  # Food Court
    "13057",  # Sweet Shop
    # Grocery & Food Stores
    "17069",  # Grocery Store / Supermarket
    "17018",  # Health Food Store
    "17037",  # Organic Grocery
}


class FoursquareAdapter(BaseSourceAdapter):
    """
    Adapter for Foursquare Open Source Places dataset.

    Config keys:
      access_token (required): FSQ access token from places.foursquare.com
        Can also be set via FSQ_ACCESS_TOKEN environment variable.
      iceberg_rest_url: Iceberg REST catalog URL (from portal)
      warehouse: Iceberg warehouse path
      namespace: Iceberg namespace (default: "fsq")
      table: Iceberg table name (default: "places")
    """

    def get_source_id(self) -> str:
        return "foursquare-os-places"

    def validate_config(self) -> bool:
        token = self.config.get("access_token") or os.environ.get("FSQ_ACCESS_TOKEN", "")
        if not token:
            self.logger.error(
                "BLOCKED: Foursquare access token not configured.\n"
                "Required action (free, no purchase):\n"
                "  1. Register at https://places.foursquare.com/\n"
                "  2. Generate a free access token\n"
                "  3. Set environment variable: FSQ_ACCESS_TOKEN=<token>\n"
                "  4. Re-run the pipeline\n"
                "Until then, Foursquare data acquisition is blocked."
            )
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
            "version": "latest",
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
        import duckdb

        token = self.config.get("access_token") or os.environ.get("FSQ_ACCESS_TOKEN", "")
        iceberg_rest_url = self.config.get(
            "iceberg_rest_url",
            "https://api.foursquare.com/places/catalog/api"
        )
        warehouse = self.config.get("warehouse", "s3://fsq-os-places-us-east-1/")
        namespace = self.config.get("namespace", "fsq")
        table = self.config.get("table", "places")

        bbox = MAHARASHTRA_BBOX
        limit_clause = "LIMIT 100" if dry_run else ""

        # DuckDB Iceberg catalog query
        # Note: exact connection syntax depends on FSQ portal documentation
        # at time of access. This follows the documented Iceberg REST API pattern.
        query = f"""
        INSTALL iceberg; LOAD iceberg;
        INSTALL httpfs; LOAD httpfs;

        CREATE SECRET fsq_secret (
            TYPE BEARER,
            TOKEN '{token}'
        );

        SELECT
            fsq_place_id,
            name,
            latitude,
            longitude,
            address,
            locality            AS city,
            region              AS state,
            country,
            postcode            AS postal_code,
            tel                 AS phone,
            website,
            email,
            fsq_category_ids[1] AS category_id,
            fsq_category_labels[1] AS category_label,
            date_created,
            date_updated
        FROM iceberg_scan(
            '{warehouse}{namespace}/{table}',
            allow_moved_paths=true
        )
        WHERE
            latitude BETWEEN {bbox['min_lat']} AND {bbox['max_lat']}
            AND longitude BETWEEN {bbox['min_lon']} AND {bbox['max_lon']}
            AND country = 'IN'
        {limit_clause}
        """

        self.logger.info(f"Foursquare: querying Iceberg catalog (dry_run={dry_run})")
        try:
            conn = duckdb.connect(database=":memory:")
            # Setup
            for stmt in ["INSTALL iceberg", "LOAD iceberg", "INSTALL httpfs", "LOAD httpfs"]:
                try:
                    conn.execute(stmt)
                except Exception:
                    pass

            result = conn.execute(query.strip().split("SELECT", 1)[1])
            columns = [desc[0] for desc in result.description]
            for row in result.fetchall():
                yield dict(zip(columns, row))
            conn.close()
        except Exception as e:
            self.logger.error(f"Foursquare fetch failed: {e}")
            self.logger.warning(
                "If this is an authentication or connection error, verify:\n"
                "  - FSQ_ACCESS_TOKEN is valid and not expired\n"
                "  - The Iceberg catalog URL is current (check places.foursquare.com)\n"
                "  - Your IP is not rate-limited"
            )
            raise

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

        category_label = str(raw.get("category_label", "")).lower()
        city = str(raw.get("city", "")).strip()
        address = str(raw.get("address", "")).strip()
        postal_code = str(raw.get("postal_code", "")).strip()
        phone = str(raw.get("phone", "")).strip()
        website = str(raw.get("website", "")).strip()
        email = str(raw.get("email", "")).strip()

        # Category mapping
        mapped_type = "other"
        for key in ["restaurant", "cafe", "coffee", "bakery", "dessert",
                    "ice cream", "grocery", "health food", "food"]:
            if key in category_label:
                mapped_type = {
                    "restaurant": "restaurant", "cafe": "cafe", "coffee": "cafe",
                    "bakery": "bakery", "dessert": "dessert", "ice cream": "dessert",
                    "grocery": "shop", "health food": "shop", "food": "restaurant",
                }.get(key, "other")
                break

        signals, strength = self.detect_vegan_signals([name, category_label])

        candidate = CandidateRecord(
            source_id=self.get_source_id(),
            source_record_id=fsq_id,
            source_dataset_version="fsq-os-latest",
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
            "category_id": "13070", "category_label": "Vegan Restaurant",
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
            "category_id": "13065", "category_label": "Restaurant",
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
            "category_id": "13070", "category_label": "Vegan Restaurant",
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
