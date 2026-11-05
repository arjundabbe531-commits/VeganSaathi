# GITHUB_SYNC_PLAN.md — syncing this project to the existing repository

**No Git operations have been performed.** This sandbox has no `.git` directory in this
working copy, and no push, commit, or remote operation has been attempted here, per every
prior instruction in this engagement. This document is guidance for the user's own machine,
not a record of anything already done.

## Where things stand

- The existing public repository is `github.com/arjundabbe531-commits/VeganSaathi`. An
  earlier session reported it returned 404 to this tool's read access; that has not been
  rechecked in this session.
- The last commit this project's docs refer to is `aedac7196ee48a45f06cdc3442effc4a05fd094c`,
  reported by an earlier task but not independently confirmed from this sandbox.
- This working copy (`VeganSaathi-Merged`) was built from an uploaded ZIP, not from a git
  clone, so it has no commit history of its own to push as-is.

## Before pushing anything

1. **On your own machine**, resolve the `D:\VeganSaathi-main\VeganSaathi-main` vs
   `D:\Downloads\VeganSaathi-main\VeganSaathi-main` path question (see
   `docs/INTEGRATION_REPORT.md` §10) — confirm which local folder is actually the one tracked
   by git, and whether it matches what's in this delivered ZIP.
2. **Run the full regression suite locally** (`bash tests/run_all.sh`, plus the Firestore
   Emulator suite) and confirm the same pass counts reported in `docs/TEST_RESULTS.md` before
   trusting this as the version to publish.
3. **Do not apply `firebase/firestore.rules.proposed`** as part of this sync unless the
   emulator tests for it have actually been run and recorded. Pushing code is safe; deploying
   unverified rules is not, and this plan does not cover deployment at all.

## Recommended sync approach

1. In your local, git-tracked copy of the project, replace the working files with the
   contents of this delivered archive, file by file — not a wholesale directory swap, so you
   can review the diff.
2. Review the diff yourself (or ask Claude Code, if available locally, to summarise it)
   before committing. The equivalent diff against the *original* Antigravity handoff is
   `MERGE_CHANGES-v2.diff`, included alongside this ZIP, but it is not a diff against your
   current git `HEAD` — generate that locally with `git diff` once the files are in place.
3. Create and switch to a **new branch** before staging or committing, keeping `main` clean:
   ```
   git checkout -b integration/claude-merged-v2
   ```
4. Stage, commit, and push on the new branch:
   ```
   git add -A
   git commit -m "Integrate Antigravity + Claude review: privacy fix, honest re-verification,
   admin write gate, approval validation, awareness content corrections, rules test harness
   (emulator tests not yet run), admin mobile scroll-hint fix"
   git push origin integration/claude-merged-v2
   ```
5. Open a pull request against `main` so the change is reviewable, rather than pushing
   straight to the default branch.
6. **Do not merge, deploy Firestore rules, or deploy Hosting until you have personally run the
   Firestore Emulator suite and recorded the result** — this project's own documentation
   (`docs/TEST_RESULTS.md`, `docs/FIREBASE_SECURITY.md`) is explicit that this has not
   happened yet in any session.

## What NOT to do without separate, explicit authorization

- `firebase deploy` of any kind (rules, indexes, or hosting).
- Force-pushing or rewriting history on `main`.
- Deleting the existing repository or any existing branch.
- Replacing `firebase/firestore.rules` with `firebase/firestore.rules.proposed`.

## Recommended next milestone after a successful sync

Run the Firestore Emulator test suite (`tests/rules/`) locally, record the result in
`docs/TEST_RESULTS.md` with the date, and only then decide whether to apply R1–R3.
