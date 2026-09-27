/* ==========================================================================
   VeganSaathi — firebase-init.js
   ============================================================================
   The ONE place Firebase gets initialized. Phase 4+ feature modules (auth,
   places, reviews, reports, admin) should import getFirebaseAuth() /
   getFirebaseDb() from here rather than calling initializeApp() themselves —
   that keeps Firebase setup out of feature code, per
   docs/TECHNICAL_ARCHITECTURE.md.

   This project uses Firebase for Authentication + Firestore ONLY. Firebase
   Storage is intentionally not enabled or initialized anywhere in this
   codebase — future image uploads (place photos, etc.) will use Cloudinary
   instead, in a later phase. See docs/TECHNICAL_ARCHITECTURE.md for why.

   Loaded via the official Firebase CDN as native ES modules — no npm install,
   no bundler, consistent with this project's plain-JS architecture. Pinned to
   a specific SDK version so an unrelated Firebase release can't change this
   project's behavior without the team noticing.

   Imported (directly or transitively) by every page as of Phase 4 —
   frontend/js/firebase-config.js now holds real project values for
   vegansaathi-88d2f. auth-state.js, auth-ui.js, profile-page.js,
   saved-page.js, place-details.js, and submit-place-guard.js all import
   getFirebaseAuth()/getFirebaseDb() from here rather than initializing
   Firebase themselves.
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;

function ensureInitialized() {
  if (firebaseApp) return;
  firebaseApp = initializeApp(firebaseConfig);
  firebaseAuth = getAuth(firebaseApp);
  firebaseDb = getFirestore(firebaseApp);
}

export function getFirebaseApp() {
  ensureInitialized();
  return firebaseApp;
}

export function getFirebaseAuth() {
  ensureInitialized();
  return firebaseAuth;
}

export function getFirebaseDb() {
  ensureInitialized();
  return firebaseDb;
}
