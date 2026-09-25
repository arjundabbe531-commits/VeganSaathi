/* ==========================================================================
   VeganSaathi — firebase-config.js
   ============================================================================
   This is the Firebase WEB app config object. Unlike a service-account key
   or an API secret, these values are safe to ship in client-side code — they
   identify the project to Firebase, they do not grant access on their own.
   Real access control lives entirely in firebase/firestore.rules and
   firebase/storage.rules. See docs/FIREBASE_SECURITY.md.

   *** PLACEHOLDER VALUES — this project has no real Firebase project yet. ***
   Follow docs/FIREBASE_SETUP.md (steps 1-2) to create one, then replace the
   values below with the real config Firebase gives you at:
   Firebase Console → Project settings → General → Your apps → Web app →
   "SDK setup and configuration" → Config.

   Do NOT import firebase-init.js from any page until these are filled in —
   an invalid apiKey will throw as soon as the app initializes.
   ========================================================================== */

export const firebaseConfig = {
  apiKey: "REPLACE_WITH_YOUR_API_KEY",
  authDomain: "REPLACE_WITH_YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket: "REPLACE_WITH_YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "REPLACE_WITH_YOUR_SENDER_ID",
  appId: "REPLACE_WITH_YOUR_APP_ID"
};
