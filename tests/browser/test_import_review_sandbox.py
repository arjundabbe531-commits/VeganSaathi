"""The offline reviewer must never present embedded synthetic examples as stageable."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import BASE_URL, LocalFrontendServer, log, make_route_handler, summary  # noqa: E402

from playwright.sync_api import sync_playwright


def main():
    with LocalFrontendServer(), sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page()
        page.route("**/*", make_route_handler())
        page.goto(BASE_URL + "/admin/import-review.html", wait_until="load")
        page.wait_for_timeout(300)

        log("default illustrative report contains no stageable records", page.locator("#statEligible").inner_text() == "0")
        log("default illustrative report records are blocked", page.locator("#statBlocked").inner_text() == "4")
        log("default records identify synthetic test data", page.get_by_text("Synthetic test fixture — blocked").count() == 4)

        page.get_by_role("button", name="Load synthetic test fixtures (blocked)").click()
        log("synthetic fixture report contains no stageable records", page.locator("#statEligible").inner_text() == "0")
        log("synthetic fixture report records are blocked", page.locator("#statBlocked").inner_text() == "3")
        page.get_by_role("button", name="Eligible", exact=True).click()
        log("eligible filter never exposes synthetic fixtures", page.locator("#recordsContainer").inner_text().startswith('No records found'))
        log("sandbox explicitly states it performs no database writes", "Zero Database Writes" in page.locator("body").inner_text())

        browser.close()
    summary()


if __name__ == "__main__":
    main()
