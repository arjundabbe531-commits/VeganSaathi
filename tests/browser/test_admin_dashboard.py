"""
VeganSaathi — tests/browser/test_admin_dashboard.py
==============================================================================
Phase 7 — Admin Dashboard and Moderation Browser Test Suite.
Covers:
  - Scenario 1: Signed-out visitor redirected / denied with unauthorized screen.
  - Scenario 2: Authenticated non-admin (role="user") denied access safely.
  - Scenario 3: Failed role lookup (error during profile check) fails closed safely.
  - Scenario 4: Authorized admin (role="admin") enters dashboard successfully.
  - Scenario 5: Live overview stats loaded, verified accurate, no mock data fallback.
  - Scenario 6: Pending submissions queue rendered with action buttons and data.
  - Scenario 7: Absence of mock records in production admin path.

Prerequisites: Playwright with Chromium installed.
Run:
  $env:PLAYWRIGHT_BROWSERS_PATH="D:\\VeganSaathi-Playwright-Browsers"
  .\\.venv\\Scripts\\python.exe tests/browser/test_admin_dashboard.py
"""

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import BASE_URL, LocalFrontendServer, log, make_route_handler, summary  # noqa: E402

from playwright.sync_api import sync_playwright

route_handler = make_route_handler()


def run_admin_browser_tests():
    with LocalFrontendServer(), sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # -------------------------------------------------------------
        # 1. Signed-out visitor
        # -------------------------------------------------------------
        print("\n=== Scenario 1: Signed-out visitor access ===")
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        page.route("**/*", route_handler)
        page.add_init_script("window.__STUB_USER__ = null;")

        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE_URL + "/admin/dashboard.html", wait_until="networkidle")
        page.wait_for_timeout(500)

        unauth_visible = page.locator("#adminUnauthorizedScreen").is_visible()
        main_hidden = not page.locator("#adminMainContent").is_visible()
        log("Signed-out: unauthorized screen displayed", unauth_visible)
        log("Signed-out: main admin content hidden", main_hidden)

        unauth_text = page.locator("#unauthorizedReason").inner_text()
        log("Signed-out: clear sign-in required message", "Please sign in" in unauth_text)
        context.close()

        # -------------------------------------------------------------
        # 2. Authenticated non-admin (role == "user")
        # -------------------------------------------------------------
        print("\n=== Scenario 2: Authenticated non-admin (role == 'user') ===")
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        page.route("**/*", route_handler)

        stub_user = {"uid": "user-regular-001", "email": "student@ssgmce.ac.in", "displayName": "Student User"}
        stub_profile = {"name": "Student User", "email": "student@ssgmce.ac.in", "role": "user", "dietPreference": "vegan"}

        init_script = (
            "window.__STUB_USER__ = " + json.dumps(stub_user) + ";"
            "window.__STUB_PROFILE__ = " + json.dumps(stub_profile) + ";"
        )
        page.add_init_script(init_script)

        page.goto(BASE_URL + "/admin/dashboard.html", wait_until="networkidle")
        page.wait_for_timeout(500)

        unauth_visible = page.locator("#adminUnauthorizedScreen").is_visible()
        main_hidden = not page.locator("#adminMainContent").is_visible()
        log("Non-admin: unauthorized screen displayed", unauth_visible)
        log("Non-admin: main admin content hidden", main_hidden)

        unauth_text = page.locator("#unauthorizedReason").inner_text()
        log("Non-admin: restricted privileges message displayed", "does not have administrator privileges" in unauth_text)
        context.close()

        # -------------------------------------------------------------
        # 3. Failed role lookup / Missing profile
        # -------------------------------------------------------------
        print("\n=== Scenario 3: Signed in but role lookup returns no profile ===")
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        page.route("**/*", route_handler)

        stub_user = {"uid": "user-broken-001", "email": "broken@example.com"}
        # stub_profile is None
        init_script = (
            "window.__STUB_USER__ = " + json.dumps(stub_user) + ";"
            "window.__STUB_PROFILE__ = null;"
        )
        page.add_init_script(init_script)

        page.goto(BASE_URL + "/admin/dashboard.html", wait_until="networkidle")
        page.wait_for_timeout(500)

        unauth_visible = page.locator("#adminUnauthorizedScreen").is_visible()
        main_hidden = not page.locator("#adminMainContent").is_visible()
        log("Missing profile: fails closed to unauthorized screen", unauth_visible and main_hidden)
        context.close()

        # -------------------------------------------------------------
        # 4. Authorized administrator (role == 'admin')
        # -------------------------------------------------------------
        print("\n=== Scenario 4: Authorized administrator access ===")
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        page.route("**/*", route_handler)

        admin_user = {"uid": "admin-001", "email": "admin@ssgmce.ac.in", "displayName": "Prof. Administrator"}
        admin_profile = {"name": "Prof. Administrator", "email": "admin@ssgmce.ac.in", "role": "admin", "dietPreference": "vegan"}

        stub_places = [
            {
                "id": "pending-001",
                "data": {
                    "name": "Submitted Dosa Corner",
                    "placeType": "restaurant",
                    "address": "Near Station Road, Shegaon",
                    "latitude": 20.792,
                    "longitude": 76.691,
                    "dietTags": ["vegan", "vegetarian"],
                    "status": "pending",
                    "verificationStatus": "unverified",
                    "source": "community",
                    "submittedBy": "user-123",
                    "submittedByName": "Rahul S.",
                    "description": "Tasty vegan idli sambar",
                    "priceRange": "budget",
                    "createdAt": {"toDate": "2026-10-01T10:00:00Z"},
                }
            },
            {
                "id": "published-001",
                "data": {
                    "name": "SSGMCE College Canteen",
                    "placeType": "canteen",
                    "address": "Engineering Campus, Shegaon",
                    "latitude": 20.794,
                    "longitude": 76.695,
                    "dietTags": ["vegetarian", "vegan"],
                    "status": "published",
                    "verificationStatus": "verified",
                    "lastVerifiedAt": {"toDate": "2026-06-01T10:00:00Z"},  # > 90 days ago
                    "source": "fieldwork",
                    "submittedBy": "admin-001",
                    "submittedByName": "Admin",
                    "createdAt": {"toDate": "2026-06-01T10:00:00Z"},
                }
            }
        ]

        stub_reports = [
            {
                "id": "report-001",
                "data": {
                    "placeId": "published-001",
                    "reporterId": "user-456",
                    "reason": "wrong-diet-info",
                    "description": "Butter used in evening snacks",
                    "status": "pending",
                    "createdAt": {"toDate": "2026-10-10T08:00:00Z"}
                }
            }
        ]

        stub_reviews = [
            {
                "id": "review-001",
                "data": {
                    "placeId": "published-001",
                    "userId": "user-456",
                    "authorName": "Priya",
                    "rating": 5,
                    "comment": "Great vegan options available here",
                    "createdAt": {"toDate": "2026-10-05T12:00:00Z"}
                }
            }
        ]

        stub_users = [
            {"id": "admin-001", "data": admin_profile},
            {"id": "user-regular-001", "data": stub_profile}
        ]

        init_script = (
            "window.__STUB_USER__ = " + json.dumps(admin_user) + ";"
            "window.__STUB_PROFILE__ = " + json.dumps(admin_profile) + ";"
            "window.__STUB_PLACES_DOCS__ = " + json.dumps(stub_places) + ";"
            "window.__STUB_REPORTS_DOCS__ = " + json.dumps(stub_reports) + ";"
            "window.__STUB_REVIEWS_DOCS__ = " + json.dumps(stub_reviews) + ";"
            "window.__STUB_USERS_DOCS__ = " + json.dumps(stub_users) + ";"
            """
            function fixDates(arr) {
                if (!arr) return;
                arr.forEach(function (d) {
                    if (d.data.createdAt && typeof d.data.createdAt === 'object' && d.data.createdAt.toDate) {
                        var iso = d.data.createdAt.toDate;
                        d.data.createdAt = { toDate: function () { return new Date(iso); } };
                    }
                    if (d.data.lastVerifiedAt && typeof d.data.lastVerifiedAt === 'object' && d.data.lastVerifiedAt.toDate) {
                        var iso2 = d.data.lastVerifiedAt.toDate;
                        d.data.lastVerifiedAt = { toDate: function () { return new Date(iso2); } };
                    }
                });
            }
            fixDates(window.__STUB_PLACES_DOCS__);
            fixDates(window.__STUB_REPORTS_DOCS__);
            fixDates(window.__STUB_REVIEWS_DOCS__);
            """
        )
        page.add_init_script(init_script)

        page.goto(BASE_URL + "/admin/dashboard.html", wait_until="networkidle")
        page.wait_for_timeout(800)

        main_visible = page.locator("#adminMainContent").is_visible()
        unauth_hidden = not page.locator("#adminUnauthorizedScreen").is_visible()
        log("Admin: main dashboard is visible", main_visible)
        log("Admin: unauthorized screen is hidden", unauth_hidden)

        identity = page.locator("#adminUserIdentity").inner_text()
        log("Admin: user identity correctly displayed", "Prof. Administrator" in identity)

        # -------------------------------------------------------------
        # 5. Live overview stats
        # -------------------------------------------------------------
        print("\n=== Scenario 5: Live overview stats ===")
        pending_stat = page.locator("#statPending").inner_text()
        published_stat = page.locator("#statPublished").inner_text()
        reports_stat = page.locator("#statReports").inner_text()
        reviews_stat = page.locator("#statReviews").inner_text()
        users_stat = page.locator("#statUsers").inner_text()

        log("Stats: pending places count is 1", pending_stat == "1", f"got {pending_stat}")
        log("Stats: published places count is 1", published_stat == "1", f"got {published_stat}")
        log("Stats: reports count is 1", reports_stat == "1", f"got {reports_stat}")
        log("Stats: reviews count is 1", reviews_stat == "1", f"got {reviews_stat}")
        log("Stats: users count is 2", users_stat == "2", f"got {users_stat}")

        # -------------------------------------------------------------
        # 6. Pending Submissions Queue
        # -------------------------------------------------------------
        print("\n=== Scenario 6: Pending submissions moderation queue ===")
        pending_row = page.locator("#pending-row-pending-001")
        log("Pending queue: submitted place row rendered", pending_row.is_visible())

        row_text = pending_row.inner_text()
        log("Pending queue: place name displayed", "Submitted Dosa Corner" in row_text)
        log("Pending queue: submitter name displayed", "Rahul S." in row_text)
        log("Pending queue: approve and reject buttons present", "Approve" in row_text and "Reject" in row_text)

        # -------------------------------------------------------------
        # 7. Absence of mock records
        # -------------------------------------------------------------
        print("\n=== Scenario 7: Absence of mock records in production path ===")
        page_html = page.content()
        log("Mock data absent: mock-data.js not loaded", "mock-data.js" not in page_html)
        log("Mock data absent: MOCK_PLACES not referenced", "MOCK_PLACES" not in page_html)

        context.close()
        browser.close()


if __name__ == "__main__":
    run_admin_browser_tests()
    if not summary():
        sys.exit(1)
