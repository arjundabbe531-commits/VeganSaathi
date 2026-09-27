/* ==========================================================================
   VeganSaathi — auth-state.js
   ============================================================================
   The ONE shared Firebase Auth state listener. Every page/script that needs
   to know whether someone is signed in — the navbar, profile.html,
   saved.html, submit-place.html, place-details.html's review/report/save
   actions — imports from here instead of calling onAuthStateChanged itself.
   That keeps exactly one Firebase Auth listener attached per page load,
   fanning out to as many subscribers as that page needs.

   Firebase itself is still only ever initialized in firebase-init.js — this
   module just adds a small, reusable layer on top of getFirebaseAuth().
   ========================================================================== */

import { getFirebaseAuth, getFirebaseDb } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// undefined = auth state not yet known (Firebase hasn't reported in yet)
// null      = signed out
// object    = the Firebase Auth User that's signed in
let currentUser = undefined;
const subscribers = [];
let listenerStarted = false;

function startListenerOnce() {
  if (listenerStarted) return;
  listenerStarted = true;

  const auth = getFirebaseAuth();
  onAuthStateChanged(auth, function (user) {
    currentUser = user; // Firebase sets this to null on sign-out, a User object on sign-in
    subscribers.forEach(function (callback) {
      callback(currentUser);
    });
  });
}

/**
 * Subscribe to auth-state changes. Calls `callback(user)` immediately with
 * the last known state (if Firebase has already reported in), and again
 * every time the state changes afterward — including sign-out, so the
 * navbar/guards update live instead of needing a page reload.
 */
export function onAuthChange(callback) {
  startListenerOnce();
  subscribers.push(callback);
  if (currentUser !== undefined) {
    callback(currentUser);
  }
}

/**
 * Synchronous snapshot of the current auth state. Returns undefined if
 * Firebase hasn't reported in yet, null if signed out, or the Firebase Auth
 * User if signed in. Prefer onAuthChange() when a page first loads (it also
 * catches state changes); this getter is for one-off checks inside an event
 * handler (e.g. "is anyone signed in right now, at the moment of this
 * click?").
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Read a user's Firestore profile document (users/{uid}). Returns null if
 * the document doesn't exist. Firestore rules only allow a user to read
 * their own profile (or an admin to read any), so this will only succeed
 * for the signed-in user's own uid unless the caller is an admin.
 */
export async function fetchUserProfile(uid) {
  const db = getFirebaseDb();
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? snapshot.data() : null;
}
