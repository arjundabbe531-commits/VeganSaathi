# Firestore security-rules tests

These tests run the real `firebase/firestore.rules` inside the **Firestore emulator**.
They never contact the live project. They are NOT part of `tests/run_all.sh`.

**Status in the integration sandbox: NOT RUN.** The sandbox has Java 21 but no Firebase CLI
and no network access, so the emulator and the test libraries could not be installed. No
result from these tests has been recorded as passing.

## Files

| File | What it asserts | Expected result on the current rules |
|---|---|---|
| `firestore.rules.test.mjs` | Current behaviour: who can read and write what, plus documented GAP tests that assert today's permissive behaviour | **All pass** |
| `firestore.rules.proposed.test.mjs` | The proposals R1–R3 in `docs/proposals/firestore-rules-batch6.md` | **Expected to FAIL** until the proposal is applied |
| `common.mjs` | Shared setup and a valid community place document | — |

## One-time setup (Windows PowerShell, from the project root)

1. Install **Java 11 or later** (the emulator needs it). Check with `java -version`.
2. Install the Firebase CLI:

       npm install -g firebase-tools

3. Install the test libraries, pinned in `tests\rules\package.json`:

       cd tests\rules
       npm install
       cd ..\..

4. Check the installed versions match. `@firebase/rules-unit-testing` declares which
   `firebase` major version it supports. Run:

       npm view @firebase/rules-unit-testing peerDependencies

   If the `firebase` version in `tests\rules\package.json` does not satisfy that peer range,
   change it to match and run `npm install` again.

## Run

From the project root, one command starts the emulator, runs the tests and stops it:

    firebase emulators:exec --only firestore --project vegansaathi-rules-test "node --test tests/rules/firestore.rules.test.mjs"

Then the proposals (expected to fail until applied):

    firebase emulators:exec --only firestore --project vegansaathi-rules-test "node --test tests/rules/firestore.rules.proposed.test.mjs"

The port is set to 8080 in `firebase.json` under `emulators`. If port 8080 is in use, change it
there.

## How to read the result

- A passing test means the rule behaved as the test states. A failing test means either the rule
  is wrong or the test's expectation is wrong. Decide which by reading the rule and the schema.
- Do not count a test as passing until you have seen it pass in the emulator run. Record the date,
  the command, the exit code and the counts in `docs/TEST_RESULTS.md`.
- Passing these tests does not prove that the DEPLOYED rules match this file. Check that
  separately in the Firebase Console.

## What these tests do and do not prove

- Prove: the rules file, as written, refuses or allows the listed reads and writes in the emulator.
- Do not prove: anything about the live project, its deployed rules, real browsers, or Firebase
  Authentication behaviour beyond the `auth` identities the emulator simulates.
