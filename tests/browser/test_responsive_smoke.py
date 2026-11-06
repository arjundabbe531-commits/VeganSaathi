"""Offline responsive/accessibility smoke across public and admin pages."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import BASE_URL, LocalFrontendServer, log, make_route_handler, summary  # noqa: E402

from playwright.sync_api import sync_playwright


PAGES = [
    "/index.html", "/explore.html", "/place-details.html", "/login.html",
    "/register.html", "/profile.html", "/saved.html", "/submit-place.html",
    "/admin/dashboard.html", "/admin/import-review.html",
    "/admin/place-intelligence.html", "/alternatives/index.html",
    "/awareness/faq.html", "/awareness/getting-started.html",
    "/awareness/misconceptions.html", "/awareness/plant-based-indian-foods.html",
    "/awareness/vegetarian-vs-vegan.html", "/awareness/what-is-veganism.html",
]
WIDTHS = (320, 375, 390, 768, 1024, 1440)


def main():
    route_local_and_abort_external = make_route_handler()
    page_errors = []

    with LocalFrontendServer(), sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.on("pageerror", lambda error: page_errors.append(str(error)))

        def offline_route(route):
            url = route.request.url
            if url.startswith(BASE_URL + "/") or any(
                host in url for host in ("bootstrap.min.css", "bootstrap.bundle.min.js", "unpkg.com/leaflet", "gstatic.com/firebasejs", "tile.openstreetmap.org")
            ):
                route_local_and_abort_external(route)
            else:
                route.abort()

        page.route("**/*", offline_route)

        for path in PAGES:
            for width in WIDTHS:
                page.set_viewport_size({"width": width, "height": 900})
                try:
                    response = page.goto(BASE_URL + path, wait_until="domcontentloaded", timeout=15000)
                    page.wait_for_timeout(100)
                    result = page.evaluate(
                        """() => ({
                            viewport: innerWidth,
                            document: document.documentElement.scrollWidth,
                            missingAlt: [...document.images].filter(image => !image.hasAttribute('alt')).length,
                            unnamedVisible: [...document.querySelectorAll('button,a,input,select,textarea')]
                                .filter(element => {
                                    const text = (element.innerText || element.value || '').trim();
                                    const visible = element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
                                    const named = text || element.labels?.length || element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || element.title;
                                    return element.type !== 'hidden' && visible && !named;
                                }).length
                        })"""
                    )
                    ok = bool(response and response.status < 400)
                    ok = ok and result["document"] <= width + 1 and not result["missingAlt"] and not result["unnamedVisible"]
                    details = ""
                    if not response or response.status >= 400:
                        details = f"HTTP {response.status if response else 'no response'}"
                    elif result["document"] > width + 1:
                        details = f"document width {result['document']}px"
                    elif result["missingAlt"]:
                        details = f"{result['missingAlt']} image(s) missing alt"
                    elif result["unnamedVisible"]:
                        details = f"{result['unnamedVisible']} visible control(s) unnamed"
                    log(f"{path} fits and has named visible controls at {width}px", ok, details)
                except Exception as error:
                    log(f"{path} responsive smoke at {width}px", False, str(error))

        log("No browser page errors across responsive smoke", not page_errors, "; ".join(page_errors[:5]))
        browser.close()

    return summary()


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
