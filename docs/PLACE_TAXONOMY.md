# Shared Place Taxonomy

`CandidateRecord.mapped_place_type` uses these canonical values across Overture,
OpenStreetMap, Foursquare, candidate approval, Firestore, and public discovery:

| Canonical value | Meaning |
| --- | --- |
| `restaurant` | Restaurant and fast-food restaurant categories |
| `cafe` | Cafes, coffee shops, tea rooms, and juice bars |
| `mess` | Explicit mess category |
| `canteen` | Explicit canteen category |
| `dhaba` | Explicit dhaba category |
| `bakery` | Bakery category |
| `dessert` | Dessert shops, ice-cream shops, and confectionery |
| `shop` | Grocery, supermarket, convenience, health-food, and other food shops |
| `other` | Food-relevant source category without a defensible canonical match |

Source mappings live in `scripts/data-pipeline/adapters/place_taxonomy.py` and
all three source adapters call that module. Overture uses its `basic_category`;
OSM uses `amenity`, `shop`, and explicit `cuisine=dhaba`; Foursquare uses its
category labels. The original source category is retained separately for
provenance and review.

Food courts, broad `food` categories, pubs, bars, and unknown labels are not
silently treated as restaurants. They map to `other` when they otherwise meet
the adapter's food-discovery criteria. A type is not a dietary claim and never
establishes vegan status.

The canonical type allowlist is mirrored at the application and Firestore rule
boundaries so the normalized source value can be approved and stored without
loss. Round-trip tests cover Overture, OSM, Foursquare, place normalization,
and the active Firestore rules emulator.
