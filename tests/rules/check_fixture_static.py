"""
Static check (no emulator, no network): the rules-test fixture must satisfy the place
create rule in firebase/firestore.rules. This catches a fixture that drifts from the rules
(for example a missing priceRange) without running the emulator.

It proves ONLY that the fixture's values are consistent with the rule text. It does NOT run
the rules, so it is not a substitute for tests/rules/firestore.rules.test.mjs in the emulator.

Second responsibility, rule-file selection wiring (also static, also not the emulator): the
proposed suite must load firebase/firestore.rules.proposed and the current suite must load
firebase/firestore.rules. An earlier harness hardcoded one path that both suites imported, so
the "proposed" suite silently tested the ACTIVE rules. This check confirms from the source text
that (a) makeEnv() has no default and rejects anything but "current"/"proposed", (b) each name
maps to the right file, and (c) each suite passes its own name. It cannot prove the emulator
actually loads what the code asks for; the console line `[tests/rules] loaded "..." rules from ...`
printed on every real run is the runtime evidence of that.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RULES = (ROOT / "firebase" / "firestore.rules").read_text(encoding="utf-8")
FIXTURE = (ROOT / "tests" / "rules" / "common.mjs").read_text(encoding="utf-8")

def list_in(helper):
    m = re.search(r"function %s\(value\)\s*\{\s*return value in \[([^\]]*)\]" % helper, RULES)
    assert m, f"could not find {helper} in the rules"
    return set(re.findall(r'"([^"]+)"', m.group(1)))

def bounds(name):
    m = re.search(r"lat >= (-?[\d.]+) && lat <= (-?[\d.]+)", RULES)
    n = re.search(r"lon >= (-?[\d.]+) && lon <= (-?[\d.]+)", RULES)
    assert m and n, "could not read coordinate bounds from the rules"
    return (float(m.group(1)), float(m.group(2)), float(n.group(1)), float(n.group(2)))

fn = re.search(r"export function communityPlace\(submittedBy, overrides = \{\}\) \{\s*return \{(.*?)\n  \};", FIXTURE, re.S)
assert fn, "could not find communityPlace() in common.mjs"
body = fn.group(1)

def field(name):
    m = re.search(r"\b%s:\s*(\"[^\"]*\"|[-\d.]+|[^,\n]+)" % name, body)
    return None if m is None else m.group(1).strip().strip('"')

problems = []
for key in ["name", "placeType", "address", "latitude", "longitude", "dietTags", "priceRange",
            "status", "verificationStatus", "source", "submittedBy"]:
    if field(key) is None:
        problems.append(f"fixture is missing required field '{key}'")

checks = {
    "placeType": field("placeType") in list_in("isValidPlaceType"),
    "priceRange": field("priceRange") in list_in("isValidPriceRange"),
    "status": field("status") == "pending",
    "verificationStatus": field("verificationStatus") == "unverified",
    "source": field("source") == "community",
}
for k, ok in checks.items():
    if not ok:
        problems.append(f"fixture value for '{k}' is not accepted by the rules")

lat_lo, lat_hi, lon_lo, lon_hi = bounds(None)
try:
    lat, lon = float(field("latitude")), float(field("longitude"))
    if not (lat_lo <= lat <= lat_hi and lon_lo <= lon <= lon_hi):
        problems.append("fixture coordinates fall outside the rules' pilot box")
except (TypeError, ValueError):
    problems.append("fixture coordinates are not numbers")

tags = re.findall(r'"([a-z]+)"', re.search(r"dietTags:\s*\[([^\]]*)\]", body).group(1))
allowed = {"vegan", "vegetarian", "eggetarian", "jain"}
if not tags or not set(tags) <= allowed:
    problems.append("fixture dietTags are not all accepted by the rules")

# ---- rule-file selection wiring ----
TESTS = ROOT / "tests" / "rules"
sel = []
files_block = re.search(r"export const RULES_FILES = \{(.*?)\};", FIXTURE, re.S)
if not files_block:
    sel.append("common.mjs no longer exports RULES_FILES (explicit file selection removed)")
else:
    fb = files_block.group(1)
    if not re.search(r'current:\s*new URL\("\.\./\.\./firebase/firestore\.rules"', fb):
        sel.append("RULES_FILES.current does not point at firebase/firestore.rules")
    if not re.search(r'proposed:\s*new URL\("\.\./\.\./firebase/firestore\.rules\.proposed"', fb):
        sel.append("RULES_FILES.proposed does not point at firebase/firestore.rules.proposed")
if not re.search(r'which !== "current" && which !== "proposed"', FIXTURE):
    sel.append("makeEnv() no longer rejects an unknown or missing rules-file name (a silent default is back)")
if not (ROOT / "firebase" / "firestore.rules.proposed").exists():
    sel.append("firebase/firestore.rules.proposed does not exist")
for name, want in {"firestore.rules.test.mjs": "current", "firestore.rules.proposed.test.mjs": "proposed"}.items():
    text = (TESTS / name).read_text(encoding="utf-8")
    calls = [c.strip() for c in re.findall(r"makeEnv\(([^)]*)\)", text)]
    if '"%s"' % want not in calls:
        sel.append('%s does not call makeEnv("%s")' % (name, want))
    if any(c != '"%s"' % want for c in calls):
        sel.append('%s contains a makeEnv() call other than makeEnv("%s"): %s' % (name, want, calls))
problems.extend(sel)

if problems:
    print("FAIL - rules fixture or rule-file selection is inconsistent:")
    for p in problems:
        print("   ", p)
    sys.exit(1)
print("PASS - rules fixture matches the place create rule, and each rules suite is wired to its own rules file (static checks; emulator tests not run)")
