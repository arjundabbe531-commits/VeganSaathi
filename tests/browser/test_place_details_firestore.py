"""
VeganSaathi — tests/browser/test_place_details_firestore.py
==============================================================================
Task 5.5 — Place Details -> Firestore migration test suite. Covers all 12
required scenarios: valid place renders, the correct id is actually passed
to fetchPlaceById(), unknown id -> not-found, missing id doesn't crash,
invalid document handled safely, permission-denied handled, generic error
handled, no fallback to any other place, dynamic content stays escaped, the
verification badge still works, the map receives the normalized
coordinates, and missing optional fields don't crash rendering.

Uses the same window.__STUB_PLACES_DOCS__ mechanism as
test_explore_firestore.py and test_5_4_map_robustness.py, plus the
Task-5.5-specific places/{id} getDoc() stub support (see
stub-assets/firebase-firestore.browser-stub.js's header comment).

Run directly:  python3 tests/browser/test_place_details_firestore.py
Prerequisites: same as test_phase4_regression.py.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import BASE_URL, LocalFrontendServer, log, make_route_handler, summary  # noqa: E402

from playwright.sync_api import sync_playwright

route_handler = make_route_handler()


def place(id, **overrides):
    """A minimally valid, fully-normalizable place document for the stub."""
    data = {
        "name": overrides.pop("name", "Test Place " + id),
        "placeType": "cafe",
        "address": "Test Address, Shegaon",
        "latitude": 20.79,
        "longitude": 76.69,
        "dietTags": ["vegan"],
        "status": "published",
        "verificationStatus": "unverified",
        "source": "fieldwork",
        "submittedBy": "uid-test",
        "submittedByName": "Tester",
    }
    data.update(overrides)
    return {"id": id, "data": data}


def init_script_for(docs, throw=None):
    parts = ["window.__STUB_USER__ = null;"]
    if docs is not None:
        payload = json.dumps(docs)
        parts.append("window.__STUB_PLACES_DOCS__ = " + payload + ";")
        parts.append("""
            window.__STUB_PLACES_DOCS__.forEach(function (d) {
                if (!d.data.createdAt || typeof d.data.createdAt !== 'object' || !('__iso' in d.data.createdAt)) {
                    d.data.createdAt = { toDate: function () { return new Date('2026-09-01T12:00:00Z'); } };
                } else {
                    var ca = d.data.createdAt.__iso;
                    d.data.createdAt = { toDate: function () { return new Date(ca); } };
                }
                if (!d.data.updatedAt || typeof d.data.updatedAt !== 'object' || !('__iso' in d.data.updatedAt)) {
                    d.data.updatedAt = { toDate: function () { return new Date('2026-09-01T12:00:00Z'); } };
                } else {
                    var ua = d.data.updatedAt.__iso;
                    d.data.updatedAt = { toDate: function () { return new Date(ua); } };
                }
                if (d.data.lastVerifiedAt && typeof d.data.lastVerifiedAt === 'object' && '__iso' in d.data.lastVerifiedAt) {
                    var iso = d.data.lastVerifiedAt.__iso;
                    d.data.lastVerifiedAt = { toDate: function () { return new Date(iso); } };
                }
            });
        """)
    if throw is not None:
        parts.append(
            "window.__STUB_PLACE_THROW__ = Object.assign(new Error(" + json.dumps(throw["message"]) + "), "
            + json.dumps(throw) + ");"
        )
    return "".join(parts)


def new_page(browser):
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    pg = ctx.new_page()
    pg.route("**/*", route_handler)
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    return ctx, pg, errs


def goto(pg, path, docs=None, throw=None, wait_ms=600):
    pg.add_init_script(init_script_for(docs, throw))
    pg.goto(BASE_URL + "/" + path, wait_until="load")
    if wait_ms:
        pg.wait_for_timeout(wait_ms)


def is_hidden(pg, element_id):
    return pg.eval_on_selector("#" + element_id, "el => el.classList.contains('d-none')")


def main():
    with LocalFrontendServer():
        with sync_playwright() as p:
            browser = p.chromium.launch()

            # ---- 1. A valid Firestore place renders ----
            ctx, pg, errs = new_page(browser)
            goto(pg, "place-details.html?id=real-place-1", docs=[place("real-place-1", name="Real Firestore Place")])
            log("1. loading state hidden after successful load", is_hidden(pg, "placeLoadingState"))
            log("1. content shown after successful load", not is_hidden(pg, "placeContent"))
            name_text = pg.eval_on_selector("#placeName", "el => el.textContent")
            log("1. the real place's name is rendered", name_text == "Real Firestore Place", name_text)
            log("1. no uncaught page errors", len(errs) == 0, str(errs))
            ctx.close()

            # ---- 2. The correct id is actually passed to fetchPlaceById() ----
            ctx, pg, errs = new_page(browser)
            goto(pg, "place-details.html?id=specific-id-42", docs=[
                place("specific-id-42", name="Place A"),
                place("some-other-id", name="Place B"),
            ])
            requested_id = pg.evaluate("window.__STUB_LAST_REQUESTED_PLACE_ID__")
            log("2. the exact id from the URL is what gets requested", requested_id == "specific-id-42", str(requested_id))
            name_text = pg.eval_on_selector("#placeName", "el => el.textContent")
            log("2. the CORRECT place's data renders (not the other seeded one)", name_text == "Place A", name_text)
            ctx.close()

            # ---- 3. An unknown id shows the not-found state ----
            ctx, pg, errs = new_page(browser)
            goto(pg, "place-details.html?id=does-not-exist", docs=[place("some-real-id")])
            log("3. not-found state shown for an unknown id", not is_hidden(pg, "placeNotFoundState"))
            log("3. content stays hidden", is_hidden(pg, "placeContent"))
            log("3. no uncaught page errors", len(errs) == 0, str(errs))
            ctx.close()

            # ---- 4. A missing id (no ?id= at all) does not crash the page ----
            ctx, pg, errs = new_page(browser)
            goto(pg, "place-details.html", docs=[place("some-real-id")])  # no ?id= query param
            log("4. missing id shows not-found rather than crashing", not is_hidden(pg, "placeNotFoundState"))
            log("4. no uncaught page errors with a missing id", len(errs) == 0, str(errs))
            ctx.close()

            # ---- 5. An invalid document (fails normalization) is handled safely ----
            ctx, pg, errs = new_page(browser)
            goto(pg, "place-details.html?id=malformed-1", docs=[place("malformed-1", placeType="not-a-real-type")])
            log("5. an invalid document shows not-found/unavailable, not a crash", not is_hidden(pg, "placeNotFoundState"))
            log("5. content stays hidden for an invalid document", is_hidden(pg, "placeContent"))
            log("5. no uncaught page errors on an invalid document", len(errs) == 0, str(errs))
            ctx.close()

            # ---- 6. permission-denied is handled with a friendly error state ----
            ctx, pg, errs = new_page(browser)
            goto(pg, "place-details.html?id=any-id", throw={"message": "Missing or insufficient permissions.", "code": "permission-denied"})
            log("6. error state shown on permission-denied", not is_hidden(pg, "placeErrorState"))
            log("6. content stays hidden on permission-denied", is_hidden(pg, "placeContent"))
            log("6. no uncaught page errors on permission-denied", len(errs) == 0, str(errs))
            ctx.close()

            # ---- 7. A generic error is handled with a friendly error state ----
            ctx, pg, errs = new_page(browser)
            goto(pg, "place-details.html?id=any-id", throw={"message": "network unavailable", "code": "unavailable"})
            log("7. error state shown on a generic read error", not is_hidden(pg, "placeErrorState"))
            error_text = pg.eval_on_selector("#placeErrorState", "el => el.textContent")
            log("7. error message is user-friendly, no raw Firebase error code shown", "unavailable" not in error_text.lower())
            log("7. no uncaught page errors on a generic error", len(errs) == 0, str(errs))
            ctx.close()

            # ---- 8. No fallback to any other/arbitrary place, ever ----
            ctx, pg, errs = new_page(browser)
            goto(pg, "place-details.html?id=totally-unknown-id", docs=[
                place("mock-001", name="Should Never Appear One"),
                place("mock-002", name="Should Never Appear Two"),
            ])
            page_text = pg.eval_on_selector("body", "el => el.textContent")
            log("8. no fallback to any other seeded place's name",
                "Should Never Appear" not in page_text)
            log("8. not-found state is what's actually shown", not is_hidden(pg, "placeNotFoundState"))
            ctx.close()

            # ---- 9. Dynamic content (name, map popup) remains escaped ----
            ctx, pg, errs = new_page(browser)
            goto(pg, "place-details.html?id=xss-1", docs=[place("xss-1", name="<b>Test</b>")])
            has_real_bold = pg.evaluate("!!document.querySelector('#placeContent b')")
            name_html = pg.eval_on_selector("#placeName", "el => el.textContent")
            log("9. a malicious name renders as literal text (textContent), not markup",
                not has_real_bold and name_html == "<b>Test</b>", name_html)
            popups = pg.evaluate("window.__STUB_MARKER_POPUPS__ || []")
            joined = " ".join(popups)
            log("9. the map popup also escapes the malicious name",
                "&lt;b&gt;Test&lt;/b&gt;" in joined and "<b>Test</b>" not in joined, joined)
            log("9. no uncaught page errors with a malicious name", len(errs) == 0, str(errs))
            ctx.close()

            # ---- 10. The verification badge still works correctly ----
            ctx, pg, errs = new_page(browser)
            goto(pg, "place-details.html?id=verified-1", docs=[
                place("verified-1", name="Verified Place", verificationStatus="verified",
                      lastVerifiedAt={"__iso": "2026-09-15T12:00:00Z"})
            ])
            badge_html = pg.eval_on_selector("#placeVerification", "el => el.innerHTML")
            log("10. verified place shows 'Verified' with its real date", "Verified" in badge_html and "2026" in badge_html, badge_html)
            ctx.close()

            ctx, pg, errs = new_page(browser)
            goto(pg, "place-details.html?id=unverified-1", docs=[place("unverified-1", name="Unverified Place")])
            badge_html = pg.eval_on_selector("#placeVerification", "el => el.innerHTML")
            log("10. unverified place shows 'Not yet verified'", "Not yet verified" in badge_html, badge_html)
            ctx.close()

            # ---- 11. The map receives the normalized Firestore coordinates ----
            ctx, pg, errs = new_page(browser)
            goto(pg, "place-details.html?id=coords-1", docs=[place("coords-1", latitude=20.81, longitude=76.77)])
            popups = pg.evaluate("window.__STUB_MARKER_POPUPS__ || []")
            log("11. a map marker was actually created for this place", len(popups) >= 1, str(popups))
            log("11. no uncaught page errors initializing the map", len(errs) == 0, str(errs))
            ctx.close()

            # ---- 11b. Out-of-pilot-bounds coordinates never reach the map or crash the page ----
            # (places-service.js's normalizePlace() rejects them, so the page
            # shows its "isn't available" state — no second coordinate rule
            # lives in place-details.js.)
            ctx, pg, errs = new_page(browser)
            goto(pg, "place-details.html?id=badcoords-1", docs=[place("badcoords-1", latitude=19.0760, longitude=72.8777)])
            log("11b. out-of-bounds coordinates show the not-available state", not is_hidden(pg, "placeNotFoundState"))
            log("11b. content (and its map) never renders for them", is_hidden(pg, "placeContent"))
            popups = pg.evaluate("window.__STUB_MARKER_POPUPS__ || []")
            log("11b. no map marker was created from the bad coordinates", len(popups) == 0, str(popups))
            log("11b. no uncaught page errors", len(errs) == 0, str(errs))
            ctx.close()

            # ---- 11c. Missing coordinates never crash the page ----
            ctx, pg, errs = new_page(browser)
            nocoords = place("nocoords-1")
            nocoords["data"].pop("latitude")
            nocoords["data"].pop("longitude")
            goto(pg, "place-details.html?id=nocoords-1", docs=[nocoords])
            log("11c. missing coordinates show the not-available state", not is_hidden(pg, "placeNotFoundState"))
            log("11c. content stays hidden", is_hidden(pg, "placeContent"))
            log("11c. no uncaught page errors", len(errs) == 0, str(errs))
            ctx.close()

            # ---- 12. Missing optional fields don't crash rendering ----
            ctx, pg, errs = new_page(browser)
            minimal = place("minimal-1", name="Minimal Place")
            # Explicitly confirm none of the optional fields are present —
            # normalizePlace() must fill in safe defaults, not fail or
            # produce "undefined" anywhere visible.
            for optional_field in ("description", "area", "priceRange", "dietNotes", "openingInfo", "imageUrl", "verificationNote"):
                minimal["data"].pop(optional_field, None)
            goto(pg, "place-details.html?id=minimal-1", docs=[minimal])
            log("12. content renders despite missing optional fields", not is_hidden(pg, "placeContent"))
            body_text = pg.eval_on_selector("#placeContent", "el => el.textContent")
            log("12. no literal 'undefined' leaks into the rendered page", "undefined" not in body_text, body_text[:200])
            image_text = pg.eval_on_selector("#placeImage", "el => el.textContent")
            log("12. missing image shows the shared 'No photo yet' fallback, not 'undefined'",
                image_text == "No photo yet", image_text)
            area_text = pg.eval_on_selector("#placeArea", "el => el.textContent")
            log("12. missing area shows its safe default", area_text == "Area not listed", area_text)
            log("12. no uncaught page errors with missing optional fields", len(errs) == 0, str(errs))
            ctx.close()

            browser.close()

    ok = summary()
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
