"""
VeganSaathi — OpenStreetMap Adapter
=====================================
Processes OSM PBF extracts from Geofabrik for Maharashtra food places.

Source: https://download.geofabrik.de/asia/india/western-zone-latest.osm.pbf
Licence: ODbL 1.0 — © OpenStreetMap contributors
Attribution: Required on any map or derived product display.

IMPORTANT ODbL NOTE: If VeganSaathi's Firestore place database becomes
substantially a derivative database of OSM, ODbL share-alike may apply.
VeganSaathi uses OSM as a discovery input only. Each place record
is independently sourced and attributed. Legal review recommended
before distributing any derivative database.

Tool chain: pyosmium (osmium-tool Python bindings) for PBF processing.
Fallback: osmium CLI via subprocess if pyosmium not available.

Zero-budget policy: Geofabrik is free. No commercial geocoding.
"""

from __future__ import annotations
import logging
import json
import subprocess
import os
from datetime import datetime, timezone
from typing import Iterator, Optional, Dict, Any, List

from .base_adapter import BaseSourceAdapter, CandidateRecord, ImportManifest

logger = logging.getLogger("vegansaathi.adapter.osm")

# Maharashtra / Western India bounding box
MAHARASHTRA_BBOX = {
    "min_lat": 15.5,
    "max_lat": 22.1,
    "min_lon": 72.5,
    "max_lon": 81.0,
}

ATTRIBUTION = "© OpenStreetMap contributors (ODbL 1.0)"

# OSM amenity tags that are food-relevant
FOOD_AMENITIES = {
    "restaurant", "cafe", "fast_food", "food_court", "bakery",
    "ice_cream", "pub", "bar",
}

# OSM shop tags that are food-relevant
FOOD_SHOPS = {
    "bakery", "deli", "health_food", "organic", "grocery",
    "supermarket", "convenience", "confectionery",
}

# Mapping OSM amenity → VeganSaathi placeType
AMENITY_TO_PLACE_TYPE = {
    "restaurant": "restaurant",
    "cafe": "cafe",
    "fast_food": "restaurant",
    "food_court": "restaurant",
    "bakery": "bakery",
    "ice_cream": "dessert",
}

SHOP_TO_PLACE_TYPE = {
    "bakery": "bakery",
    "deli": "shop",
    "health_food": "shop",
    "organic": "shop",
    "grocery": "shop",
    "supermarket": "shop",
}


class OSMAdapter(BaseSourceAdapter):
    """
    Adapter for OpenStreetMap data from Geofabrik PBF extracts.

    Config keys:
      pbf_path (required): path to downloaded .osm.pbf file
      use_pyosmium: True to use pyosmium (faster), False to use osmium CLI
    """

    def get_source_id(self) -> str:
        return "openstreetmap-geofabrik"

    def validate_config(self) -> bool:
        pbf_path = self.config.get("pbf_path", "")
        if not pbf_path:
            self.logger.error("OSM adapter requires 'pbf_path' in config")
            return False
        if not os.path.exists(pbf_path):
            self.logger.error(f"PBF file not found: {pbf_path}")
            self.logger.info(
                "Download from: https://download.geofabrik.de/asia/india/western-zone-latest.osm.pbf"
                "\nOr for full India: https://download.geofabrik.de/asia/india-latest.osm.pbf"
            )
            return False
        # Check for pyosmium or osmium CLI
        try:
            import osmium  # noqa
            self.logger.info("pyosmium available")
            return True
        except ImportError:
            pass
        # Try osmium CLI
        try:
            result = subprocess.run(["osmium", "version"], capture_output=True, timeout=5)
            if result.returncode == 0:
                self.logger.info("osmium CLI available")
                return True
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
        self.logger.error(
            "Neither pyosmium nor osmium CLI found. Install with:\n"
            "  pip install osmium  (pyosmium)\n"
            "  or: https://osmcode.org/osmium-tool/"
        )
        return False

    def source_metadata(self) -> Dict[str, Any]:
        return {
            "name": "OpenStreetMap — Geofabrik India Extract",
            "version": "daily",
            "licence": "ODbL 1.0",
            "licence_url": "https://www.openstreetmap.org/copyright",
            "attribution": ATTRIBUTION,
            "pbf_path": self.config.get("pbf_path", ""),
        }

    def _extract_via_pyosmium(self, pbf_path: str, dry_run: bool) -> List[Dict[str, Any]]:
        """Use pyosmium to extract food-related nodes/ways from PBF."""
        import osmium

        class FoodHandler(osmium.SimpleHandler):
            def __init__(self):
                super().__init__()
                self.records = []
                self.count = 0

            def _process(self, obj, is_way=False):
                tags = {tag.k: tag.v for tag in obj.tags}
                amenity = tags.get("amenity", "")
                shop = tags.get("shop", "")
                name = tags.get("name", "")

                if not name:
                    return
                if amenity not in FOOD_AMENITIES and shop not in FOOD_SHOPS:
                    return

                # Get coordinates
                if is_way:
                    if not obj.nodes:
                        return
                    # For ways, use centroid approximation from first node
                    lat = None
                    lon = None
                else:
                    try:
                        lat = float(obj.location.lat)
                        lon = float(obj.location.lon)
                    except Exception:
                        lat = lon = None

                # Maharashtra bounding box filter (applied after tag filter for efficiency)
                if lat is None or lon is None:
                    return
                if not (15.5 <= lat <= 22.1 and 72.5 <= lon <= 81.0):
                    return

                record = {
                    "osm_id": str(obj.id),
                    "osm_type": "way" if is_way else "node",
                    "name": name,
                    "amenity": amenity,
                    "shop": shop,
                    "cuisine": tags.get("cuisine", ""),
                    "diet_vegan": tags.get("diet:vegan", ""),
                    "diet_vegetarian": tags.get("diet:vegetarian", ""),
                    "addr_street": tags.get("addr:street", ""),
                    "addr_housenumber": tags.get("addr:housenumber", ""),
                    "addr_city": tags.get("addr:city", ""),
                    "addr_postcode": tags.get("addr:postcode", ""),
                    "phone": tags.get("phone", tags.get("contact:phone", "")),
                    "website": tags.get("website", tags.get("contact:website", "")),
                    "email": tags.get("email", tags.get("contact:email", "")),
                    "opening_hours": tags.get("opening_hours", ""),
                    "image": tags.get("image", ""),
                    "wikimedia_commons": tags.get("wikimedia_commons", ""),
                    "latitude": lat,
                    "longitude": lon,
                    "all_tags": json.dumps(tags),
                }
                self.records.append(record)
                self.count += 1

                if dry_run and self.count >= 100:
                    raise StopIteration("dry_run limit")

            def node(self, n):
                self._process(n, is_way=False)

            def way(self, w):
                self._process(w, is_way=True)

        handler = FoodHandler()
        try:
            handler.apply_file(pbf_path, locations=True, idx="flex_mem")
        except StopIteration:
            pass
        except Exception as e:
            if "dry_run limit" not in str(e):
                raise
        return handler.records

    def _extract_via_osmium_cli(self, pbf_path: str, dry_run: bool) -> List[Dict[str, Any]]:
        """
        Fallback: use osmium tags-filter CLI + osmium export to GeoJSON.
        """
        import tempfile

        filtered_pbf = os.path.join(os.path.dirname(pbf_path), "_vs_filtered_food.osm.pbf")
        filtered_geojson = os.path.join(os.path.dirname(pbf_path), "_vs_filtered_food.geojson")

        # Filter for food amenities and shops
        filter_expr = (
            "nwr/amenity=restaurant,cafe,fast_food,food_court,bakery,ice_cream "
            "nwr/shop=bakery,deli,health_food,organic,grocery "
            "nwr/diet:vegan nwr/cuisine=vegan,vegetarian"
        )

        self.logger.info("Running osmium tags-filter...")
        result = subprocess.run(
            ["osmium", "tags-filter", pbf_path] + filter_expr.split() +
            ["-o", filtered_pbf, "--overwrite"],
            capture_output=True, text=True, timeout=600
        )
        if result.returncode != 0:
            raise RuntimeError(f"osmium tags-filter failed: {result.stderr}")

        self.logger.info("Running osmium export to GeoJSON...")
        result = subprocess.run(
            ["osmium", "export", filtered_pbf, "-f", "geojson", "-o", filtered_geojson, "--overwrite"],
            capture_output=True, text=True, timeout=300
        )
        if result.returncode != 0:
            raise RuntimeError(f"osmium export failed: {result.stderr}")

        # Parse GeoJSON
        records = []
        with open(filtered_geojson, encoding="utf-8") as f:
            data = json.load(f)
        for feat in data.get("features", []):
            props = feat.get("properties", {})
            geom = feat.get("geometry", {})
            if geom.get("type") != "Point":
                continue
            coords = geom.get("coordinates", [])
            if len(coords) < 2:
                continue
            lon, lat = coords[0], coords[1]
            if not (15.5 <= lat <= 22.1 and 72.5 <= lon <= 81.0):
                continue
            record = {
                "osm_id": str(props.get("@id", "")),
                "osm_type": str(props.get("@type", "node")),
                "name": props.get("name", ""),
                "amenity": props.get("amenity", ""),
                "shop": props.get("shop", ""),
                "cuisine": props.get("cuisine", ""),
                "diet_vegan": props.get("diet:vegan", ""),
                "diet_vegetarian": props.get("diet:vegetarian", ""),
                "addr_street": props.get("addr:street", ""),
                "addr_housenumber": props.get("addr:housenumber", ""),
                "addr_city": props.get("addr:city", ""),
                "addr_postcode": props.get("addr:postcode", ""),
                "phone": props.get("phone", props.get("contact:phone", "")),
                "website": props.get("website", props.get("contact:website", "")),
                "email": props.get("email", props.get("contact:email", "")),
                "opening_hours": props.get("opening_hours", ""),
                "image": props.get("image", ""),
                "wikimedia_commons": props.get("wikimedia_commons", ""),
                "latitude": lat,
                "longitude": lon,
                "all_tags": json.dumps(props),
            }
            if record["name"]:
                records.append(record)
            if dry_run and len(records) >= 100:
                break

        # Clean up temp files
        for f in [filtered_pbf, filtered_geojson]:
            if os.path.exists(f):
                os.remove(f)

        return records

    def fetch_records(self, dry_run: bool = False) -> Iterator[Dict[str, Any]]:
        pbf_path = self.config["pbf_path"]

        try:
            import osmium  # noqa
            use_pyosmium = True
        except ImportError:
            use_pyosmium = False

        self.logger.info(
            f"OSM: processing {pbf_path} ({'pyosmium' if use_pyosmium else 'osmium CLI'}, "
            f"dry_run={dry_run})"
        )

        if use_pyosmium:
            records = self._extract_via_pyosmium(pbf_path, dry_run)
        else:
            records = self._extract_via_osmium_cli(pbf_path, dry_run)

        self.logger.info(f"OSM: extracted {len(records)} candidate records")
        yield from records

    def map_record(self, raw: Dict[str, Any]) -> Optional[CandidateRecord]:
        name = str(raw.get("name", "")).strip()
        if not name:
            return None

        osm_id = str(raw.get("osm_id", "")).strip()
        lat = raw.get("latitude")
        lon = raw.get("longitude")
        try:
            lat = float(lat)
            lon = float(lon)
        except (TypeError, ValueError):
            lat = lon = None

        amenity = str(raw.get("amenity", ""))
        shop = str(raw.get("shop", ""))
        cuisine = str(raw.get("cuisine", ""))
        diet_vegan = str(raw.get("diet_vegan", ""))
        diet_vegetarian = str(raw.get("diet_vegetarian", ""))

        # Determine place type
        mapped_type = AMENITY_TO_PLACE_TYPE.get(amenity) or SHOP_TO_PLACE_TYPE.get(shop, "other")

        # Build address from components
        housenumber = str(raw.get("addr_housenumber", "")).strip()
        street = str(raw.get("addr_street", "")).strip()
        city = str(raw.get("addr_city", "")).strip()
        postal_code = str(raw.get("addr_postcode", "")).strip()
        address_parts = [p for p in [housenumber + " " + street if housenumber else street, city] if p.strip()]
        address = ", ".join(address_parts)

        # Vegan signals — OSM diet tags are the strongest signals we can get
        signal_sources = [diet_vegan, diet_vegetarian, cuisine, name]
        signals, strength = self.detect_vegan_signals(signal_sources)

        # Explicit diet tags override weak name signals
        if diet_vegan in ("yes", "only"):
            if "diet:vegan=" + diet_vegan not in signals:
                signals.insert(0, f"diet:vegan={diet_vegan}")
            strength = "strong"
        elif diet_vegetarian in ("yes", "only"):
            strength = max(strength, "moderate") if strength != "strong" else strength

        website = str(raw.get("website", "")).strip()
        phone = str(raw.get("phone", "")).strip()
        image = str(raw.get("image", "")).strip()
        wikimedia = str(raw.get("wikimedia_commons", "")).strip()

        warnings = []
        if not address:
            warnings.append("missing_address")

        candidate = CandidateRecord(
            source_id=self.get_source_id(),
            source_record_id=f"osm_{raw.get('osm_type', 'n')}{osm_id}",
            source_dataset_version="osm-daily",
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
            source_category=amenity or shop,
            mapped_place_type=mapped_type,
            vegan_signals=signals,
            vegan_signal_strength=strength,
            vegan_classification="vegan_status_unverified",
            existence_status="candidate",
            evidence_status="no_vegan_evidence" if strength == "none" else "vegan_lead",
            upstream_source_ids={
                "osm_id": osm_id,
                "osm_type": raw.get("osm_type", "node"),
            },
            source_attribution=ATTRIBUTION,
            licence="ODbL 1.0",
            collection_date=datetime.now(timezone.utc).date().isoformat(),
            image_urls=[image] if image.startswith("http") else [],
            image_rights="unverified",
            quality_warnings=warnings,
        )

        candidate.normalised_name = self.normalise_name(name)
        candidate.normalised_phone = self.normalise_phone(phone)
        candidate.normalised_website = self.normalise_website(website)
        candidate.candidate_id = self.make_candidate_id("", candidate.source_record_id)

        return candidate

