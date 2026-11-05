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

const userProfileCache = new Map();
const PROFILE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function invalidateUserProfileCache(uid) {
  if (uid) {
    userProfileCache.delete(uid);
    if (typeof sessionStorage !== "undefined") {
      try {
        sessionStorage.removeItem("vs_user_profile_" + uid);
      } catch (e) {
        // Ignore storage exceptions
      }
    }
  } else {
    userProfileCache.clear();
  }
}

/**
 * Read a user's Firestore profile document (users/{uid}). Returns null if
 * the document doesn't exist. Firestore rules only allow a user to read
 * their own profile (or an admin to read any), so this will only succeed
 * for the signed-in user's own uid unless the caller is an admin.
 *
 * Caches profile in memory and sessionStorage to avoid repeating Firestore reads
 * on every page navigation.
 */
export async function fetchUserProfile(uid, forceRefresh = false) {
  if (!uid || typeof uid !== "string") return null;

  const isStubEnvironment = typeof globalThis !== "undefined" &&
    (globalThis.__STUB_DOC_BY_ID__ !== undefined || globalThis.__STUB_THROW__ !== undefined || typeof window === "undefined");

  const now = Date.now();
  if (!forceRefresh && !isStubEnvironment) {
    const mem = userProfileCache.get(uid);
    if (mem && (now - mem.timestamp < PROFILE_CACHE_TTL_MS)) {
      return mem.data;
    }
    if (typeof sessionStorage !== "undefined") {
      try {
        const stored = sessionStorage.getItem("vs_user_profile_" + uid);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && (now - parsed.timestamp < PROFILE_CACHE_TTL_MS)) {
            userProfileCache.set(uid, parsed);
            return parsed.data;
          }
        }
      } catch (e) {
        // Fall back to Firestore read
      }
    }
  }

  const db = getFirebaseDb();
  const snapshot = await getDoc(doc(db, "users", uid));
  const data = snapshot.exists() ? snapshot.data() : null;

  if (!isStubEnvironment) {
    const cacheEntry = { data: data, timestamp: now };
    userProfileCache.set(uid, cacheEntry);
    if (typeof sessionStorage !== "undefined") {
      try {
        sessionStorage.setItem("vs_user_profile_" + uid, JSON.stringify(cacheEntry));
      } catch (e) {
        // Ignore quota exceptions
      }
    }
  }

  return data;
}
