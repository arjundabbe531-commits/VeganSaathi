import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "tests" / "browser"))

from common import BASE_URL, LocalFrontendServer, make_route_handler
from playwright.sync_api import sync_playwright

with LocalFrontendServer():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        page.route("**/*", make_route_handler())

        page.on("console", lambda msg: print(f"CONSOLE [{msg.type}]: {msg.text}"))
        page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))
        page.on(
            "requestfailed",
            lambda req: print(f"REQUEST FAILED: {req.url} :: {req.failure}")
        )
        page.on(
            "response",
            lambda res: print(f"HTTP {res.status}: {res.url}")
            if res.status >= 400 else None
        )

        page.goto(BASE_URL + "/explore.html", wait_until="load")
        page.wait_for_timeout(1500)

        print("Final URL:", page.url)
        print("Loading visible:", page.locator("#loadingState").is_visible())
        print("Error visible:", page.locator("#errorState").is_visible())
        print("Empty database visible:", page.locator("#emptyDatabaseState").is_visible())

        browser.close()
