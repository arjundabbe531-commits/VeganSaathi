"""Shared source-category mapping into VeganSaathi's canonical place taxonomy.

Canonical values: restaurant, cafe, mess, canteen, dhaba, bakery, dessert,
shop, and other. Unmatched categories stay ``other``; they are never guessed
to be restaurants. Source adapters should preserve their original category
separately in ``CandidateRecord.source_category``.
"""

from __future__ import annotations

import re

CANONICAL_PLACE_TYPES = frozenset({
    "restaurant", "cafe", "mess", "canteen", "dhaba", "bakery", "dessert", "shop", "other"
})

OVERTURE_CATEGORY_MAP = {
    "restaurant": "restaurant", "fast_food": "restaurant", "food": "other",
    "pizza_restaurant": "restaurant", "diner": "restaurant", "buffet_restaurant": "restaurant",
    "cafe": "cafe", "coffee_shop": "cafe", "juice_bar": "cafe",
    "mess": "mess", "canteen": "canteen", "dhaba": "dhaba",
    "bakery": "bakery",
    "dessert_shop": "dessert", "ice_cream_shop": "dessert", "sweets_and_confectionery": "dessert",
    "grocery": "shop", "grocery_store": "shop", "supermarket": "shop", "convenience_store": "shop",
    "health_food_store": "shop", "specialty_food_store": "shop", "food_store": "shop", "deli": "shop",
    "food_court": "other",
}

OVERTURE_FOOD_CATEGORIES = frozenset(OVERTURE_CATEGORY_MAP)

OSM_AMENITY_MAP = {
    "restaurant": "restaurant", "fast_food": "restaurant", "cafe": "cafe",
    "mess": "mess", "canteen": "canteen", "dhaba": "dhaba",
    "bakery": "bakery", "ice_cream": "dessert",
    "food_court": "other", "pub": "other", "bar": "other",
}

OSM_SHOP_MAP = {
    "bakery": "bakery", "confectionery": "dessert", "deli": "shop",
    "health_food": "shop", "organic": "shop", "grocery": "shop",
    "supermarket": "shop", "convenience": "shop",
}

FOURSQUARE_LABEL_RULES = (
    ("dhaba", "dhaba"),
    ("canteen", "canteen"),
    ("mess", "mess"),
    ("bakery", "bakery"),
    ("dessert", "dessert"),
    ("ice cream", "dessert"),
    ("sweet shop", "dessert"),
    ("confectionery", "dessert"),
    ("cafe", "cafe"),
    ("café", "cafe"),
    ("coffee shop", "cafe"),
    ("tea room", "cafe"),
    ("juice bar", "cafe"),
    ("grocery", "shop"),
    ("supermarket", "shop"),
    ("convenience store", "shop"),
    ("health food store", "shop"),
    ("food market", "shop"),
    ("food and drink shop", "shop"),
    ("deli", "shop"),
    ("restaurant", "restaurant"),
    ("fast food", "restaurant"),
)


def map_overture_category(category: str) -> str:
    return OVERTURE_CATEGORY_MAP.get(_normalise_key(category), "other")


def map_osm_category(amenity: str = "", shop: str = "", cuisine: str = "") -> str:
    amenity_key = _normalise_key(amenity)
    shop_key = _normalise_key(shop)
    cuisine_key = _normalise_key(cuisine)
    if cuisine_key == "dhaba":
        return "dhaba"
    if amenity_key in OSM_AMENITY_MAP:
        return OSM_AMENITY_MAP[amenity_key]
    return OSM_SHOP_MAP.get(shop_key, "other")


def map_foursquare_categories(labels) -> str:
    if isinstance(labels, str):
        labels = [labels]
    normalized = " | ".join(_normalise_label(label) for label in (labels or []) if label)
    for phrase, place_type in FOURSQUARE_LABEL_RULES:
        if re.search(rf"(?<![a-z0-9]){re.escape(phrase)}(?![a-z0-9])", normalized):
            return place_type
    return "other"


def _normalise_key(value: str) -> str:
    return str(value or "").strip().lower()


def _normalise_label(value: str) -> str:
    return re.sub(r"[_\-]+", " ", str(value or "").strip().lower())
