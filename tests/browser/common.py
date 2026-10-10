"""
VeganSaathi — tests/browser/common.py
==============================================================================
Shared helpers for every Playwright-based browser test suite in tests/browser/.
Not a test file itself — imported by test_*.py files.

Responsibilities:
  - Serve frontend/ pages with CDN requests (Bootstrap, Leaflet, the Firebase
    SDK) redirected to the local, offline stub-assets/ — this project's test
    environment has no outbound network access, so the real CDNs and the
    real Firebase backend are unreachable here. These are TEST-ONLY stubs;
    the real deployed site loads the real CDN files and talks to the real
    Firebase project exactly as written in each page's own <script> tags.
  - Strip Leaflet's Subresource Integrity attributes before serving HTML, so
    the stub Leaflet file (which won't match the real file's hash) isn't
    blocked by the browser's own SRI check. This never touches the actual
    repo files on disk — only the in-memory response served to the test
    browser.

Run any test_*.py file directly with `python3 test_explore_firestore.py`
(it starts its own local server and browser internally) — see
tests/browser/README.md for details and prerequisites.
"""

import re
import subprocess
import time
from pathlib import Path

TESTS_BROWSER_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = TESTS_BROWSER_DIR.parent.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"
STUB_DIR = TESTS_BROWSER_DIR / "stub-assets"

DEFAULT_PORT = 8111
BASE_URL = f"http://127.0.0.1:{DEFAULT_PORT}"


def strip_sri(html: str) -> str:
    for tag in ("link", "script"):
        html = re.sub(r'(<%s[^>]*unpkg\.com/leaflet[^>]*?)\s+integrity="[^"]*"' % tag, r"\1", html)
        html = re.sub(r'(<%s[^>]*unpkg\.com/leaflet[^>]*?)\s+crossorigin="[^"]*"' % tag, r"\1", html)
    return html


def make_route_handler(base_url: str = BASE_URL):
    """Returns a Playwright route handler bound to the given base URL."""

    def route_handler(route):
        url = route.request.url
        path_only = url.split("?")[0]

        if url.startswith(base_url) and path_only.endswith(".html"):
            rel = path_only[len(base_url) + 1:] or "index.html"
            fp = FRONTEND_DIR / rel
            if fp.exists():
                route.fulfill(status=200, content_type="text/html; charset=utf-8", body=strip_sri(fp.read_text()))
                return
            route.continue_()
        elif "bootstrap.min.css" in url:
            route.fulfill(path=str(STUB_DIR / "bootstrap.min.css"), content_type="text/css")
        elif "bootstrap.bundle.min.js" in url:
            route.fulfill(path=str(STUB_DIR / "bootstrap.bundle.min.js"), content_type="application/javascript")
        elif "unpkg.com/leaflet" in url and url.endswith(".css"):
            route.fulfill(path=str(STUB_DIR / "leaflet-stub.css"), content_type="text/css")
        elif "unpkg.com/leaflet" in url and url.endswith(".js"):
            route.fulfill(path=str(STUB_DIR / "leaflet-stub.js"), content_type="application/javascript")
        elif "tile.openstreetmap.org" in url:
            route.fulfill(status=204, body="")
        elif "gstatic.com/firebasejs" in url:
            name = url.split("/")[-1]  # e.g. "firebase-firestore.js"
            stub_name = name.replace(".js", ".browser-stub.js")
            stub_path = STUB_DIR / stub_name
            if stub_path.exists():
                route.fulfill(status=200, content_type="application/javascript", body=stub_path.read_text())
            else:
                route.fulfill(status=404, body="no browser stub for " + name)
        else:
            route.continue_()

    return route_handler


class LocalFrontendServer:
    """Context manager: starts `python3 -m http.server` over frontend/, stops it on exit."""

    def __init__(self, port: int = DEFAULT_PORT):
        self.port = port
        self._proc = None

    def __enter__(self):
        self._proc = subprocess.Popen(
            ["python3", "-m", "http.server", str(self.port), "--bind", "127.0.0.1"],
            cwd=str(FRONTEND_DIR),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        time.sleep(1)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._proc:
            self._proc.terminate()
            self._proc.wait(timeout=5)


_passed = 0
_failed = 0


def log(name, ok, detail=""):
    global _passed, _failed
    if ok:
        _passed += 1
    else:
        _failed += 1
    print(("PASS" if ok else "FAIL") + " - " + name + ((" :: " + detail) if detail and not ok else ""))


def summary():
    print("\n" + str(_passed) + " passed, " + str(_failed) + " failed")
    return _failed == 0
