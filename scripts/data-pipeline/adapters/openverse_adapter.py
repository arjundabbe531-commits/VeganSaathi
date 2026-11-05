"""
VeganSaathi — Openverse Image Adapter
=======================================
Searches Openverse API for openly licensed images.

IMPORTANT RULES:
- Use ONLY for generic illustrative/educational images
- NEVER present a generic stock photo as a photo of a specific restaurant
- Verify EVERY image licence at the original source URL before using it
- Openverse licence metadata may not always be accurate — check the original
- Store full attribution metadata with every image

API: https://api.openverse.org/v1/
Docs: https://docs.openverse.org/api/reference/
Free tier: 100 requests/day without token, higher with free registration.

Zero-budget: Free API, no paid tier needed for VeganSaathi's usage.
"""

from __future__ import annotations
import json
import logging
import os
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

try:
    import requests
except ImportError:
    requests = None

logger = logging.getLogger("vegansaathi.adapter.openverse")

OPENVERSE_API = "https://api.openverse.org/v1/images/"
ATTRIBUTION = "Openverse (Creative Commons licensed works)"

# Licences that permit commercial use (safe for VeganSaathi)
SAFE_LICENCES = {"cc0", "pdm", "by", "by-sa"}
# Licences with non-commercial restriction (use only for non-commercial purposes)
NC_LICENCES = {"by-nc", "by-nc-sa", "by-nc-nd"}
# Licences with no-derivative restriction
ND_LICENCES = {"by-nd", "by-nc-nd"}


@dataclass
class OpenverseImage:
    openverse_id: str
    title: str
    creator: str
    creator_url: str
    licence: str
    licence_version: str
    licence_url: str
    attribution: str
    image_url: str
    thumbnail_url: str
    source_platform: str
    source_url: str
    retrieval_date: str
    permits_commercial: bool
    permits_modification: bool
    requires_attribution: bool
    reviewer: str = ""
    admin_approved: bool = False
    admin_notes: str = ""
    image_category: str = "generic_illustration"  # NEVER "restaurant_photo"
    related_place_id: str = ""  # Only if explicitly linking to a place

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def attribution_text(self) -> str:
        """Generate the required attribution string."""
        parts = []
        if self.title:
            parts.append(f'"{self.title}"')
        if self.creator:
            parts.append(f"by {self.creator}")
        if self.source_platform:
            parts.append(f"({self.source_platform})")
        if self.licence:
            parts.append(f"— {self.licence_url}")
        return " ".join(parts)


class OpenverseAdapter:
    """
    Adapter for Openverse API image search.

    Use for educational and illustrative images ONLY.
    Never use as restaurant photographs.
    """

    def __init__(self, access_token: Optional[str] = None):
        self.access_token = access_token or os.environ.get("OPENVERSE_TOKEN", "")
        self.session = None

    def _get_session(self):
        if requests is None:
            raise ImportError("requests not installed. Run: pip install requests")
        import requests as req
        s = req.Session()
        s.headers["User-Agent"] = "VeganSaathi/1.0 (vegan-discovery-platform; non-commercial)"
        if self.access_token:
            s.headers["Authorization"] = f"Bearer {self.access_token}"
        return s

    def search(
        self,
        query: str,
        licence_type: str = "commercial",   # "commercial" | "modification" | "all"
        page_size: int = 20,
        page: int = 1,
        safe: bool = True,
    ) -> List[OpenverseImage]:
        """
        Search Openverse for openly licensed images.

        Args:
            query: Search term (e.g. "Indian vegan food", "plant based meal")
            licence_type: "commercial" for CC0/BY/BY-SA, "all" for all free licences
            page_size: Results per page (max 500)
            safe: Filter for safe content
        """
        s = self._get_session()

        params: Dict[str, Any] = {
            "q": query,
            "page_size": min(page_size, 500),
            "page": page,
        }
        if licence_type == "commercial":
            params["licence_type"] = "commercial"
        elif licence_type == "modification":
            params["licence_type"] = "modification"
        if safe:
            params["mature"] = False

        try:
            resp = s.get(OPENVERSE_API, params=params, timeout=15)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            logger.error(f"Openverse search failed for '{query}': {e}")
            return []

        images = []
        for item in data.get("results", []):
            licence = str(item.get("licence", "")).lower()
            licence_version = str(item.get("licence_version", ""))
            licence_url = str(item.get("licence_url", ""))

            permits_commercial = licence in SAFE_LICENCES
            permits_modification = licence not in ND_LICENCES
            requires_attribution = licence != "cc0" and licence != "pdm"

            img = OpenverseImage(
                openverse_id=str(item.get("id", "")),
                title=str(item.get("title", "")),
                creator=str(item.get("creator", "")),
                creator_url=str(item.get("creator_url", "")),
                licence=licence,
                licence_version=licence_version,
                licence_url=licence_url,
                attribution=str(item.get("attribution", "")),
                image_url=str(item.get("url", "")),
                thumbnail_url=str(item.get("thumbnail", "")),
                source_platform=str(item.get("source", "")),
                source_url=str(item.get("foreign_landing_url", "")),
                retrieval_date=datetime.now(timezone.utc).date().isoformat(),
                permits_commercial=permits_commercial,
                permits_modification=permits_modification,
                requires_attribution=requires_attribution,
                image_category="generic_illustration",
            )
            images.append(img)

        logger.info(f"Openverse: found {len(images)} images for '{query}'")
        return images

    def find_vegan_food_illustrations(self) -> List[OpenverseImage]:
        """
        Find generic vegan food illustrations suitable for educational use.
        These must NEVER be presented as photographs of specific restaurants.
        """
        queries = [
            "Indian vegan food",
            "plant based Indian meal",
            "vegan thali",
            "vegetable curry",
            "dal rice Indian",
            "Indian vegetables market",
        ]
        results = []
        for q in queries:
            imgs = self.search(q, licence_type="commercial", page_size=5)
            results.extend(imgs)
        return results


@dataclass
class PhotoSubmission:
    """
    Represents a user-submitted or business-submitted photo.
    Every photo must pass rights review before being stored in Cloudinary.
    """
    submission_id: str
    place_id: str
    submitter_uid: str
    submitter_name: str
    submission_type: str           # "business_owner" | "community_member" | "admin"
    photo_category: str            # "storefront" | "interior" | "food" | "menu" | "logo"

    # Rights declaration (must be confirmed by submitter)
    is_original_work: bool = False
    has_permission_to_publish: bool = False
    rights_holder: str = ""
    photographer_name: str = ""

    # Upload details (pre-approval)
    temp_url: str = ""             # Temporary URL before Cloudinary upload
    cloudinary_asset_id: str = ""  # Set after Cloudinary upload
    cloudinary_url: str = ""

    # Attribution requirements
    attribution_required: bool = False
    attribution_text: str = ""
    licence: str = "all_rights_reserved_explicit_permission"

    # Metadata
    upload_timestamp: str = ""
    approval_status: str = "pending"   # "pending"|"approved"|"rejected"
    approval_timestamp: str = ""
    approving_admin_uid: str = ""
    rejection_reason: str = ""
    public_alt_text: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def rights_are_sufficient(self) -> bool:
        """Check if the minimum rights information is present for review."""
        return (
            self.is_original_work or self.has_permission_to_publish
        ) and bool(self.rights_holder or self.photographer_name)

