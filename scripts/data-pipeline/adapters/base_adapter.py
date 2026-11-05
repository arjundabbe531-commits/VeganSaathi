"""
VeganSaathi — Base Source Adapter Interface
============================================
All source adapters must implement this interface.
Adapters produce CandidateRecord objects; they never write to Firebase directly.

Zero-budget policy: no paid APIs, no commercial services.
"""

from __future__ import annotations
import abc
import json
import logging
import hashlib
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Iterator


logger = logging.getLogger("vegansaathi.pipeline")


# ---------------------------------------------------------------------------
# Canonical candidate record — output of every adapter
# ---------------------------------------------------------------------------

@dataclass
class CandidateRecord:
    """
    A normalised candidate place record produced by a source adapter.

    Fields map to the VeganSaathi place schema (docs/DATABASE_SCHEMA.md).
    Every field documents its source origin.
    This is a staging record — it is NOT a published place.
    """

    # --- Identity ---
    candidate_id: str = ""                    # batch_id + source + source_id hash
    source_id: str = ""                       # source registry ID (e.g. "overture-maps-places")
    source_record_id: str = ""                # original ID from upstream (GERS ID, FSQ ID, OSM ID, etc.)
    source_dataset_version: str = ""          # dataset release string
    batch_id: str = ""                        # import batch ID

    # --- Name ---
    name: str = ""
    name_alt: List[str] = field(default_factory=list)
    brand: str = ""

    # --- Location ---
    address: str = ""
    area: str = ""
    city: str = ""
    district: str = ""
    state: str = "Maharashtra"
    country: str = "India"
    postal_code: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_confidence: str = "unknown"      # "high" | "medium" | "low" | "unknown"

    # --- Contact ---
    website: str = ""
    phone: str = ""
    email: str = ""
    social_links: Dict[str, str] = field(default_factory=dict)

    # --- Category ---
    source_category: str = ""                 # original category string from source
    mapped_place_type: str = ""               # VeganSaathi type: restaurant/cafe/bakery/shop/other
    operating_status: str = "unknown"         # "open"|"closed"|"temporarily_closed"|"unknown"

    # --- Vegan signals (from source metadata — NOT verification) ---
    vegan_signals: List[str] = field(default_factory=list)   # e.g. ["diet:vegan=yes", "cuisine=vegan"]
    vegan_signal_strength: str = "none"       # "strong"|"moderate"|"weak"|"none"

    # --- Verification status (always starts unverified) ---
    vegan_classification: str = "vegan_status_unverified"
    existence_status: str = "candidate"
    evidence_status: str = "no_vegan_evidence"

    # --- Images ---
    image_urls: List[str] = field(default_factory=list)      # source image URLs — rights NOT verified
    image_rights: str = "unverified"

    # --- Provenance ---
    upstream_source_ids: Dict[str, str] = field(default_factory=dict)  # {"overture_gers": "...", "osm_id": "...", "fsq_id": "..."}
    source_attribution: str = ""
    licence: str = ""
    collection_date: str = ""                 # ISO date string
    source_url: str = ""

    # --- Quality flags ---
    has_name: bool = False
    has_coordinates: bool = False
    has_address: bool = False
    has_website: bool = False
    has_phone: bool = False
    is_suspected_duplicate: bool = False
    duplicate_of: str = ""
    quality_warnings: List[str] = field(default_factory=list)

    # --- Pipeline metadata ---
    normalised_name: str = ""                 # lowercased, stripped for dedup
    normalised_phone: str = ""
    normalised_website: str = ""
    created_at: str = ""
    import_status: str = "staged"             # "staged"|"approved"|"rejected"|"duplicate"

    def compute_quality_flags(self):
        """Populate boolean quality flags based on field values."""
        self.has_name = bool(self.name and self.name.strip())
        self.has_coordinates = (
            self.latitude is not None and self.longitude is not None
            and -90 <= self.latitude <= 90 and -180 <= self.longitude <= 180
        )
        self.has_address = bool(self.address and self.address.strip())
        self.has_website = bool(self.website and self.website.strip())
        self.has_phone = bool(self.phone and self.phone.strip())

        if not self.has_name:
            self.quality_warnings.append("missing_name")
        if not self.has_coordinates:
            self.quality_warnings.append("missing_or_invalid_coordinates")
        if not self.has_address:
            self.quality_warnings.append("missing_address")

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), default=str, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# Import manifest
# ---------------------------------------------------------------------------

@dataclass
class ImportManifest:
    """Tracks every import batch end-to-end."""

    batch_id: str
    source_id: str
    dataset_version: str
    geographic_scope: str                   # e.g. "Maharashtra, India"
    bounding_box: Dict[str, float]           # {"min_lat":..., "max_lat":..., "min_lon":..., "max_lon":...}
    extraction_date: str
    processing_start: str
    processing_end: str = ""
    input_count: int = 0
    geographic_filtered_count: int = 0
    category_filtered_count: int = 0
    rejected_count: int = 0
    duplicate_count: int = 0
    candidate_count: int = 0
    error_count: int = 0
    output_path: str = ""
    licence: str = ""
    licence_url: str = ""
    config_hash: str = ""
    import_status: str = "running"           # "running"|"complete"|"failed"|"rolled_back"
    errors: List[str] = field(default_factory=list)
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def save(self, path: str):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2, default=str)
        logger.info(f"Manifest saved: {path}")


# ---------------------------------------------------------------------------
# Base adapter
# ---------------------------------------------------------------------------

class BaseSourceAdapter(abc.ABC):
    """
    Abstract base class for all VeganSaathi data source adapters.

    Subclasses implement:
        validate_config()     — check required config is present
        source_metadata()     — return source name, version, licence info
        fetch_records()       — generator yielding raw dicts from source
        map_record(raw)       — convert raw dict to CandidateRecord
        get_source_id()       — return the source registry ID string
    """

    # Maharashtra geographic bounds (conservative — includes entire state + small buffer)
    MAHARASHTRA_BOUNDS = {
        "min_lat": 15.5,
        "max_lat": 22.1,
        "min_lon": 72.5,
        "max_lon": 81.0,
    }

    # VeganSaathi category mapping — source categories that are food-relevant
    FOOD_RELEVANT_CATEGORIES = {
        # Overture / Foursquare categories
        "restaurant", "cafe", "bakery", "fast_food", "food", "grocery",
        "food_store", "health_food", "specialty_food", "dessert", "juice_bar",
        "sweets", "ice_cream", "deli", "food_court", "canteen", "dhaba",
        "pizza", "burger", "sandwich", "noodle", "buffet", "catering",
        # OSM amenity tags
        "amenity=restaurant", "amenity=cafe", "amenity=fast_food",
        "amenity=food_court", "amenity=bakery", "amenity=ice_cream",
        # OSM shop tags
        "shop=bakery", "shop=deli", "shop=health_food", "shop=organic",
        "shop=grocery", "shop=supermarket",
    }

    # Vegan signals from OSM tags and category strings
    VEGAN_SIGNALS = {
        "strong": [
            "diet:vegan=only", "diet:vegan=yes", "cuisine=vegan",
            "fully_vegan", "100%_vegan", "plant_based", "vegan_only",
        ],
        "moderate": [
            "diet:vegetarian=only", "cuisine=vegetarian", "vegan_friendly",
            "vegan_options",
        ],
        "weak": [
            "vegetarian", "organic", "natural", "plant", "green",
            "health", "wholesome", "sattvic",
        ],
    }

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(f"vegansaathi.adapter.{self.get_source_id()}")

    @abc.abstractmethod
    def get_source_id(self) -> str:
        """Return the source registry ID (matches source_registry.json)."""

    @abc.abstractmethod
    def validate_config(self) -> bool:
        """Validate config. Return True if ready. Log errors if not."""

    @abc.abstractmethod
    def source_metadata(self) -> Dict[str, Any]:
        """Return dict with name, version, licence, licence_url."""

    @abc.abstractmethod
    def fetch_records(self, dry_run: bool = False) -> Iterator[Dict[str, Any]]:
        """Yield raw record dicts from the source. Respect dry_run."""

    @abc.abstractmethod
    def map_record(self, raw: Dict[str, Any]) -> Optional[CandidateRecord]:
        """Convert a raw record dict to a CandidateRecord. Return None to skip."""

    def is_in_maharashtra(self, lat: Optional[float], lon: Optional[float]) -> bool:
        """Geographic filter — returns True if coordinates are within Maharashtra bounds."""
        if lat is None or lon is None:
            return False
        b = self.MAHARASHTRA_BOUNDS
        return b["min_lat"] <= lat <= b["max_lat"] and b["min_lon"] <= lon <= b["max_lon"]

    def detect_vegan_signals(self, text_values: List[str]) -> tuple[List[str], str]:
        """
        Scan a list of text values for vegan-related signals.
        Returns (signals_found, strength).
        strength: "strong" | "moderate" | "weak" | "none"
        """
        signals = []
        strength = "none"
        combined = " ".join(str(v).lower() for v in text_values)
        for level in ("strong", "moderate", "weak"):
            for sig in self.VEGAN_SIGNALS[level]:
                if sig in combined:
                    signals.append(sig)
                    if strength == "none":
                        strength = level
        return signals, strength

    def normalise_name(self, name: str) -> str:
        import re
        return re.sub(r"\s+", " ", name.lower().strip())

    def normalise_phone(self, phone: str) -> str:
        import re
        digits = re.sub(r"[^0-9]", "", phone.strip())
        if digits.startswith("91") and len(digits) > 10:
            digits = digits[2:]
        elif digits.startswith("0") and len(digits) > 10:
            digits = digits[1:]
        return digits[-10:] if len(digits) >= 10 else digits

    def normalise_website(self, url: str) -> str:
        import re
        url = url.lower().strip().rstrip("/")
        url = re.sub(r"^https?://", "", url)
        url = re.sub(r"^www\.", "", url)
        return url

    def make_candidate_id(self, batch_id: str, source_record_id: str) -> str:
        h = hashlib.sha256(f"{batch_id}:{self.get_source_id()}:{source_record_id}".encode()).hexdigest()[:16]
        return f"cand_{self.get_source_id().replace('-', '_')}_{h}"

    def run_batch(
        self,
        manifest: ImportManifest,
        output_path: str,
        dry_run: bool = False,
        limit: Optional[int] = None,
    ) -> List[CandidateRecord]:
        """
        Execute a full import batch.
        - Validates config
        - Iterates source records
        - Maps each record
        - Writes candidates to output NDJSON file
        - Updates manifest
        Returns list of CandidateRecord objects.
        """
        if not self.validate_config():
            manifest.import_status = "failed"
            manifest.errors.append("config_validation_failed")
            return []

        candidates = []
        import_errors = 0
        skipped = 0

        try:
            with open(output_path, "w", encoding="utf-8") as out_f:
                for i, raw in enumerate(self.fetch_records(dry_run=dry_run)):
                    if limit and i >= limit:
                        break
                    manifest.input_count += 1
                    try:
                        candidate = self.map_record(raw)
                        if candidate is None:
                            skipped += 1
                            manifest.rejected_count += 1
                            continue
                        candidate.batch_id = manifest.batch_id
                        candidate.compute_quality_flags()
                        candidates.append(candidate)
                        manifest.candidate_count += 1
                        if not dry_run:
                            out_f.write(candidate.to_json() + "\n")
                    except Exception as e:
                        import_errors += 1
                        manifest.error_count += 1
                        self.logger.error(f"Record mapping error at index {i}: {e}")
        except Exception as e:
            manifest.import_status = "failed"
            manifest.errors.append(str(e))
            self.logger.error(f"Batch run failed: {e}")
            return candidates

        manifest.processing_end = datetime.now(timezone.utc).isoformat()
        manifest.import_status = "complete" if import_errors == 0 else "complete_with_errors"
        self.logger.info(
            f"Batch complete: {manifest.candidate_count} candidates, "
            f"{manifest.rejected_count} rejected, {manifest.error_count} errors."
        )
        return candidates

