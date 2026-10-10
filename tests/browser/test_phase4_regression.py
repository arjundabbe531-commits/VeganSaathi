"""
VeganSaathi — tests/browser/test_phase4_regression.py
==============================================================================
The Phase 4 (Authentication + User Profile) regression suite. Ported here
from ad-hoc verification so it's a real, re-runnable project artifact rather
than something that only ever existed in a throwaway scratch file.

Run directly:  python3 tests/browser/test_phase4_regression.py
Prerequisites: Playwright with a Chromium browser installed
               (`pip install playwright && playwright install chromium`).
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import BASE_URL, LocalFrontendServer, log, make_route_handler, summary  # noqa: E402

from playwright.sync_api import sync_playwright

route_handler = make_route_handler()


def run_scenario(browser, label, stub_user, stub_profile):
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    page = context.new_page()
    page.route("**/*", route_handler)

    init_script = "window.__STUB_USER__ = " + json.dumps(stub_user) + ";"
    if stub_profile is not None:
        init_script += "window.__STUB_PROFILE__ = " + json.dumps(stub_profile) + ";"
    # Task 5.5 made place-details.html Firestore-backed (fetchPlaceById()) —
    # this suite's place-details.html?id=mock-001 visit below needs a
    # matching stub document now, or the page correctly (and uselessly, for
    # these Auth-focused checks) shows its "not found" state instead of any
    # content at all. Kept minimal; not meant to exercise Task 5.5 itself —
    # see test_place_details_firestore.py for that.
    init_script += (
        "window.__STUB_PLACES_DOCS__ = [{"
        "  id: 'mock-001',"
        "  data: {"
        "    name: 'Stub Place For Auth Tests', placeType: 'cafe', address: 'Test Address, Shegaon',"
        "    latitude: 20.79, longitude: 76.69, dietTags: ['vegan'], status: 'published',"
        "    verificationStatus: 'unverified', source: 'fieldwork', submittedBy: 'uid-test', submittedByName: 'Tester',"
        "    createdAt: { toDate: function () { return new Date('2026-09-01T12:00:00Z'); } },"
        "    updatedAt: { toDate: function () { return new Date('2026-09-01T12:00:00Z'); } }"
        "  }"
        "}];"
    )
    page.add_init_script(init_script)

    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

    print("\n=== Scenario: " + label + " ===")

    # ---- Home: navbar state ----
    page.goto(BASE_URL + "/index.html", wait_until="load")
    page.wait_for_timeout(300)
    if stub_user:
        log(label + " / Home: navbar shows Profile+Logout", page.query_selector("#navLogoutBtn") is not None)
        log(label + " / Home: navbar does NOT show Login link", page.query_selector('a[href="login.html"]') is None)
    else:
        log(label + " / Home: navbar shows Login+Register", page.query_selector('a[href="login.html"]') is not None)
        log(label + " / Home: navbar does NOT show Logout", page.query_selector("#navLogoutBtn") is None)

    # ---- Profile page ----
    page.goto(BASE_URL + "/profile.html", wait_until="load")
    page.wait_for_timeout(300)
    if stub_user:
        content_visible = page.eval_on_selector("#profileContent", "el => !el.classList.contains('d-none')")
        log(label + " / Profile: real content shown when signed in", content_visible)
        if stub_profile:
            name_text = page.eval_on_selector("#profileName", "el => el.textContent")
            log(label + " / Profile: shows correct stub name", name_text == stub_profile["name"], name_text)
    else:
        signed_out_visible = page.eval_on_selector("#profileSignedOut", "el => !el.classList.contains('d-none')")
        log(label + " / Profile: sign-in prompt shown when signed out", signed_out_visible)

    # ---- Saved page ----
    page.goto(BASE_URL + "/saved.html", wait_until="load")
    page.wait_for_timeout(300)
    if stub_user:
        signed_in_visible = page.eval_on_selector("#savedSignedIn", "el => !el.classList.contains('d-none')")
        log(label + " / Saved: content shown when signed in", signed_in_visible)
    else:
        signed_out_visible = page.eval_on_selector("#savedSignedOut", "el => !el.classList.contains('d-none')")
        log(label + " / Saved: sign-in prompt shown when signed out", signed_out_visible)

    # ---- Submit Place guard ----
    page.goto(BASE_URL + "/submit-place.html", wait_until="load")
    page.wait_for_timeout(300)
    btn_disabled = page.eval_on_selector("#submitPlaceBtn", "el => el.disabled")
    if stub_user:
        log(label + " / Submit Place: submit button enabled when signed in", not btn_disabled)
    else:
        log(label + " / Submit Place: submit button disabled when signed out", btn_disabled)
        note_visible = page.eval_on_selector("#submitPlaceAuthNote", "el => !el.classList.contains('d-none')")
        log(label + " / Submit Place: sign-in note visible when signed out", note_visible)

    # ---- Place Details guards ----
    page.goto(BASE_URL + "/place-details.html?id=mock-001", wait_until="load")
    page.wait_for_timeout(400)
    save_disabled = page.eval_on_selector("#saveBtn", "el => el.disabled")
    review_disabled = page.eval_on_selector('#reviewForm button[type="submit"]', "el => el.disabled")
    report_disabled = page.eval_on_selector('#reportForm button[type="submit"]', "el => el.disabled")
    if stub_user:
        log(label + " / Place Details: Save/Review/Report enabled when signed in",
            not save_disabled and not review_disabled and not report_disabled)
        text_before = page.eval_on_selector("#saveBtn", "el => el.textContent")
        page.click("#saveBtn")
        page.wait_for_timeout(100)
        text_after = page.eval_on_selector("#saveBtn", "el => el.textContent")
        log(label + " / Place Details: Save button toggles when signed in", text_before != text_after,
            text_before + " -> " + text_after)

        page.select_option("#reviewRating", "5")
        page.fill("#reviewComment", "Great vegan thali here.")
        page.click('#reviewForm button[type="submit"]')
        page.wait_for_timeout(150)
        review_msg = page.eval_on_selector("#reviewFeedback", "el => el.textContent")
        log(label + " / Place Details: signed-in review submit reaches Phase-6 demo message",
            "later phase" in review_msg and "sign in" not in review_msg.lower(), review_msg)

        page.select_option("#reportReason", "outdated")
        page.click('#reportForm button[type="submit"]')
        page.wait_for_timeout(150)
        report_msg = page.eval_on_selector("#reportFeedback", "el => el.textContent")
        log(label + " / Place Details: signed-in report submit reaches Phase-6 demo message",
            "later phase" in report_msg and "sign in" not in report_msg.lower(), report_msg)
    else:
        log(label + " / Place Details: Save/Review/Report disabled when signed out",
            save_disabled and review_disabled and report_disabled)

    # ---- Logout (only meaningful when starting signed in) ----
    if stub_user:
        page.goto(BASE_URL + "/index.html", wait_until="load")
        page.wait_for_timeout(300)
        page.click("#navLogoutBtn")
        page.wait_for_timeout(300)
        signout_called = page.evaluate("window.__STUB_SIGNOUT_CALLED__ === true")
        log(label + " / Logout: signOut() was actually called", signout_called)
        navbar_flipped = page.query_selector('a[href="login.html"]') is not None and page.query_selector("#navLogoutBtn") is None
        log(label + " / Logout: navbar flips to logged-out LIVE (no reload)", navbar_flipped)

    log(label + " / no uncaught page errors across this scenario", len(errors) == 0, str(errors))
    real_console_errors = [e for e in console_errors if "favicon" not in e.lower()]
    log(label + " / no console errors across this scenario", len(real_console_errors) == 0, str(real_console_errors))

    context.close()


def main():
    with LocalFrontendServer():
        with sync_playwright() as p:
            browser = p.chromium.launch()
            run_scenario(browser, "SIGNED-OUT", None, None)
            run_scenario(browser, "SIGNED-IN", {"uid": "stub-uid-1", "email": "stub@example.com"},
                         {"name": "Stub Test User", "email": "stub@example.com", "dietPreference": "vegan", "role": "user"})

            # Edge case: a Firebase Auth user exists but has no Firestore profile doc.
            context = browser.new_context(viewport={"width": 1280, "height": 900})
            page = context.new_page()
            page.route("**/*", route_handler)
            page.add_init_script("window.__STUB_USER__ = " + json.dumps({"uid": "orphan-uid", "email": "orphan@example.com"}) + ";")
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(BASE_URL + "/profile.html", wait_until="load")
            page.wait_for_timeout(400)
            error_visible = page.eval_on_selector("#profileError", "el => !el.classList.contains('d-none')")
            error_text = page.eval_on_selector("#profileError", "el => el.textContent") if error_visible else ""
            log("EDGE CASE / Profile: missing-Firestore-profile shows explicit error, not blank fields",
                error_visible and "no profile information" in error_text, error_text)
            log("EDGE CASE / no uncaught page errors", len(errors) == 0, str(errors))
            context.close()

            # Regression test for the profileError-not-cleared-on-signout fix.
            context = browser.new_context(viewport={"width": 1280, "height": 900})
            page = context.new_page()
            page.route("**/*", route_handler)
            page.add_init_script("window.__STUB_USER__ = " + json.dumps({"uid": "orphan-uid-2", "email": "orphan2@example.com"}) + ";")
            fix_errors = []
            page.on("pageerror", lambda e: fix_errors.append(str(e)))
            page.goto(BASE_URL + "/profile.html", wait_until="load")
            page.wait_for_timeout(400)
            error_shown_before = page.eval_on_selector("#profileError", "el => !el.classList.contains('d-none')")
            log("ERROR-CLEAR FIX / error shown for signed-in orphan user (precondition)", error_shown_before)
            page.evaluate("import('./js/auth-ui.js').then(m => m.logoutUser())")
            page.wait_for_timeout(300)
            error_shown_after = page.eval_on_selector("#profileError", "el => !el.classList.contains('d-none')")
            signed_out_shown = page.eval_on_selector("#profileSignedOut", "el => !el.classList.contains('d-none')")
            log("ERROR-CLEAR FIX / profileError is hidden after sign-out", not error_shown_after)
            log("ERROR-CLEAR FIX / signed-out prompt shown instead", signed_out_shown)
            log("ERROR-CLEAR FIX / no uncaught page errors", len(fix_errors) == 0, str(fix_errors))
            context.close()

            # Registration / Login / Google sign-in flows.
            context = browser.new_context(viewport={"width": 1280, "height": 900})
            page = context.new_page()
            page.route("**/*", route_handler)
            page.add_init_script("window.__STUB_USER__ = null;")
            flow_errors = []
            page.on("pageerror", lambda e: flow_errors.append(str(e)))

            page.goto(BASE_URL + "/register.html", wait_until="load")
            page.wait_for_timeout(200)
            page.fill("#registerName", "Test Student")
            page.fill("#registerEmail", "teststudent@example.com")
            page.fill("#registerPassword", "abcdef")
            page.fill("#registerConfirm", "abcdef")
            page.select_option("#registerDiet", "jain")
            page.click('#registerForm button[type="submit"]')
            page.wait_for_timeout(300)
            reg_msg = page.eval_on_selector("#registerFeedback", "el => el.textContent")
            log("AUTH FLOW / Register: success message shown", "successful" in reg_msg.lower(), reg_msg)
            writes = page.evaluate("window.__STUB_WRITES__ || []")
            wrote_user_doc = any("users/" in w["path"] for w in writes)
            log("AUTH FLOW / Register: Firestore users/{uid} write attempted", wrote_user_doc, json.dumps(writes))
            if writes:
                written_role = writes[0]["data"].get("role")
                written_diet = writes[0]["data"].get("dietPreference")
                log("AUTH FLOW / Register: role hard-coded to 'user' (never client-chosen)", written_role == "user", str(written_role))
                log("AUTH FLOW / Register: dietPreference field written correctly", written_diet == "jain", str(written_diet))

            page.goto(BASE_URL + "/login.html", wait_until="load")
            page.wait_for_timeout(200)
            page.fill("#loginEmail", "teststudent@example.com")
            page.fill("#loginPassword", "abcdef")
            page.click('#loginForm button[type="submit"]')
            page.wait_for_timeout(300)
            login_msg = page.eval_on_selector("#loginFeedback", "el => el.textContent")
            log("AUTH FLOW / Login: success message shown", "successful" in login_msg.lower(), login_msg)

            page.goto(BASE_URL + "/login.html", wait_until="load")
            page.wait_for_timeout(200)
            google_btn_text = page.eval_on_selector("#googleSignInButton", "el => el.textContent.trim()")
            log("AUTH FLOW / Login: Google button no longer shows stale 'coming in Phase 4' text", "Phase 4" not in google_btn_text, google_btn_text)
            google_btn_disabled = page.eval_on_selector("#googleSignInButton", "el => el.disabled")
            log("AUTH FLOW / Login: Google button not disabled by default", not google_btn_disabled)
            page.click("#googleSignInButton")
            page.wait_for_timeout(300)
            google_msg = page.eval_on_selector("#loginFeedback", "el => el.textContent")
            log("AUTH FLOW / Google sign-in: success message shown", "google" in google_msg.lower() and "successful" in google_msg.lower(), google_msg)

            log("AUTH FLOW / no uncaught page errors across register/login/google", len(flow_errors) == 0, str(flow_errors))
            context.close()

            browser.close()

    ok = summary()
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
