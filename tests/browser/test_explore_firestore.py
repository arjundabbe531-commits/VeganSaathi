"""
VeganSaathi — tests/browser/test_explore_firestore.py
==============================================================================
Task 5.3 — Explore -> Firestore migration test suite. Covers the 12 required
scenarios: loading state, successful load, empty published collection,
search, filters, filters-excluding-everything, Firestore/network error,
permission-denied, invalid documents skipped, the 90-day freshness cue,
verificationStatus never auto-changing, and no mock-data fallback.

Uses the same Firestore stub mechanism as the Node-side places-service.js
unit tests (see tests/test-places-service.mjs) but at the browser/DOM level,
via window.__STUB_PLACES_DOCS__ / __STUB_PLACES_THROW__ / __STUB_PLACES_DELAY_MS__
(see tests/browser/stub-assets/firebase-firestore.browser-stub.js).

Run directly:  python3 tests/browser/test_explore_firestore.py
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


def init_script_for(docs, delay_ms=None, throw=None):
    parts = ["window.__STUB_USER__ = null;"]
    if docs is not None:
        payload = json.dumps(docs)
        parts.append("window.__STUB_PLACES_DOCS__ = " + payload + ";")
        # Re-attach real Date-producing Timestamp stubs (JSON can't carry
        # functions) for every doc, using the __iso marker for overridden
        # dates (e.g. lastVerifiedAt) and a fixed default otherwise.
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
    if delay_ms is not None:
        parts.append("window.__STUB_PLACES_DELAY_MS__ = " + str(delay_ms) + ";")
    if throw is not None:
        parts.append(
            "window.__STUB_PLACES_THROW__ = Object.assign(new Error(" + json.dumps(throw["message"]) + "), "
            + json.dumps(throw) + ");"
        )
    return "".join(parts)


def iso_days_ago(days):
    """A JSON-safe marker the init script recognizes and converts to a real
    Timestamp-like stub pointing at (now - days)."""
    import datetime
    dt = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)
    return {"__iso": dt.strftime("%Y-%m-%dT%H:%M:%SZ")}


def goto(pg, path, init_docs=None, delay_ms=None, throw=None, wait_ms=700):
    pg.add_init_script(init_script_for(init_docs, delay_ms, throw))
    pg.goto(BASE_URL + "/" + path, wait_until="load")
    if wait_ms:
        pg.wait_for_timeout(wait_ms)


def new_page(browser):
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    pg = ctx.new_page()
    pg.route("**/*", route_handler)
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    return ctx, pg, errs


def is_hidden(pg, selector):
    return pg.eval_on_selector(selector, "el => el.classList.contains('d-none')")


def main():
    with LocalFrontendServer():
        with sync_playwright() as p:
            browser = p.chromium.launch()

            # ---- 1. Loading state is actually shown before data resolves ----
            ctx, pg, errs = new_page(browser)
            pg.add_init_script(init_script_for([place("p1")], delay_ms=1500))
            pg.goto(BASE_URL + "/explore.html", wait_until="load")
            pg.wait_for_timeout(300)  # well before the 1500ms stub delay resolves
            log("1. loading state shown before data resolves", not is_hidden(pg, "#loadingState"))
            log("1. results area not shown yet", is_hidden(pg, "#listView"))
            ctx.close()

            # ---- 2. Successful load renders real places ----
            ctx, pg, errs = new_page(browser)
            goto(pg, "explore.html", init_docs=[place("p1", name="Real Firestore Place")])
            log("2. loading state hidden after successful load", is_hidden(pg, "#loadingState"))
            log("2. listView shown after successful load", not is_hidden(pg, "#listView"))
            card_count = pg.eval_on_selector_all("#resultsGrid .vs-place-card", "els => els.length")
            log("2. exactly one real place card rendered", card_count == 1, str(card_count))
            card_text = pg.eval_on_selector("#resultsGrid", "el => el.textContent")
            log("2. card shows the real Firestore place's name", "Real Firestore Place" in card_text)
            log("2. no uncaught page errors", len(errs) == 0, str(errs))
            ctx.close()

            # ---- 3. Empty published collection -> honest empty-database state ----
            ctx, pg, errs = new_page(browser)
            goto(pg, "explore.html", init_docs=[])
            log("3. empty-database state shown for zero published places", not is_hidden(pg, "#emptyDatabaseState"))
            log("3. listView stays hidden", is_hidden(pg, "#listView"))
            empty_text = pg.eval_on_selector("#emptyDatabaseState", "el => el.textContent")
            log("3. empty-database message is honest, not a filter message", "available yet" in empty_text.lower())
            ctx.close()

            # ---- 4. Search matches a real place ----
            ctx, pg, errs = new_page(browser)
            goto(pg, "explore.html", init_docs=[
                place("p1", name="Shegaon Sattvik Dhaba"),
                place("p2", name="Campus Corner Canteen"),
            ])
            pg.fill("#searchInput", "sattvik")
            pg.wait_for_timeout(150)
            count_text = pg.eval_on_selector("#resultsCount", "el => el.textContent")
            log("4. search narrows to the matching place", "1 place" in count_text, count_text)
            ctx.close()

            # ---- 5. Diet filter narrows real results ----
            ctx, pg, errs = new_page(browser)
            goto(pg, "explore.html", init_docs=[
                place("p1", dietTags=["vegan"]),
                place("p2", dietTags=["vegetarian"]),
            ])
            pg.click('button.vs-filter-chip[data-diet="vegan"]')
            pg.wait_for_timeout(150)
            count_text = pg.eval_on_selector("#resultsCount", "el => el.textContent")
            log("5. diet filter narrows real Firestore-sourced results", "1 place" in count_text, count_text)
            ctx.close()

            # ---- 6. Filters can exclude everything -> distinct "no matches" state ----
            ctx, pg, errs = new_page(browser)
            goto(pg, "explore.html", init_docs=[place("p1", dietTags=["vegan"])])
            pg.click('button.vs-filter-chip[data-diet="jain"]')  # place has no jain tag
            pg.wait_for_timeout(150)
            log("6. filtered-to-nothing shows the filter empty state", not is_hidden(pg, "#emptyState"))
            log("6. filtered-to-nothing is distinct from the empty-DATABASE state", is_hidden(pg, "#emptyDatabaseState"))
            ctx.close()

            # ---- 7. Firestore/network error -> friendly error state, no mock fallback ----
            ctx, pg, errs = new_page(browser)
            goto(pg, "explore.html", throw={"message": "network unavailable", "code": "unavailable"})
            log("7. error state shown on a generic read error", not is_hidden(pg, "#errorState"))
            log("7. no mock places rendered instead", is_hidden(pg, "#listView"))
            error_text = pg.eval_on_selector("#errorState", "el => el.textContent")
            log("7. error message is user-friendly, no raw Firebase error code shown", "unavailable" not in error_text and "code" not in error_text.lower())
            ctx.close()

            # ---- 8. permission-denied is handled (not shown differently to the user, but doesn't crash) ----
            ctx, pg, errs = new_page(browser)
            goto(pg, "explore.html", throw={"message": "Missing or insufficient permissions.", "code": "permission-denied"})
            log("8. error state shown on permission-denied", not is_hidden(pg, "#errorState"))
            log("8. no mock places rendered instead", is_hidden(pg, "#listView"))
            log("8. no uncaught page errors", len(errs) == 0, str(errs))
            ctx.close()

            # ---- 9. An invalid document is skipped while valid ones still render ----
            ctx, pg, errs = new_page(browser)
            goto(pg, "explore.html", init_docs=[
                place("good-1", name="Good Place One"),
                place("bad-1", name="Bad Place", placeType="not-a-real-type"),
                place("good-2", name="Good Place Two"),
            ])
            card_count = pg.eval_on_selector_all("#resultsGrid .vs-place-card", "els => els.length")
            log("9. invalid document skipped, both valid ones render", card_count == 2, str(card_count))
            page_text = pg.eval_on_selector("#resultsGrid", "el => el.textContent")
            log("9. the invalid place's name does not appear", "Bad Place" not in page_text)
            log("9. no uncaught page errors (one bad doc must not crash the page)", len(errs) == 0, str(errs))
            ctx.close()

            # ---- 10. 90-day freshness cue appears for a stale verified place ----
            ctx, pg, errs = new_page(browser)
            goto(pg, "explore.html", init_docs=[
                place("stale-1", name="Old Verified Place", verificationStatus="verified", lastVerifiedAt=iso_days_ago(200)),
                place("fresh-1", name="Recently Verified Place", verificationStatus="verified", lastVerifiedAt=iso_days_ago(10)),
            ])
            cards = pg.eval_on_selector_all(".vs-place-card", "els => els.map(e => e.outerHTML)")
            stale_card = next((c for c in cards if "Old Verified Place" in c), "")
            fresh_card = next((c for c in cards if "Recently Verified Place" in c), "")
            log("10. the stale (>90 day) place's own card has the re-check-due cue", "vs-verify-stale" in stale_card)
            log("10. the fresh (<90 day) place's own card does NOT have the cue", "vs-verify-stale" not in fresh_card)
            ctx.close()

            # ---- 11. The 90-day cue never changes verificationStatus itself ----
            ctx, pg, errs = new_page(browser)
            goto(pg, "explore.html", init_docs=[
                place("stale-2", name="Very Old Verified Place", verificationStatus="verified", lastVerifiedAt=iso_days_ago(400)),
            ])
            card_html = pg.eval_on_selector("#resultsGrid", "el => el.innerHTML")
            log("11. a very-stale place still shows as Verified (not auto-flipped to unverified)",
                "Verified — last checked" in card_html and "Not yet verified" not in card_html)
            log("11. the actual verified date is still shown alongside the cue", "202" in card_html)
            ctx.close()

            # ---- 12. No mock-data fallback anywhere, even conceptually ----
            ctx, pg, errs = new_page(browser)
            goto(pg, "explore.html", throw={"message": "boom", "code": "unknown"})
            page_text = pg.eval_on_selector("body", "el => el.textContent")
            mock_names = ["Green Leaf Mess", "Shegaon Sattvik Dhaba", "Campus Corner Canteen", "Plant & Pulse Cafe"]
            found_any_mock = any(name in page_text for name in mock_names)
            log("12. no mock place names appear anywhere when Firestore fails", not found_any_mock)
            ctx.close()

            browser.close()

    ok = summary()
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
