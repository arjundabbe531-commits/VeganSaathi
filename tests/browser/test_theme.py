"""Ensure theme behavior and an accessible switch are available on every page."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import BASE_URL, FRONTEND_DIR, LocalFrontendServer, log, make_route_handler, summary  # noqa: E402
from playwright.sync_api import sync_playwright


def main():
    pages = sorted(FRONTEND_DIR.rglob("*.html"))
    with LocalFrontendServer(), sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 900}, color_scheme="light")
        page.route("**/*", make_route_handler())
        page.goto(BASE_URL + "/index.html", wait_until="load")

        for html_page in pages:
            route = "/" + html_page.relative_to(FRONTEND_DIR).as_posix()
            source = html_page.read_text(encoding="utf-8")
            log(f"{route} has pre-paint theme bootstrap", "data-vs-theme-bootstrap" in source)
            page.evaluate("localStorage.setItem('vs_theme', 'light')")
            page.goto(BASE_URL + route, wait_until="load")
            toggle = page.locator("#themeToggleBtn")
            log(f"{route} exposes labeled theme toggle", toggle.count() == 1 and toggle.get_attribute("aria-label") == "Switch to dark theme")
            toggle.click()
            dark_state = page.locator("html").get_attribute("data-theme") == "dark"
            page.wait_for_function(
                "getComputedStyle(document.body).backgroundColor === 'rgb(12, 21, 14)'"
            )
            dark_surface = page.locator("body").evaluate("el => getComputedStyle(el).backgroundColor") == "rgb(12, 21, 14)"
            log(f"{route} switches to dark palette", dark_state and dark_surface)
            log(f"{route} toggle announces reverse action", toggle.get_attribute("aria-label") == "Switch to light theme" and toggle.get_attribute("aria-pressed") == "true")

        dark_page = browser.new_page(viewport={"width": 1280, "height": 900}, color_scheme="dark")
        dark_page.route("**/*", make_route_handler())
        dark_page.goto(BASE_URL + "/index.html", wait_until="load")
        log("OS dark preference applies when no stored choice exists", dark_page.locator("html").get_attribute("data-theme") == "dark")
        dark_page.locator("#themeToggleBtn").click()
        dark_page.reload(wait_until="load")
        log("saved light choice overrides OS dark preference after reload", dark_page.locator("html").get_attribute("data-theme") == "light")
        page.goto(BASE_URL + "/explore.html", wait_until="load")
        log("manual dark choice persists across navigation", page.locator("html").get_attribute("data-theme") == "dark")

        dark_page.close()
        browser.close()
    return summary()


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
