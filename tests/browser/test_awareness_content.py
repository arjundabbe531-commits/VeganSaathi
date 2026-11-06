"""
VeganSaathi — tests/browser/test_awareness_content.py
==============================================================================
Phase 8 — Vegan Awareness Content Browser Test Suite.
Covers:
  - Route Loading: All 6 awareness routes load with HTTP 200 and zero JS errors.
  - Sub-Navigation: Awareness topic pills rendered, correct active state, all clickable.
  - Navbar & Footer: Main navigation links to Awareness; footer links to all 6 topics.
  - Educational Guardrails & Disclaimers: Educational disclaimer present on all 6 pages.
  - References & Citations: External sources (Vegan Society, NHS, Harvard Health, ICMR-NIN)
    are present, correctly formed (target="_blank", rel="noopener noreferrer").
  - Internal Links: Cross-topic links and Explore CTAs point to valid destinations.
  - Interactive Elements: FAQ accordion expands/collapses properly.
  - Responsive Viewports: Clean display at desktop (1280px), tablet (768px), and
    mobile (375px) viewports with zero horizontal overflow.

Prerequisites: Playwright with Chromium installed.
Run:
  $env:PLAYWRIGHT_BROWSERS_PATH="D:\\VeganSaathi-Playwright-Browsers"
  .\\.venv\\Scripts\\python.exe -u tests/browser/test_awareness_content.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import BASE_URL, LocalFrontendServer, log, make_route_handler, summary  # noqa: E402

from playwright.sync_api import sync_playwright

route_handler = make_route_handler()

AWARENESS_PAGES = [
    {
        "file": "what-is-veganism.html",
        "title_keyword": "What is Veganism",
        "subpage_key": "what-is-veganism",
        "expected_heading": "What is Veganism?",
    },
    {
        "file": "vegetarian-vs-vegan.html",
        "title_keyword": "Vegetarian vs Vegan",
        "subpage_key": "vegetarian-vs-vegan",
        "expected_heading": "Vegetarian vs Vegan — Not the Same Thing",
    },
    {
        "file": "misconceptions.html",
        "title_keyword": "Common Misconceptions",
        "subpage_key": "misconceptions",
        "expected_heading": "Common Misconceptions About Veganism",
    },
    {
        "file": "getting-started.html",
        "title_keyword": "Getting Started",
        "subpage_key": "getting-started",
        "expected_heading": "Getting Started: A Guide for Students",
    },
    {
        "file": "plant-based-indian-foods.html",
        "title_keyword": "Plant-Based Indian Foods",
        "subpage_key": "plant-based-indian-foods",
        "expected_heading": "Plant-Based Indian Foods & Ingredients",
    },
    {
        "file": "faq.html",
        "title_keyword": "Student FAQ",
        "subpage_key": "faq",
        "expected_heading": "Student & Campus FAQ",
    },
]


def test_awareness_module():
    with LocalFrontendServer(), sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        print("\n=== Test Suite 1: Route Loading, Titles, and Headings ===")
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        page.route("**/*", route_handler)

        page_errors = []
        page.on("pageerror", lambda e: page_errors.append(str(e)))

        for p_info in AWARENESS_PAGES:
            url = f"{BASE_URL}/awareness/{p_info['file']}"
            resp = page.goto(url, wait_until="networkidle")
            page.wait_for_timeout(300)

            # Check HTTP status
            status_ok = resp is not None and resp.status == 200
            log(f"Route loads HTTP 200: {p_info['file']}", status_ok)

            # Check title
            title = page.title()
            title_ok = p_info["title_keyword"] in title
            log(f"Page title correct: {p_info['file']}", title_ok, f"Got: '{title}'")

            # Check primary heading
            h1_text = page.locator("h1").first.inner_text()
            heading_ok = p_info["expected_heading"] in h1_text
            log(f"Page h1 heading correct: {p_info['file']}", heading_ok, f"Got: '{h1_text}'")

        log("Zero JS errors during route loading", len(page_errors) == 0, f"Errors: {page_errors}")
        context.close()

        print("\n=== Test Suite 2: Sub-Navigation Component & Active Pills ===")
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        page.route("**/*", route_handler)

        for p_info in AWARENESS_PAGES:
            url = f"{BASE_URL}/awareness/{p_info['file']}"
            page.goto(url, wait_until="networkidle")
            page.wait_for_timeout(200)

            nav_locator = page.locator(".vs-awareness-nav")
            nav_present = nav_locator.is_visible()
            log(f"Sub-nav rendered on {p_info['file']}", nav_present)

            # Count topic pills - should be 6
            pills = page.locator(".vs-awareness-nav a")
            pills_count = pills.count()
            log(f"Sub-nav has 6 pills on {p_info['file']}", pills_count == 6, f"Count: {pills_count}")

            # Active pill check
            active_pill = page.locator(".vs-awareness-nav a.btn-vs-primary")
            active_count = active_pill.count()
            active_href = active_pill.get_attribute("href") if active_count == 1 else ""
            expected_href_part = p_info["file"]
            active_ok = active_count == 1 and expected_href_part in (active_href or "")
            log(f"Active pill marks {p_info['file']}", active_ok, f"Href: {active_href}")

        context.close()

        print("\n=== Test Suite 3: Educational Disclaimer & References Section ===")
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        page.route("**/*", route_handler)

        for p_info in AWARENESS_PAGES:
            url = f"{BASE_URL}/awareness/{p_info['file']}"
            page.goto(url, wait_until="networkidle")
            page.wait_for_timeout(200)

            # Educational Disclaimer Box
            disclaimer = page.locator(".vs-disclaimer-box")
            disc_visible = disclaimer.is_visible()
            disc_text = disclaimer.inner_text() if disc_visible else ""
            disc_valid = disc_visible and "Educational Disclaimer" in disc_text and "medical" in disc_text.lower()
            log(f"Educational disclaimer present on {p_info['file']}", disc_valid)

            # References Card
            ref_card = page.locator(".vs-reference-card")
            ref_visible = ref_card.is_visible()
            ref_items = page.locator(".vs-reference-card li")
            ref_valid = ref_visible and ref_items.count() >= 2
            log(f"Reference card with citations on {p_info['file']}", ref_valid, f"Items: {ref_items.count()}")

            # Explore CTA button
            explore_btn = page.locator("a[href*='explore.html']")
            explore_visible = explore_btn.first.is_visible()
            log(f"Explore CTA link present on {p_info['file']}", explore_visible)

        context.close()

        print("\n=== Test Suite 4: External Citation Attributes & Security ===")
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        page.route("**/*", route_handler)

        # Check what-is-veganism.html external links
        page.goto(f"{BASE_URL}/awareness/what-is-veganism.html", wait_until="networkidle")
        ext_links = page.locator("a[href^='http']")
        ext_count = ext_links.count()
        log("External links detected", ext_count > 0, f"Found {ext_count} links")

        all_safe = True
        for i in range(ext_count):
            link = ext_links.nth(i)
            target = link.get_attribute("target")
            rel = link.get_attribute("rel")
            if target != "_blank" or not rel or "noopener" not in rel:
                all_safe = False
                break
        log("All external links have target='_blank' and rel='noopener noreferrer'", all_safe)
        context.close()

        print("\n=== Test Suite 5: Navbar and Footer Integration ===")
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        page.route("**/*", route_handler)

        # Check from home page (index.html)
        page.goto(f"{BASE_URL}/index.html", wait_until="networkidle")
        # The app renders shared navigation asynchronously after its modules load.
        # Wait for the rendered links instead of racing the component initialization.
        page.locator("#navbar-placeholder a[href*='awareness/what-is-veganism.html']").wait_for(state="visible")
        page.locator("#footer-placeholder a[href*='awareness/']").nth(5).wait_for(state="attached")
        nav_awareness = page.locator("#navbar-placeholder a[href*='awareness/what-is-veganism.html']")
        log("Home page navbar contains Awareness link", nav_awareness.first.is_visible())

        footer_links = page.locator("#footer-placeholder a[href*='awareness/']")
        log("Home page footer contains all 6 Awareness links", footer_links.count() == 6, f"Count: {footer_links.count()}")

        # Check navigation from navbar to awareness page
        nav_awareness.first.click()
        page.wait_for_load_state("networkidle")
        log("Clicking navbar Awareness links to what-is-veganism.html", "what-is-veganism.html" in page.url)
        context.close()

        print("\n=== Test Suite 6: Interactive FAQ Accordion ===")
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        page.route("**/*", route_handler)

        page.goto(f"{BASE_URL}/awareness/faq.html", wait_until="networkidle")
        page.wait_for_timeout(300)

        # FAQ 1 is open by default
        faq1_body = page.locator("#collapseOne")
        log("FAQ Item 1 open by default", faq1_body.is_visible())

        # FAQ 2 is closed by default
        faq2_btn = page.locator("button[data-bs-target='#collapseTwo']")
        faq2_body = page.locator("#collapseTwo")
        log("FAQ Item 2 closed initially", not faq2_body.is_visible())

        # Click FAQ 2 to expand
        faq2_btn.click()
        page.wait_for_timeout(400)
        log("FAQ Item 2 expands upon click", faq2_body.is_visible())
        context.close()

        print("\n=== Test Suite 7: Responsive Viewports (Desktop, Tablet, Mobile) ===")
        viewports = [
            {"name": "Desktop (1280x900)", "width": 1280, "height": 900},
            {"name": "Tablet (768x1024)", "width": 768, "height": 1024},
            {"name": "Mobile (375x667)", "width": 375, "height": 667},
        ]

        for vp in viewports:
            context = browser.new_context(viewport={"width": vp["width"], "height": vp["height"]})
            page = context.new_page()
            page.route("**/*", route_handler)

            all_fit = True
            for p_info in AWARENESS_PAGES:
                url = f"{BASE_URL}/awareness/{p_info['file']}"
                page.goto(url, wait_until="networkidle")
                page.wait_for_timeout(200)

                # Check horizontal overflow
                overflow = page.evaluate("""() => {
                    const docEl = document.documentElement;
                    return docEl.scrollWidth - docEl.clientWidth;
                }""")

                # Tolerance of 2px for browser rendering / subpixel rounding
                if overflow > 2:
                    all_fit = False
                    print(f"  Overflow on {p_info['file']} at {vp['name']}: {overflow}px")

            log(f"Zero horizontal page overflow at {vp['name']}", all_fit)
            context.close()

        browser.close()


if __name__ == "__main__":
    test_awareness_module()
    success = summary()
    sys.exit(0 if success else 1)
