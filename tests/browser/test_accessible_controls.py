"""Regression checks for accessible search/review controls and narrow admin layouts."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import BASE_URL, LocalFrontendServer, log, make_route_handler, summary  # noqa: E402

from playwright.sync_api import sync_playwright


def main():
    with LocalFrontendServer(), sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(viewport={"width": 320, "height": 900})
        page.route("**/*", make_route_handler())

        checks = [
            ("/alternatives/index.html", "#altSearchInput"),
            ("/admin/place-intelligence.html", "#candidateSearch"),
            ("/admin/place-intelligence.html", "#vd-notes"),
            ("/admin/place-intelligence.html", "#publishedSearch"),
        ]
        for path, selector in checks:
            page.goto(BASE_URL + path, wait_until="load")
            has_label = page.locator(selector).evaluate(
                "element => Boolean(element.labels && element.labels.length)"
            )
            log(f"{selector} has an associated accessible label", has_label)

        page.goto(BASE_URL + "/admin/import-review.html", wait_until="load")
        page.set_viewport_size({"width": 320, "height": 900})
        page.wait_for_timeout(100)
        page_width = page.evaluate("document.documentElement.scrollWidth")
        log("import-review filter bar fits 320px viewport", page_width <= 322, f"scroll width {page_width}px")

        browser.close()
    return summary()


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
