"""
VeganSaathi — tests/browser/test_5_4_map_robustness.py
==============================================================================
Task 5.4 — Leaflet map robustness. Covers the 12 required scenarios: map
initializes, a layerGroup is actually used, initial markers, re-render clears
old markers, filters/search update markers, invalid coordinates are skipped
(not a crash), invalidateSize() fires on List->Map, repeated switching
doesn't duplicate markers, popup escaping survives, and no uncaught errors
throughout.

Uses the same window.__STUB_PLACES_DOCS__ mechanism as
test_explore_firestore.py, plus the Task-5.4-specific Leaflet stub tracking
globals documented in stub-assets/leaflet-stub.js's header comment.

Run directly:  python3 tests/browser/test_5_4_map_robustness.py
Prerequisites: same as test_phase4_regression.py.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import BASE_URL, LocalFrontendServer, log, make_route_handler, summary  # noqa: E402

from playwright.sync_api import sync_playwright

route_handler = make_route_handler()

# Inside the pilot bounding box (places-service.js's PILOT_BOUNDS: lat
# 20.70-20.90, lon 76.55-76.80).
GOOD_LAT, GOOD_LON = 20.79, 76.69
# Outside it — Mumbai, used the same way places-service.js's own tests use
# it to represent an obviously-wrong/swapped coordinate.
BAD_LAT, BAD_LON = 19.0760, 72.8777


def place(id, **overrides):
    data = {
        "name": overrides.pop("name", "Test Place " + id),
        "placeType": "cafe",
        "address": "Test Address, Shegaon",
        "latitude": GOOD_LAT,
        "longitude": GOOD_LON,
        "dietTags": ["vegan"],
        "status": "published",
        "verificationStatus": "unverified",
        "source": "fieldwork",
        "submittedBy": "uid-test",
        "submittedByName": "Tester",
    }
    data.update(overrides)
    return {"id": id, "data": data}


def init_script_for(docs):
    payload = json.dumps(docs)
    return (
        "window.__STUB_USER__ = null;"
        "window.__STUB_PLACES_DOCS__ = " + payload + ";"
        "window.__STUB_PLACES_DOCS__.forEach(function (d) {"
        "  d.data.createdAt = { toDate: function () { return new Date('2026-09-01T12:00:00Z'); } };"
        "  d.data.updatedAt = { toDate: function () { return new Date('2026-09-01T12:00:00Z'); } };"
        "});"
    )


def new_page(browser):
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    pg = ctx.new_page()
    pg.route("**/*", route_handler)
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    return ctx, pg, errs


def goto_explore(pg, docs, wait_ms=700):
    pg.add_init_script(init_script_for(docs))
    pg.goto(BASE_URL + "/explore.html", wait_until="load")
    if wait_ms:
        pg.wait_for_timeout(wait_ms)


def click_map(pg, wait_ms=300):
    pg.click("#mapViewBtn")
    pg.wait_for_timeout(wait_ms)


def click_list(pg, wait_ms=200):
    pg.click("#listViewBtn")
    pg.wait_for_timeout(wait_ms)


def stub_value(pg, name):
    return pg.evaluate("window." + name)


def main():
    with LocalFrontendServer():
        with sync_playwright() as p:
            browser = p.chromium.launch()

            # ---- 1 & 2. Map initializes, and a real layerGroup is used ----
            ctx, pg, errs = new_page(browser)
            goto_explore(pg, [place("p1")])
            click_map(pg)
            map_view_visible = pg.eval_on_selector("#mapView", "el => !el.classList.contains('d-none')")
            log("1. Map view becomes visible on click", map_view_visible)
            log("2. L.layerGroup() was actually called", (stub_value(pg, "__STUB_LAYERGROUP_CREATED__") or 0) >= 1)
            log("2. no uncaught page errors", len(errs) == 0, str(errs))
            ctx.close()

            # ---- 3. Initial valid places create one marker each ----
            ctx, pg, errs = new_page(browser)
            goto_explore(pg, [place("p1"), place("p2"), place("p3")])
            click_map(pg)
            marker_count = stub_value(pg, "__STUB_LAYERGROUP_MARKER_COUNT__")
            log("3. three valid places create exactly three markers", marker_count == 3, str(marker_count))
            ctx.close()

            # ---- 4. Re-rendering clears previous markers (not accumulated) ----
            ctx, pg, errs = new_page(browser)
            goto_explore(pg, [place("p1"), place("p2")])
            click_map(pg)
            first_count = stub_value(pg, "__STUB_LAYERGROUP_MARKER_COUNT__")
            click_list(pg)
            click_map(pg)  # re-render with the same unfiltered data
            second_count = stub_value(pg, "__STUB_LAYERGROUP_MARKER_COUNT__")
            clear_calls = stub_value(pg, "__STUB_LAYERGROUP_CLEAR_CALLS__")
            log("4. marker count stays correct after a re-render (no accumulation)",
                first_count == 2 and second_count == 2, f"first={first_count} second={second_count}")
            log("4. clearLayers() was actually called before re-adding markers", clear_calls >= 2, str(clear_calls))
            ctx.close()

            # ---- 5. Filters update markers correctly ----
            ctx, pg, errs = new_page(browser)
            goto_explore(pg, [place("p1", dietTags=["vegan"]), place("p2", dietTags=["vegetarian"])])
            click_map(pg)
            before = stub_value(pg, "__STUB_LAYERGROUP_MARKER_COUNT__")
            pg.click('button.vs-filter-chip[data-diet="vegan"]')
            pg.wait_for_timeout(200)
            after = stub_value(pg, "__STUB_LAYERGROUP_MARKER_COUNT__")
            log("5. applying a diet filter while on Map view updates marker count",
                before == 2 and after == 1, f"before={before} after={after}")
            ctx.close()

            # ---- 6. Search updates markers correctly ----
            ctx, pg, errs = new_page(browser)
            goto_explore(pg, [place("p1", name="Shegaon Sattvik Dhaba"), place("p2", name="Campus Corner Canteen")])
            click_map(pg)
            pg.fill("#searchInput", "sattvik")
            pg.wait_for_timeout(200)
            after_search = stub_value(pg, "__STUB_LAYERGROUP_MARKER_COUNT__")
            log("6. search while on Map view narrows marker count", after_search == 1, str(after_search))
            ctx.close()

            # ---- 7 & 8. Invalid coordinates don't crash the map; valid places still render ----
            ctx, pg, errs = new_page(browser)
            goto_explore(pg, [
                place("good-1", name="Good Place One", latitude=GOOD_LAT, longitude=GOOD_LON),
                place("bad-coord", name="Bad Coordinate Place", latitude=BAD_LAT, longitude=BAD_LON),
                place("good-2", name="Good Place Two", latitude=GOOD_LAT, longitude=GOOD_LON),
            ])
            click_map(pg)
            marker_count = stub_value(pg, "__STUB_LAYERGROUP_MARKER_COUNT__")
            log("7. an invalid coordinate does not crash the map (page still works)", len(errs) == 0, str(errs))
            log("8. only the two valid-coordinate places get markers (bad one skipped)", marker_count == 2, str(marker_count))
            ctx.close()

            # ---- 9. List -> Map calls invalidateSize() ----
            ctx, pg, errs = new_page(browser)
            goto_explore(pg, [place("p1")])
            before_calls = stub_value(pg, "__STUB_INVALIDATE_SIZE_CALLS__") or 0
            click_map(pg)
            after_calls = stub_value(pg, "__STUB_INVALIDATE_SIZE_CALLS__") or 0
            log("9. invalidateSize() is called when switching List -> Map", after_calls > before_calls,
                f"before={before_calls} after={after_calls}")
            ctx.close()

            # ---- 10. Repeated List <-> Map switching doesn't duplicate markers ----
            ctx, pg, errs = new_page(browser)
            goto_explore(pg, [place("p1"), place("p2")])
            click_map(pg)
            click_list(pg)
            click_map(pg)
            click_list(pg)
            click_map(pg)
            final_count = stub_value(pg, "__STUB_LAYERGROUP_MARKER_COUNT__")
            invalidate_calls = stub_value(pg, "__STUB_INVALIDATE_SIZE_CALLS__")
            log("10. repeated List<->Map switching never duplicates markers", final_count == 2, str(final_count))
            log("10. invalidateSize() fired on every switch to Map (3 times)", invalidate_calls == 3, str(invalidate_calls))
            log("10. no uncaught page errors across repeated switching", len(errs) == 0, str(errs))
            ctx.close()

            # ---- 11. Popup dynamic values remain escaped ----
            ctx, pg, errs = new_page(browser)
            goto_explore(pg, [place("xss-1", name="<b>Test</b>")])
            click_map(pg)
            popups = pg.evaluate("window.__STUB_MARKER_POPUPS__ || []")
            joined = " ".join(popups)
            log("11. marker popup escapes a malicious place name (no real <b> markup)",
                "&lt;b&gt;Test&lt;/b&gt;" in joined and "<b>Test</b>" not in joined, joined)
            ctx.close()

            # ---- 12. No uncaught page errors, across a full normal session ----
            ctx, pg, errs = new_page(browser)
            goto_explore(pg, [place("p1"), place("p2", latitude=BAD_LAT, longitude=BAD_LON)])
            click_map(pg)
            pg.fill("#searchInput", "test")
            pg.wait_for_timeout(150)
            pg.fill("#searchInput", "")
            pg.wait_for_timeout(150)
            click_list(pg)
            click_map(pg)
            log("12. no uncaught page errors across a full normal session", len(errs) == 0, str(errs))
            ctx.close()

            browser.close()

    ok = summary()
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
