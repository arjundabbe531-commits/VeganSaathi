"""
VeganSaathi — tests/browser/test_5_1b_hardening.py
==============================================================================
The Task 5.1b (XSS hardening) regression suite. Ported here from ad-hoc
verification, with two necessary corrections made as later tasks migrated
pages off mock data — each time, left as mock-data mutation, the affected
page's case would have silently stopped testing anything while still
reporting PASS:
  - explore.html (Task 5.3): now injects through window.__STUB_PLACES_DOCS__
    (the same Firestore stub mechanism test_explore_firestore.py uses).
  - place-details.html (Task 5.5): same mechanism, its own dedicated place
    document matching the page's own ?id= query param.
index.html / saved.html / admin/dashboard.html are still untouched by any
Firestore migration so far, so their original mock-data-mutation mechanism
remains correct and is kept as-is.

Run directly:  python3 tests/browser/test_5_1b_hardening.py
Prerequisites: same as test_phase4_regression.py.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import BASE_URL, FRONTEND_DIR, LocalFrontendServer, log, make_route_handler, summary  # noqa: E402

from playwright.sync_api import sync_playwright

route_handler = make_route_handler()
PAYLOAD_NAME = "<b>Test</b>"


def main():
    with LocalFrontendServer():
        with sync_playwright() as p:
            browser = p.chromium.launch()

            # ------------------------------------------------------------------
            # Check 1a: mock-data-driven pages (unchanged by Task 5.3) — inject
            # the payload into MOCK_PLACES/MOCK_REVIEWS/etc. exactly as before.
            # ------------------------------------------------------------------
            inject = """
                MOCK_PLACES[0].name = %(payload)s;
                MOCK_PLACES[0].imageLabel = %(payload)s;
                MOCK_REVIEWS[0].userName = %(payload)s;
                MOCK_REVIEWS[0].comment = %(payload)s;
                MOCK_SAVED_PLACES.push(MOCK_PLACES[0].id);
                MOCK_ADMIN_PENDING[0].name = %(payload)s;
                MOCK_ADMIN_PENDING[0].submittedBy = %(payload)s;
                MOCK_ADMIN_REPORTS[0].placeName = %(payload)s;
            """ % {"payload": json.dumps(PAYLOAD_NAME)}

            def route_handler_with_mock_payload(route):
                url = route.request.url
                if url.endswith("/js/mock-data.js") or url.endswith("/js/mock-data.js?"):
                    content = (FRONTEND_DIR / "js" / "mock-data.js").read_text()
                    content += "\n" + inject
                    route.fulfill(status=200, content_type="application/javascript", body=content)
                    return
                route_handler(route)

            mock_driven_pages = {
                "index.html": "#featuredPlaces",
                "saved.html": "#savedGrid",
                "admin/dashboard.html": "#pendingTableBody",
            }

            def assert_payload_escaped(pg, page_path, errs):
                page_html = pg.content()
                has_real_bold_tag = pg.evaluate("!!document.querySelector('b')")
                contains_literal_text = "Test" in page_html and (
                    "&lt;b&gt;Test&lt;/b&gt;" in page_html or PAYLOAD_NAME not in page_html.replace("&lt;b&gt;Test&lt;/b&gt;", "")
                )
                log("XSS-ESCAPE / " + page_path + ": no real <b> element created from data", not has_real_bold_tag)
                log("XSS-ESCAPE / " + page_path + ": payload appears as literal escaped text", contains_literal_text)
                log("XSS-ESCAPE / " + page_path + ": no uncaught page errors", len(errs) == 0, str(errs))

            for page_path in mock_driven_pages:
                ctx = browser.new_context(viewport={"width": 1280, "height": 900})
                pg = ctx.new_page()
                pg.route("**/*", route_handler_with_mock_payload)
                pg.add_init_script("window.__STUB_USER__ = " + json.dumps({"uid": "u1", "email": "u1@example.com"}) + ";")
                errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)))
                pg.goto(BASE_URL + "/" + page_path, wait_until="load")
                pg.wait_for_timeout(400)
                assert_payload_escaped(pg, page_path, errs)
                ctx.close()

            # ------------------------------------------------------------------
            # Check 1b: explore.html — Task 5.3 moved this page onto Firestore,
            # so inject via the Firestore stub instead of MOCK_PLACES.
            # ------------------------------------------------------------------
            xss_place = {
                "id": "xss-test-place",
                "data": {
                    "name": PAYLOAD_NAME,
                    "placeType": "cafe",
                    "address": "Test Address, Shegaon",
                    "latitude": 20.79,
                    "longitude": 76.69,
                    "dietTags": ["vegan"],
                    "status": "published",
                    "verificationStatus": "unverified",
                    "source": "fieldwork",
                    "submittedBy": "uid-test",
                    "submittedByName": "Tester"
                }
            }
            explore_init = (
                "window.__STUB_USER__ = " + json.dumps({"uid": "u1", "email": "u1@example.com"}) + ";"
                "window.__STUB_PLACES_DOCS__ = " + json.dumps([xss_place]) + ";"
                "window.__STUB_PLACES_DOCS__[0].data.createdAt = { toDate: () => new Date() };"
                "window.__STUB_PLACES_DOCS__[0].data.updatedAt = { toDate: () => new Date() };"
            )
            ctx = browser.new_context(viewport={"width": 1280, "height": 900})
            pg = ctx.new_page()
            pg.route("**/*", route_handler)
            pg.add_init_script(explore_init)
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(BASE_URL + "/explore.html", wait_until="load")
            pg.wait_for_timeout(700)  # allow the async fetchPublishedPlaces() stub call to resolve and render
            assert_payload_escaped(pg, "explore.html", errs)
            ctx.close()

            # ------------------------------------------------------------------
            # Check 1c: place-details.html — Task 5.5 moved this page onto
            # Firestore too (fetchPlaceById()), so it needs the same
            # Firestore-stub injection as explore.html above, not a
            # MOCK_PLACES mutation (which it no longer reads at all).
            # ------------------------------------------------------------------
            xss_place_details = {
                "id": "xss-place-details-test",
                "data": {
                    "name": PAYLOAD_NAME,
                    "placeType": "cafe",
                    "address": "Test Address, Shegaon",
                    "latitude": 20.79,
                    "longitude": 76.69,
                    "dietTags": ["vegan"],
                    "status": "published",
                    "verificationStatus": "unverified",
                    "source": "fieldwork",
                    "submittedBy": "uid-test",
                    "submittedByName": "Tester"
                }
            }
            place_details_init = (
                "window.__STUB_USER__ = " + json.dumps({"uid": "u1", "email": "u1@example.com"}) + ";"
                "window.__STUB_PLACES_DOCS__ = " + json.dumps([xss_place_details]) + ";"
                "window.__STUB_PLACES_DOCS__[0].data.createdAt = { toDate: () => new Date() };"
                "window.__STUB_PLACES_DOCS__[0].data.updatedAt = { toDate: () => new Date() };"
            )
            ctx = browser.new_context(viewport={"width": 1280, "height": 900})
            pg = ctx.new_page()
            pg.route("**/*", route_handler)
            pg.add_init_script(place_details_init)
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(BASE_URL + "/place-details.html?id=xss-place-details-test", wait_until="load")
            pg.wait_for_timeout(500)
            assert_payload_escaped(pg, "place-details.html", errs)
            ctx.close()

            # ------------------------------------------------------------------
            # Check 2: diet badges still work correctly WITHOUT mock-data.js.
            # ------------------------------------------------------------------
            standalone_html = """<!DOCTYPE html><html><head></head><body>
            <div id="out"></div>
            <script src="js/components.js"></script>
            <script>
              document.getElementById('out').innerHTML = renderDietBadges(['vegan', 'jain']);
            </script>
            </body></html>"""

            def standalone_handler(route):
                url = route.request.url
                if url == BASE_URL + "/standalone-badge-test.html":
                    route.fulfill(status=200, content_type="text/html", body=standalone_html)
                    return
                route_handler(route)

            ctx = browser.new_context(viewport={"width": 800, "height": 600})
            pg = ctx.new_page()
            pg.route("**/*", standalone_handler)
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(BASE_URL + "/standalone-badge-test.html", wait_until="load")
            pg.wait_for_timeout(200)
            badge_count = pg.eval_on_selector_all("#out .vs-badge", "els => els.length")
            badge_text = pg.eval_on_selector("#out", "el => el.textContent")
            log("DIET-BADGE-INDEPENDENCE / renders badges with components.js alone (no mock-data.js)",
                badge_count == 2 and "Vegan" in badge_text and "Jain" in badge_text,
                f"count={badge_count} text={badge_text!r}")
            log("DIET-BADGE-INDEPENDENCE / no uncaught page errors", len(errs) == 0, str(errs))
            ctx.close()

            browser.close()

    ok = summary()
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
