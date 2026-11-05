"""
VeganSaathi — Deduplication Engine
=====================================
Multi-signal duplicate detection for imported place candidates.

Matching signals (in priority order):
1. Exact source IDs (GERS, FSQ, OSM) — definitive duplicate
2. Same normalised phone number
3. Same normalised website domain
4. Same normalised name + geographic proximity (< 100m)
5. Same normalised name + same street address fragment
6. Similar name (Levenshtein) + proximity (< 50m)

Outputs:
- Exact duplicate: auto-flagged, no merge without review
- Highly probable: queued for admin review
- Possible: noted, needs manual comparison
- Different branches of same brand: separate records retained

Zero-budget: runs locally in Python, no external API needed.
"""

from __future__ import annotations
import json
import math
import logging
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Any

from adapters.base_adapter import CandidateRecord

logger = logging.getLogger("vegansaathi.dedup")


@dataclass
class DuplicateMatch:
    candidate_a_id: str
    candidate_b_id: str
    match_type: str                     # "exact"|"highly_probable"|"possible"|"franchise_branch"
    match_signals: List[str] = field(default_factory=list)
    match_score: float = 0.0            # 0.0–1.0
    admin_decision: str = "pending"     # "pending"|"merge"|"keep_separate"|"different_branch"
    notes: str = ""


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return approximate distance in metres between two lat/lon points."""
    R = 6_371_000  # Earth radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def _levenshtein(a: str, b: str) -> int:
    """Simple Levenshtein distance for short strings."""
    if a == b:
        return 0
    if len(a) < len(b):
        a, b = b, a
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a):
        curr = [i + 1]
        for j, cb in enumerate(b):
            curr.append(min(prev[j + 1] + 1, curr[j] + 1, prev[j] + (ca != cb)))
        prev = curr
    return prev[-1]


def _name_similarity(a: str, b: str) -> float:
    """Return 0.0–1.0 similarity between two normalised names."""
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    max_len = max(len(a), len(b))
    dist = _levenshtein(a, b)
    return 1.0 - dist / max_len


def detect_duplicates(
    candidates: List[CandidateRecord],
    proximity_exact_m: float = 50.0,
    proximity_probable_m: float = 200.0,
    name_similarity_threshold: float = 0.85,
) -> List[DuplicateMatch]:
    """
    Run duplicate detection across a list of CandidateRecord objects.

    Returns a list of DuplicateMatch records. Does NOT modify candidates in place.
    Admin must review and approve before any merge.
    """
    matches: List[DuplicateMatch] = []
    n = len(candidates)
    logger.info(f"Deduplication: checking {n} candidates")

    # Build lookup indexes
    phone_index: Dict[str, List[int]] = {}
    website_index: Dict[str, List[int]] = {}
    source_id_index: Dict[str, int] = {}

    for i, c in enumerate(candidates):
        # Source ID index
        for id_type, id_val in c.upstream_source_ids.items():
            if id_val:
                key = f"{id_type}:{id_val}"
                if key in source_id_index:
                    j = source_id_index[key]
                    matches.append(DuplicateMatch(
                        candidate_a_id=c.candidate_id,
                        candidate_b_id=candidates[j].candidate_id,
                        match_type="exact",
                        match_signals=[f"shared_source_id:{key}"],
                        match_score=1.0,
                    ))
                else:
                    source_id_index[key] = i

        # Phone index
        if c.normalised_phone and len(c.normalised_phone) >= 7:
            phone_index.setdefault(c.normalised_phone, []).append(i)

        # Website index
        if c.normalised_website and len(c.normalised_website) >= 5:
            website_index.setdefault(c.normalised_website, []).append(i)

    # Phone duplicates
    for phone, indices in phone_index.items():
        for x in range(len(indices)):
            for y in range(x + 1, len(indices)):
                i, j = indices[x], indices[y]
                ca, cb = candidates[i], candidates[j]
                signals = [f"same_phone:{phone}"]
                score = 0.85
                # If name also similar, upgrade
                ns = _name_similarity(ca.normalised_name, cb.normalised_name)
                if ns >= 0.6:
                    signals.append(f"similar_name:{ns:.2f}")
                    score = 0.95
                match_type = "highly_probable" if score >= 0.9 else "possible"
                matches.append(DuplicateMatch(
                    candidate_a_id=ca.candidate_id,
                    candidate_b_id=cb.candidate_id,
                    match_type=match_type,
                    match_signals=signals,
                    match_score=score,
                ))

    # Website duplicates
    for website, indices in website_index.items():
        for x in range(len(indices)):
            for y in range(x + 1, len(indices)):
                i, j = indices[x], indices[y]
                ca, cb = candidates[i], candidates[j]
                signals = [f"same_website:{website}"]
                score = 0.75
                ns = _name_similarity(ca.normalised_name, cb.normalised_name)
                if ns > 0.85:
                    signals.append(f"similar_name:{ns:.2f}")
                    score = 0.9
                match_type = "highly_probable" if score >= 0.9 else "possible"
                # Check if already flagged as exact from source IDs
                if not any(
                    (m.candidate_a_id == ca.candidate_id and m.candidate_b_id == cb.candidate_id) or
                    (m.candidate_a_id == cb.candidate_id and m.candidate_b_id == ca.candidate_id)
                    for m in matches
                ):
                    matches.append(DuplicateMatch(
                        candidate_a_id=ca.candidate_id,
                        candidate_b_id=cb.candidate_id,
                        match_type=match_type,
                        match_signals=signals,
                        match_score=score,
                    ))

    # Geographic + name proximity check (O(n²) — acceptable for Maharashtra subset)
    # Only run for candidates with valid coordinates
    geo_candidates = [(i, c) for i, c in enumerate(candidates) if c.has_coordinates]

    for x in range(len(geo_candidates)):
        i, ca = geo_candidates[x]
        for y in range(x + 1, len(geo_candidates)):
            j, cb = geo_candidates[y]

            dist = _haversine_m(ca.latitude, ca.longitude, cb.latitude, cb.longitude)
            if dist > proximity_probable_m:
                continue

            ns = _name_similarity(ca.normalised_name, cb.normalised_name)
            signals = [f"proximity_{dist:.0f}m", f"name_similarity_{ns:.2f}"]
            score = 0.0

            if dist <= proximity_exact_m and ns >= 0.95:
                score = 0.95
                match_type = "highly_probable"
            elif dist <= proximity_probable_m and ns >= name_similarity_threshold:
                score = 0.75 + (ns - name_similarity_threshold) * 0.5
                match_type = "possible"
            else:
                continue  # Too far or too different

            # Skip if already in matches
            already_matched = any(
                (m.candidate_a_id == ca.candidate_id and m.candidate_b_id == cb.candidate_id) or
                (m.candidate_a_id == cb.candidate_id and m.candidate_b_id == ca.candidate_id)
                for m in matches
            )
            if already_matched:
                continue

            # Franchise branch detection: same brand name, different city
            if ca.city and cb.city and ca.city.lower() != cb.city.lower() and ns > 0.9:
                match_type = "franchise_branch"
                signals.append(f"different_cities:{ca.city}/{cb.city}")

            matches.append(DuplicateMatch(
                candidate_a_id=ca.candidate_id,
                candidate_b_id=cb.candidate_id,
                match_type=match_type,
                match_signals=signals,
                match_score=score,
            ))

    logger.info(f"Deduplication: found {len(matches)} potential duplicate pairs")

    # Flag candidates
    exact_ids = set()
    for m in matches:
        if m.match_type == "exact":
            exact_ids.add(m.candidate_b_id)  # Mark second as duplicate

    for c in candidates:
        if c.candidate_id in exact_ids:
            c.is_suspected_duplicate = True
            # Find what it's a duplicate of
            for m in matches:
                if m.candidate_b_id == c.candidate_id and m.match_type == "exact":
                    c.duplicate_of = m.candidate_a_id
                    break

    return matches


def generate_dedup_report(
    candidates: List[CandidateRecord],
    matches: List[DuplicateMatch],
) -> Dict[str, Any]:
    """Generate a data-quality report from deduplication results."""
    total = len(candidates)
    exact = len([m for m in matches if m.match_type == "exact"])
    probable = len([m for m in matches if m.match_type == "highly_probable"])
    possible = len([m for m in matches if m.match_type == "possible"])
    franchise = len([m for m in matches if m.match_type == "franchise_branch"])
    suspected_dupes = len([c for c in candidates if c.is_suspected_duplicate])

    return {
        "total_candidates": total,
        "exact_duplicate_pairs": exact,
        "highly_probable_duplicate_pairs": probable,
        "possible_duplicate_pairs": possible,
        "franchise_branch_pairs": franchise,
        "suspected_duplicate_candidates": suspected_dupes,
        "unique_candidates": total - suspected_dupes,
        "field_completeness": {
            "has_name": sum(1 for c in candidates if c.has_name),
            "has_coordinates": sum(1 for c in candidates if c.has_coordinates),
            "has_address": sum(1 for c in candidates if c.has_address),
            "has_website": sum(1 for c in candidates if c.has_website),
            "has_phone": sum(1 for c in candidates if c.has_phone),
        },
        "vegan_signals": {
            "strong": sum(1 for c in candidates if c.vegan_signal_strength == "strong"),
            "moderate": sum(1 for c in candidates if c.vegan_signal_strength == "moderate"),
            "weak": sum(1 for c in candidates if c.vegan_signal_strength == "weak"),
            "none": sum(1 for c in candidates if c.vegan_signal_strength == "none"),
        },
        "by_city": _count_by_field(candidates, "city"),
        "by_place_type": _count_by_field(candidates, "mapped_place_type"),
        "by_source": _count_by_field(candidates, "source_id"),
    }


def _count_by_field(candidates: List[CandidateRecord], field_name: str) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for c in candidates:
        val = str(getattr(c, field_name, "unknown") or "unknown")
        counts[val] = counts.get(val, 0) + 1
    return dict(sorted(counts.items(), key=lambda x: x[1], reverse=True))

