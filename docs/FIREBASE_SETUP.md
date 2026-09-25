# FIREBASE_SETUP.md — VeganSaathi

A step-by-step guide to standing up the real Firebase project this codebase is built for.
Written for someone who has never used Firebase before. Do these steps **in order** — each
one depends on the last.

Nothing in this guide has been run for you. This environment has no outbound network
access, so Firebase project creation and the Firebase CLI itself must be done on your own
machine (or in Codex/another environment with internet access). Everything on the
*codebase* side — the folder layout, `firebase.json`, the rules files, the frontend config
module — is already in place and waiting for the values you'll get from these steps.

---

## 1. Create the Firebase project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com) and
   sign in with a Google account (use one the whole team can access, or a shared team
   account — you'll need this login again later).
2. Click **Add project**.
3. Name it something like `veganSaathi` or `veganSaathi-ssgmce` (project names must be
   globally unique across all Firebase users, so Firebase will suggest a unique ID like
   `veganSaathi-ssgmce-a1b2c` if your first choice is taken — that's normal, just note
   down whatever ID it actually gives you).
4. Google Analytics is optional for this project — you can disable it to keep setup
   simpler; it isn't used anywhere in this codebase.
5. Click **Create project** and wait for it to finish provisioning.

## 2. Register a Web app

1. On your new project's Overview page, click the **`</>`** (web) icon to add a web app.
2. Give it a nickname, e.g. `VeganSaathi Web`.
3. **Do not** check "Also set up Firebase Hosting" here — we'll do that manually in step 8,
   since this codebase already has its own `frontend/` folder structure.
4. Click **Register app**. Firebase will show you a config object that looks like this:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "veganSaathi-ssgmce-a1b2c.firebaseapp.com",
     projectId: "veganSaathi-ssgmce-a1b2c",
     storageBucket: "veganSaathi-ssgmce-a1b2c.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abcdef1234567890"
   };
   ```

   **Copy this whole object somewhere safe** — you'll paste these exact values into
   `frontend/js/firebase-config.js` in step 5. These values are safe to commit to Git; they
   identify your project, they are not secret credentials (see `docs/FIREBASE_SECURITY.md`
   for why).
5. Click **Continue to console**.

## 3. Enable Authentication

1. In the left sidebar, click **Build → Authentication**, then **Get started**.
2. Under the **Sign-in method** tab, enable:
   - **Email/Password** — click it, toggle **Enable**, click **Save**.
   - **Google** — click it, toggle **Enable**, choose a support email (your team's), click
     **Save**.
3. Leave every other sign-in provider disabled — this project only uses these two.

## 4. Enable Firestore

1. In the left sidebar, click **Build → Firestore Database**, then **Create database**.
2. Choose **Start in production mode** (not test mode) — we already have real security
   rules ready to deploy in step 6, so there's no need for the wide-open test-mode default.
3. Choose a Firestore location close to your users (for SSGMCE/Shegaon, an India region
   such as `asia-south1` (Mumbai) is a sensible choice if offered; otherwise pick whatever
   default Firebase suggests — this can't be changed later without recreating the
   database, but for a CEP pilot any reasonably close region is fine).
4. Click **Enable**. Leave the database empty — no collections need to be created manually;
   Firestore creates a collection automatically the first time a document is written to it
   (which happens starting in Phase 5/6, not this phase).

**Do not enable Firebase Storage.** This project intentionally does not use it — place/
review photos will use Cloudinary in a later phase instead, so the project can stay on
Firebase's free Spark plan (Storage requires the paid Blaze plan to be usable). See
`docs/TECHNICAL_ARCHITECTURE.md` §1 for the reasoning.

## 5. Configure the project locally

1. Open `frontend/js/firebase-config.js` in your editor.
2. Replace every `REPLACE_WITH_YOUR_...` placeholder with the matching real value from the
   config object you copied in step 2. Firebase's config object includes a `storageBucket`
   field by default even though this project doesn't use Storage — that's fine, paste it in
   as given; it's simply unused.
3. Save the file. **Do not** create a separate `.env` file for this — the Firebase web
   config is meant to live in client-side code (see `docs/FIREBASE_SECURITY.md`).
4. Install the Firebase CLI, if you haven't already:

   ```bash
   npm install -g firebase-tools
   ```

   (This could not be run in the sandbox this project was scaffolded in — that environment
   has no outbound network access. Run it on your own machine.)
5. Confirm the install:

   ```bash
   firebase --version
   ```
6. Log in:

   ```bash
   firebase login
   ```

   This opens a browser window to sign in with the same Google account you used in step 1.
7. From the project root (the folder containing `firebase.json`), link this codebase to
   your real Firebase project:

   ```bash
   firebase use --add
   ```

   Select the project you created in step 1, and give it the alias `default` when asked.
   This creates a local `.firebaserc` file — it's intentionally listed in `.gitignore`
   (see `docs/FIREBASE_SECURITY.md`), so each teammate runs this command once on their own
   machine rather than sharing one committed file.

## 6. Deploy the security rules

This project's `firebase.json` (at the project root) points Firestore's rules at the
`firebase/` folder:

```json
{
  "firestore": { "rules": "firebase/firestore.rules", "indexes": "firebase/firestore.indexes.json" },
  "hosting": { "public": "frontend", ... }
}
```

(`firebase.json` lives at the project root, not inside `firebase/`, because that's where
the Firebase CLI looks for it by default when you run commands from the project folder —
putting it inside `firebase/` would mean typing `--config firebase/firebase.json` on every
single command. The actual rules files still live in `firebase/`, as planned. There is no
`storage` section — see the note in step 4.)

Deploy just the rules and indexes (not hosting yet):

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

If this succeeds, your Firestore is now locked down by the rules described in
`docs/FIREBASE_SECURITY.md` — nobody can read or write anything they shouldn't, even though
no application feature uses the database yet.

## 7. Deploy Hosting (later — not part of this phase)

Once there's something real to serve beyond the Phase 2 static shell (i.e. once Phase 4+
features are wired up), deploy the frontend with:

```bash
firebase deploy --only hosting
```

This isn't done as part of Phase 3 — see `docs/PROJECT_STATUS.md` for what's actually
complete right now.

---

## Troubleshooting

- **"Error: No currently active project"** when deploying → you skipped step 5.7
  (`firebase use --add`).
- **Rules deploy rejected with a syntax error** → re-check `firebase/firestore.rules` or
  `firebase/storage.rules` for a stray bracket; the Firebase CLI's error message names the
  exact line.
- **`npm install -g firebase-tools` fails with a permissions error** → on macOS/Linux, either
  use `sudo`, or better, install Node via `nvm` so global installs don't need `sudo` at all.
