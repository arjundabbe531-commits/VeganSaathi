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
import math
import subprocess
import os
from datetime import datetime, timezone
from typing import Iterator, Optional, Dict, Any, List

from .base_adapter import BaseSourceAdapter, CandidateRecord, ImportManifest
from .place_taxonomy import OSM_AMENITY_MAP, OSM_SHOP_MAP, map_osm_category

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
FOOD_AMENITIES = set(OSM_AMENITY_MAP)

# OSM shop tags that are food-relevant
FOOD_SHOPS = set(OSM_SHOP_MAP)



def _normalise_lon_lat_points(points):
    """Return finite [lon, lat] pairs from a flat coordinate sequence."""
    normalised = []
    for point in points or []:
        if not isinstance(point, (list, tuple)) or len(point) < 2:
            continue
        try:
            lon, lat = float(point[0]), float(point[1])
        except (TypeError, ValueError):
            continue
        if math.isfinite(lon) and math.isfinite(lat) and -180 <= lon <= 180 and -90 <= lat <= 90:
            normalised.append((lon, lat))
    return normalised


def _ring_area_and_centroid(points):
    """Return (absolute_area, centroid_lon_lat) for a closed or closeable ring."""
    if len(points) < 3:
        return 0.0, None
    ring = list(points)
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    area_twice = cx_sum = cy_sum = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        cross = x1 * y2 - x2 * y1
        area_twice += cross
        cx_sum += (x1 + x2) * cross
        cy_sum += (y1 + y2) * cross
    if abs(area_twice) < 1e-12:
        return 0.0, None
    centroid = (cx_sum / (3.0 * area_twice), cy_sum / (3.0 * area_twice))
    if not all(math.isfinite(value) for value in centroid):
        return 0.0, None
    return abs(area_twice) / 2.0, centroid


def _representative_lon_lat_from_points(points):
    """Use polygon centroid for a closed ring, otherwise mean the way vertices."""
    normalised = _normalise_lon_lat_points(points)
    if not normalised:
        return None
    if len(normalised) >= 4 and normalised[0] == normalised[-1]:
        _, centroid = _ring_area_and_centroid(normalised)
        if centroid is not None:
            return centroid
    return (
        sum(point[0] for point in normalised) / len(normalised),
        sum(point[1] for point in normalised) / len(normalised),
    )


def _geojson_representative_lon_lat(geometry):
    """Extract a representative coordinate from GeoJSON Point/Line/Polygon geometry."""
    if not isinstance(geometry, dict):
        return None
    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates")
    if geometry_type == "Point":
        points = _normalise_lon_lat_points([coordinates])
        return points[0] if points else None
    if geometry_type in ("LineString", "MultiPoint"):
        return _representative_lon_lat_from_points(coordinates)
    if geometry_type == "MultiLineString":
        flattened = [point for segment in (coordinates or []) for point in (segment or [])]
        return _representative_lon_lat_from_points(flattened)
    if geometry_type == "Polygon":
        rings = coordinates or []
        return _representative_lon_lat_from_points(rings[0]) if rings else None
    if geometry_type == "MultiPolygon":
        outer_rings = [polygon[0] for polygon in (coordinates or []) if polygon]
        candidates = []
        for ring in outer_rings:
            points = _normalise_lon_lat_points(ring)
            area, centroid = _ring_area_and_centroid(points)
            if centroid is not None:
                candidates.append((area, centroid))
        if candidates:
            return max(candidates, key=lambda item: item[0])[1]
        return _representative_lon_lat_from_points(outer_rings[0]) if outer_rings else None
    if geometry_type == "GeometryCollection":
        for child in geometry.get("geometries", []):
            point = _geojson_representative_lon_lat(child)
            if point is not None:
                return point
    return None



class _OSMExtractionLimitReached(Exception):
    """Internal callback signal used to stop pyosmium as soon as a cap is reached."""


def _effective_record_limit(dry_run: bool, limit: Optional[int]) -> Optional[int]:
    if limit is not None:
        if isinstance(limit, bool) or not isinstance(limit, int) or limit < 0:
            raise ValueError("limit must be a non-negative integer or None")
    if dry_run:
        return min(limit, 100) if limit is not None else 100
    return limit


def _iter_geojson_features(path: str, chunk_size: int = 64 * 1024) -> Iterator[Dict[str, Any]]:
    """Stream one FeatureCollection feature at a time without json.load()."""
    if chunk_size < 1:
        raise ValueError("chunk_size must be at least 1")

    decoder = json.JSONDecoder()
    with open(path, "r", encoding="utf-8") as stream:
        buffer = ""
        eof = False

        def read_more():
            nonlocal buffer, eof
            chunk = stream.read(chunk_size)
            if chunk:
                buffer += chunk
            else:
                eof = True

        # Locate the FeatureCollection's features array while retaining only
        # the small header buffer, not the full GeoJSON document.
        while '"features"' not in buffer and not eof:
            read_more()
        key_at = buffer.find('"features"')
        if key_at < 0:
            raise ValueError("GeoJSON FeatureCollection has no features array")

        array_at = buffer.find("[", key_at + len('"features"'))
        while array_at < 0 and not eof:
            read_more()
            array_at = buffer.find("[", key_at + len('"features"'))
        if array_at < 0:
            raise ValueError("GeoJSON features value is not an array")

        cursor = array_at + 1
        while True:
            # Discard consumed bytes after every feature. This bounds the
            # retained input buffer to one feature plus the read chunk.
            while True:
                while cursor < len(buffer) and (buffer[cursor].isspace() or buffer[cursor] == ","):
                    cursor += 1
                if cursor < len(buffer):
                    if buffer[cursor] == "]":
                        return
                    break
                if eof:
                    raise ValueError("Unexpected end of GeoJSON features array")
                buffer = buffer[cursor:]
                cursor = 0
                read_more()

            while True:
                try:
                    feature, end = decoder.raw_decode(buffer, cursor)
                    break
                except json.JSONDecodeError:
                    if eof:
                        raise ValueError("Truncated or invalid GeoJSON feature") from None
                    buffer = buffer[cursor:]
                    cursor = 0
                    read_more()

            if not isinstance(feature, dict):
                raise ValueError("GeoJSON feature must be an object")
            yield feature
            buffer = buffer[end:]
            cursor = 0



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

    def _extract_via_pyosmium(
        self, pbf_path: str, dry_run: bool, limit: Optional[int] = None
    ) -> Iterator[Dict[str, Any]]:
        """Extract food places to a temporary NDJSON spool and replay one row at a time."""
        import tempfile
        import osmium

        max_records = _effective_record_limit(dry_run, limit)
        if max_records == 0:
            return

        with tempfile.TemporaryFile(mode="w+t", encoding="utf-8") as spool:
            class FoodHandler(osmium.SimpleHandler):
                def __init__(self):
                    super().__init__()
                    self.count = 0

                def _process(self, obj, is_way=False):
                    tags = {tag.k: tag.v for tag in obj.tags}
                    amenity = tags.get("amenity", "")
                    shop = tags.get("shop", "")
                    name = tags.get("name", "")

                    if not name or (amenity not in FOOD_AMENITIES and shop not in FOOD_SHOPS):
                        return

                    if is_way:
                        way_points = []
                        for node_ref in obj.nodes:
                            try:
                                location = node_ref.location
                                if not location.valid():
                                    continue
                                way_points.append((float(location.lon), float(location.lat)))
                            except (AttributeError, TypeError, ValueError, RuntimeError):
                                continue
                        representative = _representative_lon_lat_from_points(way_points)
                        if representative is None:
                            return
                        lon, lat = representative
                    else:
                        try:
                            lat = float(obj.location.lat)
                            lon = float(obj.location.lon)
                        except (AttributeError, TypeError, ValueError, RuntimeError):
                            return
                        if not math.isfinite(lat) or not math.isfinite(lon):
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
                    spool.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
                    self.count += 1
                    if max_records is not None and self.count >= max_records:
                        raise _OSMExtractionLimitReached()

                def node(self, n):
                    self._process(n, is_way=False)

                def way(self, w):
                    self._process(w, is_way=True)

            handler = FoodHandler()
            try:
                handler.apply_file(pbf_path, locations=True, idx="flex_mem")
            except _OSMExtractionLimitReached:
                pass

            spool.flush()
            spool.seek(0)
            for line in spool:
                if line.strip():
                    yield json.loads(line)

    def _extract_via_osmium_cli(
        self, pbf_path: str, dry_run: bool, limit: Optional[int] = None
    ) -> Iterator[Dict[str, Any]]:
        """Run osmium CLI, then stream its GeoJSON export feature-by-feature."""
        import tempfile

        max_records = _effective_record_limit(dry_run, limit)
        if max_records == 0:
            return

        filter_expr = (
            "nwr/amenity=restaurant,cafe,fast_food,food_court,bakery,ice_cream "
            "nwr/shop=bakery,deli,health_food,organic,grocery "
            "nwr/diet:vegan nwr/cuisine=vegan,vegetarian"
        )

        with tempfile.TemporaryDirectory(prefix="vegansaathi-osm-") as temp_dir:
            filtered_pbf = os.path.join(temp_dir, "filtered_food.osm.pbf")
            filtered_geojson = os.path.join(temp_dir, "filtered_food.geojson")

            self.logger.info("Running osmium tags-filter...")
            result = subprocess.run(
                ["osmium", "tags-filter", pbf_path] + filter_expr.split()
                + ["-o", filtered_pbf, "--overwrite"],
                capture_output=True, text=True, timeout=600
            )
            if result.returncode != 0:
                raise RuntimeError(f"osmium tags-filter failed: {result.stderr}")

            self.logger.info("Running osmium export to GeoJSON...")
            result = subprocess.run(
                ["osmium", "export", filtered_pbf, "-f", "geojson",
                 "-o", filtered_geojson, "--overwrite"],
                capture_output=True, text=True, timeout=300
            )
            if result.returncode != 0:
                raise RuntimeError(f"osmium export failed: {result.stderr}")

            emitted = 0
            for feature in _iter_geojson_features(filtered_geojson):
                props = feature.get("properties") or {}
                geometry = feature.get("geometry") or {}
                geom_type = geometry.get("type")
                representative = _geojson_representative_lon_lat(geometry)
                if representative is None:
                    continue
                lon, lat = representative
                if not (15.5 <= lat <= 22.1 and 72.5 <= lon <= 81.0):
                    continue

                record = {
                    "osm_id": str(props.get("@id", "")),
                    "osm_type": str(props.get("@type") or (
                        "way" if geom_type in ("LineString", "MultiLineString", "Polygon", "MultiPolygon") else "node"
                    )),
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
                    yield record
                    emitted += 1
                    if max_records is not None and emitted >= max_records:
                        break

    def fetch_records(
        self, dry_run: bool = False, limit: Optional[int] = None
    ) -> Iterator[Dict[str, Any]]:
        pbf_path = self.config["pbf_path"]

        try:
            import osmium  # noqa
            use_pyosmium = True
        except ImportError:
            use_pyosmium = False

        self.logger.info(
            "OSM: processing %s (%s, dry_run=%s, limit=%s)",
            pbf_path, "pyosmium" if use_pyosmium else "osmium CLI", dry_run, limit
        )

        extractor = self._extract_via_pyosmium if use_pyosmium else self._extract_via_osmium_cli
        emitted = 0
        for record in extractor(pbf_path, dry_run, limit=limit):
            emitted += 1
            yield record
        self.logger.info("OSM: extracted %s candidate records", emitted)

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
        mapped_type = map_osm_category(amenity, shop, cuisine)

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

