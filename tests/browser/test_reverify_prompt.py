"""
VeganSaathi — tests/browser/test_reverify_prompt.py
==============================================================================
Browser test for the re-verification flow on admin/dashboard.html. It drives the real
two-prompt sequence (note, then visit date) through Playwright's dialog handler, then
checks what the dashboard actually writes to the stubbed Firestore.

Tier: BROWSER TEST WITH STUBBED SERVICES. It proves the dashboard's prompt handling and its
payload to the service layer. It does not prove the live project accepts the write, and it
does not run the security rules (those are in tests/rules/).

Run:  python3 tests/browser/test_reverify_prompt.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import BASE_URL, LocalFrontendServer, log, make_route_handler, summary  # noqa: E402

from playwright.sync_api import sync_playwright

route_handler = make_route_handler()

INIT = """
window.__STUB_USER__ = { uid: "admin-1", email: "admin@ssgmce.ac.in" };
window.__STUB_PROFILE__ = { name: "Prof. Administrator", email: "admin@ssgmce.ac.in", role: "admin", dietPreference: "vegan" };
window.__STUB_PLACES_DOCS__ = [{
  id: "pub-1",
  data: {
    name: "Test Mess", placeType: "mess", address: "Station Road, Shegaon",
    latitude: 20.79, longitude: 76.69, dietTags: ["vegan"], priceRange: "budget",
    status: "published", verificationStatus: "unverified", source: "fieldwork",
    submittedBy: "uid-x", submittedByName: "Tester",
    createdAt: { toDate: function () { return new Date("2026-09-01T12:00:00Z"); } },
    updatedAt: { toDate: function () { return new Date("2026-09-01T12:00:00Z"); } }
  }
}];
"""


def run_flow(browser, answers):
    """answers: list of strings to accept, or None to dismiss (cancel), in prompt order.
    Returns (updates, alert_text, prompts_seen)."""
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    pg = ctx.new_page()
    pg.route("**/*", route_handler)
    pg.add_init_script(INIT)
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    queue = list(answers)
    prompts = []

    def on_dialog(dialog):
        prompts.append(dialog.message)
        answer = queue.pop(0) if queue else None
        if answer is None:
            dialog.dismiss()
        else:
            dialog.accept(answer)

    pg.on("dialog", on_dialog)
    pg.goto(BASE_URL + "/admin/dashboard.html", wait_until="networkidle")
    pg.wait_for_timeout(500)
    pg.click('button[data-bs-target="#tab-verification"]')
    pg.wait_for_timeout(600)
    pg.click(".btn-reverify-place")
    pg.wait_for_timeout(700)
    updates = pg.evaluate("""() => (window.__STUB_UPDATES__ || []).map(u => ({
        path: u.path,
        verificationStatus: u.data.verificationStatus,
        verifiedBy: u.data.verifiedBy,
        note: u.data.verificationNote,
        y: u.data.lastVerifiedAt && u.data.lastVerifiedAt.getFullYear ? u.data.lastVerifiedAt.getFullYear() : null,
        m: u.data.lastVerifiedAt && u.data.lastVerifiedAt.getMonth ? u.data.lastVerifiedAt.getMonth() + 1 : null,
        d: u.data.lastVerifiedAt && u.data.lastVerifiedAt.getDate ? u.data.lastVerifiedAt.getDate() : null
    }))""")
    alert = pg.inner_text("#adminAlert") if pg.locator("#adminAlert").count() else ""
    ctx.close()
    if errors:
        print("   page errors:", errors)
    return updates, alert, prompts, errors


def main():
    with LocalFrontendServer(), sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # 1. Normal valid flow: note, then a real past visit date.
        updates, alert, prompts, errors = run_flow(browser, ["Checked kitchen and menu", "2026-10-12"])
        log("valid flow: two prompts shown (note, then visit date)", len(prompts) == 2, str(prompts))
        log("valid flow: exactly one write to the place", len(updates) == 1 and updates[0]["path"].endswith("places/pub-1"), str(updates))
        if updates:
            u = updates[0]
            log("valid flow: place becomes verified", u["verificationStatus"] == "verified")
            log("valid flow: lastVerifiedAt is the entered visit date (2026-10-12)", (u["y"], u["m"], u["d"]) == (2026, 10, 12), str((u["y"], u["m"], u["d"])))
            log("valid flow: note recorded as typed", u["note"] == "Checked kitchen and menu", str(u["note"]))
            log("valid flow: verifier recorded", u["verifiedBy"] == "admin-1", str(u["verifiedBy"]))
        log("valid flow: success message shown", "marked as physically re-verified" in alert, alert)
        log("valid flow: no page errors", len(errors) == 0)

        # 2. Impossible calendar date refused, nothing written.
        updates, alert, prompts, _ = run_flow(browser, ["Checked kitchen", "2026-02-30"])
        log("impossible date (2026-02-30): refused, no write", len(updates) == 0, str(updates))
        log("impossible date: clear message", "not a real calendar date" in alert, alert)

        # 3. Future date refused, nothing written.
        updates, alert, prompts, _ = run_flow(browser, ["Checked kitchen", "2099-01-01"])
        log("future date (2099-01-01): refused, no write", len(updates) == 0, str(updates))
        log("future date: clear message", "cannot be in the future" in alert, alert)

        # 4. Wrong format refused, nothing written.
        updates, alert, prompts, _ = run_flow(browser, ["Checked kitchen", "15/10/2026"])
        log("wrong format (15/10/2026): refused, no write", len(updates) == 0, str(updates))
        log("wrong format: asks for YYYY-MM-DD", "YYYY-MM-DD" in alert, alert)

        # 5. Empty note: refused before the date prompt is even shown.
        updates, alert, prompts, _ = run_flow(browser, ["   "])
        log("whitespace-only note: refused, no write", len(updates) == 0, str(updates))
        log("whitespace-only note: date prompt never shown", len(prompts) == 1, str(prompts))
        log("whitespace-only note: clear message", "Enter what was checked" in alert, alert)

        # 6. Cancelling the date prompt writes nothing.
        updates, alert, prompts, _ = run_flow(browser, ["Checked kitchen", None])
        log("cancel at date prompt: no write", len(updates) == 0, str(updates))

        browser.close()

    ok = summary()
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
