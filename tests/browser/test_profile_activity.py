"""Profile activity UI must distinguish empty Firestore results from query errors."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import BASE_URL, LocalFrontendServer, log, make_route_handler  # noqa: E402

from playwright.sync_api import sync_playwright

route_handler = make_route_handler()


def init_script(collection_error=None):
    profile = {
        "name": "Test Member",
        "email": "member@example.test",
        "dietPreference": "vegan",
    }
    parts = [
        'window.__STUB_USER__ = {"uid":"member-1","email":"member@example.test","displayName":"Test Member"};',
        "window.__STUB_PROFILE__ = " + json.dumps(profile) + ";",
        "window.__STUB_PLACES_DOCS__ = [];",
        "window.__STUB_REVIEWS_DOCS__ = [];",
    ]
    if collection_error:
        parts.append(
            "window.__STUB_COLLECTION_THROW__ = {collection: "
            + json.dumps(collection_error["collection"])
            + ", error: Object.assign(new Error("
            + json.dumps(collection_error["message"])
            + "), "
            + json.dumps(collection_error)
            + ")};"
        )
    return "".join(parts)


def run_case(browser, collection_error=None):
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    page = context.new_page()
    page.route("**/*", route_handler)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.add_init_script(init_script(collection_error))
    page.goto(BASE_URL + "/profile.html", wait_until="load")
    page.wait_for_function(
        "() => document.getElementById('profileLoading').classList.contains('d-none')"
        " && document.getElementById('profileName').textContent === 'Test Member'"
    )
    page.wait_for_timeout(150)
    submissions = page.locator("#mySubmissionsList").text_content() or ""
    reviews = page.locator("#myReviewsList").text_content() or ""
    return context, page, errors, submissions, reviews


def main():
    with LocalFrontendServer():
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()

            context, page, errors, submissions, reviews = run_case(
                browser, {"collection": "places", "message": "network unavailable", "code": "unavailable"}
            )
            log("profile: submission query failure is shown as an error, not empty history",
                "Unable to load submissions" in submissions, submissions)
            log("profile: independent successful empty reviews query still shows the empty state",
                "haven't written any reviews" in reviews, reviews)
            log("profile: no uncaught page errors on submission-query failure", len(errors) == 0, str(errors))
            context.close()

            context, page, errors, submissions, reviews = run_case(
                browser, {"collection": "reviews", "message": "permission denied", "code": "permission-denied"}
            )
            log("profile: successful empty submissions query shows the empty state",
                "haven't submitted any places" in submissions, submissions)
            log("profile: review query failure is shown as an error, not empty history",
                "Unable to load reviews" in reviews, reviews)
            log("profile: no uncaught page errors on review-query failure", len(errors) == 0, str(errors))
            context.close()
            browser.close()


if __name__ == "__main__":
    main()
