/* ==========================================================================
   VeganSaathi — firebase-config.js
   ============================================================================
   This is the Firebase WEB app config object. Unlike a service-account key
   or an API secret, these values are safe to ship in client-side code — they
   identify the project to Firebase, they do not grant access on their own.
   Real access control lives entirely in firebase/firestore.rules. This
   project does not use Firebase Storage (see docs/TECHNICAL_ARCHITECTURE.md)
   — media uploads will use Cloudinary in a later phase instead.

   Real project values for vegansaathi-88d2f are filled in below as of
   Phase 4. See docs/FIREBASE_SETUP.md for how these were obtained.
   ========================================================================== */

export const firebaseConfig = {
 apiKey: "AIzaSyAeefKhqten5Gq4LpDo3zky2jIlH8UHt80",
  authDomain: "vegansaathi-88d2f.firebaseapp.com",
  projectId: "vegansaathi-88d2f",
  storageBucket: "vegansaathi-88d2f.firebasestorage.app",
  messagingSenderId: "684214243744",
  appId: "1:684214243744:web:f199bd9a2a4c3bdd40d4c5",
  measurementId: "G-J03JXBFMFG"
};
