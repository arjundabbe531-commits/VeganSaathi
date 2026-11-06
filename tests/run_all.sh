#!/usr/bin/env bash
# VeganSaathi — tests/run_all.sh
# Runs every automated suite and static check, prints exact pass/fail counts per
# suite, and exits non-zero if anything failed. Run from the project root:
#     bash tests/run_all.sh
#
# What these suites ARE: Node unit tests and headless-Chromium browser tests
# against STUBBED Firebase, Leaflet, and Cloudinary. They do NOT contact the real Firebase
# project, and they do NOT execute firestore.rules (the separate emulator suite
# in tests/rules/ does that and must be run locally — see tests/rules/README.md).
# Cloudinary integration uses pre-flight file validation, safe transformation URLs,
# and zero-failure offline simulation (see docs/CLOUDINARY_INTEGRATION.md).
#
# ---- Windows ----
# This is a bash script. Run it with one of:
#   - Git Bash (installed with Git for Windows): `bash tests/run_all.sh`
#   - WSL (Windows Subsystem for Linux): `bash tests/run_all.sh`
# It will NOT run directly in cmd.exe or plain PowerShell. If neither is
# available, run the wrapped commands one at a time — see "Equivalent PowerShell
# commands" at the bottom of this file.
#
# Prerequisites: Node 18+, Python 3 with Playwright + Chromium installed
# (`pip install playwright` then `playwright install chromium`). This script does
# NOT set PLAYWRIGHT_BROWSERS_PATH: Playwright already knows its own correct
# default location on Linux, macOS and Windows. An earlier version forced a
# Linux-only path (/opt/pw-browsers) as a fallback, which would stop Playwright
# finding its browser on any machine other than the build sandbox. If you installed
# the browsers somewhere custom, export PLAYWRIGHT_BROWSERS_PATH yourself first.

set -u
cd "$(dirname "$0")/.."
FAILED=0
SUMMARY=""

record() {  # name, exit_code, output_file
  local name="$1" code="$2" file="$3" pass fail
  pass=$(grep -c '^PASS' "$file" || true)
  fail=$(grep -c '^FAIL' "$file" || true)
  if [ "$code" -ne 0 ] || [ "$fail" -ne 0 ]; then FAILED=1; status="FAIL"; else status="PASS"; fi
  SUMMARY="${SUMMARY}$(printf '%-6s %-48s passed=%-4s failed=%s' "$status" "$name" "$pass" "$fail")\n"
  if [ "$status" = "FAIL" ]; then echo "---- failures in $name ----"; grep '^FAIL' "$file" | head -20; tail -5 "$file"; fi
}

# Scratch directory for THIS run's own output only — never under the project tree.
TMP="$(mktemp -d)"

# Node unit tests (stubbed SDK via tests/firebase-stub-loader.mjs)
for f in tests/test-*.mjs; do
  [ -e "$f" ] || continue
  node "$f" >"$TMP/out.txt" 2>&1; code=$?
  record "node $f" "$code" "$TMP/out.txt"
done

# Python data-pipeline unit tests (offline fixtures and mocked adapters).
python3 -m unittest tests.test_data_pipeline -v >"$TMP/out.txt" 2>&1; code=$?
if [ "$code" -eq 0 ]; then
  printf "PASS Python data-pipeline unit tests\n" >>"$TMP/out.txt"
else
  printf "FAIL Python data-pipeline unit tests\n" >>"$TMP/out.txt"
fi
record "python3 -m unittest tests.test_data_pipeline" "$code" "$TMP/out.txt"

# Static checks
node tests/check-duplicate-globals.js >"$TMP/out.txt" 2>&1; code=$?
record "node tests/check-duplicate-globals.js" "$code" "$TMP/out.txt"

# Rules fixture + rule-file-selection wiring (static text checks; NOT the emulator)
python3 tests/rules/check_fixture_static.py >"$TMP/out.txt" 2>&1; code=$?
record "python3 tests/rules/check_fixture_static.py" "$code" "$TMP/out.txt"

# Browser suites (stubbed services). PLAYWRIGHT_BROWSERS_PATH is used only if the
# caller already set it; it is never invented here.
for f in tests/browser/test_*.py; do
  [ -e "$f" ] || continue
  python3 "$f" >"$TMP/out.txt" 2>&1; code=$?
  record "python3 $f" "$code" "$TMP/out.txt"
done

# JavaScript syntax for every shipped and test JS/MJS file
bad=0
for f in frontend/js/*.js tests/*.js tests/*.mjs tests/node-firebase-stub/*.js tests/browser/stub-assets/firebase-*.js tests/browser/stub-assets/leaflet-stub.js; do
  [ -e "$f" ] || continue
  node --check "$f" >/dev/null 2>&1 || { echo "SYNTAX FAIL: $f"; bad=1; }
done
if [ $bad -ne 0 ]; then FAILED=1; SUMMARY="${SUMMARY}FAIL   node --check (see above)\n"; else SUMMARY="${SUMMARY}PASS   node --check on all JS/MJS files\n"; fi

echo
echo "================ SUMMARY ================"
printf "$SUMMARY"
echo "========================================="

# Cleanup, limited to what THIS script can generate:
#   - $TMP is this run's own mktemp directory.
#   - __pycache__ directories ONLY under tests/, the only place Python files exist
#     in this project. An earlier version ran `find .` from the project root and
#     would have deleted any __pycache__ anywhere beneath it, including directories
#     this script never created.
rm -rf "$TMP"
find tests -name '__pycache__' -type d -prune -exec rm -rf {} + 2>/dev/null

[ $FAILED -eq 0 ] && echo "ALL SUITES PASSED" || echo "SOME SUITES FAILED"
exit $FAILED

# ---- Equivalent PowerShell commands (or run powershell -ExecutionPolicy Bypass -File tests\run_all.ps1) ----
# node tests\test-places-service.mjs
# node tests\test-admin-service.mjs
# node tests\test-geolocation.mjs
# node tests\test-import-validator.mjs
# node tests\test-cloudinary-service.mjs
# node tests\test-controlled-integration.mjs
# node tests\check-duplicate-globals.js
# python tests\rules\check_fixture_static.py
# Get-ChildItem tests\browser\test_*.py | ForEach-Object { python $_.FullName }
# Get-ChildItem -Recurse -Include *.js,*.mjs frontend,tests,scripts | ForEach-Object { node --check $_.FullName }
# Remove-Item -Recurse -Force tests\browser\__pycache__, tests\rules\__pycache__ -ErrorAction SilentlyContinue
